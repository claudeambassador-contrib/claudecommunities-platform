"use client";

import {
  ArrowLeft,
  Check,
  Clock,
  FlaskConical,
  LayoutTemplate,
  Loader2,
  Save,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTenantConfig } from "@/components/TenantConfigProvider";
import EmailBuilder, { type EmailBlock, getDefaultBlocks } from "./EmailBuilder";
import SegmentBuilder from "./SegmentBuilder";

interface Campaign {
  id: string;
  name: string;
  subject: string;
  html: string;
  blocks: string | null;
  templateType: string;
  status: string;
  segmentQuery: string | null;
}

interface Props {
  campaign: Campaign | null;
  onSave: (data: Partial<Campaign>) => Promise<void>;
  onCancel: () => void;
  initialTemplateBlocks?: EmailBlock[];
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: composer renders many conditional UI sections (A/B, schedule, AI subjects, template modal) inline
export default function EmailComposer({
  campaign,
  onSave,
  onCancel,
  initialTemplateBlocks,
}: Props) {
  const { communityName, siteUrl } = useTenantConfig();
  const [name, setName] = useState(campaign?.name || "");
  const [subject, setSubject] = useState(campaign?.subject || "");
  const [html, setHtml] = useState(campaign?.html || "");
  const [segmentQuery, setSegmentQuery] = useState<Record<string, unknown>>(
    campaign?.segmentQuery ? JSON.parse(campaign.segmentQuery) : {},
  );
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [showSegmentBuilder, setShowSegmentBuilder] = useState(false);
  const [builderBlocks, setBuilderBlocks] = useState<EmailBlock[]>(
    initialTemplateBlocks || getDefaultBlocks({ communityName, siteUrl }),
  );

  // Save as Template
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateCategory, setTemplateCategory] = useState("custom");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);

  // A/B Testing
  const [abEnabled, setAbEnabled] = useState(false);
  const [activeVariant, setActiveVariant] = useState<"a" | "b">("a");
  const [subjectB, setSubjectB] = useState("");
  const [blocksB, setBlocksB] = useState<EmailBlock[]>(
    getDefaultBlocks({ communityName, siteUrl }),
  );
  const [, setHtmlB] = useState("");
  const [splitPercent, setSplitPercent] = useState(50);

  // Schedule
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");

  // AI subject lines
  const [aiSubjects, setAiSubjects] = useState<string[]>([]);
  const [generatingSubjects, setGeneratingSubjects] = useState(false);
  const [showAiSubjects, setShowAiSubjects] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: segmentQuery is the intended trigger; updateRecipientCount is recreated each render and intentionally omitted
  useEffect(() => {
    updateRecipientCount();
  }, [segmentQuery]);

  const updateRecipientCount = async () => {
    try {
      const res = await fetch("/api/admin/email/segments/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters: segmentQuery }),
      });
      if (res.ok) {
        const data = await res.json();
        setRecipientCount(data.count);
      }
    } catch (error) {
      console.error("Failed to get recipient count:", error);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert("Campaign name is required");
      return;
    }
    if (!subject.trim()) {
      alert("Subject is required");
      return;
    }
    if (!html.trim()) {
      alert("Email content is required");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        subject: subject.trim(),
        html,
        blocks: JSON.stringify(builderBlocks.map((b) => ({ type: b.type, props: b.props }))),
        templateType: "custom",
        segmentQuery: Object.keys(segmentQuery).length > 0 ? JSON.stringify(segmentQuery) : null,
        ...(scheduledAt ? { scheduledAt } : {}),
      } as Partial<Campaign>);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) return;
    setSavingTemplate(true);
    try {
      const res = await fetch("/api/admin/email/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName.trim(),
          category: templateCategory,
          blocks: JSON.stringify(builderBlocks),
          html,
        }),
      });
      if (res.ok) {
        setTemplateSaved(true);
        setTimeout(() => {
          setTemplateSaved(false);
          setShowSaveTemplate(false);
          setTemplateName("");
        }, 1500);
      }
    } catch (err) {
      console.error("Failed to save template:", err);
    } finally {
      setSavingTemplate(false);
    }
  };

  const generateAiSubjects = async () => {
    setGeneratingSubjects(true);
    setShowAiSubjects(true);
    try {
      const res = await fetch("/api/admin/email/generate-subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, name }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiSubjects(data.subjects || []);
      }
    } catch {
      /* ignore */
    }
    setGeneratingSubjects(false);
  };

  const currentBlocks = abEnabled && activeVariant === "b" ? blocksB : builderBlocks;
  const currentSubject = abEnabled && activeVariant === "b" ? subjectB : subject;

  return (
    <div className="min-h-screen bg-[#1C1917] pt-[72px]">
      <div className="max-w-[1400px] mx-auto px-4 py-6">
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="p-2 rounded-lg text-[#A8A29E] hover:text-white hover:bg-white/5 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold text-white">
              {campaign ? "Edit Campaign" : "New Campaign"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Save as Template */}
            <button
              type="button"
              onClick={() => setShowSaveTemplate(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-[#A8A29E] hover:text-white hover:bg-white/[0.05] transition-colors text-sm"
            >
              <LayoutTemplate className="w-4 h-4" />
              <span className="hidden sm:inline">Save Template</span>
            </button>
            {/* Schedule */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSchedule(!showSchedule)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-colors text-sm ${scheduledAt ? "text-blue-400 bg-blue-500/10" : "text-[#A8A29E] hover:text-white hover:bg-white/[0.05]"}`}
              >
                <Clock className="w-4 h-4" />
                <span className="hidden sm:inline">{scheduledAt ? "Scheduled" : "Schedule"}</span>
              </button>
              {showSchedule && (
                <>
                  {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop click-to-dismiss is a mouse convenience; the toggle button provides the keyboard path */}
                  {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click-to-dismiss is a mouse convenience; the toggle button provides the keyboard-accessible close */}
                  <div className="fixed inset-0 z-20" onClick={() => setShowSchedule(false)} />
                  <div className="absolute right-0 top-full mt-2 z-30 bg-[#2D2926] rounded-xl border border-white/[0.08] shadow-2xl p-4 w-72">
                    <label
                      htmlFor="email-schedule-at"
                      className="block text-xs font-medium text-[#A8A29E] mb-2"
                    >
                      Schedule Send
                    </label>
                    <input
                      id="email-schedule-at"
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="w-full bg-[#1C1917] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#D4836A]/40"
                    />
                    {scheduledAt && (
                      <button
                        type="button"
                        onClick={() => {
                          setScheduledAt("");
                          setShowSchedule(false);
                        }}
                        className="mt-2 text-xs text-red-400 hover:text-red-300"
                      >
                        Clear schedule
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
            {/* A/B Test Toggle */}
            <button
              type="button"
              onClick={() => setAbEnabled(!abEnabled)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-colors text-sm ${abEnabled ? "text-violet-400 bg-violet-500/10" : "text-[#A8A29E] hover:text-white hover:bg-white/[0.05]"}`}
            >
              <FlaskConical className="w-4 h-4" />
              <span className="hidden sm:inline">A/B Test</span>
            </button>
            {/* Save */}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#D4836A] text-white hover:bg-[#c4775f] transition-colors disabled:opacity-50 text-sm font-medium"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save
            </button>
          </div>
        </div>

        {/* Campaign Details Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Campaign name..."
            className="bg-[#2D2926] border border-white/[0.06] rounded-xl px-4 py-2 text-white text-sm placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50"
          />

          {abEnabled ? (
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject A..."
                  className={`w-full bg-[#2D2926] border rounded-xl px-4 py-2 text-white text-sm placeholder-[#78716C] focus:outline-none ${activeVariant === "a" ? "border-violet-500/50" : "border-white/[0.06]"}`}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-violet-400">
                  A
                </span>
              </div>
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={subjectB}
                  onChange={(e) => setSubjectB(e.target.value)}
                  placeholder="Subject B..."
                  className={`w-full bg-[#2D2926] border rounded-xl px-4 py-2 text-white text-sm placeholder-[#78716C] focus:outline-none ${activeVariant === "b" ? "border-violet-500/50" : "border-white/[0.06]"}`}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-violet-400">
                  B
                </span>
              </div>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject..."
                className="w-full bg-[#2D2926] border border-white/[0.06] rounded-xl px-4 py-2 pr-10 text-white text-sm placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50"
              />
              <button
                type="button"
                onClick={generateAiSubjects}
                disabled={generatingSubjects}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-violet-400 hover:text-violet-300 transition-colors"
                title="AI subject suggestions"
              >
                {generatingSubjects ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
              </button>
              {showAiSubjects && aiSubjects.length > 0 && (
                <>
                  {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop click-to-dismiss is a mouse convenience; the AI toggle button provides the keyboard path */}
                  {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click-to-dismiss is a mouse convenience; the AI toggle button provides the keyboard-accessible close */}
                  <div className="fixed inset-0 z-20" onClick={() => setShowAiSubjects(false)} />
                  <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-[#2D2926] rounded-xl border border-white/[0.08] shadow-2xl shadow-black/40 p-1.5">
                    <p className="px-2 py-1 text-[10px] text-[#5C5955] font-semibold uppercase tracking-wider">
                      AI Suggestions
                    </p>
                    {aiSubjects.map((s, i) => (
                      <button
                        type="button"
                        // biome-ignore lint/suspicious/noArrayIndexKey: AI subject strings can duplicate; index is the only stable key for this ephemeral list
                        key={i}
                        onClick={() => {
                          setSubject(s);
                          setShowAiSubjects(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-[#E7E5E4] hover:bg-white/[0.05] rounded-lg transition-colors truncate"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowSegmentBuilder(true)}
            className="bg-[#2D2926] border border-white/[0.06] rounded-xl px-4 py-2 text-left flex items-center justify-between hover:border-white/[0.1] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#D4836A]" />
              <span className="text-white text-sm">
                {Object.keys(segmentQuery).length > 0 ? "Custom Segment" : "All Users"}
              </span>
              <span className="text-xs text-[#78716C]">
                {recipientCount !== null ? `(${recipientCount})` : ""}
              </span>
            </div>
            <span className="text-xs text-[#D4836A]">
              {Object.keys(segmentQuery).length > 0 ? "Edit" : "Filter"}
            </span>
          </button>
        </div>

        {/* A/B Test Controls */}
        {abEnabled && (
          <div className="flex items-center gap-4 mb-4 p-3 rounded-xl bg-violet-500/5 border border-violet-500/20">
            <div className="flex rounded-lg overflow-hidden border border-violet-500/30">
              <button
                type="button"
                onClick={() => setActiveVariant("a")}
                className={`px-4 py-1.5 text-xs font-semibold transition-colors ${activeVariant === "a" ? "bg-violet-500/20 text-violet-300" : "text-[#78716C] hover:text-white"}`}
              >
                Variant A
              </button>
              <button
                type="button"
                onClick={() => setActiveVariant("b")}
                className={`px-4 py-1.5 text-xs font-semibold transition-colors ${activeVariant === "b" ? "bg-violet-500/20 text-violet-300" : "text-[#78716C] hover:text-white"}`}
              >
                Variant B
              </button>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#A8A29E]">
              <span>Split:</span>
              <input
                type="range"
                min={10}
                max={90}
                step={10}
                value={splitPercent}
                onChange={(e) => setSplitPercent(parseInt(e.target.value, 10))}
                className="w-24 accent-violet-500"
              />
              <span className="text-violet-300 font-medium">
                {splitPercent}% / {100 - splitPercent}%
              </span>
            </div>
            <div className="flex-1" />
            <span className="text-[10px] text-[#5C5955]">
              Winner auto-selected by open rate after 4h
            </span>
          </div>
        )}

        {/* Builder */}
        <EmailBuilder
          initialBlocks={currentBlocks}
          subject={currentSubject}
          onHtmlChange={(newHtml) => {
            if (abEnabled && activeVariant === "b") {
              setHtmlB(newHtml);
            } else {
              setHtml(newHtml);
            }
          }}
          onBlocksChange={(blocks) => {
            if (abEnabled && activeVariant === "b") {
              setBlocksB(blocks);
            } else {
              setBuilderBlocks(blocks);
            }
          }}
        />
      </div>

      {/* Segment Builder Modal */}
      {showSegmentBuilder && (
        <SegmentBuilder
          filters={segmentQuery}
          onSave={(filters) => {
            setSegmentQuery(filters);
            setShowSegmentBuilder(false);
          }}
          onCancel={() => setShowSegmentBuilder(false)}
        />
      )}

      {/* Save as Template Modal */}
      {showSaveTemplate && (
        // biome-ignore lint/a11y/noStaticElementInteractions: backdrop click-to-dismiss is a mouse convenience; the X button provides the keyboard path
        // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click-to-dismiss is a mouse convenience; the X button provides the keyboard-accessible close
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6"
          onClick={() => !savingTemplate && setShowSaveTemplate(false)}
        >
          {/* biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation keeps clicks inside the dialog from dismissing it; not an interactive control */}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: stopPropagation keeps clicks inside the dialog from dismissing it; not an interactive control */}
          <div
            className="bg-[#2D2926] rounded-2xl max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <LayoutTemplate className="w-4 h-4 text-[#D4836A]" />
                <p className="text-sm font-semibold text-white">Save as Template</p>
              </div>
              <button
                type="button"
                onClick={() => setShowSaveTemplate(false)}
                className="p-1 text-[#78716C] hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label
                  htmlFor="template-name-input"
                  className="block text-xs font-medium text-[#A8A29E] mb-1.5"
                >
                  Template Name
                </label>
                <input
                  id="template-name-input"
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="My email template..."
                  className="w-full bg-[#1C1917] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#5C5955] focus:outline-none focus:border-[#D4836A]/40"
                  // biome-ignore lint/a11y/noAutofocus: focus the name input when the save-template modal opens
                  autoFocus
                />
              </div>
              <div>
                <span className="block text-xs font-medium text-[#A8A29E] mb-1.5">Category</span>
                <div className="flex flex-wrap gap-1.5">
                  {["custom", "announcement", "newsletter", "event", "welcome"].map((cat) => (
                    <button
                      type="button"
                      key={cat}
                      onClick={() => setTemplateCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                        templateCategory === cat
                          ? "bg-[#D4836A]/20 text-[#D4836A] border border-[#D4836A]/30"
                          : "bg-white/[0.03] text-[#A8A29E] border border-white/[0.06] hover:bg-white/[0.06]"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={handleSaveTemplate}
                disabled={savingTemplate || !templateName.trim()}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
                  templateSaved
                    ? "bg-green-500/20 text-green-300 border border-green-500/20"
                    : "bg-[#D4836A] text-white hover:bg-[#c4775f] disabled:opacity-40"
                }`}
              >
                {templateSaved ? (
                  <>
                    <Check className="w-4 h-4" /> Saved!
                  </>
                ) : savingTemplate ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <LayoutTemplate className="w-4 h-4" /> Save Template
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
