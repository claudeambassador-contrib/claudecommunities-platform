"use client";

import { ChevronDown, ChevronUp, Loader2, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Can } from "@/components/admin/Can";
import { useTenantRouter } from "@/components/TenantBaseProvider";
import type { Block, RichTextBlock } from "@/lib/cms/blocks";
import { uuid } from "@/lib/uuid";
import { createPage, updatePage } from "./actions";

// Shared styling tokens (mirror the home editor / settings precedent).
const INPUT =
  "w-full px-4 py-2.5 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 transition-colors";
const LABEL = "block text-sm font-medium text-[#A8A29E] mb-1.5";

function newSection(): RichTextBlock {
  return { id: uuid(), type: "richText", enabled: true, heading: "", body: "" };
}

function isRichText(block: Block): block is RichTextBlock {
  return block.type === "richText";
}

function SectionRow({
  block,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}: {
  block: RichTextBlock;
  index: number;
  total: number;
  onChange: (b: RichTextBlock) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <section className="bg-[#2D2926] rounded-xl border border-white/[0.06] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Can permission="pages.edit">
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => onMove(-1)}
              disabled={index === 0}
              className="p-1 rounded text-[#78716C] hover:text-white disabled:opacity-30"
              aria-label="Move up"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onMove(1)}
              disabled={index === total - 1}
              className="p-1 rounded text-[#78716C] hover:text-white disabled:opacity-30"
              aria-label="Move down"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </Can>
        <span className="flex-1 text-sm font-medium text-white">Text section {index + 1}</span>
        <Can permission="pages.edit">
          <label className="inline-flex items-center gap-2 text-sm text-[#A8A29E] cursor-pointer">
            <input
              type="checkbox"
              checked={block.enabled}
              onChange={(e) => onChange({ ...block, enabled: e.target.checked })}
            />
            {block.enabled ? "Shown" : "Hidden"}
          </label>
          <button
            type="button"
            onClick={onRemove}
            className="p-1 rounded text-[#78716C] hover:text-red-400"
            aria-label="Remove section"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </Can>
      </div>
      <div>
        <span className={LABEL}>Heading</span>
        <input
          className={INPUT}
          value={block.heading ?? ""}
          onChange={(e) => onChange({ ...block, heading: e.target.value })}
          placeholder="Optional"
        />
      </div>
      <div>
        <span className={LABEL}>Body</span>
        <textarea
          className={INPUT}
          rows={6}
          value={block.body}
          onChange={(e) => onChange({ ...block, body: e.target.value })}
          placeholder="Plain text only — line breaks are preserved."
        />
      </div>
    </section>
  );
}

export default function ContentPageEditor({
  mode,
  pageId,
  initialTitle = "",
  initialPath = "",
  initialBlocks = [],
}: {
  mode: "create" | "edit";
  pageId?: string;
  initialTitle?: string;
  initialPath?: string;
  initialBlocks?: Block[];
}) {
  const router = useTenantRouter();
  const [title, setTitle] = useState(initialTitle);
  const [path, setPath] = useState(initialPath);
  const [sections, setSections] = useState<RichTextBlock[]>(
    initialBlocks.filter(isRichText).length > 0 ? initialBlocks.filter(isRichText) : [newSection()],
  );
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function updateSection(index: number, next: RichTextBlock) {
    setSections((prev) => prev.map((b, i) => (i === index ? next : b)));
  }

  function moveSection(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= sections.length) return;
    setSections((prev) => {
      const copy = [...prev];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  function save() {
    setResult(null);
    startTransition(async () => {
      const input = { path, title, blocks: sections };
      const res =
        mode === "create" ? await createPage(input) : await updatePage(pageId ?? "", input);
      if (res.ok) {
        if (mode === "create") {
          router.push(`/admin/pages/${res.id}`);
          return;
        }
        setResult({ ok: true, message: "Page saved." });
      } else {
        setResult({ ok: false, message: res.error });
      }
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  return (
    <div className="space-y-6">
      {result && (
        <div
          className={`p-3 rounded-lg text-sm ${
            result.ok ? "bg-[#10B981]/10 text-[#10B981]" : "bg-red-500/10 text-red-400"
          }`}
        >
          {result.message}
        </div>
      )}

      <div className="space-y-4 bg-[#2D2926] rounded-xl border border-white/[0.06] p-4">
        <div>
          <span className={LABEL}>Title</span>
          <input
            className={INPUT}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="About us"
          />
        </div>
        <div>
          <span className={LABEL}>Path</span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#78716C] font-mono">/p/</span>
            <input
              className={`${INPUT} font-mono`}
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="about  or  community/about"
            />
          </div>
          <p className="text-xs text-[#78716C] mt-1.5">
            Lowercase letters, numbers, and hyphens. Use slashes to create folders (e.g.{" "}
            <span className="font-mono">resources/getting-started</span>). This is the public URL —
            link to it from your footer in community settings.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {sections.map((block, index) => (
          <SectionRow
            key={block.id}
            block={block}
            index={index}
            total={sections.length}
            onChange={(next) => updateSection(index, next)}
            onMove={(dir) => moveSection(index, dir)}
            onRemove={() => setSections((prev) => prev.filter((_, i) => i !== index))}
          />
        ))}
      </div>

      <Can permission="pages.edit">
        <button
          type="button"
          onClick={() => setSections((prev) => [...prev, newSection()])}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-white/[0.12] hover:border-[#D4836A]/50 text-sm text-[#A8A29E] hover:text-white w-full justify-center transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add a text section
        </button>

        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#D4836A] hover:bg-[#c4775f] disabled:bg-[#D4836A]/50 text-white font-medium rounded-xl transition-colors"
        >
          {pending && <Loader2 className="w-5 h-5 animate-spin" />}
          {pending ? "Saving…" : mode === "create" ? "Create page" : "Save page"}
        </button>
      </Can>
    </div>
  );
}
