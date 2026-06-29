"use client";

import { useUser } from "@clerk/nextjs";
import { AlertCircle, CheckCircle, FileText, Loader2, LogIn, Mic, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useCities } from "@/components/CitiesProvider";
import { TenantLink } from "@/components/TenantBaseProvider";
import { capitalCities, regionalCities } from "@/lib/cities";
import { uploadFile } from "@/lib/upload-client";

interface PendingSlides {
  file: File;
  /** Final URL once upload completes, or null while in progress. */
  url: string | null;
  uploading: boolean;
  error: string | null;
}

export default function SpeakerForm() {
  const { isLoaded, isSignedIn, user } = useUser();
  const cities = useCities();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [slides, setSlides] = useState<PendingSlides | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
    talkId?: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Pre-fill identity from Clerk profile once available. Keep fields editable
  // so submitters can use a stage name or a different contact email.
  useEffect(() => {
    if (!user) return;
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
    setName((prev) => prev || fullName);
    const primaryEmail = user.primaryEmailAddress?.emailAddress ?? "";
    setEmail((prev) => prev || primaryEmail);
  }, [user]);

  if (!isLoaded) {
    return (
      <div className="bg-[#2D2926] rounded-xl border border-white/[0.06] p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#A8A29E] animate-spin" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="bg-[#2D2926] rounded-xl border border-white/[0.06] p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-[#D4836A]/15 flex items-center justify-center mx-auto mb-4">
          <LogIn className="w-8 h-8 text-[#D4836A]" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">Sign in to submit</h3>
        <p className="text-[#A8A29E] mb-6">
          Speaker submissions are tied to your account so we can follow up with you. It only takes a
          moment.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <TenantLink
            href="/login?redirect_url=/speak"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#D4836A] hover:bg-[#c4775f] text-white font-medium rounded-xl transition-colors"
          >
            <LogIn className="w-5 h-5" />
            Sign in
          </TenantLink>
          <TenantLink
            href="/signup?redirect_url=/speak"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#1C1917] border border-white/[0.08] hover:border-white/[0.16] text-white font-medium rounded-xl transition-colors"
          >
            Create account
          </TenantLink>
        </div>
      </div>
    );
  }

  async function onPickFile(file: File) {
    setSlides({ file, url: null, uploading: true, error: null });
    try {
      const { url } = await uploadFile(file, { folder: "talk-slides" });
      setSlides({ file, url, uploading: false, error: null });
    } catch (err) {
      setSlides({
        file,
        url: null,
        uploading: false,
        error: err instanceof Error ? err.message : "Upload failed",
      });
    }
  }

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
    if (!title.trim()) {
      setResult({ type: "error", message: "Please give your talk a title" });
      return;
    }
    if (slides?.uploading) {
      setResult({ type: "error", message: "Wait for slides to finish uploading" });
      return;
    }

    setIsSubmitting(true);
    setResult(null);

    try {
      const response = await fetch("/api/talks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          title: title.trim(),
          description: description.trim() || null,
          bio: bio.trim() || null,
          city: city || null,
        }),
      });

      const data = (await response.json()) as {
        talk?: { id: string };
        error?: string;
      };

      if (!response.ok || !data.talk) {
        setResult({
          type: "error",
          message: data.error || "Something went wrong. Please try again.",
        });
        return;
      }

      // If we uploaded slides, attach them to the new talk.
      if (slides?.url) {
        try {
          await fetch(`/api/talks/${data.talk.id}/slides`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              slidesUrl: slides.url,
              slidesFileName: slides.file.name,
              slidesMimeType: slides.file.type || null,
              slidesSize: slides.file.size,
            }),
          });
        } catch (err) {
          console.error("Failed to attach slides:", err);
        }
      }

      setResult({
        type: "success",
        message: "You're in! We'll be in touch soon to chat about your talk.",
        talkId: data.talk.id,
      });
      setName("");
      setEmail("");
      setTitle("");
      setDescription("");
      setBio("");
      setCity("");
      setSlides(null);
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
      <div className="bg-[#2D2926] rounded-xl border border-white/[0.06] p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-[#10B981]/20 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-[#10B981]" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">Submission received!</h3>
        <p className="text-[#A8A29E] mb-6">{result.message}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <TenantLink
            href="/my-talks"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#D4836A] hover:bg-[#c4775f] text-white font-medium rounded-xl text-sm transition-colors"
          >
            View my talks
          </TenantLink>
          <button
            type="button"
            onClick={() => setResult(null)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#1C1917] border border-white/[0.08] hover:border-white/[0.16] text-white font-medium rounded-xl text-sm transition-colors"
          >
            Submit another talk
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[#2D2926] rounded-xl border border-white/[0.06] p-6"
    >
      <div className="flex items-center justify-end mb-3">
        <TenantLink
          href="/my-talks"
          className="text-xs text-[#A8A29E] hover:text-[#D4836A] transition-colors"
        >
          View my submissions →
        </TenantLink>
      </div>
      <div className="space-y-4">
        <div>
          <label htmlFor="speaker-name" className="block text-sm font-medium text-[#A8A29E] mb-2">
            Name <span className="text-[#D4836A]">*</span>
          </label>
          <input
            type="text"
            id="speaker-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            required
            className="w-full px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 transition-colors"
          />
        </div>

        <div>
          <label htmlFor="speaker-email" className="block text-sm font-medium text-[#A8A29E] mb-2">
            Email <span className="text-[#D4836A]">*</span>
          </label>
          <input
            type="email"
            id="speaker-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="w-full px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 transition-colors"
          />
        </div>

        <div>
          <label htmlFor="talk-title" className="block text-sm font-medium text-[#A8A29E] mb-2">
            Talk title <span className="text-[#D4836A]">*</span>
          </label>
          <input
            type="text"
            id="talk-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. How I shipped a full-stack app in a weekend with Claude Code"
            required
            className="w-full px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 transition-colors"
          />
        </div>

        <div>
          <label
            htmlFor="talk-description"
            className="block text-sm font-medium text-[#A8A29E] mb-2"
          >
            Talk description
          </label>
          <textarea
            id="talk-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What will the audience walk away with? Outline the structure, key points, or demos. Markdown supported."
            rows={5}
            className="w-full px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 transition-colors resize-y"
          />
        </div>

        <div>
          <label htmlFor="speaker-bio" className="block text-sm font-medium text-[#A8A29E] mb-2">
            Short bio (optional)
          </label>
          <textarea
            id="speaker-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A sentence or two about yourself"
            rows={2}
            className="w-full px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 transition-colors resize-none"
          />
        </div>

        <div>
          <label htmlFor="speaker-city" className="block text-sm font-medium text-[#A8A29E] mb-2">
            Preferred city (optional)
          </label>
          <select
            id="speaker-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white focus:outline-none focus:border-[#D4836A]/50 transition-colors"
          >
            <option value="">Any city</option>
            <optgroup label="Capital Cities">
              {capitalCities(cities).map((c) => (
                <option key={c.slug} value={c.name}>
                  {c.name}, {c.state}
                </option>
              ))}
            </optgroup>
            <optgroup label="Regional Cities">
              {regionalCities(cities).map((c) => (
                <option key={c.slug} value={c.name}>
                  {c.name}, {c.state}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        {/* Slides (optional) */}
        <div>
          <span className="block text-sm font-medium text-[#A8A29E] mb-2">
            Slides <span className="text-[#78716C] font-normal">(optional — PDF, PPT, PPTX)</span>
          </span>
          <input
            ref={fileRef}
            type="file"
            hidden
            accept="application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void onPickFile(file);
            }}
          />
          {slides ? (
            <div className="flex items-center gap-3 px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl">
              <FileText className="w-5 h-5 text-[#D4836A] shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-white text-sm truncate">{slides.file.name}</div>
                <div className="text-xs text-[#78716C]">
                  {slides.uploading
                    ? "Uploading…"
                    : slides.error
                      ? `Error: ${slides.error}`
                      : "Ready to attach"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSlides(null)}
                className="p-1.5 text-[#78716C] hover:text-white"
                aria-label="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#1C1917] border border-dashed border-white/[0.12] hover:border-[#D4836A]/50 rounded-xl text-[#A8A29E] hover:text-white text-sm transition-colors"
            >
              <Upload className="w-4 h-4" />
              Attach slides (you can also add them later)
            </button>
          )}
        </div>

        {result?.type === "error" && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 text-red-400">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm">{result.message}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !name || !email || !title || slides?.uploading}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#D4836A] hover:bg-[#c4775f] disabled:bg-[#D4836A]/50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Mic className="w-5 h-5" />
              Submit talk
            </>
          )}
        </button>
      </div>
    </form>
  );
}
