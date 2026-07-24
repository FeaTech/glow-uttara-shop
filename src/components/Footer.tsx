import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Instagram, Facebook, Twitter, Truck, ShieldCheck, RefreshCw, Sparkles, Check } from "lucide-react";
import { subscribeNewsletter } from "@/lib/newsletter.functions";
import { toast } from "sonner";

const trust = [
  { icon: Truck, title: "Pan-India shipping", sub: "Fast, tracked delivery" },
  { icon: ShieldCheck, title: "100% authentic", sub: "Genuine luxury brands" },
  { icon: RefreshCw, title: "Easy 7-day returns", sub: "Hassle-free refunds" },
  { icon: Sparkles, title: "Cruelty-free edit", sub: "Consciously curated" },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-secondary/60">
      <div className="container-luxe border-b border-border py-10">
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {trust.map(({ icon: Icon, title, sub }) => (
            <div key={title} className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">{title}</p>
                <p className="text-xs text-muted-foreground">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="container-luxe py-14">
        <div className="grid gap-12 md:grid-cols-4">
          <div className="md:col-span-1">
            <Link to="/" className="font-heading text-2xl font-semibold tracking-tight">
              FEA<span className="text-primary">Glam</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              Curated cosmetics, skincare, and fragrances for the modern Indian beauty lover.
            </p>
            <div className="mt-6 flex items-center gap-3">
              {[Instagram, Facebook, Twitter].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  aria-label="Social link"
                  className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-heading text-lg font-medium">Shop</h4>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li><Link to="/products" search={{ category: "makeup" }} className="hover:text-foreground">Makeup</Link></li>
              <li><Link to="/products" search={{ category: "skincare" }} className="hover:text-foreground">Skincare</Link></li>
              <li><Link to="/products" search={{ category: "haircare" }} className="hover:text-foreground">Haircare</Link></li>
              <li><Link to="/products" search={{ category: "fragrances" }} className="hover:text-foreground">Fragrances</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-heading text-lg font-medium">Help</h4>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li><Link to="/about" className="hover:text-foreground">About us</Link></li>
              <li><Link to="/orders" className="hover:text-foreground">Order status</Link></li>
              <li><Link to="/shipping" className="hover:text-foreground">Shipping &amp; returns</Link></li>
              <li><Link to="/faq" className="hover:text-foreground">FAQs</Link></li>
              <li><Link to="/contact" className="hover:text-foreground">Contact us</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-heading text-lg font-medium">Stay in the loop</h4>
            <p className="mt-4 text-sm text-muted-foreground">
              Subscribe for launches, beauty tips, and exclusive offers.
            </p>
            <NewsletterForm />
            <p className="mt-3 text-xs text-muted-foreground">Try code <span className="font-semibold text-primary">WELCOME10</span> at checkout.</p>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 text-sm text-muted-foreground md:flex-row">
          <p>&copy; {new Date().getFullYear()} FEAGlam. All rights reserved.</p>
          <div className="flex gap-6">
            <Link to="/privacy" className="hover:text-foreground">Privacy policy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms of service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const subscribeFn = useServerFn(subscribeNewsletter);

  const mutation = useMutation({
    mutationFn: subscribeFn,
    onSuccess: () => { setDone(true); setEmail(""); toast.success("You're subscribed — welcome to FEAGlam!"); },
    onError: (err: any) => toast.error(err?.message ?? "Could not subscribe"),
  });

  if (done) {
    return (
      <p className="mt-4 flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
        <Check className="h-4 w-4" /> Thanks for subscribing!
      </p>
    );
  }

  return (
    <form
      className="mt-4 flex gap-2"
      onSubmit={(e) => { e.preventDefault(); if (email.trim()) mutation.mutate({ data: { email: email.trim() } }); }}
    >
      <input
        type="email"
        required
        placeholder="Your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
      />
      <button type="submit" className="btn-gold px-4 py-2 text-sm" disabled={mutation.isPending}>
        {mutation.isPending ? "…" : "Join"}
      </button>
    </form>
  );
}
