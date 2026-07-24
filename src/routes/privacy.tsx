import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — FEALuxy" },
      { name: "description", content: "How FEALuxy collects, uses, and protects your personal information." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-gradient-to-b from-secondary/50 to-background">
        <div className="container-luxe py-14">
          <div className="rule-gold" />
          <h1 className="mt-4 font-serif text-4xl font-light text-foreground md:text-5xl">Privacy Policy</h1>
          <p className="mt-2 text-muted-foreground">Last updated: July 2026</p>
        </div>
      </div>
      <div className="container-luxe max-w-3xl space-y-8 py-14 text-muted-foreground">
        <section>
          <h2 className="font-serif text-2xl font-light text-foreground">Information we collect</h2>
          <p className="mt-3">
            We collect information you provide when you create an account, place an order, or contact us — such as your
            name, email, phone number, and shipping addresses. We also collect order history and, with your consent,
            newsletter preferences.
          </p>
        </section>
        <section>
          <h2 className="font-serif text-2xl font-light text-foreground">How we use it</h2>
          <p className="mt-3">
            Your information is used to process and deliver orders, provide customer support, personalise your
            experience, and — where you've opted in — send you offers and updates. We never sell your personal data.
          </p>
        </section>
        <section>
          <h2 className="font-serif text-2xl font-light text-foreground">Data security</h2>
          <p className="mt-3">
            Your data is stored securely with row-level access controls, and payment details are never stored on our
            servers. Access is restricted to authorised personnel only.
          </p>
        </section>
        <section>
          <h2 className="font-serif text-2xl font-light text-foreground">Your rights</h2>
          <p className="mt-3">
            You may access, correct, or delete your personal information at any time from your profile, or by
            contacting us. To unsubscribe from marketing emails, use the link in any email or update your preferences.
          </p>
        </section>
        <section>
          <h2 className="font-serif text-2xl font-light text-foreground">Contact</h2>
          <p className="mt-3">Questions about this policy? Email us at care@fealuxy.example.</p>
        </section>
      </div>
    </div>
  );
}
