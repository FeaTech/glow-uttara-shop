import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Leaf, HeartHandshake, Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/ScrollReveal";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About us — FEALuxe" },
      { name: "description", content: "FEALuxe curates authentic luxury beauty for India — the story behind the brand." },
    ],
  }),
  component: AboutPage,
});

const values = [
  { icon: Sparkles, title: "Curated, not cluttered", text: "Every product earns its place. We test, vet, and hand-pick each edit so you don't have to sift through thousands of SKUs." },
  { icon: Leaf, title: "Conscious beauty", text: "We prioritise cruelty-free and clean formulations, and highlight brands that care about ingredients and the planet." },
  { icon: Globe2, title: "Made for India", text: "Shade ranges, formulations, and climate-smart picks chosen for Indian skin, hair, and weather." },
  { icon: HeartHandshake, title: "People-first service", text: "Fast, honest support and a no-nonsense returns policy. If something's not right, we'll make it right." },
];

const stats = [
  { value: "100%", label: "Authentic brands" },
  { value: "5", label: "Curated categories" },
  { value: "4.9★", label: "Average rating" },
  { value: "Pan-India", label: "Delivery" },
];

function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0">
          <img src="/images/hero-luxe.jpg" alt="" className="h-full w-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/70 to-background" />
        </div>
        <div className="container-luxe relative py-20 text-center md:py-28">
          <div className="rule-gold mx-auto" />
          <h1 className="mt-4 font-serif text-4xl font-light text-foreground md:text-6xl">
            Beauty, <span className="italic text-gradient-gold">thoughtfully curated.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            FEALuxe is a modern beauty destination bringing authentic luxury makeup, skincare, haircare, and
            fragrances to beauty lovers across India.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="container-luxe max-w-3xl py-16 md:py-20">
        <ScrollReveal className="space-y-6 text-lg leading-relaxed text-muted-foreground">
          <p>
            We started FEALuxe with a simple frustration: finding genuinely premium beauty in India often meant
            navigating counterfeits, limited shade ranges, and endless overwhelm. We wanted a place that felt as
            considered as the products themselves.
          </p>
          <p>
            So we built one. A tightly edited catalogue of brands we'd actually recommend to a friend, with honest
            descriptions, real reviews, and prices in rupees — delivered quickly and reliably to your door.
          </p>
          <p className="font-serif text-2xl font-light text-foreground">
            Luxury shouldn't be complicated. It should feel like a treat.
          </p>
        </ScrollReveal>
      </section>

      {/* Stats */}
      <section className="border-y border-border bg-secondary/40 py-12">
        <div className="container-luxe grid grid-cols-2 gap-8 text-center md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="font-serif text-3xl font-light text-primary md:text-4xl">{s.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Values */}
      <section className="container-luxe py-16 md:py-24">
        <ScrollReveal className="text-center">
          <h2 className="font-serif text-3xl font-light text-foreground md:text-4xl">What we stand for</h2>
        </ScrollReveal>
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {values.map(({ icon: Icon, title, text }, i) => (
            <ScrollReveal key={title} delay={i * 80}>
              <div className="card-luxe flex h-full gap-4 p-6">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Icon className="h-6 w-6" /></span>
                <div>
                  <h3 className="font-heading text-lg font-medium text-foreground">{title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-foreground py-16 text-center text-background">
        <div className="container-luxe">
          <h2 className="font-serif text-3xl font-light md:text-4xl">Ready to find your new favourite?</h2>
          <Button asChild size="lg" className="btn-gold mt-8"><Link to="/products">Shop the collection</Link></Button>
        </div>
      </section>
    </div>
  );
}
