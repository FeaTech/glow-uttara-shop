import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { evaluateCoupon } from "@/lib/coupons.functions";

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
  paymentMethod: z.enum(["cod", "online"]).default("cod"),
  couponCode: z.string().trim().max(40).optional(),
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
      const result = await evaluateCoupon(data.couponCode, subtotal);
      if (result.valid) {
        discount = result.discount;
        couponCode = result.code;
      } else {
        throw new Error(result.message);
      }
    }

    const total = Math.max(0, subtotal - discount);

    // Some Supabase JWTs omit `email` from the claims, which silently skipped
    // every confirmation email — fall back to the authenticated user record.
    let customerEmail = (context.claims as { email?: string }).email ?? null;
    if (!customerEmail) {
      const { data: authUser } = await supabase.auth.getUser();
      customerEmail = authUser?.user?.email ?? null;
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        subtotal_inr: subtotal,
        discount_inr: discount,
        coupon_code: couponCode,
        total_inr: total,
        shipping_address: data.shippingAddress,
        customer_email: customerEmail,
        payment_method: data.paymentMethod,
        payment_status: "pending",
        status: "pending",
      })
      .select("id")
      .single();
    if (orderError) throw orderError;

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

    // Coupon usage increment and cart teardown are independent of each other —
    // run them concurrently instead of in series. The coupon increment is now a
    // single atomic RPC (was SELECT + UPDATE, which could also lose a
    // concurrent redemption).
    await Promise.all([
      couponCode
        ? import("@/integrations/supabase/client.server").then(({ supabaseAdmin }) =>
            supabaseAdmin.rpc("increment_coupon_usage", { _code: couponCode! }),
          )
        : Promise.resolve(),
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
        totalInr: total,
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

/** Cancel a still-pending order and restore stock. Ownership verified before mutating. */
export const cancelOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => getOrderSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: order } = await supabase
      .from("orders")
      .select("id, status, order_items(product_id, variant_id, quantity)")
      .eq("id", data.orderId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!order) throw new Error("Order not found");
    if (order.status !== "pending" && order.status !== "processing") {
      throw new Error("This order can no longer be cancelled");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Restore variant stock and its product-level inventory mirror in one
    // atomic statement. This previously looped per line item with a SELECT +
    // UPDATE each (an N+1, and a read-modify-write race).
    const { error: restoreError } = await supabaseAdmin.rpc("restore_order_stock", {
      _order_id: order.id,
    });
    if (restoreError) throw restoreError;

    await supabaseAdmin.from("orders").update({ status: "cancelled" }).eq("id", order.id);
    return { ok: true };
  });
