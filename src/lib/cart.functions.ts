import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

async function ensureCart(supabase: ReturnType<typeof requireSupabaseAuth> extends { handler: (args: any) => Promise<{ context: { supabase: infer S } }> } ? never : any, userId: string) {
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

    const { data: existing } = await supabase
      .from("cart_items")
      .select("id, quantity")
      .eq("cart_id", cartId)
      .eq("product_id", data.productId)
      .is("variant_id", data.variantId ?? null)
      .maybeSingle();

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
    if (data.quantity === 0) {
      const { error } = await supabase.from("cart_items").delete().eq("id", data.itemId);
      if (error) throw error;
      return { ok: true };
    }
    const { error } = await supabase
      .from("cart_items")
      .update({ quantity: data.quantity })
      .eq("id", data.itemId)
      .eq("cart_id", (
        await supabase.from("cart").select("id").eq("user_id", userId).eq("status", "active").single()
      ).data?.id);
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
