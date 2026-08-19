import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type FormEvent, useCallback, useState } from "react";
import { createPost, listAccounts, listPosts } from "@/modules/social/services/socialService";
import type { SocialPostAction } from "@/modules/social/types";
import { loadCityPage } from "@/shared/http/cityPage";
import { Can } from "@/shared/ui/can";
import { DeniedCard, ItemList, PageHeader } from "@/shared/ui/page";

type ComposerAccount = {
  displayName: string;
  id: string;
};

const loadSocialPosts = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { allowed: false as const, reason: "unauthenticated" };
    }
    const postsResult = await listPosts(page.store, page.actor);
    if (!postsResult.ok) {
      return { allowed: false as const, reason: postsResult.error.code };
    }
    const accountsResult = await listAccounts(page.store, page.actor);
    if (!accountsResult.ok) {
      return { allowed: false as const, reason: accountsResult.error.code };
    }
    return {
      accounts: accountsResult.accounts.map((account) => ({
        displayName: account.displayName,
        id: account.id,
      })),
      allowed: true as const,
      posts: postsResult.posts.map((post) => ({
        detail: [post.status, post.platform, post.scheduledAt].filter(Boolean).join(" · "),
        id: post.id,
        title: post.content.slice(0, 80) || "Untitled post",
      })),
    };
  });

const submitSocialPost = createServerFn({ method: "POST" })
  .validator(
    (d: {
      accountId: string;
      action: SocialPostAction;
      citySlug: string;
      content: string;
      mediaType: "none" | "image";
      mediaUrls: string[];
      scheduledAt: string | null;
    }) => d,
  )
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!(page.ok && page.actor)) {
      return { error: "unauthenticated", ok: false as const };
    }
    if (data.action !== "draft" && data.action !== "scheduled" && data.action !== "publish") {
      return { error: "action must be draft, scheduled, or publish", ok: false as const };
    }
    const result = await createPost(page.store, page.actor, {
      accountId: data.accountId,
      action: data.action,
      content: data.content,
      mediaType: data.mediaType,
      mediaUrls: data.mediaUrls,
      scheduledAt: data.scheduledAt,
    });
    if (!result.ok) {
      return { error: result.error.message ?? result.error.code, ok: false as const };
    }
    return { ok: true as const };
  });

export const Route = createFileRoute("/$citySlug/admin/social/")({
  loader: ({ params }) => loadSocialPosts({ data: { citySlug: params.citySlug } }),
  component: AdminSocialPage,
});

function AdminSocialPage() {
  const { citySlug } = Route.useParams();
  const data = Route.useLoaderData();

  if (!data.allowed) {
    return <DeniedCard reason={data.reason} title="Social" />;
  }

  return (
    <section className="stack">
      <PageHeader
        actions={
          <a className="btn" href={`/${citySlug}/admin/social/settings`}>
            Settings
          </a>
        }
        title="Social"
      />
      <Can permission="social.edit">
        {data.accounts.length === 0 ? (
          <div className="card muted">
            No connected accounts.{" "}
            <a href={`/${citySlug}/admin/social/settings`}>Connect one in settings</a>.
          </div>
        ) : (
          <ComposerForm accounts={data.accounts} citySlug={citySlug} />
        )}
      </Can>
      <ItemList empty="No social posts yet." items={data.posts} />
    </section>
  );
}

function ComposerForm({
  accounts,
  citySlug,
}: {
  accounts: ComposerAccount[];
  citySlug: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [content, setContent] = useState("");

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const fd = new FormData(form);
      const submitter = (event.nativeEvent as SubmitEvent).submitter;
      const action =
        submitter instanceof HTMLButtonElement
          ? (submitter.value as SocialPostAction)
          : "draft";
      const scheduledRaw = String(fd.get("scheduledAt") ?? "").trim();
      const mediaRaw = String(fd.get("mediaUrls") ?? "")
        .split(/\n|,/)
        .map((url) => url.trim())
        .filter(Boolean);
      if (action === "scheduled" && !scheduledRaw) {
        setStatus("scheduledAt is required for scheduled posts");
        return;
      }
      let scheduledAt: string | null = null;
      if (scheduledRaw) {
        const parsed = new Date(scheduledRaw);
        if (Number.isNaN(parsed.getTime())) {
          setStatus("Invalid scheduledAt");
          return;
        }
        scheduledAt = parsed.toISOString();
      }
      const result = await submitSocialPost({
        data: {
          accountId: String(fd.get("accountId") ?? ""),
          action,
          citySlug,
          content,
          mediaType: mediaRaw.length > 0 ? "image" : "none",
          mediaUrls: mediaRaw,
          scheduledAt,
        },
      });
      if (result.ok) {
        form.reset();
        setContent("");
        setStatus(
          action === "publish"
            ? "Publish queued."
            : action === "scheduled"
              ? "Post scheduled."
              : "Draft saved.",
        );
        await router.invalidate();
        return;
      }
      setStatus(result.error);
    },
    [citySlug, router],
  );

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <select className="field" name="accountId" required>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.displayName}
          </option>
        ))}
      </select>
      <textarea
        className="field"
        name="content"
        onChange={(event) => setContent(event.target.value)}
        placeholder="Post content"
        required
        rows={6}
        style={{ width: "100%" }}
        value={content}
      />
      <p className="muted" style={{ margin: 0 }}>
        {content.length} / 3000
      </p>
      <textarea
        className="field"
        name="mediaUrls"
        placeholder="Optional image URLs, one per line"
        rows={2}
        style={{ width: "100%" }}
      />
      <input className="field" name="scheduledAt" type="datetime-local" />
      {status ? <p className="muted">{status}</p> : null}
      <div className="row">
        <button className="btn" name="action" type="submit" value="draft">
          Save draft
        </button>
        <button className="btn" name="action" type="submit" value="scheduled">
          Schedule
        </button>
        <button className="btn btn-primary" name="action" type="submit" value="publish">
          Publish now
        </button>
      </div>
    </form>
  );
}
