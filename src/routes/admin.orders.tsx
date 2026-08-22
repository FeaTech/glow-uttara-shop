import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useEffect, useState } from "react";
import { Printer, Search, X } from "lucide-react";
import { adminListOrders, adminUpdateOrder } from "@/lib/admin.functions";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate, formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { RangeFilter } from "@/components/admin/RangeFilter";
import { normalizeRange, rangeLabel, type RangeValue } from "@/lib/date-range";
import { OrderInvoice } from "@/components/OrderInvoice";

type OrdersSearch = {
  range?: RangeValue;
  q?: string;
  status?: string;
  payment?: string;
  method?: string;
  sortBy?: string;
};

export const Route = createFileRoute("/admin/orders")({
  head: () => ({ meta: [{ title: "Orders — Admin — FEA Glam" }] }),
  validateSearch: (search: Record<string, unknown>): OrdersSearch => ({
    range: search.range ? normalizeRange(search.range as string) : undefined,
    q: search.q ? String(search.q).slice(0, 120) : undefined,
    status: search.status ? String(search.status) : undefined,
    payment: search.payment ? String(search.payment) : undefined,
    method: search.method ? String(search.method) : undefined,
    sortBy: search.sortBy ? String(search.sortBy) : undefined,
  }),
  component: AdminOrders,
});

const ORDER_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"] as const;
const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"] as const;
const PAYMENT_METHODS = [
  { value: "online", label: "Online (Razorpay)" },
  { value: "cod", label: "Cash on delivery" },
] as const;
const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "highest", label: "Highest value" },
  { value: "lowest", label: "Lowest value" },
] as const;

const STATUS_DOT: Record<string, string> = {
  pending: "bg-amber-500",
  processing: "bg-blue-500",
  shipped: "bg-violet-500",
  delivered: "bg-emerald-500",
  cancelled: "bg-rose-500",
};

const PAGE_SIZE = 25;
const ALL = "all";

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

function AdminOrders() {
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const range = normalizeRange(search.range);
  const navigate = useNavigate({ from: "/admin/orders" });
  const [page, setPage] = useState(0);

  const q = search.q?.trim() || "";
  const status = oneOf(search.status, ORDER_STATUSES);
  const payment = oneOf(search.payment, PAYMENT_STATUSES);
  const method = oneOf(search.method, PAYMENT_METHODS.map((m) => m.value));
  const sort = oneOf(search.sortBy, SORTS.map((s) => s.value)) ?? "newest";

  // Debounced search box: type freely, URL updates once typing settles.
  const [term, setTerm] = useState(q);
  useEffect(() => setTerm(q), [q]);
  useEffect(() => {
    if (term.trim() === q) return;
    const t = setTimeout(() => {
      setPage(0);
      navigate({ search: (prev: OrdersSearch) => ({ ...prev, q: term.trim() || undefined }) });
    }, 300);
    return () => clearTimeout(t);
  }, [term, q, navigate]);

  const setFilter = (patch: Partial<OrdersSearch>) => {
    setPage(0);
    navigate({ search: (prev: OrdersSearch) => ({ ...prev, ...patch }) });
  };

  const filtersActive = Boolean(q || status || payment || method || (search.sortBy && sort !== "newest"));

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin", "orders", page, range, q, status, payment, method, sort],
    queryFn: () =>
      adminListOrders({
        data: {
          page,
          pageSize: PAGE_SIZE,
          range,
          q: q || undefined,
          status,
          paymentStatus: payment,
          paymentMethod: method,
          sort,
        },
      }),
    placeholderData: keepPreviousData,
    retry: false,
  });
  const orders = data?.orders;
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const [expanded, setExpanded] = useState<string | null>(null);
  const [printOrder, setPrintOrder] = useState<any | null>(null);
  const updateFn = useServerFn(adminUpdateOrder);

  // Render the invoice first, then hand off to the browser's print dialog.
  useEffect(() => {
    if (!printOrder) return;
    const id = window.setTimeout(() => {
      window.print();
      setPrintOrder(null);
    }, 60);
    return () => window.clearTimeout(id);
  }, [printOrder]);

  // New orders and status changes appear without a refresh.
  useRealtimeInvalidate({
    channel: "admin-orders",
    table: "orders",
    invalidate: [["admin", "orders"], ["admin", "stats"]],
  });

  const mutation = useMutation({
    mutationFn: updateFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      toast.success("Order updated");
    },
    onError: (err: any) => toast.error(err?.message ?? "Update failed"),
  });

  const clearAll = () => {
    setPage(0);
    setTerm("");
    navigate({ search: { range } });
  };

  const chips = [
    q && { key: "q", label: `Search: ${q}`, clear: () => setFilter({ q: undefined }) },
    status && { key: "status", label: `Status: ${status}`, clear: () => setFilter({ status: undefined }) },
    payment && { key: "payment", label: `Payment: ${payment}`, clear: () => setFilter({ payment: undefined }) },
    method && {
      key: "method",
      label: `Method: ${PAYMENT_METHODS.find((m) => m.value === method)?.label}`,
      clear: () => setFilter({ method: undefined }),
    },
    sort !== "newest" && {
      key: "sort",
      label: `Sort: ${SORTS.find((s) => s.value === sort)?.label}`,
      clear: () => setFilter({ sortBy: undefined }),
    },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-light text-foreground">Orders</h1>
          <p className="mt-1 text-muted-foreground">
            {total} {filtersActive ? "matching orders" : "orders"} · {rangeLabel(range)} · update fulfilment &amp; payment status
          </p>
        </div>
        <RangeFilter
          value={range}
          onChange={(v) => {
            setPage(0);
            navigate({ search: (prev: OrdersSearch) => ({ ...prev, range: v }) });
          }}
        />
      </div>

      <div className="card-luxe mt-6 flex flex-wrap items-center gap-3 p-4">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search order no., customer, email or coupon"
            aria-label="Search orders"
            className="pl-9"
          />
        </div>
        <Select value={status ?? ALL} onValueChange={(v) => setFilter({ status: v === ALL ? undefined : v })}>
          <SelectTrigger className="h-10 w-40 capitalize" aria-label="Filter by order status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {ORDER_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={payment ?? ALL} onValueChange={(v) => setFilter({ payment: v === ALL ? undefined : v })}>
          <SelectTrigger className="h-10 w-40 capitalize" aria-label="Filter by payment status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All payments</SelectItem>
            {PAYMENT_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={method ?? ALL} onValueChange={(v) => setFilter({ method: v === ALL ? undefined : v })}>
          <SelectTrigger className="h-10 w-44" aria-label="Filter by payment method"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All methods</SelectItem>
            {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setFilter({ sortBy: v === "newest" ? undefined : v })}>
          <SelectTrigger className="h-10 w-44" aria-label="Sort orders"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SORTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={clearAll}>Clear all</Button>
        )}
      </div>

      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              key={c.key}
              onClick={c.clear}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs capitalize text-muted-foreground transition hover:text-foreground"
            >
              {c.label}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}


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
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  {filtersActive ? (
                    <>
                      No orders match these filters.{" "}
                      <button onClick={clearAll} className="text-primary underline underline-offset-4">Clear filters</button>
                    </>
                  ) : (
                    "No orders yet."
                  )}
                </TableCell>
              </TableRow>

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
                      <span className="block">
                        {o.profiles?.full_name || o.profiles?.email || o.customer_email || `Customer ${o.user_id.slice(0, 6).toUpperCase()}`}
                      </span>
                      {o.profiles?.email && (
                        <span className="block text-xs">{o.profiles.email}</span>
                      )}
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
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium uppercase text-muted-foreground">
                          {o.payment_method === "online" ? "Online" : "COD"}
                        </span>
                        <Select value={o.payment_status} onValueChange={(v) => mutation.mutate({ data: { orderId: o.id, paymentStatus: v as any } })}>
                          <SelectTrigger className="h-8 w-28 capitalize"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PAYMENT_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
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
                                  <span className="text-muted-foreground">
                                    {it.name}{it.variant_name ? ` — ${it.variant_name}` : ""} × {it.quantity}
                                  </span>
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
                            {(o.taxes_inr ?? 0) > 0 && (
                              <p className="mt-2 flex justify-between text-sm text-muted-foreground">
                                <span>Estimated taxes</span>
                                <span>{formatINR(o.taxes_inr)}</span>
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
                            <Button variant="outline" size="sm" className="mt-3" onClick={() => setPrintOrder(o)}>
                              <Printer className="h-4 w-4" /> Print invoice
                            </Button>
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

      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page + 1} of {pageCount}
            {isFetching && <span className="ml-2 opacity-60">updating…</span>}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
      {printOrder && <OrderInvoice order={printOrder} customerName={printOrder.customer_name ?? printOrder.customer_email} />}
    </div>
  );
}
