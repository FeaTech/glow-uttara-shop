import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { getCart, removeCartItem, updateCartItem } from "@/lib/cart.functions";
import { Button } from "@/components/ui/button";
import { formatINR, productImage } from "@/lib/format";
import { ProductImage } from "@/components/ProductImage";
import { toast } from "sonner";

const cartQueryOptions = () =>
  queryOptions({ queryKey: ["cart"], queryFn: () => getCart({ data: undefined }) });

export const Route = createFileRoute("/_authenticated/cart")({
  head: () => ({
    meta: [
      { title: "Shopping cart — FEA Glam" },
      { name: "description", content: "Review your FEA Glam shopping cart." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(cartQueryOptions()),
  component: CartPage,
});

type CartData = Awaited<ReturnType<typeof getCart>>;

/** Recompute the cart total the same way the server does. */
function recalcTotal(items: CartData["items"]): number {
  return items.reduce((sum, item) => {
    const price = item.product_variants?.price_inr ?? item.products?.price_inr ?? 0;
    return sum + price * item.quantity;
  }, 0);
}

function CartPage() {
  const { data: cart } = useSuspenseQuery(cartQueryOptions());
  const queryClient = useQueryClient();
  const removeItem = useServerFn(removeCartItem);
  const updateItem = useServerFn(updateCartItem);

  /**
   * Apply a change to the cached cart immediately so the UI responds on click
   * instead of after two serialised server round trips. The mutation still runs
   * and revalidates in the background; onError rolls the cache back.
   */
  const optimistic = async (mutate: (items: CartData["items"]) => CartData["items"]) => {
    await queryClient.cancelQueries({ queryKey: ["cart"] });
    const previous = queryClient.getQueryData<CartData>(["cart"]);
    if (previous) {
      const items = mutate(previous.items);
      queryClient.setQueryData<CartData>(["cart"], { items, total: recalcTotal(items) });
    }
    return { previous };
  };

  const rollback = (ctx: { previous?: CartData } | undefined, message: string) => (err: any) => {
    if (ctx?.previous) queryClient.setQueryData(["cart"], ctx.previous);
    toast.error(err?.message ?? message);
  };

  const removeMutation = useMutation({
    mutationFn: (vars: { data: { itemId: string } }) => removeItem(vars),
    onMutate: ({ data }) => optimistic((items) => items.filter((i) => i.id !== data.itemId)),
    onSuccess: () => toast.success("Item removed"),
    onError: (err: any, _vars, ctx) => rollback(ctx, "Could not remove item")(err),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { data: { itemId: string; quantity: number } }) => updateItem(vars),
    onMutate: ({ data }) =>
      optimistic((items) =>
        data.quantity === 0
          ? items.filter((i) => i.id !== data.itemId)
          : items.map((i) => (i.id === data.itemId ? { ...i, quantity: data.quantity } : i)),
      ),
    onError: (err: any, _vars, ctx) => rollback(ctx, "Could not update item")(err),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
  });

  if (!cart.items.length) {
    return (
      <div className="container-luxe py-24 text-center">
        <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground/40" />
        <h1 className="mt-4 font-serif text-3xl font-light text-foreground">Your cart is empty</h1>
        <p className="mt-2 text-muted-foreground">Discover luxury beauty products curated for you.</p>
        <Button asChild className="btn-gold mt-6"><Link to="/products">Continue shopping</Link></Button>
      </div>
    );
  }

  const freeShippingThreshold = 999;
  const remaining = Math.max(0, freeShippingThreshold - cart.total);
  const progress = Math.min(100, (cart.total / freeShippingThreshold) * 100);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="container-luxe py-12">
        <h1 className="font-serif text-3xl font-light text-foreground md:text-4xl">Shopping cart</h1>
        <p className="mt-1 text-muted-foreground">{cart.items.length} item{cart.items.length === 1 ? "" : "s"}</p>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {cart.items.map((item) => {
              const product = item.products;
              const variant = item.product_variants;
              const price = variant?.price_inr ?? product?.price_inr ?? 0;
              const image = productImage(product?.images);
              return (
                <div key={item.id} className="card-luxe flex gap-4 p-4">
                  <Link to="/products/$slug" params={{ slug: product?.slug ?? "" }} className="h-24 w-24 shrink-0 overflow-hidden rounded-md bg-muted sm:h-28 sm:w-28">
                    <ProductImage src={image} alt={product?.name ?? ""} className="h-full w-full object-cover transition-transform hover:scale-105" />
                  </Link>
                  <div className="flex flex-1 flex-col justify-between">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link to="/products/$slug" params={{ slug: product?.slug ?? "" }} className="font-medium text-foreground hover:text-primary">
                          {product?.name}
                        </Link>
                        {variant && <p className="text-sm text-muted-foreground">{variant.variant_name}</p>}
                        <p className="mt-1 text-sm text-muted-foreground">{formatINR(price)} each</p>
                      </div>
                      <button
                        type="button"
                        aria-label="Remove item"
                        className="text-muted-foreground transition-colors hover:text-destructive"
                        onClick={() => removeMutation.mutate({ data: { itemId: item.id } })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center rounded-md border border-input">
                        <button type="button" className="grid h-9 w-9 place-items-center text-foreground hover:bg-secondary" aria-label="Decrease"
                          onClick={() => updateMutation.mutate({ data: { itemId: item.id, quantity: Math.max(0, item.quantity - 1) } })}>
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-9 text-center text-sm">{item.quantity}</span>
                        <button type="button" className="grid h-9 w-9 place-items-center text-foreground hover:bg-secondary" aria-label="Increase"
                          onClick={() => updateMutation.mutate({ data: { itemId: item.id, quantity: item.quantity + 1 } })}>
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <span className="font-semibold text-foreground">{formatINR(price * item.quantity)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="card-luxe h-fit p-6 lg:sticky lg:top-24">
            <h2 className="font-serif text-xl text-foreground">Order summary</h2>

            <div className="mt-4">
              {remaining > 0 ? (
                <p className="text-sm text-muted-foreground">Add <span className="font-medium text-foreground">{formatINR(remaining)}</span> for free shipping</p>
              ) : (
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">You've unlocked free shipping! 🎉</p>
              )}
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <div className="mt-5 space-y-2 border-t border-border pt-5 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatINR(cart.total)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Shipping</span><span>Calculated at checkout</span></div>
            </div>
            <div className="mt-4 flex justify-between border-t border-border pt-4 text-lg font-semibold text-foreground">
              <span>Total</span><span>{formatINR(cart.total)}</span>
            </div>
            <Button asChild className="btn-gold mt-6 w-full"><Link to="/checkout">Proceed to checkout</Link></Button>
            <Button asChild variant="ghost" className="mt-2 w-full"><Link to="/products">Continue shopping</Link></Button>
          </div>
        </div>
      </div>
    </div>
  );
}
