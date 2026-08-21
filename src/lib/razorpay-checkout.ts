/** Browser-side helpers for opening the Razorpay Checkout modal. */

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

export function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if ((window as any).Razorpay) return Promise.resolve(true);

  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export type RazorpaySessionInput = {
  keyId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  /** Restrict the Razorpay modal to the method the customer picked. */
  method?: "upi" | "card" | "netbanking" | "wallet" | null;
};

export type RazorpaySuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

/** Opens Razorpay Checkout and resolves with the payment payload, or null if dismissed. */
export function openRazorpayCheckout(session: RazorpaySessionInput): Promise<RazorpaySuccess | null> {
  return new Promise((resolve, reject) => {
    const Razorpay = (window as any).Razorpay;
    if (!Razorpay) {
      reject(new Error("Payment gateway failed to load"));
      return;
    }

    let settled = false;
    const rzp = new Razorpay({
      key: session.keyId,
      order_id: session.razorpayOrderId,
      amount: session.amount,
      currency: session.currency,
      name: "FEA Glam",
      description: "Order payment",
      prefill: {
        name: session.customerName,
        email: session.customerEmail,
        contact: session.customerPhone,
      },
      theme: { color: "#b08d57" },
      ...(session.method
        ? {
            config: {
              display: {
                blocks: {},
                sequence: [`block.${session.method}`],
                preferences: { show_default_blocks: false },
              },
            },
            method: { [session.method]: true },
          }
        : {}),
      handler: (response: RazorpaySuccess) => {
        settled = true;
        resolve(response);
      },
      modal: {
        ondismiss: () => {
          if (!settled) resolve(null);
        },
      },
    });

    rzp.on("payment.failed", (response: { error?: { description?: string } }) => {
      settled = true;
      reject(new Error(response?.error?.description ?? "Payment failed"));
    });

    rzp.open();
  });
}
