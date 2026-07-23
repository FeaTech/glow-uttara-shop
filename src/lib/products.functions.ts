import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
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

export const listCategories = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = getPublicClient();
  const { data, error } = await supabase.from("categories").select("*").order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
});

const listProductsSchema = z.object({
  category: z.string().optional(),
  featured: z.boolean().optional(),
  limit: z.number().min(1).max(50).optional(),
});

export const listProducts = createServerFn({ method: "GET" })
  .inputValidator((input) => listProductsSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = getPublicClient();
    let query = supabase.from("products").select("*, categories(name, slug)").order("created_at", { ascending: false });
    if (data.category) {
      query = query.eq("categories.slug", data.category);
    }
    if (data.featured) {
      query = query.eq("is_featured", true);
    }
    if (data.limit) {
      query = query.limit(data.limit);
    }
    const { data: products, error } = await query;
    if (error) throw error;
    return products ?? [];
  });

const getProductSchema = z.object({ slug: z.string() });

export const getProductBySlug = createServerFn({ method: "GET" })
  .inputValidator((input) => getProductSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = getPublicClient();
    const { data: product, error } = await supabase
      .from("products")
      .select("*, categories(name, slug), product_variants(*)")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw error;
    return product;
  });
