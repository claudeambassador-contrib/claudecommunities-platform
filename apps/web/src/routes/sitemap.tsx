import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { listPublicTenants } from "@/modules/tenants/services/publicListService";
import { loadRegistryPage } from "@/shared/http/registryPage";
import { getRegionConfig } from "@/shared/region";

const getSitemap = createServerFn({ method: "GET" }).handler(async () => {
  const { registry } = await loadRegistryPage();
  const list = await listPublicTenants(registry.db);
  return { tenants: list.ok ? list.tenants : [] };
});

export const Route = createFileRoute("/sitemap")({
  loader: () => getSitemap(),
  component: SitemapPage,
  head: () => ({
    meta: [
      { title: "Sitemap" },
      { name: "description", content: `Browse pages on ${getRegionConfig().siteName}.` },
    ],
  }),
});

function SitemapPage(): ReactElement {
  const { tenants } = Route.useLoaderData();
  const platform = [
    { href: "/", label: "Home" },
    { href: "/pricing", label: "Pricing" },
    { href: "/login", label: "Sign in" },
    { href: "/signup", label: "Sign up" },
  ];

  return (
    <main className="shell stack">
      <h1 className="m-0">Sitemap</h1>
      <section className="card stack">
        <strong>Platform</strong>
        {platform.map((item) => (
          <a href={item.href} key={item.href}>
            {item.label}
          </a>
        ))}
      </section>
      <section className="card stack">
        <strong>Cities</strong>
        {tenants.length === 0 ? (
          <p className="muted m-0">No cities provisioned yet.</p>
        ) : (
          tenants.map((t) => (
            <Link key={t.slug} params={{ citySlug: t.slug }} to="/$citySlug">
              {t.name}
            </Link>
          ))
        )}
      </section>
    </main>
  );
}
