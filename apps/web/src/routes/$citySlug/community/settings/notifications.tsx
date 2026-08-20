import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";
import {
  getEmailPreferences,
  updateEmailPreferences,
} from "@/modules/identity/services/usersService";
import { EMAIL_PREF_DEFAULTS, type EmailPreferences } from "@/modules/identity/types";
import { cityInput, cityMutationHandler } from "@/shared/http/cityFn";
import { requireCityActor } from "@/shared/http/cityPage";
import { PageHeader, SignInCard } from "@/shared/ui/page";
import { useFormSubmit } from "@/shared/ui/use-form-submit";

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

const loadInput = z.object({ citySlug: z.string().min(1) });

const load = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadInput.parse(input))
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

const savePrefsInput = cityInput({
  eventReminders: z.boolean(),
  likes: z.boolean(),
  mentions: z.boolean(),
  messages: z.boolean(),
  replies: z.boolean(),
  weeklyDigest: z.boolean(),
});

const savePrefs = createServerFn({ method: "POST" })
  .validator((input: unknown) => savePrefsInput.parse(input))
  .handler(
    cityMutationHandler((page, data) => updateEmailPreferences(page.registry, page.actor, data)),
  );

export const Route = createFileRoute("/$citySlug/community/settings/notifications")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug } }),
  component: NotificationSettingsPage,
});

function NotificationSettingsPage(): ReactElement {
  const { citySlug } = Route.useParams();
  const data = Route.useLoaderData();

  if (!data.signedIn) {
    return <SignInCard href="/login" />;
  }

  return (
    <section className="stack">
      <PageHeader subtitle="Email and in-app alerts" title="Notification settings" />
      <PrefsForm citySlug={citySlug} preferences={data.preferences} />
      <p className="muted m-0">
        You can still review your inbox on{" "}
        <a href={`/${citySlug}/community/notifications`}>notifications</a>.
      </p>
    </section>
  );
}

function PrefsForm({
  citySlug,
  preferences,
}: {
  citySlug: string;
  preferences: EmailPreferences;
}): ReactElement {
  const { error, handleSubmit, pending, success } = useFormSubmit({
    submit: (fd) =>
      savePrefs({
        data: {
          citySlug,
          eventReminders: fd.get("eventReminders") === "on",
          likes: fd.get("likes") === "on",
          mentions: fd.get("mentions") === "on",
          messages: fd.get("messages") === "on",
          replies: fd.get("replies") === "on",
          weeklyDigest: fd.get("weeklyDigest") === "on",
        },
      }),
    successMessage: "Saved.",
  });

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <p className="muted m-0">Choose which notifications you want to receive by email.</p>
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
      {error ? <p className="form-error">{error}</p> : null}
      {success ? <p className="form-success">{success}</p> : null}
      <button className="btn btn-primary" disabled={pending} type="submit">
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
