import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // getSession() reads the cached session from local storage (refreshing the
    // token only when it has actually expired). The previous getUser() call hit
    // the Supabase Auth API over the network on EVERY navigation into an
    // authenticated route — cart, checkout, orders, profile, wishlist — and
    // blocked rendering until it came back.
    //
    // This guard is only a UX redirect: real enforcement is server-side, where
    // requireSupabaseAuth verifies the JWT and RLS scopes every row. A stale
    // client-side session therefore cannot grant access to any data.
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
    return { user: data.session.user };
  },
  component: () => <Outlet />,
});
