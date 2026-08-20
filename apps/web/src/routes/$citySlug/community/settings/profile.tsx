import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactElement } from "react";
import { z } from "zod";
import { getOwnProfile, updateOwnProfile } from "@/modules/identity/services/usersService";
import { cityInput, cityMutationHandler } from "@/shared/http/cityFn";
import { requireCityActor } from "@/shared/http/cityPage";
import { EmptyCard, PageHeader, SignInCard } from "@/shared/ui/page";
import { formString, useFormSubmit } from "@/shared/ui/use-form-submit";

const loadInput = z.object({ citySlug: z.string().min(1) });

const load = createServerFn({ method: "GET" })
  .validator((input: unknown) => loadInput.parse(input))
  .handler(async ({ data }) => {
    const page = await requireCityActor(data.citySlug);
    if (!page.ok) {
      return { signedIn: false as const };
    }
    const profile = await getOwnProfile(page.registry, page.actor);
    if (!profile.ok) {
      return { signedIn: true as const, user: null };
    }
    return {
      signedIn: true as const,
      user: {
        displayName: profile.user.displayName ?? "",
        email: profile.user.email,
        id: profile.user.id,
        role: profile.user.role,
      },
    };
  });

const submitProfileInput = cityInput({
  displayName: z.string(),
});

const submitProfile = createServerFn({ method: "POST" })
  .validator((input: unknown) => submitProfileInput.parse(input))
  .handler(
    cityMutationHandler((page, data) =>
      updateOwnProfile(page.registry, page.actor, { displayName: data.displayName }),
    ),
  );

export const Route = createFileRoute("/$citySlug/community/settings/profile")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug } }),
  component: ProfileSettingsPage,
});

function ProfileSettingsPage(): ReactElement {
  const { citySlug } = Route.useParams();
  const data = Route.useLoaderData();

  if (!data.signedIn) {
    return <SignInCard href="/login" />;
  }

  if (!data.user) {
    return <EmptyCard>Profile not found.</EmptyCard>;
  }

  return (
    <section className="stack">
      <PageHeader subtitle={data.user.email} title="Profile settings" />
      <ProfileForm citySlug={citySlug} displayName={data.user.displayName} />
    </section>
  );
}

function ProfileForm({
  citySlug,
  displayName,
}: {
  citySlug: string;
  displayName: string;
}): ReactElement {
  const { error, handleSubmit, pending, success } = useFormSubmit({
    submit: (fd) =>
      submitProfile({
        data: {
          citySlug,
          displayName: formString(fd, "displayName"),
        },
      }),
    successMessage: "Saved.",
  });

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <label className="stack" htmlFor="displayName">
        <span>Display name</span>
        <input
          className="field"
          defaultValue={displayName}
          id="displayName"
          name="displayName"
          required
        />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      {success ? <p className="form-success">{success}</p> : null}
      <button className="btn btn-primary" disabled={pending} type="submit">
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
