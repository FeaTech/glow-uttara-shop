import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getCart, removeCartItem, updateCartItem } from "@/lib/cart.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const cartQueryOptions = () =>
  queryOptions({
    queryKey: ["cart"],
    queryFn: () => getCart({ data: undefined }),
  });

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Shopping cart — FEALuxy" },
      { name: "description", content: "Review your FEALuxy shopping cart." },
      { property: "og:title", content: "Shopping cart — FEALuxy" },
      { property: "og:description", content: "Review your FEALuxy shopping cart." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(cartQueryOptions()),
  component: CartPage,
});

function CartPage() {
  const { data: cart } = useSuspenseQuery(cartQueryOptions());
  const queryClient = useQueryClient();
  const removeItem = useServerFn(removeCartItem);
  const updateItem = useServerFn(updateCartItem);

  const removeMutation = useMutation({
    mutationFn: removeItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      toast.success("Item removed");
    },
    onError: (err: any) => toast.error(err?.message ?? "Could not remove item"),
  });

  const updateMutation = useMutation({
    mutationFn: updateItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
    onError: (err: any) => toast.error(err?.message ?? "Could not update item"),
  });

  if (!cart.items.length) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-24 text-center sm:px-6 lg:px-8">
        <h1 className="font-serif text-3xl font-light text-foreground">Your cart is empty</h1>
        <p className="mt-2 text-muted-foreground">Discover luxury beauty products curated for you.</p>
        <Button asChild className="mt-6 btn-gold">
          <Link to="/products">Continue shopping</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="font-serif text-3xl font-light text-foreground">Shopping cart</h1>
        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {cart.items.map((item) => {
              const product = item.products;
              const variant = item.product_variants;
              const price = variant?.price_inr ?? product?.price_inr ?? 0;
              const image = (product?.images as string[] | undefined)?.[0] ?? "https://placehold.co/600x600/e8e0d5/8b7355?text=FEALuxy";
              return (
                <div key={item.id} className="card-luxe flex gap-4 p-4">
                  <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                    <img src={image} alt={product?.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="flex flex-1 flex-col justify-between">
                    <div>
                      <Link to="/products/$slug" params={{ slug: product?.slug ?? "" }} className="font-medium text-foreground hover:text-primary">
                        {product?.name}
                      </Link>
                      {variant && <p className="text-sm text-muted-foreground">{variant.variant_name}</p>}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center rounded-md border border-input">
                        <button
                          type="button"
                          className="px-3 py-1 text-foreground hover:bg-accent"
                          onClick={() => updateMutation.mutate({ data: { itemId: item.id, quantity: Math.max(0, item.quantity - 1) } })}
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm">{item.quantity}</span>
                        <button
                          type="button"
                          className="px-3 py-1 text-foreground hover:bg-accent"
                          onClick={() => updateMutation.mutate({ data: { itemId: item.id, quantity: item.quantity + 1 } })}
                        >
                          +
                        </button>
                      </div>
                      <span className="font-semibold text-foreground">₹{(price * item.quantity).toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-sm text-muted-foreground hover:text-destructive"
                    onClick={() => removeMutation.mutate({ data: { itemId: item.id } })}
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>

          <div className="card-luxe h-fit p-6">
            <h2 className="font-serif text-xl text-foreground">Order summary</h2>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>₹{cart.total.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Shipping</span>
                <span>Calculated at checkout</span>
              </div>
            </div>
            <div className="mt-4 border-t pt-4">
              <div className="flex justify-between text-lg font-semibold text-foreground">
                <span>Total</span>
                <span>₹{cart.total.toLocaleString("en-IN")}</span>
              </div>
            </div>
            <Button asChild className="mt-6 w-full btn-gold">
              <Link to="/checkout">Proceed to checkout</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
