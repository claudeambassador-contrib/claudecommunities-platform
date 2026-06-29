"use client";

import {
  AlertCircle,
  Award,
  BookOpen,
  CalendarClock,
  Check,
  Coffee,
  Download,
  ExternalLink,
  Github,
  LayoutGrid,
  Lightbulb,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  Trophy,
  Upload,
  Users,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import { TenantLink, useTenantRouter } from "@/components/TenantBaseProvider";

/* ── Types ──────────────────────────────────────────────────────────── */
interface AdminConfig {
  eventName: string;
  eventTagline: string;
  eventDate: string;
  accessCode: string;
  coffeeNote: string;
  checkInOpen: boolean;
  votingOpen: boolean;
  winningStatementId: string | null;
  peoplesChoiceOpen: boolean;
  peoplesChoiceWinnerTeamId: string | null;
}
interface AdminTeam {
  id: string;
  name: string;
  color: string;
  tableNumber: string | null;
  count: number;
  conceptTitle: string | null;
  conceptSummary: string | null;
  conceptRepoUrl: string | null;
  conceptSubmittedAt: string | null;
}
interface AdminParticipant {
  id: string;
  name: string;
  email: string;
  role: string;
  teamId: string | null;
  teamName: string | null;
  checkedIn: boolean;
  preRegistered: boolean;
  coffeeCode: string;
  coffeeRedeemed: boolean;
  coffeeRedeemedAt: string | null;
}
interface AdminStatement {
  id: string;
  title: string;
  summary: string;
  description: string;
  order: number;
}
interface AdminScheduleItem {
  id: string;
  startTime: string;
  title: string;
  description: string | null;
  track: string | null;
  order: number;
}
interface AdminResource {
  id: string;
  title: string;
  description: string | null;
  url: string;
  category: string;
  order: number;
}
interface AdminCoffeeCode {
  id: string;
  code: string;
  order: number;
  participantName: string | null;
  participantEmail: string | null;
  teamName: string | null;
  redeemed: boolean;
  redeemedAt: string | null;
}
interface AdminCoffeePool {
  total: number;
  assigned: number;
  unassigned: number;
  redeemed: number;
  codes: AdminCoffeeCode[];
}
interface DashboardProps {
  config: AdminConfig;
  teams: AdminTeam[];
  participants: AdminParticipant[];
  statements: AdminStatement[];
  schedule: AdminScheduleItem[];
  resources: AdminResource[];
  tallies: Record<string, number>;
  peoplesChoiceTallies: Record<string, number>;
  coffeePool: AdminCoffeePool;
}

type Runner = (payload: Record<string, unknown>, okMsg?: string) => Promise<boolean>;
type Flash = { type: "ok" | "err"; msg: string } | null;

const inputCls =
  "w-full rounded-lg border border-white/10 bg-claude-dark px-3 py-2 text-sm text-text-primary focus:border-claude-coral focus:outline-none";
const ROLES = ["participant", "mentor", "judge"];

const TABS = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "submissions", label: "Submissions", icon: Award },
  { key: "participants", label: "Participants", icon: Users },
  { key: "teams", label: "Teams", icon: UsersRound },
  { key: "problems", label: "Problems", icon: Lightbulb },
  { key: "schedule", label: "Schedule", icon: CalendarClock },
  { key: "resources", label: "Resources", icon: BookOpen },
  { key: "coffee", label: "Coffee", icon: Coffee },
  { key: "settings", label: "Settings", icon: Settings },
] as const;
type TabKey = (typeof TABS)[number]["key"];

/* ── CSV parsing ────────────────────────────────────────────────────── */
function splitCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

interface ImportRow {
  name: string;
  email: string;
  role: string;
  team: string;
}
function parseCSV(text: string): ImportRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const rows = lines.map(splitCSVLine);
  const header = rows[0].map((c) => c.trim().toLowerCase());
  const hasHeader = ["name", "email", "role", "team"].some((h) => header.includes(h));
  let idx = { name: 0, email: 1, role: 2, team: 3 };
  let start = 0;
  if (hasHeader) {
    start = 1;
    idx = {
      name: header.indexOf("name"),
      email: header.indexOf("email"),
      role: header.indexOf("role"),
      team: header.indexOf("team"),
    };
  }
  const get = (r: string[], j: number) => (j >= 0 && j < r.length ? r[j].trim() : "");
  const result: ImportRow[] = [];
  for (let i = start; i < rows.length; i++) {
    const r = rows[i];
    const email = get(r, idx.email);
    if (!email?.includes("@")) continue;
    result.push({
      name: get(r, idx.name),
      email,
      role: get(r, idx.role),
      team: get(r, idx.team),
    });
  }
  return result;
}

function formatClock(iso: string): string {
  try {
    return new Date(iso).toLocaleString([], {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/* ── Dashboard shell ────────────────────────────────────────────────── */
export default function AdminDashboard(props: DashboardProps) {
  const router = useTenantRouter();
  const [tab, setTab] = useState<TabKey>("overview");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);

  const run: Runner = async (payload, okMsg) => {
    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch("/api/impact-lab/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        if (okMsg) setFlash({ type: "ok", msg: okMsg });
        router.refresh();
        return true;
      }
      setFlash({ type: "err", msg: data.error || "Something went wrong." });
      return false;
    } catch {
      setFlash({ type: "err", msg: "Network error — try again." });
      return false;
    } finally {
      setBusy(false);
    }
  };

  async function signOut() {
    await fetch("/api/impact-lab/admin/auth", { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Impact Lab admin</h1>
          <TenantLink
            href="/impact-lab"
            className="text-xs text-text-muted hover:text-claude-coral"
          >
            View participant portal →
          </TenantLink>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-text-secondary hover:bg-white/5"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </header>

      {/* Tab nav */}
      <div className="mt-5 flex flex-wrap gap-1.5">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            type="button"
            key={key}
            onClick={() => {
              setTab(key);
              setFlash(null);
            }}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition"
            style={{
              background: tab === key ? "#D4836A" : "rgba(255,255,255,0.05)",
              color: tab === key ? "#160F0C" : "#A8A29E",
            }}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {flash && (
        <div
          className="mt-4 flex items-start gap-2 rounded-xl border px-3 py-2 text-sm"
          style={{
            borderColor: flash.type === "ok" ? "rgba(74,222,128,0.3)" : "rgba(248,113,113,0.3)",
            background: flash.type === "ok" ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
            color: flash.type === "ok" ? "#4ADE80" : "#FCA5A5",
          }}
        >
          {flash.type === "ok" ? (
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          )}
          <span>{flash.msg}</span>
        </div>
      )}

      <div className="mt-5 pb-16">
        {tab === "overview" && <OverviewTab {...props} run={run} busy={busy} />}
        {tab === "submissions" && <SubmissionsTab {...props} run={run} busy={busy} />}
        {tab === "participants" && <ParticipantsTab {...props} run={run} busy={busy} />}
        {tab === "teams" && <TeamsTab {...props} run={run} busy={busy} />}
        {tab === "problems" && <ProblemsTab {...props} run={run} busy={busy} />}
        {tab === "schedule" && <ScheduleTab {...props} run={run} busy={busy} />}
        {tab === "resources" && <ResourcesTab {...props} run={run} busy={busy} />}
        {tab === "coffee" && <CoffeeTab {...props} run={run} busy={busy} />}
        {tab === "settings" && <SettingsTab {...props} run={run} busy={busy} />}
      </div>
    </div>
  );
}

/* ── Shared bits ────────────────────────────────────────────────────── */
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-claude-dark-card/60 p-4">{children}</div>
  );
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">{children}</h2>
  );
}
function Toggle({
  label,
  on,
  onChange,
  disabled,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      disabled={disabled}
      className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-claude-dark px-4 py-3 disabled:opacity-60"
    >
      <span className="text-sm text-text-primary">{label}</span>
      <span
        className="relative h-6 w-11 rounded-full transition"
        style={{ background: on ? "#4ADE80" : "rgba(255,255,255,0.15)" }}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
          style={{ left: on ? "1.375rem" : "0.125rem" }}
        />
      </span>
    </button>
  );
}
function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-red-500/20 p-2 text-red-400 transition hover:bg-red-500/10"
      aria-label="Delete"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
function SaveButton({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="flex items-center gap-1.5 rounded-lg bg-claude-coral px-3 py-2 text-sm font-medium text-claude-dark transition hover:bg-claude-coral-light disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
    </button>
  );
}

/* ── Team rosters (read-only at-a-glance for the Overview tab) ──────── */
function TeamRosters({
  teams,
  participants,
}: {
  teams: AdminTeam[];
  participants: AdminParticipant[];
}) {
  // Sort teams by tableNumber (numeric), then by name.
  const sortedTeams = [...teams].sort((a, b) => {
    const an = a.tableNumber ? Number.parseInt(a.tableNumber, 10) : NaN;
    const bn = b.tableNumber ? Number.parseInt(b.tableNumber, 10) : NaN;
    if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
    return a.name.localeCompare(b.name);
  });
  const unassigned = participants
    .filter((p) => !p.teamId)
    .sort((a, b) => a.name.localeCompare(b.name));
  const checkedInBy = (members: AdminParticipant[]) => members.filter((m) => m.checkedIn).length;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <SectionTitle>Team rosters</SectionTitle>
        <span className="text-xs text-text-muted">
          {participants.length - unassigned.length} placed
          {unassigned.length > 0 ? ` · ${unassigned.length} unassigned` : ""}
        </span>
      </div>
      <p className="mt-1 text-xs text-text-muted">
        Who&apos;s on each team, at a glance. Green dot = checked in.
      </p>

      {unassigned.length > 0 && (
        <RosterPanel
          title="Unassigned"
          subtitle="Not yet on a team"
          color="#F59E0B"
          members={unassigned}
          emphasised
        />
      )}

      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {sortedTeams.map((t) => {
          const members = participants
            .filter((p) => p.teamId === t.id)
            .sort((a, b) => a.name.localeCompare(b.name));
          return (
            <RosterPanel
              key={t.id}
              title={t.name}
              subtitle={t.tableNumber ? `Table ${t.tableNumber}` : undefined}
              color={t.color}
              members={members}
              conceptTitle={t.conceptTitle}
              footer={
                members.length > 0
                  ? `${checkedInBy(members)} / ${members.length} checked in`
                  : undefined
              }
            />
          );
        })}
        {sortedTeams.length === 0 && (
          <p className="col-span-full py-4 text-center text-sm text-text-muted">No teams yet.</p>
        )}
      </div>
    </Card>
  );
}

function RosterPanel({
  title,
  subtitle,
  color,
  members,
  conceptTitle,
  footer,
  emphasised,
}: {
  title: string;
  subtitle?: string;
  color: string;
  members: AdminParticipant[];
  conceptTitle?: string | null;
  footer?: string;
  emphasised?: boolean;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border bg-claude-dark-card/40 ${
        emphasised ? "mt-3" : ""
      }`}
      style={{
        borderColor: emphasised ? `${color}80` : "rgba(255,255,255,0.1)",
      }}
    >
      <div
        className="flex items-center justify-between gap-2 px-3 py-2"
        style={{
          background: emphasised ? `${color}15` : `${color}10`,
          borderBottom: `1px solid ${color}30`,
        }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
            style={{ background: color }}
          />
          <span className="truncate text-sm font-semibold text-text-primary">{title}</span>
          {subtitle && <span className="truncate text-[11px] text-text-muted">· {subtitle}</span>}
        </div>
        <span className="flex-shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[11px] text-text-secondary">
          {members.length}
        </span>
      </div>
      {conceptTitle && (
        <div className="border-b border-white/5 px-3 py-1.5">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-text-muted">
            <Lightbulb className="h-3 w-3" /> Idea
          </p>
          <p className="truncate text-xs text-text-secondary">{conceptTitle}</p>
        </div>
      )}
      {members.length === 0 ? (
        <p className="px-3 py-3 text-center text-[11px] text-text-muted">No members yet</p>
      ) : (
        <ul className="px-3 py-2">
          {members.map((m) => {
            const roleColor =
              m.role === "judge" ? "#A78BFA" : m.role === "mentor" ? "#60A5FA" : null;
            return (
              <li key={m.id} className="flex items-center gap-2 py-0.5 text-sm">
                <span
                  className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full"
                  style={{
                    background: m.checkedIn ? "#4ADE80" : "rgba(255,255,255,0.15)",
                  }}
                  title={m.checkedIn ? "Checked in" : "Not checked in"}
                />
                <span className="truncate text-text-secondary">{m.name}</span>
                {roleColor && (
                  <span
                    className="ml-auto flex-shrink-0 text-[10px] uppercase tracking-wider"
                    style={{ color: roleColor }}
                  >
                    {m.role}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {footer && (
        <p className="border-t border-white/5 px-3 py-1.5 text-[11px] text-text-muted">{footer}</p>
      )}
    </div>
  );
}

/* ── Submissions: showcase view of all team submissions ─────────────── */
function SubmissionsTab({
  teams,
  config,
  peoplesChoiceTallies,
}: DashboardProps & { run: Runner; busy: boolean }) {
  const [sortBy, setSortBy] = useState<"team" | "votes" | "recent">("team");
  const [filter, setFilter] = useState<"all" | "submitted" | "missing">("all");

  // Only show teams that actually have members (drop empty / test teams).
  const realTeams = teams.filter((t) => t.count > 0);

  const filtered = realTeams.filter((t) => {
    if (filter === "submitted") return Boolean(t.conceptTitle?.trim());
    if (filter === "missing") return !t.conceptTitle?.trim();
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "votes") {
      const va = peoplesChoiceTallies[a.id] || 0;
      const vb = peoplesChoiceTallies[b.id] || 0;
      if (va !== vb) return vb - va;
    }
    if (sortBy === "recent") {
      const ta = a.conceptSubmittedAt ? new Date(a.conceptSubmittedAt).getTime() : 0;
      const tb = b.conceptSubmittedAt ? new Date(b.conceptSubmittedAt).getTime() : 0;
      if (ta !== tb) return tb - ta;
    }
    // 'team' or tie-breaker: numeric table number, then name
    const an = a.tableNumber ? Number.parseInt(a.tableNumber, 10) : NaN;
    const bn = b.tableNumber ? Number.parseInt(b.tableNumber, 10) : NaN;
    if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
    return a.name.localeCompare(b.name);
  });

  const totalVotes = Object.values(peoplesChoiceTallies).reduce((s, n) => s + n, 0);
  const submittedCount = realTeams.filter((t) => t.conceptTitle?.trim()).length;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-text-primary">Submissions</h2>
        <p className="mt-1 text-xs text-text-muted">
          Every team&apos;s pitch in one place. Solution name, link, vote count. Tap a repo link to
          open it.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: "Submitted", value: `${submittedCount} / ${realTeams.length}` },
          { label: "Total votes", value: totalVotes },
          { label: "Teams", value: realTeams.length },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-white/10 bg-claude-dark-card/60 px-3 py-2"
          >
            <p className="text-lg font-bold text-text-primary">{s.value}</p>
            <p className="text-[10px] uppercase tracking-wider text-text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters + sort */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(["all", "submitted", "missing"] as const).map((f) => (
            <button
              type="button"
              key={f}
              onClick={() => setFilter(f)}
              className="rounded-md px-2.5 py-1 text-xs capitalize"
              style={{
                background: filter === f ? "#D4836A" : "rgba(255,255,255,0.05)",
                color: filter === f ? "#160F0C" : "#A8A29E",
              }}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-xs text-text-muted">
          Sort
          <select
            className={`${inputCls} w-auto py-1 text-xs`}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          >
            <option value="team">By team #</option>
            <option value="votes">Most votes</option>
            <option value="recent">Recent submission</option>
          </select>
        </div>
      </div>

      {/* Cards */}
      {sorted.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-text-muted">
          No teams match this filter.
        </p>
      ) : (
        <div className="space-y-3">
          {sorted.map((t) => (
            <SubmissionCard
              key={t.id}
              team={t}
              votes={peoplesChoiceTallies[t.id] || 0}
              totalVotes={totalVotes}
              isWinner={config.peoplesChoiceWinnerTeamId === t.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SubmissionCard({
  team,
  votes,
  totalVotes,
  isWinner,
}: {
  team: AdminTeam;
  votes: number;
  totalVotes: number;
  isWinner: boolean;
}) {
  const submitted = Boolean(team.conceptTitle?.trim());
  const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
  const repoHost = team.conceptRepoUrl
    ? (() => {
        try {
          return new URL(team.conceptRepoUrl).host.replace(/^www\./, "");
        } catch {
          return null;
        }
      })()
    : null;
  return (
    <div
      className="overflow-hidden rounded-2xl border bg-claude-dark-card/60 p-4"
      style={{
        borderColor: isWinner
          ? "rgba(251,191,36,0.5)"
          : submitted
            ? `${team.color}40`
            : "rgba(255,255,255,0.1)",
      }}
    >
      {/* Header row: solution name + vote chip + winner badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {submitted ? (
            <h3 className="text-lg font-semibold leading-tight text-text-primary">
              {team.conceptTitle}
              {isWinner && <Trophy className="ml-1.5 inline h-4 w-4 text-amber-300" />}
            </h3>
          ) : (
            <h3 className="text-base italic text-text-muted">
              {team.name} hasn&apos;t submitted yet
            </h3>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-text-muted">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: team.color }}
            />
            <span>{team.name}</span>
            {team.tableNumber && <span>· tbl {team.tableNumber}</span>}
            <span>
              · {team.count} {team.count === 1 ? "member" : "members"}
            </span>
            {team.conceptSubmittedAt && (
              <span>· submitted {formatClock(team.conceptSubmittedAt)}</span>
            )}
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-col items-end">
          <div
            className="rounded-lg px-2.5 py-1 text-center"
            style={{
              background: isWinner ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.05)",
            }}
          >
            <p
              className="text-xl font-bold tabular-nums"
              style={{ color: isWinner ? "#FBBF24" : "#E7E5E4" }}
            >
              {votes}
            </p>
            <p className="text-[9px] uppercase tracking-wider text-text-muted">
              {votes === 1 ? "vote" : "votes"}
            </p>
          </div>
          {totalVotes > 0 && <p className="mt-1 text-[10px] text-text-muted">{pct}%</p>}
        </div>
      </div>

      {/* Repo link */}
      {team.conceptRepoUrl && (
        <a
          href={team.conceptRepoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center gap-2 rounded-lg border border-white/10 bg-claude-dark px-3 py-2 text-sm font-mono text-text-secondary transition hover:border-claude-coral/40 hover:bg-white/5"
        >
          <Github className="h-4 w-4 flex-shrink-0 text-text-muted" />
          <span className="truncate">{team.conceptRepoUrl.replace(/^https?:\/\//, "")}</span>
          <ExternalLink className="ml-auto h-3.5 w-3.5 flex-shrink-0 text-text-muted" />
        </a>
      )}
      {submitted && !team.conceptRepoUrl && (
        <p className="mt-3 rounded-lg border border-dashed border-white/10 px-3 py-2 text-[11px] text-text-muted">
          No repo link supplied by the team.
        </p>
      )}

      {/* Description */}
      {team.conceptSummary && (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
          {team.conceptSummary}
        </p>
      )}
      {repoHost && <p className="sr-only">repo host: {repoHost}</p>}
    </div>
  );
}

/* ── Overview ───────────────────────────────────────────────────────── */
function OverviewTab({
  config,
  teams,
  participants,
  statements,
  tallies,
  peoplesChoiceTallies,
  run,
  busy,
}: DashboardProps & { run: Runner; busy: boolean }) {
  const checkedIn = participants.filter((p) => p.checkedIn).length;
  const totalVotes = Object.values(tallies).reduce((s, n) => s + n, 0);
  const byRole = (r: string) => participants.filter((p) => p.role === r).length;
  const coffeeRedeemed = participants
    .filter((p) => p.coffeeRedeemed)
    .sort((a, b) => (b.coffeeRedeemedAt ?? "").localeCompare(a.coffeeRedeemedAt ?? ""));

  const stats = [
    { label: "Participants", value: participants.length },
    { label: "Checked in", value: checkedIn },
    { label: "Teams", value: teams.length },
    { label: "Votes cast", value: totalVotes },
  ];

  const peoplesChoiceActive = config.peoplesChoiceOpen || Boolean(config.peoplesChoiceWinnerTeamId);

  return (
    <div className="space-y-5">
      {/* When People's Choice is open or a winner is announced, pin its
          control to the top of the Overview so admins can drive it without
          scrolling past everything else. */}
      {peoplesChoiceActive && (
        <PeoplesChoiceControl
          teams={teams.filter((t) => t.count > 0)}
          config={config}
          tallies={tallies}
          peoplesChoiceTallies={peoplesChoiceTallies}
          participants={participants}
          run={run}
          busy={busy}
        />
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-white/10 bg-claude-dark-card/60 p-4"
          >
            <p className="text-2xl font-bold text-text-primary">{s.value}</p>
            <p className="text-xs text-text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      <Card>
        <SectionTitle>Roles</SectionTitle>
        <div className="mt-2 flex gap-2 text-sm">
          <span className="rounded-lg bg-claude-coral/15 px-2.5 py-1 text-claude-coral">
            {byRole("participant")} participants
          </span>
          <span className="rounded-lg bg-accent-blue/15 px-2.5 py-1 text-accent-blue">
            {byRole("mentor")} mentors
          </span>
          <span className="rounded-lg bg-accent-purple/15 px-2.5 py-1 text-accent-purple">
            {byRole("judge")} judges
          </span>
        </div>
      </Card>

      <TeamRosters teams={teams} participants={participants} />

      <Card>
        <SectionTitle>Coffee redemptions</SectionTitle>
        <p className="mt-2 text-sm text-text-secondary">
          <span className="text-2xl font-bold text-text-primary">{coffeeRedeemed.length}</span> of{" "}
          {participants.length} redeemed
        </p>
        {coffeeRedeemed.length === 0 ? (
          <p className="mt-2 text-sm text-text-muted">No coffee vouchers redeemed yet.</p>
        ) : (
          <div className="mt-3 max-h-72 space-y-1.5 overflow-y-auto">
            {coffeeRedeemed.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-claude-dark px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-text-primary">{p.name}</p>
                  <p className="truncate text-xs text-text-muted">{p.email}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="font-mono text-xs text-text-secondary">{p.coffeeCode}</p>
                  {p.coffeeRedeemedAt && (
                    <p className="text-[10px] text-text-muted">{formatClock(p.coffeeRedeemedAt)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="space-y-2">
        <SectionTitle>Live controls</SectionTitle>
        <Toggle
          label="Check-in open"
          on={config.checkInOpen}
          disabled={busy}
          onChange={(v) =>
            run(
              { resource: "settings", action: "update", checkInOpen: v },
              v ? "Check-in opened." : "Check-in closed.",
            )
          }
        />
        <Toggle
          label="Voting open"
          on={config.votingOpen}
          disabled={busy}
          onChange={(v) =>
            run(
              { resource: "settings", action: "update", votingOpen: v },
              v ? "Voting opened." : "Voting closed.",
            )
          }
        />
      </div>

      <Card>
        <SectionTitle>Vote results</SectionTitle>
        <div className="mt-3 space-y-2">
          {statements.length === 0 && (
            <p className="text-sm text-text-muted">No problem statements yet.</p>
          )}
          {statements.map((s) => {
            const count = tallies[s.id] || 0;
            const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
            return (
              <div key={s.id}>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">
                    {s.title}
                    {config.winningStatementId === s.id && (
                      <Trophy className="ml-1 inline h-3.5 w-3.5 text-amber-300" />
                    )}
                  </span>
                  <span className="text-text-muted">
                    {count} · {pct}%
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-claude-coral"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* If People's Choice isn't active yet, render the control down here
          (less prominent) so admins can still open it. The active-pinned
          copy above is the same component when peoplesChoiceActive. */}
      {!peoplesChoiceActive && (
        <PeoplesChoiceControl
          teams={teams.filter((t) => t.count > 0)}
          config={config}
          tallies={tallies}
          peoplesChoiceTallies={peoplesChoiceTallies}
          participants={participants}
          run={run}
          busy={busy}
        />
      )}
    </div>
  );
}

/* ── People's Choice award (end-of-day team vote) ──────────────────── */
function PeoplesChoiceControl({
  teams,
  config,
  peoplesChoiceTallies,
  participants,
  run,
  busy,
}: {
  teams: AdminTeam[];
  config: AdminConfig;
  tallies: Record<string, number>;
  peoplesChoiceTallies: Record<string, number>;
  participants: AdminParticipant[];
  run: Runner;
  busy: boolean;
}) {
  const open = config.peoplesChoiceOpen;
  const totalVotes = Object.values(peoplesChoiceTallies).reduce((s, n) => s + n, 0);
  const checkedIn = participants.filter((p) => p.checkedIn).length;
  const sortedTeams = [...teams].sort((a, b) => {
    const an = a.tableNumber ? Number.parseInt(a.tableNumber, 10) : NaN;
    const bn = b.tableNumber ? Number.parseInt(b.tableNumber, 10) : NaN;
    if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
    return a.name.localeCompare(b.name);
  });
  const leaderId = Object.entries(peoplesChoiceTallies).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const leader = teams.find((t) => t.id === leaderId) || null;
  const winnerTeam = teams.find((t) => t.id === config.peoplesChoiceWinnerTeamId);
  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        borderColor: open ? "rgba(251,191,36,0.4)" : "rgba(255,255,255,0.1)",
        background: open ? "rgba(251,191,36,0.06)" : "transparent",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4" style={{ color: open ? "#FBBF24" : "#78716C" }} />
          <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            People&apos;s Choice
          </span>
          <span className="text-sm font-bold" style={{ color: open ? "#FBBF24" : "#A8A29E" }}>
            {open ? "OPEN" : "closed"}
          </span>
        </div>
        <button
          type="button"
          onClick={() =>
            run(
              {
                resource: "settings",
                action: "update",
                peoplesChoiceOpen: !open,
              },
              open ? "People's Choice voting closed." : "People's Choice voting opened.",
            )
          }
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-60"
          style={{
            background: open ? "rgba(248,113,113,0.15)" : "#FBBF24",
            color: open ? "#FCA5A5" : "#160F0C",
            border: open ? "1px solid rgba(248,113,113,0.3)" : "none",
          }}
        >
          {open ? "Close vote" : "Open People's Choice"}
        </button>
      </div>
      <p className="mt-2 text-xs text-text-muted">
        End-of-day award. Each attendee votes for their favourite team&apos;s pitch (not their own).
      </p>

      {/* Submission readiness — voters will see "(no name yet)" for any
          team that hasn't entered a solution name. */}
      {(() => {
        const withName = teams.filter((t) => t.conceptTitle?.trim()).length;
        const total = teams.length;
        const missing = teams.filter((t) => !t.conceptTitle?.trim());
        if (total === 0) return null;
        return (
          <div
            className="mt-3 rounded-lg border px-3 py-2 text-xs"
            style={{
              borderColor: withName === total ? "rgba(74,222,128,0.3)" : "rgba(251,191,36,0.4)",
              background: withName === total ? "rgba(74,222,128,0.08)" : "rgba(251,191,36,0.08)",
              color: withName === total ? "#86EFAC" : "#FDE68A",
            }}
          >
            <p className="font-medium">
              {withName} / {total} teams have submitted a solution name
            </p>
            {missing.length > 0 && (
              <p className="mt-1 text-text-secondary">
                Waiting on: {missing.map((t) => t.name).join(", ")}
              </p>
            )}
          </div>
        );
      })()}

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-white/5 px-2 py-2">
          <p className="text-xl font-bold text-text-primary">{totalVotes}</p>
          <p className="text-[10px] uppercase tracking-wider text-text-muted">Votes cast</p>
        </div>
        <div className="rounded-lg bg-white/5 px-2 py-2">
          <p className="text-xl font-bold text-text-primary">{checkedIn}</p>
          <p className="text-[10px] uppercase tracking-wider text-text-muted">Checked in</p>
        </div>
        <div className="rounded-lg bg-white/5 px-2 py-2">
          <p className="text-xl font-bold text-text-primary">
            {checkedIn > 0 ? Math.round((totalVotes / checkedIn) * 100) : 0}%
          </p>
          <p className="text-[10px] uppercase tracking-wider text-text-muted">Turnout</p>
        </div>
      </div>

      {sortedTeams.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {sortedTeams.map((t) => {
            const count = peoplesChoiceTallies[t.id] || 0;
            const pct = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
            const isLeader = leaderId === t.id && totalVotes > 0;
            const isWinner = config.peoplesChoiceWinnerTeamId === t.id;
            const submission = t.conceptTitle?.trim();
            return (
              <div key={t.id}>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-1.5 truncate">
                    <span
                      className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ background: t.color }}
                    />
                    <span
                      className="truncate"
                      style={
                        submission
                          ? { color: "#E7E5E4" }
                          : { color: "#78716C", fontStyle: "italic" }
                      }
                    >
                      {submission || `${t.name} (no name)`}
                    </span>
                    <span className="text-text-muted">
                      · {t.name}
                      {t.tableNumber ? ` · tbl ${t.tableNumber}` : ""}
                    </span>
                    {isWinner && (
                      <Trophy className="ml-1 inline h-3 w-3 flex-shrink-0 text-amber-300" />
                    )}
                  </span>
                  <span className="ml-2 flex-shrink-0 font-mono text-text-muted">
                    {count} · {Math.round(pct)}%
                  </span>
                </div>
                <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${pct}%`,
                      background: isWinner ? "#FBBF24" : isLeader ? "#4ADE80" : "#D4836A",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
        <span className="text-xs text-text-muted">Announce winner:</span>
        <select
          className={`${inputCls} flex-1`}
          value={config.peoplesChoiceWinnerTeamId || ""}
          disabled={busy}
          onChange={(e) =>
            run(
              {
                resource: "settings",
                action: "update",
                peoplesChoiceWinnerTeamId: e.target.value || null,
              },
              e.target.value ? "People's Choice winner announced." : "Winner cleared.",
            )
          }
        >
          <option value="">— Not announced —</option>
          {sortedTeams.map((t) => {
            const sub = t.conceptTitle?.trim();
            const label = sub ? `${sub} (${t.name})` : t.name;
            return (
              <option key={t.id} value={t.id}>
                {label} — {peoplesChoiceTallies[t.id] || 0} votes
              </option>
            );
          })}
        </select>
        {leader && config.peoplesChoiceWinnerTeamId !== leader.id && totalVotes > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(
                {
                  resource: "settings",
                  action: "update",
                  peoplesChoiceWinnerTeamId: leader.id,
                },
                `Winner: ${leader.name}`,
              )
            }
            className="rounded-lg bg-amber-500/15 px-3 py-2 text-xs font-medium text-amber-300 hover:bg-amber-500/25 disabled:opacity-60"
          >
            Pick leader ({leader.name})
          </button>
        )}
      </div>

      {winnerTeam && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-300">
          <Trophy className="h-3.5 w-3.5" />
          Showing on portal: {winnerTeam.name}
        </p>
      )}
    </div>
  );
}

/* ── Participants ───────────────────────────────────────────────────── */
function ParticipantsTab({
  participants,
  teams,
  run,
  busy,
}: DashboardProps & { run: Runner; busy: boolean }) {
  const router = useTenantRouter();
  const [search, setSearch] = useState("");
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<ImportRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [newP, setNewP] = useState({ name: "", email: "", role: "participant", teamId: "" });
  const [view, setView] = useState<"table" | "by-team" | "cards">("table");
  const [roleFilter, setRoleFilter] = useState<"all" | "participant" | "mentor" | "judge">("all");
  const [sortKey, setSortKey] = useState<TableSortKey>("team");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(k: TableSortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  }

  // Numeric sort for team table numbers so Team 10 comes after Team 9, not Team 1.
  const teamSortKey = (teamId: string | null) => {
    if (!teamId) return Number.POSITIVE_INFINITY;
    const t = teams.find((x) => x.id === teamId);
    if (!t) return Number.POSITIVE_INFINITY;
    const n = t.tableNumber ? Number.parseInt(t.tableNumber, 10) : NaN;
    return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY - 1;
  };

  const filtered = participants
    .filter((p) => roleFilter === "all" || p.role === roleFilter)
    .filter((p) => {
      const q = search.toLowerCase();
      return (
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        (p.teamName || "").toLowerCase().includes(q)
      );
    });

  const sortedTable = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "name":
        cmp = a.name.localeCompare(b.name);
        break;
      case "email":
        cmp = a.email.localeCompare(b.email);
        break;
      case "role":
        cmp = a.role.localeCompare(b.role);
        break;
      case "team": {
        const ta = teamSortKey(a.teamId);
        const tb = teamSortKey(b.teamId);
        cmp = ta - tb;
        if (cmp === 0) cmp = a.name.localeCompare(b.name);
        break;
      }
      case "checkedIn":
        cmp = Number(b.checkedIn) - Number(a.checkedIn);
        if (cmp === 0) cmp = a.name.localeCompare(b.name);
        break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  // Group for the by-team view. Includes empty teams + an "Unassigned" bucket.
  const byTeam: Array<{ team: AdminTeam | null; members: AdminParticipant[] }> = [];
  const sortedTeams = [...teams].sort((a, b) => {
    const an = a.tableNumber ? Number.parseInt(a.tableNumber, 10) : NaN;
    const bn = b.tableNumber ? Number.parseInt(b.tableNumber, 10) : NaN;
    if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
    return a.name.localeCompare(b.name);
  });
  for (const t of sortedTeams) {
    byTeam.push({
      team: t,
      members: filtered
        .filter((p) => p.teamId === t.id)
        .sort((a, b) => a.name.localeCompare(b.name)),
    });
  }
  byTeam.push({
    team: null,
    members: filtered.filter((p) => !p.teamId).sort((a, b) => a.name.localeCompare(b.name)),
  });

  async function runImport() {
    if (!preview || preview.length === 0) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const res = await fetch("/api/impact-lab/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource: "import", action: "create", rows: preview }),
      });
      const data = await res.json();
      if (res.ok) {
        setImportMsg(
          `Imported — ${data.created} new, ${data.updated} updated${
            data.skipped ? `, ${data.skipped} skipped` : ""
          }.`,
        );
        setCsv("");
        setPreview(null);
        router.refresh();
      } else {
        setImportMsg(data.error || "Import failed.");
      }
    } catch {
      setImportMsg("Network error during import.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Bulk import */}
      <Card>
        <SectionTitle>Bulk import</SectionTitle>
        <p className="mt-1 text-xs text-text-muted">
          CSV columns: <span className="text-text-secondary">name, email, role, team</span>. A
          header row is recommended. Existing emails are updated, not duplicated.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-sm text-text-secondary hover:bg-white/5">
            <Upload className="h-4 w-4" />
            Choose CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const text = await file.text();
                  setCsv(text);
                  setPreview(parseCSV(text));
                }
              }}
            />
          </label>
        </div>
        <textarea
          value={csv}
          onChange={(e) => {
            setCsv(e.target.value);
            setPreview(null);
          }}
          placeholder={
            "name,email,role,team\nAda Lovelace,ada@example.com,participant,Team Espresso"
          }
          rows={4}
          className={`${inputCls} mt-2 font-mono text-xs`}
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPreview(parseCSV(csv))}
            className="rounded-lg border border-white/10 px-3 py-2 text-sm text-text-secondary hover:bg-white/5"
          >
            Preview
          </button>
          {preview && (
            <button
              type="button"
              onClick={runImport}
              disabled={importing || preview.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-claude-coral px-3 py-2 text-sm font-medium text-claude-dark hover:bg-claude-coral-light disabled:opacity-60"
            >
              {importing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                `Import ${preview.length} ${preview.length === 1 ? "row" : "rows"}`
              )}
            </button>
          )}
        </div>
        {importMsg && <p className="mt-2 text-xs text-text-secondary">{importMsg}</p>}
      </Card>

      {/* Add participant */}
      <Card>
        <SectionTitle>Add a participant</SectionTitle>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            className={inputCls}
            placeholder="Name"
            value={newP.name}
            onChange={(e) => setNewP({ ...newP, name: e.target.value })}
          />
          <input
            className={inputCls}
            placeholder="Email"
            value={newP.email}
            onChange={(e) => setNewP({ ...newP, email: e.target.value })}
          />
          <select
            className={inputCls}
            value={newP.role}
            onChange={(e) => setNewP({ ...newP, role: e.target.value })}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            className={inputCls}
            value={newP.teamId}
            onChange={(e) => setNewP({ ...newP, teamId: e.target.value })}
          >
            <option value="">— No team —</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={async () => {
            if (!newP.name.trim() || !newP.email.trim()) return;
            const ok = await run(
              {
                resource: "participant",
                action: "create",
                name: newP.name.trim(),
                email: newP.email.trim(),
                role: newP.role,
                teamId: newP.teamId || null,
              },
              "Participant added.",
            );
            if (ok) setNewP({ name: "", email: "", role: "participant", teamId: "" });
          }}
          disabled={busy}
          className="mt-3 flex items-center gap-1.5 rounded-lg bg-claude-coral px-3 py-2 text-sm font-medium text-claude-dark hover:bg-claude-coral-light disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </Card>

      {/* List */}
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            className={`${inputCls} min-w-[180px] flex-1`}
            placeholder="Search participants…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex rounded-lg border border-white/10 p-0.5">
            {(["table", "by-team", "cards"] as const).map((v) => (
              <button
                type="button"
                key={v}
                onClick={() => setView(v)}
                className="rounded-md px-2.5 py-1 text-xs"
                style={{
                  background: view === v ? "#D4836A" : "transparent",
                  color: view === v ? "#160F0C" : "#A8A29E",
                }}
              >
                {v === "table" ? "Table" : v === "by-team" ? "By team" : "Cards"}
              </button>
            ))}
          </div>
        </div>

        {/* Role filter */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(["all", "participant", "mentor", "judge"] as const).map((r) => {
            const count =
              r === "all" ? participants.length : participants.filter((p) => p.role === r).length;
            return (
              <button
                type="button"
                key={r}
                onClick={() => setRoleFilter(r)}
                className="rounded-md px-2.5 py-1 text-xs capitalize"
                style={{
                  background: roleFilter === r ? "#D4836A" : "rgba(255,255,255,0.05)",
                  color: roleFilter === r ? "#160F0C" : "#A8A29E",
                }}
              >
                {r === "all" ? "All" : `${r}s`} ({count})
              </button>
            );
          })}
        </div>

        {view === "by-team" && <ByTeamView groups={byTeam} teams={teams} run={run} busy={busy} />}

        {view === "table" && (
          <SortableTable
            participants={sortedTable}
            teams={teams}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={toggleSort}
            run={run}
            busy={busy}
          />
        )}

        {view === "cards" && (
          <div className="space-y-2">
            {filtered.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-white/10 bg-claude-dark-card/60 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-text-primary">{p.name}</p>
                    <p className="truncate text-xs text-text-muted">{p.email}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
                      <span
                        className="rounded px-1.5 py-0.5"
                        style={{
                          background: p.checkedIn
                            ? "rgba(74,222,128,0.15)"
                            : "rgba(255,255,255,0.06)",
                          color: p.checkedIn ? "#4ADE80" : "#78716C",
                        }}
                      >
                        {p.checkedIn ? "Checked in" : "Not checked in"}
                      </span>
                      {p.preRegistered && (
                        <span className="rounded bg-white/6 px-1.5 py-0.5 text-text-muted">
                          Pre-registered
                        </span>
                      )}
                      <span className="rounded bg-white/6 px-1.5 py-0.5 font-mono text-text-muted">
                        {p.coffeeCode}
                      </span>
                      {p.coffeeRedeemed && (
                        <span
                          className="rounded px-1.5 py-0.5"
                          style={{
                            background: "rgba(74,222,128,0.15)",
                            color: "#4ADE80",
                          }}
                        >
                          Coffee redeemed
                          {p.coffeeRedeemedAt ? ` · ${formatClock(p.coffeeRedeemedAt)}` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <DeleteButton
                    onClick={() => {
                      if (confirm(`Remove ${p.name}?`))
                        run(
                          { resource: "participant", action: "delete", id: p.id },
                          "Participant removed.",
                        );
                    }}
                  />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <select
                    className={inputCls}
                    value={p.role}
                    onChange={(e) =>
                      run({
                        resource: "participant",
                        action: "update",
                        id: p.id,
                        role: e.target.value,
                      })
                    }
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <select
                    className={inputCls}
                    value={p.teamId || ""}
                    onChange={(e) =>
                      run({
                        resource: "participant",
                        action: "update",
                        id: p.id,
                        teamId: e.target.value || null,
                      })
                    }
                  >
                    <option value="">— No team —</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="py-6 text-center text-sm text-text-muted">
                No participants {search ? "match your search" : "yet"}.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sortable table (primary admin view for team assignment) ─────── */
type TableSortKey = "name" | "email" | "role" | "team" | "checkedIn";

function SortableTable({
  participants,
  teams,
  sortKey,
  sortDir,
  onSort,
  run,
  busy,
}: {
  participants: AdminParticipant[];
  teams: AdminTeam[];
  sortKey: TableSortKey;
  sortDir: "asc" | "desc";
  onSort: (k: TableSortKey) => void;
  run: Runner;
  busy: boolean;
}) {
  if (participants.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-text-muted">
        No participants match your filters.
      </p>
    );
  }

  function Th({
    k,
    children,
    className,
  }: {
    k: TableSortKey;
    children: React.ReactNode;
    className?: string;
  }) {
    const active = sortKey === k;
    return (
      <th
        onClick={() => onSort(k)}
        scope="col"
        className={`cursor-pointer select-none px-2 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-text-muted hover:text-text-secondary ${className ?? ""}`}
      >
        <span className="inline-flex items-center gap-1">
          {children}
          <span className="text-[8px]" style={{ opacity: active ? 1 : 0.25 }}>
            {active ? (sortDir === "asc" ? "▲" : "▼") : "▲"}
          </span>
        </span>
      </th>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-white/5">
          <tr>
            <Th k="checkedIn" className="w-6 px-2 text-center">
              <span title="Checked in">●</span>
            </Th>
            <Th k="name">Name</Th>
            <Th k="role" className="hidden sm:table-cell">
              Role
            </Th>
            <Th k="team" className="w-[160px]">
              Team
            </Th>
            <th className="w-8 px-1" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {participants.map((p, i) => {
            const roleColor =
              p.role === "judge"
                ? { bg: "rgba(167,139,250,0.15)", text: "#A78BFA" }
                : p.role === "mentor"
                  ? { bg: "rgba(96,165,250,0.15)", text: "#60A5FA" }
                  : { bg: "rgba(255,255,255,0.06)", text: "#A8A29E" };
            return (
              <tr
                key={p.id}
                className="border-t border-white/5"
                style={{ background: i % 2 === 1 ? "rgba(255,255,255,0.02)" : undefined }}
              >
                <td className="px-2 py-1.5 text-center">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{
                      background: p.checkedIn ? "#4ADE80" : "rgba(255,255,255,0.15)",
                    }}
                    title={p.checkedIn ? "Checked in" : "Not checked in"}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <div className="truncate font-medium text-text-primary">{p.name}</div>
                  <div className="truncate text-[11px] text-text-muted">{p.email}</div>
                </td>
                <td className="hidden px-2 py-1.5 sm:table-cell">
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] capitalize"
                    style={{ background: roleColor.bg, color: roleColor.text }}
                  >
                    {p.role}
                  </span>
                </td>
                <td className="px-2 py-1.5">
                  <select
                    className={`${inputCls} text-xs`}
                    value={p.teamId || ""}
                    disabled={busy}
                    onChange={(e) =>
                      run({
                        resource: "participant",
                        action: "update",
                        id: p.id,
                        teamId: e.target.value || null,
                      })
                    }
                  >
                    <option value="">— No team —</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-1 py-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Remove ${p.name}?`))
                        run(
                          { resource: "participant", action: "delete", id: p.id },
                          "Participant removed.",
                        );
                    }}
                    className="rounded p-1 text-text-muted hover:bg-red-500/10 hover:text-red-400"
                    title="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CompactRow({
  p,
  teams,
  run,
  busy,
  stripe,
}: {
  p: AdminParticipant;
  teams: AdminTeam[];
  run: Runner;
  busy: boolean;
  stripe?: boolean;
}) {
  const roleColor =
    p.role === "judge"
      ? { bg: "rgba(167,139,250,0.15)", text: "#A78BFA" }
      : p.role === "mentor"
        ? { bg: "rgba(96,165,250,0.15)", text: "#60A5FA" }
        : { bg: "rgba(255,255,255,0.06)", text: "#A8A29E" };
  return (
    <div
      className="flex items-center gap-2 border-b border-white/5 px-3 py-2 last:border-b-0"
      style={{ background: stripe ? "rgba(255,255,255,0.02)" : "transparent" }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-text-primary">{p.name}</span>
          <span
            className="flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] capitalize"
            style={{ background: roleColor.bg, color: roleColor.text }}
          >
            {p.role}
          </span>
          {p.checkedIn && (
            <span className="flex-shrink-0 rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] text-green-300">
              in
            </span>
          )}
        </div>
        <p className="truncate text-[11px] text-text-muted">{p.email}</p>
      </div>
      <select
        className={`${inputCls} w-[140px] flex-shrink-0`}
        value={p.teamId || ""}
        disabled={busy}
        onChange={(e) =>
          run({
            resource: "participant",
            action: "update",
            id: p.id,
            teamId: e.target.value || null,
          })
        }
      >
        <option value="">— No team —</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => {
          if (confirm(`Remove ${p.name}?`))
            run({ resource: "participant", action: "delete", id: p.id }, "Participant removed.");
        }}
        className="flex-shrink-0 rounded p-1 text-text-muted hover:bg-red-500/10 hover:text-red-400"
        title="Remove"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ── By-team view (sections per team, with member count) ─────────── */
function ByTeamView({
  groups,
  teams,
  run,
  busy,
}: {
  groups: Array<{ team: AdminTeam | null; members: AdminParticipant[] }>;
  teams: AdminTeam[];
  run: Runner;
  busy: boolean;
}) {
  // Highlight unassigned bucket at the top if it has anyone in it.
  const unassignedGroup = groups.find((g) => g.team === null);
  const teamGroups = groups.filter((g) => g.team !== null);
  return (
    <div className="space-y-4">
      {unassignedGroup && unassignedGroup.members.length > 0 && (
        <TeamSection
          title="Unassigned"
          subtitle="People not yet on a team"
          color="#F59E0B"
          members={unassignedGroup.members}
          teams={teams}
          run={run}
          busy={busy}
          emphasised
        />
      )}
      {teamGroups.map((g) => {
        const team = g.team;
        if (!team) return null;
        return (
          <TeamSection
            key={team.id}
            title={team.name}
            subtitle={team.tableNumber ? `Table ${team.tableNumber}` : undefined}
            color={team.color}
            members={g.members}
            teams={teams}
            run={run}
            busy={busy}
          />
        );
      })}
    </div>
  );
}

function TeamSection({
  title,
  subtitle,
  color,
  members,
  teams,
  run,
  busy,
  emphasised,
}: {
  title: string;
  subtitle?: string;
  color: string;
  members: AdminParticipant[];
  teams: AdminTeam[];
  run: Runner;
  busy: boolean;
  emphasised?: boolean;
}) {
  return (
    <div
      className="overflow-hidden rounded-xl border bg-claude-dark-card/40"
      style={{
        borderColor: emphasised ? `${color}80` : "rgba(255,255,255,0.1)",
      }}
    >
      <div
        className="flex items-center justify-between gap-2 px-3 py-2"
        style={{
          background: emphasised ? `${color}15` : "rgba(255,255,255,0.03)",
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="inline-block h-3 w-3 flex-shrink-0 rounded-full"
            style={{ background: color }}
          />
          <span className="truncate text-sm font-semibold text-text-primary">{title}</span>
          {subtitle && <span className="truncate text-[11px] text-text-muted">· {subtitle}</span>}
        </div>
        <span className="flex-shrink-0 rounded bg-white/5 px-2 py-0.5 text-xs text-text-secondary">
          {members.length}
        </span>
      </div>
      {members.length === 0 ? (
        <p className="px-3 py-3 text-center text-xs text-text-muted">No one here yet.</p>
      ) : (
        members.map((p, i) => (
          <CompactRow key={p.id} p={p} teams={teams} run={run} busy={busy} stripe={i % 2 === 1} />
        ))
      )}
    </div>
  );
}

/* ── Teams ──────────────────────────────────────────────────────────── */
function TeamsTab({
  teams,
  participants,
  run,
  busy,
}: DashboardProps & { run: Runner; busy: boolean }) {
  const [newT, setNewT] = useState({ name: "", color: "#D4836A", tableNumber: "" });

  return (
    <div className="space-y-5">
      <Card>
        <SectionTitle>Add a team</SectionTitle>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            className={`${inputCls} flex-1`}
            placeholder="Team name"
            value={newT.name}
            onChange={(e) => setNewT({ ...newT, name: e.target.value })}
          />
          <input
            type="color"
            value={newT.color}
            onChange={(e) => setNewT({ ...newT, color: e.target.value })}
            className="h-10 w-12 rounded-lg border border-white/10 bg-claude-dark"
          />
          <input
            className={`${inputCls} w-24`}
            placeholder="Table"
            value={newT.tableNumber}
            onChange={(e) => setNewT({ ...newT, tableNumber: e.target.value })}
          />
          <button
            type="button"
            onClick={async () => {
              if (!newT.name.trim()) return;
              const ok = await run(
                {
                  resource: "team",
                  action: "create",
                  name: newT.name.trim(),
                  color: newT.color,
                  tableNumber: newT.tableNumber.trim() || null,
                },
                "Team created.",
              );
              if (ok) setNewT({ name: "", color: "#D4836A", tableNumber: "" });
            }}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg bg-claude-coral px-3 py-2 text-sm font-medium text-claude-dark hover:bg-claude-coral-light disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
      </Card>

      {/* Unassigned bucket up top — quick scan for who hasn't been placed yet. */}
      {(() => {
        const unassigned = participants.filter((p) => !p.teamId);
        if (unassigned.length === 0) return null;
        return (
          <div className="overflow-hidden rounded-xl border border-amber-500/40 bg-amber-500/5">
            <div className="flex items-center justify-between gap-2 bg-amber-500/10 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full bg-amber-400" />
                <span className="text-sm font-semibold text-text-primary">Unassigned</span>
                <span className="text-[11px] text-text-muted">· People not on a team yet</span>
              </div>
              <span className="rounded bg-white/5 px-2 py-0.5 text-xs text-text-secondary">
                {unassigned.length}
              </span>
            </div>
            {unassigned
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((p, i) => (
                <CompactRow
                  key={p.id}
                  p={p}
                  teams={teams}
                  run={run}
                  busy={busy}
                  stripe={i % 2 === 1}
                />
              ))}
          </div>
        );
      })()}

      <div className="space-y-2">
        {teams.map((t) => (
          <TeamRow
            key={`${t.id}:${t.name}:${t.color}:${t.tableNumber}`}
            team={t}
            members={participants
              .filter((p) => p.teamId === t.id)
              .sort((a, b) => a.name.localeCompare(b.name))}
            allTeams={teams}
            run={run}
            busy={busy}
          />
        ))}
        {teams.length === 0 && (
          <p className="py-6 text-center text-sm text-text-muted">No teams yet.</p>
        )}
      </div>
    </div>
  );
}
function TeamRow({
  team,
  members,
  allTeams,
  run,
  busy,
}: {
  team: AdminTeam;
  members: AdminParticipant[];
  allTeams: AdminTeam[];
  run: Runner;
  busy: boolean;
}) {
  const [name, setName] = useState(team.name);
  const [color, setColor] = useState(team.color);
  const [tableNumber, setTableNumber] = useState(team.tableNumber || "");

  return (
    <div className="rounded-xl border border-white/10 bg-claude-dark-card/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-9 w-10 rounded-lg border border-white/10 bg-claude-dark"
        />
        <input
          className={`${inputCls} flex-1`}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className={`${inputCls} w-20`}
          placeholder="Table"
          value={tableNumber}
          onChange={(e) => setTableNumber(e.target.value)}
        />
        <span className="text-xs text-text-muted">
          {team.count} {team.count === 1 ? "member" : "members"}
        </span>
        <SaveButton
          busy={busy}
          onClick={() =>
            run(
              {
                resource: "team",
                action: "update",
                id: team.id,
                name: name.trim(),
                color,
                tableNumber: tableNumber.trim() || null,
              },
              "Team updated.",
            )
          }
        />
        <DeleteButton
          onClick={() => {
            if (confirm(`Delete team "${team.name}"? Members will be unassigned.`))
              run({ resource: "team", action: "delete", id: team.id }, "Team deleted.");
          }}
        />
      </div>
      <div className="mt-2.5 border-t border-white/10 pt-2.5">
        {team.conceptSubmittedAt ? (
          <>
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-muted">
              <Lightbulb className="h-3.5 w-3.5" /> Team idea
            </p>
            <p className="mt-1 text-sm font-medium text-text-primary">{team.conceptTitle}</p>
            {team.conceptSummary && (
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-text-secondary">
                {team.conceptSummary}
              </p>
            )}
            {team.conceptRepoUrl && (
              <a
                href={team.conceptRepoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 rounded border border-white/10 bg-claude-dark px-2 py-0.5 text-[11px] font-mono text-text-secondary hover:border-claude-coral/40"
              >
                <ExternalLink className="h-3 w-3" />
                {team.conceptRepoUrl.replace(/^https?:\/\//, "")}
              </a>
            )}
            <p className="mt-1.5 text-xs text-text-muted">
              Submitted {formatClock(team.conceptSubmittedAt)}
            </p>
          </>
        ) : (
          <p className="flex items-center gap-1.5 text-xs text-text-muted">
            <Lightbulb className="h-3.5 w-3.5" /> No idea submitted yet
          </p>
        )}
      </div>

      {/* Members */}
      <div className="mt-2.5 overflow-hidden rounded-lg border border-white/5">
        {members.length === 0 ? (
          <p className="px-3 py-3 text-center text-xs text-text-muted">
            No members yet — use the dropdown on any participant to add them.
          </p>
        ) : (
          members.map((p, i) => (
            <CompactRow
              key={p.id}
              p={p}
              teams={allTeams}
              run={run}
              busy={busy}
              stripe={i % 2 === 1}
            />
          ))
        )}
      </div>
    </div>
  );
}

/* ── Problem statements ─────────────────────────────────────────────── */
function ProblemsTab({
  statements,
  participants,
  config,
  tallies,
  run,
  busy,
}: DashboardProps & { run: Runner; busy: boolean }) {
  const [newS, setNewS] = useState({ title: "", summary: "", description: "" });
  const checkedIn = participants.filter((p) => p.checkedIn).length;
  const totalVotes = Object.values(tallies).reduce((s, n) => s + n, 0);
  const leader = statements.reduce<{ id: string | null; votes: number }>(
    (acc, s) => {
      const v = tallies[s.id] || 0;
      return v > acc.votes ? { id: s.id, votes: v } : acc;
    },
    { id: null, votes: 0 },
  );

  return (
    <div className="space-y-5">
      {/* Big voting control */}
      <VotingControl
        votingOpen={config.votingOpen}
        winningStatementId={config.winningStatementId}
        statements={statements}
        tallies={tallies}
        totalVotes={totalVotes}
        checkedIn={checkedIn}
        leaderId={leader.id}
        run={run}
        busy={busy}
      />

      <Card>
        <SectionTitle>Add a problem statement</SectionTitle>
        <div className="mt-3 space-y-2">
          <input
            className={inputCls}
            placeholder="Title"
            value={newS.title}
            onChange={(e) => setNewS({ ...newS, title: e.target.value })}
          />
          <input
            className={inputCls}
            placeholder="One-line summary"
            value={newS.summary}
            onChange={(e) => setNewS({ ...newS, summary: e.target.value })}
          />
          <textarea
            className={inputCls}
            rows={3}
            placeholder="Full description"
            value={newS.description}
            onChange={(e) => setNewS({ ...newS, description: e.target.value })}
          />
        </div>
        <button
          type="button"
          onClick={async () => {
            if (!newS.title.trim() || !newS.summary.trim() || !newS.description.trim()) return;
            const ok = await run(
              {
                resource: "statement",
                action: "create",
                title: newS.title.trim(),
                summary: newS.summary.trim(),
                description: newS.description.trim(),
                order: statements.length,
              },
              "Problem statement added.",
            );
            if (ok) setNewS({ title: "", summary: "", description: "" });
          }}
          disabled={busy}
          className="mt-3 flex items-center gap-1.5 rounded-lg bg-claude-coral px-3 py-2 text-sm font-medium text-claude-dark hover:bg-claude-coral-light disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </Card>

      <div className="space-y-3">
        {statements.map((s) => (
          <StatementRow
            key={`${s.id}:${s.title}:${s.summary}:${s.description}:${s.order}`}
            statement={s}
            isWinner={config.winningStatementId === s.id}
            votes={tallies[s.id] || 0}
            run={run}
            busy={busy}
          />
        ))}
        {statements.length === 0 && (
          <p className="py-6 text-center text-sm text-text-muted">No problem statements yet.</p>
        )}
      </div>
    </div>
  );
}
function VotingControl({
  votingOpen,
  winningStatementId,
  statements,
  tallies,
  totalVotes,
  checkedIn,
  leaderId,
  run,
  busy,
}: {
  votingOpen: boolean;
  winningStatementId: string | null;
  statements: AdminStatement[];
  tallies: Record<string, number>;
  totalVotes: number;
  checkedIn: number;
  leaderId: string | null;
  run: Runner;
  busy: boolean;
}) {
  const winner = statements.find((s) => s.id === winningStatementId) || null;
  const leader = statements.find((s) => s.id === leaderId) || null;
  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        borderColor: votingOpen ? "rgba(74,222,128,0.4)" : "rgba(255,255,255,0.1)",
        background: votingOpen ? "rgba(74,222,128,0.06)" : "transparent",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{
              background: votingOpen ? "#4ADE80" : "#78716C",
              boxShadow: votingOpen ? "0 0 8px rgba(74,222,128,0.6)" : "none",
            }}
          />
          <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Voting is
          </span>
          <span className="text-sm font-bold" style={{ color: votingOpen ? "#4ADE80" : "#A8A29E" }}>
            {votingOpen ? "OPEN" : "closed"}
          </span>
        </div>
        <button
          type="button"
          onClick={() =>
            run(
              {
                resource: "settings",
                action: "update",
                votingOpen: !votingOpen,
              },
              votingOpen ? "Voting closed." : "Voting opened.",
            )
          }
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-60"
          style={{
            background: votingOpen ? "rgba(248,113,113,0.15)" : "#4ADE80",
            color: votingOpen ? "#FCA5A5" : "#160F0C",
            border: votingOpen ? "1px solid rgba(248,113,113,0.3)" : "none",
          }}
        >
          {votingOpen ? "Close voting" : "Open voting"}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-white/5 px-2 py-2">
          <p className="text-xl font-bold text-text-primary">{totalVotes}</p>
          <p className="text-[10px] uppercase tracking-wider text-text-muted">Votes cast</p>
        </div>
        <div className="rounded-lg bg-white/5 px-2 py-2">
          <p className="text-xl font-bold text-text-primary">{checkedIn}</p>
          <p className="text-[10px] uppercase tracking-wider text-text-muted">Checked in</p>
        </div>
        <div className="rounded-lg bg-white/5 px-2 py-2">
          <p className="text-xl font-bold text-text-primary">
            {checkedIn > 0 ? Math.round((totalVotes / checkedIn) * 100) : 0}%
          </p>
          <p className="text-[10px] uppercase tracking-wider text-text-muted">Turnout</p>
        </div>
      </div>

      {/* Live tallies */}
      {statements.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {statements.map((s) => {
            const count = tallies[s.id] || 0;
            const pct = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
            const isLeader = leaderId === s.id && totalVotes > 0;
            const isWinner = winningStatementId === s.id;
            return (
              <div key={s.id}>
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate text-text-secondary">
                    {s.title}
                    {isWinner && <Trophy className="ml-1 inline h-3 w-3 text-amber-300" />}
                  </span>
                  <span className="ml-2 flex-shrink-0 font-mono text-text-muted">
                    {count} · {Math.round(pct)}%
                  </span>
                </div>
                <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${pct}%`,
                      background: isWinner ? "#FBBF24" : isLeader ? "#4ADE80" : "#D4836A",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Winner controls */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
        <span className="text-xs text-text-muted">Announce winner:</span>
        <select
          className={`${inputCls} flex-1`}
          value={winningStatementId || ""}
          disabled={busy}
          onChange={(e) =>
            run(
              {
                resource: "settings",
                action: "update",
                winningStatementId: e.target.value || null,
              },
              e.target.value ? "Winner announced." : "Winner cleared.",
            )
          }
        >
          <option value="">— Not announced —</option>
          {statements.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} ({tallies[s.id] || 0} votes)
            </option>
          ))}
        </select>
        {leader && winningStatementId !== leader.id && totalVotes > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(
                {
                  resource: "settings",
                  action: "update",
                  winningStatementId: leader.id,
                },
                `Winner set: ${leader.title}`,
              )
            }
            className="rounded-lg bg-amber-500/15 px-3 py-2 text-xs font-medium text-amber-300 hover:bg-amber-500/25 disabled:opacity-60"
          >
            Pick leader (
            {leader.title
              .replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}]\s*/u, "")
              .slice(0, 18)}
            )
          </button>
        )}
      </div>

      {winner && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-300">
          <Trophy className="h-3.5 w-3.5" />
          Showing on portal: {winner.title}
        </p>
      )}
    </div>
  );
}

function StatementRow({
  statement,
  isWinner,
  votes,
  run,
  busy,
}: {
  statement: AdminStatement;
  isWinner: boolean;
  votes: number;
  run: Runner;
  busy: boolean;
}) {
  const [title, setTitle] = useState(statement.title);
  const [summary, setSummary] = useState(statement.summary);
  const [description, setDescription] = useState(statement.description);
  const [order, setOrder] = useState(String(statement.order));

  return (
    <div
      className="space-y-2 rounded-xl border bg-claude-dark-card/60 p-3"
      style={{
        borderColor: isWinner ? "rgba(251,191,36,0.4)" : "rgba(255,255,255,0.1)",
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">
          {votes} {votes === 1 ? "vote" : "votes"}
        </span>
        {isWinner && (
          <span className="flex items-center gap-1 text-xs font-medium text-amber-300">
            <Trophy className="h-3.5 w-3.5" /> Winner
          </span>
        )}
      </div>
      <input
        className={inputCls}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
      />
      <input
        className={inputCls}
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="Summary"
      />
      <textarea
        className={inputCls}
        rows={3}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
      />
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-text-muted">
          Order
          <input
            className={`${inputCls} w-16`}
            type="number"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
          />
        </label>
        <SaveButton
          busy={busy}
          onClick={() =>
            run(
              {
                resource: "statement",
                action: "update",
                id: statement.id,
                title: title.trim(),
                summary: summary.trim(),
                description: description.trim(),
                order: Number(order) || 0,
              },
              "Problem statement updated.",
            )
          }
        />
        <button
          type="button"
          onClick={() =>
            run(
              {
                resource: "settings",
                action: "update",
                winningStatementId: isWinner ? null : statement.id,
              },
              isWinner ? "Winner cleared." : "Winner set.",
            )
          }
          disabled={busy}
          className="rounded-lg border border-amber-400/30 px-3 py-2 text-sm text-amber-300 transition hover:bg-amber-400/10 disabled:opacity-60"
        >
          {isWinner ? "Clear winner" : "Mark as winner"}
        </button>
        <DeleteButton
          onClick={() => {
            if (confirm(`Delete "${statement.title}"?`))
              run(
                { resource: "statement", action: "delete", id: statement.id },
                "Problem statement deleted.",
              );
          }}
        />
      </div>
    </div>
  );
}

/* ── Schedule ───────────────────────────────────────────────────────── */
function ScheduleTab({ schedule, run, busy }: DashboardProps & { run: Runner; busy: boolean }) {
  const [newI, setNewI] = useState({ startTime: "", title: "", description: "", track: "" });

  return (
    <div className="space-y-5">
      <Card>
        <SectionTitle>Add a schedule item</SectionTitle>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            className={inputCls}
            placeholder="Time (e.g. 09:00)"
            value={newI.startTime}
            onChange={(e) => setNewI({ ...newI, startTime: e.target.value })}
          />
          <input
            className={inputCls}
            placeholder="Title"
            value={newI.title}
            onChange={(e) => setNewI({ ...newI, title: e.target.value })}
          />
          <input
            className={inputCls}
            placeholder="Track (optional)"
            value={newI.track}
            onChange={(e) => setNewI({ ...newI, track: e.target.value })}
          />
          <input
            className={inputCls}
            placeholder="Description (optional)"
            value={newI.description}
            onChange={(e) => setNewI({ ...newI, description: e.target.value })}
          />
        </div>
        <button
          type="button"
          onClick={async () => {
            if (!newI.startTime.trim() || !newI.title.trim()) return;
            const ok = await run(
              {
                resource: "schedule",
                action: "create",
                startTime: newI.startTime.trim(),
                title: newI.title.trim(),
                description: newI.description.trim() || null,
                track: newI.track.trim() || null,
                order: schedule.length,
              },
              "Schedule item added.",
            );
            if (ok) setNewI({ startTime: "", title: "", description: "", track: "" });
          }}
          disabled={busy}
          className="mt-3 flex items-center gap-1.5 rounded-lg bg-claude-coral px-3 py-2 text-sm font-medium text-claude-dark hover:bg-claude-coral-light disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </Card>

      <div className="space-y-2">
        {schedule.map((it) => (
          <ScheduleRow
            key={`${it.id}:${it.startTime}:${it.title}:${it.description}:${it.track}:${it.order}`}
            item={it}
            run={run}
            busy={busy}
          />
        ))}
        {schedule.length === 0 && (
          <p className="py-6 text-center text-sm text-text-muted">No schedule items yet.</p>
        )}
      </div>
    </div>
  );
}
function ScheduleRow({ item, run, busy }: { item: AdminScheduleItem; run: Runner; busy: boolean }) {
  const [startTime, setStartTime] = useState(item.startTime);
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description || "");
  const [track, setTrack] = useState(item.track || "");
  const [order, setOrder] = useState(String(item.order));

  return (
    <div className="space-y-2 rounded-xl border border-white/10 bg-claude-dark-card/60 p-3">
      <div className="flex gap-2">
        <input
          className={`${inputCls} w-24`}
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          placeholder="Time"
        />
        <input
          className={`${inputCls} flex-1`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
        />
      </div>
      <input
        className={inputCls}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
      />
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${inputCls} w-32`}
          value={track}
          onChange={(e) => setTrack(e.target.value)}
          placeholder="Track"
        />
        <label className="flex items-center gap-2 text-xs text-text-muted">
          Order
          <input
            className={`${inputCls} w-16`}
            type="number"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
          />
        </label>
        <SaveButton
          busy={busy}
          onClick={() =>
            run(
              {
                resource: "schedule",
                action: "update",
                id: item.id,
                startTime: startTime.trim(),
                title: title.trim(),
                description: description.trim() || null,
                track: track.trim() || null,
                order: Number(order) || 0,
              },
              "Schedule item updated.",
            )
          }
        />
        <DeleteButton
          onClick={() => {
            if (confirm(`Delete "${item.title}"?`))
              run(
                { resource: "schedule", action: "delete", id: item.id },
                "Schedule item deleted.",
              );
          }}
        />
      </div>
    </div>
  );
}

/* ── Resources ──────────────────────────────────────────────────────── */
function ResourcesTab({ resources, run, busy }: DashboardProps & { run: Runner; busy: boolean }) {
  const [newR, setNewR] = useState({ title: "", url: "", description: "", category: "General" });

  return (
    <div className="space-y-5">
      <Card>
        <SectionTitle>Add a resource</SectionTitle>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            className={inputCls}
            placeholder="Title"
            value={newR.title}
            onChange={(e) => setNewR({ ...newR, title: e.target.value })}
          />
          <input
            className={inputCls}
            placeholder="Category"
            value={newR.category}
            onChange={(e) => setNewR({ ...newR, category: e.target.value })}
          />
          <input
            className={`${inputCls} sm:col-span-2`}
            placeholder="https://…"
            value={newR.url}
            onChange={(e) => setNewR({ ...newR, url: e.target.value })}
          />
          <input
            className={`${inputCls} sm:col-span-2`}
            placeholder="Description (optional)"
            value={newR.description}
            onChange={(e) => setNewR({ ...newR, description: e.target.value })}
          />
        </div>
        <button
          type="button"
          onClick={async () => {
            if (!newR.title.trim() || !newR.url.trim()) return;
            const ok = await run(
              {
                resource: "resource",
                action: "create",
                title: newR.title.trim(),
                url: newR.url.trim(),
                description: newR.description.trim() || null,
                category: newR.category.trim() || "General",
                order: resources.length,
              },
              "Resource added.",
            );
            if (ok) setNewR({ title: "", url: "", description: "", category: "General" });
          }}
          disabled={busy}
          className="mt-3 flex items-center gap-1.5 rounded-lg bg-claude-coral px-3 py-2 text-sm font-medium text-claude-dark hover:bg-claude-coral-light disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </Card>

      <div className="space-y-2">
        {resources.map((r) => (
          <ResourceRow
            key={`${r.id}:${r.title}:${r.url}:${r.description}:${r.category}:${r.order}`}
            resource={r}
            run={run}
            busy={busy}
          />
        ))}
        {resources.length === 0 && (
          <p className="py-6 text-center text-sm text-text-muted">No resources yet.</p>
        )}
      </div>
    </div>
  );
}
function ResourceRow({
  resource,
  run,
  busy,
}: {
  resource: AdminResource;
  run: Runner;
  busy: boolean;
}) {
  const [title, setTitle] = useState(resource.title);
  const [url, setUrl] = useState(resource.url);
  const [description, setDescription] = useState(resource.description || "");
  const [category, setCategory] = useState(resource.category);
  const [order, setOrder] = useState(String(resource.order));

  return (
    <div className="space-y-2 rounded-xl border border-white/10 bg-claude-dark-card/60 p-3">
      <div className="flex gap-2">
        <input
          className={`${inputCls} flex-1`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
        />
        <a
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center rounded-lg border border-white/10 px-2 text-text-muted hover:text-claude-coral"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
      <input
        className={inputCls}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="URL"
      />
      <input
        className={inputCls}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
      />
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${inputCls} w-36`}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category"
        />
        <label className="flex items-center gap-2 text-xs text-text-muted">
          Order
          <input
            className={`${inputCls} w-16`}
            type="number"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
          />
        </label>
        <SaveButton
          busy={busy}
          onClick={() =>
            run(
              {
                resource: "resource",
                action: "update",
                id: resource.id,
                title: title.trim(),
                url: url.trim(),
                description: description.trim() || null,
                category: category.trim() || "General",
                order: Number(order) || 0,
              },
              "Resource updated.",
            )
          }
        />
        <DeleteButton
          onClick={() => {
            if (confirm(`Delete "${resource.title}"?`))
              run({ resource: "resource", action: "delete", id: resource.id }, "Resource deleted.");
          }}
        />
      </div>
    </div>
  );
}

/* ── Coffee code pool ───────────────────────────────────────────────── */
function CoffeeTab({ coffeePool, run, busy }: DashboardProps & { run: Runner; busy: boolean }) {
  const [target, setTarget] = useState(coffeePool.total > 0 ? coffeePool.total : 100);
  const [filter, setFilter] = useState<"all" | "unassigned" | "assigned" | "redeemed">("all");

  const filtered = coffeePool.codes.filter((c) => {
    if (filter === "unassigned") return !c.participantName;
    if (filter === "assigned") return c.participantName && !c.redeemed;
    if (filter === "redeemed") return c.redeemed;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-text-primary">Coffee code pool</h2>
        <p className="mt-1 text-xs text-text-muted">
          Fixed list of codes printed by the venue. Every participant who checks in claims the next
          unassigned code from this pool.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total", value: coffeePool.total },
          { label: "Assigned", value: coffeePool.assigned },
          { label: "Unassigned", value: coffeePool.unassigned },
          { label: "Redeemed", value: coffeePool.redeemed },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-white/10 bg-claude-dark-card/60 p-4"
          >
            <p className="text-2xl font-bold text-text-primary">{s.value}</p>
            <p className="text-xs text-text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="space-y-3 rounded-xl border border-white/10 bg-claude-dark-card/60 p-4">
        <SectionTitle>Pool actions</SectionTitle>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Target pool size
            <input
              type="number"
              min={1}
              max={1000}
              value={target}
              onChange={(e) => setTarget(Number(e.target.value) || 0)}
              className={`${inputCls} w-28`}
            />
          </label>
          <button
            type="button"
            disabled={busy || target < 1}
            onClick={() => {
              if (
                !confirm(
                  `Regenerate pool to ${target} codes? Codes already assigned to people are kept; only unassigned codes are replaced.`,
                )
              )
                return;
              run({ resource: "coffee", action: "regenerate", target }, "Pool regenerated.");
            }}
            className="flex items-center gap-1.5 rounded-lg bg-claude-coral px-3 py-2 text-sm font-medium text-claude-dark hover:opacity-90 disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" />
            Regenerate unassigned
          </button>
          <button
            type="button"
            disabled={busy || target < 1}
            onClick={() => {
              if (
                !confirm(
                  `RESET pool to ${target} brand-new codes? This wipes ALL existing codes — including ones already shown on coffee cards. Only do this before the event starts.`,
                )
              )
                return;
              run({ resource: "coffee", action: "reset", target }, "Pool reset.");
            }}
            className="flex items-center gap-1.5 rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Reset whole pool
          </button>
          <a
            href="/api/impact-lab/admin/coffee-codes"
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-sm text-text-secondary hover:bg-white/5"
            download
          >
            <Download className="h-4 w-4" />
            Download CSV
          </a>
        </div>
        {coffeePool.total === 0 && (
          <p className="text-xs text-amber-400">
            Pool is empty. Click <strong>Regenerate unassigned</strong> to create your first{" "}
            {target} codes.
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5">
        {(["all", "unassigned", "assigned", "redeemed"] as const).map((f) => (
          <button
            type="button"
            key={f}
            onClick={() => setFilter(f)}
            className="rounded-md px-2.5 py-1 text-xs capitalize"
            style={{
              background: filter === f ? "#D4836A" : "rgba(255,255,255,0.05)",
              color: filter === f ? "#160F0C" : "#A8A29E",
            }}
          >
            {f} (
            {f === "all"
              ? coffeePool.total
              : f === "unassigned"
                ? coffeePool.unassigned
                : f === "assigned"
                  ? coffeePool.assigned - coffeePool.redeemed
                  : coffeePool.redeemed}
            )
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-text-muted">
          No codes match this filter.
        </p>
      ) : (
        <ol className="space-y-1.5">
          {filtered.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-claude-dark-card/40 px-3 py-2 text-sm"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="w-8 text-right font-mono text-xs text-text-muted">{c.order}</span>
                <span className="font-mono font-semibold text-text-primary">{c.code}</span>
              </div>
              <div className="flex min-w-0 items-center gap-2 text-xs">
                {c.participantName ? (
                  <>
                    <span className="truncate text-text-secondary">{c.participantName}</span>
                    {c.teamName && (
                      <span className="rounded bg-white/5 px-1.5 py-0.5 text-text-muted">
                        {c.teamName}
                      </span>
                    )}
                    {c.redeemed ? (
                      <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-green-300">
                        redeemed{c.redeemedAt ? ` · ${formatClock(c.redeemedAt)}` : ""}
                      </span>
                    ) : (
                      <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-blue-300">
                        assigned
                      </span>
                    )}
                  </>
                ) : (
                  <span className="rounded bg-white/5 px-1.5 py-0.5 text-text-muted">
                    unassigned
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ── Settings ───────────────────────────────────────────────────────── */
function SettingsTab({ config, run, busy }: DashboardProps & { run: Runner; busy: boolean }) {
  const [eventName, setEventName] = useState(config.eventName);
  const [eventTagline, setEventTagline] = useState(config.eventTagline);
  const [eventDate, setEventDate] = useState(config.eventDate);
  const [accessCode, setAccessCode] = useState(config.accessCode);
  const [coffeeNote, setCoffeeNote] = useState(config.coffeeNote);
  const [newPassword, setNewPassword] = useState("");

  function field(label: string, node: React.ReactNode, hint?: string) {
    return (
      <div>
        {/* biome-ignore lint/a11y/noLabelWithoutControl: node is always a form control (input/textarea) passed by every call site and wraps inside this label */}
        <label className="block text-xs font-medium text-text-secondary">
          <span className="mb-1 block">{label}</span>
          {node}
        </label>
        {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle>Event</SectionTitle>
        <div className="mt-3 space-y-3">
          {field(
            "Event name",
            <input
              className={inputCls}
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
            />,
          )}
          {field(
            "Tagline",
            <input
              className={inputCls}
              value={eventTagline}
              onChange={(e) => setEventTagline(e.target.value)}
            />,
          )}
          {field(
            "Event date",
            <input
              className={inputCls}
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />,
          )}
        </div>
      </Card>

      <Card>
        <SectionTitle>Access</SectionTitle>
        <div className="mt-3 space-y-3">
          {field(
            "Participant access code",
            <input
              className={inputCls}
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
            />,
            "Participants enter this to check in. Shown on the room screen.",
          )}
          {field(
            "New admin password",
            <input
              type="password"
              className={inputCls}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Leave blank to keep current"
            />,
            "Changing this signs out other admin sessions.",
          )}
        </div>
      </Card>

      <Card>
        <SectionTitle>Coffee card</SectionTitle>
        <div className="mt-3">
          {field(
            "Note shown under the coffee card",
            <textarea
              className={inputCls}
              rows={2}
              value={coffeeNote}
              onChange={(e) => setCoffeeNote(e.target.value)}
            />,
          )}
        </div>
      </Card>

      <button
        type="button"
        onClick={async () => {
          const payload: Record<string, unknown> = {
            resource: "settings",
            action: "update",
            eventName: eventName.trim(),
            eventTagline: eventTagline.trim(),
            eventDate: eventDate.trim(),
            accessCode: accessCode.trim(),
            coffeeNote: coffeeNote.trim(),
          };
          if (newPassword.trim()) payload.adminPassword = newPassword.trim();
          const ok = await run(payload, "Settings saved.");
          if (ok) setNewPassword("");
        }}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-claude-coral px-4 py-3 text-sm font-semibold text-claude-dark transition hover:bg-claude-coral-light disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save settings"}
      </button>
    </div>
  );
}
