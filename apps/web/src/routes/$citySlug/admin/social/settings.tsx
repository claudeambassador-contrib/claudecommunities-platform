import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";
import { connectAccount, listAccounts } from "@/modules/social/services/socialService";
import { ok } from "@/shared/http/errors";
import { guarded, guardedMutation } from "@/shared/http/guarded";
import { Can } from "@/shared/ui/can";
import { DeniedCard, ItemList, PageHeader } from "@/shared/ui/page";
import { formString, useFormSubmit } from "@/shared/ui/use-form-submit";

const loadAccountsInput = z.object({ citySlug: z.string().min(1) });

const loadAccounts = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadAccountsInput.parse(input))
  .handler(({ data }) =>
    guarded(data.citySlug, "social.view", async (page) => {
      const result = await listAccounts(page.store, page.actor);
      if (!result.ok) {
        return result;
      }
      return ok({
        accounts: result.accounts.map((account) => ({
          detail: [account.platform, account.connector].join(" · "),
          id: account.id,
          title: account.displayName,
        })),
      });
    }),
  );

const submitAccountInput = z.object({
  accountType: z.enum(["organization", "person"]),
  citySlug: z.string().min(1),
  connector: z.enum(["linkedin", "zernio"]),
  displayName: z.string(),
  externalId: z.string(),
  platform: z.enum(["linkedin"]),
});

const submitAccount = createServerFn({ method: "POST" })
  .validator((input: unknown) => submitAccountInput.parse(input))
  .handler(({ data }) =>
    guardedMutation(data.citySlug, "social.manage", (page) =>
      connectAccount(page.store, page.actor, {
        accountType: data.accountType,
        connector: data.connector,
        displayName: data.displayName,
        externalId: data.externalId,
        platform: data.platform,
      }),
    ),
  );

export const Route = createFileRoute("/$citySlug/admin/social/settings")({
  loader: ({ params }) => loadAccounts({ data: { citySlug: params.citySlug } }),
  component: SocialSettingsPage,
});

function SocialSettingsPage(): ReactElement {
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

function ConnectForm({ citySlug }: { citySlug: string }): ReactElement {
  const { error, handleSubmit, pending, success } = useFormSubmit({
    resetOnSuccess: true,
    submit: (fd) =>
      submitAccount({
        data: {
          accountType: fd.get("accountType") === "person" ? "person" : "organization",
          citySlug,
          connector: fd.get("connector") === "zernio" ? "zernio" : "linkedin",
          displayName: formString(fd, "displayName"),
          externalId: formString(fd, "externalId"),
          platform: "linkedin",
        },
      }),
    successMessage: "Account connected.",
  });

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <label className="field-label">
        Display name
        <input className="field" name="displayName" placeholder="Display name" required />
      </label>
      <label className="field-label">
        Platform
        <select className="field" defaultValue="linkedin" name="platform" required>
          <option value="linkedin">linkedin</option>
        </select>
      </label>
      <label className="field-label">
        Connector
        <select className="field" defaultValue="linkedin" name="connector" required>
          <option value="linkedin">linkedin</option>
          <option value="zernio">zernio</option>
        </select>
      </label>
      <label className="field-label">
        External ID
        <input className="field" name="externalId" placeholder="External ID" required />
      </label>
      <label className="field-label">
        Account type
        <select className="field" defaultValue="organization" name="accountType">
          <option value="organization">organization</option>
          <option value="person">person</option>
        </select>
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      {success ? <p className="form-success">{success}</p> : null}
      <button className="btn btn-primary" disabled={pending} type="submit">
        {pending ? "Connecting…" : "Connect account"}
      </button>
    </form>
  );
}
