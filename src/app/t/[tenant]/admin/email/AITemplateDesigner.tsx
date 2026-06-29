"use client";

import {
  Check,
  ChevronDown,
  ChevronUp,
  Code,
  Eye,
  Loader2,
  Monitor,
  Palette,
  RotateCcw,
  Smartphone,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface Props {
  subject: string;
  onApplyTemplate: (html: string) => void;
}

const STYLE_PRESETS = [
  { id: "modern-minimal", label: "Modern Minimal", icon: "~" },
  { id: "bold-gradient", label: "Bold Gradient", icon: "^" },
  { id: "elegant-dark", label: "Elegant Dark", icon: "*" },
  { id: "vibrant-cards", label: "Vibrant Cards", icon: "#" },
  { id: "editorial", label: "Editorial", icon: "&" },
];

const TEMPLATE_TYPES = [
  { id: "announcement", label: "Announcement" },
  { id: "newsletter", label: "Newsletter" },
  { id: "event-invite", label: "Event Invite" },
  { id: "product-update", label: "Product Update" },
  { id: "welcome", label: "Welcome Email" },
  { id: "re-engagement", label: "Re-engagement" },
];

export default function AITemplateDesigner({ subject, onApplyTemplate }: Props) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [selectedType, setSelectedType] = useState("announcement");
  const [selectedStyle, setSelectedStyle] = useState("modern-minimal");
  const [generating, setGenerating] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"preview" | "code">("preview");
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
  const [error, setError] = useState<string | null>(null);
  const [editableHtml, setEditableHtml] = useState("");
  const [applied, setApplied] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (generatedHtml) {
      setEditableHtml(generatedHtml);
    }
  }, [generatedHtml]);

  const buildFullPrompt = () => {
    const parts = [prompt];
    const style = STYLE_PRESETS.find((s) => s.id === selectedStyle);
    if (style) {
      parts.push(`Style: ${style.label}`);
    }
    return parts.join(". ");
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setGenerating(true);
    setError(null);
    setApplied(false);

    try {
      const res = await fetch("/api/admin/email/generate-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: buildFullPrompt(),
          templateType: selectedType,
          subject: subject || "Community Update",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate template");
      }

      const data = await res.json();
      setGeneratedHtml(data.html);
      setHistory((prev) => [...prev, data.html]);
      setHistoryIndex(history.length);
      setPreviewMode("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleApply = () => {
    onApplyTemplate(editableHtml);
    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setGeneratedHtml(history[newIndex]);
    }
  };

  const getPreviewHtml = (html: string) => {
    const replaced = html
      .replace(/\{\{name\}\}/g, "Sarah")
      .replace(/\{\{email\}\}/g, "sarah@example.com")
      .replace(/\{\{subject\}\}/g, subject || "Community Update");

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1C1917; color: #E7E5E4; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto;">
    ${replaced}
  </div>
</body>
</html>`;
  };

  return (
    <div className="rounded-2xl border border-white/[0.06] overflow-hidden bg-gradient-to-b from-[#2D2926] to-[#262220]">
      {/* Collapsed Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center">
            <Sparkles className="w-4.5 h-4.5 text-violet-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-white">AI Template Designer</p>
            <p className="text-xs text-[#78716C]">Describe your email and Claude will design it</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/20">
            Claude Sonnet
          </span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-[#78716C]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#78716C]" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-white/[0.06]">
          {/* Input Section */}
          <div className="p-4 space-y-4">
            {/* Template Type Pills */}
            <div>
              <span className="block text-xs font-medium text-[#A8A29E] mb-2">Template Type</span>
              <div className="flex flex-wrap gap-2">
                {TEMPLATE_TYPES.map((type) => (
                  <button
                    type="button"
                    key={type.id}
                    onClick={() => setSelectedType(type.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      selectedType === type.id
                        ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                        : "bg-white/[0.03] text-[#A8A29E] border border-white/[0.06] hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Style Presets */}
            <div>
              <span className="block text-xs font-medium text-[#A8A29E] mb-2">
                <Palette className="w-3.5 h-3.5 inline mr-1" />
                Design Style
              </span>
              <div className="flex flex-wrap gap-2">
                {STYLE_PRESETS.map((style) => (
                  <button
                    type="button"
                    key={style.id}
                    onClick={() => setSelectedStyle(style.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      selectedStyle === style.id
                        ? "bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30"
                        : "bg-white/[0.03] text-[#A8A29E] border border-white/[0.06] hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt Input */}
            <div>
              <label
                htmlFor="ai-template-prompt"
                className="block text-xs font-medium text-[#A8A29E] mb-2"
              >
                <Wand2 className="w-3.5 h-3.5 inline mr-1" />
                Describe Your Email
              </label>
              <div className="relative">
                <textarea
                  id="ai-template-prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g., A stunning newsletter announcing our upcoming AI workshop in Sydney, with speaker bios section, agenda timeline, and early-bird pricing card..."
                  rows={3}
                  className="w-full bg-[#1C1917] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-[#5C5955] focus:outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      handleGenerate();
                    }
                  }}
                />
              </div>
            </div>

            {/* Generate Button */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || !prompt.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-lg shadow-violet-500/20"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Designing your template...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Template
                  <span className="text-xs opacity-60 ml-1">Ctrl+Enter</span>
                </>
              )}
            </button>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <X className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}
          </div>

          {/* Preview Section */}
          {generatedHtml && (
            <div className="border-t border-white/[0.06]">
              {/* Preview Toolbar */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-[#1C1917]/50">
                <div className="flex items-center gap-1">
                  <div className="flex rounded-lg overflow-hidden border border-white/[0.08]">
                    <button
                      type="button"
                      onClick={() => setPreviewMode("preview")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                        previewMode === "preview"
                          ? "bg-violet-500/20 text-violet-300"
                          : "text-[#78716C] hover:text-white hover:bg-white/[0.05]"
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode("code")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                        previewMode === "code"
                          ? "bg-violet-500/20 text-violet-300"
                          : "text-[#78716C] hover:text-white hover:bg-white/[0.05]"
                      }`}
                    >
                      <Code className="w-3.5 h-3.5" />
                      Code
                    </button>
                  </div>

                  {previewMode === "preview" && (
                    <div className="flex rounded-lg overflow-hidden border border-white/[0.08] ml-2">
                      <button
                        type="button"
                        onClick={() => setViewMode("desktop")}
                        className={`p-1.5 transition-colors ${
                          viewMode === "desktop"
                            ? "bg-violet-500/20 text-violet-300"
                            : "text-[#78716C] hover:text-white hover:bg-white/[0.05]"
                        }`}
                        title="Desktop"
                      >
                        <Monitor className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode("mobile")}
                        className={`p-1.5 transition-colors ${
                          viewMode === "mobile"
                            ? "bg-violet-500/20 text-violet-300"
                            : "text-[#78716C] hover:text-white hover:bg-white/[0.05]"
                        }`}
                        title="Mobile"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {history.length > 1 && (
                    <button
                      type="button"
                      onClick={handleUndo}
                      disabled={historyIndex <= 0}
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs text-[#78716C] hover:text-white disabled:opacity-30 transition-colors"
                      title="Previous version"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleApply}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      applied
                        ? "bg-green-500/20 text-green-300 border border-green-500/20"
                        : "bg-[#D4836A] text-white hover:bg-[#c4775f]"
                    }`}
                  >
                    {applied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Applied!
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Use This Template
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Preview Content */}
              <div ref={previewRef} className="relative">
                {previewMode === "preview" ? (
                  <div className="p-4 bg-[#131110]">
                    <div
                      className={`mx-auto transition-all duration-300 ${
                        viewMode === "mobile" ? "max-w-[375px]" : "max-w-[600px]"
                      }`}
                    >
                      {/* Device Frame */}
                      <div
                        className={`relative rounded-xl overflow-hidden shadow-2xl ${
                          viewMode === "mobile"
                            ? "border-[3px] border-[#3a3735] rounded-[24px]"
                            : "border border-white/[0.08]"
                        }`}
                      >
                        {viewMode === "mobile" && (
                          <div className="bg-[#3a3735] py-1 flex justify-center">
                            <div className="w-16 h-1 rounded-full bg-[#555]" />
                          </div>
                        )}
                        <iframe
                          srcDoc={getPreviewHtml(editableHtml)}
                          className="w-full border-0 bg-[#1C1917]"
                          style={{
                            height: viewMode === "mobile" ? "580px" : "480px",
                          }}
                          title="AI Generated Template Preview"
                        />
                        {viewMode === "mobile" && (
                          <div className="bg-[#3a3735] py-2 flex justify-center">
                            <div className="w-10 h-1 rounded-full bg-[#555]" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <textarea
                      value={editableHtml}
                      onChange={(e) => setEditableHtml(e.target.value)}
                      className="w-full bg-[#131110] border-0 px-4 py-3 text-xs text-emerald-300/80 font-mono focus:outline-none resize-none leading-relaxed"
                      style={{ minHeight: "320px" }}
                      spellCheck={false}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
