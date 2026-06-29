"use client";

import { AlertCircle, CheckCircle, Loader2, Lock, Sparkles } from "lucide-react";
import { useState } from "react";
import { TenantLink } from "@/components/TenantBaseProvider";

const REGISTRATIONS_CLOSED = true;

export default function InterestForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [expertise, setExpertise] = useState("");
  const [interest, setInterest] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      setResult({ type: "error", message: "Please enter your name" });
      return;
    }
    if (!email.includes("@")) {
      setResult({ type: "error", message: "Please enter a valid email address" });
      return;
    }

    setIsSubmitting(true);
    setResult(null);

    try {
      const response = await fetch("/api/impact-lab-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          role: role.trim() || null,
          expertise: expertise.trim() || null,
          interest: interest.trim() || null,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          type: "success",
          message:
            "You're on the list! We'll be in touch with more details as the event takes shape.",
        });
        setName("");
        setEmail("");
        setRole("");
        setExpertise("");
        setInterest("");
      } else {
        setResult({
          type: "error",
          message: data.error || "Something went wrong. Please try again.",
        });
      }
    } catch {
      setResult({
        type: "error",
        message: "Something went wrong. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (result?.type === "success") {
    return (
      <div className="bg-[#2D2926] rounded-2xl border border-white/[0.06] p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-[#10B981]/20 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-[#10B981]" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">You're registered!</h3>
        <p className="text-[#A8A29E] mb-6">{result.message}</p>
        <button
          type="button"
          onClick={() => setResult(null)}
          className="text-[#D4836A] hover:text-[#E09880] text-sm font-medium transition-colors"
        >
          Register someone else
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <form
        onSubmit={handleSubmit}
        aria-hidden={REGISTRATIONS_CLOSED}
        className={`bg-[#2D2926] rounded-2xl border border-white/[0.06] p-6 md:p-8 ${
          REGISTRATIONS_CLOSED ? "pointer-events-none blur-[2px] select-none" : ""
        }`}
      >
        <fieldset disabled={REGISTRATIONS_CLOSED} className="space-y-4 border-0 p-0 m-0">
          <div>
            <label
              htmlFor="interest-name"
              className="block text-sm font-medium text-[#A8A29E] mb-2"
            >
              Name <span className="text-[#D4836A]">*</span>
            </label>
            <input
              type="text"
              id="interest-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
              className="w-full px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="interest-email"
              className="block text-sm font-medium text-[#A8A29E] mb-2"
            >
              Email <span className="text-[#D4836A]">*</span>
            </label>
            <input
              type="email"
              id="interest-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="interest-role"
              className="block text-sm font-medium text-[#A8A29E] mb-2"
            >
              What do you do? (optional)
            </label>
            <input
              type="text"
              id="interest-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Software engineer, Data scientist, Student, Public servant"
              className="w-full px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="interest-expertise"
              className="block text-sm font-medium text-[#A8A29E] mb-2"
            >
              Your skills / expertise (optional)
            </label>
            <input
              type="text"
              id="interest-expertise"
              value={expertise}
              onChange={(e) => setExpertise(e.target.value)}
              placeholder="e.g. Python, React, data analysis, urban planning, community organising"
              className="w-full px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="interest-idea"
              className="block text-sm font-medium text-[#A8A29E] mb-2"
            >
              What would you want to build? (optional)
            </label>
            <textarea
              id="interest-idea"
              value={interest}
              onChange={(e) => setInterest(e.target.value)}
              placeholder="Got an idea for a tool that could help Melbourne? Tell us about it — or just say you're keen to join a team on the day."
              rows={3}
              className="w-full px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 transition-colors resize-none"
            />
          </div>

          {result?.type === "error" && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 text-red-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm">{result.message}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !name || !email}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-[#D4836A] hover:bg-[#c4775f] disabled:bg-[#D4836A]/50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors text-base"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Register Early Interest
              </>
            )}
          </button>
        </fieldset>
      </form>

      {REGISTRATIONS_CLOSED && (
        <div
          role="status"
          className="absolute inset-0 flex items-center justify-center p-6 rounded-2xl bg-[#1C1917]/80 backdrop-blur-sm border border-white/[0.08]"
        >
          <div className="text-center max-w-sm">
            <div className="w-14 h-14 rounded-full bg-[#D4836A]/20 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-7 h-7 text-[#D4836A]" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Applications closed</h3>
            <p className="text-[#A8A29E] text-sm leading-relaxed">
              Registrations for the May 23 hackathon have wrapped up. Keep an eye out for future
              events — we run them regularly across Australia.
            </p>
            <TenantLink
              href="/events"
              className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 bg-[#D4836A] hover:bg-[#c4775f] text-white rounded-lg transition-colors font-medium text-sm"
            >
              See upcoming events
            </TenantLink>
          </div>
        </div>
      )}
    </div>
  );
}
