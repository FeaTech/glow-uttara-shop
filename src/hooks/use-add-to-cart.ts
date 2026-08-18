import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { addToCart, getCart } from "@/lib/cart.functions";

type CartData = Awaited<ReturnType<typeof getCart>>;
type CartItem = CartData["items"][number];

/** Minimum product info needed to render an optimistic cart line. */
export interface OptimisticProduct {
  id: string;
  slug: string;
  name: string;
  price_inr: number | null;
  compare_price_inr?: number | null;
  images?: unknown;
}

interface AddArgs {
  product: OptimisticProduct;
  variantId?: string;
  /** Price of the chosen variant, when one is selected. */
  variantPrice?: number | null;
  variantName?: string | null;
  quantity?: number;
}

function recalcTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => {
    const price = item.product_variants?.price_inr ?? item.products?.price_inr ?? 0;
    return sum + price * item.quantity;
  }, 0);
}

/**
 * Add-to-cart with an optimistic cache update.
 *
 * Previously the cart badge (and cart page) only changed after the mutation
 * round trip AND a follow-up refetch had both completed, so the button sat in a
 * spinner for two serialised requests. Now the cached cart is updated on click
 * and revalidated in the background; onError rolls it back.
 */
export function useAddToCart() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const addToCartFn = useServerFn(addToCart);

  const mutation = useMutation({
    mutationFn: async ({ product, variantId, quantity = 1 }: AddArgs) => {
      // Guard: calling the protected server fn while signed out throws an
      // unhandled "Unauthorized" runtime error, which blanks the screen.
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error("Unauthorized");
      return addToCartFn({ data: { productId: product.id, variantId, quantity } });
    },

    onMutate: async ({ product, variantId, variantPrice, variantName, quantity = 1 }: AddArgs) => {
      await queryClient.cancelQueries({ queryKey: ["cart"] });
      const previous = queryClient.getQueryData<CartData>(["cart"]);
      if (!previous) return { previous };

      const match = previous.items.find(
        (i) => i.product_id === product.id && (i.variant_id ?? undefined) === variantId,
      );

      const items: CartItem[] = match
        ? previous.items.map((i) =>
            i === match ? { ...i, quantity: i.quantity + quantity } : i,
          )
        : [
            ...previous.items,
            // Synthetic line; replaced by the real row on revalidation.
            {
              id: `optimistic-${product.id}-${variantId ?? "base"}`,
              cart_id: "",
              product_id: product.id,
              variant_id: variantId ?? null,
              quantity,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              products: {
                id: product.id,
                slug: product.slug,
                name: product.name,
                price_inr: product.price_inr,
                compare_price_inr: product.compare_price_inr ?? null,
                images: product.images,
              },
              product_variants: variantId
                ? { id: variantId, variant_name: variantName ?? "", price_inr: variantPrice ?? null }
                : null,
            } as unknown as CartItem,
          ];

      queryClient.setQueryData<CartData>(["cart"], { items, total: recalcTotal(items) });
      return { previous };
    },

    onSuccess: () => toast.success("Added to cart"),

    onError: (err: any, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["cart"], ctx.previous);
      if (err?.message?.includes("Unauthorized")) {
        toast.error("Please sign in to shop");
        navigate({ to: "/auth" });
      } else {
        toast.error(err?.message ?? "Could not add to cart");
      }
    },

    onSettled: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
  });

  return mutation;
}
