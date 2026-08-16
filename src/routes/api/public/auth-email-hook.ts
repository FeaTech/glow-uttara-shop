import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Supabase Auth "Send Email" hook.
 * Configure in Supabase → Authentication → Hooks with this URL and the
 * AUTH_HOOK_SECRET value (v1,whsec_...) stored as a project secret.
 */
function verify(secretRaw: string, headers: Headers, body: string) {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatureHeader = headers.get("webhook-signature");
  if (!id || !timestamp || !signatureHeader) return false;

  // Reject replays older than 5 minutes.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const base64Secret = secretRaw.replace(/^v1,?/, "").replace(/^whsec_/, "");
  const key = Buffer.from(base64Secret, "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");

  return signatureHeader.split(" ").some((part) => {
    const value = part.includes(",") ? part.split(",")[1] : part;
    const a = Buffer.from(value);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

export const Route = createFileRoute("/api/public/auth-email-hook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["AUTH_HOOK_SECRET"];
        if (!secret) return new Response("Not configured", { status: 500 });

        const body = await request.text();
        if (!verify(secret, request.headers, body)) {
          return new Response("Invalid signature", { status: 401 });
        }

        const payload = JSON.parse(body) as {
          user?: { email?: string };
          email_data?: {
            token?: string;
            token_hash?: string;
            redirect_to?: string;
            email_action_type?: string;
            site_url?: string;
          };
        };

        const to = payload.user?.email;
        const data = payload.email_data ?? {};
        if (!to) return new Response("Missing recipient", { status: 400 });

        const siteUrl = data.site_url || "https://feaglam.com";
        const action = data.email_action_type || "magiclink";
        const url =
          data.token_hash
            ? `${siteUrl}/auth/v1/verify?token=${encodeURIComponent(data.token_hash)}&type=${encodeURIComponent(action)}&redirect_to=${encodeURIComponent(data.redirect_to || siteUrl)}`
            : "";

        const { sendEmailSafe, authActionEmail } = await import("@/lib/email.server");
        const mail = authActionEmail({ action, url, token: action === "reauthentication" ? data.token : undefined });
        await sendEmailSafe({ to, subject: mail.subject, html: mail.html });

        return new Response(JSON.stringify({}), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
