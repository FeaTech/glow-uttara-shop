import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { adminGetCustomerDetails, adminListCustomers } from "@/lib/admin.functions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatINR } from "@/lib/format";
import { RangeFilter } from "@/components/admin/RangeFilter";
import { normalizeRange, rangeLabel, type RangeValue } from "@/lib/date-range";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/admin/customers")({
  head: () => ({ meta: [{ title: "Customers — Admin — FEA Glam" }] }),
  validateSearch: (search: Record<string, unknown>): { range?: RangeValue } => ({ range: search.range ? normalizeRange(search.range as string) : undefined }),
  component: AdminCustomers,
});

function AdminCustomers() {
  const range = normalizeRange(Route.useSearch().range);
  const navigate = useNavigate({ from: "/admin/customers" });
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "customers", range], queryFn: () => adminListCustomers({ data: { range } }), retry: false });
  const { data: customerDetails, isLoading: isDetailsLoading } = useQuery({
    queryKey: ["admin", "customer", selectedCustomerId],
    queryFn: () => adminGetCustomerDetails({ data: { customerId: selectedCustomerId! } }),
    enabled: Boolean(selectedCustomerId),
    retry: false,
  });
  const selectedCustomer = data?.find((customer) => customer.id === selectedCustomerId);

  return <div>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="font-serif text-3xl font-light text-foreground">Customers</h1><p className="mt-1 text-muted-foreground">{data?.length ?? 0} customers joined · {rangeLabel(range)}</p></div><RangeFilter value={range} onChange={(v) => navigate({ search: { range: v } })} /></div>
    <div className="card-luxe mt-8 overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Contact</TableHead><TableHead>Joined</TableHead><TableHead>Orders</TableHead><TableHead>Spent</TableHead><TableHead>Last order</TableHead></TableRow></TableHeader><TableBody>
      {isLoading ? <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow> : !data?.length ? <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No customers in this period.</TableCell></TableRow> : data.map((c) => <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedCustomerId(c.id)}><TableCell className="font-medium text-foreground">{c.full_name || `Customer ${c.id.slice(0, 6).toUpperCase()}`}</TableCell><TableCell className="text-muted-foreground">{c.email && <span className="block text-sm">{c.email}</span>}{c.phone && <span className="block text-xs">{c.phone}</span>}{!c.email && !c.phone && <span className="text-sm">—</span>}</TableCell><TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(c.created_at)}</TableCell><TableCell>{c.orderCount}</TableCell><TableCell className="whitespace-nowrap font-medium">{formatINR(c.totalSpent)}</TableCell><TableCell className="whitespace-nowrap text-muted-foreground">{c.lastOrderAt ? formatDate(c.lastOrderAt) : "—"}</TableCell></TableRow>)}
    </TableBody></Table></div>
    <Dialog open={Boolean(selectedCustomerId)} onOpenChange={(open) => !open && setSelectedCustomerId(null)}><DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>{selectedCustomer?.full_name || "Customer details"}</DialogTitle><DialogDescription>Complete customer profile, addresses, and order history.</DialogDescription></DialogHeader>
      {isDetailsLoading ? <p className="py-8 text-center text-muted-foreground">Loading customer details…</p> : customerDetails ? <div className="space-y-6 text-sm"><section className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2"><Detail label="Full name" value={customerDetails.profile?.full_name || selectedCustomer?.full_name || "—"} /><Detail label="Email" value={customerDetails.email || selectedCustomer?.email || "—"} /><Detail label="Phone" value={customerDetails.profile?.phone || selectedCustomer?.phone || "—"} /><Detail label="Joined" value={customerDetails.profile?.created_at ? formatDate(customerDetails.profile.created_at) : "—"} /><Detail label="Customer ID" value={customerDetails.profile?.id || selectedCustomerId || "—"} /></section><section><h2 className="mb-3 font-serif text-xl">Saved addresses</h2>{!customerDetails.addresses.length ? <p className="text-muted-foreground">No saved addresses.</p> : <div className="grid gap-3 sm:grid-cols-2">{customerDetails.addresses.map((address) => <div key={address.id} className="rounded-lg border p-4"><div className="mb-2 flex items-center justify-between gap-2 font-medium"><span>{address.label}</span>{address.is_default && <Badge variant="secondary">Default</Badge>}</div><p className="text-muted-foreground">{address.line1}{address.line2 ? `, ${address.line2}` : ""}</p><p className="text-muted-foreground">{address.city}, {address.state} {address.pincode}</p><p className="text-muted-foreground">{address.country}</p></div>)}</div>}</section><Separator /><section><h2 className="mb-3 font-serif text-xl">Orders ({customerDetails.orders.length})</h2>{!customerDetails.orders.length ? <p className="text-muted-foreground">No orders yet.</p> : <div className="space-y-3">{customerDetails.orders.map((order) => <div key={order.id} className="rounded-lg border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">Order #{order.id.slice(0, 8).toUpperCase()}</span><span className="text-muted-foreground">{formatDate(order.created_at)}</span></div><div className="mt-2 flex flex-wrap gap-2"><Badge variant="outline">{order.status}</Badge><Badge variant="outline">Payment: {order.payment_status}</Badge><span className="font-medium">{formatINR(order.total_inr)}</span></div>{!!order.order_items?.length && <p className="mt-2 text-muted-foreground">{order.order_items.map((item) => `${item.name} × ${item.quantity}`).join(", ")}</p>}</div>)}</div>}</section></div> : <p className="py-8 text-center text-muted-foreground">Unable to load this customer.</p>}
    </DialogContent></Dialog>
  </div>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1 break-all text-foreground">{value}</dd></div>; }
