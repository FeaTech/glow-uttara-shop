import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { listCategories, listProducts } from "@/lib/products.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const productsQueryOptions = (category?: string) =>
  queryOptions({
    queryKey: ["products", "list", category ?? "all"],
    queryFn: () => listProducts({ data: category ? { category } : {} }),
  });

const categoriesQueryOptions = () =>
  queryOptions({
    queryKey: ["categories"],
    queryFn: () => listCategories({ data: undefined }),
  });

export const Route = createFileRoute("/products")({
  head: () => ({
    meta: [
      { title: "Shop — FEALuxy" },
      { name: "description", content: "Browse premium makeup, skincare, haircare, fragrances and beauty accessories at FEALuxy." },
      { property: "og:title", content: "Shop — FEALuxy" },
      { property: "og:description", content: "Browse premium makeup, skincare, haircare, fragrances and beauty accessories at FEALuxy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loaderDeps: ({ search }) => ({ category: search.category }),
  loader: ({ context, deps }) => {
    context.queryClient.ensureQueryData(categoriesQueryOptions());
    context.queryClient.ensureQueryData(productsQueryOptions(deps.category));
  },
  component: ProductsPage,
});

function ProductsPage() {
  const { category } = Route.useSearch();
  const { data: categories } = useSuspenseQuery(categoriesQueryOptions());
  const { data: products } = useSuspenseQuery(productsQueryOptions(category));

  const activeCategory = categories.find((c) => c.slug === category);

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="border-b bg-secondary/30">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <h1 className="font-serif text-4xl font-light text-foreground">
            {activeCategory ? activeCategory.name : "All products"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {activeCategory?.description ?? "Explore our curated collection of luxury beauty products."}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap gap-2">
          <Button asChild variant={!category ? "default" : "outline"} size="sm">
            <Link to="/products" search={{}}>
              All
            </Link>
          </Button>
          {categories.map((cat) => (
            <Button asChild key={cat.id} variant={category === cat.slug ? "default" : "outline"} size="sm">
              <Link to="/products" search={{ category: cat.slug }}>
                {cat.name}
              </Link>
            </Button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {products.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">No products found in this category.</div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
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
        <div className="relative aspect-square overflow-hidden bg-muted">
          <img
            src={image}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {product.is_featured && (
            <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground">Featured</Badge>
          )}
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
