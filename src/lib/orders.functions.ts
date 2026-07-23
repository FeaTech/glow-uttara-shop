import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
      .select("*, products(id, name, price_inr, images), product_variants(id, variant_name, price_inr)")
      .eq("cart_id", cart.id);
    if (itemsError) throw itemsError;
    if (!items || items.length === 0) throw new Error("Cart is empty");

    const total = items.reduce((sum, item) => {
      const price = item.product_variants?.price_inr ?? item.products?.price_inr ?? 0;
      return sum + price * item.quantity;
    }, 0);

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        total_inr: total,
        shipping_address: data.shippingAddress,
        payment_status: data.paymentMethod === "cod" ? "pending" : "pending",
        status: "pending",
      })
      .select("id")
      .single();
    if (orderError) throw orderError;

    const orderItems = items.map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      variant_id: item.variant_id,
      quantity: item.quantity,
      price_inr: item.product_variants?.price_inr ?? item.products?.price_inr ?? 0,
      name: item.products?.name ?? "Product",
    }));

    const { error: orderItemsError } = await supabase.from("order_items").insert(orderItems);
    if (orderItemsError) throw orderItemsError;

    await supabase.from("cart_items").delete().eq("cart_id", cart.id);
    await supabase.from("cart").update({ status: "converted" }).eq("id", cart.id);

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
