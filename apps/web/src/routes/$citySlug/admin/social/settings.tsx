import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type FormEvent, useCallback, useState } from "react";
import { connectAccount, listAccounts } from "@/modules/social/services/socialService";
import type { ConnectorId, SocialPlatform } from "@/modules/social/types";
import { loadCityPage } from "@/shared/http/cityPage";
import { Can } from "@/shared/ui/can";
import { DeniedCard, ItemList, PageHeader } from "@/shared/ui/page";

const loadAccounts = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { allowed: false as const, reason: "unauthenticated" };
    }
    const result = await listAccounts(page.store, page.actor);
    if (!result.ok) {
      return { allowed: false as const, reason: result.error.code };
    }
    return {
      allowed: true as const,
      accounts: result.accounts.map((account) => ({
        detail: [account.platform, account.connector].join(" · "),
        id: account.id,
        title: account.displayName,
      })),
    };
  });

const submitAccount = createServerFn({ method: "POST" })
  .validator(
    (d: {
      accountType: "organization" | "person";
      citySlug: string;
      connector: ConnectorId;
      displayName: string;
      externalId: string;
      platform: SocialPlatform;
    }) => d,
  )
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { error: "unauthenticated", ok: false as const };
    }
    const result = await connectAccount(page.store, page.actor, {
      accountType: data.accountType,
      connector: data.connector,
      displayName: data.displayName,
      externalId: data.externalId,
      platform: data.platform,
    });
    if (!result.ok) {
      return { error: result.error.message ?? result.error.code, ok: false as const };
    }
    return { ok: true as const };
  });

export const Route = createFileRoute("/$citySlug/admin/social/settings")({
  loader: ({ params }) => loadAccounts({ data: { citySlug: params.citySlug } }),
  component: SocialSettingsPage,
});

function SocialSettingsPage() {
  const { citySlug } = Route.useParams();
  const data = Route.useLoaderData();

  if (!data.allowed) {
    return <DeniedCard reason={data.reason} title="Social settings" />;
  }

  return (
    <section className="stack">
      <PageHeader
        subtitle="Manual catalog row for dev/staging — not a live OAuth grant."
        title="Social settings"
      />
      <Can permission="social.manage">
        <ConnectForm citySlug={citySlug} />
      </Can>
      <ItemList empty="No connected accounts." items={data.accounts} />
    </section>
  );
}

function ConnectForm({ citySlug }: { citySlug: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const fd = new FormData(form);
      const result = await submitAccount({
        data: {
          accountType: fd.get("accountType") === "person" ? "person" : "organization",
          citySlug,
          connector: fd.get("connector") === "zernio" ? "zernio" : "linkedin",
          displayName: String(fd.get("displayName") ?? ""),
          externalId: String(fd.get("externalId") ?? ""),
          platform: "linkedin",
        },
      });
      if (result.ok) {
        form.reset();
        setStatus("Account connected.");
        await router.invalidate();
        return;
      }
      setStatus(result.error);
    },
    [citySlug, router],
  );

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <input className="field" name="displayName" placeholder="Display name" required />
      <select className="field" defaultValue="linkedin" name="platform" required>
        <option value="linkedin">linkedin</option>
      </select>
      <select className="field" defaultValue="linkedin" name="connector" required>
        <option value="linkedin">linkedin</option>
        <option value="zernio">zernio</option>
      </select>
      <input className="field" name="externalId" placeholder="External ID" required />
      <select className="field" defaultValue="organization" name="accountType">
        <option value="organization">organization</option>
        <option value="person">person</option>
      </select>
      {status ? <p className="muted">{status}</p> : null}
      <button className="btn btn-primary" type="submit">
        Connect account
      </button>
    </form>
  );
}
