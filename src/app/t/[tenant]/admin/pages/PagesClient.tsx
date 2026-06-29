"use client";

import { ChevronDown, ChevronUp, ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useState, useTransition } from "react";
import { Can } from "@/components/admin/Can";
import {
  ALLOWED_ICONS,
  type AudienceCard,
  type AudienceSplitBlock,
  type BenefitCard,
  type BenefitsBlock,
  BLOCK_LABELS,
  type Block,
  type CtaBlock,
  type GalleryBlock,
  type HeroBlock,
  type RichTextBlock,
  type WebinarBlock,
} from "@/lib/cms/blocks";
import { resizeImage, uploadFile } from "@/lib/upload-client";
import { uuid } from "@/lib/uuid";
import { saveHomePage } from "./actions";

// ── Shared styling tokens (mirrors the settings precedent) ───────────────────
const INPUT =
  "w-full px-4 py-2.5 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 transition-colors";
const LABEL = "block text-sm font-medium text-[#A8A29E] mb-1.5";

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <span className={LABEL}>{label}</span>
      {children}
      {hint && <p className="text-xs text-[#78716C] mt-1">{hint}</p>}
    </div>
  );
}

const DEFAULT_HINT = "Leave blank to use the community default.";

/** A `<select>` constrained to the lucide allowlist — no free-text icon input. */
function IconSelect({ value, onChange }: { value: string; onChange: (icon: string) => void }) {
  return (
    <select className={INPUT} value={value} onChange={(e) => onChange(e.target.value)}>
      {ALLOWED_ICONS.map((icon) => (
        <option key={icon} value={icon}>
          {icon}
        </option>
      ))}
    </select>
  );
}

/** Image field: preview + upload + clear. Stores a URL string. */
function ImageField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  hint?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const resized = await resizeImage(file, 2000);
      const res = await uploadFile(resized, { folder: "home-cms" });
      onChange(res.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-4">
        <div className="relative w-28 h-20 rounded-lg overflow-hidden bg-[#1C1917] border border-white/[0.06] shrink-0">
          {value ? (
            <Image src={value} alt={label} fill sizes="112px" className="object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-[#78716C]">
              <ImagePlus className="w-5 h-5" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] text-sm text-white cursor-pointer w-fit">
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ImagePlus className="w-4 h-4" />
            )}
            {uploading ? "Uploading…" : "Upload"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
          </label>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      </div>
    </Field>
  );
}

// ── Per-type forms (each takes its concrete block type + typed onChange) ──────

function HeroForm({ block, onChange }: { block: HeroBlock; onChange: (b: HeroBlock) => void }) {
  return (
    <div className="space-y-4">
      <Field label="Badge" hint={DEFAULT_HINT}>
        <input
          className={INPUT}
          value={block.badge ?? ""}
          onChange={(e) => onChange({ ...block, badge: e.target.value })}
        />
      </Field>
      <Field
        label="Heading"
        hint="Use a new line to split the heading. Leave blank for the default."
      >
        <textarea
          className={INPUT}
          rows={2}
          value={block.heading ?? ""}
          onChange={(e) => onChange({ ...block, heading: e.target.value })}
        />
      </Field>
      <Field label="Body" hint={DEFAULT_HINT}>
        <textarea
          className={INPUT}
          rows={3}
          value={block.body ?? ""}
          onChange={(e) => onChange({ ...block, body: e.target.value })}
        />
      </Field>
      <Field label="Primary CTA label" hint={DEFAULT_HINT}>
        <input
          className={INPUT}
          value={block.primaryCtaLabel ?? ""}
          onChange={(e) => onChange({ ...block, primaryCtaLabel: e.target.value })}
        />
      </Field>
    </div>
  );
}

function WebinarForm({
  block,
  onChange,
}: {
  block: WebinarBlock;
  onChange: (b: WebinarBlock) => void;
}) {
  return (
    <div className="space-y-4">
      <Field label="Link" hint="Internal path (/…) or an https:// URL.">
        <input
          className={INPUT}
          value={block.href}
          onChange={(e) => onChange({ ...block, href: e.target.value })}
        />
      </Field>
      <Field label="Title">
        <input
          className={INPUT}
          value={block.title}
          onChange={(e) => onChange({ ...block, title: e.target.value })}
        />
      </Field>
      <Field label="Description">
        <textarea
          className={INPUT}
          rows={2}
          value={block.description}
          onChange={(e) => onChange({ ...block, description: e.target.value })}
        />
      </Field>
      <ImageField
        label="Thumbnail"
        value={block.thumbnailUrl}
        onChange={(url) => onChange({ ...block, thumbnailUrl: url })}
        hint="Upload an image, or keep the existing thumbnail URL."
      />
    </div>
  );
}

function BenefitsForm({
  block,
  onChange,
}: {
  block: BenefitsBlock;
  onChange: (b: BenefitsBlock) => void;
}) {
  function updateCard(i: number, card: BenefitCard) {
    onChange({ ...block, cards: block.cards.map((c, ci) => (ci === i ? card : c)) });
  }
  return (
    <div className="space-y-4">
      <Field label="Heading" hint={DEFAULT_HINT}>
        <input
          className={INPUT}
          value={block.heading ?? ""}
          onChange={(e) => onChange({ ...block, heading: e.target.value })}
        />
      </Field>
      <div className="space-y-3">
        <span className={LABEL}>Cards</span>
        {block.cards.map((card, i) => (
          <CardEditor
            // biome-ignore lint/suspicious/noArrayIndexKey: benefit cards have no stable id and are edited in place, so the array index is part of the key
            key={i}
            onRemove={() => onChange({ ...block, cards: block.cards.filter((_, ci) => ci !== i) })}
          >
            <Field label="Icon">
              <IconSelect value={card.icon} onChange={(icon) => updateCard(i, { ...card, icon })} />
            </Field>
            <Field label="Title">
              <input
                className={INPUT}
                value={card.title}
                onChange={(e) => updateCard(i, { ...card, title: e.target.value })}
              />
            </Field>
            <Field label="Description">
              <textarea
                className={INPUT}
                rows={2}
                value={card.desc}
                onChange={(e) => updateCard(i, { ...card, desc: e.target.value })}
              />
            </Field>
          </CardEditor>
        ))}
        <AddCardButton
          onClick={() =>
            onChange({
              ...block,
              cards: [...block.cards, { icon: ALLOWED_ICONS[0], title: "", desc: "" }],
            })
          }
        />
      </div>
    </div>
  );
}

function AudienceSplitForm({
  block,
  onChange,
}: {
  block: AudienceSplitBlock;
  onChange: (b: AudienceSplitBlock) => void;
}) {
  function updateCard(i: number, card: AudienceCard) {
    onChange({ ...block, cards: block.cards.map((c, ci) => (ci === i ? card : c)) });
  }
  return (
    <div className="space-y-4">
      <Field label="Heading" hint={DEFAULT_HINT}>
        <input
          className={INPUT}
          value={block.heading ?? ""}
          onChange={(e) => onChange({ ...block, heading: e.target.value })}
        />
      </Field>
      <Field label="Subheading" hint={DEFAULT_HINT}>
        <textarea
          className={INPUT}
          rows={2}
          value={block.subheading ?? ""}
          onChange={(e) => onChange({ ...block, subheading: e.target.value })}
        />
      </Field>
      <div className="space-y-3">
        <span className={LABEL}>Cards</span>
        {block.cards.map((card, i) => (
          <CardEditor
            // biome-ignore lint/suspicious/noArrayIndexKey: audience cards have no stable id and are edited in place, so the array index is part of the key
            key={i}
            onRemove={() => onChange({ ...block, cards: block.cards.filter((_, ci) => ci !== i) })}
          >
            <Field label="Link" hint="Internal path (/…) or an https:// URL.">
              <input
                className={INPUT}
                value={card.href}
                onChange={(e) => updateCard(i, { ...card, href: e.target.value })}
              />
            </Field>
            <Field label="Icon">
              <IconSelect value={card.icon} onChange={(icon) => updateCard(i, { ...card, icon })} />
            </Field>
            <Field label="Title">
              <input
                className={INPUT}
                value={card.title}
                onChange={(e) => updateCard(i, { ...card, title: e.target.value })}
              />
            </Field>
            <Field label="Description">
              <textarea
                className={INPUT}
                rows={2}
                value={card.desc}
                onChange={(e) => updateCard(i, { ...card, desc: e.target.value })}
              />
            </Field>
            <Field label="CTA label" hint={DEFAULT_HINT}>
              <input
                className={INPUT}
                value={card.ctaLabel ?? ""}
                onChange={(e) => updateCard(i, { ...card, ctaLabel: e.target.value })}
              />
            </Field>
          </CardEditor>
        ))}
        <AddCardButton
          onClick={() =>
            onChange({
              ...block,
              cards: [
                ...block.cards,
                { href: "/", icon: ALLOWED_ICONS[0], title: "", desc: "", ctaLabel: "" },
              ],
            })
          }
        />
      </div>
    </div>
  );
}

function GalleryForm({
  block,
  onChange,
}: {
  block: GalleryBlock;
  onChange: (b: GalleryBlock) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-[#78716C]">
        Gallery images are managed in community settings — this block only controls the heading and
        whether the gallery shows.
      </p>
      <Field label="Heading" hint={DEFAULT_HINT}>
        <input
          className={INPUT}
          value={block.heading ?? ""}
          onChange={(e) => onChange({ ...block, heading: e.target.value })}
        />
      </Field>
      <Field label="Subheading" hint={DEFAULT_HINT}>
        <textarea
          className={INPUT}
          rows={2}
          value={block.subheading ?? ""}
          onChange={(e) => onChange({ ...block, subheading: e.target.value })}
        />
      </Field>
    </div>
  );
}

function CtaForm({ block, onChange }: { block: CtaBlock; onChange: (b: CtaBlock) => void }) {
  return (
    <div className="space-y-4">
      <Field label="Heading (signed out)" hint={DEFAULT_HINT}>
        <input
          className={INPUT}
          value={block.headingSignedOut ?? ""}
          onChange={(e) => onChange({ ...block, headingSignedOut: e.target.value })}
        />
      </Field>
      <Field label="Body (signed out)" hint={DEFAULT_HINT}>
        <textarea
          className={INPUT}
          rows={3}
          value={block.bodySignedOut ?? ""}
          onChange={(e) => onChange({ ...block, bodySignedOut: e.target.value })}
        />
      </Field>
      <Field label="CTA label (signed out)" hint={DEFAULT_HINT}>
        <input
          className={INPUT}
          value={block.ctaLabelSignedOut ?? ""}
          onChange={(e) => onChange({ ...block, ctaLabelSignedOut: e.target.value })}
        />
      </Field>
    </div>
  );
}

function RichTextForm({
  block,
  onChange,
}: {
  block: RichTextBlock;
  onChange: (b: RichTextBlock) => void;
}) {
  return (
    <div className="space-y-4">
      <Field label="Heading" hint={DEFAULT_HINT}>
        <input
          className={INPUT}
          value={block.heading ?? ""}
          onChange={(e) => onChange({ ...block, heading: e.target.value })}
        />
      </Field>
      <Field label="Body" hint="Plain text only — line breaks are preserved.">
        <textarea
          className={INPUT}
          rows={5}
          value={block.body}
          onChange={(e) => onChange({ ...block, body: e.target.value })}
        />
      </Field>
    </div>
  );
}

/** Wrapper for a single repeatable card row (border + remove button). */
function CardEditor({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <div className="rounded-xl border border-white/[0.06] p-4 space-y-3 relative">
      <Can permission="pages.edit">
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-[#78716C] hover:text-red-400"
          aria-label="Remove card"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </Can>
      {children}
    </div>
  );
}

function AddCardButton({ onClick }: { onClick: () => void }) {
  return (
    <Can permission="pages.edit">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] text-sm text-white w-fit"
      >
        <Plus className="w-4 h-4" />
        Add card
      </button>
    </Can>
  );
}

/** Dispatch a block to its editable form. Markers render a short note. */
function BlockForm({ block, onChange }: { block: Block; onChange: (b: Block) => void }) {
  switch (block.type) {
    case "hero":
      return <HeroForm block={block} onChange={onChange} />;
    case "webinar":
      return <WebinarForm block={block} onChange={onChange} />;
    case "benefits":
      return <BenefitsForm block={block} onChange={onChange} />;
    case "audienceSplit":
      return <AudienceSplitForm block={block} onChange={onChange} />;
    case "gallery":
      return <GalleryForm block={block} onChange={onChange} />;
    case "cta":
      return <CtaForm block={block} onChange={onChange} />;
    case "richText":
      return <RichTextForm block={block} onChange={onChange} />;
    case "events":
      return (
        <p className="text-xs text-[#78716C]">
          The events section is dynamic — it always shows your upcoming events. Use the toggle to
          show or hide it; there's nothing else to edit here.
        </p>
      );
    case "discord":
      return (
        <p className="text-xs text-[#78716C]">
          The Discord section links to your community invite from settings. Use the toggle to show
          or hide it.
        </p>
      );
    default:
      return null;
  }
}

// ── Block row ────────────────────────────────────────────────────────────────

function BlockRow({
  block,
  index,
  total,
  expanded,
  onToggleExpand,
  onChange,
  onMove,
  onRemove,
}: {
  block: Block;
  index: number;
  total: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onChange: (b: Block) => void;
  onMove: (dir: -1 | 1) => void;
  /** Only provided for removable (user-added) blocks — singletons are toggle-only. */
  onRemove?: () => void;
}) {
  return (
    <section className="bg-[#2D2926] rounded-xl border border-white/[0.06] overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <div className="flex flex-col">
          <Can
            permission="pages.edit"
            fallback={
              <span className="text-base font-semibold text-white">{BLOCK_LABELS[block.type]}</span>
            }
          >
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onMove(-1)}
                disabled={index === 0}
                className="p-1 rounded text-[#78716C] hover:text-white disabled:opacity-30 disabled:hover:text-[#78716C]"
                aria-label="Move up"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onMove(1)}
                disabled={index === total - 1}
                className="p-1 rounded text-[#78716C] hover:text-white disabled:opacity-30 disabled:hover:text-[#78716C]"
                aria-label="Move down"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </Can>
        </div>

        <button
          type="button"
          onClick={onToggleExpand}
          className="flex-1 text-left text-base font-semibold text-white"
        >
          {BLOCK_LABELS[block.type]}
        </button>

        <Can
          permission="pages.edit"
          fallback={
            <span className="text-xs text-[#78716C]">{block.enabled ? "Shown" : "Hidden"}</span>
          }
        >
          <label className="inline-flex items-center gap-2 text-sm text-[#A8A29E] cursor-pointer">
            <input
              type="checkbox"
              checked={block.enabled}
              onChange={(e) => onChange({ ...block, enabled: e.target.checked })}
            />
            {block.enabled ? "Shown" : "Hidden"}
          </label>
        </Can>

        <button
          type="button"
          onClick={onToggleExpand}
          className="p-1 rounded text-[#78716C] hover:text-white"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {onRemove && (
          <Can permission="pages.edit">
            <button
              type="button"
              onClick={onRemove}
              className="p-1 rounded text-[#78716C] hover:text-red-400"
              aria-label="Remove section"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </Can>
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-white/[0.06] pt-4">
          <Can
            permission="pages.edit"
            fallback={<p className="text-xs text-[#78716C]">You don't have permission to edit.</p>}
          >
            <BlockForm block={block} onChange={onChange} />
          </Can>
        </div>
      )}
    </section>
  );
}

// ── Editor root ──────────────────────────────────────────────────────────────

export default function PagesClient({ initialBlocks }: { initialBlocks: Block[] }) {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function updateBlock(index: number, next: Block) {
    setBlocks((prev) => prev.map((b, i) => (i === index ? next : b)));
  }

  function moveBlock(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= blocks.length) return;
    setBlocks((prev) => {
      const copy = [...prev];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  /** Append a fresh, empty rich-text section — the tenant's "add your own content" path. */
  function addRichText() {
    const block: RichTextBlock = {
      id: uuid(),
      type: "richText",
      enabled: true,
      heading: "",
      body: "",
    };
    setBlocks((prev) => [...prev, block]);
    setExpandedId(block.id);
  }

  function removeBlock(index: number) {
    setBlocks((prev) => prev.filter((_, i) => i !== index));
  }

  function save() {
    setResult(null);
    startTransition(async () => {
      const res = await saveHomePage(blocks);
      setResult(
        res.ok ? { ok: true, message: "Home page saved." } : { ok: false, message: res.error },
      );
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

      <div className="space-y-3">
        {blocks.map((block, index) => (
          <BlockRow
            key={block.id}
            block={block}
            index={index}
            total={blocks.length}
            expanded={expandedId === block.id}
            onToggleExpand={() => setExpandedId((cur) => (cur === block.id ? null : block.id))}
            onChange={(next) => updateBlock(index, next)}
            onMove={(dir) => moveBlock(index, dir)}
            onRemove={block.type === "richText" ? () => removeBlock(index) : undefined}
          />
        ))}
      </div>

      <Can permission="pages.edit">
        <button
          type="button"
          onClick={addRichText}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-white/[0.12] hover:border-[#D4836A]/50 text-sm text-[#A8A29E] hover:text-white w-full justify-center transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add a text section
        </button>
      </Can>

      <Can permission="pages.edit">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#D4836A] hover:bg-[#c4775f] disabled:bg-[#D4836A]/50 text-white font-medium rounded-xl transition-colors"
          >
            {pending && <Loader2 className="w-5 h-5 animate-spin" />}
            {pending ? "Saving…" : "Save home page"}
          </button>
        </div>
      </Can>
    </div>
  );
}
