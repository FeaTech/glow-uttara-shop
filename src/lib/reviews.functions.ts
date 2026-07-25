import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}
function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}
function getPublicClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(url, key, {
    global: { fetch: createSupabaseFetch(key) },
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
}

const productIdSchema = z.object({ productId: z.string().uuid() });

/** Public: list reviews for a product (newest first). */
export const listReviews = createServerFn({ method: "GET" })
  .inputValidator((input) => productIdSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = getPublicClient();
    const { data: reviews, error } = await supabase
      .from("reviews")
      .select("id, rating, title, body, author_name, is_verified, created_at")
      .eq("product_id", data.productId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return reviews ?? [];
  });

const submitReviewSchema = z.object({
  productId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().max(2000).optional(),
});

/** Create or update the signed-in user's review; verified if they've ordered the item. */
export const submitReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => submitReviewSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verified-buyer check: did this user ever order this product?
    const { data: purchased } = await supabase
      .from("order_items")
      .select("id, orders!inner(user_id)")
      .eq("product_id", data.productId)
      .eq("orders.user_id", userId)
      .limit(1)
      .maybeSingle();

    // Best-effort display name from the profile.
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();

    const { error } = await supabase.from("reviews").upsert(
      {
        product_id: data.productId,
        user_id: userId,
        rating: data.rating,
        title: data.title || null,
        body: data.body || null,
        author_name: profile?.full_name || null,
        is_verified: Boolean(purchased),
      },
      { onConflict: "product_id,user_id" },
    );
    if (error) throw error;
    return { ok: true, verified: Boolean(purchased) };
  });

const reviewIdSchema = z.object({ reviewId: z.string().uuid() });

export const deleteReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => reviewIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("reviews").delete().eq("id", data.reviewId);
    if (error) throw error;
    return { ok: true };
  });
