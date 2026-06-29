"use client";

/**
 * Client-side access to the current tenant's city catalog.
 *
 * Server code reads `await getCities()` (a tenant-scoped DB read). Client
 * components can't await, so the root layout resolves the cities once on the
 * server and seeds them here; client components read them synchronously via
 * `useCities()`. This is the client successor to the build-inlined `CITIES`
 * from `cities.ts`.
 *
 * Fail-soft: the context default is `[]` and `useCities()` does NOT throw when
 * rendered outside a provider — non-tenant routes (build-time fallbacks, the
 * platform apex) safely get an empty list.
 */
import { createContext, type ReactNode, useContext } from "react";
import type { City } from "@/lib/cities";

const CitiesContext = createContext<City[]>([]);

export function CitiesProvider({ cities, children }: { cities: City[]; children: ReactNode }) {
  return <CitiesContext.Provider value={cities}>{children}</CitiesContext.Provider>;
}

/** The current tenant's cities (client). Returns `[]` outside a provider. */
export function useCities(): City[] {
  return useContext(CitiesContext);
}
