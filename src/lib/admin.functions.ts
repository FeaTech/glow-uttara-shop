import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type GlamSupabase = SupabaseClient<Database>;
type AdminInventoryItem = {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  images: Database["public"]["Tables"]["products"]["Row"]["images"];
  categoryName: string | null;
  kind: "product" | "variant";
  variantName: string | null;
  sku: string | null;
  stock: number;
};

/** Throw unless the caller holds the 'admin' role (checked with their own RLS client). */
async function assertAdmin(supabase: GlamSupabase, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin access required");
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
    // Aggregated entirely in Postgres (admin_dashboard_stats) — previously this
    // transferred every order and the whole catalog to aggregate in JS.
    // The RPC enforces the admin check itself, so no extra assertAdmin round trip.
    const { data, error } = await context.supabase.rpc("admin_dashboard_stats");
    if (error) throw error;

    const stats = (data ?? {}) as {
      revenue?: number;
      orderCount?: number;
      pendingCount?: number;
      productCount?: number;
      customerCount?: number;
      revenueByDay?: { date: string; revenue: number; orders: number }[];
      lowStock?: { id: string; name: string; slug: string; stock: number }[];
    };

    return {
      revenue: Number(stats.revenue ?? 0),
      orderCount: Number(stats.orderCount ?? 0),
      pendingCount: Number(stats.pendingCount ?? 0),
      productCount: Number(stats.productCount ?? 0),
      customerCount: Number(stats.customerCount ?? 0),
      revenueByDay: stats.revenueByDay ?? [],
      lowStock: stats.lowStock ?? [],
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
      .select("*, categories(name, slug), product_variants(stock)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((product) => {
      const variants = product.product_variants ?? [];
      const variantCount = variants.length;
      return {
        ...product,
        inventoryStock: product.stock,
        variantCount,
        variantsInStock: variants.filter((variant) => variant.stock > 0).length,
        variantsSoldOut: variants.filter((variant) => variant.stock === 0).length,
      };
    });
  });

export const adminListInventory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = context.supabase;
    const { data, error } = await db
      .from("products")
      .select("id, name, slug, images, stock, categories(name), product_variants(id, variant_name, sku, stock)")
      .order("name", { ascending: true });
    if (error) throw error;

    const inventory: AdminInventoryItem[] = [];
    for (const product of data ?? []) {
      const common = {
        productId: product.id,
        productName: product.name,
        productSlug: product.slug,
        images: product.images,
        categoryName: product.categories?.name ?? null,
      };
      const variants = [...(product.product_variants ?? [])].sort((a, b) =>
        a.variant_name.localeCompare(b.variant_name),
      );

      if (variants.length) {
        inventory.push(...variants.map((variant) => ({
          ...common,
          id: variant.id,
          kind: "variant" as const,
          variantName: variant.variant_name,
          sku: variant.sku,
          stock: variant.stock,
        })));
      } else {
        inventory.push({
          ...common,
          id: product.id,
          kind: "product",
          variantName: null,
          sku: null,
          stock: product.stock,
        });
      }
    }
    return inventory;
  });

const productInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  slug: z.string().max(200).optional(),
  short_description: z.string().max(300).optional().nullable(),
  description: z.string().max(4000).optional().nullable(),
  price_inr: z.number().int().min(0),
  compare_price_inr: z.number().int().min(0).nullable().optional(),
  base_unit: z.string().max(40).nullable().optional(),
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
      base_unit: data.base_unit?.trim() || null,
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

const inventoryStockSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  kind: z.enum(["product", "variant"]),
  stock: z.number().int().min(0),
});

export const adminUpdateInventoryStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inventoryStockSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = context.supabase;

    if (data.kind === "product") {
      if (data.id !== data.productId) throw new Error("Invalid product inventory item");
      const { count, error: countError } = await db
        .from("product_variants")
        .select("id", { count: "exact", head: true })
        .eq("product_id", data.productId);
      if (countError) throw countError;
      if ((count ?? 0) > 0) throw new Error("Variant products must be updated by variant");

      const { data: updated, error } = await db
        .from("products")
        .update({ stock: data.stock })
        .eq("id", data.id)
        .select("id")
        .single();
      if (error) throw error;
      return { ok: true, id: updated.id };
    }

    const { data: updated, error } = await db
      .from("product_variants")
      .update({ stock: data.stock })
      .eq("id", data.id)
      .eq("product_id", data.productId)
      .select("id")
      .single();
    if (error) throw error;

    // Keep the legacy product stock mirror aligned for older storefront builds.
    const { data: variants, error: variantsError } = await db
      .from("product_variants")
      .select("stock")
      .eq("product_id", data.productId);
    if (variantsError) throw variantsError;
    const productStock = (variants ?? []).reduce((total, variant) => total + variant.stock, 0);
    const { error: productError } = await db
      .from("products")
      .update({ stock: productStock })
      .eq("id", data.productId);
    if (productError) throw productError;

    return { ok: true, id: updated.id };
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
  compare_price_inr: z.number().int().min(0).nullable().optional(),
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
      compare_price_inr: data.compare_price_inr ?? null,
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
const listOrdersSchema = z.object({
  page: z.number().int().min(0).default(0),
  pageSize: z.number().int().min(1).max(100).default(25),
  status: z.enum(["pending", "processing", "shipped", "delivered", "cancelled"]).optional(),
});

export const adminListOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => listOrdersSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = context.supabase;

    // Paginated — this previously fetched every order with every line item on
    // each load, which grows without bound as the store takes orders.
    const from = data.page * data.pageSize;
    let query = db
      .from("orders")
      .select("*, order_items(*)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, from + data.pageSize - 1);
    if (data.status) query = query.eq("status", data.status);

    const { data: orders, error, count } = await query;
    if (error) throw error;
    if (!orders?.length) return { orders: [], total: count ?? 0, page: data.page, pageSize: data.pageSize };

    // No direct FK between orders and profiles (both reference auth.users),
    // so fetch the customer profiles separately and merge them in.
    const userIds = [...new Set(orders.map((o) => o.user_id))];
    const { data: profiles } = await db
      .from("profiles")
      .select("id, full_name, phone")
      .in("id", userIds);
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

    return {
      orders: orders.map((o) => ({ ...o, profiles: byId.get(o.user_id) ?? null })),
      total: count ?? orders.length,
      page: data.page,
      pageSize: data.pageSize,
    };
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

    // Notify the customer when the fulfilment status changes.
    if (data.status) {
      const { data: order } = await db
        .from("orders")
        .select("customer_email, user_id")
        .eq("id", data.orderId)
        .maybeSingle();

      // Older orders were stored without a customer_email — fall back to the
      // registered account address so status updates still reach the customer.
      let recipient = order?.customer_email ?? null;
      if (!recipient && order?.user_id) {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(order.user_id);
          recipient = authUser?.user?.email ?? null;
          if (recipient) {
            await supabaseAdmin.from("orders").update({ customer_email: recipient }).eq("id", data.orderId);
          }
        } catch (err) {
          console.error("[email] could not resolve customer email", err);
        }
      }

      if (recipient) {
        const { sendEmailSafe, orderStatusEmail } = await import("@/lib/email.server");
        const mail = orderStatusEmail({ orderId: data.orderId, status: data.status });
        await sendEmailSafe({ to: recipient, subject: mail.subject, html: mail.html });
      }
    }
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
