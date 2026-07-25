import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Leaf, HeartHandshake, Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/ScrollReveal";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About us — FEA Glam" },
      { name: "description", content: "FEA Glam curates authentic luxury beauty for India — the story behind the brand." },
    ],
  }),
  component: AboutPage,
});

const values = [
  { icon: Sparkles, title: "Quality first", text: "Every FEA GLAM product is developed with attention to safety, performance, and customer satisfaction, ensuring a premium experience with every use." },
  { icon: Leaf, title: "Innovation driven", text: "We continuously explore new ideas, trends, and technologies to bring beauty and personal care solutions that meet the evolving needs of our customers." },
  { icon: Globe2, title: "Made for India", text: "Formulations, shades, and routines designed for Indian skin, hair, and climate — delivered quickly and reliably across the country." },
  { icon: HeartHandshake, title: "People-first service", text: "Fast, honest support and a no-nonsense returns policy. If something's not right, we'll make it right." },
];

const stats = [
  { value: "100%", label: "Quality focused" },
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
            Welcome to <span className="italic text-gradient-gold">FEA GLAM</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            A premium skincare, cosmetics, beauty care, and personal care brand from FEA Ventures (FEA group of companies), created with a vision to bring quality, innovation, and confidence into everyday beauty routines.
          </p>
        </div>
      </section>

      {/* Intro */}
      <section className="container-luxe max-w-3xl py-16 md:py-20">
        <ScrollReveal className="space-y-6 text-lg leading-relaxed text-muted-foreground">
          <p>
            At FEA GLAM, we believe that beauty is not just about appearance — it is about self-confidence, self-care, and expressing your unique personality. Our mission is to provide thoughtfully designed beauty and personal care products that combine modern trends, effective formulations, and accessible luxury for everyone.
          </p>
          <p className="font-serif text-2xl font-light text-foreground">
            FEA GLAM — Beauty, Care & Confidence.
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
          <h2 className="font-serif text-3xl font-light text-foreground md:text-4xl">Our Vision</h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Our vision is to become a trusted beauty and personal care brand that empowers individuals to look and feel their best. We aim to build a strong connection with our customers by delivering products that inspire confidence, comfort, and everyday wellness.
          </p>
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

      {/* Products & Commitment */}
      <section className="container-luxe max-w-3xl py-16 md:py-20">
        <ScrollReveal className="space-y-10">
          <div>
            <h2 className="font-serif text-3xl font-light text-foreground md:text-4xl">Our Products</h2>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              FEA GLAM offers a diverse range of beauty and personal care solutions, including skincare essentials, cosmetics, beauty products, and lifestyle care items. Each product is developed with attention to quality, safety, and customer satisfaction, ensuring a premium experience for every user.
            </p>
          </div>
          <div>
            <h2 className="font-serif text-3xl font-light text-foreground md:text-4xl">Our Commitment</h2>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              We are committed to maintaining high standards of quality, innovation, and service. From product selection to customer experience, every step reflects our dedication to excellence. We continuously explore new ideas, trends, and technologies to bring products that meet the evolving needs of our customers.
            </p>
          </div>
        </ScrollReveal>
      </section>

      {/* Why choose us */}
      <section className="border-y border-border bg-secondary/40 py-16 md:py-20">
        <div className="container-luxe max-w-3xl">
          <ScrollReveal className="text-center">
            <h2 className="font-serif text-3xl font-light text-foreground md:text-4xl">Why Choose FEA GLAM?</h2>
          </ScrollReveal>
          <ScrollReveal className="mt-8">
            <ul className="grid gap-4 sm:grid-cols-2">
              <li className="flex items-start gap-3 text-muted-foreground"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" /> Quality-focused beauty and personal care products</li>
              <li className="flex items-start gap-3 text-muted-foreground"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" /> Trend-inspired and innovative solutions</li>
              <li className="flex items-start gap-3 text-muted-foreground"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" /> Affordable luxury for everyday beauty needs</li>
              <li className="flex items-start gap-3 text-muted-foreground"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" /> Customer satisfaction as our priority</li>
              <li className="flex items-start gap-3 text-muted-foreground"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" /> A trusted brand under FEA Venture Group</li>
            </ul>
          </ScrollReveal>
        </div>
      </section>

      {/* Promise */}
      <section className="container-luxe max-w-3xl py-16 text-center md:py-24">
        <ScrollReveal>
          <h2 className="font-serif text-3xl font-light text-foreground md:text-4xl">Our Promise</h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            At FEA GLAM, our promise is to create products that celebrate individuality and encourage everyone to embrace their natural beauty. We strive to make beauty care simple, enjoyable, and accessible while building a brand that customers can trust and love.
          </p>
        </ScrollReveal>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-foreground py-16 text-center text-background">
        <div className="container-luxe">
          <h2 className="font-serif text-3xl font-light md:text-4xl">Ready to experience FEA GLAM?</h2>
          <Button asChild size="lg" className="btn-gold mt-8"><Link to="/products">Shop the collection</Link></Button>
        </div>
      </section>
    </div>
  );
}
