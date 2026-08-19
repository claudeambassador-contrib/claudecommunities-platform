import { createRouter } from "@tanstack/react-router";
import { RouteError, RouteNotFound, RoutePending } from "@/shared/ui/route-fallbacks";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    defaultErrorComponent: RouteError,
    defaultNotFoundComponent: RouteNotFound,
    defaultPendingComponent: RoutePending,
    // Show the pending fallback only after 300ms, and once shown keep it for
    // at least 200ms — fast navigations never flash it.
    defaultPendingMinMs: 200,
    defaultPendingMs: 300,
    defaultPreload: "intent",
    // Loader results are fresh for 15s by default (admin lists included —
    // mutations call router.invalidate(), which bypasses staleTime). Public
    // read-heavy routes override with longer per-route staleTime.
    defaultStaleTime: 15_000,
    routeTree,
    scrollRestoration: true,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
