import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Package } from "lucide-react";
import { getOrders, cancelOrder } from "@/lib/orders.functions";
import { Button } from "@/components/ui/button";
import { formatDate, formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const ordersQueryOptions = () =>
  queryOptions({ queryKey: ["orders"], queryFn: () => getOrders({ data: undefined }) });

export const Route = createFileRoute("/_authenticated/orders/")({
  head: () => ({
    meta: [
      { title: "My orders — FEALuxe" },
      { name: "description", content: "View your order history at FEALuxe." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(ordersQueryOptions()),
  component: OrdersPage,
});

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  processing: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  shipped: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  delivered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
};

function OrdersPage() {
  const { data: orders } = useSuspenseQuery(ordersQueryOptions());
  const queryClient = useQueryClient();
  const cancelFn = useServerFn(cancelOrder);

  const cancelMutation = useMutation({
    mutationFn: cancelFn,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["orders"] }); toast.success("Order cancelled"); },
    onError: (err: any) => toast.error(err?.message ?? "Could not cancel order"),
  });

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="container-luxe py-12">
        <h1 className="font-serif text-3xl font-light text-foreground md:text-4xl">My orders</h1>

        {orders.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-border py-24 text-center">
            <Package className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">You haven't placed any orders yet.</p>
            <Button asChild className="btn-gold mt-6"><Link to="/products">Start shopping</Link></Button>
          </div>
        ) : (
          <div className="mt-10 space-y-6">
            {orders.map((order) => {
              const canCancel = order.status === "pending" || order.status === "processing";
              return (
                <div key={order.id} className="card-luxe overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-secondary/30 px-6 py-4">
                    <div className="flex flex-wrap items-center gap-x-8 gap-y-1 text-sm">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Order</p>
                        <p className="font-medium text-foreground">#{order.id.slice(0, 8).toUpperCase()}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Placed</p>
                        <p className="font-medium text-foreground">{formatDate(order.created_at)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Total</p>
                        <p className="font-medium text-foreground">{formatINR(order.total_inr)}</p>
                      </div>
                    </div>
                    <span className={cn("rounded-full px-3 py-1 text-xs font-semibold capitalize", STATUS_STYLES[order.status] ?? "bg-secondary text-foreground")}>
                      {order.status}
                    </span>
                  </div>

                  <div className="px-6 py-4">
                    <ul className="space-y-2">
                      {order.order_items.map((item: any) => (
                        <li key={item.id} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{item.name} × {item.quantity}</span>
                          <span className="text-foreground">{formatINR(item.price_inr * item.quantity)}</span>
                        </li>
                      ))}
                    </ul>
                    {order.discount_inr > 0 && (
                      <div className="mt-3 flex justify-between border-t border-border pt-3 text-sm text-primary">
                        <span>Discount{order.coupon_code ? ` (${order.coupon_code})` : ""}</span>
                        <span>−{formatINR(order.discount_inr)}</span>
                      </div>
                    )}
                    <div className="mt-4 flex items-center justify-between">
                      <span className={cn("text-xs font-medium", order.payment_status === "paid" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                        Payment: {order.payment_status}
                      </span>
                      <div className="flex items-center gap-1">
                        {canCancel && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => cancelMutation.mutate({ data: { orderId: order.id } })}
                            disabled={cancelMutation.isPending}
                          >
                            Cancel
                          </Button>
                        )}
                        <Button asChild variant="outline" size="sm">
                          <Link to="/orders/$orderId" params={{ orderId: order.id }}>View details</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
