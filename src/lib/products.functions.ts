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

export const SORT_OPTIONS = ["newest", "price_asc", "price_desc", "rating", "popular"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

const listProductsSchema = z.object({
  category: z.string().optional(),
  featured: z.boolean().optional(),
  search: z.string().trim().max(120).optional(),
  tag: z.string().optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  sort: z.enum(SORT_OPTIONS).optional(),
  limit: z.number().min(1).max(60).optional(),
});

function applySort<T>(query: any, sort?: SortOption) {
  switch (sort) {
    case "price_asc":
      return query.order("price_inr", { ascending: true });
    case "price_desc":
      return query.order("price_inr", { ascending: false });
    case "rating":
      return query.order("rating_avg", { ascending: false }).order("rating_count", { ascending: false });
    case "popular":
      return query.order("rating_count", { ascending: false }).order("is_featured", { ascending: false });
    case "newest":
    default:
      return query.order("created_at", { ascending: false });
  }
}

export const listProducts = createServerFn({ method: "GET" })
  .inputValidator((input) => listProductsSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = getPublicClient();
    const select = data.category ? "*, categories!inner(name, slug)" : "*, categories(name, slug)";
    let query = supabase.from("products").select(select);

    if (data.category) query = query.eq("categories.slug", data.category);
    if (data.featured) query = query.eq("is_featured", true);
    if (data.tag) query = query.contains("tags", [data.tag]);
    if (typeof data.minPrice === "number") query = query.gte("price_inr", data.minPrice);
    if (typeof data.maxPrice === "number") query = query.lte("price_inr", data.maxPrice);
    if (data.search) {
      const term = data.search.replace(/[%,]/g, " ").trim();
      if (term) {
        query = query.or(
          `name.ilike.%${term}%,short_description.ilike.%${term}%,description.ilike.%${term}%`,
        );
      }
    }

    query = applySort(query, data.sort);
    if (data.limit) query = query.limit(data.limit);

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

const relatedSchema = z.object({
  productId: z.string().uuid(),
  categoryId: z.string().uuid().nullable().optional(),
  limit: z.number().min(1).max(12).optional(),
});

export const getRelatedProducts = createServerFn({ method: "GET" })
  .inputValidator((input) => relatedSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = getPublicClient();
    let query = supabase
      .from("products")
      .select("*, categories(name, slug)")
      .neq("id", data.productId)
      .limit(data.limit ?? 4);
    if (data.categoryId) query = query.eq("category_id", data.categoryId);
    const { data: products, error } = await query.order("rating_avg", { ascending: false });
    if (error) throw error;
    return products ?? [];
  });

const idsSchema = z.object({ ids: z.array(z.string().uuid()).max(20) });

/** Fetch a set of products by id (used by the "recently viewed" strip). */
export const getProductsByIds = createServerFn({ method: "GET" })
  .inputValidator((input) => idsSchema.parse(input))
  .handler(async ({ data }) => {
    if (data.ids.length === 0) return [];
    const supabase = getPublicClient();
    const { data: products, error } = await supabase
      .from("products")
      .select("*, categories(name, slug)")
      .in("id", data.ids);
    if (error) throw error;
    return products ?? [];
  });

/** Lightweight search used by the header command palette. */
const quickSearchSchema = z.object({ q: z.string().trim().max(120) });

export const quickSearchProducts = createServerFn({ method: "GET" })
  .inputValidator((input) => quickSearchSchema.parse(input))
  .handler(async ({ data }) => {
    const term = data.q.replace(/[%,]/g, " ").trim();
    if (!term) return [];
    const supabase = getPublicClient();
    const { data: products, error } = await supabase
      .from("products")
      .select("id, slug, name, price_inr, images, categories(name)")
      .or(`name.ilike.%${term}%,short_description.ilike.%${term}%`)
      .limit(6);
    if (error) throw error;
    return products ?? [];
  });
