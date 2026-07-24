import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getWishlistIds, toggleWishlist } from "@/lib/wishlist.functions";

const WISHLIST_IDS_KEY = ["wishlist", "ids"] as const;

/**
 * Shared wishlist state. The id list is fetched once and cached, so every
 * heart button on the page reads from the same source. Errors (e.g. a signed-out
 * visitor) resolve to an empty list rather than breaking the page.
 */
export function useWishlist() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toggleFn = useServerFn(toggleWishlist);

  const { data } = useQuery({
    queryKey: WISHLIST_IDS_KEY,
    queryFn: () => getWishlistIds({ data: undefined }),
    retry: false,
    staleTime: 60_000,
    throwOnError: false,
  });

  const ids = data ?? [];

  const mutation = useMutation({
    mutationFn: (productId: string) => toggleFn({ data: { productId } }),
    onMutate: async (productId) => {
      await queryClient.cancelQueries({ queryKey: WISHLIST_IDS_KEY });
      const previous = queryClient.getQueryData<string[]>(WISHLIST_IDS_KEY) ?? [];
      const next = previous.includes(productId)
        ? previous.filter((id) => id !== productId)
        : [...previous, productId];
      queryClient.setQueryData(WISHLIST_IDS_KEY, next);
      return { previous };
    },
    onSuccess: (result) => {
      toast.success(result.wishlisted ? "Saved to wishlist" : "Removed from wishlist");
    },
    onError: (err: any, _productId, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(WISHLIST_IDS_KEY, ctx.previous);
      if (err?.message?.includes("Unauthorized")) {
        toast.error("Please sign in to save favourites");
        navigate({ to: "/auth" });
      } else {
        toast.error(err?.message ?? "Could not update wishlist");
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: WISHLIST_IDS_KEY });
      queryClient.invalidateQueries({ queryKey: ["wishlist", "full"] });
    },
  });

  return {
    ids,
    isWishlisted: (productId: string) => ids.includes(productId),
    toggle: (productId: string) => mutation.mutate(productId),
    pendingId: mutation.isPending ? (mutation.variables as string) : null,
  };
}
