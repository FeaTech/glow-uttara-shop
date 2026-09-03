import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { ArrowRight, BadgeIndianRupee, Leaf, Sparkles } from "lucide-react";
import { listProducts, type ProductType } from "@/lib/products.functions";
import { COLLECTIONS } from "@/lib/collections";
import { ProductCard } from "@/components/ProductCard";
import { ProductGridSkeleton } from "@/components/ProductCardSkeleton";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ICONS: Record<ProductType, typeof Leaf> = {
  korean: Sparkles,
  organic: Leaf,
  budget: BadgeIndianRupee,
};

const collectionProductsQueryOptions = (type: ProductType) =>
  queryOptions({
    queryKey: ["products", "collection", type],
    queryFn: () => listProducts({ data: { productType: type, limit: 8 } }),
  });

/**
 * Three circular collection portals. Selecting one recolours the whole band —
 * every palette is painted at once as a stacked `.atmos-layer` and cross-faded
 * on opacity, because CSS custom properties don't interpolate and animating
 * them directly would snap between colours.
 */
export function CollectionPortals() {
  const [selected, setSelected] = useState<ProductType | null>(null);

  const { data: products, isLoading } = useQuery({
    ...collectionProductsQueryOptions(selected ?? "korean"),
    enabled: selected !== null,
  });

  const active = COLLECTIONS.find((c) => c.key === selected) ?? null;

  return (
    <section className="relative isolate overflow-hidden">
      {/* Atmosphere — one layer per palette, only opacity changes. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        {["house", ...COLLECTIONS.map((c) => c.key)].map((key) => (
          <div
            key={key}
            data-collection={key}
            data-on={(selected ?? "house") === key}
            className="atmos-layer"
          />
        ))}
      </div>

      <div className="container-luxe py-12 md:py-16">
        <div className="text-center">
          <div className="rule-gold mx-auto" />
          <h2 className="mt-4 font-serif text-3xl font-light text-foreground md:text-4xl">
            Choose your <span className="text-gradient-gold italic">collection</span>
          </h2>
          <p className="mt-2 text-muted-foreground">
            Three ways to shop FEA Glam. Tap one to step inside.
          </p>
        </div>

        <div className="mt-10 flex items-start justify-center gap-4 sm:gap-10 md:gap-16">
          {COLLECTIONS.map((collection, i) => {
            const Icon = ICONS[collection.key];
            const isOn = selected === collection.key;
            return (
              <button
                key={collection.key}
                type="button"
                data-collection={collection.key}
                aria-pressed={isOn}
                onClick={() => setSelected(isOn ? null : collection.key)}
                className="portal group flex max-w-[13rem] flex-col items-center text-center"
                style={{ animation: "var(--animate-fade-up)", animationDelay: `${i * 90}ms` }}
              >
                <span className="portal-shell">
                  <span className="portal-halo" />
                  <span className="portal-orb">
                    <span className="portal-blob portal-blob-a" />
                    <span className="portal-blob portal-blob-b" />
                    <span className="portal-rim" />
                    <Icon className="portal-icon h-7 w-7 sm:h-9 sm:w-9" strokeWidth={1.5} />
                  </span>
                </span>
                <span
                  className={cn(
                    "mt-4 font-serif text-base font-light transition-colors sm:text-xl",
                    isOn ? "text-foreground" : "text-foreground/80 group-hover:text-foreground",
                  )}
                >
                  {collection.label}
                </span>
                <span className="mt-1 hidden text-xs leading-relaxed text-muted-foreground sm:block">
                  {collection.tagline}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected collection slides open below the portals. */}
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-500 ease-in-out",
            active ? "mt-12 grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="overflow-hidden">
            {active && (
              <div style={{ animation: "portal-rise 500ms cubic-bezier(0.22,1,0.36,1) both" }}>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h3 className="font-serif text-2xl font-light text-foreground">{active.label}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{active.tagline}</p>
                  </div>
                  <Button asChild variant="outline">
                    <Link to="/products" search={{ productType: active.key }}>
                      Shop {active.label} <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>

                {isLoading ? (
                  <div className="mt-8">
                    <ProductGridSkeleton count={4} />
                  </div>
                ) : products && products.length > 0 ? (
                  <Carousel opts={{ align: "start", loop: products.length > 4 }} className="mt-8">
                    <CarouselContent>
                      {products.map((product, i) => (
                        <CarouselItem key={product.id} className="basis-1/2 sm:basis-1/3 lg:basis-1/4">
                          <ProductCard product={product as never} index={i} />
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    <CarouselPrevious className="hidden sm:flex" />
                    <CarouselNext className="hidden sm:flex" />
                  </Carousel>
                ) : (
                  <div className="mt-8 rounded-2xl border border-dashed border-border py-14 text-center">
                    <p className="font-serif text-xl font-light text-foreground">
                      {active.label} is on its way
                    </p>
                    <p className="mt-2 text-muted-foreground">
                      Check back soon — we're adding this range shortly.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
