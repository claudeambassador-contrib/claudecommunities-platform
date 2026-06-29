"use client";

import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ChevronDown,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Loader2,
  Plus,
  Trash2,
  Type as TypeIcon,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ImageCropperModal from "@/components/ImageCropperModal";
import { SlideImage } from "@/components/slide-generator/SlideImage";
import { useToast } from "@/components/ui/Toast";
import { uploadFile } from "@/lib/upload-client";
import { CENTERED_STYLE, CLASSIC_STYLE } from "./builtinStyles";
import { FONT_OPTIONS, fontStack, loadAllFonts, loadFont } from "./fonts";
import {
  ASPECT_RATIOS,
  type AspectRatio,
  type BackgroundType,
  CUSTOM_TEXT_FONT_WEIGHTS,
  type CustomElement,
  type CustomImageElement,
  type CustomTextElement,
  type HeadshotShape,
  LAYOUT_PRESETS,
  LAYOUT_TEXT_ALIGN,
  type LayoutPreset,
  type SlideTemplate,
  type TextAlignableKey,
  type TextAlignment,
} from "./types";

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function makeTextElement(): CustomTextElement {
  return {
    id: randomId(),
    type: "text",
    text: "Sponsor",
    color: "#FAF9F6",
    fontSize: 16,
    fontFamily: "Inter",
    fontWeight: 500,
    position: { x: 5, y: 90 },
  };
}

function makeImageElement(url: string): CustomImageElement {
  return {
    id: randomId(),
    type: "image",
    url,
    position: { x: 5, y: 80, width: 12 },
  };
}

function useCustomElements(
  template: SlideTemplate,
  update: (patch: Partial<SlideTemplate>) => void,
) {
  const elements = template.custom_elements ?? [];
  const [uploading, setUploading] = useState(false);

  const updateElement = useCallback(
    (next: CustomElement) => {
      update({ custom_elements: elements.map((el) => (el.id === next.id ? next : el)) });
    },
    [elements, update],
  );

  const removeElement = useCallback(
    (id: string) => update({ custom_elements: elements.filter((el) => el.id !== id) }),
    [elements, update],
  );

  const addText = useCallback(
    () => update({ custom_elements: [...elements, makeTextElement()] }),
    [elements, update],
  );

  const addImageFile = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const res = await uploadFile(file, { folder: "slide-custom" });
        update({ custom_elements: [...elements, makeImageElement(res.url)] });
      } finally {
        setUploading(false);
      }
    },
    [elements, update],
  );

  return { elements, uploading, updateElement, removeElement, addText, addImageFile };
}

interface TemplatePanelProps {
  template: SlideTemplate;
  onChange: (patch: Partial<SlideTemplate>) => void;
  /**
   * Element currently selected in the canvas "edit positions" mode
   * (a `data-slide-el` key, or `custom:<id>`). When set, the matching control's
   * accordion opens and the control is highlighted + scrolled into view.
   */
  selectedElementKey?: string | null;
  /** Bumped on every (re)selection so re-picking the same element re-triggers. */
  selectionNonce?: number;
}

type SectionKey = "Canvas" | "Background" | "Header" | "Speaker" | "Extras";

/** Maps a draggable element key to the sidebar section + control it lives in. */
const ELEMENT_TO_SECTION: Record<string, { section: SectionKey; sub: string }> = {
  header: { section: "Header", sub: "header" },
  eventDate: { section: "Header", sub: "eventDate" },
  name: { section: "Speaker", sub: "name" },
  subtitle: { section: "Speaker", sub: "subtitle" },
  talk: { section: "Speaker", sub: "talk" },
  headshot: { section: "Speaker", sub: "headshot" },
  social: { section: "Speaker", sub: "social" },
  logo: { section: "Speaker", sub: "logo" },
};

function parseColor(color: string): { hex: string; alpha: number } {
  if (color === "transparent") return { hex: "#000000", alpha: 0 };
  if (color.startsWith("#")) return { hex: color.slice(0, 7), alpha: 1 };
  const m = color.match(/[\d.]+/g);
  if (!m) return { hex: "#ffffff", alpha: 1 };
  const r = Math.round(Number(m[0])).toString(16).padStart(2, "0");
  const g = Math.round(Number(m[1])).toString(16).padStart(2, "0");
  const b = Math.round(Number(m[2])).toString(16).padStart(2, "0");
  const a = m[3] !== undefined ? Number(m[3]) : 1;
  return { hex: `#${r}${g}${b}`, alpha: a };
}

function buildRgba(hex: string, alpha: number): string {
  if (alpha === 0) return "transparent";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (alpha >= 1) return hex;
  return `rgba(${r},${g},${b},${alpha})`;
}

function ColorAlphaPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { hex, alpha } = parseColor(value);
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        value={hex}
        onChange={(e) => onChange(buildRgba(e.target.value, alpha))}
        className="w-6 h-6 rounded cursor-pointer bg-transparent border border-white/[0.08]"
      />
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(alpha * 100)}
        onChange={(e) => onChange(buildRgba(hex, Number(e.target.value) / 100))}
        className="w-16 accent-[#D4836A]"
      />
      <span className="text-[9px] text-[#78716C] w-6 text-right font-mono">
        {Math.round(alpha * 100)}%
      </span>
    </div>
  );
}

function LayoutThumbnail({ layout, active }: { layout: LayoutPreset; active: boolean }) {
  const bar = active ? "bg-[#E09880]" : "bg-[#52525b]";
  const dot = active ? "bg-[#D4836A]" : "bg-white/[0.12]";
  const line = active ? "bg-[#D4836A]/60" : "bg-white/[0.08]";
  const base = "w-full aspect-video rounded bg-[#1C1917] relative overflow-hidden";

  if (layout === "bottom-left") {
    return (
      <div className={base}>
        <div className={`absolute top-1.5 left-1.5 h-0.5 w-4 rounded-full ${bar}`} />
        <div className="absolute bottom-1.5 left-1.5 flex items-end gap-1">
          <div className={`w-3 h-3 rounded-full shrink-0 ${dot}`} />
          <div className="space-y-0.5">
            <div className={`h-0.5 w-5 rounded-full ${bar}`} />
            <div className={`h-0.5 w-3 rounded-full ${line}`} />
          </div>
        </div>
      </div>
    );
  }
  if (layout === "centered") {
    return (
      <div className={base}>
        <div
          className={`absolute top-1.5 left-1/2 -translate-x-1/2 h-0.5 w-4 rounded-full ${bar}`}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <div className={`w-4 h-4 rounded-full ${dot}`} />
          <div className={`h-0.5 w-5 rounded-full mt-0.5 ${bar}`} />
          <div className={`h-0.5 w-3 rounded-full ${line}`} />
        </div>
      </div>
    );
  }
  if (layout === "right-panel") {
    return (
      <div className={base}>
        <div className={`absolute top-1.5 right-1.5 h-0.5 w-4 rounded-full ${bar}`} />
        <div className="absolute bottom-1.5 right-1.5 flex flex-col items-end gap-0.5">
          <div className={`w-3 h-3 rounded-full mb-0.5 ${dot}`} />
          <div className={`h-0.5 w-5 rounded-full ${bar}`} />
          <div className={`h-0.5 w-3 rounded-full ${line}`} />
        </div>
      </div>
    );
  }
  if (layout === "split") {
    return (
      <div className={base}>
        <div className={`absolute left-0 top-0 bottom-0 w-[42%] ${dot}`} />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 space-y-0.5">
          <div className={`h-0.5 w-3 rounded-full ${bar}`} />
          <div className={`h-0.5 w-5 rounded-full ${bar}`} />
          <div className={`h-0.5 w-3 rounded-full ${line}`} />
        </div>
      </div>
    );
  }
  if (layout === "banner") {
    return (
      <div className={base}>
        <div
          className={`absolute top-1.5 left-1/2 -translate-x-1/2 h-0.5 w-4 rounded-full ${bar}`}
        />
        <div className="absolute bottom-0 left-0 right-0 h-[35%] bg-black/40 flex items-center px-1 gap-1">
          <div className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
          <div className="space-y-0.5 flex-1">
            <div className={`h-0.5 w-4 rounded-full ${bar}`} />
            <div className={`h-0.5 w-2 rounded-full ${line}`} />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className={base}>
      <div className={`absolute top-1.5 left-1.5 h-0.5 w-4 rounded-full ${bar}`} />
      <div className="absolute bottom-1.5 left-1.5 space-y-0.5">
        <div className={`h-0.5 w-2 rounded-full ${line}`} />
        <div className={`h-1 w-6 rounded-full ${bar}`} />
        <div className={`h-0.5 w-4 rounded-full ${line}`} />
      </div>
    </div>
  );
}

const ALIGNMENT_OPTIONS: { value: TextAlignment; label: string; Icon: typeof AlignLeft }[] = [
  { value: "left", label: "Left", Icon: AlignLeft },
  { value: "center", label: "Centered", Icon: AlignCenter },
  { value: "right", label: "Right", Icon: AlignRight },
  { value: "justify", label: "Block-quote (justify)", Icon: AlignJustify },
];

function AlignmentPicker({
  value,
  onChange,
}: {
  value: TextAlignment;
  onChange: (v: TextAlignment) => void;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-white/[0.06] bg-[#0D0C0B] p-0.5">
      {ALIGNMENT_OPTIONS.map(({ value: v, label, Icon }) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            title={label}
            aria-label={label}
            aria-pressed={active}
            className={`flex items-center justify-center w-6 h-6 rounded transition-colors ${
              active
                ? "bg-[#D4836A] text-white"
                : "text-[#78716C] hover:text-white hover:bg-white/[0.06]"
            }`}
          >
            <Icon className="w-3 h-3" />
          </button>
        );
      })}
    </div>
  );
}

function TextAlignRow({
  template,
  elementKey,
  onChange,
}: {
  template: SlideTemplate;
  elementKey: TextAlignableKey;
  onChange: (patch: Partial<SlideTemplate>) => void;
}) {
  const current =
    template.text_alignments?.[elementKey] ?? LAYOUT_TEXT_ALIGN[template.layout] ?? "left";
  const setAlign = (next: TextAlignment) => {
    onChange({
      text_alignments: { ...(template.text_alignments ?? {}), [elementKey]: next },
    });
  };
  return (
    <div className="flex items-center gap-2 mt-2">
      <span className="text-[10px] text-[#78716C] w-10">Align</span>
      <AlignmentPicker value={current} onChange={setAlign} />
    </div>
  );
}

function VisibilityToggle({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={visible ? "Hide on slide" : "Show on slide"}
      className={`shrink-0 inline-flex items-center justify-center rounded-md border transition-colors h-6 w-6 ${
        visible
          ? "border-white/[0.08] text-[#A8A29E] hover:text-white"
          : "border-white/[0.06] text-[#52525b] bg-white/[0.04]"
      }`}
    >
      {visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
    </button>
  );
}

function FontPickerInline({
  value,
  onChange,
}: {
  value: string;
  onChange: (font: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const cats = [
    { key: "all", label: "All" },
    { key: "sans", label: "Sans" },
    { key: "serif", label: "Serif" },
    { key: "display", label: "Display" },
    { key: "mono", label: "Mono" },
  ] as const;
  const filtered =
    filter === "all" ? FONT_OPTIONS : FONT_OPTIONS.filter((f) => f.category === filter);

  return (
    <div className="relative mt-1.5" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#1C1917] border border-white/[0.08] text-white text-xs hover:bg-[#2D2926] transition-colors w-full"
        style={{ fontFamily: fontStack(value) }}
      >
        <span className="flex-1 text-left truncate">{value}</span>
        <ChevronDown className="h-3 w-3 shrink-0 text-[#78716C]" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-56 right-0 bg-[#1C1917] border border-white/[0.08] rounded-lg shadow-xl overflow-hidden">
          <div className="flex gap-0.5 p-1.5 border-b border-white/[0.06]">
            {cats.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setFilter(cat.key)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  filter === cat.key
                    ? "bg-[#D4836A] text-white"
                    : "text-[#78716C] hover:text-[#A8A29E] hover:bg-white/[0.04]"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <div className="max-h-[240px] overflow-y-auto p-1">
            {filtered.map((font) => (
              <button
                key={font.family}
                type="button"
                onClick={() => {
                  onChange(font.family);
                  setOpen(false);
                }}
                className={`w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors ${
                  value === font.family
                    ? "bg-[#D4836A]/20 text-white"
                    : "text-[#A8A29E] hover:bg-white/[0.04] hover:text-white"
                }`}
                style={{ fontFamily: fontStack(font.family) }}
              >
                {font.family}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CustomElementEditor({
  element,
  onChange,
  onRemove,
}: {
  element: CustomElement;
  onChange: (next: CustomElement) => void;
  onRemove: () => void;
}) {
  const replaceFileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleReplace = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const res = await uploadFile(file, { folder: "slide-custom" });
        if (element.type === "image") onChange({ ...element, url: res.url });
      } finally {
        setUploading(false);
      }
    },
    [element, onChange],
  );

  return (
    <div className="rounded-lg border border-white/[0.06] bg-[#1C1917]/60 p-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] text-[#A8A29E] uppercase tracking-widest">
          {element.type === "text" ? (
            <TypeIcon className="w-3 h-3" />
          ) : (
            <ImageIcon className="w-3 h-3" />
          )}
          <span>{element.type === "text" ? "Text" : "Image"}</span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-[#78716C] hover:text-red-400 transition-colors"
          title="Remove element"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {element.type === "text" ? (
        <>
          <textarea
            value={element.text}
            onChange={(e) => onChange({ ...element, text: e.target.value })}
            rows={2}
            className="w-full px-2 py-1.5 rounded-md bg-[#0D0C0B] border border-white/[0.08] text-white text-xs resize-none focus:outline-none focus:border-[#D4836A]"
            placeholder="Sponsor / venue / tag"
            style={{ fontFamily: fontStack(element.fontFamily) }}
          />
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#78716C] w-10">Color</span>
            <ColorAlphaPicker
              value={element.color}
              onChange={(v) => onChange({ ...element, color: v })}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#78716C] w-10">Size</span>
            <input
              type="range"
              value={element.fontSize}
              min={8}
              max={96}
              step={1}
              onChange={(e) => onChange({ ...element, fontSize: Number(e.target.value) })}
              className="flex-1 accent-[#D4836A]"
            />
            <span className="text-[10px] text-[#78716C] w-8 text-right">{element.fontSize}px</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#78716C] w-10">Weight</span>
            <select
              value={element.fontWeight}
              onChange={(e) => onChange({ ...element, fontWeight: Number(e.target.value) })}
              className="flex-1 px-1.5 py-1 rounded-md bg-[#0D0C0B] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-[#D4836A]"
            >
              {CUSTOM_TEXT_FONT_WEIGHTS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="text-[10px] text-[#78716C]">Font</span>
            <FontPickerInline
              value={element.fontFamily}
              onChange={(font) => onChange({ ...element, fontFamily: font })}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#78716C] w-10">Align</span>
            <AlignmentPicker
              value={element.textAlign ?? "left"}
              onChange={(v) => onChange({ ...element, textAlign: v })}
            />
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <div className="w-12 h-12 rounded-md bg-black/40 overflow-hidden flex items-center justify-center border border-white/[0.06] shrink-0">
              {element.url ? (
                <SlideImage
                  src={element.url}
                  alt={element.alt ?? ""}
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <ImageIcon className="w-4 h-4 text-[#52525b]" />
              )}
            </div>
            <button
              type="button"
              onClick={() => replaceFileRef.current?.click()}
              disabled={uploading}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-white/80 text-xs disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Upload className="w-3 h-3" />
              )}
              Replace
            </button>
            <input
              ref={replaceFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleReplace(f);
                e.target.value = "";
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#78716C] w-10">Width</span>
            <input
              type="range"
              value={element.position.width ?? 12}
              min={3}
              max={60}
              step={1}
              onChange={(e) =>
                onChange({
                  ...element,
                  position: { ...element.position, width: Number(e.target.value) },
                })
              }
              className="flex-1 accent-[#D4836A]"
            />
            <span className="text-[10px] text-[#78716C] w-9 text-right">
              {Math.round(element.position.width ?? 12)}%
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function ExtrasSection({
  elements,
  onAddText,
  onAddImageFile,
  onUpdate,
  onRemove,
  uploading,
  highlightId,
}: {
  elements: CustomElement[];
  onAddText: () => void;
  onAddImageFile: (file: File) => void;
  onUpdate: (next: CustomElement) => void;
  onRemove: (id: string) => void;
  uploading: boolean;
  highlightId?: string | null;
}) {
  const imageFileRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <div className="flex items-center justify-end mb-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onAddText}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-[10px] text-white/80"
          >
            <Plus className="w-3 h-3" />
            Text
          </button>
          <button
            type="button"
            onClick={() => imageFileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-[10px] text-white/80 disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Plus className="w-3 h-3" />
            )}
            Image
          </button>
          <input
            ref={imageFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onAddImageFile(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>
      {elements.length === 0 ? (
        <p className="text-[11px] text-[#78716C]">
          Add sponsors, venue tags, or any extra text/image that should appear on every speaker
          slide. Drag to reposition once added.
        </p>
      ) : (
        <div className="space-y-2">
          {elements.map((el) => (
            <div
              key={el.id}
              data-sub={el.id}
              className={
                highlightId === el.id
                  ? "rounded-lg shadow-[0_0_0_1px_rgba(212,131,106,0.6)]"
                  : undefined
              }
            >
              <CustomElementEditor
                element={el}
                onChange={onUpdate}
                onRemove={() => onRemove(el.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AccordionSection({
  title,
  open,
  onToggle,
  rightSlot,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-white/[0.04]">
      <div className="flex items-center gap-2 py-2">
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 flex items-center gap-2 text-left text-[11px] uppercase tracking-widest text-[#A8A29E] hover:text-white transition-colors"
          aria-expanded={open}
        >
          <ChevronDown
            className={`w-3 h-3 transition-transform shrink-0 ${open ? "" : "-rotate-90"}`}
          />
          {title}
        </button>
        {rightSlot && <div className="shrink-0">{rightSlot}</div>}
      </div>
      {open && <div className="pb-4">{children}</div>}
    </div>
  );
}

function SubSection({
  title,
  rightSlot,
  dim = false,
  subKey,
  highlight = false,
  children,
}: {
  title?: string;
  rightSlot?: React.ReactNode;
  dim?: boolean;
  /** Maps this control to a draggable element key, for select-to-highlight. */
  subKey?: string;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      data-sub={subKey}
      className={`pt-3 mt-3 border-t border-white/[0.04] first:pt-0 first:mt-0 first:border-t-0 ${
        dim ? "opacity-50" : ""
      } ${
        highlight
          ? "rounded-md bg-[#D4836A]/[0.08] shadow-[0_0_0_1px_rgba(212,131,106,0.6)] -mx-1.5 px-1.5"
          : ""
      }`}
    >
      {(title || rightSlot) && (
        <div className="flex items-center justify-between mb-2 min-h-[1.25rem]">
          {title ? (
            <span className="text-[10px] uppercase tracking-widest text-[#78716C]">{title}</span>
          ) : (
            <span />
          )}
          {rightSlot}
        </div>
      )}
      {children}
    </div>
  );
}

export default function TemplatePanel({
  template,
  onChange,
  selectedElementKey,
  selectionNonce,
}: TemplatePanelProps) {
  const toast = useToast();
  const update = useCallback((patch: Partial<SlideTemplate>) => onChange(patch), [onChange]);
  const bgFileRef = useRef<HTMLInputElement>(null);
  const [bgCropFile, setBgCropFile] = useState<File | null>(null);
  const [uploadingBg, setUploadingBg] = useState(false);

  const extras = useCustomElements(template, update);

  const panelRef = useRef<HTMLDivElement>(null);
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    Canvas: true,
    Background: false,
    Header: false,
    Speaker: false,
    Extras: false,
  });
  const toggleSection = useCallback(
    (k: SectionKey) => setOpenSections((s) => ({ ...s, [k]: !s[k] })),
    [],
  );
  const [highlightSub, setHighlightSub] = useState<string | null>(null);

  // Open + highlight the control matching the element selected on the canvas.
  // biome-ignore lint/correctness/useExhaustiveDependencies: selectionNonce is an intentional extra trigger — it re-runs this open+highlight when the same element is re-selected (nonce bump), which selectedElementKey alone wouldn't catch
  useEffect(() => {
    if (!selectedElementKey) {
      setHighlightSub(null);
      return;
    }
    let section: SectionKey | null = null;
    let sub: string | null = null;
    if (selectedElementKey.startsWith("custom:")) {
      section = "Extras";
      sub = selectedElementKey.slice("custom:".length);
    } else {
      const m = ELEMENT_TO_SECTION[selectedElementKey];
      if (m) {
        section = m.section;
        sub = m.sub;
      }
    }
    if (!section || !sub) return;
    const sectionKey = section;
    setOpenSections((prev) => (prev[sectionKey] ? prev : { ...prev, [sectionKey]: true }));
    setHighlightSub(sub);
  }, [selectedElementKey, selectionNonce]);

  // Scroll the highlighted control into view once its section is open/in the DOM.
  // biome-ignore lint/correctness/useExhaustiveDependencies: openSections and selectionNonce are intentional extra triggers — re-run the scroll after a section expands into the DOM and on every re-selection (nonce bump)
  useEffect(() => {
    if (!highlightSub) return;
    const root = panelRef.current;
    if (!root) return;
    const el = root.querySelector(`[data-sub="${CSS.escape(highlightSub)}"]`);
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [highlightSub, openSections, selectionNonce]);

  useEffect(() => {
    loadAllFonts();
  }, []);

  useEffect(() => {
    loadFont(template.header_font);
    loadFont(template.event_date_font);
    loadFont(template.name_font);
    loadFont(template.title_font);
    loadFont(template.description_font);
  }, [
    template.header_font,
    template.event_date_font,
    template.name_font,
    template.title_font,
    template.description_font,
  ]);

  useEffect(() => {
    for (const el of extras.elements) {
      if (el.type === "text") loadFont(el.fontFamily);
    }
  }, [extras.elements]);

  const handleBgFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBgCropFile(file);
    e.target.value = "";
  };

  const handleBgCropConfirm = async (cropped: File) => {
    setBgCropFile(null);
    setUploadingBg(true);
    try {
      const { url } = await uploadFile(cropped, { folder: "slide-backgrounds" });
      update({ background_type: "image", background_image_url: url });
    } catch (err) {
      console.error("Background upload failed:", err);
      toast.error("Failed to upload background", err instanceof Error ? err.message : String(err));
    } finally {
      setUploadingBg(false);
    }
  };

  const bgAspect =
    template.aspect_ratio === "1:1"
      ? 1
      : template.aspect_ratio === "9:16"
        ? 9 / 16
        : template.aspect_ratio === "4:3"
          ? 4 / 3
          : 16 / 9;

  const bgTypes: { key: BackgroundType; label: string }[] = [
    { key: "color", label: "Solid" },
    { key: "gradient", label: "Gradient" },
    { key: "image", label: "Image" },
  ];

  const aspectOptions = Object.keys(ASPECT_RATIOS) as AspectRatio[];

  return (
    <div ref={panelRef} className="px-4">
      <AccordionSection
        title="Canvas"
        open={openSections.Canvas}
        onToggle={() => toggleSection("Canvas")}
      >
        <SubSection title="Aspect Ratio">
          <div className="flex gap-1.5">
            {aspectOptions.map((ratio) => (
              <button
                key={ratio}
                type="button"
                onClick={() => update({ aspect_ratio: ratio })}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  template.aspect_ratio === ratio
                    ? "bg-[#D4836A] text-white"
                    : "bg-[#1C1917] text-[#A8A29E] hover:bg-white/[0.05]"
                }`}
              >
                {ratio}
              </button>
            ))}
          </div>
        </SubSection>

        <SubSection title="Layout">
          <div className="grid grid-cols-3 gap-1.5">
            {LAYOUT_PRESETS.map((preset) => {
              const active = template.layout === preset.id;
              const applyLayout = () => {
                if (preset.id === "bottom-left") {
                  update({ ...CLASSIC_STYLE });
                } else if (preset.id === "centered") {
                  update({ ...CENTERED_STYLE });
                } else {
                  update({ layout: preset.id, layout_config: {} });
                }
              };
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={applyLayout}
                  className={`rounded-lg border p-1.5 transition-all ${
                    active
                      ? "border-[#D4836A] bg-[#D4836A]/10"
                      : "border-white/[0.06] bg-[#1C1917] hover:border-white/[0.12]"
                  }`}
                >
                  <LayoutThumbnail layout={preset.id} active={active} />
                  <div
                    className={`text-[9px] font-medium mt-1 text-center ${
                      active ? "text-[#E09880]" : "text-[#78716C]"
                    }`}
                  >
                    {preset.label}
                  </div>
                </button>
              );
            })}
          </div>
        </SubSection>
      </AccordionSection>

      <AccordionSection
        title="Background"
        open={openSections.Background}
        onToggle={() => toggleSection("Background")}
      >
        <SubSection title="Background">
          <div className="flex gap-1.5 mb-3">
            {bgTypes.map((bt) => (
              <button
                key={bt.key}
                type="button"
                onClick={() => update({ background_type: bt.key })}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  template.background_type === bt.key
                    ? "bg-[#D4836A] text-white"
                    : "bg-[#1C1917] text-[#A8A29E] hover:bg-white/[0.05]"
                }`}
              >
                {bt.label}
              </button>
            ))}
          </div>

          {template.background_type === "color" && (
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={template.background_color}
                onChange={(e) => update({ background_color: e.target.value })}
                className="w-8 h-8 rounded cursor-pointer bg-transparent border border-white/[0.08]"
              />
              <input
                value={template.background_color}
                onChange={(e) => update({ background_color: e.target.value })}
                className="flex-1 bg-[#1C1917] border border-white/[0.08] rounded text-white text-xs h-8 px-2 font-mono"
              />
            </div>
          )}

          {template.background_type === "gradient" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={template.background_gradient_from}
                  onChange={(e) => update({ background_gradient_from: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer bg-transparent border border-white/[0.08]"
                />
                <input
                  value={template.background_gradient_from}
                  onChange={(e) => update({ background_gradient_from: e.target.value })}
                  className="flex-1 bg-[#1C1917] border border-white/[0.08] rounded text-white text-xs h-8 px-2 font-mono"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={template.background_gradient_to}
                  onChange={(e) => update({ background_gradient_to: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer bg-transparent border border-white/[0.08]"
                />
                <input
                  value={template.background_gradient_to}
                  onChange={(e) => update({ background_gradient_to: e.target.value })}
                  className="flex-1 bg-[#1C1917] border border-white/[0.08] rounded text-white text-xs h-8 px-2 font-mono"
                />
              </div>
              <div
                className="h-6 rounded-md border border-white/[0.08]"
                style={{
                  background: `linear-gradient(135deg, ${template.background_gradient_from}, ${template.background_gradient_to})`,
                }}
              />
            </div>
          )}

          {template.background_type === "image" && (
            <div>
              <input
                ref={bgFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleBgFileSelect}
              />
              {template.background_image_url ? (
                <div className="relative group">
                  <SlideImage
                    src={template.background_image_url}
                    alt="Background"
                    className="w-full h-20 object-cover rounded-md border border-white/[0.08]"
                  />
                  <button
                    type="button"
                    onClick={() => bgFileRef.current?.click()}
                    disabled={uploadingBg}
                    className="absolute inset-0 w-full h-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs flex items-center justify-center gap-1.5 rounded-md disabled:opacity-50"
                  >
                    {uploadingBg ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Upload className="w-3 h-3" />
                    )}
                    {uploadingBg ? "Uploading…" : "Replace"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => bgFileRef.current?.click()}
                  disabled={uploadingBg}
                  className="w-full h-20 rounded-md border border-dashed border-white/[0.12] bg-[#1C1917] hover:border-[#D4836A]/60 text-[#A8A29E] hover:text-white text-xs flex flex-col items-center justify-center gap-1 transition-colors"
                >
                  <ImageIcon className="w-4 h-4" />
                  {uploadingBg ? "Uploading…" : "Upload background"}
                </button>
              )}
            </div>
          )}
        </SubSection>

        <SubSection title="Overlay">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(template.overlay_opacity * 100)}
              onChange={(e) => update({ overlay_opacity: Number(e.target.value) / 100 })}
              className="flex-1 accent-[#D4836A]"
            />
            <span className="text-xs text-[#A8A29E] w-8 text-right font-mono">
              {Math.round(template.overlay_opacity * 100)}%
            </span>
          </div>
        </SubSection>
      </AccordionSection>

      <AccordionSection
        title="Header"
        open={openSections.Header}
        onToggle={() => toggleSection("Header")}
      >
        <SubSection
          title="Header text"
          subKey="header"
          highlight={highlightSub === "header"}
          dim={template.show_header === false}
          rightSlot={
            <VisibilityToggle
              visible={template.show_header}
              onToggle={() => update({ show_header: !template.show_header })}
            />
          }
        >
          <input
            value={template.header_text}
            onChange={(e) => update({ header_text: e.target.value })}
            placeholder="Claude Community AU"
            className="w-full bg-[#1C1917] border border-white/[0.08] rounded-md text-white text-sm h-9 px-2 placeholder:text-[#52525b]"
          />
          <div className="flex items-center gap-2 mt-2">
            <input
              type="color"
              value={template.header_color}
              onChange={(e) => update({ header_color: e.target.value })}
              className="w-6 h-6 rounded cursor-pointer bg-transparent border border-white/[0.08]"
            />
            <input
              type="range"
              value={template.header_font_size}
              min={8}
              max={72}
              step={1}
              onChange={(e) => update({ header_font_size: Number(e.target.value) })}
              className="flex-1 accent-[#D4836A]"
            />
            <span className="text-[10px] text-[#78716C] w-6 text-right">
              {template.header_font_size}
            </span>
          </div>
          <FontPickerInline
            value={template.header_font}
            onChange={(f) => update({ header_font: f })}
          />
          <TextAlignRow template={template} elementKey="header" onChange={update} />
        </SubSection>

        <SubSection
          title="Event date"
          subKey="eventDate"
          highlight={highlightSub === "eventDate"}
          dim={template.show_event_date === false}
          rightSlot={
            <VisibilityToggle
              visible={template.show_event_date}
              onToggle={() => update({ show_event_date: !template.show_event_date })}
            />
          }
        >
          <input
            type="date"
            value={template.event_date ?? ""}
            onChange={(e) => update({ event_date: e.target.value || null })}
            className="w-full bg-[#1C1917] border border-white/[0.08] rounded-md text-white text-sm h-9 px-2 placeholder:text-[#52525b]"
          />
          <div className="flex items-center gap-2 mt-2">
            <input
              type="color"
              value={template.event_date_color}
              onChange={(e) => update({ event_date_color: e.target.value })}
              className="w-6 h-6 rounded cursor-pointer bg-transparent border border-white/[0.08]"
            />
            <input
              type="range"
              value={template.event_date_font_size}
              min={8}
              max={48}
              step={1}
              onChange={(e) => update({ event_date_font_size: Number(e.target.value) })}
              className="flex-1 accent-[#D4836A]"
            />
            <span className="text-[10px] text-[#78716C] w-6 text-right">
              {template.event_date_font_size}
            </span>
          </div>
          <FontPickerInline
            value={template.event_date_font}
            onChange={(f) => update({ event_date_font: f })}
          />
          <TextAlignRow template={template} elementKey="eventDate" onChange={update} />
        </SubSection>
      </AccordionSection>

      <AccordionSection
        title="Speaker"
        open={openSections.Speaker}
        onToggle={() => toggleSection("Speaker")}
      >
        <SubSection
          title="Name"
          subKey="name"
          highlight={highlightSub === "name"}
          dim={template.show_name === false}
          rightSlot={
            <VisibilityToggle
              visible={template.show_name}
              onToggle={() => update({ show_name: !template.show_name })}
            />
          }
        >
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={template.name_color}
              onChange={(e) => update({ name_color: e.target.value })}
              className="w-6 h-6 rounded cursor-pointer bg-transparent border border-white/[0.08]"
            />
            <input
              type="range"
              value={template.name_font_size}
              min={12}
              max={96}
              step={1}
              onChange={(e) => update({ name_font_size: Number(e.target.value) })}
              className="flex-1 accent-[#D4836A]"
            />
            <span className="text-[10px] text-[#78716C] w-6 text-right">
              {template.name_font_size}
            </span>
          </div>
          <FontPickerInline value={template.name_font} onChange={(f) => update({ name_font: f })} />
          <TextAlignRow template={template} elementKey="name" onChange={update} />
        </SubSection>

        <SubSection
          title="Title / Company"
          subKey="subtitle"
          highlight={highlightSub === "subtitle"}
          dim={template.show_title === false}
          rightSlot={
            <VisibilityToggle
              visible={template.show_title}
              onToggle={() => update({ show_title: !template.show_title })}
            />
          }
        >
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={template.title_color}
              onChange={(e) => update({ title_color: e.target.value })}
              className="w-6 h-6 rounded cursor-pointer bg-transparent border border-white/[0.08]"
            />
            <input
              type="range"
              value={template.title_font_size}
              min={8}
              max={72}
              step={1}
              onChange={(e) => update({ title_font_size: Number(e.target.value) })}
              className="flex-1 accent-[#D4836A]"
            />
            <span className="text-[10px] text-[#78716C] w-6 text-right">
              {template.title_font_size}
            </span>
          </div>
          <FontPickerInline
            value={template.title_font}
            onChange={(f) => update({ title_font: f })}
          />
          <TextAlignRow template={template} elementKey="subtitle" onChange={update} />
        </SubSection>

        <SubSection
          title="Talk"
          subKey="talk"
          highlight={highlightSub === "talk"}
          dim={template.show_description === false && template.show_talk_title === false}
          rightSlot={
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-[#52525b]">Title</span>
              <VisibilityToggle
                visible={template.show_talk_title}
                onToggle={() => update({ show_talk_title: !template.show_talk_title })}
              />
              <span className="text-[9px] text-[#52525b] ml-1">Desc</span>
              <VisibilityToggle
                visible={template.show_description}
                onToggle={() => update({ show_description: !template.show_description })}
              />
            </div>
          }
        >
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={template.description_color}
              onChange={(e) => update({ description_color: e.target.value })}
              className="w-6 h-6 rounded cursor-pointer bg-transparent border border-white/[0.08]"
            />
            <input
              type="range"
              value={template.description_font_size}
              min={8}
              max={72}
              step={1}
              onChange={(e) => update({ description_font_size: Number(e.target.value) })}
              className="flex-1 accent-[#D4836A]"
            />
            <span className="text-[10px] text-[#78716C] w-6 text-right">
              {template.description_font_size}
            </span>
          </div>
          <FontPickerInline
            value={template.description_font}
            onChange={(f) => update({ description_font: f })}
          />
          <TextAlignRow template={template} elementKey="talk" onChange={update} />
        </SubSection>

        <SubSection
          title="Headshot"
          subKey="headshot"
          highlight={highlightSub === "headshot"}
          dim={template.show_headshot === false}
          rightSlot={
            <VisibilityToggle
              visible={template.show_headshot}
              onToggle={() => update({ show_headshot: !template.show_headshot })}
            />
          }
        >
          <div className="flex gap-1.5 mb-2">
            {(["circle", "rounded"] as HeadshotShape[]).map((shape) => (
              <button
                key={shape}
                type="button"
                onClick={() => update({ headshot_shape: shape })}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
                  template.headshot_shape === shape
                    ? "bg-[#D4836A] text-white"
                    : "bg-[#1C1917] text-[#A8A29E] hover:bg-white/[0.05]"
                }`}
              >
                {shape}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#78716C]">Size</span>
            <input
              type="range"
              value={template.headshot_size}
              min={60}
              max={600}
              step={5}
              onChange={(e) => {
                const newSize = Number(e.target.value);
                const oldSize = template.headshot_size;
                const head = template.layout_config.elementPositions?.headshot;
                const patch: Partial<SlideTemplate> = { headshot_size: newSize };
                if (head?.width && oldSize > 0) {
                  const ratio = newSize / oldSize;
                  patch.layout_config = {
                    ...template.layout_config,
                    elementPositions: {
                      ...template.layout_config.elementPositions,
                      headshot: {
                        ...head,
                        width: head.width * ratio,
                        ...(head.height ? { height: head.height * ratio } : {}),
                      },
                    },
                  };
                }
                update(patch);
              }}
              className="flex-1 accent-[#D4836A]"
            />
            <span className="text-[10px] text-[#78716C] w-10 text-right">
              {template.headshot_size}px
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={() => update({ headshot_border_visible: !template.headshot_border_visible })}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                template.headshot_border_visible
                  ? "bg-[#D4836A] text-white"
                  : "bg-[#1C1917] text-[#A8A29E] hover:bg-white/[0.05]"
              }`}
            >
              Border
            </button>
            {template.headshot_border_visible && (
              <ColorAlphaPicker
                value={template.headshot_border_color}
                onChange={(v) => update({ headshot_border_color: v })}
              />
            )}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={() =>
                update({
                  headshot_bg_color:
                    template.headshot_bg_color === "transparent"
                      ? "rgba(255,255,255,0.08)"
                      : "transparent",
                })
              }
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                template.headshot_bg_color !== "transparent"
                  ? "bg-[#D4836A] text-white"
                  : "bg-[#1C1917] text-[#A8A29E] hover:bg-white/[0.05]"
              }`}
            >
              Fill
            </button>
            {template.headshot_bg_color !== "transparent" && (
              <ColorAlphaPicker
                value={template.headshot_bg_color}
                onChange={(v) => update({ headshot_bg_color: v })}
              />
            )}
          </div>
        </SubSection>

        <SubSection
          title="Social links"
          subKey="social"
          highlight={highlightSub === "social"}
          dim={template.show_social === false}
          rightSlot={
            <VisibilityToggle
              visible={template.show_social}
              onToggle={() => update({ show_social: !template.show_social })}
            />
          }
        >
          <p className="text-[11px] text-[#78716C]">
            Twitter, LinkedIn and website are pulled from the speaker's profile.
          </p>
          <TextAlignRow template={template} elementKey="social" onChange={update} />
        </SubSection>

        <SubSection
          title="Company logo"
          subKey="logo"
          highlight={highlightSub === "logo"}
          dim={template.show_logo === false}
          rightSlot={
            <VisibilityToggle
              visible={template.show_logo}
              onToggle={() => update({ show_logo: !template.show_logo })}
            />
          }
        >
          <p className="text-[11px] text-[#78716C]">Uploaded per speaker in the speaker editor.</p>
        </SubSection>
      </AccordionSection>

      <AccordionSection
        title="Extras"
        open={openSections.Extras}
        onToggle={() => toggleSection("Extras")}
      >
        <ExtrasSection
          elements={extras.elements}
          onAddText={extras.addText}
          onAddImageFile={extras.addImageFile}
          onUpdate={extras.updateElement}
          onRemove={extras.removeElement}
          uploading={extras.uploading}
          highlightId={highlightSub}
        />
      </AccordionSection>

      {/* Background image cropper */}
      {bgCropFile && (
        <ImageCropperModal
          file={bgCropFile}
          aspect={bgAspect}
          outputSize={2400}
          cropShape="rect"
          title="Crop background"
          onCancel={() => setBgCropFile(null)}
          onConfirm={handleBgCropConfirm}
        />
      )}
    </div>
  );
}
