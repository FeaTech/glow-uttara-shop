import { Link } from "@tanstack/react-router";
import { BadgeIndianRupee, Leaf, Sparkles } from "lucide-react";
import type { ProductType } from "@/lib/products.functions";
import { COLLECTIONS } from "@/lib/collections";

const ICONS: Record<ProductType, typeof Leaf> = {
  korean: Sparkles,
  organic: Leaf,
  budget: BadgeIndianRupee,
};

/** A compact collection switcher that takes customers directly to its products. */
export function CollectionPortals() {
  return (
    <section className="relative z-10 mx-auto -mb-px w-full max-w-5xl px-4 pt-4 sm:pt-5">
      <div className="rounded-2xl border border-border bg-card/95 p-3 shadow-luxe backdrop-blur sm:p-4">
        <p className="px-2 pb-2 text-center text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Tap to shop a collection
        </p>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {COLLECTIONS.map((collection) => {
            const Icon = ICONS[collection.key];
            return (
              <Link
                key={collection.key}
                to="/products"
                search={{ productType: collection.key }}
                data-collection={collection.key}
                className="collection-link group"
              >
                <span className="collection-link-icon">
                  <Icon className="h-4 w-4" strokeWidth={1.8} />
                </span>
                <span>
                  <span className="block font-serif text-base font-medium sm:text-lg">
                    {collection.label}
                  </span>
                  <span className="mt-0.5 hidden text-xs leading-relaxed text-muted-foreground lg:block">
                    {collection.tagline}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
