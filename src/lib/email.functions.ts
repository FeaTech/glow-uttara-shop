import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const contactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(160),
  subject: z.string().trim().max(150).optional(),
  message: z.string().trim().min(5).max(4000),
});

/** Public contact form: emails the store inbox and acknowledges the sender. */
export const submitContactForm = createServerFn({ method: "POST" })
  .inputValidator((input) => contactSchema.parse(input))
  .handler(async ({ data }) => {
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
    const email = (context.claims as { email?: string }).email;
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
