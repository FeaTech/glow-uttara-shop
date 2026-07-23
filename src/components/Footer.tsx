import { Link } from "@tanstack/react-router";
import { Instagram, Facebook, Twitter } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border bg-secondary">
      <div className="container-luxe section-padding">
        <div className="grid gap-12 md:grid-cols-4">
          <div className="md:col-span-1">
            <Link to="/" className="font-heading text-2xl font-semibold tracking-tight">
              FEALuxy
            </Link>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              Curated cosmetics, skincare, and fragrances for the modern Indian beauty lover.
            </p>
            <div className="mt-6 flex items-center gap-4">
              <a href="#" aria-label="Instagram" className="text-muted-foreground hover:text-foreground">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="#" aria-label="Facebook" className="text-muted-foreground hover:text-foreground">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="#" aria-label="Twitter" className="text-muted-foreground hover:text-foreground">
                <Twitter className="h-5 w-5" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-heading text-lg font-medium">Shop</h4>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li><Link to="/products?category=makeup" className="hover:text-foreground">Makeup</Link></li>
              <li><Link to="/products?category=skincare" className="hover:text-foreground">Skincare</Link></li>
              <li><Link to="/products?category=haircare" className="hover:text-foreground">Haircare</Link></li>
              <li><Link to="/products?category=fragrances" className="hover:text-foreground">Fragrances</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-heading text-lg font-medium">Help</h4>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li><Link to="/orders" className="hover:text-foreground">Order status</Link></li>
              <li><a href="#" className="hover:text-foreground">Shipping & returns</a></li>
              <li><a href="#" className="hover:text-foreground">FAQs</a></li>
              <li><a href="#" className="hover:text-foreground">Contact us</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-heading text-lg font-medium">Stay in the loop</h4>
            <p className="mt-4 text-sm text-muted-foreground">
              Subscribe for launches, beauty tips, and exclusive offers.
            </p>
            <form className="mt-4 flex gap-2" onSubmit={(e) => e.preventDefault()}>
              <input
                type="email"
                placeholder="Your email"
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
              />
              <button type="submit" className="btn-gold px-4 py-2 text-sm">
                Join
              </button>
            </form>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 text-sm text-muted-foreground md:flex-row">
          <p>&copy; {new Date().getFullYear()} FEALuxy. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-foreground">Privacy policy</a>
            <a href="#" className="hover:text-foreground">Terms of service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
