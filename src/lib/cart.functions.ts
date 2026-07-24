import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const addToCartSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  quantity: z.number().int().min(1).max(99),
});

const updateCartItemSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().int().min(0).max(99),
});

const removeCartItemSchema = z.object({
  itemId: z.string().uuid(),
});

type LuxySupabase = SupabaseClient<Database>;

async function ensureCart(supabase: LuxySupabase, userId: string) {
  const { data: existing } = await supabase
    .from("cart")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (existing) return existing.id;
  const { data: created, error } = await supabase
    .from("cart")
    .insert({ user_id: userId, status: "active" })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}

export const getCart = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: cart } = await supabase
      .from("cart")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (!cart) return { items: [], total: 0 };

    const { data: items, error } = await supabase
      .from("cart_items")
      .select("*, products(id, slug, name, price_inr, compare_price_inr, images), product_variants(id, variant_name, price_inr)")
      .eq("cart_id", cart.id)
      .order("created_at", { ascending: true });
    if (error) throw error;

    const total = (items ?? []).reduce((sum, item) => {
      const price = item.product_variants?.price_inr ?? item.products?.price_inr ?? 0;
      return sum + price * item.quantity;
    }, 0);

    return { items: items ?? [], total };
  });

export const addToCart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => addToCartSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const cartId = await ensureCart(supabase, userId);

    let existingQuery = supabase
      .from("cart_items")
      .select("id, quantity")
      .eq("cart_id", cartId)
      .eq("product_id", data.productId);
    if (data.variantId) {
      existingQuery = existingQuery.eq("variant_id", data.variantId);
    } else {
      existingQuery = existingQuery.is("variant_id", null);
    }
    const { data: existing } = await existingQuery.maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("cart_items")
        .update({ quantity: existing.quantity + data.quantity })
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("cart_items").insert({
        cart_id: cartId,
        product_id: data.productId,
        variant_id: data.variantId ?? null,
        quantity: data.quantity,
      });
      if (error) throw error;
    }
    return { ok: true };
  });

export const updateCartItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateCartItemSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: cart } = await supabase
      .from("cart")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();
    if (!cart) throw new Error("Cart not found");

    if (data.quantity === 0) {
      const { error } = await supabase.from("cart_items").delete().eq("id", data.itemId).eq("cart_id", cart.id);
      if (error) throw error;
      return { ok: true };
    }
    const { error } = await supabase
      .from("cart_items")
      .update({ quantity: data.quantity })
      .eq("id", data.itemId)
      .eq("cart_id", cart.id);
    if (error) throw error;
    return { ok: true };
  });

export const removeCartItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => removeCartItemSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("cart_items").delete().eq("id", data.itemId);
    if (error) throw error;
    return { ok: true };
  });

const reorderSchema = z.object({ orderId: z.string().uuid() });

/** Add every line from a past order back into the active cart. */
export const reorderToCart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => reorderSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify the order belongs to the caller, then read its lines.
    const { data: order } = await supabase
      .from("orders")
      .select("id, order_items(product_id, variant_id, quantity)")
      .eq("id", data.orderId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!order) throw new Error("Order not found");

    const items = order.order_items ?? [];
    if (items.length === 0) throw new Error("This order has no items");

    const cartId = await ensureCart(supabase, userId);

    let added = 0;
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
        await supabase.from("cart_items").update({ quantity: existing.quantity + item.quantity }).eq("id", existing.id);
      } else {
        await supabase.from("cart_items").insert({
          cart_id: cartId,
          product_id: item.product_id,
          variant_id: item.variant_id,
          quantity: item.quantity,
        });
      }
      added += 1;
    }

    return { ok: true, added };
  });
