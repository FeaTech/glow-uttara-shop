import { createFileRoute } from "@tanstack/react-router";
import { Truck, RefreshCw, PackageCheck, MapPin } from "lucide-react";
import { ScrollReveal } from "@/components/ScrollReveal";

export const Route = createFileRoute("/shipping")({
  head: () => ({
    meta: [
      { title: "Shipping & Returns — FEALuxy" },
      { name: "description", content: "FEALuxy shipping timelines, charges, and our 7-day returns policy." },
    ],
  }),
  component: ShippingPage,
});

const highlights = [
  { icon: Truck, title: "Free shipping over ₹999", text: "Orders above ₹999 ship free across India. Below that, a flat ₹49 applies." },
  { icon: MapPin, title: "Pan-India delivery", text: "We deliver to most pincodes. Metro cities in 2–4 days, elsewhere 4–7 days." },
  { icon: PackageCheck, title: "Tracked & insured", text: "Every parcel is tracked end-to-end and insured against loss in transit." },
  { icon: RefreshCw, title: "7-day returns", text: "Unopened items can be returned within 7 days for a full refund." },
];

function ShippingPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-gradient-to-b from-secondary/50 to-background">
        <div className="container-luxe py-16 text-center">
          <div className="rule-gold mx-auto" />
          <h1 className="mt-4 font-serif text-4xl font-light text-foreground md:text-5xl">Shipping &amp; Returns</h1>
          <p className="mt-3 text-muted-foreground">Fast, tracked delivery and a hassle-free returns promise.</p>
        </div>
      </div>

      <div className="container-luxe max-w-4xl py-14">
        <div className="grid gap-4 sm:grid-cols-2">
          {highlights.map(({ icon: Icon, title, text }, i) => (
            <ScrollReveal key={title} delay={i * 70}>
              <div className="card-luxe flex h-full gap-4 p-6">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
                <div>
                  <p className="font-medium text-foreground">{title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <div className="prose-luxe mt-12 space-y-8">
          <section>
            <h2 className="font-serif text-2xl font-light text-foreground">Delivery timelines</h2>
            <p className="mt-3 text-muted-foreground">
              Orders are processed within 24 hours on business days. Once dispatched, you'll receive a tracking link by email and can follow progress on your <span className="text-foreground">My Orders</span> page. Delivery estimates are indicative and may vary during sale periods or due to courier delays.
            </p>
          </section>
          <section>
            <h2 className="font-serif text-2xl font-light text-foreground">Returns &amp; refunds</h2>
            <p className="mt-3 text-muted-foreground">
              We accept returns of unopened products within 7 days of delivery. For hygiene and safety, opened cosmetics, skincare, and fragrances are not eligible unless they arrived damaged or defective. To start a return, contact our support team with your order number. Approved refunds are credited to the original payment method within 5–7 business days.
            </p>
          </section>
          <section>
            <h2 className="font-serif text-2xl font-light text-foreground">Damaged or wrong items</h2>
            <p className="mt-3 text-muted-foreground">
              If your order arrives damaged or you received the wrong item, please reach out within 48 hours of delivery with photos, and we'll arrange a free replacement or refund right away.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
