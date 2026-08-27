import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Boxes, LayoutDashboard, Package, ShoppingCart, Ticket, Store, FolderTree, Star, Gift, Users, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin")({
  ssr: false,
  errorComponent: AdminError,
  pendingComponent: AdminLoading,
  component: AdminLayout,
});

function AdminError({ error }: { error: Error }) {
  return (
    <div className="container-luxe flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="font-serif text-2xl font-light">Couldn’t load the admin area</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {error?.message === "Load failed" || error?.message?.includes("fetch")
          ? "The connection dropped while loading this page."
          : error?.message || "Something went wrong."}
      </p>
      <Button onClick={() => window.location.reload()}>Try again</Button>
    </div>
  );
}

function AdminLoading() {
  return <div className="container-luxe flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">Loading admin area…</div>;
}

const navItems = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/products", label: "Products", icon: Package, exact: false },
  { to: "/admin/inventory", label: "Inventory", icon: Boxes, exact: false },
  { to: "/admin/categories", label: "Categories", icon: FolderTree, exact: false },
  { to: "/admin/orders", label: "Orders", icon: ShoppingCart, exact: false },
  { to: "/admin/customers", label: "Customers", icon: Users, exact: false },
  { to: "/admin/messages", label: "Messages", icon: Mail, exact: false },
  { to: "/admin/coupons", label: "Coupons", icon: Ticket, exact: false },
  { to: "/admin/reviews", label: "Reviews", icon: Star, exact: false },
  { to: "/admin/referrals", label: "Referrals", icon: Gift, exact: false },
];

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [access, setAccess] = useState<"checking" | "allowed" | "denied" | "error">("checking");

  useEffect(() => {
    let active = true;

    async function checkAccess() {
      setAccess("checking");
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        const user = sessionData.session?.user;
        if (!user) {
          navigate({ to: "/auth", search: { redirect: pathname }, replace: true });
          return;
        }

        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();
        if (error) throw error;
        if (active) setAccess(data ? "allowed" : "denied");
      } catch (error) {
        console.error("Unable to verify admin access", error);
        if (active) setAccess("error");
      }
    }

    void checkAccess();
    return () => {
      active = false;
    };
  }, [navigate, pathname]);

  if (access === "checking") return <AdminLoading />;
  if (access === "denied") {
    return (
      <div className="container-luxe flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <h1 className="font-serif text-2xl font-light">Admin access required</h1>
        <Button onClick={() => navigate({ to: "/", replace: true })}>Back to store</Button>
      </div>
    );
  }
  if (access === "error") {
    return (
      <div className="container-luxe flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <h1 className="font-serif text-2xl font-light">Couldn’t verify admin access</h1>
        <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
        <Button onClick={() => window.location.reload()}>Try again</Button>
      </div>
    );
  }

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
