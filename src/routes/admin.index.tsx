import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { IndianRupee, ShoppingCart, Package, Users, AlertTriangle } from "lucide-react";
import { adminStats } from "@/lib/admin.functions";
import { formatINR } from "@/lib/format";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin dashboard — FEA Glam" }] }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => adminStats({ data: undefined }),
    retry: false,
  });

  const cards = [
    { label: "Revenue", value: data ? formatINR(data.revenue) : "—", icon: IndianRupee },
    { label: "Orders", value: data?.orderCount ?? "—", icon: ShoppingCart, hint: data ? `${data.pendingCount} pending` : undefined },
    { label: "Products", value: data?.productCount ?? "—", icon: Package },
    { label: "Customers", value: data?.customerCount ?? "—", icon: Users },
  ];

  return (
    <div>
      <h1 className="font-serif text-3xl font-light text-foreground">Dashboard</h1>
      <p className="mt-1 text-muted-foreground">Store performance at a glance.</p>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card-luxe p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{c.label}</span>
              <c.icon className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 font-serif text-2xl font-medium text-foreground">
              {isLoading ? <span className="inline-block h-6 w-20 rounded skeleton-luxe" /> : c.value}
            </p>
            {c.hint && <p className="mt-1 text-xs text-muted-foreground">{c.hint}</p>}
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="card-luxe p-6 lg:col-span-2">
          <h2 className="font-heading text-lg font-medium text-foreground">Revenue · last 7 days</h2>
          <div className="mt-4 h-64">
            {data && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.revenueByDay} margin={{ left: -12, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} width={48} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.5rem",
                      color: "var(--popover-foreground)",
                      fontSize: "12px",
                    }}
                    formatter={(value: number) => [formatINR(value), "Revenue"]}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="var(--primary)" strokeWidth={2} fill="url(#rev)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card-luxe p-6">
          <h2 className="flex items-center gap-2 font-heading text-lg font-medium text-foreground">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Low stock
          </h2>
          <div className="mt-4 space-y-3">
            {data?.lowStock.length ? (
              data.lowStock.map((p) => (
                <Link key={p.id} to="/products/$slug" params={{ slug: p.slug }} className="flex items-center justify-between text-sm hover:text-primary">
                  <span className="truncate text-foreground">{p.name}</span>
                  <span className={p.stock === 0 ? "font-semibold text-destructive" : "text-muted-foreground"}>{p.stock} left</span>
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">All products well stocked.</p>
            )}
          </div>
          <Link to="/admin/inventory" className="mt-4 inline-block text-xs font-medium text-primary hover:underline">
            Manage inventory →
          </Link>
        </div>
      </div>
    </div>
  );
}
