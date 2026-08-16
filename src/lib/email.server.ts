/**
 * Email sending via Resend (through the Lovable connector gateway).
 * Server-only — never import this from client code.
 */

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

export const FROM_ADDRESS = "FEA Glam <orders@feaglam.com>";
export const CONTACT_INBOX = "care@feaglam.com";

const SITE_URL = "https://feaglam.com";

type SendArgs = {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
};

export async function sendEmail({ to, subject, html, replyTo }: SendArgs) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const resendKey = process.env["RESEND_API_KEY"];
  if (!lovableKey || !resendKey) {
    console.error("[email] Missing LOVABLE_API_KEY or RESEND_API_KEY — skipping send");
    return { sent: false as const, reason: "not_configured" as const };
  }

  const response = await fetch(`${GATEWAY_URL}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": resendKey,
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[email] Resend request failed [${response.status}]: ${errorBody}`);
    throw new Error(`Email request failed [${response.status}]: ${errorBody}`);
  }

  return { sent: true as const };
}

/** Fire-and-forget: an email failure must never break the user's action. */
export async function sendEmailSafe(args: SendArgs) {
  try {
    return await sendEmail(args);
  } catch (error) {
    console.error("[email] send failed", error);
    return { sent: false as const, reason: "error" as const };
  }
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const inr = (paiseFreeAmount: number) => `Rs. ${paiseFreeAmount.toLocaleString("en-IN")}`;

function layout(title: string, body: string) {
  return `<!doctype html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#1c1917;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;padding-bottom:20px;border-bottom:1px solid #eee7dd;">
      <div style="font-size:26px;letter-spacing:4px;color:#b08d57;font-weight:600;">FEA GLAM</div>
      <div style="font-size:11px;letter-spacing:2px;color:#a8a29e;margin-top:6px;">BE YOUR OWN KIND OF BEAUTIFUL</div>
    </div>
    <div style="padding:28px 4px;font-size:15px;line-height:1.6;">${body}</div>
    <div style="border-top:1px solid #eee7dd;padding-top:16px;font-size:12px;color:#a8a29e;text-align:center;">
      <p style="margin:0 0 6px;">Questions? Reply to this email or write to ${CONTACT_INBOX}.</p>
      <p style="margin:0;">&copy; ${new Date().getFullYear()} FEA Glam. All rights reserved.</p>
    </div>
  </div>
</body></html>`;
}

export type OrderEmailItem = {
  name: string;
  variantName?: string | null;
  quantity: number;
  priceInr: number;
};

export function orderConfirmationEmail(args: {
  orderId: string;
  items: OrderEmailItem[];
  subtotalInr: number;
  discountInr: number;
  totalInr: number;
  customerName?: string | null;
  shippingAddress: { line1: string; line2?: string; city: string; state: string; pincode: string; country?: string };
}) {
  const rows = args.items
    .map(
      (item) => `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #f2ece4;">
          <strong>${escapeHtml(item.name)}</strong>${
            item.variantName ? `<br /><span style="color:#78716c;font-size:13px;">${escapeHtml(item.variantName)}</span>` : ""
          }
          <br /><span style="color:#78716c;font-size:13px;">Qty ${item.quantity}</span>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #f2ece4;text-align:right;white-space:nowrap;">${inr(
          item.priceInr * item.quantity,
        )}</td>
      </tr>`,
    )
    .join("");

  const a = args.shippingAddress;
  const address = [a.line1, a.line2, `${a.city}, ${a.state} ${a.pincode}`, a.country ?? "India"]
    .filter(Boolean)
    .map((line) => escapeHtml(String(line)))
    .join("<br />");

  const body = `
    <h1 style="font-size:22px;font-weight:normal;margin:0 0 8px;">Thank you${
      args.customerName ? `, ${escapeHtml(args.customerName)}` : ""
    }!</h1>
    <p style="margin:0 0 20px;color:#57534e;">Your order has been placed successfully. Order ID <strong>#${escapeHtml(
      args.orderId.slice(0, 8).toUpperCase(),
    )}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;">${rows}</table>
    <table style="width:100%;margin-top:14px;font-size:14px;">
      <tr><td style="padding:3px 0;color:#57534e;">Subtotal</td><td style="text-align:right;">${inr(args.subtotalInr)}</td></tr>
      ${args.discountInr > 0 ? `<tr><td style="padding:3px 0;color:#57534e;">Discount</td><td style="text-align:right;">- ${inr(args.discountInr)}</td></tr>` : ""}
      <tr><td style="padding:8px 0;font-weight:bold;">Total</td><td style="text-align:right;font-weight:bold;">${inr(args.totalInr)}</td></tr>
    </table>
    <p style="margin:24px 0 6px;font-weight:bold;">Shipping to</p>
    <p style="margin:0;color:#57534e;">${address}</p>
    <p style="margin:28px 0 0;"><a href="${SITE_URL}/orders/${encodeURIComponent(args.orderId)}" style="background:#b08d57;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;display:inline-block;">View your order</a></p>
  `;
  return { subject: `Order confirmed — #${args.orderId.slice(0, 8).toUpperCase()}`, html: layout("Order confirmed", body) };
}

const STATUS_COPY: Record<string, { title: string; message: string }> = {
  pending: { title: "Order received", message: "We have received your order and will start processing it shortly." },
  processing: { title: "Order is being packed", message: "Our team is carefully packing your beauty picks." },
  shipped: { title: "Your order has shipped", message: "Your parcel is on its way. It should reach you soon." },
  delivered: { title: "Order delivered", message: "Your order has been delivered. We hope you love it!" },
  cancelled: { title: "Order cancelled", message: "Your order has been cancelled. Any payment made will be refunded." },
};

export function orderStatusEmail(args: { orderId: string; status: string }) {
  const copy = STATUS_COPY[args.status] ?? {
    title: "Order update",
    message: `Your order status is now ${args.status}.`,
  };
  const short = args.orderId.slice(0, 8).toUpperCase();
  const body = `
    <h1 style="font-size:22px;font-weight:normal;margin:0 0 8px;">${escapeHtml(copy.title)}</h1>
    <p style="margin:0 0 8px;color:#57534e;">${escapeHtml(copy.message)}</p>
    <p style="margin:0 0 20px;color:#57534e;">Order <strong>#${escapeHtml(short)}</strong></p>
    <p style="margin:24px 0 0;"><a href="${SITE_URL}/orders/${encodeURIComponent(args.orderId)}" style="background:#b08d57;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;display:inline-block;">Track your order</a></p>
  `;
  return { subject: `${copy.title} — #${short}`, html: layout(copy.title, body) };
}

export function welcomeEmail(args: { name?: string | null }) {
  const body = `
    <h1 style="font-size:22px;font-weight:normal;margin:0 0 8px;">Welcome${
      args.name ? `, ${escapeHtml(args.name)}` : ""
    }!</h1>
    <p style="margin:0 0 12px;color:#57534e;">Your FEA Glam account is ready. Explore curated makeup, skincare, haircare, and fragrances — all 100% authentic, delivered across India.</p>
    <p style="margin:0 0 20px;color:#57534e;">Use code <strong style="color:#b08d57;">WELCOME10</strong> on your first order.</p>
    <p style="margin:24px 0 0;"><a href="${SITE_URL}/products" style="background:#b08d57;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;display:inline-block;">Start shopping</a></p>
  `;
  return { subject: "Welcome to FEA Glam", html: layout("Welcome to FEA Glam", body) };
}

export function contactFormEmail(args: { name: string; email: string; subject?: string; message: string }) {
  const body = `
    <h1 style="font-size:20px;font-weight:normal;margin:0 0 12px;">New contact form message</h1>
    <p style="margin:0 0 4px;"><strong>Name:</strong> ${escapeHtml(args.name)}</p>
    <p style="margin:0 0 4px;"><strong>Email:</strong> ${escapeHtml(args.email)}</p>
    <p style="margin:0 0 12px;"><strong>Subject:</strong> ${escapeHtml(args.subject || "(none)")}</p>
    <div style="white-space:pre-wrap;background:#faf7f2;padding:14px;border-radius:6px;">${escapeHtml(args.message)}</div>
  `;
  return { subject: `Contact form: ${args.subject || args.name}`, html: layout("Contact form", body) };
}

export function contactAckEmail(args: { name: string }) {
  const body = `
    <h1 style="font-size:22px;font-weight:normal;margin:0 0 8px;">Thanks for reaching out, ${escapeHtml(args.name)}!</h1>
    <p style="margin:0;color:#57534e;">We've received your message and our customer care team will get back to you within 24 hours.</p>
  `;
  return { subject: "We've received your message — FEA Glam", html: layout("Message received", body) };
}
