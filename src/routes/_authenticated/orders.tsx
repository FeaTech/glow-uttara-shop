import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getOrders } from "@/lib/orders.functions";
import { Badge } from "@/components/ui/badge";

const ordersQueryOptions = () =>
  queryOptions({
    queryKey: ["orders"],
    queryFn: () => getOrders({ data: undefined }),
  });

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({
    meta: [
      { title: "My orders — FEALuxy" },
      { name: "description", content: "View your order history at FEALuxy." },
      { property: "og:title", content: "My orders — FEALuxy" },
      { property: "og:description", content: "View your order history at FEALuxy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(ordersQueryOptions()),
  component: OrdersPage,
});

function OrdersPage() {
  const { data: orders } = useSuspenseQuery(ordersQueryOptions());

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="font-serif text-3xl font-light text-foreground">My orders</h1>
        {orders.length === 0 ? (
          <div className="mt-10 rounded-2xl bg-secondary/30 py-20 text-center">
            <p className="text-muted-foreground">You haven't placed any orders yet.</p>
            <Link to="/products" className="mt-4 inline-block text-primary hover:underline">
              Start shopping
            </Link>
          </div>
        ) : (
          <div className="mt-10 space-y-6">
            {orders.map((order) => (
              <div key={order.id} className="card-luxe p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Order #{order.id.slice(0, 8)}</p>
                    <p className="mt-1 font-medium text-foreground">
                      {new Date(order.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-foreground">₹{order.total_inr.toLocaleString("en-IN")}</p>
                    <Badge variant={order.status === "delivered" ? "default" : "secondary"}>{order.status}</Badge>
                  </div>
                </div>
                <div className="mt-4 border-t pt-4">
                  <ul className="space-y-2">
                    {order.order_items.map((item: any) => (
                      <li key={item.id} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {item.name} × {item.quantity}
                        </span>
                        <span className="text-foreground">₹{(item.price_inr * item.quantity).toLocaleString("en-IN")}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
