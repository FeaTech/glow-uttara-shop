import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { listCategories, listProducts } from "@/lib/products.functions";
import { Button } from "@/components/ui/button";

const featuredProductsQueryOptions = () =>
  queryOptions({
    queryKey: ["products", "featured"],
    queryFn: () => listProducts({ data: { featured: true, limit: 8 } }),
  });

const categoriesQueryOptions = () =>
  queryOptions({
    queryKey: ["categories"],
    queryFn: () => listCategories({ data: undefined }),
  });

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FEALuxy — Premium Beauty & Cosmetics" },
      { name: "description", content: "Discover luxury makeup, skincare, haircare, fragrances and beauty accessories at FEALuxy." },
      { property: "og:title", content: "FEALuxy — Premium Beauty & Cosmetics" },
      { property: "og:description", content: "Discover luxury makeup, skincare, haircare, fragrances and beauty accessories at FEALuxy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(categoriesQueryOptions());
    context.queryClient.ensureQueryData(featuredProductsQueryOptions());
  },
  component: HomePage,
});

function HomePage() {
  const { data: categories } = useSuspenseQuery(categoriesQueryOptions());
  const { data: featured } = useSuspenseQuery(featuredProductsQueryOptions());

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="/images/hero-luxe.jpg"
            alt="Luxury beauty products"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/60 to-transparent" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
          <div className="max-w-xl">
            <p className="text-sm font-medium uppercase tracking-widest text-primary">New arrivals</p>
            <h1 className="mt-4 font-serif text-5xl leading-tight font-light text-foreground sm:text-6xl">
              Beauty, <span className="font-normal italic">elevated.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              Curated luxury cosmetics, skincare, and fragrances delivered across India.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="btn-gold">
                <Link to="/products">Shop now</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/products">Explore bestsellers</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-center font-serif text-3xl font-light text-foreground">Shop by category</h2>
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to="/products"
              search={{ category: cat.slug }}
              className="group card-luxe flex flex-col items-center justify-center p-6 text-center transition-transform hover:-translate-y-1"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-serif text-primary">
                {cat.name.charAt(0)}
              </span>
              <span className="mt-3 font-medium text-foreground group-hover:text-primary">{cat.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between">
          <h2 className="font-serif text-3xl font-light text-foreground">Featured products</h2>
          <Link to="/products" className="text-sm font-medium text-primary hover:underline">
            View all
          </Link>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-t bg-secondary/30">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 text-center sm:grid-cols-3">
            <div>
              <p className="font-serif text-xl text-foreground">Authentic products</p>
              <p className="mt-1 text-sm text-muted-foreground">100% genuine luxury brands</p>
            </div>
            <div>
              <p className="font-serif text-xl text-foreground">Pan-India shipping</p>
              <p className="mt-1 text-sm text-muted-foreground">Fast delivery to your door</p>
            </div>
            <div>
              <p className="font-serif text-xl text-foreground">Easy returns</p>
              <p className="mt-1 text-sm text-muted-foreground">Hassle-free within 7 days</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ProductCard({ product }: { product: any }) {
  const image = product.images?.[0] ?? "https://placehold.co/600x600/e8e0d5/8b7355?text=FEALuxy";
  const price = product.price_inr ?? 0;
  const compare = product.compare_price_inr;
  return (
    <Link to="/products/$slug" params={{ slug: product.slug }} className="group block">
      <div className="card-luxe overflow-hidden">
        <div className="aspect-square overflow-hidden bg-muted">
          <img
            src={image}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
        <div className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{product.categories?.name}</p>
          <h3 className="mt-1 font-medium text-foreground line-clamp-2">{product.name}</h3>
          <div className="mt-2 flex items-center gap-2">
            <span className="font-semibold text-foreground">₹{price.toLocaleString("en-IN")}</span>
            {compare && compare > price && (
              <span className="text-sm text-muted-foreground line-through">₹{compare.toLocaleString("en-IN")}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
