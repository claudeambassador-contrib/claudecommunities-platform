"use client";

import {
  AlertCircle,
  Beer,
  Calendar,
  CheckCircle,
  Database,
  HelpCircle,
  Loader2,
  MapPin,
  Shirt,
  Sparkles,
  Trophy,
  UtensilsCrossed,
} from "lucide-react";
import { useState } from "react";

const SPONSORSHIP_OPTIONS = [
  {
    value: "event",
    label: "Event sponsor",
    description: "Headline support — branding across the event, mainstage acknowledgment",
    icon: Calendar,
  },
  {
    value: "drinks",
    label: "Drinks sponsor",
    description: "Cover drinks for the after-party / networking session",
    icon: Beer,
  },
  {
    value: "catering",
    label: "Catering partner",
    description: "Provide breakfast, lunch or snacks for hackers on the day",
    icon: UtensilsCrossed,
  },
  {
    value: "venue",
    label: "Venue partner",
    description: "Host the hackathon at your space in Melbourne",
    icon: MapPin,
  },
  {
    value: "swag",
    label: "Merch / swag sponsor",
    description: "T-shirts, stickers, hoodies, tote bags for participants",
    icon: Shirt,
  },
  {
    value: "data",
    label: "Data partner",
    description: "Contribute civic datasets or APIs that teams can build on",
    icon: Database,
  },
  {
    value: "prizes",
    label: "Prize sponsor",
    description: "Provide cash, hardware, services or credits for winning teams",
    icon: Trophy,
  },
  {
    value: "other",
    label: "Something else",
    description: "Have another idea for getting involved? Tell us below.",
    icon: HelpCircle,
  },
] as const;

export default function SponsorForm() {
  const [contactName, setContactName] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [sponsorshipTypes, setSponsorshipTypes] = useState<string[]>([]);
  const [budget, setBudget] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  function toggleType(value: string) {
    setSponsorshipTypes((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!contactName.trim()) {
      setResult({ type: "error", message: "Please enter your name" });
      return;
    }
    if (!organisation.trim()) {
      setResult({ type: "error", message: "Please enter your organisation" });
      return;
    }
    if (!email.includes("@")) {
      setResult({ type: "error", message: "Please enter a valid email address" });
      return;
    }
    if (sponsorshipTypes.length === 0) {
      setResult({
        type: "error",
        message: "Please pick at least one way you might want to get involved",
      });
      return;
    }

    setIsSubmitting(true);
    setResult(null);

    try {
      const response = await fetch("/api/impact-lab-sponsor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName: contactName.trim(),
          contactRole: contactRole.trim() || null,
          organisation: organisation.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
          website: website.trim() || null,
          sponsorshipTypes,
          budget: budget.trim() || null,
          message: message.trim() || null,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          type: "success",
          message:
            "Thanks for getting in touch — we'll come back to you within a few days to talk through the details.",
        });
        setContactName("");
        setContactRole("");
        setOrganisation("");
        setEmail("");
        setPhone("");
        setWebsite("");
        setSponsorshipTypes([]);
        setBudget("");
        setMessage("");
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
        <h3 className="text-xl font-semibold text-white mb-2">Sponsorship enquiry received</h3>
        <p className="text-[#A8A29E] mb-6">{result.message}</p>
        <button
          type="button"
          onClick={() => setResult(null)}
          className="text-[#D4836A] hover:text-[#E09880] text-sm font-medium transition-colors"
        >
          Submit another enquiry
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[#2D2926] rounded-2xl border border-white/[0.06] p-6 md:p-8"
    >
      <div className="space-y-6">
        <div>
          <h3 className="text-white font-semibold mb-1">How would you like to get involved?</h3>
          <p className="text-sm text-[#A8A29E] mb-4">
            Pick one or more — we&apos;re open to ideas. <span className="text-[#D4836A]">*</span>
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {SPONSORSHIP_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const checked = sponsorshipTypes.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    checked
                      ? "bg-[#D4836A]/10 border-[#D4836A]/40"
                      : "bg-[#1C1917] border-white/[0.06] hover:border-white/20"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={() => toggleType(opt.value)}
                  />
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      checked ? "bg-[#D4836A]/20 text-[#D4836A]" : "bg-white/[0.04] text-[#A8A29E]"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{opt.label}</span>
                      {checked && <CheckCircle className="w-4 h-4 text-[#D4836A] shrink-0" />}
                    </div>
                    <p className="text-xs text-[#A8A29E] mt-0.5 leading-snug">{opt.description}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="sponsor-contact-name"
              className="block text-sm font-medium text-[#A8A29E] mb-2"
            >
              Your name <span className="text-[#D4836A]">*</span>
            </label>
            <input
              type="text"
              id="sponsor-contact-name"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Jane Smith"
              required
              className="w-full px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="sponsor-contact-role"
              className="block text-sm font-medium text-[#A8A29E] mb-2"
            >
              Your role (optional)
            </label>
            <input
              type="text"
              id="sponsor-contact-role"
              value={contactRole}
              onChange={(e) => setContactRole(e.target.value)}
              placeholder="e.g. Head of Marketing"
              className="w-full px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 transition-colors"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="sponsor-organisation"
            className="block text-sm font-medium text-[#A8A29E] mb-2"
          >
            Organisation <span className="text-[#D4836A]">*</span>
          </label>
          <input
            type="text"
            id="sponsor-organisation"
            value={organisation}
            onChange={(e) => setOrganisation(e.target.value)}
            placeholder="Company, council, university, nonprofit, etc."
            required
            className="w-full px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 transition-colors"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="sponsor-email"
              className="block text-sm font-medium text-[#A8A29E] mb-2"
            >
              Email <span className="text-[#D4836A]">*</span>
            </label>
            <input
              type="email"
              id="sponsor-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              className="w-full px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="sponsor-phone"
              className="block text-sm font-medium text-[#A8A29E] mb-2"
            >
              Phone (optional)
            </label>
            <input
              type="tel"
              id="sponsor-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+61 ..."
              className="w-full px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 transition-colors"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="sponsor-website"
            className="block text-sm font-medium text-[#A8A29E] mb-2"
          >
            Website (optional)
          </label>
          <input
            type="url"
            id="sponsor-website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://example.com"
            className="w-full px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 transition-colors"
          />
        </div>

        <div>
          <label htmlFor="sponsor-budget" className="block text-sm font-medium text-[#A8A29E] mb-2">
            Indicative budget or in-kind value (optional)
          </label>
          <input
            type="text"
            id="sponsor-budget"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="e.g. $5,000 cash / $2,000 in catering / 50 t-shirts"
            className="w-full px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 transition-colors"
          />
          <p className="text-xs text-[#78716C] mt-2">
            Rough numbers are fine — this just helps us match the right partners to the right roles.
          </p>
        </div>

        <div>
          <label
            htmlFor="sponsor-message"
            className="block text-sm font-medium text-[#A8A29E] mb-2"
          >
            Anything else we should know? (optional)
          </label>
          <textarea
            id="sponsor-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell us a bit about your organisation, what you'd love to see at the event, or any constraints we should know about."
            rows={4}
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
          disabled={isSubmitting || !contactName || !organisation || !email}
          className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-[#D4836A] hover:bg-[#c4775f] disabled:bg-[#D4836A]/50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors text-base"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Send sponsorship enquiry
            </>
          )}
        </button>

        <p className="text-xs text-[#78716C] text-center">
          We&apos;ll only use your details to follow up about Impact Lab Melbourne sponsorship.
        </p>
      </div>
    </form>
  );
}
