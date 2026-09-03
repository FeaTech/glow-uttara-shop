import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, Star, Truck, ShieldCheck, Sparkles, Leaf } from "lucide-react";
import { listCategories, listProducts } from "@/lib/products.functions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ProductCard } from "@/components/ProductCard";
import { ProductGridSkeleton } from "@/components/ProductCardSkeleton";
import { ScrollReveal } from "@/components/ScrollReveal";
import { RecentlyViewed } from "@/components/RecentlyViewed";
import heroBg from "@/assets/hero-feaglam-products.png.asset.json";

const featuredProductsQueryOptions = () =>
  queryOptions({
    queryKey: ["products", "featured"],
    queryFn: () => listProducts({ data: { featured: true, limit: 8 } }),
  });

const organicProductsQueryOptions = () =>
  queryOptions({
    queryKey: ["products", "organic-preview"],
    queryFn: () => listProducts({ data: { productType: "organic", limit: 8 } }),
  });

const bestsellersQueryOptions = () =>
  queryOptions({
    queryKey: ["products", "bestsellers"],
    queryFn: () => listProducts({ data: { sort: "popular", limit: 4 } }),
  });

const categoriesQueryOptions = () =>
  queryOptions({
    queryKey: ["categories"],
    queryFn: () => listCategories({ data: undefined }),
  });

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FEA Glam — Premium Beauty & Cosmetics" },
      { name: "description", content: "Discover luxury makeup, skincare, haircare, fragrances and beauty accessories at FEA Glam." },
      { property: "og:title", content: "FEA Glam — Premium Beauty & Cosmetics" },
      { property: "og:type", content: "website" },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(categoriesQueryOptions());
    context.queryClient.ensureQueryData(featuredProductsQueryOptions());
    context.queryClient.ensureQueryData(bestsellersQueryOptions());
  },
  component: HomePage,
});

const categoryImages: Record<string, string> = {
  makeup: "/categories/makeup.jpg",
  skincare: "/categories/skincare.jpg",
  haircare: "/categories/haircare.jpg",
  fragrances: "/categories/fragrances.jpg",
  "beauty-accessories": "/categories/accessories.jpg",
};

const testimonials = [
  { name: "Ananya R.", city: "Mumbai", text: "The foundation shade range is perfect for Indian skin. Finally a store that gets it!", rating: 5 },
  { name: "Priya S.", city: "Bengaluru", text: "Fast delivery and everything is 100% authentic. My vitamin C serum arrived beautifully packed.", rating: 5 },
  { name: "Kavya M.", city: "Delhi", text: "Obsessed with the oud perfume. Luxurious experience from browsing to unboxing.", rating: 5 },
];

function HomePage() {
  const { data: categories } = useSuspenseQuery(categoriesQueryOptions());
  const { data: featured } = useSuspenseQuery(featuredProductsQueryOptions());
  const { data: bestsellers } = useSuspenseQuery(bestsellersQueryOptions());

  const [showOrganicOnly, setShowOrganicOnly] = useState(false);
  const { data: organicProducts, isLoading: isLoadingOrganic } = useQuery({
    ...organicProductsQueryOptions(),
    enabled: showOrganicOnly,
  });

  return (
    <div className="bg-background">
      {/* ---------- Organic launch banner ---------- */}
      <section className="relative overflow-hidden bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-700 text-white">
        <Leaf className="pointer-events-none absolute -left-6 -top-8 h-32 w-32 rotate-12 text-white/10" />
        <Leaf className="pointer-events-none absolute -right-4 -bottom-10 h-40 w-40 -rotate-12 text-white/10" />
        <Leaf className="pointer-events-none absolute right-1/4 top-1/2 hidden h-16 w-16 -translate-y-1/2 rotate-45 text-white/10 md:block" />
        <div className="container-luxe relative flex flex-col items-center gap-5 py-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/15 ring-2 ring-white/25">
              <Leaf className="h-7 w-7" />
            </span>
            <div>
              <span className="inline-flex items-center rounded-full bg-white text-emerald-700 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest">
                New
              </span>
              <p className="mt-1 font-serif text-xl font-light sm:text-2xl">
                Introducing our <span className="font-medium italic">organic beauty</span> range
              </p>
              <p className="mt-0.5 text-sm text-white/80">Clean, plant-based formulas — now live at FEA Glam.</p>
            </div>
          </div>
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <div className="flex items-center gap-3 rounded-full bg-white/10 px-4 py-2.5 ring-1 ring-white/20">
              <Label htmlFor="organic-only" className="cursor-pointer font-medium text-white">
                Show organic only
              </Label>
              <Switch
                id="organic-only"
                checked={showOrganicOnly}
                onCheckedChange={setShowOrganicOnly}
                className="data-[state=checked]:bg-white data-[state=unchecked]:bg-white/30"
              />
            </div>
            <Button asChild size="lg" className="bg-white text-emerald-700 hover:bg-white/90">
              <Link to="/products" search={{ productType: "organic" }}>
                Shop organic <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {showOrganicOnly && (
        <section className="container-luxe py-16 md:py-24">
          <ScrollReveal className="text-center">
            <div className="rule-gold mx-auto" />
            <h2 className="mt-4 font-serif text-3xl font-light text-foreground md:text-4xl">Organic collection</h2>
            <p className="mt-2 text-muted-foreground">Clean, plant-based beauty — new to FEA Glam.</p>
          </ScrollReveal>
          {isLoadingOrganic ? (
            <div className="mt-10">
              <ProductGridSkeleton count={4} />
            </div>
          ) : organicProducts && organicProducts.length > 0 ? (
            <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
              {organicProducts.map((product, i) => (
                <ProductCard key={product.id} product={product as never} index={i} />
              ))}
            </div>
          ) : (
            <div className="mt-10 rounded-2xl border border-dashed border-border py-16 text-center">
              <p className="font-serif text-xl font-light text-foreground">Organic products are on their way</p>
              <p className="mt-2 text-muted-foreground">Check back soon — we're adding our organic range shortly.</p>
            </div>
          )}
        </section>
      )}

      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroBg.url} alt="FEA Glam luxury beauty products" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-background/70 to-transparent" />
        </div>
        <div className="container-luxe relative py-24 sm:py-32 lg:py-40">
          <div className="max-w-xl" style={{ animation: "var(--animate-fade-up)" }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium uppercase tracking-widest text-primary">
              <Sparkles className="h-3.5 w-3.5" /> New season arrivals
            </span>
            <h1 className="mt-6 font-serif text-5xl leading-[1.05] font-light text-foreground sm:text-6xl lg:text-7xl">
              Beauty,<br />
              <span className="text-gradient-gold font-normal italic">elevated.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg text-muted-foreground">
              Curated luxury cosmetics, skincare, and fragrances — authentic brands, delivered across India.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="btn-gold">
                <Link to="/products">Shop the collection <ArrowRight className="h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/products" search={{ sort: "popular" }}>Explore bestsellers</Link>
              </Button>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> 100% authentic</span>
              <span className="flex items-center gap-2"><Truck className="h-4 w-4 text-primary" /> Pan-India shipping</span>
              <span className="flex items-center gap-2"><Star className="h-4 w-4 fill-primary text-primary" /> 4.9 average rating</span>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Categories ---------- */}
      <section className="container-luxe py-16 md:py-24">
        <ScrollReveal className="text-center">
          <div className="rule-gold mx-auto" />
          <h2 className="mt-4 font-serif text-3xl font-light text-foreground md:text-4xl">Shop by category</h2>
          <p className="mt-2 text-muted-foreground">Find your ritual across our five curated edits.</p>
        </ScrollReveal>
        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {categories.map((cat, i) => (
            <ScrollReveal key={cat.id} delay={i * 70}>
              <Link
                to="/products"
                search={{ category: cat.slug }}
                className="group card-luxe card-hover flex h-full flex-col items-center justify-center gap-4 p-8 text-center"
              >
                <span className="grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-primary/15 to-accent/40 transition-transform duration-300 group-hover:scale-110">
                  <img
                    src={categoryImages[cat.slug] ?? cat.image_url ?? undefined}
                    alt={cat.name}
                    className="h-full w-full object-cover"
                  />
                </span>
                <span className="font-medium text-foreground group-hover:text-primary">{cat.name}</span>
              </Link>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* ---------- Featured ---------- */}
      <section className="container-luxe pb-16 md:pb-24">
        <div className="flex items-end justify-between">
          <ScrollReveal>
            <div className="rule-gold" />
            <h2 className="mt-4 font-serif text-3xl font-light text-foreground md:text-4xl">Featured products</h2>
          </ScrollReveal>
          <Link to="/products" className="group hidden items-center gap-1 text-sm font-medium text-primary hover:underline sm:flex">
            View all <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {featured.map((product, i) => (
            <ProductCard key={product.id} product={product as never} index={i} />
          ))}
        </div>
      </section>

      {/* ---------- Promo band ---------- */}
      <section className="relative overflow-hidden bg-foreground py-16 text-background md:py-20">
        <div className="container-luxe relative flex flex-col items-center gap-6 text-center">
          <ScrollReveal>
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-background/70">Korean beauty inspired</p>
            <h2 className="mt-3 font-serif text-3xl font-light md:text-5xl">
              Discover your <span className="text-gradient-gold">glow ritual</span>
            </h2>
            <p className="mt-3 text-background/70">
              Handpicked makeup, skincare, haircare and fragrance — all authentic, delivered pan-India.
            </p>
            <Button asChild size="lg" className="btn-gold mt-8">
              <Link to="/products">Start shopping</Link>
            </Button>
          </ScrollReveal>
        </div>
      </section>


      {/* ---------- Bestsellers ---------- */}
      <section className="container-luxe py-16 md:py-24">
        <ScrollReveal className="text-center">
          <div className="rule-gold mx-auto" />
          <h2 className="mt-4 font-serif text-3xl font-light text-foreground md:text-4xl">Loved by our community</h2>
          <p className="mt-2 text-muted-foreground">The bestsellers everyone's adding to cart.</p>
        </ScrollReveal>
        <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {bestsellers.map((product, i) => (
            <ProductCard key={product.id} product={product as never} index={i} />
          ))}
        </div>
      </section>

      {/* ---------- Recently viewed ---------- */}
      <div className="container-luxe">
        <RecentlyViewed title="Recently viewed" />
      </div>

      {/* ---------- Testimonials ---------- */}
      <section className="border-t border-border bg-secondary/40 py-16 md:py-24">
        <div className="container-luxe">
          <ScrollReveal className="text-center">
            <h2 className="font-serif text-3xl font-light text-foreground md:text-4xl">What our customers say</h2>
          </ScrollReveal>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <ScrollReveal key={t.name} delay={i * 90}>
                <figure className="card-luxe flex h-full flex-col p-6">
                  <div className="flex gap-0.5 text-primary">
                    {Array.from({ length: t.rating }).map((_, s) => (
                      <Star key={s} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                  <blockquote className="mt-4 flex-1 text-foreground">“{t.text}”</blockquote>
                  <figcaption className="mt-6 text-sm">
                    <span className="font-medium text-foreground">{t.name}</span>
                    <span className="text-muted-foreground"> · {t.city}</span>
                  </figcaption>
                </figure>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
