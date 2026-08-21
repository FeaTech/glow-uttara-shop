import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

type RazorpayEvent = {
  event: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        notes?: Record<string, string>;
      };
    };
  };
};

export const Route = createFileRoute("/api/public/razorpay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["RAZORPAY_WEBHOOK_SECRET"];
        if (!secret) {
          console.error("RAZORPAY_WEBHOOK_SECRET is not configured");
          return new Response("Not configured", { status: 500 });
        }

        const raw = await request.text();
        const signature = request.headers.get("x-razorpay-signature") ?? "";
        const expected = createHmac("sha256", secret).update(raw).digest("hex");
        const valid =
          signature.length === expected.length &&
          timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
        if (!valid) return new Response("Invalid signature", { status: 401 });

        let event: RazorpayEvent;
        try {
          event = JSON.parse(raw) as RazorpayEvent;
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        const entity = event.payload?.payment?.entity;
        const razorpayOrderId = entity?.order_id;
        const paymentId = entity?.id;
        const noteOrderId = entity?.notes?.["order_id"];

        if (!razorpayOrderId && !noteOrderId) {
          return new Response("ok");
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const lookup = supabaseAdmin.from("orders").select("id, payment_status");
        const { data: order } = razorpayOrderId
          ? await lookup.eq("razorpay_order_id", razorpayOrderId).maybeSingle()
          : await lookup.eq("id", noteOrderId!).maybeSingle();

        if (!order) return new Response("ok");

        if (event.event === "payment.captured" || event.event === "order.paid") {
          if (order.payment_status !== "paid") {
            await supabaseAdmin
              .from("orders")
              .update({
                payment_status: "paid",
                razorpay_payment_id: paymentId ?? null,
                status: "processing",
              })
              .eq("id", order.id);
          }
        } else if (event.event === "payment.failed") {
          if (order.payment_status !== "paid") {
            await supabaseAdmin
              .from("orders")
              .update({ payment_status: "failed" })
              .eq("id", order.id);
          }
        }

        return new Response("ok");
      },
    },
  },
});
