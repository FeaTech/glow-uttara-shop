import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Previously unset (staleTime 0), so every navigation, remount and
        // window focus refetched every query — catalog, cart, orders, admin.
        // Mutations and realtime still invalidate explicitly, so data stays
        // correct; this only stops redundant refetches of fresh data.
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    // Was 0, which re-ran route loaders on every hover-preload and again on
    // click. Matching the query staleTime makes preloads actually reusable.
    defaultPreloadStaleTime: 60_000,
    defaultViewTransition: true,
  });

  return router;
};
