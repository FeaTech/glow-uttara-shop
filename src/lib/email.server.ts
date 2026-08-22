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

const inr = (amount: number) => `Rs. ${Number(amount || 0).toLocaleString("en-IN")}`;

const GOLD = "#b08d57";
const INK = "#1c1917";
const MUTED = "#78716c";
const LINE = "#eee7dd";
const CREAM = "#faf7f2";
const LOGO_URL = "https://www.feaglam.com/__l5e/assets-v1/4bf6311a-a521-4f4a-8f49-e63953f0dbc8/feaglam-logo.png";

function button(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto 0;"><tr>
    <td style="background:${GOLD};border-radius:999px;">
      <a href="${href}" style="display:inline-block;padding:13px 34px;color:#ffffff;text-decoration:none;font-size:14px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;">${escapeHtml(label)}</a>
    </td></tr></table>`;
}

function layout(title: string, body: string, preheader?: string) {
  return `<!doctype html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background-color:#f6f2ec;font-family:Georgia,'Times New Roman',serif;color:${INK};">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f2ec;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid ${LINE};border-radius:14px;overflow:hidden;">
        <tr><td style="background:#12100e;padding:26px 24px;text-align:center;">
          <img src="${LOGO_URL}" width="180" alt="FEA Glam" style="display:block;margin:0 auto;max-width:180px;height:auto;border:0;" />
          <div style="font-size:10px;letter-spacing:3px;color:${GOLD};margin-top:10px;font-family:Arial,Helvetica,sans-serif;">KOREAN BEAUTY INSPIRED</div>
        </td></tr>
        <tr><td style="height:3px;background:linear-gradient(90deg,#d9b98a,${GOLD},#8a6b3c);"></td></tr>
        <tr><td style="padding:34px 32px 36px;font-size:15px;line-height:1.65;color:${INK};">${body}</td></tr>
        <tr><td style="background:${CREAM};border-top:1px solid ${LINE};padding:20px 24px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${MUTED};">
          <p style="margin:0 0 8px;">
            <a href="${SITE_URL}/products" style="color:${GOLD};text-decoration:none;margin:0 8px;">Shop</a>
            <a href="${SITE_URL}/orders" style="color:${GOLD};text-decoration:none;margin:0 8px;">My orders</a>
            <a href="${SITE_URL}/contact" style="color:${GOLD};text-decoration:none;margin:0 8px;">Support</a>
          </p>
          <p style="margin:0 0 6px;">Questions? Reply to this email or write to ${CONTACT_INBOX}.</p>
          <p style="margin:0;">&copy; ${new Date().getFullYear()} FEA Glam. 100% authentic beauty, delivered across India.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

const h1 = (text: string) =>
  `<h1 style="font-size:26px;font-weight:normal;margin:0 0 10px;color:${INK};letter-spacing:0.3px;">${text}</h1>`;
const p = (text: string, extra = "") =>
  `<p style="margin:0 0 14px;color:${MUTED};font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7;${extra}">${text}</p>`;

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
  taxesInr: number;
  totalInr: number;
  customerName?: string | null;
  shippingAddress: { line1: string; line2?: string; city: string; state: string; pincode: string; country?: string };
}) {
  const short = args.orderId.slice(0, 8).toUpperCase();

  const rows = args.items
    .map(
      (item) => `<tr>
        <td style="padding:12px 0;border-bottom:1px solid ${LINE};font-family:Arial,Helvetica,sans-serif;font-size:14px;">
          <span style="color:${INK};font-weight:600;">${escapeHtml(item.name)}</span>${
            item.variantName
              ? `<br /><span style="display:inline-block;margin-top:5px;padding:2px 9px;border:1px solid ${LINE};border-radius:999px;color:${MUTED};font-size:12px;">${escapeHtml(item.variantName)}</span>`
              : ""
          }
          <br /><span style="color:${MUTED};font-size:12px;">Qty ${item.quantity} &middot; ${inr(item.priceInr)} each</span>
        </td>
        <td style="padding:12px 0;border-bottom:1px solid ${LINE};text-align:right;white-space:nowrap;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${INK};">${inr(
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
    ${h1(`Thank you${args.customerName ? `, ${escapeHtml(args.customerName)}` : ""}!`)}
    ${p("Your order is confirmed and we've started getting it ready. Here's a summary of your purchase.")}
    <table role="presentation" width="100%" style="background:${CREAM};border-radius:10px;padding:14px 16px;margin:0 0 22px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${MUTED};">
      <tr>
        <td>Order number<br /><strong style="color:${INK};font-size:15px;letter-spacing:1px;">#${escapeHtml(short)}</strong></td>
        <td align="right">Order date<br /><strong style="color:${INK};font-size:15px;">${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</strong></td>
      </tr>
    </table>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:2px;color:${GOLD};text-transform:uppercase;margin:0 0 6px;">Order summary</div>
    <table role="presentation" style="width:100%;border-collapse:collapse;">${rows}</table>
    <table role="presentation" style="width:100%;margin-top:14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;">
      <tr><td style="padding:4px 0;color:${MUTED};">Subtotal</td><td style="text-align:right;color:${INK};">${inr(args.subtotalInr)}</td></tr>
      ${args.discountInr > 0 ? `<tr><td style="padding:4px 0;color:${MUTED};">Discount</td><td style="text-align:right;color:#15803d;">- ${inr(args.discountInr)}</td></tr>` : ""}
      <tr><td style="padding:4px 0;color:${MUTED};">Shipping</td><td style="text-align:right;color:#15803d;">Free</td></tr>
      ${args.taxesInr > 0 ? `<tr><td style="padding:4px 0;color:${MUTED};">Estimated taxes</td><td style="text-align:right;color:${INK};">${inr(args.taxesInr)}</td></tr>` : ""}
      <tr><td style="padding:12px 0 0;border-top:1px solid ${LINE};font-weight:bold;color:${INK};">Total</td><td style="padding:12px 0 0;border-top:1px solid ${LINE};text-align:right;font-weight:bold;font-size:17px;color:${GOLD};">${inr(args.totalInr)}</td></tr>
    </table>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:2px;color:${GOLD};text-transform:uppercase;margin:28px 0 6px;">Shipping address</div>
    ${p(address, "margin-bottom:0;")}
    ${button(`${SITE_URL}/orders/${encodeURIComponent(args.orderId)}`, "View your order")}
    ${p("We'll email you again as soon as your parcel ships.", "text-align:center;margin:18px 0 0;font-size:13px;")}
  `;
  return {
    subject: `Order confirmed — #${short}`,
    html: layout("Order confirmed", body, `Your FEA Glam order #${short} is confirmed. Total ${inr(args.totalInr)}.`),
  };
}

const STATUS_COPY: Record<string, { title: string; message: string; step: number }> = {
  pending: { title: "Order received", message: "We have received your order and will start processing it shortly.", step: 1 },
  processing: { title: "Your order is being packed", message: "Our team is carefully packing your beauty picks with love.", step: 2 },
  shipped: { title: "Your order has shipped", message: "Your parcel is on its way and should reach you soon.", step: 3 },
  delivered: { title: "Order delivered", message: "Your order has been delivered. We hope you love every bit of it!", step: 4 },
  cancelled: { title: "Order cancelled", message: "Your order has been cancelled. Any payment made will be refunded within 5-7 business days.", step: 0 },
};

function progress(step: number) {
  if (step <= 0) return "";
  const steps = ["Placed", "Packed", "Shipped", "Delivered"];
  const cells = steps
    .map((label, index) => {
      const done = index + 1 <= step;
      return `<td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${done ? GOLD : "#c9c2b8"};letter-spacing:1px;">
        <div style="width:12px;height:12px;border-radius:999px;background:${done ? GOLD : "#e7e0d6"};margin:0 auto 6px;"></div>${label}
      </td>`;
    })
    .join("");
  return `<table role="presentation" width="100%" style="margin:22px 0 6px;"><tr>${cells}</tr></table>`;
}

export function orderStatusEmail(args: { orderId: string; status: string }) {
  const copy = STATUS_COPY[args.status] ?? {
    title: "Order update",
    message: `Your order status is now ${args.status}.`,
    step: 0,
  };
  const short = args.orderId.slice(0, 8).toUpperCase();
  const body = `
    ${h1(escapeHtml(copy.title))}
    ${p(escapeHtml(copy.message))}
    <table role="presentation" width="100%" style="background:${CREAM};border-radius:10px;padding:14px 16px;margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${MUTED};">
      <tr>
        <td>Order number<br /><strong style="color:${INK};font-size:15px;letter-spacing:1px;">#${escapeHtml(short)}</strong></td>
        <td align="right">Status<br /><strong style="color:${GOLD};font-size:15px;text-transform:capitalize;">${escapeHtml(args.status)}</strong></td>
      </tr>
    </table>
    ${progress(copy.step)}
    ${button(`${SITE_URL}/orders/${encodeURIComponent(args.orderId)}`, "Track your order")}
  `;
  return { subject: `${copy.title} — #${short}`, html: layout(copy.title, body, `${copy.title}: order #${short}`) };
}

export function welcomeEmail(args: { name?: string | null }) {
  const perks = [
    ["100% authentic", "Every product sourced from authorised channels."],
    ["Curated for India", "Shades and formulas chosen for Indian skin & climate."],
    ["Free shipping", "On all prepaid orders, delivered pan-India."],
  ]
    .map(
      ([title, text]) => `<tr>
        <td style="padding:10px 0;border-bottom:1px solid ${LINE};font-family:Arial,Helvetica,sans-serif;font-size:14px;">
          <strong style="color:${INK};">${title}</strong><br /><span style="color:${MUTED};font-size:13px;">${text}</span>
        </td></tr>`,
    )
    .join("");

  const body = `
    ${h1(`Welcome to FEA Glam${args.name ? `, ${escapeHtml(args.name)}` : ""}`)}
    ${p("Your account is confirmed and ready. Explore curated makeup, skincare, haircare, fragrances and beauty accessories — all handpicked, all authentic.")}
    <table role="presentation" width="100%" style="border-collapse:collapse;">${perks}</table>
    ${button(`${SITE_URL}/products`, "Start shopping")}
  `;
  return {
    subject: "Welcome to FEA Glam — your account is ready",
    html: layout("Welcome to FEA Glam", body, "Your FEA Glam account is confirmed. Start exploring our curated beauty edit."),
  };
}

export function contactFormEmail(args: { name: string; email: string; subject?: string; message: string }) {
  const body = `
    ${h1("New contact form message")}
    <table role="presentation" width="100%" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;margin:0 0 14px;">
      <tr><td style="padding:6px 0;color:${MUTED};width:90px;">Name</td><td style="color:${INK};">${escapeHtml(args.name)}</td></tr>
      <tr><td style="padding:6px 0;color:${MUTED};">Email</td><td><a href="mailto:${escapeHtml(args.email)}" style="color:${GOLD};">${escapeHtml(args.email)}</a></td></tr>
      <tr><td style="padding:6px 0;color:${MUTED};">Subject</td><td style="color:${INK};">${escapeHtml(args.subject || "(none)")}</td></tr>
    </table>
    <div style="white-space:pre-wrap;background:${CREAM};border-left:3px solid ${GOLD};padding:14px 16px;border-radius:6px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${INK};">${escapeHtml(args.message)}</div>
  `;
  return { subject: `Contact form: ${args.subject || args.name}`, html: layout("Contact form", body) };
}

export function contactAckEmail(args: { name: string }) {
  const body = `
    ${h1(`Thanks for reaching out, ${escapeHtml(args.name)}!`)}
    ${p("We've received your message and our customer care team will get back to you within 24 hours.")}
    ${p("In the meantime, feel free to browse our latest arrivals.", "margin-bottom:0;")}
    ${button(`${SITE_URL}/products`, "Browse products")}
  `;
  return { subject: "We've received your message — FEA Glam", html: layout("Message received", body) };
}

// ---------------------------------------------------------------------------
// Auth emails (Supabase Auth "Send Email" hook)
// ---------------------------------------------------------------------------
export type AuthEmailAction =
  | "signup"
  | "magiclink"
  | "recovery"
  | "invite"
  | "email_change"
  | "email_change_current"
  | "email_change_new"
  | "reauthentication";

const AUTH_COPY: Record<string, { subject: string; title: string; intro: string; cta: string }> = {
  signup: {
    subject: "Confirm your email — FEA Glam",
    title: "Confirm your email",
    intro: "Welcome to FEA Glam! Confirm your email address to activate your account and start shopping authentic beauty.",
    cta: "Confirm my email",
  },
  magiclink: {
    subject: "Your FEA Glam sign-in link",
    title: "Sign in to FEA Glam",
    intro: "Use the secure link below to sign in. It expires shortly and can be used only once.",
    cta: "Sign in",
  },
  recovery: {
    subject: "Reset your FEA Glam password",
    title: "Reset your password",
    intro: "We received a request to reset your password. If this wasn't you, you can safely ignore this email.",
    cta: "Set a new password",
  },
  invite: {
    subject: "You're invited to FEA Glam",
    title: "You're invited",
    intro: "You've been invited to join FEA Glam. Accept the invitation to set up your account.",
    cta: "Accept invitation",
  },
  email_change: {
    subject: "Confirm your new email — FEA Glam",
    title: "Confirm your new email",
    intro: "Confirm this address to finish updating the email on your FEA Glam account.",
    cta: "Confirm email change",
  },
  reauthentication: {
    subject: "Your FEA Glam verification code",
    title: "Verify it's you",
    intro: "Enter the verification code below to continue.",
    cta: "",
  },
};

export function authActionEmail(args: { action: string; url: string; token?: string }) {
  const copy = AUTH_COPY[args.action] ?? AUTH_COPY.magiclink;
  const codeBlock = args.token
    ? `<table role="presentation" width="100%" style="border:1px dashed ${GOLD};border-radius:10px;background:${CREAM};margin:6px 0 18px;">
        <tr><td align="center" style="padding:16px;font-family:Arial,Helvetica,sans-serif;">
          <div style="font-size:11px;letter-spacing:2px;color:${MUTED};text-transform:uppercase;">Verification code</div>
          <div style="font-size:26px;letter-spacing:6px;color:${GOLD};font-weight:700;margin-top:8px;">${escapeHtml(args.token)}</div>
        </td></tr></table>`
    : "";

  const body = `
    ${h1(copy.title)}
    ${p(copy.intro)}
    ${codeBlock}
    ${copy.cta && args.url ? button(args.url, copy.cta) : ""}
    ${args.url ? p(`If the button doesn't work, copy and paste this link into your browser:<br /><a href="${args.url}" style="color:${GOLD};word-break:break-all;">${escapeHtml(args.url)}</a>`, "margin-top:22px;font-size:12px;") : ""}
    ${p("This link is valid for a limited time and can be used once. If you didn't request it, no action is needed.", "font-size:12px;margin-bottom:0;")}
  `;
  return { subject: copy.subject, html: layout(copy.title, body, copy.intro) };
}
