import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type FormEvent, useCallback, useState } from "react";
import {
  getCoffeePoolStatus,
  getConfig,
  getPublicConfig,
  loginAdmin,
} from "@/modules/impact-lab/services/impactLabService";
import { loadCityPage } from "@/shared/http/cityPage";
import { PageHeader } from "@/shared/ui/page";

interface AdminSummary {
  accessCode: string;
  checkInOpen: boolean;
  coffeeNote: string;
  coffeePool: { assigned: number; redeemed: number; total: number; unassigned: number } | null;
  eventDate: string;
  eventName: string;
  eventTagline: string;
  peoplesChoiceOpen: boolean;
  votingOpen: boolean;
}

const load = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!page.ok) {
      return {
        config: null as { eventName: string; eventTagline: string } | null,
      };
    }
    const config = await getPublicConfig(page.registry);
    return {
      config: config.ok
        ? { eventName: config.config.eventName, eventTagline: config.config.eventTagline }
        : null,
    };
  });

const login = createServerFn({ method: "POST" })
  .validator((d: { citySlug: string; password: string }) => d)
  .handler(async ({ data }) => {
    const page = await loadCityPage(data.citySlug);
    if (!page.ok) {
      return { ok: false as const, error: page.error.message ?? "City not found" };
    }
    const logged = await loginAdmin(page.registry, data.password);
    if (!logged.ok) {
      return { ok: false as const, error: logged.error.message ?? logged.error.code };
    }
    const [config, pool] = await Promise.all([
      getConfig(page.registry),
      getCoffeePoolStatus(page.registry, logged.adminToken),
    ]);
    if (!config.ok) {
      return { ok: false as const, error: config.error.message ?? config.error.code };
    }
    const summary: AdminSummary = {
      accessCode: config.config.accessCode,
      checkInOpen: config.config.checkInOpen,
      coffeeNote: config.config.coffeeNote,
      coffeePool: pool.ok ? pool.status : null,
      eventDate: config.config.eventDate,
      eventName: config.config.eventName,
      eventTagline: config.config.eventTagline,
      peoplesChoiceOpen: config.config.peoplesChoiceOpen,
      votingOpen: config.config.votingOpen,
    };
    return { ok: true as const, summary };
  });

export const Route = createFileRoute("/$citySlug/impact-lab/admin")({
  loader: ({ params }) => load({ data: { citySlug: params.citySlug } }),
  component: Page,
});

function Page() {
  const { tenant } = Route.useRouteContext();
  const { config } = Route.useLoaderData();

  return (
    <section className="stack">
      <PageHeader
        actions={
          <a className="btn" href={`/${tenant.slug}/impact-lab`}>
            Impact Lab
          </a>
        }
        subtitle={config?.eventTagline ?? "Organiser settings"}
        title={`${config?.eventName ?? "Impact Lab"} admin`}
      />
      <AdminLogin citySlug={tenant.slug} />
    </section>
  );
}

function AdminLogin({ citySlug }: { citySlug: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const [summary, setSummary] = useState<AdminSummary | null>(null);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const fd = new FormData(event.currentTarget);
      const result = await login({
        data: { citySlug, password: String(fd.get("password") ?? "") },
      });
      if (result.ok) {
        setSummary(result.summary);
        setStatus(null);
      } else {
        setStatus(result.error);
      }
    },
    [citySlug],
  );

  if (summary) {
    return (
      <div className="card stack">
        <strong>Settings</strong>
        <p style={{ margin: 0 }}>{summary.eventName}</p>
        <p className="muted" style={{ margin: 0 }}>
          {summary.eventTagline}
        </p>
        <p className="muted" style={{ margin: 0 }}>
          {summary.eventDate}
        </p>
        <p style={{ margin: 0 }}>Access code: {summary.accessCode}</p>
        <p style={{ margin: 0 }}>
          Check-in {summary.checkInOpen ? "open" : "closed"} · Voting{" "}
          {summary.votingOpen ? "open" : "closed"} · People&apos;s choice{" "}
          {summary.peoplesChoiceOpen ? "open" : "closed"}
        </p>
        {summary.coffeeNote ? <p className="muted">{summary.coffeeNote}</p> : null}
        {summary.coffeePool ? (
          <p className="muted" style={{ margin: 0 }}>
            Coffee pool: {summary.coffeePool.assigned} assigned · {summary.coffeePool.redeemed}{" "}
            redeemed · {summary.coffeePool.unassigned} left of {summary.coffeePool.total}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <strong>Organiser login</strong>
      <input
        className="btn"
        name="password"
        placeholder="Admin password"
        required
        style={{ width: "100%" }}
        type="password"
      />
      <button className="btn btn-primary" type="submit">
        Sign in
      </button>
      {status ? (
        <p className="muted" style={{ margin: 0 }}>
          {status}
        </p>
      ) : null}
    </form>
  );
}
