"use client";

import { AlertCircle, ArrowLeft, Bug, CheckCircle, Upload, X } from "lucide-react";
import { useState } from "react";
import { TenantLink } from "@/components/TenantBaseProvider";
import { RemoteImage } from "@/components/ui/RemoteImage";

export default function BugReportPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState("");
  const [expected, setExpected] = useState("");
  const [actual, setActual] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Screenshot must be under 5MB");
        return;
      }
      setScreenshot(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshotPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeScreenshot = () => {
    setScreenshot(null);
    setScreenshotPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !description.trim()) {
      setError("Title and description are required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("steps", steps);
      formData.append("expected", expected);
      formData.append("actual", actual);
      if (screenshot) {
        formData.append("screenshot", screenshot);
      }

      const res = await fetch("/api/bug-report", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit bug report");
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit bug report");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#1C1917] pt-20 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-[#2D2926] rounded-2xl border border-white/[0.06] p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Bug Report Submitted!</h2>
            <p className="text-[#A8A29E] mb-6">
              Thank you for helping us improve the platform. We'll review your report and get back
              to you if needed.
            </p>
            <TenantLink
              href="/community"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#D4836A] text-white hover:bg-[#c4775f] transition-colors"
            >
              Back to Community
            </TenantLink>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1C1917] pt-20 px-4 pb-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <TenantLink
            href="/community"
            className="p-2 rounded-lg text-[#A8A29E] hover:text-white hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </TenantLink>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
              <Bug className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Report a Bug</h1>
              <p className="text-[#A8A29E] text-sm">Help us squash bugs and improve the platform</p>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-[#2D2926] rounded-2xl border border-white/[0.06] p-6">
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label htmlFor="bug-title" className="block text-sm font-medium text-white mb-2">
                  Bug Title <span className="text-red-400">*</span>
                </label>
                <input
                  id="bug-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Brief description of the bug"
                  className="w-full bg-[#1C1917] border border-white/[0.06] rounded-xl px-4 py-3 text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="bug-description"
                  className="block text-sm font-medium text-white mb-2"
                >
                  Description <span className="text-red-400">*</span>
                </label>
                <textarea
                  id="bug-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the bug in detail..."
                  rows={4}
                  className="w-full bg-[#1C1917] border border-white/[0.06] rounded-xl px-4 py-3 text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 resize-none"
                  required
                />
              </div>

              {/* Steps to Reproduce */}
              <div>
                <label htmlFor="bug-steps" className="block text-sm font-medium text-white mb-2">
                  Steps to Reproduce
                </label>
                <textarea
                  id="bug-steps"
                  value={steps}
                  onChange={(e) => setSteps(e.target.value)}
                  placeholder="1. Go to...&#10;2. Click on...&#10;3. See error"
                  rows={3}
                  className="w-full bg-[#1C1917] border border-white/[0.06] rounded-xl px-4 py-3 text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Expected Behavior */}
                <div>
                  <label
                    htmlFor="bug-expected"
                    className="block text-sm font-medium text-white mb-2"
                  >
                    Expected Behavior
                  </label>
                  <textarea
                    id="bug-expected"
                    value={expected}
                    onChange={(e) => setExpected(e.target.value)}
                    placeholder="What should happen..."
                    rows={2}
                    className="w-full bg-[#1C1917] border border-white/[0.06] rounded-xl px-4 py-3 text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 resize-none"
                  />
                </div>

                {/* Actual Behavior */}
                <div>
                  <label htmlFor="bug-actual" className="block text-sm font-medium text-white mb-2">
                    Actual Behavior
                  </label>
                  <textarea
                    id="bug-actual"
                    value={actual}
                    onChange={(e) => setActual(e.target.value)}
                    placeholder="What actually happens..."
                    rows={2}
                    className="w-full bg-[#1C1917] border border-white/[0.06] rounded-xl px-4 py-3 text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 resize-none"
                  />
                </div>
              </div>

              {/* Screenshot Upload */}
              <div>
                <label
                  htmlFor="bug-screenshot"
                  className="block text-sm font-medium text-white mb-2"
                >
                  Screenshot (optional)
                </label>
                {screenshotPreview ? (
                  <div className="relative inline-block">
                    <RemoteImage
                      src={screenshotPreview}
                      alt="Screenshot preview"
                      className="max-w-full max-h-48 rounded-xl border border-white/[0.06]"
                    />
                    <button
                      type="button"
                      onClick={removeScreenshot}
                      className="absolute -top-2 -right-2 p-1 bg-red-500 rounded-full text-white hover:bg-red-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-32 bg-[#1C1917] border-2 border-dashed border-white/[0.1] rounded-xl cursor-pointer hover:border-[#D4836A]/50 transition-colors">
                    <Upload className="w-8 h-8 text-[#78716C] mb-2" />
                    <span className="text-sm text-[#78716C]">Click to upload screenshot</span>
                    <span className="text-xs text-[#57534E] mt-1">PNG, JPG up to 5MB</span>
                    <input
                      id="bug-screenshot"
                      type="file"
                      accept="image/*"
                      onChange={handleScreenshotChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-3">
            <TenantLink
              href="/community"
              className="px-6 py-3 rounded-xl border border-white/[0.1] text-white hover:bg-white/[0.05] transition-colors"
            >
              Cancel
            </TenantLink>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#D4836A] text-white hover:bg-[#c4775f] transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Bug className="w-4 h-4" />
                  Submit Bug Report
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
