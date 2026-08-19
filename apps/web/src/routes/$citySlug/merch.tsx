import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { loadCityPage } from "@/shared/http/cityPage";
import { getRegionConfig } from "@/shared/region";
import { EmptyCard, PageHeader } from "@/shared/ui/page";
import { ShopifyCollection } from "@/shared/ui/shopify-collection";

const load = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    await loadCityPage(data.citySlug);
    const region = getRegionConfig();
    return { merchEnabled: region.merchEnabled, siteName: region.siteName };
  });

export const Route = createFileRoute("/$citySlug/merch")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug } }),
  component: Page,
});

function Page() {
  const { merchEnabled, siteName } = Route.useLoaderData();

  return (
    <section className="stack">
      <PageHeader subtitle={`Official ${siteName} shirts and extras.`} title="Merch store" />
      {merchEnabled ? (
        <div className="card">
          <ShopifyCollection />
        </div>
      ) : (
        <EmptyCard>Merch is not enabled for this region.</EmptyCard>
      )}
    </section>
  );
}
