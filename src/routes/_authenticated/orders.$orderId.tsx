import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, Package, Truck, Home, Clock, XCircle, RotateCcw } from "lucide-react";
import { getOrderById, cancelOrder } from "@/lib/orders.functions";
import { reorderToCart } from "@/lib/cart.functions";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatINR, productImage } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const orderQueryOptions = (orderId: string) =>
  queryOptions({ queryKey: ["orders", orderId], queryFn: () => getOrderById({ data: { orderId } }) });

export const Route = createFileRoute("/_authenticated/orders/$orderId")({
  head: () => ({ meta: [{ title: "Order details — FEALuxe" }] }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(orderQueryOptions(params.orderId)),
  component: OrderDetailPage,
});

const TIMELINE = [
  { key: "pending", label: "Order placed", icon: Clock },
  { key: "processing", label: "Processing", icon: Package },
  { key: "shipped", label: "Shipped", icon: Truck },
  { key: "delivered", label: "Delivered", icon: Home },
];

function OrderDetailPage() {
  const { orderId } = Route.useParams();
  const { data: order } = useSuspenseQuery(orderQueryOptions(orderId));
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const cancelFn = useServerFn(cancelOrder);
  const reorderFn = useServerFn(reorderToCart);

  const cancelMutation = useMutation({
    mutationFn: cancelFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders", orderId] });
      toast.success("Order cancelled");
    },
    onError: (err: any) => toast.error(err?.message ?? "Could not cancel order"),
  });

  const reorderMutation = useMutation({
    mutationFn: reorderFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      toast.success("Items added to cart");
      navigate({ to: "/cart" });
    },
    onError: (err: any) => toast.error(err?.message ?? "Could not reorder"),
  });

  if (!order) {
    return (
      <div className="container-luxe grid min-h-[60vh] place-items-center text-center">
        <div>
          <h1 className="font-serif text-3xl font-light text-foreground">Order not found</h1>
          <Button asChild className="btn-gold mt-6"><Link to="/orders">Back to orders</Link></Button>
        </div>
      </div>
    );
  }

  const cancelled = order.status === "cancelled";
  const canCancel = order.status === "pending" || order.status === "processing";
  const currentStep = TIMELINE.findIndex((s) => s.key === order.status);
  const address = order.shipping_address as any;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="container-luxe py-10">
        <Link to="/orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to orders
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-light text-foreground md:text-4xl">
              Order #{order.id.slice(0, 8).toUpperCase()}
            </h1>
            <p className="mt-1 text-muted-foreground">Placed {formatDateTime(order.created_at)}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => reorderMutation.mutate({ data: { orderId: order.id } })} disabled={reorderMutation.isPending}>
              <RotateCcw className="h-4 w-4" /> Reorder
            </Button>
            {canCancel && (
              <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => cancelMutation.mutate({ data: { orderId: order.id } })} disabled={cancelMutation.isPending}>
                Cancel order
              </Button>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="card-luxe mt-8 p-6">
          {cancelled ? (
            <div className="flex items-center gap-3 text-destructive">
              <XCircle className="h-6 w-6" />
              <div>
                <p className="font-medium">This order was cancelled</p>
                <p className="text-sm text-muted-foreground">Any charged amount will be refunded per our returns policy.</p>
              </div>
            </div>
          ) : (
            <ol className="grid grid-cols-4 gap-2">
              {TIMELINE.map((step, i) => {
                const done = i <= currentStep;
                const active = i === currentStep;
                return (
                  <li key={step.key} className="flex flex-col items-center text-center">
                    <div className="flex w-full items-center">
                      <span className={cn("h-0.5 flex-1", i === 0 ? "opacity-0" : done ? "bg-primary" : "bg-border")} />
                      <span className={cn(
                        "grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 transition-colors",
                        done ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground",
                        active && "ring-4 ring-primary/20",
                      )}>
                        {done && !active ? <Check className="h-4 w-4" /> : <step.icon className="h-4 w-4" />}
                      </span>
                      <span className={cn("h-0.5 flex-1", i === TIMELINE.length - 1 ? "opacity-0" : i < currentStep ? "bg-primary" : "bg-border")} />
                    </div>
                    <span className={cn("mt-2 text-xs", done ? "font-medium text-foreground" : "text-muted-foreground")}>{step.label}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          {/* Items */}
          <div className="space-y-4 lg:col-span-2">
            <h2 className="font-serif text-xl text-foreground">Items</h2>
            {order.order_items.map((item: any) => {
              const image = productImage(item.products?.images);
              const slug = item.products?.slug;
              return (
                <div key={item.id} className="card-luxe flex items-center gap-4 p-4">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                    <img src={image} alt={item.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    {slug ? (
                      <Link to="/products/$slug" params={{ slug }} className="font-medium text-foreground hover:text-primary">{item.name}</Link>
                    ) : (
                      <p className="font-medium text-foreground">{item.name}</p>
                    )}
                    <p className="text-sm text-muted-foreground">Qty {item.quantity} · {formatINR(item.price_inr)} each</p>
                  </div>
                  <span className="font-semibold text-foreground">{formatINR(item.price_inr * item.quantity)}</span>
                </div>
              );
            })}
          </div>

          {/* Summary + address */}
          <div className="space-y-6">
            <div className="card-luxe p-6">
              <h2 className="font-serif text-xl text-foreground">Summary</h2>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatINR(order.subtotal_inr ?? order.total_inr + order.discount_inr)}</span>
                </div>
                {order.discount_inr > 0 && (
                  <div className="flex justify-between text-primary">
                    <span>Discount{order.coupon_code ? ` (${order.coupon_code})` : ""}</span>
                    <span>−{formatINR(order.discount_inr)}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground"><span>Shipping</span><span className="text-emerald-600 dark:text-emerald-400">Free</span></div>
              </div>
              <div className="mt-3 flex justify-between border-t border-border pt-3 text-lg font-semibold text-foreground">
                <span>Total</span><span>{formatINR(order.total_inr)}</span>
              </div>
              <p className="mt-4 text-sm">
                Payment: <span className={cn("font-medium capitalize", order.payment_status === "paid" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>{order.payment_status}</span>
              </p>
            </div>

            {address && (
              <div className="card-luxe p-6">
                <h2 className="font-serif text-xl text-foreground">Shipping to</h2>
                <address className="mt-3 text-sm not-italic text-muted-foreground">
                  <span className="font-medium text-foreground">{address.label}</span><br />
                  {address.line1}{address.line2 ? `, ${address.line2}` : ""}<br />
                  {address.city}, {address.state} — {address.pincode}<br />
                  {address.country}
                </address>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
