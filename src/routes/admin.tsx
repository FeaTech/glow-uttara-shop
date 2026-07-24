import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Package, ShoppingCart, Ticket, Store, FolderTree } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { amIAdmin } from "@/lib/roles.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
    const res = await amIAdmin({ data: undefined });
    if (!res.isAdmin) {
      throw redirect({ to: "/" });
    }
    return { user: data.user };
  },
  component: AdminLayout,
});

const navItems = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/products", label: "Products", icon: Package, exact: false },
  { to: "/admin/categories", label: "Categories", icon: FolderTree, exact: false },
  { to: "/admin/orders", label: "Orders", icon: ShoppingCart, exact: false },
  { to: "/admin/coupons", label: "Coupons", icon: Ticket, exact: false },
];

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-secondary/20">
      <div className="container-luxe grid gap-8 py-8 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="mb-4 flex items-center gap-2 px-2">
            <span className="font-heading text-xl font-semibold">Admin</span>
          </div>
          <nav className="flex gap-1 overflow-x-auto lg:flex-col">
            {navItems.map(({ to, label, icon: Icon, exact }) => {
              const active = exact ? pathname === to : pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
            <Link
              to="/"
              className="mt-2 flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary"
            >
              <Store className="h-4 w-4" />
              Back to store
            </Link>
          </nav>
        </aside>

        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
