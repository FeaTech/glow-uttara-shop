import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { evaluateCoupon, reserveCouponUsage } from "@/lib/coupons.functions";
import { computeOrderTotals, type PaymentChannel } from "@/lib/pricing";

const addressSchema = z.object({
  label: z.string().optional(),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  pincode: z.string().min(1),
  country: z.string().default("India"),
});

const createOrderSchema = z.object({
  shippingAddress: addressSchema,
  paymentChannel: z
    .enum(["cod", "upi", "credit_card", "debit_card", "netbanking", "wallet"])
    .default("cod"),
  couponCode: z.string().trim().max(40).optional(),
  idempotencyKey: z.string().uuid(),
});


export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createOrderSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: cart } = await supabase
      .from("cart")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();
    if (!cart) throw new Error("Cart not found");

    const { data: items, error: itemsError } = await supabase
      .from("cart_items")
      .select("*, products(id, name, price_inr, images, stock), product_variants(id, variant_name, price_inr, stock)")
      .eq("cart_id", cart.id);
    if (itemsError) throw itemsError;
    if (!items || items.length === 0) throw new Error("Cart is empty");

    // Prevent overselling: ensure every line has enough stock.
    for (const item of items) {
      const available = item.product_variants?.stock ?? item.products?.stock ?? 0;
      if (available < item.quantity) {
        const name = item.products?.name ?? "An item";
        throw new Error(
          available <= 0
            ? `${name} is out of stock`
            : `Only ${available} of ${name} left in stock`,
        );
      }
    }

    const subtotal = items.reduce((sum, item) => {
      const price = item.product_variants?.price_inr ?? item.products?.price_inr ?? 0;
      return sum + price * item.quantity;
    }, 0);

    // Authoritatively re-validate the coupon on the server.
    let discount = 0;
    let couponCode: string | null = null;
    if (data.couponCode) {
      const result = await evaluateCoupon(data.couponCode, subtotal, userId);
      if (result.valid) {
        discount = result.discount;
        couponCode = result.code;
      } else {
        throw new Error(result.message);
      }
    }

    // Authoritative money maths, in paise, on the server.
    const { resolvePricingConfig } = await import("@/lib/pricing.server");
    const channel = data.paymentChannel as PaymentChannel;
    const totals = computeOrderTotals({
      subtotalPaise: subtotal * 100,
      discountPaise: discount * 100,
      channel,
      config: resolvePricingConfig(),
    });
    const paymentMethod = channel === "cod" ? "cod" : "online";

    // Some Supabase JWTs omit `email` from the claims, which silently skipped
    // every confirmation email — fall back to the authenticated user record.
    let customerEmail = (context.claims as { email?: string }).email ?? null;
    if (!customerEmail) {
      const { data: authUser } = await supabase.auth.getUser();
      customerEmail = authUser?.user?.email ?? null;
    }

    const { data: insertedOrder, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        idempotency_key: data.idempotencyKey,
        subtotal_inr: subtotal,
        discount_inr: discount,
        coupon_code: couponCode,
        total_inr: Math.round(totals.totalPaise / 100),
        total_paise: totals.totalPaise,
        taxes_inr: Math.round(totals.taxPaise / 100),
        tax_paise: totals.taxPaise,
        tax_rate_bps: totals.taxRateBps,
        payment_fee_rate_bps: totals.feeRateBps,
        payment_fee_paise: totals.feePaise,
        shipping_inr: 0,
        shipping_address: data.shippingAddress,
        customer_email: customerEmail,
        payment_method: paymentMethod,
        payment_channel: channel,
        payment_status: "pending",
        status: "pending",
      })
      .select("id")
      .single();
    let order = insertedOrder;
    if (orderError) {
      if (orderError.code !== "23505") throw orderError;
      const { data: existing, error } = await supabase
        .from("orders")
        .select("id")
        .eq("user_id", userId)
        .eq("idempotency_key", data.idempotencyKey)
        .single();
      if (error || !existing) throw error ?? orderError;
      return { orderId: existing.id };
    }
    if (!order) throw new Error("Could not create order");

    const orderItems = items.map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      variant_id: item.variant_id,
      variant_name: item.product_variants?.variant_name ?? null,
      quantity: item.quantity,
      price_inr: item.product_variants?.price_inr ?? item.products?.price_inr ?? 0,
      name: item.products?.name ?? "Product",
    }));

    const { error: orderItemsError } = await supabase.from("order_items").insert(orderItems);
    if (orderItemsError) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("orders").delete().eq("id", order.id);
      throw orderItemsError;
    }

    if (couponCode) {
      try {
        await reserveCouponUsage(couponCode, userId, order.id);
      } catch (error) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.rpc("restore_order_stock", { _order_id: order.id });
        await supabaseAdmin.from("orders").delete().eq("id", order.id);
        throw error;
      }
    }

    // Coupon usage increment and cart teardown are independent of each other —
    // run them concurrently instead of in series. The coupon increment is now a
    // single atomic RPC (was SELECT + UPDATE, which could also lose a
    // concurrent redemption).
    await Promise.all([
      supabase.from("cart_items").delete().eq("cart_id", cart.id),
      supabase.from("cart").update({ status: "converted" }).eq("id", cart.id),
    ]);

    if (customerEmail) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();
      const { sendEmailSafe, orderConfirmationEmail } = await import("@/lib/email.server");
      const mail = orderConfirmationEmail({
        orderId: order.id,
        items: orderItems.map((i) => ({
          name: i.name,
          variantName: i.variant_name,
          quantity: i.quantity,
          priceInr: i.price_inr,
        })),
        subtotalInr: subtotal,
        discountInr: discount,
        taxesInr: Math.round(totals.taxPaise / 100),
        totalInr: Math.round(totals.totalPaise / 100),
        customerName: profile?.full_name ?? null,
        shippingAddress: data.shippingAddress,
      });
      await sendEmailSafe({ to: customerEmail, subject: mail.subject, html: mail.html });
    }


    return { orderId: order.id };
  });

export const getOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

const getOrderSchema = z.object({ orderId: z.string().uuid() });

export const getOrderById = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => getOrderSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: order, error } = await supabase
      .from("orders")
      .select("*, order_items(*, products(slug, images))")
      .eq("id", data.orderId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return order;
  });

const abandonOrderSchema = z.object({ orderId: z.string().uuid() });

/**
 * Customer walked away from the payment modal. Undo the order completely —
 * restore stock, release the coupon, and put the items back in the cart —
 * so nothing is left sitting as "pending payment".
 */
export const abandonUnpaidOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => abandonOrderSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: order, error } = await supabase
      .from("orders")
      .select("id, payment_status, coupon_code, razorpay_payment_id, order_items(product_id, variant_id, quantity)")
      .eq("id", data.orderId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!order) throw new Error("Order not found");
    // Never unwind an order that was actually paid.
    if (order.payment_status === "paid" || order.razorpay_payment_id) {
      return { ok: false as const, restored: false };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (order.coupon_code) {
      await supabaseAdmin.rpc("release_coupon_usage", { _order_id: order.id });
    }
    await supabaseAdmin.rpc("restore_order_stock", { _order_id: order.id });

    // Put the lines back into an active cart.
    const items = order.order_items ?? [];
    if (items.length > 0) {
      let cartId: string | undefined;
      const { data: activeCart } = await supabase
        .from("cart")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();
      if (activeCart) {
        cartId = activeCart.id;
      } else {
        const { data: created, error: cartError } = await supabase
          .from("cart")
          .insert({ user_id: userId, status: "active" })
          .select("id")
          .single();
        if (cartError) throw cartError;
        cartId = created.id;
      }

      for (const item of items) {
        let existingQuery = supabase
          .from("cart_items")
          .select("id, quantity")
          .eq("cart_id", cartId)
          .eq("product_id", item.product_id);
        existingQuery = item.variant_id
          ? existingQuery.eq("variant_id", item.variant_id)
          : existingQuery.is("variant_id", null);
        const { data: existing } = await existingQuery.maybeSingle();

        if (existing) {
          await supabase
            .from("cart_items")
            .update({ quantity: existing.quantity + item.quantity })
            .eq("id", existing.id);
        } else {
          await supabase.from("cart_items").insert({
            cart_id: cartId,
            product_id: item.product_id,
            variant_id: item.variant_id,
            quantity: item.quantity,
          });
        }
      }
    }

    // Remove the abandoned order entirely (order_items cascade).
    await supabaseAdmin.from("order_items").delete().eq("order_id", order.id);
    await supabaseAdmin.from("orders").delete().eq("id", order.id);

    return { ok: true as const, restored: items.length > 0 };
  });

const cancelOrderSchema = z.object({ orderId: z.string().uuid() });

/** A customer may cancel only their own order while it is still `pending`. */
export const cancelOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => cancelOrderSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: order, error } = await supabase
      .from("orders")
      .select("id, status, payment_status, coupon_code")
      .eq("id", data.orderId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!order) throw new Error("Order not found");
    if (order.status === "cancelled") throw new Error("This order is already cancelled");
    if (order.status !== "pending") {
      throw new Error("This order has already been processed and can no longer be cancelled");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Put the stock back and release any coupon hold, then mark it cancelled.
    await supabaseAdmin.rpc("restore_order_stock", { _order_id: order.id });
    if (order.coupon_code) {
      await supabaseAdmin.rpc("release_coupon_usage", { _order_id: order.id });
    }
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", order.id)
      .eq("user_id", userId);
    if (updateError) throw updateError;

    return { ok: true as const };
  });
