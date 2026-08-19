import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type FormEvent, useCallback, useState } from "react";
import { getOwnProfile, updateOwnProfile } from "@/modules/identity/services/usersService";
import { requireCityActor } from "@/shared/http/cityPage";
import { EmptyCard, PageHeader, SignInCard } from "@/shared/ui/page";

const load = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
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

const submitProfile = createServerFn({ method: "POST" })
  .validator((d: { citySlug: string; displayName: string }) => d)
  .handler(async ({ data }) => {
    const page = await requireCityActor(data.citySlug);
    if (!page.ok) {
      return { error: "unauthenticated", ok: false as const };
    }
    const result = await updateOwnProfile(page.registry, page.actor, {
      displayName: data.displayName,
    });
    if (!result.ok) {
      return { error: result.error.message ?? result.error.code, ok: false as const };
    }
    return { ok: true as const };
  });

export const Route = createFileRoute("/$citySlug/community/settings/profile")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug } }),
  component: ProfileSettingsPage,
});

function ProfileSettingsPage() {
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

function ProfileForm({ citySlug, displayName }: { citySlug: string; displayName: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const fd = new FormData(event.currentTarget);
      const result = await submitProfile({
        data: {
          citySlug,
          displayName: String(fd.get("displayName") ?? ""),
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
      {status ? <p className="muted">{status}</p> : null}
      <button className="btn btn-primary" type="submit">
        Save
      </button>
    </form>
  );
}
