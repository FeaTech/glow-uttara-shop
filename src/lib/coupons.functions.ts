import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CouponResult =
  | { valid: true; code: string; discount: number; description: string | null }
  | { valid: false; message: string };

/**
 * Core coupon evaluation. Runs on the server with the service-role client so the
 * coupons table stays private (never exposed to the browser). Shared by the
 * `validateCoupon` server fn and by order creation for authoritative re-checking.
 */
export async function evaluateCoupon(code: string, subtotal: number, customerId: string): Promise<CouponResult> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { valid: false, message: "Enter a coupon code" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: coupon, error } = await supabaseAdmin
    .from("coupons")
    .select("*")
    .eq("code", normalized)
    .maybeSingle();

  if (error) return { valid: false, message: "Could not validate coupon" };
  if (!coupon || !coupon.active) return { valid: false, message: "Invalid coupon code" };

  const now = Date.now();
  if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) {
    return { valid: false, message: "This coupon isn't active yet" };
  }
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < now) {
    return { valid: false, message: "This coupon has expired" };
  }
  if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) {
    return { valid: false, message: "This coupon has reached its usage limit" };
  }
  if (coupon.eligibility !== "everyone") {
    if (coupon.eligibility === "new_customers") {
      const { count } = await supabaseAdmin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("user_id", customerId)
        .neq("status", "cancelled");
      if ((count ?? 0) > 0) return { valid: false, message: "This coupon is only available on your first order" };
    } else {
      return { valid: false, message: "This coupon is not available to your account" };
    }
  }
  const monthStart = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const { data: usage } = await supabaseAdmin
    .from("coupon_customer_usage")
    .select("usage_month, monthly_used_count")
    .eq("coupon_id", coupon.id)
    .eq("customer_id", customerId)
    .maybeSingle();
  const currentMonth = monthStart.toISOString().slice(0, 10);
  const monthlyUsed = usage?.usage_month === currentMonth ? usage.monthly_used_count : 0;
  if (coupon.customer_monthly_limit !== null && monthlyUsed >= coupon.customer_monthly_limit) {
    return { valid: false, message: "You have reached this coupon's monthly limit" };
  }
  if (subtotal < coupon.min_order_inr) {
    return {
      valid: false,
      message: `Add ₹${(coupon.min_order_inr - subtotal).toLocaleString("en-IN")} more to use this coupon`,
    };
  }

  let discount =
    coupon.discount_type === "percent"
      ? Math.floor((subtotal * coupon.discount_value) / 100)
      : coupon.discount_value;

  if (coupon.max_discount_inr !== null) discount = Math.min(discount, coupon.max_discount_inr);
  discount = Math.max(0, Math.min(discount, subtotal));

  return { valid: true, code: coupon.code, discount, description: coupon.description };
}

const validateSchema = z.object({
  code: z.string().trim().min(1).max(40),
  subtotal: z.number().int().min(0),
});

export const validateCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => validateSchema.parse(input))
  .handler(async ({ data, context }) => evaluateCoupon(data.code, data.subtotal, context.userId));

export async function reserveCouponUsage(code: string, customerId: string, orderId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.rpc("reserve_coupon_usage", {
    _code: code,
    _customer_id: customerId,
    _order_id: orderId,
  });
  if (error) throw new Error(error.message);
}

const releaseOrderSchema = z.object({ orderId: z.string().uuid() });

export const releaseOrderCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => releaseOrderSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: order, error: orderError } = await context.supabase
      .from("orders")
      .select("id")
      .eq("id", data.orderId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) throw new Error("Order not found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("release_coupon_usage", { _order_id: data.orderId });
    if (error) throw error;
    return { ok: true };
  });
