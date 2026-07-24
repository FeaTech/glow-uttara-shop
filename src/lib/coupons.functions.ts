import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type CouponResult =
  | { valid: true; code: string; discount: number; description: string | null }
  | { valid: false; message: string };

/**
 * Core coupon evaluation. Runs on the server with the service-role client so the
 * coupons table stays private (never exposed to the browser). Shared by the
 * `validateCoupon` server fn and by order creation for authoritative re-checking.
 */
export async function evaluateCoupon(code: string, subtotal: number): Promise<CouponResult> {
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
  .inputValidator((input) => validateSchema.parse(input))
  .handler(async ({ data }) => evaluateCoupon(data.code, data.subtotal));
