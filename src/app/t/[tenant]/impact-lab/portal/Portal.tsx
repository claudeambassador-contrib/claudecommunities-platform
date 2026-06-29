"use client";

import {
  AlertCircle,
  BookOpen,
  CalendarClock,
  Check,
  Coffee,
  ExternalLink,
  Home,
  Lightbulb,
  Loader2,
  LogOut,
  Pencil,
  Trophy,
  Users,
  Vote,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTenantRouter } from "@/components/TenantBaseProvider";
import type { PublicConfig } from "@/lib/services/impactLab";
import CoffeeCard from "./CoffeeCard";

interface Team {
  id: string;
  name: string;
  color: string;
  tableNumber: string | null;
  conceptTitle: string | null;
  conceptSummary: string | null;
  conceptRepoUrl: string | null;
  conceptSubmittedAt: string | null;
}

const fieldCls =
  "w-full rounded-xl border border-white/10 bg-claude-dark px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-claude-coral focus:outline-none";
interface Me {
  name: string;
  email: string;
  role: string;
  coffeeCode: string;
  coffeeRedeemed: boolean;
  coffeeRedeemedAt: string | null;
  team: Team | null;
  votedStatementId: string | null;
  peoplesChoiceVoteTeamId: string | null;
}
interface PortalTeam {
  id: string;
  name: string;
  color: string;
  tableNumber: string | null;
  conceptTitle: string | null;
  conceptRepoUrl: string | null;
}
interface Statement {
  id: string;
  title: string;
  summary: string;
  description: string;
}
interface ScheduleItem {
  id: string;
  startTime: string;
  title: string;
  description: string | null;
  track: string | null;
}
interface Resource {
  id: string;
  title: string;
  description: string | null;
  url: string;
  category: string;
}

interface PortalProps {
  config: PublicConfig;
  me: Me;
  teammates: { id: string; name: string; role: string }[];
  teams: PortalTeam[];
  statements: Statement[];
  schedule: ScheduleItem[];
  resources: Resource[];
  tallies: Record<string, number>;
  peoplesChoiceTallies: Record<string, number>;
  checkedInCount: number;
}

type TabKey = "home" | "schedule" | "coffee" | "vote" | "info";

const TABS: { key: TabKey; label: string; icon: typeof Home }[] = [
  { key: "home", label: "Home", icon: Home },
  { key: "schedule", label: "Schedule", icon: CalendarClock },
  { key: "coffee", label: "Coffee", icon: Coffee },
  { key: "vote", label: "Vote", icon: Vote },
  { key: "info", label: "Info", icon: BookOpen },
];

function roleStyle(role: string): { bg: string; text: string; label: string } {
  if (role === "mentor") return { bg: "rgba(96,165,250,0.15)", text: "#60A5FA", label: "Mentor" };
  if (role === "judge") return { bg: "rgba(167,139,250,0.15)", text: "#A78BFA", label: "Judge" };
  return { bg: "rgba(212,131,106,0.15)", text: "#D4836A", label: "Participant" };
}

export default function Portal(props: PortalProps) {
  const router = useTenantRouter();
  const [tab, setTab] = useState<TabKey>("home");
  const [tallies, setTallies] = useState<Record<string, number>>(props.tallies);
  const [voted, setVoted] = useState<string | null>(props.me.votedStatementId);
  const [loggingOut, setLoggingOut] = useState(false);

  const totalVotes = Object.values(tallies).reduce((s, n) => s + n, 0);
  const winner = props.config.winningStatementId
    ? (props.statements.find((s) => s.id === props.config.winningStatementId) ?? null)
    : null;
  const firstName = props.me.name.split(" ")[0];

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/impact-lab/auth", { method: "DELETE" });
      router.push("/impact-lab");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col pb-24">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-claude-dark/90 px-5 py-3.5 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text-primary">
              {props.config.eventName}
            </p>
            <p className="text-xs text-text-muted">{props.config.eventDate}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-text-secondary transition hover:bg-white/5 disabled:opacity-50"
          >
            {loggingOut ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <LogOut className="h-3.5 w-3.5" />
            )}
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 px-5 py-6">
        {tab === "home" && (
          <HomeTab
            me={props.me}
            firstName={firstName}
            teammates={props.teammates}
            checkedInCount={props.checkedInCount}
            config={props.config}
            winner={winner}
            voted={voted}
            onGoVote={() => setTab("vote")}
            schedule={props.schedule}
          />
        )}
        {tab === "schedule" && <ScheduleTab items={props.schedule} />}
        {tab === "coffee" && <CoffeeTab me={props.me} note={props.config.coffeeNote} />}
        {tab === "vote" && (
          <div className="space-y-8">
            {/* Section 1: People's Choice (end-of-day). Shown above the morning vote so
                it's the first thing voters see after pitches. */}
            {(props.config.peoplesChoiceOpen || props.config.peoplesChoiceWinnerTeamId) && (
              <section>
                <SectionHeader
                  eyebrow="End of day"
                  title="People's Choice"
                  caption="Vote for the team whose pitch you liked most."
                  accent="#FBBF24"
                />
                <PeoplesChoiceCard
                  teams={props.teams}
                  initialTallies={props.peoplesChoiceTallies}
                  myTeamId={props.me.team?.id ?? null}
                  initialVoteTeamId={props.me.peoplesChoiceVoteTeamId}
                  votingOpen={props.config.peoplesChoiceOpen}
                  winnerTeamId={props.config.peoplesChoiceWinnerTeamId}
                  checkedInCount={props.checkedInCount}
                />
              </section>
            )}

            {/* Section 2: morning problem-statement vote. */}
            <section>
              <SectionHeader
                eyebrow="This morning"
                title="Problem statements"
                caption={
                  winner
                    ? "The vote is in — this is what we built."
                    : props.config.votingOpen
                      ? "Pick the problem you want the room to build on."
                      : "Voting is closed."
                }
                accent="#D4836A"
              />
              <VoteTab
                statements={props.statements}
                tallies={tallies}
                totalVotes={totalVotes}
                checkedInCount={props.checkedInCount}
                voted={voted}
                votingOpen={props.config.votingOpen}
                winner={winner}
                onVote={async (id) => {
                  const res = await fetch("/api/impact-lab/vote", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ statementId: id }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    setVoted(id);
                    if (data.tallies) setTallies(data.tallies);
                    return { ok: true as const };
                  }
                  return { ok: false as const, error: data.error || "Vote failed" };
                }}
              />
            </section>
          </div>
        )}
        {tab === "info" && <InfoTab resources={props.resources} />}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-1/2 z-20 w-full max-w-2xl -translate-x-1/2 border-t border-white/10 bg-claude-dark/95 backdrop-blur-md">
        <div className="flex">
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = tab === key;
            return (
              <button
                type="button"
                key={key}
                onClick={() => setTab(key)}
                className="flex flex-1 flex-col items-center gap-1 py-2.5 transition"
                style={{ color: active ? "#D4836A" : "#78716C" }}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

/* ── Home ───────────────────────────────────────────────────────────── */
/** Parse a display time like "8:00 AM" or "12:35 PM" into a Date in today's
 * local time. Returns null on bad input. */
function parseScheduleTime(s: string): Date | null {
  const m = s.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const meridiem = m[3].toUpperCase();
  if (meridiem === "PM" && hour !== 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  const d = new Date();
  d.setHours(hour, min, 0, 0);
  return d;
}

function HomeTab({
  me,
  firstName,
  teammates,
  checkedInCount,
  config,
  winner,
  voted,
  onGoVote,
  schedule,
}: {
  me: Me;
  firstName: string;
  teammates: { id: string; name: string; role: string }[];
  checkedInCount: number;
  config: PublicConfig;
  winner: Statement | null;
  voted: string | null;
  onGoVote: () => void;
  schedule: ScheduleItem[];
}) {
  const rs = roleStyle(me.role);

  // Tick once a minute so the "current" and "next" items update through the day.
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Find what's happening NOW (most recent item whose time has already
  // passed) and the next 2 items after that. Falls back to the first three
  // items if nothing in the schedule has started yet.
  const decorated = schedule.map((it) => ({
    item: it,
    when: parseScheduleTime(it.startTime),
  }));
  const timed = decorated.filter((d): d is typeof d & { when: Date } => d.when !== null);
  const pastOrNow = timed
    .filter((d) => d.when <= now)
    .sort((a, b) => a.when.getTime() - b.when.getTime());
  const upcoming = timed
    .filter((d) => d.when > now)
    .sort((a, b) => a.when.getTime() - b.when.getTime());
  const currentItem = pastOrNow.length > 0 ? pastOrNow[pastOrNow.length - 1] : null;
  const nextItems = currentItem
    ? [currentItem, ...upcoming.slice(0, 2)].map((d) => d.item)
    : schedule.slice(0, 3);
  const heading = currentItem ? "Right now" : "Starting the day";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Welcome, {firstName}.</h1>
        <div className="mt-2 flex items-center gap-2">
          <span
            className="rounded-full px-2.5 py-1 text-xs font-medium"
            style={{ background: rs.bg, color: rs.text }}
          >
            {rs.label}
          </span>
          <span className="text-xs text-text-muted">{checkedInCount} checked in</span>
        </div>
      </div>

      {winner && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-300">
            <Trophy className="h-4 w-4" /> The room has chosen
          </p>
          <p className="mt-1.5 text-lg font-semibold text-text-primary">{winner.title}</p>
          <p className="mt-0.5 text-sm text-text-secondary">{winner.summary}</p>
        </div>
      )}

      {/* Urgent: People's Choice is open but our team hasn't named their
          solution yet — voters will see "(no name yet)" until we submit. */}
      {config.peoplesChoiceOpen && me.team && !me.team.conceptTitle?.trim() && (
        <div className="rounded-2xl border-2 border-amber-400/60 bg-amber-400/10 p-4">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-300">
            <AlertCircle className="h-4 w-4" /> Action needed
          </p>
          <p className="mt-1.5 text-sm font-semibold text-text-primary">
            Your team needs a solution name
          </p>
          <p className="mt-0.5 text-sm text-text-secondary">
            People&apos;s Choice voting is open. Voters can&apos;t see your pitch by name until any
            teammate enters one below.
          </p>
        </div>
      )}

      <TeamPanel me={me} teammates={teammates} />

      {/* Voting prompt */}
      {config.votingOpen && !winner && (
        <button
          type="button"
          onClick={onGoVote}
          className="flex w-full items-center justify-between rounded-2xl border border-claude-coral/30 bg-claude-coral/10 p-4 text-left transition hover:bg-claude-coral/15"
        >
          <div>
            <p className="text-sm font-semibold text-text-primary">
              {voted ? "Voting is still open" : "Voting is open — have your say"}
            </p>
            <p className="text-xs text-text-secondary">
              {voted
                ? "Tap to review or change your pick."
                : "The room picks the problem we all build on."}
            </p>
          </div>
          <Vote className="h-5 w-5 text-claude-coral" />
        </button>
      )}

      {/* People's Choice prompt */}
      {(config.peoplesChoiceOpen || config.peoplesChoiceWinnerTeamId) && (
        <button
          type="button"
          onClick={onGoVote}
          className="flex w-full items-center justify-between rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4 text-left transition hover:bg-amber-400/15"
        >
          <div>
            <p className="text-sm font-semibold text-text-primary">
              {config.peoplesChoiceWinnerTeamId
                ? "People's Choice has a winner"
                : "People's Choice is open — pick your favourite pitch"}
            </p>
            <p className="text-xs text-text-secondary">
              {config.peoplesChoiceWinnerTeamId
                ? "Tap to see who took it."
                : "Vote for the team whose pitch you liked most."}
            </p>
          </div>
          <Trophy className="h-5 w-5 text-amber-300" />
        </button>
      )}

      {/* What's happening now / next */}
      {nextItems.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">
            {heading}
          </p>
          <div className="space-y-2">
            {nextItems.map((it, idx) => {
              const isCurrent = currentItem !== null && idx === 0;
              return (
                <div
                  key={it.id}
                  className="flex gap-3 rounded-xl border p-3"
                  style={{
                    borderColor: isCurrent ? "rgba(212,131,106,0.4)" : "rgba(255,255,255,0.1)",
                    background: isCurrent ? "rgba(212,131,106,0.08)" : "rgba(28,21,18,0.6)",
                  }}
                >
                  <span className="font-mono text-sm font-semibold text-claude-coral">
                    {it.startTime}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text-primary">{it.title}</p>
                    {isCurrent && (
                      <p className="mt-0.5 text-[10px] uppercase tracking-wider text-claude-coral">
                        Now
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Team panel: identity, rename, concept ──────────────────────────── */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: cohesive panel combining team identity, rename form, and concept-edit form; splitting would fragment shared local state across components
function TeamPanel({
  me,
  teammates,
}: {
  me: Me;
  teammates: { id: string; name: string; role: string }[];
}) {
  const router = useTenantRouter();
  const team = me.team;
  const accent = team?.color || "#D4836A";

  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(team?.name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const conceptSubmitted = Boolean(team?.conceptSubmittedAt);
  const [editingConcept, setEditingConcept] = useState(!conceptSubmitted);
  const [title, setTitle] = useState(team?.conceptTitle ?? "");
  const [summary, setSummary] = useState(team?.conceptSummary ?? "");
  const [repoUrl, setRepoUrl] = useState(team?.conceptRepoUrl ?? "");
  const [savingConcept, setSavingConcept] = useState(false);
  const [conceptError, setConceptError] = useState<string | null>(null);

  async function saveName() {
    const next = draftName.trim();
    if (!next) {
      setNameError("Give your team a name.");
      return;
    }
    setSavingName(true);
    setNameError(null);
    try {
      const res = await fetch("/api/impact-lab/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rename", name: next }),
      });
      const data = await res.json();
      if (res.ok) {
        setRenaming(false);
        router.refresh();
      } else {
        setNameError(data.error || "Could not rename the team.");
      }
    } catch {
      setNameError("Network hiccup — try again.");
    } finally {
      setSavingName(false);
    }
  }

  async function saveConcept() {
    const t = title.trim();
    const s = summary.trim();
    const r = repoUrl.trim();
    if (!t) {
      setConceptError("Add a name for your team's solution.");
      return;
    }
    if (r && !/^https?:\/\//i.test(r)) {
      setConceptError("Repo link needs to start with https://");
      return;
    }
    setSavingConcept(true);
    setConceptError(null);
    try {
      const res = await fetch("/api/impact-lab/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "concept",
          title: t,
          ...(s ? { summary: s } : {}),
          // Always send repoUrl so an emptied field clears the stored value.
          repoUrl: r,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setEditingConcept(false);
        router.refresh();
      } else {
        setConceptError(data.error || "Could not submit your idea.");
      }
    } catch {
      setConceptError("Network hiccup — try again.");
    } finally {
      setSavingConcept(false);
    }
  }

  if (!team) {
    return (
      <div
        className="rounded-2xl border border-white/10 p-5"
        style={{ background: "linear-gradient(135deg, #D4836A22, transparent 70%)" }}
      >
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-text-muted">
          <Users className="h-3.5 w-3.5" /> Your team
        </p>
        <p className="mt-1.5 text-sm text-text-secondary">
          You haven&apos;t been placed on a team yet — an organiser will sort this out shortly.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Team card */}
      <div
        className="rounded-2xl border border-white/10 p-5"
        style={{ background: `linear-gradient(135deg, ${accent}22, transparent 70%)` }}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-text-muted">
            <Users className="h-3.5 w-3.5" /> Your team
          </p>
          {!renaming && (
            <button
              type="button"
              onClick={() => {
                setDraftName(team.name);
                setNameError(null);
                setRenaming(true);
              }}
              className="inline-flex flex-shrink-0 items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-xs text-text-secondary transition hover:bg-white/5"
            >
              <Pencil className="h-3 w-3" /> Rename
            </button>
          )}
        </div>

        {renaming ? (
          <div className="mt-2.5 space-y-2">
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              maxLength={80}
              // biome-ignore lint/a11y/noAutofocus: in-flow rename form revealed only on user click
              autoFocus
              placeholder="Team name"
              className={fieldCls}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveName}
                disabled={savingName}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-claude-coral px-3.5 py-2 text-sm font-semibold text-claude-dark transition hover:bg-claude-coral-light disabled:opacity-60"
              >
                {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save name"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRenaming(false);
                  setNameError(null);
                }}
                className="rounded-xl border border-white/10 px-3 py-2 text-sm text-text-secondary transition hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
            {nameError && <FieldError text={nameError} />}
          </div>
        ) : (
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span
              className="h-3 w-3 rounded-full ring-2 ring-white/20"
              style={{ background: accent }}
            />
            <span className="text-lg font-semibold text-text-primary">{team.name}</span>
            {team.tableNumber && (
              <span className="text-sm text-text-muted">· Table {team.tableNumber}</span>
            )}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
          {teammates.map((t) => {
            const tr = roleStyle(t.role);
            return (
              <span
                key={t.id}
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-text-secondary"
              >
                {t.name}
                {t.role !== "participant" && <span style={{ color: tr.text }}> · {tr.label}</span>}
              </span>
            );
          })}
        </div>
      </div>

      {/* Concept card */}
      <div className="rounded-2xl border border-white/10 bg-claude-dark-card/60 p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-text-muted">
            <Lightbulb className="h-3.5 w-3.5" /> Your idea
          </p>
          {conceptSubmitted && !editingConcept && (
            <button
              type="button"
              onClick={() => {
                setTitle(team.conceptTitle ?? "");
                setSummary(team.conceptSummary ?? "");
                setRepoUrl(team.conceptRepoUrl ?? "");
                setConceptError(null);
                setEditingConcept(true);
              }}
              className="inline-flex flex-shrink-0 items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-xs text-text-secondary transition hover:bg-white/5"
            >
              <Pencil className="h-3 w-3" /> Edit
            </button>
          )}
        </div>

        {conceptSubmitted && !editingConcept ? (
          <div className="mt-2">
            <p className="text-base font-semibold text-text-primary">{team.conceptTitle}</p>
            {team.conceptSummary && (
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
                {team.conceptSummary}
              </p>
            )}
            {team.conceptRepoUrl ? (
              <a
                href={team.conceptRepoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-claude-dark px-2.5 py-1 text-xs font-mono text-text-secondary transition hover:border-claude-coral/40 hover:bg-white/5"
              >
                <ExternalLink className="h-3 w-3" />
                {team.conceptRepoUrl.replace(/^https?:\/\//, "")}
              </a>
            ) : (
              <InlineRepoAdd
                currentTitle={team.conceptTitle ?? ""}
                currentSummary={team.conceptSummary ?? ""}
                onSaved={() => {
                  // Pull fresh server state into the form so the badge appears.
                  router.refresh();
                }}
              />
            )}
            <p className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-emerald-300">
              <Check className="h-3.5 w-3.5" />
              Submitted
              {team.conceptSubmittedAt ? ` · ${formatTime(team.conceptSubmittedAt)}` : ""}
            </p>
          </div>
        ) : (
          <div className="mt-2.5 space-y-2">
            <p className="text-sm text-text-secondary">
              Name your solution — voters will see this in the People&apos;s Choice vote.
              Description + repo are optional.
            </p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="Solution name"
              className={fieldCls}
            />
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="What does it do? (optional)"
              className={`${fieldCls} resize-y`}
            />
            <input
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              maxLength={400}
              placeholder="https://github.com/your-team/your-repo (optional)"
              className={fieldCls}
              type="url"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveConcept}
                disabled={savingConcept}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-claude-coral px-3.5 py-2 text-sm font-semibold text-claude-dark transition hover:bg-claude-coral-light disabled:opacity-60"
              >
                {savingConcept ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : conceptSubmitted ? (
                  "Update"
                ) : (
                  "Submit"
                )}
              </button>
              {conceptSubmitted && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingConcept(false);
                    setConceptError(null);
                  }}
                  className="rounded-xl border border-white/10 px-3 py-2 text-sm text-text-secondary transition hover:bg-white/5"
                >
                  Cancel
                </button>
              )}
            </div>
            {conceptError && <FieldError text={conceptError} />}
          </div>
        )}
      </div>
    </>
  );
}

/** Quick inline form on the submitted-state Concept card so a team that
 * locked in a solution name earlier can add a GitHub link without finding
 * the Edit button. Preserves the existing title + summary. */
function InlineRepoAdd({
  currentTitle,
  currentSummary,
  onSaved,
}: {
  currentTitle: string;
  currentSummary: string;
  onSaved: () => void;
}) {
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const u = url.trim();
    if (!u) {
      setError("Paste a link first.");
      return;
    }
    if (!/^https?:\/\//i.test(u)) {
      setError("Link must start with https://");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/impact-lab/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "concept",
          title: currentTitle,
          summary: currentSummary,
          repoUrl: u,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onSaved();
      } else {
        setError(data.error || "Could not save.");
      }
    } catch {
      setError("Network hiccup — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-dashed border-white/15 bg-claude-dark/40 p-3">
      <p className="mb-1.5 text-xs font-medium text-text-secondary">
        + Add a project / GitHub link (optional)
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void save();
          }}
          placeholder="https://github.com/your-team/your-repo"
          className={`${fieldCls} flex-1`}
          type="url"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          maxLength={400}
        />
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-claude-coral px-3.5 py-2 text-sm font-semibold text-claude-dark transition hover:bg-claude-coral-light disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save link"}
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-300">{error}</p>}
    </div>
  );
}

function FieldError({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <span>{text}</span>
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/* ── Schedule ───────────────────────────────────────────────────────── */
function ScheduleTab({ items }: { items: ScheduleItem[] }) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-text-primary">Schedule</h2>
      <p className="mt-1 text-sm text-text-muted">How the day runs.</p>
      {items.length === 0 ? (
        <EmptyNote text="The schedule will appear here once it's published." />
      ) : (
        <ol className="mt-5 space-y-3">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex gap-4 rounded-2xl border border-white/10 bg-claude-dark-card/60 p-4"
            >
              <div className="flex flex-col items-center">
                <span className="font-mono text-sm font-bold text-claude-coral">
                  {it.startTime}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-text-primary">{it.title}</p>
                  {it.track && (
                    <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-text-muted">
                      {it.track}
                    </span>
                  )}
                </div>
                {it.description && (
                  <p className="mt-0.5 text-sm text-text-secondary">{it.description}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ── Coffee ─────────────────────────────────────────────────────────── */
function CoffeeTab({ me, note }: { me: Me; note: string }) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-text-primary">Coffee card</h2>
      <p className="mt-1 text-sm text-text-muted">
        Your card to a free cup. Tap it to flip and reveal your code.
      </p>
      <div className="mt-8">
        <CoffeeCard
          name={me.name}
          role={roleStyle(me.role).label}
          team={me.team}
          coffeeCode={me.coffeeCode}
          note={note}
          redeemed={me.coffeeRedeemed}
          redeemedAt={me.coffeeRedeemedAt}
        />
      </div>
    </div>
  );
}

/* ── Section header for the Vote tab ────────────────────────────────── */
function SectionHeader({
  eyebrow,
  title,
  caption,
  accent,
}: {
  eyebrow: string;
  title: string;
  caption: string;
  accent: string;
}) {
  return (
    <div className="mb-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: accent }}>
        {eyebrow}
      </p>
      <h2 className="mt-0.5 text-2xl font-semibold text-text-primary">{title}</h2>
      <p className="mt-1 text-sm text-text-secondary">{caption}</p>
      <div className="mt-3 h-px w-12 rounded-full" style={{ background: accent }} />
    </div>
  );
}

/* ── Vote ───────────────────────────────────────────────────────────── */
function VoteTab({
  statements,
  tallies,
  totalVotes,
  checkedInCount,
  voted,
  votingOpen,
  winner,
  onVote,
}: {
  statements: Statement[];
  tallies: Record<string, number>;
  totalVotes: number;
  checkedInCount: number;
  voted: string | null;
  votingOpen: boolean;
  winner: Statement | null;
  onVote: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleVote(id: string) {
    if (busyId) return;
    setBusyId(id);
    setError(null);
    const res = await onVote(id);
    if (!res.ok) setError(res.error);
    setBusyId(null);
  }

  return (
    <div>
      {!winner && (
        <p className="text-xs text-text-muted">
          {totalVotes} of {checkedInCount} votes cast
        </p>
      )}

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-5 space-y-3">
        {/* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: per-row render combining vote-state, tally bars, and conditional interaction branches; extraction would not reduce overall branching */}
        {statements.map((s) => {
          const count = tallies[s.id] || 0;
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const isPick = voted === s.id;
          const isWinner = winner?.id === s.id;
          return (
            <div
              key={s.id}
              className="overflow-hidden rounded-2xl border bg-claude-dark-card/60"
              style={{
                borderColor: isWinner
                  ? "rgba(251,191,36,0.4)"
                  : isPick
                    ? "rgba(212,131,106,0.4)"
                    : "rgba(255,255,255,0.1)",
              }}
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-text-primary">{s.title}</h3>
                      {isWinner && <Trophy className="h-4 w-4 text-amber-300" />}
                    </div>
                    <p className="mt-0.5 text-sm text-text-secondary">{s.summary}</p>
                  </div>
                  <span className="flex-shrink-0 text-right">
                    <span className="block text-lg font-bold text-text-primary">{count}</span>
                    <span className="text-[10px] uppercase text-text-muted">
                      {count === 1 ? "vote" : "votes"}
                    </span>
                  </span>
                </div>

                <p className="mt-2 text-sm leading-relaxed text-text-muted">{s.description}</p>

                {/* Result bar */}
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      background: isWinner ? "#FBBF24" : "#D4836A",
                    }}
                  />
                </div>

                {votingOpen && !winner && (
                  <button
                    type="button"
                    onClick={() => handleVote(s.id)}
                    disabled={!!busyId}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60"
                    style={{
                      background: isPick ? "rgba(212,131,106,0.15)" : "#D4836A",
                      color: isPick ? "#D4836A" : "#160F0C",
                      border: isPick ? "1px solid rgba(212,131,106,0.4)" : "1px solid transparent",
                    }}
                  >
                    {busyId === s.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isPick ? (
                      <>
                        <Check className="h-4 w-4" /> Your pick
                      </>
                    ) : voted ? (
                      "Switch to this"
                    ) : (
                      "Vote for this"
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {statements.length === 0 && (
        <EmptyNote text="Problem statements will appear here once they're published." />
      )}
    </div>
  );
}

/* ── People's Choice (end-of-day team award) ───────────────────────── */
function PeoplesChoiceCard({
  teams,
  initialTallies,
  myTeamId,
  initialVoteTeamId,
  votingOpen,
  winnerTeamId,
  checkedInCount,
}: {
  teams: PortalTeam[];
  initialTallies: Record<string, number>;
  myTeamId: string | null;
  initialVoteTeamId: string | null;
  votingOpen: boolean;
  winnerTeamId: string | null;
  checkedInCount: number;
}) {
  const [tallies, setTallies] = useState(initialTallies);
  const [voted, setVoted] = useState<string | null>(initialVoteTeamId);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Poll every 4s while the vote is open OR a winner is announced — keeps
  // everyone's screen showing the same numbers without manual refresh.
  useEffect(() => {
    if (!votingOpen && !winnerTeamId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/impact-lab/peoples-choice", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.tallies) setTallies(data.tallies);
      } catch {
        // Silent: transient network blip; next tick will retry.
      }
    };
    tick();
    const t = setInterval(tick, 4000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [votingOpen, winnerTeamId]);

  const totalVotes = Object.values(tallies).reduce((s, n) => s + n, 0);
  const sortedTeams = [...teams].sort((a, b) => {
    const an = a.tableNumber ? Number.parseInt(a.tableNumber, 10) : NaN;
    const bn = b.tableNumber ? Number.parseInt(b.tableNumber, 10) : NaN;
    if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
    return a.name.localeCompare(b.name);
  });
  const winner = teams.find((t) => t.id === winnerTeamId) ?? null;

  async function castVote(teamId: string) {
    if (busyId) return;
    setBusyId(teamId);
    setError(null);
    // Optimistic update — feels instant even on slow networks.
    const prevVoted = voted;
    const optimistic = { ...tallies };
    if (prevVoted) optimistic[prevVoted] = Math.max(0, (optimistic[prevVoted] || 0) - 1);
    optimistic[teamId] = (optimistic[teamId] || 0) + 1;
    setTallies(optimistic);
    setVoted(teamId);
    try {
      const res = await fetch("/api/impact-lab/peoples-choice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.tallies) setTallies(data.tallies);
      } else {
        // Roll back optimistic update on error
        setVoted(prevVoted);
        setTallies(tallies);
        setError(data.error || "Vote failed — try again.");
      }
    } catch {
      setVoted(prevVoted);
      setTallies(tallies);
      setError("Network blip — try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div
      className="overflow-hidden rounded-2xl border p-5"
      style={{
        borderColor: winner
          ? "rgba(251,191,36,0.4)"
          : votingOpen
            ? "rgba(251,191,36,0.25)"
            : "rgba(255,255,255,0.1)",
        background: winner
          ? "rgba(251,191,36,0.06)"
          : votingOpen
            ? "rgba(251,191,36,0.03)"
            : "transparent",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-amber-300">
          <Trophy className="h-4 w-4" />
          {winner
            ? "And the winner is…"
            : votingOpen
              ? "Vote — not your own team"
              : "Voting closed"}
        </p>
        {votingOpen && !winner && (
          <span className="flex-shrink-0 text-right text-xs text-text-muted">
            {totalVotes} / {checkedInCount} votes in
          </span>
        )}
      </div>

      {winner && (
        <div className="mt-3 rounded-xl border border-amber-300/40 bg-amber-300/10 p-4">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ background: winner.color }}
            />
            <p className="text-lg font-bold text-text-primary">{winner.name}</p>
          </div>
          {winner.conceptTitle && (
            <p className="mt-1 text-sm text-text-secondary">{winner.conceptTitle}</p>
          )}
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {votingOpen && (
        <div className="mt-4 space-y-2">
          {/* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: per-team render combining tally bars, own-team guards, and conditional vote-button branches; extraction would not reduce overall branching */}
          {sortedTeams.map((t) => {
            const count = tallies[t.id] || 0;
            const pct = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
            const isMine = myTeamId === t.id;
            const isPicked = voted === t.id;
            const busy = busyId === t.id;
            const subline = t.conceptTitle?.trim()
              ? `${t.name}${t.tableNumber ? ` · tbl ${t.tableNumber}` : ""}`
              : t.tableNumber
                ? `tbl ${t.tableNumber}`
                : null;
            const repoHost = t.conceptRepoUrl
              ? (() => {
                  try {
                    return new URL(t.conceptRepoUrl).host.replace(/^www\./, "");
                  } catch {
                    return null;
                  }
                })()
              : null;
            return (
              <button
                type="button"
                key={t.id}
                onClick={() => !isMine && castVote(t.id)}
                disabled={isMine || busyId !== null}
                className="block w-full overflow-hidden rounded-xl border p-3.5 text-left transition disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  borderColor: isPicked ? `${t.color}80` : "rgba(255,255,255,0.1)",
                  background: isPicked ? `${t.color}15` : "rgba(28,21,18,0.6)",
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <span
                      className="mt-1.5 inline-block h-3 w-3 flex-shrink-0 rounded-full"
                      style={{ background: t.color }}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span
                          className="truncate text-base font-semibold text-text-primary"
                          style={
                            t.conceptTitle?.trim()
                              ? undefined
                              : { color: "#A8A29E", fontStyle: "italic" }
                          }
                        >
                          {t.conceptTitle?.trim() || `${t.name} (no name yet)`}
                        </span>
                        {isMine && (
                          <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-text-muted">
                            Your team
                          </span>
                        )}
                      </div>
                      {subline && (
                        <p className="mt-0.5 truncate text-[11px] text-text-muted">{subline}</p>
                      )}
                      {t.conceptRepoUrl && repoHost && (
                        <a
                          href={t.conceptRepoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1 inline-flex items-center gap-1 rounded-md border border-white/10 bg-claude-dark px-1.5 py-0.5 text-[11px] font-mono text-text-secondary transition hover:border-claude-coral/40"
                        >
                          <ExternalLink className="h-2.5 w-2.5" />
                          {repoHost}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <span className="font-mono text-sm text-text-secondary">{count}</span>
                    {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-claude-coral" />}
                    {isPicked && !busy && <Check className="h-4 w-4 text-amber-300" />}
                  </div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: t.color }}
                  />
                </div>
              </button>
            );
          })}
          {voted && (
            <p className="text-center text-xs text-text-muted">
              You can change your vote until voting closes.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Info / resources ───────────────────────────────────────────────── */
function InfoTab({ resources }: { resources: Resource[] }) {
  const categories = Array.from(new Set(resources.map((r) => r.category)));

  return (
    <div>
      <h2 className="text-xl font-semibold text-text-primary">Resources & links</h2>
      <p className="mt-1 text-sm text-text-muted">Everything you need to build today.</p>

      {resources.length === 0 ? (
        <EmptyNote text="Resources will be added here by the organisers." />
      ) : (
        <div className="mt-5 space-y-6">
          {categories.map((cat) => (
            <div key={cat}>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">
                {cat}
              </p>
              <div className="space-y-2">
                {resources
                  .filter((r) => r.category === cat)
                  .map((r) => {
                    const isDiscord = /discord\.(gg|com)/i.test(r.url);
                    return (
                      <a
                        key={r.id}
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center justify-between gap-3 rounded-2xl border p-4 transition ${
                          isDiscord
                            ? "border-[#5865F2]/40 bg-[#5865F2]/10 hover:border-[#5865F2]/70 hover:bg-[#5865F2]/15"
                            : "border-white/10 bg-claude-dark-card/60 hover:border-claude-coral/30 hover:bg-claude-dark-card"
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          {isDiscord && <DiscordLogo />}
                          <div className="min-w-0">
                            <p className="font-semibold text-text-primary">{r.title}</p>
                            {r.description && (
                              <p className="mt-0.5 text-sm text-text-secondary">{r.description}</p>
                            )}
                          </div>
                        </div>
                        <ExternalLink className="h-4 w-4 flex-shrink-0 text-text-muted" />
                      </a>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DiscordLogo() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-6 w-6 flex-shrink-0 text-[#5865F2]"
      fill="currentColor"
    >
      <path d="M20.317 4.369A19.79 19.79 0 0 0 16.558 3a13.71 13.71 0 0 0-.62 1.265 18.27 18.27 0 0 0-5.486 0A13.4 13.4 0 0 0 9.825 3a19.85 19.85 0 0 0-3.762 1.369C2.444 9.792 1.479 15.078 1.961 20.291a19.94 19.94 0 0 0 6.073 3.06c.494-.672.93-1.387 1.305-2.137a12.92 12.92 0 0 1-2.057-.987c.173-.127.343-.26.507-.397a14.218 14.218 0 0 0 12.422 0c.166.137.336.27.508.397-.658.39-1.346.72-2.06.99.376.748.812 1.462 1.305 2.135a19.9 19.9 0 0 0 6.073-3.061c.564-6.043-.962-11.283-3.72-15.922zM9.155 17.087c-1.205 0-2.193-1.111-2.193-2.471 0-1.36.967-2.471 2.193-2.471 1.225 0 2.214 1.111 2.193 2.471 0 1.36-.968 2.471-2.193 2.471zm5.69 0c-1.205 0-2.193-1.111-2.193-2.471 0-1.36.967-2.471 2.193-2.471 1.225 0 2.214 1.111 2.193 2.471 0 1.36-.968 2.471-2.193 2.471z" />
    </svg>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-text-muted">
      {text}
    </div>
  );
}
