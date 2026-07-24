import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — FEALuxy" },
      { name: "description", content: "The terms and conditions for shopping at FEALuxy." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-gradient-to-b from-secondary/50 to-background">
        <div className="container-luxe py-14">
          <div className="rule-gold" />
          <h1 className="mt-4 font-serif text-4xl font-light text-foreground md:text-5xl">Terms of Service</h1>
          <p className="mt-2 text-muted-foreground">Last updated: July 2026</p>
        </div>
      </div>
      <div className="container-luxe max-w-3xl space-y-8 py-14 text-muted-foreground">
        <section>
          <h2 className="font-serif text-2xl font-light text-foreground">Acceptance of terms</h2>
          <p className="mt-3">
            By accessing and shopping at FEALuxy, you agree to these terms. If you do not agree, please do not use the
            service.
          </p>
        </section>
        <section>
          <h2 className="font-serif text-2xl font-light text-foreground">Orders &amp; pricing</h2>
          <p className="mt-3">
            All prices are listed in Indian Rupees (₹) and include applicable taxes unless stated otherwise. We reserve
            the right to refuse or cancel any order in cases of pricing errors, suspected fraud, or stock unavailability.
          </p>
        </section>
        <section>
          <h2 className="font-serif text-2xl font-light text-foreground">Products &amp; authenticity</h2>
          <p className="mt-3">
            We take care to display products accurately. All items are sourced from authorised brands and distributors.
            Colours may vary slightly depending on your screen.
          </p>
        </section>
        <section>
          <h2 className="font-serif text-2xl font-light text-foreground">Returns</h2>
          <p className="mt-3">
            Returns are governed by our Shipping &amp; Returns policy. Unopened items may be returned within 7 days of
            delivery; opened cosmetics are non-returnable for hygiene reasons unless defective.
          </p>
        </section>
        <section>
          <h2 className="font-serif text-2xl font-light text-foreground">Limitation of liability</h2>
          <p className="mt-3">
            FEALuxy is not liable for any indirect or consequential damages arising from the use of our products or
            website, to the extent permitted by law.
          </p>
        </section>
        <section>
          <h2 className="font-serif text-2xl font-light text-foreground">Contact</h2>
          <p className="mt-3">Questions about these terms? Email us at care@fealuxy.example.</p>
        </section>
      </div>
    </div>
  );
}
