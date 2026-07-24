import { useQuery } from "@tanstack/react-query";
import { getCart } from "@/lib/cart.functions";

/** Total item quantity in the active cart, or 0 when signed out / on error. */
export function useCartCount(): number {
  const { data } = useQuery({
    queryKey: ["cart"],
    queryFn: () => getCart({ data: undefined }),
    retry: false,
    throwOnError: false,
    staleTime: 30_000,
  });
  if (!data?.items) return 0;
  return data.items.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
}
