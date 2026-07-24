import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { SlidersHorizontal, X } from "lucide-react";
import { listCategories, listProducts, SORT_OPTIONS, type SortOption } from "@/lib/products.functions";
import { ProductCard } from "@/components/ProductCard";
import { ProductGridSkeleton } from "@/components/ProductCardSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const productsSearchSchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
  sort: z.enum(SORT_OPTIONS).optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
});
type ProductsSearch = z.infer<typeof productsSearchSchema>;

const SORT_LABELS: Record<SortOption, string> = {
  newest: "Newest",
  price_asc: "Price: Low to High",
  price_desc: "Price: High to Low",
  rating: "Top rated",
  popular: "Most popular",
};

const productsQueryOptions = (search: ProductsSearch) =>
  queryOptions({
    queryKey: ["products", "list", search],
    queryFn: () => listProducts({ data: search }),
    placeholderData: keepPreviousData,
  });

const categoriesQueryOptions = () =>
  queryOptions({
    queryKey: ["categories"],
    queryFn: () => listCategories({ data: undefined }),
  });

export const Route = createFileRoute("/products/")({
  head: () => ({
    meta: [
      { title: "Shop — FEALuxy" },
      { name: "description", content: "Browse premium makeup, skincare, haircare, fragrances and beauty accessories at FEALuxy." },
      { property: "og:title", content: "Shop — FEALuxy" },
      { property: "og:type", content: "website" },
    ],
  }),
  validateSearch: productsSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    context.queryClient.ensureQueryData(categoriesQueryOptions());
    context.queryClient.ensureQueryData(productsQueryOptions(deps));
  },
  component: ProductsIndexPage,
});

function ProductsIndexPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { data: categories } = useSuspenseQuery(categoriesQueryOptions());
  const { data: products, isFetching, isLoading } = useQuery(productsQueryOptions(search));
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeCategory = categories.find((c) => c.slug === search.category);

  const update = (patch: Partial<ProductsSearch>) =>
    navigate({ to: ".", search: (prev: ProductsSearch) => ({ ...prev, ...patch }), replace: true });

  const clearAll = () =>
    navigate({ to: "/products", search: {}, replace: true });

  const hasFilters = Boolean(
    search.category || search.search || search.minPrice || search.maxPrice || search.sort,
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Page banner */}
      <div className="border-b border-border bg-gradient-to-b from-secondary/50 to-background">
        <div className="container-luxe py-12 md:py-16">
          <p className="text-xs font-medium uppercase tracking-widest text-primary">FEALuxy Collection</p>
          <h1 className="mt-3 font-serif text-4xl font-light text-foreground md:text-5xl">
            {search.search
              ? `Results for “${search.search}”`
              : activeCategory
                ? activeCategory.name
                : "All products"}
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            {activeCategory?.description ?? "Explore our curated collection of luxury beauty products, hand-picked for Indian skin and hair."}
          </p>
        </div>
      </div>

      <div className="container-luxe mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
        {/* Filter sidebar */}
        <aside
          className={cn(
            "space-y-8 lg:block",
            filtersOpen ? "block" : "hidden",
          )}
        >
          <FilterPanel
            categories={categories}
            search={search}
            update={update}
            clearAll={clearAll}
            hasFilters={hasFilters}
          />
        </aside>

        {/* Results */}
        <section>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="lg:hidden"
                onClick={() => setFiltersOpen((v) => !v)}
              >
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Filters
              </Button>
              <p className="text-sm text-muted-foreground">
                {isLoading ? "Loading…" : `${products?.length ?? 0} product${(products?.length ?? 0) === 1 ? "" : "s"}`}
              </p>
            </div>

            <Select
              value={search.sort ?? "newest"}
              onValueChange={(v) => update({ sort: v as SortOption })}
            >
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>{SORT_LABELS[opt]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <ProductGridSkeleton count={9} />
          ) : !products || products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-24 text-center">
              <p className="font-serif text-2xl font-light text-foreground">Nothing here yet</p>
              <p className="mt-2 text-muted-foreground">Try adjusting your filters or search terms.</p>
              {hasFilters && (
                <Button variant="outline" className="mt-6" onClick={clearAll}>
                  <X className="mr-2 h-4 w-4" />Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div className={cn("grid grid-cols-2 gap-4 transition-opacity sm:gap-6 lg:grid-cols-3", isFetching && "opacity-60")}>
              {products.map((product, i) => (
                <ProductCard key={product.id} product={product as never} index={i} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function FilterPanel({
  categories,
  search,
  update,
  clearAll,
  hasFilters,
}: {
  categories: { id: string; slug: string; name: string }[];
  search: ProductsSearch;
  update: (patch: Partial<ProductsSearch>) => void;
  clearAll: () => void;
  hasFilters: boolean;
}) {
  const [min, setMin] = useState(search.minPrice?.toString() ?? "");
  const [max, setMax] = useState(search.maxPrice?.toString() ?? "");

  useEffect(() => {
    setMin(search.minPrice?.toString() ?? "");
    setMax(search.maxPrice?.toString() ?? "");
  }, [search.minPrice, search.maxPrice]);

  const applyPrice = () =>
    update({
      minPrice: min ? Number(min) : undefined,
      maxPrice: max ? Number(max) : undefined,
    });

  return (
    <>
      <div>
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-lg font-medium text-foreground">Categories</h3>
          {hasFilters && (
            <button onClick={clearAll} className="text-xs text-primary hover:underline">Clear all</button>
          )}
        </div>
        <ul className="mt-4 space-y-1">
          <li>
            <button
              onClick={() => update({ category: undefined })}
              className={cn(
                "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                !search.category ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-secondary",
              )}
            >
              All products
            </button>
          </li>
          {categories.map((cat) => (
            <li key={cat.id}>
              <button
                onClick={() => update({ category: cat.slug })}
                className={cn(
                  "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                  search.category === cat.slug ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-secondary",
                )}
              >
                {cat.name}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="font-heading text-lg font-medium text-foreground">Price (₹)</h3>
        <div className="mt-4 flex items-center gap-2">
          <Input
            type="number"
            inputMode="numeric"
            placeholder="Min"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            className="h-9"
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="number"
            inputMode="numeric"
            placeholder="Max"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            className="h-9"
          />
        </div>
        <Button variant="outline" size="sm" className="mt-3 w-full" onClick={applyPrice}>
          Apply price
        </Button>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { label: "Under ₹500", min: undefined, max: 500 },
            { label: "₹500–₹1000", min: 500, max: 1000 },
            { label: "₹1000–₹2000", min: 1000, max: 2000 },
            { label: "₹2000+", min: 2000, max: undefined },
          ].map((band) => (
            <button
              key={band.label}
              onClick={() => update({ minPrice: band.min, maxPrice: band.max })}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              {band.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-secondary/50 p-4">
        <p className="text-sm font-medium text-foreground">Need help choosing?</p>
        <p className="mt-1 text-xs text-muted-foreground">Explore our bestsellers and editor's picks.</p>
        <Link to="/products" search={{ sort: "popular" }} className="mt-3 inline-block text-xs font-medium text-primary hover:underline">
          Shop bestsellers →
        </Link>
      </div>
    </>
  );
}
