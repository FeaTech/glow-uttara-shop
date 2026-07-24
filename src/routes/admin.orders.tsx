import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useState } from "react";
import { adminListOrders, adminUpdateOrder } from "@/lib/admin.functions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatDate, formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/orders")({
  head: () => ({ meta: [{ title: "Orders — Admin — FEALuxy" }] }),
  component: AdminOrders,
});

const ORDER_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"] as const;
const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"] as const;

const STATUS_DOT: Record<string, string> = {
  pending: "bg-amber-500",
  processing: "bg-blue-500",
  shipped: "bg-violet-500",
  delivered: "bg-emerald-500",
  cancelled: "bg-rose-500",
};

function AdminOrders() {
  const queryClient = useQueryClient();
  const { data: orders, isLoading } = useQuery({
    queryKey: ["admin", "orders"],
    queryFn: () => adminListOrders({ data: undefined }),
    retry: false,
  });
  const [expanded, setExpanded] = useState<string | null>(null);
  const updateFn = useServerFn(adminUpdateOrder);

  const mutation = useMutation({
    mutationFn: updateFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      toast.success("Order updated");
    },
    onError: (err: any) => toast.error(err?.message ?? "Update failed"),
  });

  return (
    <div>
      <h1 className="font-serif text-3xl font-light text-foreground">Orders</h1>
      <p className="mt-1 text-muted-foreground">{orders?.length ?? 0} orders · update fulfilment &amp; payment status</p>

      <div className="card-luxe mt-8 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : !orders?.length ? (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No orders yet.</TableCell></TableRow>
            ) : (
              orders.map((o: any) => (
                <Fragment key={o.id}>
                  <TableRow className="cursor-pointer" onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
                    <TableCell>
                      <span className="inline-flex items-center gap-2 font-medium text-foreground">
                        <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[o.status])} />
                        #{o.id.slice(0, 8).toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {o.profiles?.full_name || "Guest"}
                      {o.profiles?.phone && <span className="block text-xs">{o.profiles.phone}</span>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(o.created_at)}</TableCell>
                    <TableCell className="whitespace-nowrap font-medium">{formatINR(o.total_inr)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select value={o.status} onValueChange={(v) => mutation.mutate({ data: { orderId: o.id, status: v as any } })}>
                        <SelectTrigger className="h-8 w-32 capitalize"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ORDER_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select value={o.payment_status} onValueChange={(v) => mutation.mutate({ data: { orderId: o.id, paymentStatus: v as any } })}>
                        <SelectTrigger className="h-8 w-28 capitalize"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PAYMENT_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                  {expanded === o.id && (
                    <TableRow>
                      <TableCell colSpan={6} className="bg-secondary/30">
                        <div className="grid gap-6 py-2 sm:grid-cols-2">
                          <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Items</p>
                            <ul className="space-y-1 text-sm">
                              {o.order_items.map((it: any) => (
                                <li key={it.id} className="flex justify-between">
                                  <span className="text-muted-foreground">{it.name} × {it.quantity}</span>
                                  <span>{formatINR(it.price_inr * it.quantity)}</span>
                                </li>
                              ))}
                            </ul>
                            {o.discount_inr > 0 && (
                              <p className="mt-2 flex justify-between text-sm text-primary">
                                <span>Discount {o.coupon_code ? `(${o.coupon_code})` : ""}</span>
                                <span>−{formatINR(o.discount_inr)}</span>
                              </p>
                            )}
                          </div>
                          <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Shipping address</p>
                            <address className="text-sm not-italic text-muted-foreground">
                              {o.shipping_address?.line1}{o.shipping_address?.line2 ? `, ${o.shipping_address.line2}` : ""}<br />
                              {o.shipping_address?.city}, {o.shipping_address?.state} — {o.shipping_address?.pincode}<br />
                              {o.shipping_address?.country}
                            </address>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
