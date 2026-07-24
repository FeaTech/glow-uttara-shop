import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const productIdSchema = z.object({ productId: z.string().uuid() });

/** Full wishlist with joined product info (for the wishlist page). */
export const getWishlist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("wishlist_items")
      .select("id, created_at, products(*, categories(name, slug))")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

/** Just the product ids — cached once and used to light up hearts across the catalog. */
export const getWishlistIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("wishlist_items")
      .select("product_id")
      .eq("user_id", userId);
    if (error) throw error;
    return (data ?? []).map((r) => r.product_id);
  });

export const addToWishlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => productIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("wishlist_items")
      .upsert({ user_id: userId, product_id: data.productId }, { onConflict: "user_id,product_id" });
    if (error) throw error;
    return { ok: true, wishlisted: true };
  });

export const removeFromWishlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => productIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("wishlist_items")
      .delete()
      .eq("user_id", userId)
      .eq("product_id", data.productId);
    if (error) throw error;
    return { ok: true, wishlisted: false };
  });

export const toggleWishlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => productIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("wishlist_items")
      .select("id")
      .eq("user_id", userId)
      .eq("product_id", data.productId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase.from("wishlist_items").delete().eq("id", existing.id);
      if (error) throw error;
      return { ok: true, wishlisted: false };
    }
    const { error } = await supabase
      .from("wishlist_items")
      .insert({ user_id: userId, product_id: data.productId });
    if (error) throw error;
    return { ok: true, wishlisted: true };
  });
