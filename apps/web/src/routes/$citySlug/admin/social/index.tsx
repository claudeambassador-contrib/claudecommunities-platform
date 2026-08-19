import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { type ChangeEvent, useCallback, useRef, useState } from "react";
import { z } from "zod";
import { createPost, listAccounts, listPosts } from "@/modules/social/services/socialService";
import type { SocialPostAction } from "@/modules/social/types";
import { ok } from "@/shared/http/errors";
import { guarded, guardedMutation } from "@/shared/http/guarded";
import { Can } from "@/shared/ui/can";
import { DeniedCard, ItemList, PageHeader } from "@/shared/ui/page";
import { formString, useFormSubmit } from "@/shared/ui/use-form-submit";

interface ComposerAccount {
  displayName: string;
  id: string;
}

const MEDIA_URL_SEPARATOR = /\n|,/;

function statusMessageForAction(action: SocialPostAction): string {
  if (action === "publish") {
    return "Publish queued.";
  }
  if (action === "scheduled") {
    return "Post scheduled.";
  }
  return "Draft saved.";
}

const loadSocialPostsInput = z.object({ citySlug: z.string().min(1) });

const loadSocialPosts = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadSocialPostsInput.parse(input))
  .handler(({ data }) =>
    guarded(data.citySlug, "social.view", async (page) => {
      const postsResult = await listPosts(page.store, page.actor);
      if (!postsResult.ok) {
        return postsResult;
      }
      const accountsResult = await listAccounts(page.store, page.actor);
      if (!accountsResult.ok) {
        return accountsResult;
      }
      return ok({
        accounts: accountsResult.accounts.map((account) => ({
          displayName: account.displayName,
          id: account.id,
        })),
        posts: postsResult.posts.map((post) => ({
          detail: [post.status, post.platform, post.scheduledAt].filter(Boolean).join(" · "),
          id: post.id,
          title: post.content.slice(0, 80) || "Untitled post",
        })),
      });
    }),
  );

const submitSocialPostInput = z.object({
  accountId: z.string(),
  action: z.enum(["draft", "scheduled", "publish"]),
  citySlug: z.string().min(1),
  content: z.string(),
  mediaType: z.enum(["none", "image"]),
  mediaUrls: z.array(z.string()),
  scheduledAt: z.string().nullable(),
});

const submitSocialPost = createServerFn({ method: "POST" })
  .validator((input: unknown) => submitSocialPostInput.parse(input))
  .handler(({ data }) =>
    guardedMutation(
      data.citySlug,
      data.action === "publish" ? "social.publish" : "social.edit",
      (page) =>
        createPost(page.store, page.actor, {
          accountId: data.accountId,
          action: data.action,
          content: data.content,
          mediaType: data.mediaType,
          mediaUrls: data.mediaUrls,
          scheduledAt: data.scheduledAt,
        }),
    ),
  );

export const Route = createFileRoute("/$citySlug/admin/social/")({
  loader: ({ params }) => loadSocialPosts({ data: { citySlug: params.citySlug } }),
  component: AdminSocialPage,
});

function AdminSocialPage(): ReactElement {
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
}): ReactElement {
  const [content, setContent] = useState("");
  const lastAction = useRef<SocialPostAction>("draft");

  const { error, handleSubmit, pending, success } = useFormSubmit({
    onSuccess: () => setContent(""),
    resetOnSuccess: true,
    submit: async (fd) => {
      const actionRaw = formString(fd, "action");
      const action: SocialPostAction =
        actionRaw === "scheduled" || actionRaw === "publish" ? actionRaw : "draft";
      lastAction.current = action;
      const scheduledRaw = formString(fd, "scheduledAt").trim();
      const mediaRaw = formString(fd, "mediaUrls")
        .split(MEDIA_URL_SEPARATOR)
        .map((url) => url.trim())
        .filter(Boolean);
      if (action === "scheduled" && !scheduledRaw) {
        return { error: "scheduledAt is required for scheduled posts", ok: false as const };
      }
      let scheduledAt: string | null = null;
      if (scheduledRaw) {
        const parsed = new Date(scheduledRaw);
        if (Number.isNaN(parsed.getTime())) {
          return { error: "Invalid scheduledAt", ok: false as const };
        }
        scheduledAt = parsed.toISOString();
      }
      return await submitSocialPost({
        data: {
          accountId: formString(fd, "accountId"),
          action,
          citySlug,
          content,
          mediaType: mediaRaw.length > 0 ? "image" : "none",
          mediaUrls: mediaRaw,
          scheduledAt,
        },
      });
    },
    successMessage: () => statusMessageForAction(lastAction.current),
  });
  const handleContentChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => setContent(event.target.value),
    [],
  );

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <label className="field-label">
        Account
        <select className="field" name="accountId" required>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.displayName}
            </option>
          ))}
        </select>
      </label>
      <label className="field-label">
        Post content
        <textarea
          className="field w-full"
          name="content"
          onChange={handleContentChange}
          placeholder="Post content"
          required
          rows={6}
          value={content}
        />
      </label>
      <p className="muted m-0">{content.length} / 3000</p>
      <label className="field-label">
        Image URLs (optional)
        <textarea
          className="field w-full"
          name="mediaUrls"
          placeholder="Optional image URLs, one per line"
          rows={2}
        />
      </label>
      <label className="field-label">
        Schedule for
        <input className="field" name="scheduledAt" type="datetime-local" />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      {success ? <p className="form-success">{success}</p> : null}
      <div className="row">
        <button className="btn" disabled={pending} name="action" type="submit" value="draft">
          {pending ? "Saving…" : "Save draft"}
        </button>
        <button className="btn" disabled={pending} name="action" type="submit" value="scheduled">
          {pending ? "Saving…" : "Schedule"}
        </button>
        <button
          className="btn btn-primary"
          disabled={pending}
          name="action"
          type="submit"
          value="publish"
        >
          {pending ? "Saving…" : "Publish now"}
        </button>
      </div>
    </form>
  );
}
