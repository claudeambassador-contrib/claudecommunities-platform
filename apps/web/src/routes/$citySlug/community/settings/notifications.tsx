import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type FormEvent, useCallback, useState } from "react";
import {
  getEmailPreferences,
  updateEmailPreferences,
} from "@/modules/identity/services/usersService";
import { EMAIL_PREF_DEFAULTS, type EmailPreferences } from "@/modules/identity/types";
import { requireCityActor } from "@/shared/http/cityPage";
import { PageHeader, SignInCard } from "@/shared/ui/page";

const PREF_FIELDS: { description: string; key: keyof EmailPreferences; title: string }[] = [
  {
    description: "When someone mentions you in a post or comment",
    key: "mentions",
    title: "Mentions",
  },
  {
    description: "When someone replies to your post or comment",
    key: "replies",
    title: "Replies",
  },
  { description: "When someone likes your post", key: "likes", title: "Likes" },
  {
    description: "When you receive a new direct message",
    key: "messages",
    title: "Direct messages",
  },
  {
    description: "Reminders about upcoming events you've RSVP'd to",
    key: "eventReminders",
    title: "Event reminders",
  },
  {
    description: "A weekly summary of community activity",
    key: "weeklyDigest",
    title: "Weekly digest",
  },
];

const load = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const page = await requireCityActor(data.citySlug);
    if (!page.ok) {
      return { signedIn: false as const };
    }
    const prefs = await getEmailPreferences(page.registry, page.actor);
    return {
      preferences: prefs.ok ? prefs.preferences : EMAIL_PREF_DEFAULTS,
      signedIn: true as const,
    };
  });

const savePrefs = createServerFn({ method: "POST" })
  .validator((d: { citySlug: string } & EmailPreferences) => d)
  .handler(async ({ data }) => {
    const page = await requireCityActor(data.citySlug);
    if (!page.ok) {
      return { error: "unauthenticated", ok: false as const };
    }
    const result = await updateEmailPreferences(page.registry, page.actor, data);
    if (!result.ok) {
      return { error: result.error.message ?? result.error.code, ok: false as const };
    }
    return { ok: true as const, preferences: result.preferences };
  });

export const Route = createFileRoute("/$citySlug/community/settings/notifications")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug } }),
  component: NotificationSettingsPage,
});

function NotificationSettingsPage() {
  const { citySlug } = Route.useParams();
  const data = Route.useLoaderData();

  if (!data.signedIn) {
    return <SignInCard href="/login" />;
  }

  return (
    <section className="stack">
      <PageHeader subtitle="Email and in-app alerts" title="Notification settings" />
      <PrefsForm citySlug={citySlug} preferences={data.preferences} />
      <p className="muted" style={{ margin: 0 }}>
        You can still review your inbox on{" "}
        <a href={`/${citySlug}/community/notifications`}>notifications</a>.
      </p>
    </section>
  );
}

function PrefsForm({ citySlug, preferences }: { citySlug: string; preferences: EmailPreferences }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const fd = new FormData(event.currentTarget);
      const result = await savePrefs({
        data: {
          citySlug,
          eventReminders: fd.get("eventReminders") === "on",
          likes: fd.get("likes") === "on",
          mentions: fd.get("mentions") === "on",
          messages: fd.get("messages") === "on",
          replies: fd.get("replies") === "on",
          weeklyDigest: fd.get("weeklyDigest") === "on",
        },
      });
      if (result.ok) {
        setStatus("Saved.");
        await router.invalidate();
        return;
      }
      setStatus(result.error);
    },
    [citySlug, router],
  );

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <p className="muted" style={{ margin: 0 }}>
        Choose which notifications you want to receive by email.
      </p>
      {PREF_FIELDS.map((field) => (
        <label htmlFor={field.key} key={field.key}>
          <input
            defaultChecked={preferences[field.key]}
            id={field.key}
            name={field.key}
            type="checkbox"
          />{" "}
          {field.title}
          <span className="muted"> — {field.description}</span>
        </label>
      ))}
      {status ? <p className="muted">{status}</p> : null}
      <button className="btn btn-primary" type="submit">
        Save
      </button>
    </form>
  );
}
