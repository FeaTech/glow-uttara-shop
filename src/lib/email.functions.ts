import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function getPublicClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(url, key, {
    global: { fetch: createSupabaseFetch(key) },
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
}

const contactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(160),
  subject: z.string().trim().max(150).optional(),
  message: z.string().trim().min(5).max(4000),
});

/** Public contact form: stores the message, emails the store inbox, and acknowledges the sender. */
export const submitContactForm = createServerFn({ method: "POST" })
  .inputValidator((input) => contactSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = getPublicClient();
    const { error: dbError } = await supabase.from("contact_messages" as any).insert({
      name: data.name,
      email: data.email,
      subject: data.subject ?? null,
      message: data.message,
    });
    if (dbError) {
      console.error("[contact] failed to save message:", dbError);
    }

    const { sendEmailSafe, contactFormEmail, contactAckEmail, CONTACT_INBOX } = await import("@/lib/email.server");

    const toTeam = contactFormEmail(data);
    await sendEmailSafe({ to: CONTACT_INBOX, subject: toTeam.subject, html: toTeam.html, replyTo: data.email });

    const ack = contactAckEmail({ name: data.name });
    await sendEmailSafe({ to: data.email, subject: ack.subject, html: ack.html });

    return { ok: true };
  });

/** Welcome email for the signed-in user — recipient always comes from the verified token. */
export const sendWelcomeEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    let email = (context.claims as { email?: string }).email ?? null;
    if (!email) {
      const { data: authUser } = await context.supabase.auth.getUser();
      email = authUser?.user?.email ?? null;
    }
    if (!email) return { ok: false };

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();

    const { sendEmailSafe, welcomeEmail } = await import("@/lib/email.server");
    const mail = welcomeEmail({ name: profile?.full_name ?? null });
    await sendEmailSafe({ to: email, subject: mail.subject, html: mail.html });
    return { ok: true };
  });
