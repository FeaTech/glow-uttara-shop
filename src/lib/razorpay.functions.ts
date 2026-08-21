import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { RAZORPAY_METHOD_BY_CHANNEL } from "@/lib/pricing";

const orderIdSchema = z.object({ orderId: z.string().uuid() });

const verifySchema = z.object({
  orderId: z.string().uuid(),
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

/** Create a Razorpay order for an existing, unpaid FEA Glam order. */
export const createRazorpayOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => orderIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const keyId = process.env["RAZORPAY_KEY_ID"];
    const keySecret = process.env["RAZORPAY_KEY_SECRET"];
    if (!keyId || !keySecret) throw new Error("Online payments are not configured yet");

    const { supabase, userId } = context;
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, total_inr, total_paise, payment_channel, payment_status, customer_email, razorpay_order_id")
      .eq("id", data.orderId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!order) throw new Error("Order not found");
    if (order.payment_status === "paid") throw new Error("This order is already paid");

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", userId)
      .maybeSingle();

    const amountPaise = order.total_paise ?? order.total_inr * 100;

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt: order.id,
        notes: { order_id: order.id },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("Razorpay order creation failed", response.status, body);
      throw new Error("Could not start the payment. Please try again.");
    }

    const rzpOrder = (await response.json()) as { id: string; amount: number; currency: string };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("orders")
      .update({ razorpay_order_id: rzpOrder.id })
      .eq("id", order.id);

    return {
      keyId,
      razorpayOrderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      orderId: order.id,
      customerName: profile?.full_name ?? "",
      customerEmail: order.customer_email ?? "",
      customerPhone: profile?.phone ?? "",
      method:
        order.payment_channel && order.payment_channel !== "cod"
          ? RAZORPAY_METHOD_BY_CHANNEL[
              order.payment_channel as keyof typeof RAZORPAY_METHOD_BY_CHANNEL
            ] ?? null
          : null,
    };
  });

/** Verify the Razorpay signature and mark the order as paid. */
export const verifyRazorpayPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => verifySchema.parse(input))
  .handler(async ({ data, context }) => {
    const keySecret = process.env["RAZORPAY_KEY_SECRET"];
    if (!keySecret) throw new Error("Online payments are not configured yet");

    const { supabase, userId } = context;
    const { data: order } = await supabase
      .from("orders")
      .select("id, razorpay_order_id, payment_status")
      .eq("id", data.orderId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!order) throw new Error("Order not found");
    if (order.razorpay_order_id !== data.razorpayOrderId) {
      throw new Error("Payment does not match this order");
    }

    const { createHmac, timingSafeEqual } = await import("crypto");
    const expected = createHmac("sha256", keySecret)
      .update(`${data.razorpayOrderId}|${data.razorpayPaymentId}`)
      .digest("hex");
    const received = data.razorpaySignature;
    const valid =
      expected.length === received.length &&
      timingSafeEqual(Buffer.from(expected), Buffer.from(received));
    if (!valid) throw new Error("Payment verification failed");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        payment_status: "paid",
        razorpay_payment_id: data.razorpayPaymentId,
        status: "processing",
      })
      .eq("id", order.id);
    if (updateError) throw updateError;

    return { ok: true };
  });
