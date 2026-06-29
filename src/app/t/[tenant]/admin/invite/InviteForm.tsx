"use client";

import { AlertCircle, CheckCircle, Loader2, Send, UserPlus } from "lucide-react";
import { useState } from "react";

export default function InviteForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [personalMessage, setPersonalMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    type: "success" | "error" | "warning";
    message: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!email.includes("@")) {
      setResult({ type: "error", message: "Please enter a valid email address" });
      return;
    }

    setIsSubmitting(true);
    setResult(null);

    try {
      const response = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || null,
          email: email.trim().toLowerCase(),
          personalMessage: personalMessage.trim() || null,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          type: "success",
          message: data.isResend
            ? `Invite resent to ${email}`
            : data.emailSent
              ? `Invite sent to ${email}!`
              : `User created but email failed to send. They can still sign up.`,
        });
        // Clear form on success
        setName("");
        setEmail("");
        setPersonalMessage("");
      } else if (response.status === 409) {
        setResult({
          type: "warning",
          message: `${email} is already a community member`,
        });
      } else {
        setResult({
          type: "error",
          message: data.error || "Failed to send invite",
        });
      }
    } catch (_err) {
      setResult({
        type: "error",
        message: "Something went wrong. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[#2D2926] rounded-xl border border-white/[0.06] p-6"
    >
      <div className="space-y-4">
        {/* Name Input */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-[#A8A29E] mb-2">
            Name (optional)
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="John Smith"
            className="w-full px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 transition-colors"
          />
        </div>

        {/* Email Input */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-[#A8A29E] mb-2">
            Email Address <span className="text-[#D4836A]">*</span>
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="john@example.com"
            required
            className="w-full px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 transition-colors"
          />
        </div>

        {/* Personal Message */}
        <div>
          <label htmlFor="message" className="block text-sm font-medium text-[#A8A29E] mb-2">
            Personal Message (optional)
          </label>
          <textarea
            id="message"
            value={personalMessage}
            onChange={(e) => setPersonalMessage(e.target.value)}
            placeholder="Hey! I thought you'd love this community..."
            rows={3}
            className="w-full px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 transition-colors resize-none"
          />
          <p className="text-xs text-[#78716C] mt-1">
            This message will be included in the invite email as a personal note.
          </p>
        </div>

        {/* Result Message */}
        {result && (
          <div
            className={`flex items-center gap-2 p-3 rounded-lg ${
              result.type === "success"
                ? "bg-[#10B981]/10 text-[#10B981]"
                : result.type === "warning"
                  ? "bg-[#F59E0B]/10 text-[#F59E0B]"
                  : "bg-red-500/10 text-red-400"
            }`}
          >
            {result.type === "success" ? (
              <CheckCircle className="w-5 h-5 shrink-0" />
            ) : result.type === "warning" ? (
              <UserPlus className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span className="text-sm">{result.message}</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || !email}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#D4836A] hover:bg-[#c4775f] disabled:bg-[#D4836A]/50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Sending Invite...
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              Send Invite
            </>
          )}
        </button>
      </div>
    </form>
  );
}
