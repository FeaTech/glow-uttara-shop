import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type LuxySupabase = SupabaseClient<Database>;

/** Throw unless the caller holds the 'admin' role (checked with their own RLS client). */
async function assertAdmin(supabase: LuxySupabase, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin access required");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
export const adminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = context.supabase;

    const [{ data: orders }, { count: productCount }, { count: customerCount }] = await Promise.all([
      db.from("orders").select("total_inr, status, created_at"),
      db.from("products").select("id", { count: "exact", head: true }),
      db.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "customer"),
    ]);

    const revenue = (orders ?? [])
      .filter((o) => o.status !== "cancelled")
      .reduce((sum, o) => sum + o.total_inr, 0);

    const pending = (orders ?? []).filter((o) => o.status === "pending").length;

    // Revenue for the last 7 days (for the dashboard chart).
    const days: { date: string; revenue: number; orders: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const dayOrders = (orders ?? []).filter((o) => {
        const t = new Date(o.created_at).getTime();
        return t >= d.getTime() && t < next.getTime() && o.status !== "cancelled";
      });
      days.push({
        date: d.toLocaleDateString("en-IN", { weekday: "short" }),
        revenue: dayOrders.reduce((s, o) => s + o.total_inr, 0),
        orders: dayOrders.length,
      });
    }

    const { data: lowStock } = await db
      .from("products")
      .select("id, name, slug, stock")
      .lte("stock", 10)
      .order("stock", { ascending: true })
      .limit(8);

    return {
      revenue,
      orderCount: (orders ?? []).length,
      pendingCount: pending,
      productCount: productCount ?? 0,
      customerCount: customerCount ?? 0,
      revenueByDay: days,
      lowStock: lowStock ?? [],
    };
  });

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------
export const adminListProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = context.supabase;
    const { data, error } = await db
      .from("products")
      .select("*, categories(name, slug)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

const productInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  slug: z.string().max(200).optional(),
  short_description: z.string().max(300).optional().nullable(),
  description: z.string().max(4000).optional().nullable(),
  price_inr: z.number().int().min(0),
  compare_price_inr: z.number().int().min(0).nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  images: z.array(z.string()).default([]),
  stock: z.number().int().min(0).default(0),
  is_featured: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
});

export const adminSaveProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => productInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = context.supabase;

    const slug = data.slug?.trim() || slugify(data.name);
    const payload = {
      name: data.name,
      slug,
      short_description: data.short_description || null,
      description: data.description || null,
      price_inr: data.price_inr,
      compare_price_inr: data.compare_price_inr ?? null,
      category_id: data.category_id ?? null,
      images: data.images,
      stock: data.stock,
      is_featured: data.is_featured,
      tags: data.tags,
    };

    if (data.id) {
      const { error } = await db.from("products").update(payload).eq("id", data.id);
      if (error) throw error;
      return { ok: true, id: data.id };
    }
    const { data: created, error } = await db.from("products").insert(payload).select("id").single();
    if (error) throw error;
    return { ok: true, id: created.id };
  });

const idSchema = z.object({ id: z.string().uuid() });

export const adminDeleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = context.supabase;
    const { error } = await db.from("products").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

const stockSchema = z.object({ id: z.string().uuid(), stock: z.number().int().min(0) });

export const adminUpdateStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => stockSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = context.supabase;
    const { error } = await db.from("products").update({ stock: data.stock }).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Product variants
// ---------------------------------------------------------------------------
const productIdParamSchema = z.object({ productId: z.string().uuid() });

export const adminListVariants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => productIdParamSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = context.supabase;
    const { data: variants, error } = await db
      .from("product_variants")
      .select("*")
      .eq("product_id", data.productId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return variants ?? [];
  });

const variantInputSchema = z.object({
  id: z.string().uuid().optional(),
  productId: z.string().uuid(),
  variant_name: z.string().min(1).max(120),
  sku: z.string().max(80).optional().nullable(),
  price_inr: z.number().int().min(0).nullable().optional(),
  stock: z.number().int().min(0).default(0),
});

export const adminSaveVariant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => variantInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = context.supabase;
    const payload = {
      product_id: data.productId,
      variant_name: data.variant_name,
      sku: data.sku || null,
      price_inr: data.price_inr ?? null,
      stock: data.stock,
    };
    if (data.id) {
      const { error } = await db.from("product_variants").update(payload).eq("id", data.id);
      if (error) throw error;
      return { ok: true, id: data.id };
    }
    const { data: created, error } = await db.from("product_variants").insert(payload).select("id").single();
    if (error) throw error;
    return { ok: true, id: created.id };
  });

export const adminDeleteVariant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = context.supabase;
    const { error } = await db.from("product_variants").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Reviews moderation
// ---------------------------------------------------------------------------
export const adminListReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = context.supabase;
    const { data, error } = await db
      .from("reviews")
      .select("*, products(name, slug)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  });

export const adminDeleteReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = context.supabase;
    const { error } = await db.from("reviews").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
export const adminListCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = context.supabase;
    const { data, error } = await db
      .from("categories")
      .select("*, products(count)")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

const categoryInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  slug: z.string().max(80).optional(),
  description: z.string().max(300).optional().nullable(),
  sort_order: z.number().int().min(0).default(0),
});

export const adminSaveCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => categoryInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = context.supabase;
    const payload = {
      name: data.name,
      slug: data.slug?.trim() || slugify(data.name),
      description: data.description || null,
      sort_order: data.sort_order,
    };
    if (data.id) {
      const { error } = await db.from("categories").update(payload).eq("id", data.id);
      if (error) throw error;
      return { ok: true, id: data.id };
    }
    const { data: created, error } = await db.from("categories").insert(payload).select("id").single();
    if (error) throw error;
    return { ok: true, id: created.id };
  });

export const adminDeleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = context.supabase;
    const { error } = await db.from("categories").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------
export const adminListOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = context.supabase;
    const { data: orders, error } = await db
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    if (!orders?.length) return [];

    // No direct FK between orders and profiles (both reference auth.users),
    // so fetch the customer profiles separately and merge them in.
    const userIds = [...new Set(orders.map((o) => o.user_id))];
    const { data: profiles } = await db
      .from("profiles")
      .select("id, full_name, phone")
      .in("id", userIds);
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

    return orders.map((o) => ({
      ...o,
      profiles: byId.get(o.user_id) ?? null,
    }));
  });

const orderStatusSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(["pending", "processing", "shipped", "delivered", "cancelled"]).optional(),
  paymentStatus: z.enum(["pending", "paid", "failed", "refunded"]).optional(),
});

export const adminUpdateOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => orderStatusSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = context.supabase;
    const patch: Record<string, unknown> = {};
    if (data.status) patch.status = data.status;
    if (data.paymentStatus) patch.payment_status = data.paymentStatus;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await db.from("orders").update(patch as any).eq("id", data.orderId);
    if (error) throw error;
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------
export const adminListCoupons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = context.supabase;
    const { data, error } = await db.from("coupons").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

const couponInputSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().min(2).max(40),
  description: z.string().max(200).optional().nullable(),
  discount_type: z.enum(["percent", "fixed"]),
  discount_value: z.number().int().min(1),
  min_order_inr: z.number().int().min(0).default(0),
  max_discount_inr: z.number().int().min(0).nullable().optional(),
  active: z.boolean().default(true),
  usage_limit: z.number().int().min(1).nullable().optional(),
});

export const adminSaveCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => couponInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = context.supabase;
    const payload = {
      code: data.code.trim().toUpperCase(),
      description: data.description || null,
      discount_type: data.discount_type,
      discount_value: data.discount_value,
      min_order_inr: data.min_order_inr,
      max_discount_inr: data.max_discount_inr ?? null,
      active: data.active,
      usage_limit: data.usage_limit ?? null,
    };
    if (data.id) {
      const { error } = await db.from("coupons").update(payload).eq("id", data.id);
      if (error) throw error;
      return { ok: true, id: data.id };
    }
    const { data: created, error } = await db.from("coupons").insert(payload).select("id").single();
    if (error) throw error;
    return { ok: true, id: created.id };
  });

export const adminDeleteCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = context.supabase;
    const { error } = await db.from("coupons").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
