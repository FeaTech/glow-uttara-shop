import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShoppingBag, User, Menu, X, LogOut, Heart, Search, Package, LayoutDashboard, Gift } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCartCount } from "@/hooks/use-cart-count";
import { amIAdmin } from "@/lib/roles.functions";
import { getProfile } from "@/lib/profile.functions";
import { cn } from "@/lib/utils";
import logoUrl from "@/assets/feaglam-logo.png";

const navLinks = [
  { to: "/products", search: {}, label: "Shop" },
  { to: "/products", search: { category: "makeup" }, label: "Makeup" },
  { to: "/products", search: { category: "skincare" }, label: "Skincare" },
  { to: "/products", search: { category: "haircare" }, label: "Haircare" },
  { to: "/products", search: { category: "fragrances" }, label: "Fragrances" },
];

export function Header() {
  const [session, setSession] = useState<Session | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const cartCount = useCartCount();

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (mounted) setSession(newSession);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const user = session?.user ?? null;

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => getProfile({ data: undefined }),
    enabled: Boolean(user),
    retry: false,
    throwOnError: false,
    staleTime: 5 * 60_000,
  });
  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "there";

  const { data: adminData } = useQuery({
    queryKey: ["me", "admin"],
    queryFn: () => amIAdmin({ data: undefined }),
    enabled: Boolean(user),
    retry: false,
    throwOnError: false,
    staleTime: 5 * 60_000,
  });
  const isAdmin = adminData?.isAdmin ?? false;

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    setMobileOpen(false);
    navigate({ to: "/products", search: q ? { search: q } : {} });
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-all duration-300",
        scrolled ? "glass border-border shadow-sm" : "border-transparent bg-background",
      )}
    >
      <div className="container-luxe relative flex h-28 items-center justify-between gap-4 md:h-32">
        {/* Mobile menu toggle — absolute left on small screens */}
        <button
          className="absolute left-4 top-1/2 -translate-y-1/2 md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>

        {/* Logo — centered on mobile, left on desktop */}
        <Link
          to="/"
          className="mx-auto flex shrink-0 items-center gap-2 md:mx-0"
          aria-label="FEA Glam home"
        >
          <img src={logoUrl} alt="FEA Glam" className="h-24 w-auto md:h-28" />
        </Link>

        {/* Desktop nav */}
        <nav className="ml-2 hidden items-center gap-7 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              search={link.search}
              className="group relative text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
              <span className="absolute -bottom-1 left-0 h-px w-0 bg-primary transition-all duration-300 group-hover:w-full" />
            </Link>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("fea-glam:search"))}
          className="ml-auto hidden max-w-xs flex-1 items-center gap-2 rounded-full border border-input bg-background/60 py-2 pl-3 pr-2 text-left text-sm text-muted-foreground transition-colors hover:border-primary md:flex"
          aria-label="Search"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">Search products…</span>
          <kbd className="hidden rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] lg:inline">⌘K</kbd>
        </button>

        {/* Action icons — absolute right on mobile, normal flow on desktop */}
        <div className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-1 md:static md:translate-y-0 md:ml-auto">
          <Link to="/wishlist" className="hidden sm:block">
            <Button variant="ghost" size="icon" aria-label="Wishlist">
              <Heart className="h-5 w-5" />
            </Button>
          </Link>

          <Link to="/cart" className="relative">
            <Button variant="ghost" size="icon" aria-label="Cart">
              <ShoppingBag className="h-5 w-5" />
            </Button>
            {cartCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" aria-label="Account" className="hidden h-10 gap-2 px-2 md:inline-flex">
                  <User className="h-5 w-5" />
                  <span className="hidden max-w-40 truncate text-sm font-medium lg:inline">Welcome, {displayName}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile"><User className="mr-2 h-4 w-4" />Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/orders"><Package className="mr-2 h-4 w-4" />My orders</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/wishlist"><Heart className="mr-2 h-4 w-4" />Wishlist</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/referrals"><Gift className="mr-2 h-4 w-4" />Refer &amp; Earn</Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/admin"><LayoutDashboard className="mr-2 h-4 w-4" />Admin</Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/auth" className="hidden md:block">
              <Button size="sm" className="btn-gold">Sign in</Button>
            </Link>
          )}
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-border bg-background px-4 py-4 md:hidden">
          <form onSubmit={submitSearch} className="mb-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products…"
                className="w-full rounded-full border border-input bg-background py-2 pl-9 pr-4 text-sm outline-none focus:border-primary"
              />
            </div>
          </form>
          <nav className="flex flex-col gap-3">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                search={link.search}
                className="text-base font-medium text-muted-foreground hover:text-foreground"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <hr className="border-border" />
            <Link to="/wishlist" onClick={() => setMobileOpen(false)} className="text-base font-medium">Wishlist</Link>
            {user ? (
              <>
                <Link to="/profile" onClick={() => setMobileOpen(false)} className="text-base font-medium">Profile</Link>
                <Link to="/orders" onClick={() => setMobileOpen(false)} className="text-base font-medium">My orders</Link>
                <Link to="/referrals" onClick={() => setMobileOpen(false)} className="text-base font-medium">Refer &amp; Earn</Link>
                {isAdmin && (
                  <Link to="/admin" onClick={() => setMobileOpen(false)} className="text-base font-medium text-primary">Admin dashboard</Link>
                )}
                <button onClick={handleSignOut} className="text-left text-base font-medium text-muted-foreground">Sign out</button>
              </>
            ) : (
              <Link to="/auth" onClick={() => setMobileOpen(false)} className="text-base font-medium text-primary">Sign in</Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
