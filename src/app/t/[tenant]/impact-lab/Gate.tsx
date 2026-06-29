"use client";

import { AlertCircle, ArrowRight, Loader2, Lock, ShieldCheck, Sparkles, Users } from "lucide-react";
import { useState } from "react";
import { TenantLink, useTenantRouter } from "@/components/TenantBaseProvider";
import type { PublicConfig } from "@/lib/services/impactLab";

export default function Gate({
  config,
  teams,
}: {
  config: PublicConfig;
  teams: { id: string; name: string }[];
}) {
  const router = useTenantRouter();
  const [step, setStep] = useState<"code" | "checkin">("code");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [teamId, setTeamId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setError("Enter the access code shown on screen.");
      return;
    }
    // Catch the common confusion: organiser types the admin password into
    // the participant gate. Bounce them to the right page instead of
    // showing a generic "code is wrong" message.
    if (/admin/i.test(trimmed)) {
      router.push("/impact-lab/admin");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/impact-lab/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", code: trimmed }),
      });
      const data = await res.json();
      if (res.ok) {
        setStep("checkin");
      } else {
        setError(data.error || "Something went wrong. Try again.");
      }
    } catch {
      setError("Network hiccup — try again.");
    } finally {
      setLoading(false);
    }
  }

  async function submitCheckIn(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Tell us your name so we can check you in.");
      return;
    }
    if (!email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/impact-lab/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "check-in",
          code: code.trim(),
          name: name.trim(),
          email: email.trim().toLowerCase(),
          teamId: teamId || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push("/impact-lab/portal");
        router.refresh();
      } else {
        setError(data.error || "Something went wrong. Try again.");
      }
    } catch {
      setError("Network hiccup — try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-5 py-10">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, #D4836A 0%, rgba(167,139,250,0.5) 45%, transparent 70%)",
        }}
      />

      <div className="relative w-full max-w-md">
        <div className="mb-7 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-claude-coral">
            <Sparkles className="h-3.5 w-3.5" />
            Participant Portal
          </span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
            {config.eventName}
          </h1>
          <p className="mt-2 text-sm text-text-secondary">{config.eventTagline}</p>
          <p className="mt-1 text-xs font-medium text-text-muted">{config.eventDate}</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-claude-dark-card/80 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
          {!config.checkInOpen && step === "code" ? (
            <div className="text-center">
              <Lock className="mx-auto h-9 w-9 text-text-muted" />
              <p className="mt-3 text-sm text-text-secondary">
                Check-in isn&apos;t open yet. Hold tight — an organiser will let you know when the
                doors are open.
              </p>
            </div>
          ) : step === "code" ? (
            <form onSubmit={submitCode} className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Enter your access code</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  It&apos;s on the screen at the front of the room.
                </p>
              </div>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ACCESS CODE"
                // biome-ignore lint/a11y/noAutofocus: access code is the only field on the gate screen
                autoFocus
                autoCapitalize="characters"
                autoComplete="off"
                className="w-full rounded-xl border border-white/10 bg-claude-dark px-4 py-3.5 text-center text-lg font-semibold tracking-[0.3em] text-text-primary placeholder:tracking-[0.2em] placeholder:text-text-muted focus:border-claude-coral focus:outline-none"
              />
              <SubmitButton loading={loading} label="Continue" />
              <p className="pt-1 text-center text-xs text-text-muted">
                Organiser?{" "}
                <TenantLink
                  href="/impact-lab/admin"
                  className="inline-flex items-center gap-1 text-claude-coral hover:underline"
                >
                  <ShieldCheck className="h-3 w-3" />
                  Sign in here
                </TenantLink>{" "}
                — different password.
              </p>
            </form>
          ) : (
            <form onSubmit={submitCheckIn} className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Check in</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Just a few details and you&apos;re in.
                </p>
              </div>
              <Field label="Your name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ada Lovelace"
                  // biome-ignore lint/a11y/noAutofocus: first field after access-code gate; cursor should land here
                  autoFocus
                  className="ilab-input"
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ada@example.com"
                  className="ilab-input"
                />
              </Field>
              {teams.length > 0 ? (
                <Field
                  label="Your team"
                  hint="Pick the team you've been placed in — an organiser can sort this later if you're unsure."
                >
                  <select
                    value={teamId}
                    onChange={(e) => setTeamId(e.target.value)}
                    className="ilab-input"
                  >
                    <option value="">I&apos;ll be placed by an organiser</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-text-muted">
                  Teams haven&apos;t been set up yet — an organiser will place you once you&apos;re
                  in.
                </p>
              )}
              <SubmitButton loading={loading} label="Enter the Lab" />
              <button
                type="button"
                onClick={() => {
                  setStep("code");
                  setError(null);
                }}
                className="w-full text-center text-xs text-text-muted hover:text-text-secondary"
              >
                ← Use a different code
              </button>
            </form>
          )}

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-center gap-5 text-xs text-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Participants · Mentors · Judges
          </span>
          <TenantLink
            href="/impact-lab/admin"
            className="inline-flex items-center gap-1.5 hover:text-text-secondary"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Organiser sign in
          </TenantLink>
        </div>
      </div>

      <style>{`
        .ilab-input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgba(255,255,255,0.1);
          background: var(--claude-dark);
          padding: 0.75rem 1rem;
          color: var(--text-primary);
          font-size: 0.95rem;
        }
        .ilab-input::placeholder { color: var(--text-muted); }
        .ilab-input:focus { outline: none; border-color: var(--claude-coral); }
      `}</style>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is passed as {children} and rendered inside this label, so it is associated by nesting
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-text-secondary">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-text-muted">{hint}</span>}
    </label>
  );
}

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-claude-coral px-4 py-3.5 text-sm font-semibold text-claude-dark transition hover:bg-claude-coral-light disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          {label}
          <ArrowRight className="h-4 w-4" />
        </>
      )}
    </button>
  );
}
