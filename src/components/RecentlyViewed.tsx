import { useQuery } from "@tanstack/react-query";
import { getProductsByIds } from "@/lib/products.functions";
import { ProductCard } from "@/components/ProductCard";
import { useRecentlyViewedIds } from "@/hooks/use-recently-viewed";

/**
 * Shows the visitor's recently viewed products (from localStorage), excluding
 * the current one. Renders nothing until there are at least two to show.
 */
export function RecentlyViewed({ excludeId, title = "Recently viewed" }: { excludeId?: string; title?: string }) {
  const ids = useRecentlyViewedIds().filter((id) => id !== excludeId).slice(0, 8);

  const { data: products } = useQuery({
    queryKey: ["products", "by-ids", ids],
    queryFn: () => getProductsByIds({ data: { ids } }),
    enabled: ids.length > 0,
    staleTime: 60_000,
  });

  if (ids.length === 0 || !products || products.length === 0) return null;

  // Preserve the recently-viewed ordering.
  const ordered = ids.map((id) => products.find((p) => p.id === id)).filter(Boolean) as typeof products;

  return (
    <section className="mt-16 border-t border-border pt-12">
      <h2 className="font-serif text-3xl font-light text-foreground">{title}</h2>
      <div className="mt-8 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
        {ordered.slice(0, 4).map((product, i) => (
          <ProductCard key={product.id} product={product as never} index={i} />
        ))}
      </div>
    </section>
  );
}
