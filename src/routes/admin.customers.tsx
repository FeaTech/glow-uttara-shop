import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminListCustomers } from "@/lib/admin.functions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatINR } from "@/lib/format";
import { RangeFilter } from "@/components/admin/RangeFilter";
import { normalizeRange, rangeLabel, type RangeValue } from "@/lib/date-range";

export const Route = createFileRoute("/admin/customers")({
  head: () => ({ meta: [{ title: "Customers — Admin — FEA Glam" }] }),
  validateSearch: (search: Record<string, unknown>): { range?: RangeValue } => ({
    range: search.range ? normalizeRange(search.range as string) : undefined,
  }),
  component: AdminCustomers,
});

function AdminCustomers() {
  const range = normalizeRange(Route.useSearch().range);
  const navigate = useNavigate({ from: "/admin/customers" });

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "customers", range],
    queryFn: () => adminListCustomers({ data: { range } }),
    retry: false,
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-light text-foreground">Customers</h1>
          <p className="mt-1 text-muted-foreground">
            {data?.length ?? 0} customers joined · {rangeLabel(range)}
          </p>
        </div>
        <RangeFilter value={range} onChange={(v) => navigate({ search: { range: v } })} />
      </div>

      <div className="card-luxe mt-8 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Orders</TableHead>
              <TableHead>Spent</TableHead>
              <TableHead>Last order</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Loading…</TableCell>
              </TableRow>
            ) : !data?.length ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No customers in this period.
                </TableCell>
              </TableRow>
            ) : (
              data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-foreground">
                    {c.full_name || `Customer ${c.id.slice(0, 6).toUpperCase()}`}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.email && <span className="block text-sm">{c.email}</span>}
                    {c.phone && <span className="block text-xs">{c.phone}</span>}
                    {!c.email && !c.phone && <span className="text-sm">—</span>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(c.created_at)}</TableCell>
                  <TableCell>{c.orderCount}</TableCell>
                  <TableCell className="whitespace-nowrap font-medium">{formatINR(c.totalSpent)}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {c.lastOrderAt ? formatDate(c.lastOrderAt) : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
