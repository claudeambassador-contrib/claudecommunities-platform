"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ChevronDown,
  ChevronUp,
  Code,
  Columns,
  Copy,
  Eye,
  GripVertical,
  Heading,
  Image as ImageIcon,
  Loader2,
  Minus,
  Monitor,
  MousePointerClick,
  MoveVertical,
  Palette,
  Plus,
  Redo2,
  Share2,
  Smartphone,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTenantConfig } from "@/components/TenantConfigProvider";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { type BlockType, blocksToHtml, type EmailBlock, emailLogoUrl } from "@/lib/email/blocks";
import { wrapEmailContent } from "@/lib/email/wrap";
import { uploadFile } from "@/lib/upload-client";

export type { EmailBlock };
// Re-export so existing consumers can keep importing from this module.
export { blocksToHtml };

// ─── Types ───────────────────────────────────────────────────────────

interface BlockDef {
  type: BlockType;
  label: string;
  icon: React.ReactNode;
  defaultProps: Record<string, unknown>;
}

// ─── Constants ───────────────────────────────────────────────────────

const DEFAULT_HEADER_IMAGE =
  "https://pub-27024d1895484e8c9e5dbc037aedba64.r2.dev/email-assets/default-header-v1.png";

const BLOCK_DEFS: BlockDef[] = [
  {
    type: "image",
    label: "Header",
    icon: <Heading className="w-4 h-4" />,
    defaultProps: {
      src: DEFAULT_HEADER_IMAGE,
      // `alt` is set to the tenant's communityName at call time (getDefaultBlocks /
      // addBlock) — it can't be baked into this module-level constant.
      alt: "",
      link: "",
      width: "100%",
      align: "center",
      borderRadius: 0,
    },
  },
  {
    type: "text",
    label: "Text",
    icon: <Type className="w-4 h-4" />,
    defaultProps: {
      content: "Hey {{name}},\n\nYour text content goes here. Write something compelling!",
      fontSize: 15,
      color: "#E7E5E4",
      align: "left",
    },
  },
  {
    type: "image",
    label: "Image",
    icon: <ImageIcon className="w-4 h-4" />,
    defaultProps: {
      src: "",
      alt: "",
      link: "",
      width: "100%",
      align: "center",
      borderRadius: 12,
    },
  },
  {
    type: "button",
    label: "Button",
    icon: <MousePointerClick className="w-4 h-4" />,
    defaultProps: {
      text: "Learn More",
      // `url` is set to the tenant's site URL at call time (getDefaultBlocks /
      // addBlock) — it can't be baked into this module-level constant.
      url: "",
      bgColor: "#D4836A",
      textColor: "#ffffff",
      align: "left",
      borderRadius: 8,
      fullWidth: false,
    },
  },
  {
    type: "divider",
    label: "Divider",
    icon: <Minus className="w-4 h-4" />,
    defaultProps: {
      color: "rgba(255,255,255,0.06)",
      width: "100%",
      thickness: 1,
      style: "solid",
    },
  },
  {
    type: "spacer",
    label: "Spacer",
    icon: <MoveVertical className="w-4 h-4" />,
    defaultProps: { height: 24 },
  },
  {
    type: "columns",
    label: "2 Columns",
    icon: <Columns className="w-4 h-4" />,
    defaultProps: {
      leftContent: "Left column content",
      rightContent: "Right column content",
      leftImage: "",
      rightImage: "",
      ratio: "50-50",
    },
  },
  {
    type: "social",
    label: "Social",
    icon: <Share2 className="w-4 h-4" />,
    defaultProps: {
      align: "center",
      links: [
        // The "Website" url is set to the tenant's site URL at call time (addBlock).
        { platform: "Website", url: "" },
        { platform: "LinkedIn", url: "https://linkedin.com" },
      ],
    },
  },
  {
    type: "html",
    label: "HTML",
    icon: <Code className="w-4 h-4" />,
    defaultProps: {
      code: '<p style="color: #E7E5E4;">Custom HTML block</p>',
    },
  },
];

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function getDefaultBlocks(opts: { communityName: string; siteUrl: string }): EmailBlock[] {
  return [
    {
      id: uid(),
      type: BLOCK_DEFS[0].type,
      props: { ...BLOCK_DEFS[0].defaultProps, alt: opts.communityName },
    },
    { id: uid(), type: "text", props: { ...BLOCK_DEFS[1].defaultProps } },
    {
      id: uid(),
      type: "button",
      props: { ...BLOCK_DEFS[3].defaultProps, url: `${opts.siteUrl}/community` },
    },
  ];
}

// ─── Shared Prop Inputs ──────────────────────────────────────────────

function PropInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[11px] font-medium text-[#78716C] mb-1 uppercase tracking-wide"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#1C1917] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-[#5C5955] focus:outline-none focus:border-[#D4836A]/40"
      />
    </div>
  );
}

function PropTextarea({
  label,
  value,
  onChange,
  rows = 4,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  mono?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[11px] font-medium text-[#78716C] mb-1 uppercase tracking-wide"
      >
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className={`w-full bg-[#1C1917] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-[#5C5955] focus:outline-none focus:border-[#D4836A]/40 resize-none ${mono ? "font-mono text-xs" : ""}`}
      />
    </div>
  );
}

function PropToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between">
      <label
        htmlFor={id}
        className="text-[11px] font-medium text-[#78716C] uppercase tracking-wide"
      >
        {label}
      </label>
      <button
        id={id}
        type="button"
        onClick={() => onChange(!value)}
        className={`w-9 h-5 rounded-full transition-colors relative ${value ? "bg-[#D4836A]" : "bg-white/[0.1]"}`}
      >
        <div
          className={`w-3.5 h-3.5 rounded-full bg-white absolute top-[3px] transition-transform ${value ? "translate-x-[19px]" : "translate-x-[3px]"}`}
        />
      </button>
    </div>
  );
}

function PropSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[11px] font-medium text-[#78716C] mb-1 uppercase tracking-wide"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#1C1917] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#D4836A]/40"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function PropColor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[11px] font-medium text-[#78716C] mb-1 uppercase tracking-wide"
      >
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value.startsWith("#") ? value : "#D4836A"}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded-lg border border-white/[0.08] bg-transparent cursor-pointer"
        />
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-[#1C1917] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#D4836A]/40"
        />
      </div>
    </div>
  );
}

function AlignButtons({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <span className="block text-[11px] font-medium text-[#78716C] mb-1 uppercase tracking-wide">
        Alignment
      </span>
      <div className="flex rounded-lg overflow-hidden border border-white/[0.08]">
        {[
          { v: "left", icon: <AlignLeft className="w-3.5 h-3.5" /> },
          { v: "center", icon: <AlignCenter className="w-3.5 h-3.5" /> },
          { v: "right", icon: <AlignRight className="w-3.5 h-3.5" /> },
        ].map((a) => (
          <button
            type="button"
            key={a.v}
            onClick={() => onChange(a.v)}
            className={`flex-1 p-2 text-center transition-colors ${value === a.v ? "bg-[#D4836A]/20 text-[#D4836A]" : "text-[#78716C] hover:text-white hover:bg-white/[0.05]"}`}
          >
            {a.icon}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Image Upload ────────────────────────────────────────────────────

function ImageUploader({
  currentSrc,
  onUpload,
}: {
  currentSrc: string;
  onUpload: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      const result = await uploadFile(file, { folder: "email-campaigns" });
      onUpload(result.url);
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <span className="block text-[11px] font-medium text-[#78716C] mb-1 uppercase tracking-wide">
        Image
      </span>
      {currentSrc ? (
        <div className="relative group">
          <RemoteImage
            src={currentSrc}
            alt=""
            className="w-full h-32 object-cover rounded-lg border border-white/[0.08]"
          />
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="px-3 py-1.5 bg-white/10 text-white text-xs rounded-lg hover:bg-white/20 transition-colors"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => onUpload("")}
              className="px-3 py-1.5 bg-red-500/20 text-red-300 text-xs rounded-lg hover:bg-red-500/30 transition-colors"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          onClick={() => inputRef.current?.click()}
          className={`w-full border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${dragOver ? "border-[#D4836A] bg-[#D4836A]/5" : "border-white/[0.08] hover:border-white/[0.15] bg-[#1C1917]"}`}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-[#D4836A] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-[#78716C]">Uploading...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-6 h-6 text-[#78716C]" />
              <p className="text-xs text-[#78716C]">
                Drop image or <span className="text-[#D4836A]">click to upload</span>
              </p>
            </div>
          )}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <div className="mt-2">
        <input
          type="text"
          value={currentSrc}
          onChange={(e) => onUpload(e.target.value)}
          placeholder="Or paste image URL..."
          className="w-full bg-[#1C1917] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-white placeholder-[#5C5955] focus:outline-none focus:border-[#D4836A]/40"
        />
      </div>
    </div>
  );
}

// ─── Canvas Image Uploader (inline on canvas) ────────────────────────

function CanvasImageUploader({ onUpload }: { onUpload: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      const result = await uploadFile(file, { folder: "email-campaigns" });
      onUpload(result.url);
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ padding: "12px 20px" }}>
      <button
        type="button"
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.stopPropagation();
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        onClick={(e) => {
          e.stopPropagation();
          inputRef.current?.click();
        }}
        style={{
          width: "100%",
          background: dragOver ? "rgba(212,131,106,0.08)" : "#2D2926",
          border: `2px dashed ${dragOver ? "#D4836A" : "rgba(255,255,255,0.1)"}`,
          borderRadius: 12,
          padding: "36px 20px",
          textAlign: "center",
          cursor: "pointer",
          transition: "all 0.15s",
        }}
      >
        {uploading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div className="w-8 h-8 border-2 border-[#D4836A] border-t-transparent rounded-full animate-spin" />
            <span style={{ color: "#A8A29E", fontSize: 13 }}>Uploading...</span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: "rgba(212,131,106,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Upload className="w-6 h-6 text-[#D4836A]" />
            </div>
            <span style={{ color: "#A8A29E", fontSize: 13 }}>
              Drop image here or{" "}
              <span style={{ color: "#D4836A", fontWeight: 600 }}>click to upload</span>
            </span>
            <span style={{ color: "#5C5955", fontSize: 11 }}>JPG, PNG, GIF, WebP up to 10MB</span>
          </div>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}

// ─── Properties Panel ────────────────────────────────────────────────

function PropertiesPanel({
  block,
  onChange,
}: {
  block: EmailBlock;
  onChange: (props: Record<string, unknown>) => void;
}) {
  const update = (key: string, value: unknown) => onChange({ ...block.props, [key]: value });
  const p = block.props;

  switch (block.type) {
    case "header":
      return (
        <div className="space-y-3">
          <PropInput label="Title" value={String(p.title)} onChange={(v) => update("title", v)} />
          <PropInput
            label="Subtitle"
            value={String(p.subtitle)}
            onChange={(v) => update("subtitle", v)}
            placeholder="Optional subtitle"
          />
          <PropToggle
            label="Show Logo"
            value={Boolean(p.showLogo)}
            onChange={(v) => update("showLogo", v)}
          />
          <PropColor
            label="Background"
            value={String(p.bgGradient)}
            onChange={(v) => update("bgGradient", v)}
          />
        </div>
      );
    case "text":
      return (
        <div className="space-y-3">
          <PropTextarea
            label="Content"
            value={String(p.content)}
            onChange={(v) => update("content", v)}
            rows={6}
          />
          <div className="grid grid-cols-2 gap-2">
            <PropInput
              label="Font Size"
              value={String(p.fontSize)}
              onChange={(v) => update("fontSize", parseInt(v, 10) || 15)}
              type="number"
            />
            <PropColor label="Color" value={String(p.color)} onChange={(v) => update("color", v)} />
          </div>
          <AlignButtons value={String(p.align)} onChange={(v) => update("align", v)} />
        </div>
      );
    case "image":
      return (
        <div className="space-y-3">
          <ImageUploader currentSrc={String(p.src || "")} onUpload={(v) => update("src", v)} />
          <PropInput
            label="Alt Text"
            value={String(p.alt)}
            onChange={(v) => update("alt", v)}
            placeholder="Describe the image"
          />
          <PropInput
            label="Link URL"
            value={String(p.link)}
            onChange={(v) => update("link", v)}
            placeholder="https://..."
          />
          <div className="grid grid-cols-2 gap-2">
            <PropInput
              label="Width"
              value={String(p.width)}
              onChange={(v) => update("width", v)}
              placeholder="100% or 300px"
            />
            <PropInput
              label="Radius"
              value={String(p.borderRadius)}
              onChange={(v) => update("borderRadius", parseInt(v, 10) || 0)}
              type="number"
            />
          </div>
          <AlignButtons value={String(p.align)} onChange={(v) => update("align", v)} />
        </div>
      );
    case "button":
      return (
        <div className="space-y-3">
          <PropInput
            label="Button Text"
            value={String(p.text)}
            onChange={(v) => update("text", v)}
          />
          <PropInput
            label="URL"
            value={String(p.url)}
            onChange={(v) => update("url", v)}
            placeholder="https://..."
          />
          <div className="grid grid-cols-2 gap-2">
            <PropColor
              label="BG Color"
              value={String(p.bgColor)}
              onChange={(v) => update("bgColor", v)}
            />
            <PropColor
              label="Text Color"
              value={String(p.textColor)}
              onChange={(v) => update("textColor", v)}
            />
          </div>
          <PropInput
            label="Radius"
            value={String(p.borderRadius)}
            onChange={(v) => update("borderRadius", parseInt(v, 10) || 8)}
            type="number"
          />
          <AlignButtons value={String(p.align)} onChange={(v) => update("align", v)} />
          <PropToggle
            label="Full Width"
            value={Boolean(p.fullWidth)}
            onChange={(v) => update("fullWidth", v)}
          />
        </div>
      );
    case "divider":
      return (
        <div className="space-y-3">
          <PropColor label="Color" value={String(p.color)} onChange={(v) => update("color", v)} />
          <div className="grid grid-cols-2 gap-2">
            <PropInput
              label="Thickness"
              value={String(p.thickness)}
              onChange={(v) => update("thickness", parseInt(v, 10) || 1)}
              type="number"
            />
            <PropSelect
              label="Style"
              value={String(p.style)}
              options={[
                { value: "solid", label: "Solid" },
                { value: "dashed", label: "Dashed" },
                { value: "dotted", label: "Dotted" },
              ]}
              onChange={(v) => update("style", v)}
            />
          </div>
        </div>
      );
    case "spacer":
      return (
        <div className="space-y-3">
          <PropInput
            label="Height (px)"
            value={String(p.height)}
            onChange={(v) => update("height", parseInt(v, 10) || 24)}
            type="number"
          />
          <input
            type="range"
            min={4}
            max={120}
            value={Number(p.height)}
            onChange={(e) => update("height", parseInt(e.target.value, 10))}
            className="w-full accent-[#D4836A]"
          />
        </div>
      );
    case "columns":
      return (
        <div className="space-y-3">
          <PropSelect
            label="Ratio"
            value={String(p.ratio)}
            options={[
              { value: "50-50", label: "50 / 50" },
              { value: "30-70", label: "30 / 70" },
              { value: "70-30", label: "70 / 30" },
            ]}
            onChange={(v) => update("ratio", v)}
          />
          <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
            <p className="text-[10px] font-semibold text-[#5C5955] uppercase tracking-wider mb-2">
              Left Column
            </p>
            <div className="space-y-2">
              <ImageUploader
                currentSrc={String(p.leftImage || "")}
                onUpload={(v) => update("leftImage", v)}
              />
              <PropTextarea
                label="Text"
                value={String(p.leftContent)}
                onChange={(v) => update("leftContent", v)}
                rows={3}
              />
            </div>
          </div>
          <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
            <p className="text-[10px] font-semibold text-[#5C5955] uppercase tracking-wider mb-2">
              Right Column
            </p>
            <div className="space-y-2">
              <ImageUploader
                currentSrc={String(p.rightImage || "")}
                onUpload={(v) => update("rightImage", v)}
              />
              <PropTextarea
                label="Text"
                value={String(p.rightContent)}
                onChange={(v) => update("rightContent", v)}
                rows={3}
              />
            </div>
          </div>
        </div>
      );
    case "social": {
      const links = (p.links || []) as Array<{ platform: string; url: string }>;
      return (
        <div className="space-y-3">
          <AlignButtons value={String(p.align)} onChange={(v) => update("align", v)} />
          <span className="block text-[11px] font-medium text-[#78716C] uppercase tracking-wide">
            Links
          </span>
          {links.map((link, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: social links have no stable id in the persisted block shape; inputs are fully controlled by value so index reconciliation is safe here
            <div key={i} className="flex gap-2">
              <input
                value={link.platform}
                onChange={(e) => {
                  const u = [...links];
                  u[i] = { ...u[i], platform: e.target.value };
                  update("links", u);
                }}
                placeholder="Platform"
                className="w-24 bg-[#1C1917] border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
              />
              <input
                value={link.url}
                onChange={(e) => {
                  const u = [...links];
                  u[i] = { ...u[i], url: e.target.value };
                  update("links", u);
                }}
                placeholder="URL"
                className="flex-1 bg-[#1C1917] border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
              />
              <button
                type="button"
                onClick={() =>
                  update(
                    "links",
                    links.filter((_, j) => j !== i),
                  )
                }
                className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => update("links", [...links, { platform: "Link", url: "" }])}
            className="text-xs text-[#D4836A] hover:text-[#c4775f] transition-colors"
          >
            + Add link
          </button>
        </div>
      );
    }
    case "html":
      return (
        <div className="space-y-3">
          <PropTextarea
            label="HTML Code"
            value={String(p.code)}
            onChange={(v) => update("code", v)}
            rows={10}
            mono
          />
          {String(p.code).length > 200 && (
            <div>
              <span className="block text-[11px] font-medium text-[#78716C] mb-1 uppercase tracking-wide">
                Preview
              </span>
              <div
                className="rounded-lg border border-white/[0.08] overflow-hidden bg-white"
                style={{ height: 200 }}
              >
                <iframe
                  srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:0;font-family:sans-serif;transform:scale(0.4);transform-origin:top left;width:250%;}img{max-width:100%;height:auto;}table{border-collapse:collapse;}</style></head><body>${String(p.code).replace(/<body[^>]*>([\s\S]*)<\/body>/i, "$1")}</body></html>`}
                  className="w-full h-full border-0"
                  title="HTML Preview"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>
          )}
        </div>
      );
    default:
      return null;
  }
}

// ─── HTML Block Rendered Preview ─────────────────────────────────────

function HtmlBlockPreview({ code }: { code: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(400);

  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        // Extract styles from head and body content separately
        let styles = "";
        const styleMatches = code.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
        if (styleMatches) styles = styleMatches.join("\n");
        let bodyContent = code;
        const bodyMatch = code.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        if (bodyMatch) bodyContent = bodyMatch[1];
        // Also extract body attributes for bgcolor etc
        const bodyAttrMatch = code.match(/<body([^>]*)>/i);
        const bodyAttrs = bodyAttrMatch ? bodyAttrMatch[1] : "";

        doc.write(
          `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">${styles}<style>body{margin:0;padding:0;}img{max-width:100%;height:auto;}table{border-collapse:collapse;}</style></head><body ${bodyAttrs}>${bodyContent}</body></html>`,
        );
        doc.close();
        // Auto-resize: measure actual content height, scale it
        const resize = () => {
          if (iframeRef.current?.contentDocument?.body) {
            const h = iframeRef.current.contentDocument.body.scrollHeight;
            // The iframe is rendered at 200% width and scaled to 50%, so height needs the same treatment
            setIframeHeight(Math.min(h * 0.5, 1200));
          }
        };
        setTimeout(resize, 200);
        setTimeout(resize, 800);
        setTimeout(resize, 2000); // images may load late
      }
    }
  }, [code]);

  return (
    <div className="rounded-lg overflow-auto" style={{ maxHeight: 800 }}>
      <iframe
        ref={iframeRef}
        className="w-[200%] origin-top-left border-0 pointer-events-none"
        style={{ transform: "scale(0.5)", height: iframeHeight, transformOrigin: "top left" }}
        title="HTML Preview"
        sandbox="allow-same-origin"
      />
    </div>
  );
}

// ─── Interactive Block Canvas Renderer ───────────────────────────────

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: cohesive switch rendering one branch per block type; splitting it would thread shared props/closures with no behavior change
function BlockPreview({
  block,
  isSelected,
  onUpdate,
}: {
  block: EmailBlock;
  isSelected: boolean;
  onUpdate: (key: string, value: unknown) => void;
}) {
  const p = block.props;
  const { siteUrl } = useTenantConfig();

  // Inline editable helper
  const EditableText = ({
    value,
    propKey,
    style,
    className,
    tag: Tag = "div",
  }: {
    value: string;
    propKey: string;
    style?: React.CSSProperties;
    className?: string;
    tag?: "div" | "h2" | "p" | "span";
  }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [editing, setEditing] = useState(false);

    return (
      <Tag
        ref={ref as React.RefObject<never>}
        contentEditable={isSelected}
        suppressContentEditableWarning
        onFocus={() => setEditing(true)}
        onBlur={(e: React.FocusEvent<HTMLElement>) => {
          setEditing(false);
          const newVal = (e.target as HTMLElement).innerText;
          if (newVal !== value) onUpdate(propKey, newVal);
        }}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            (e.target as HTMLElement).blur();
          }
        }}
        style={{
          ...style,
          outline: "none",
          cursor: isSelected ? "text" : "default",
          borderBottom: editing ? "1px dashed rgba(212,131,106,0.5)" : "1px dashed transparent",
          transition: "border-color 0.15s",
        }}
        className={className}
      >
        {value}
      </Tag>
    );
  };

  switch (block.type) {
    case "header":
      return (
        <div
          style={{
            background: String(p.bgGradient),
            padding: "24px",
            textAlign: "center",
            borderRadius: "12px 12px 0 0",
          }}
        >
          {Boolean(p.showLogo) && (
            <RemoteImage
              src={emailLogoUrl({ siteUrl })}
              alt=""
              style={{
                width: 48,
                height: 48,
                borderRadius: 10,
                marginBottom: 8,
                display: "inline-block",
              }}
            />
          )}
          <EditableText
            tag="h2"
            value={String(p.title)}
            propKey="title"
            style={{ color: "white", margin: 0, fontSize: 20, fontWeight: 700, minHeight: 28 }}
          />
          {(Boolean(p.subtitle) || isSelected) && (
            <EditableText
              tag="p"
              value={String(p.subtitle || "")}
              propKey="subtitle"
              style={{
                color: "rgba(255,255,255,0.75)",
                margin: "6px 0 0",
                fontSize: 13,
                minHeight: isSelected ? 18 : undefined,
              }}
            />
          )}
        </div>
      );

    case "text":
      return (
        <div style={{ padding: "0 20px" }}>
          <EditableText
            value={String(p.content)}
            propKey="content"
            style={{
              color: String(p.color),
              fontSize: Number(p.fontSize) * 0.9,
              lineHeight: 1.6,
              textAlign: String(p.align) as CanvasTextAlign,
              whiteSpace: "pre-wrap",
              minHeight: 40,
            }}
          />
        </div>
      );

    case "image":
      if (!p.src) {
        return <CanvasImageUploader onUpload={(url) => onUpdate("src", url)} />;
      }
      return (
        <div
          style={{
            padding: "6px 20px",
            textAlign: String(p.align) as CanvasTextAlign,
            position: "relative",
          }}
        >
          <RemoteImage
            src={String(p.src)}
            alt={String(p.alt)}
            style={{
              maxWidth: String(p.width),
              width: String(p.width),
              height: "auto",
              borderRadius: Number(p.borderRadius),
              display: p.align === "center" ? "block" : "inline-block",
              margin: p.align === "center" ? "0 auto" : undefined,
            }}
          />
        </div>
      );

    case "button":
      return (
        <div style={{ padding: "6px 20px", textAlign: String(p.align) as CanvasTextAlign }}>
          <EditableText
            tag="span"
            value={String(p.text)}
            propKey="text"
            style={{
              display: p.fullWidth ? "block" : "inline-block",
              background: String(p.bgColor),
              color: String(p.textColor),
              padding: "10px 22px",
              borderRadius: Number(p.borderRadius),
              fontWeight: 600,
              fontSize: 14,
              textAlign: "center",
              minWidth: 80,
            }}
          />
        </div>
      );

    case "divider":
      return (
        <div style={{ padding: "6px 20px" }}>
          <hr
            style={{
              border: "none",
              borderTop: `${p.thickness}px ${p.style} ${p.color}`,
              margin: 0,
              width: String(p.width),
            }}
          />
        </div>
      );

    case "spacer":
      return (
        <div
          style={{
            height: Number(p.height),
            position: "relative",
            background: isSelected ? "rgba(212,131,106,0.03)" : undefined,
            transition: "background 0.15s",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              fontSize: 10,
              color: isSelected ? "#D4836A" : "#5C5955",
              whiteSpace: "nowrap",
            }}
          >
            {isSelected ? `↕ ${Number(p.height)}px` : `${Number(p.height)}px`}
          </div>
        </div>
      );

    case "columns": {
      const leftW = p.ratio === "30-70" ? "30%" : p.ratio === "70-30" ? "70%" : "50%";
      const rightW = p.ratio === "30-70" ? "70%" : p.ratio === "70-30" ? "30%" : "50%";
      return (
        <div style={{ padding: "6px 20px", display: "flex", gap: 12 }}>
          <div
            style={{
              width: leftW,
              padding: 12,
              background: "rgba(255,255,255,0.02)",
              borderRadius: 8,
            }}
          >
            {p.leftImage ? (
              <RemoteImage
                src={String(p.leftImage)}
                alt=""
                style={{
                  width: "100%",
                  height: "auto",
                  borderRadius: 6,
                  marginBottom: 8,
                  display: "block",
                }}
              />
            ) : isSelected ? (
              <CanvasImageUploader onUpload={(url) => onUpdate("leftImage", url)} />
            ) : null}
            <EditableText
              value={String(p.leftContent)}
              propKey="leftContent"
              style={{ color: "#E7E5E4", fontSize: 13, lineHeight: 1.5, minHeight: 40 }}
            />
          </div>
          <div
            style={{
              width: rightW,
              padding: 12,
              background: "rgba(255,255,255,0.02)",
              borderRadius: 8,
            }}
          >
            {p.rightImage ? (
              <RemoteImage
                src={String(p.rightImage)}
                alt=""
                style={{
                  width: "100%",
                  height: "auto",
                  borderRadius: 6,
                  marginBottom: 8,
                  display: "block",
                }}
              />
            ) : isSelected ? (
              <CanvasImageUploader onUpload={(url) => onUpdate("rightImage", url)} />
            ) : null}
            <EditableText
              value={String(p.rightContent)}
              propKey="rightContent"
              style={{ color: "#E7E5E4", fontSize: 13, lineHeight: 1.5, minHeight: 40 }}
            />
          </div>
        </div>
      );
    }

    case "social": {
      const links = (p.links || []) as Array<{ platform: string; url: string }>;
      return (
        <div style={{ padding: "12px 20px", textAlign: String(p.align) as CanvasTextAlign }}>
          {links.map((l, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: read-only preview render of social links which have no stable id; the list never reorders here
              key={i}
              style={{
                display: "inline-block",
                padding: "6px 12px",
                color: "#D4836A",
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              {l.platform}
            </span>
          ))}
        </div>
      );
    }

    case "html": {
      const codeStr = String(p.code);
      const isFullHtml =
        codeStr.length > 500 || codeStr.includes("<table") || codeStr.includes("<img");
      if (isFullHtml) {
        return (
          <div style={{ padding: "0" }}>
            <HtmlBlockPreview code={codeStr} />
          </div>
        );
      }
      return (
        <div style={{ padding: "0 20px" }} className="font-mono">
          <div className="bg-[#1a1816] rounded-lg p-3 text-xs text-emerald-400/60 overflow-hidden max-h-20">
            {codeStr.slice(0, 200)}
            {codeStr.length > 200 ? "..." : ""}
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}

// ─── Add Block Popover (between blocks) ──────────────────────────────

function InsertBlockButton({ onAdd }: { onAdd: (def: BlockDef) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative flex items-center justify-center py-0.5 group/insert"
      style={{ height: 20 }}
    >
      {/* Line */}
      <div
        className={`absolute left-8 right-8 h-px transition-colors ${open ? "bg-[#D4836A]/40" : "bg-transparent group-hover/insert:bg-white/[0.06]"}`}
      />
      {/* Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
          open
            ? "bg-[#D4836A] text-white scale-100"
            : "bg-[#2D2926] text-[#5C5955] border border-white/[0.06] scale-0 group-hover/insert:scale-100 hover:border-[#D4836A]/40 hover:text-[#D4836A]"
        }`}
      >
        {open ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
      </button>
      {/* Dropdown */}
      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-20 bg-transparent"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-full mt-1 z-30 bg-[#2D2926] rounded-xl border border-white/[0.08] shadow-2xl shadow-black/40 p-1.5 min-w-[180px]">
            {BLOCK_DEFS.map((def) => (
              <button
                type="button"
                key={def.type}
                onClick={(e) => {
                  e.stopPropagation();
                  onAdd(def);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm text-[#A8A29E] hover:text-white hover:bg-white/[0.05] transition-colors"
              >
                <span className="text-[#78716C]">{def.icon}</span>
                {def.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

const AI_TEMPLATE_TYPES = [
  { id: "announcement", label: "Announcement" },
  { id: "newsletter", label: "Newsletter" },
  { id: "event-invite", label: "Event Invite" },
  { id: "welcome", label: "Welcome" },
  { id: "re-engagement", label: "Re-engage" },
];

interface Props {
  initialBlocks?: EmailBlock[];
  subject?: string;
  onHtmlChange: (html: string) => void;
  onBlocksChange?: (blocks: EmailBlock[]) => void;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: top-level editor component coordinating many state hooks, handlers and two render modes; extracting pieces would split tightly-coupled state with no behavior change
export default function EmailBuilder({
  initialBlocks,
  subject,
  onHtmlChange,
  onBlocksChange,
}: Props) {
  const { communityName, siteUrl, appUrl } = useTenantConfig();
  const [blocks, setBlocks] = useState<EmailBlock[]>(
    initialBlocks || getDefaultBlocks({ communityName, siteUrl }),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [undoStack, setUndoStack] = useState<EmailBlock[][]>([]);
  const [redoStack, setRedoStack] = useState<EmailBlock[][]>([]);

  // AI generation state
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiTemplateType, setAiTemplateType] = useState("announcement");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const aiPromptId = useId();

  // Saved blocks
  const [savedBlocks, setSavedBlocks] = useState<
    Array<{ id: string; name: string; blockType: string; blockData: string }>
  >([]);
  const [showSavedBlocks, setShowSavedBlocks] = useState(false);

  const selectedBlock = blocks.find((b) => b.id === selectedId);

  // biome-ignore lint/correctness/useExhaustiveDependencies: onHtmlChange/onBlocksChange are unmemoized parent callbacks; this effect must run only when blocks change, not on every parent re-render
  useEffect(() => {
    onHtmlChange(blocksToHtml(blocks, { siteUrl }));
    onBlocksChange?.(blocks);
  }, [blocks]);

  useEffect(() => {
    fetch("/api/admin/email/templates?saved_blocks=true").catch(() => {});
    // Load saved blocks
    fetch("/api/admin/email/saved-blocks")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setSavedBlocks(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const pushUndo = useCallback(() => {
    setUndoStack((prev) => [
      ...prev.slice(-30),
      blocks.map((b) => ({ ...b, props: { ...b.props } })),
    ]);
    setRedoStack([]);
  }, [blocks]);

  const undo = () => {
    if (undoStack.length === 0) return;
    setRedoStack((prev) => [...prev, blocks]);
    setBlocks(undoStack[undoStack.length - 1]);
    setUndoStack((s) => s.slice(0, -1));
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    setUndoStack((prev) => [...prev, blocks]);
    setBlocks(redoStack[redoStack.length - 1]);
    setRedoStack((s) => s.slice(0, -1));
  };

  const addBlock = (def: BlockDef, atIndex?: number) => {
    pushUndo();
    const props = { ...def.defaultProps };
    // The Header def carries an empty `alt` at module level; stamp the tenant's
    // communityName when it's inserted from the palette (matched by reference, so
    // saved-block re-inserts keep their own persisted alt).
    if (def === BLOCK_DEFS[0]) props.alt = communityName;
    // Button + Social "Website" link default to the tenant's site URL — also
    // stamped at insert time (matched by reference so saved-block re-inserts keep
    // their own persisted urls). Clone the links array so the module default
    // isn't mutated.
    if (def === BLOCK_DEFS[3]) props.url = `${siteUrl}/community`;
    if (def === BLOCK_DEFS[7])
      props.links = (def.defaultProps.links as Array<{ platform: string; url: string }>).map((l) =>
        l.platform === "Website" ? { ...l, url: siteUrl } : l,
      );
    const newBlock: EmailBlock = { id: uid(), type: def.type, props };
    const insertIndex =
      atIndex !== undefined
        ? atIndex
        : selectedId
          ? blocks.findIndex((b) => b.id === selectedId) + 1
          : blocks.length;
    const updated = [...blocks];
    updated.splice(insertIndex, 0, newBlock);
    setBlocks(updated);
    setSelectedId(newBlock.id);
  };

  const updateBlockProps = (id: string, props: Record<string, unknown>) => {
    pushUndo();
    setBlocks(blocks.map((b) => (b.id === id ? { ...b, props } : b)));
  };

  const updateBlockProp = (id: string, key: string, value: unknown) => {
    const block = blocks.find((b) => b.id === id);
    if (!block) return;
    pushUndo();
    setBlocks(blocks.map((b) => (b.id === id ? { ...b, props: { ...b.props, [key]: value } } : b)));
  };

  const deleteBlock = (id: string) => {
    pushUndo();
    setBlocks(blocks.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const duplicateBlock = (id: string) => {
    pushUndo();
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx === -1) return;
    const clone: EmailBlock = {
      id: uid(),
      type: blocks[idx].type,
      props: { ...blocks[idx].props },
    };
    const updated = [...blocks];
    updated.splice(idx + 1, 0, clone);
    setBlocks(updated);
    setSelectedId(clone.id);
  };

  const moveBlock = (id: string, dir: -1 | 1) => {
    pushUndo();
    const idx = blocks.findIndex((b) => b.id === id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= blocks.length) return;
    const updated = [...blocks];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    setBlocks(updated);
  };

  const handleDragStart = (idx: number) => setDragIndex(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIndex(idx);
  };
  const handleDrop = (idx: number) => {
    if (dragIndex === null || dragIndex === idx) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    pushUndo();
    const updated = [...blocks];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(idx > dragIndex ? idx - 1 : idx, 0, moved);
    setBlocks(updated);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim() || aiGenerating) return;
    setAiGenerating(true);
    setAiError(null);
    try {
      const res = await fetch("/api/admin/email/generate-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: aiPrompt,
          templateType: aiTemplateType,
          subject: subject || "Community Update",
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Generation failed");
      }
      const data = await res.json();
      const newBlocks: EmailBlock[] = data.blocks.map(
        (b: { type: BlockType; props: Record<string, unknown> }) => ({
          id: uid(),
          type: b.type,
          props: b.props,
        }),
      );
      pushUndo();
      setBlocks(newBlocks);
      setSelectedId(null);
      setShowAiModal(false);
      setAiPrompt("");
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setAiGenerating(false);
    }
  };

  const getPreviewHtml = () => {
    const html = blocksToHtml(blocks, { siteUrl })
      .replace(/\{\{name\}\}/g, "Sarah")
      .replace(/\{\{email\}\}/g, "sarah@example.com")
      .replace(/\{\{subject\}\}/g, subject || "Community Update");
    return wrapEmailContent(html, { appUrl });
  };

  // Detect single HTML block = imported template → show visual HTML editor
  const isSingleHtmlBlock =
    blocks.length === 1 &&
    blocks[0].type === "html" &&
    String(blocks[0].props.code || "").length > 200;
  const [htmlEditMode, setHtmlEditMode] = useState<"visual" | "code">("visual");
  const [htmlEditDevice, setHtmlEditDevice] = useState<"desktop" | "mobile">("desktop");
  const htmlIframeRef = useRef<HTMLIFrameElement>(null);
  const [htmlSelection, setHtmlSelection] = useState<{
    type: string;
    data: Record<string, string>;
  } | null>(null);

  // Track pending HTML changes in a ref to avoid iframe reloads
  const pendingHtmlRef = useRef<string | null>(null);
  const initialHtmlRef = useRef<string>("");

  // Listen for postMessage from the editable iframe
  useEffect(() => {
    if (!isSingleHtmlBlock) return;
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "html-updated" && e.data.html) {
        // Store in ref — DON'T update blocks state (would reload iframe)
        const origCode = String(blocks[0].props.code || "");
        const headMatch = origCode.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
        const headContent = headMatch ? headMatch[1] : "";
        const bodyAttrMatch = origCode.match(/<body([^>]*)>/i);
        const bodyAttrs = bodyAttrMatch ? bodyAttrMatch[1] : "";
        pendingHtmlRef.current = `<!DOCTYPE html><html><head>${headContent}</head><body${bodyAttrs}>${e.data.html}</body></html>`;
      }
      if (e.data?.type === "element-selected") {
        setHtmlSelection({ type: e.data.elementType, data: e.data.data });
      }
      if (e.data?.type === "element-deselected") {
        // Sync pending changes to blocks state when user finishes editing
        if (pendingHtmlRef.current) {
          setBlocks([
            { ...blocks[0], props: { ...blocks[0].props, code: pendingHtmlRef.current } },
          ]);
          pendingHtmlRef.current = null;
        }
        setHtmlSelection(null);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [isSingleHtmlBlock, blocks]);

  // Send update command to iframe, then sync HTML after a delay
  const sendToIframe = useCallback((msg: Record<string, unknown>) => {
    htmlIframeRef.current?.contentWindow?.postMessage(msg, "*");
    // After style/attr update, ask iframe to send back updated HTML
    if (msg.type === "update-style" || msg.type === "update-attr") {
      setTimeout(() => {
        htmlIframeRef.current?.contentWindow?.postMessage({ type: "sync-html" }, "*");
      }, 100);
    }
  }, []);

  // Flush pending HTML to blocks state (called before save, code view switch, etc)
  const flushHtmlChanges = useCallback(() => {
    if (pendingHtmlRef.current) {
      setBlocks([{ ...blocks[0], props: { ...blocks[0].props, code: pendingHtmlRef.current } }]);
      initialHtmlRef.current = pendingHtmlRef.current;
      pendingHtmlRef.current = null;
    }
  }, [blocks]);

  if (isSingleHtmlBlock) {
    const htmlCode = String(blocks[0].props.code || "");
    // Store initial HTML so iframe srcDoc is stable (doesn't reload on every edit)
    if (!initialHtmlRef.current) initialHtmlRef.current = htmlCode;
    const stableHtmlCode = initialHtmlRef.current;

    // The editing script injected into the iframe — communicates via postMessage, no prompts
    const editingScript = `
    <script>
    (function() {
      var editableSelectors = 'td, p, h1, h2, h3, h4, span, a, div';
      var currentEl = null;
      var currentId = 0;

      function deselect() {
        if (currentEl) {
          currentEl.contentEditable = 'false';
          currentEl.style.outline = '';
          currentEl.style.outlineOffset = '';
          currentEl.removeAttribute('data-editing');
          currentEl = null;
          window.parent.postMessage({ type: 'element-deselected' }, '*');
          window.parent.postMessage({ type: 'html-updated', html: document.body.innerHTML }, '*');
        }
      }

      function selectElement(el, elType, data) {
        deselect();
        currentEl = el;
        currentId++;
        el.setAttribute('data-editing', currentId);
        el.style.outline = '2px solid #D4836A';
        el.style.outlineOffset = '2px';
        if (elType === 'text' || elType === 'link') {
          el.contentEditable = 'true';
          el.focus();
        }
        window.parent.postMessage({ type: 'element-selected', elementType: elType, data: data }, '*');
      }

      function hasBg(el) {
        if (!el || !el.style) return false;
        return el.style.background || el.style.backgroundColor || el.style.backgroundImage || el.getAttribute('bgcolor');
      }
      function getBg(el) {
        return el.style.background || el.style.backgroundColor || el.getAttribute('bgcolor') || '';
      }

      // Hover highlights
      document.addEventListener('mouseover', function(e) {
        if (currentEl) return;
        var el = e.target;
        if (el.tagName === 'IMG') { el.style.outline = '2px dashed #D4836A'; el.style.outlineOffset = '2px'; el.style.cursor = 'pointer'; }
        else {
          // Check for section with background first
          var section = el.closest ? el.closest('td[bgcolor], td[style*="background"], div[style*="background"]') : null;
          var target = el.closest ? el.closest(editableSelectors) : null;
          var best = target || section;
          if (best) {
            best.style.outline = '1px dashed rgba(212,131,106,0.4)'; best.style.outlineOffset = '2px'; best.style.cursor = 'pointer';
          }
        }
      });
      document.addEventListener('mouseout', function(e) {
        if (currentEl) return;
        var el = e.target;
        el.style.outline = ''; el.style.outlineOffset = ''; el.style.cursor = '';
        var target = el.closest ? el.closest(editableSelectors) : null;
        if (target) { target.style.outline = ''; target.style.outlineOffset = ''; target.style.cursor = ''; }
        var section = el.closest ? el.closest('td[bgcolor], td[style*="background"], div[style*="background"]') : null;
        if (section) { section.style.outline = ''; section.style.outlineOffset = ''; section.style.cursor = ''; }
      });

      // Click to select
      document.addEventListener('click', function(e) {
        var el = e.target;
        // Image
        if (el.tagName === 'IMG') {
          e.preventDefault();
          var link = el.closest('a');
          selectElement(el, 'image', { src: el.src, alt: el.alt || '', width: String(el.offsetWidth || el.width || ''), height: String(el.offsetHeight || el.height || ''), naturalWidth: String(el.naturalWidth || ''), naturalHeight: String(el.naturalHeight || ''), link: link ? link.href : '' });
          return;
        }
        // Link/button
        var link = el.closest('a');
        if (link) {
          e.preventDefault();
          var parentTd = link.closest('td');
          selectElement(link, 'link', { text: link.textContent.trim(), url: link.href, color: link.style.color || '', fontSize: link.style.fontSize || '', bg: parentTd ? getBg(parentTd) : '' });
          return;
        }
        // Text in editable element
        var target = el.closest ? el.closest(editableSelectors) : null;
        if (target && !target.querySelector('table') && target.textContent.trim().length > 0 && target.textContent.trim().length < 500) {
          e.preventDefault();
          var cs = target.style;
          var computed = window.getComputedStyle(target);
          // Find if this or a parent has a background
          var bgEl = target;
          while (bgEl && !hasBg(bgEl) && bgEl.parentElement) bgEl = bgEl.parentElement;
          var bgValue = hasBg(bgEl) ? getBg(bgEl) : '';
          selectElement(target, 'text', { text: target.textContent.trim(), color: cs.color || computed.color || '', fontSize: cs.fontSize || computed.fontSize || '', fontWeight: cs.fontWeight || computed.fontWeight || '', textAlign: cs.textAlign || computed.textAlign || '', fontFamily: cs.fontFamily || computed.fontFamily || '', bg: bgValue, hasBg: hasBg(bgEl) ? 'true' : '' });
          return;
        }
        // Section with background (clicking empty area of a colored section)
        var section = el.closest ? el.closest('td[bgcolor], td[style*="background"], div[style*="background"]') : null;
        if (section) {
          e.preventDefault();
          var padding = section.style.padding || '';
          var bgImg = section.style.backgroundImage || '';
          var bgFull = section.style.background || section.style.backgroundColor || section.getAttribute('bgcolor') || '';
          if (bgImg && bgImg !== 'none') bgFull = section.style.cssText.match(/background[^;]*/)?.[0]?.split(':').slice(1).join(':').trim() || bgFull;
          selectElement(section, 'section', { bg: bgFull, bgcolor: section.getAttribute('bgcolor') || '', padding: padding, borderRadius: section.style.borderRadius || '', backgroundImage: bgImg, width: String(section.offsetWidth), height: String(section.offsetHeight), bgSize: section.style.backgroundSize || '', bgRepeat: section.style.backgroundRepeat || '' });
          return;
        }
      }, true);

      // Escape to deselect
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') { deselect(); }
      });

      // Listen for commands from parent
      window.addEventListener('message', function(e) {
        if (!e.data) return;
        if (e.data.type === 'deselect') { deselect(); return; }
        if (!currentEl) return;
        if (e.data.type === 'update-style') {
          // Use setProperty with important to override stylesheet rules
          var cssProp = e.data.prop.replace(/([A-Z])/g, '-$1').toLowerCase();
          currentEl.style.setProperty(cssProp, e.data.value, 'important');
          window.parent.postMessage({ type: 'html-updated', html: document.body.innerHTML }, '*');
        }
        if (e.data.type === 'sync-html') {
          window.parent.postMessage({ type: 'html-updated', html: document.body.innerHTML }, '*');
          return;
        }
        if (e.data.type === 'update-attr') {
          if (e.data.attr === 'src' && currentEl.tagName === 'IMG') { currentEl.src = e.data.value; }
          if (e.data.attr === 'alt' && currentEl.tagName === 'IMG') { currentEl.alt = e.data.value; }
          if (e.data.attr === 'href') {
            var a = currentEl.tagName === 'A' ? currentEl : currentEl.closest('a');
            if (a) a.href = e.data.value;
          }
          window.parent.postMessage({ type: 'html-updated', html: document.body.innerHTML }, '*');
        }
      });
    })();
    </script>`;

    const buildIframeHtml = (code: string) => {
      let styles = "";
      const styleMatches = code.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
      if (styleMatches) styles = styleMatches.join("\n");
      let headExtra = "";
      const linkMatches = code.match(/<link[^>]*>/gi);
      if (linkMatches) headExtra = linkMatches.join("\n");
      let body = code;
      const bodyMatch = code.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      if (bodyMatch) body = bodyMatch[1];
      const bodyAttrMatch = code.match(/<body([^>]*)>/i);
      const bodyAttrs = bodyAttrMatch ? bodyAttrMatch[1] : "";
      return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">${headExtra}${styles}<style>body{margin:0;padding:0;}img{max-width:100%;height:auto;}table{border-collapse:collapse;}</style></head><body ${bodyAttrs}>${body}${editingScript}</body></html>`;
    };

    // Properties sidebar for selected element
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: cohesive switch rendering one property panel per selection type; it closes over local state/setters so extraction would thread many closures with no behavior change
    const renderSidebar = () => {
      if (!htmlSelection) {
        return (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-3">
              <MousePointerClick className="w-6 h-6 text-[#5C5955]" />
            </div>
            <p className="text-sm text-[#78716C] mb-1">Click to edit</p>
            <p className="text-xs text-[#5C5955]">
              Click any text, image, or button in the email to edit it
            </p>
          </div>
        );
      }
      const { type, data } = htmlSelection;
      if (type === "image") {
        return (
          <div className="p-3 space-y-3">
            {/* Dimensions */}
            <div className="flex gap-2">
              <div className="flex-1 p-2 rounded-lg bg-[#1C1917] border border-white/[0.06] text-center">
                <p className="text-[10px] text-[#5C5955] uppercase">Display</p>
                <p className="text-xs text-white font-medium">
                  {data.width || "—"} × {data.height || "—"}
                </p>
              </div>
              {data.naturalWidth && data.naturalWidth !== "0" && (
                <div className="flex-1 p-2 rounded-lg bg-[#1C1917] border border-white/[0.06] text-center">
                  <p className="text-[10px] text-[#5C5955] uppercase">Original</p>
                  <p className="text-xs text-white font-medium">
                    {data.naturalWidth} × {data.naturalHeight}
                  </p>
                </div>
              )}
            </div>
            {/* Current image preview */}
            {data.src && (
              <div className="rounded-lg border border-white/[0.08] overflow-hidden bg-[#1C1917]">
                <RemoteImage
                  src={data.src}
                  alt=""
                  className="w-full h-28 object-contain bg-[#2D2926]"
                />
                <p className="text-[10px] text-[#78716C] p-2 truncate" title={data.src}>
                  {data.src.split("/").pop()}
                </p>
              </div>
            )}
            {/* Replace image */}
            <ImageUploader
              currentSrc=""
              onUpload={(url) => {
                sendToIframe({ type: "update-attr", attr: "src", value: url });
                setHtmlSelection({ ...htmlSelection, data: { ...data, src: url } });
              }}
            />
            {/* Image URL input */}
            <PropInput
              label="Image URL"
              value={data.src || ""}
              onChange={(v) => {
                sendToIframe({ type: "update-attr", attr: "src", value: v });
                setHtmlSelection({ ...htmlSelection, data: { ...data, src: v } });
              }}
              placeholder="https://..."
            />
            <PropInput
              label="Alt Text"
              value={data.alt || ""}
              onChange={(v) => {
                sendToIframe({ type: "update-attr", attr: "alt", value: v });
                setHtmlSelection({ ...htmlSelection, data: { ...data, alt: v } });
              }}
              placeholder="Describe the image"
            />
            <PropInput
              label="Link URL"
              value={data.link || ""}
              onChange={(v) => {
                sendToIframe({ type: "update-attr", attr: "href", value: v });
                setHtmlSelection({ ...htmlSelection, data: { ...data, link: v } });
              }}
              placeholder="https://..."
            />
          </div>
        );
      }
      if (type === "section") {
        const bgValue = data.bg || "";
        const hasImage = bgValue.includes("url(");
        const imageUrlMatch = bgValue.match(/url\(["']?([^"')]+)["']?\)/);
        const imageUrl = imageUrlMatch ? imageUrlMatch[1] : "";
        const bgColor = bgValue.replace(/url\([^)]+\)[^,]*(,|$)/, "").trim() || data.bgcolor || "";
        const isRepeating = data.bgRepeat?.includes("repeat") || bgValue.includes("repeat");
        const bgSizeVal = data.bgSize || "";

        return (
          <div className="p-3 space-y-3">
            {/* Section dimensions */}
            <div className="flex gap-2">
              <div className="flex-1 p-2 rounded-lg bg-[#1C1917] border border-white/[0.06] text-center">
                <p className="text-[10px] text-[#5C5955] uppercase">Width</p>
                <p className="text-sm text-white font-medium">{data.width || "—"}px</p>
              </div>
              <div className="flex-1 p-2 rounded-lg bg-[#1C1917] border border-white/[0.06] text-center">
                <p className="text-[10px] text-[#5C5955] uppercase">Height</p>
                <p className="text-sm text-white font-medium">{data.height || "—"}px</p>
              </div>
            </div>

            {hasImage ? (
              <>
                <div>
                  <span className="block text-[11px] font-medium text-[#78716C] mb-1 uppercase tracking-wide">
                    Background Image
                  </span>
                  <div className="rounded-lg border border-white/[0.08] overflow-hidden bg-[#1C1917]">
                    <div
                      className="h-20 overflow-hidden"
                      style={{
                        background: `url(${imageUrl}) repeat`,
                        backgroundSize: bgSizeVal || "auto",
                      }}
                    />
                    <div className="p-2 space-y-1">
                      <p className="text-[11px] text-[#A8A29E] truncate" title={imageUrl}>
                        {imageUrl.split("/").pop()}
                      </p>
                      <div className="flex gap-2 text-[10px] text-[#5C5955]">
                        {bgSizeVal && <span>{bgSizeVal}</span>}
                        {isRepeating && (
                          <span className="px-1.5 py-0.5 rounded bg-white/[0.05]">Tiled</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <span className="block text-[11px] font-medium text-[#78716C] mb-1 uppercase tracking-wide">
                    Replace
                  </span>
                  <ImageUploader
                    currentSrc=""
                    onUpload={(url) => {
                      sendToIframe({
                        type: "update-style",
                        prop: "backgroundImage",
                        value: `url('${url}')`,
                      });
                      setHtmlSelection({
                        ...htmlSelection,
                        data: {
                          ...data,
                          bg: bgValue.replace(/url\(["']?[^"')]+["']?\)/, `url('${url}')`),
                        },
                      });
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    sendToIframe({ type: "update-style", prop: "backgroundImage", value: "none" });
                    setHtmlSelection({
                      ...htmlSelection,
                      data: { ...data, bg: bgColor || "#ffffff" },
                    });
                  }}
                  className="w-full text-xs text-red-400 hover:text-red-300 py-1.5 rounded-lg border border-red-500/20 hover:bg-red-500/10 transition-colors"
                >
                  Remove Background Image
                </button>
                <PropColor
                  label="Background Color"
                  value={bgColor || "#ffffff"}
                  onChange={(v) => {
                    sendToIframe({ type: "update-style", prop: "backgroundColor", value: v });
                    setHtmlSelection({ ...htmlSelection, data: { ...data, bgcolor: v } });
                  }}
                />
              </>
            ) : (
              <PropColor
                label="Background Color"
                value={bgColor || bgValue || "#ffffff"}
                onChange={(v) => {
                  sendToIframe({ type: "update-style", prop: "background", value: v });
                  setHtmlSelection({ ...htmlSelection, data: { ...data, bg: v } });
                }}
              />
            )}
            <PropInput
              label="Padding"
              value={data.padding || ""}
              onChange={(v) => {
                sendToIframe({ type: "update-style", prop: "padding", value: v });
                setHtmlSelection({ ...htmlSelection, data: { ...data, padding: v } });
              }}
              placeholder="32px 24px"
            />
            <PropInput
              label="Border Radius"
              value={data.borderRadius?.replace("px", "") || ""}
              onChange={(v) => {
                sendToIframe({ type: "update-style", prop: "borderRadius", value: `${v}px` });
                setHtmlSelection({ ...htmlSelection, data: { ...data, borderRadius: `${v}px` } });
              }}
              placeholder="0"
            />
          </div>
        );
      }
      if (type === "link") {
        return (
          <div className="p-3 space-y-3">
            <PropInput
              label="Link URL"
              value={data.url || ""}
              onChange={(v) => {
                sendToIframe({ type: "update-attr", attr: "href", value: v });
                setHtmlSelection({ ...htmlSelection, data: { ...data, url: v } });
              }}
              placeholder="https://..."
            />
            <PropInput
              label="Font Size"
              value={data.fontSize?.replace("px", "") || ""}
              onChange={(v) => {
                sendToIframe({ type: "update-style", prop: "fontSize", value: `${v}px` });
                setHtmlSelection({ ...htmlSelection, data: { ...data, fontSize: `${v}px` } });
              }}
              type="number"
              placeholder="16"
            />
            <PropColor
              label="Text Color"
              value={data.color || "#ffffff"}
              onChange={(v) => {
                sendToIframe({ type: "update-style", prop: "color", value: v });
                setHtmlSelection({ ...htmlSelection, data: { ...data, color: v } });
              }}
            />
            {data.bg && (
              <PropColor
                label="Background"
                value={data.bg}
                onChange={(v) => {
                  sendToIframe({ type: "update-style", prop: "backgroundColor", value: v });
                  setHtmlSelection({ ...htmlSelection, data: { ...data, bg: v } });
                }}
              />
            )}
            <p className="text-[10px] text-[#5C5955]">Edit the button text directly in the email</p>
          </div>
        );
      }
      // text
      const emailFonts = [
        { value: "'Lato', Arial, Helvetica, sans-serif", label: "Lato" },
        { value: "Arial, Helvetica, sans-serif", label: "Arial" },
        { value: "Helvetica, Arial, sans-serif", label: "Helvetica" },
        { value: "Georgia, serif", label: "Georgia" },
        { value: "'Times New Roman', Times, serif", label: "Times New Roman" },
        { value: "Verdana, Geneva, sans-serif", label: "Verdana" },
        { value: "'Trebuchet MS', sans-serif", label: "Trebuchet" },
        { value: "'Courier New', monospace", label: "Courier New" },
        {
          value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          label: "System",
        },
      ];
      return (
        <div className="p-3 space-y-3">
          <PropSelect
            label="Font"
            value={data.fontFamily || ""}
            options={emailFonts}
            onChange={(v) => {
              sendToIframe({ type: "update-style", prop: "fontFamily", value: v });
              setHtmlSelection({ ...htmlSelection, data: { ...data, fontFamily: v } });
            }}
          />
          <PropInput
            label="Font Size"
            value={data.fontSize?.replace("px", "") || ""}
            onChange={(v) => {
              sendToIframe({ type: "update-style", prop: "fontSize", value: `${v}px` });
              setHtmlSelection({ ...htmlSelection, data: { ...data, fontSize: `${v}px` } });
            }}
            type="number"
            placeholder="16"
          />
          <PropColor
            label="Text Color"
            value={data.color || "#333333"}
            onChange={(v) => {
              sendToIframe({ type: "update-style", prop: "color", value: v });
              setHtmlSelection({ ...htmlSelection, data: { ...data, color: v } });
            }}
          />
          <div>
            <span className="block text-[11px] font-medium text-[#78716C] mb-1 uppercase tracking-wide">
              Font Weight
            </span>
            <div className="flex rounded-lg overflow-hidden border border-white/[0.08]">
              {[
                { v: "normal", l: "Normal" },
                { v: "bold", l: "Bold" },
              ].map((fw) => (
                <button
                  type="button"
                  key={fw.v}
                  onClick={() => {
                    sendToIframe({ type: "update-style", prop: "fontWeight", value: fw.v });
                    setHtmlSelection({ ...htmlSelection, data: { ...data, fontWeight: fw.v } });
                  }}
                  className={`flex-1 p-2 text-center text-xs transition-colors ${data.fontWeight === fw.v || (fw.v === "bold" && data.fontWeight === "700") ? "bg-[#D4836A]/20 text-[#D4836A]" : "text-[#78716C] hover:text-white"}`}
                >
                  {fw.l}
                </button>
              ))}
            </div>
          </div>
          <AlignButtons
            value={data.textAlign || "left"}
            onChange={(v) => {
              sendToIframe({ type: "update-style", prop: "textAlign", value: v });
              setHtmlSelection({ ...htmlSelection, data: { ...data, textAlign: v } });
            }}
          />
          {data.hasBg && (
            <PropColor
              label="Section Background"
              value={data.bg || "#ffffff"}
              onChange={(v) => {
                sendToIframe({ type: "update-style", prop: "background", value: v });
                setHtmlSelection({ ...htmlSelection, data: { ...data, bg: v } });
              }}
            />
          )}
          <p className="text-[10px] text-[#5C5955]">
            Edit text directly in the email. Press Escape when done.
          </p>
        </div>
      );
    };

    return (
      <div className="flex h-[calc(100vh-220px)] min-h-[500px] rounded-2xl border border-white/[0.06] overflow-hidden bg-[#1C1917]">
        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#222020] border-b border-white/[0.06] shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex rounded-lg overflow-hidden border border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => {
                    setHtmlEditMode("visual");
                    sendToIframe({ type: "deselect" });
                    setHtmlSelection(null);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${htmlEditMode === "visual" ? "bg-[#D4836A]/20 text-[#D4836A]" : "text-[#78716C] hover:text-white"}`}
                >
                  <MousePointerClick className="w-3.5 h-3.5" /> Visual
                </button>
                <button
                  type="button"
                  onClick={() => {
                    flushHtmlChanges();
                    setHtmlEditMode("code");
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${htmlEditMode === "code" ? "bg-[#D4836A]/20 text-[#D4836A]" : "text-[#78716C] hover:text-white"}`}
                >
                  <Code className="w-3.5 h-3.5" /> Code
                </button>
              </div>
              {htmlEditMode === "visual" && (
                <div className="flex rounded-lg overflow-hidden border border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setHtmlEditDevice("desktop")}
                    className={`p-1.5 transition-colors ${htmlEditDevice === "desktop" ? "bg-[#D4836A]/20 text-[#D4836A]" : "text-[#78716C] hover:text-white"}`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setHtmlEditDevice("mobile")}
                    className={`p-1.5 transition-colors ${htmlEditDevice === "mobile" ? "bg-[#D4836A]/20 text-[#D4836A]" : "text-[#78716C] hover:text-white"}`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Preview in new window */}
              <button
                type="button"
                onClick={() => {
                  flushHtmlChanges();
                  const code = pendingHtmlRef.current || htmlCode;
                  const w = window.open("", "_blank", "width=700,height=800");
                  if (w) {
                    let styles = "";
                    const sm = code.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
                    if (sm) styles = sm.join("\n");
                    let headExtra = "";
                    const lm = code.match(/<link[^>]*>/gi);
                    if (lm) headExtra = lm.join("\n");
                    let body = code;
                    const bm = code.match(/<body[^>]*>([\s\S]*)<\/body>/i);
                    if (bm) body = bm[1];
                    const ba = code.match(/<body([^>]*)>/i);
                    w.document.write(
                      `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">${headExtra}${styles}</head><body ${ba ? ba[1] : ""}>${body}</body></html>`,
                    );
                    w.document.close();
                  }
                }}
                className="flex items-center gap-1.5 text-xs text-[#78716C] hover:text-[#D4836A] transition-colors px-2 py-1 rounded hover:bg-white/[0.05]"
                title="Preview in new window"
              >
                <Eye className="w-3.5 h-3.5" /> Preview
              </button>
              <button
                type="button"
                onClick={() => {
                  if (
                    !confirm(
                      "Switch to block builder? Your HTML layout will be replaced with default blocks. The current HTML will be saved and can be undone.",
                    )
                  )
                    return;
                  flushHtmlChanges();
                  pushUndo();
                  initialHtmlRef.current = "";
                  setBlocks(getDefaultBlocks({ communityName, siteUrl }));
                }}
                className="text-xs text-[#78716C] hover:text-[#D4836A] transition-colors px-2 py-1 rounded hover:bg-white/[0.05]"
              >
                Switch to Blocks
              </button>
            </div>
          </div>

          {/* Editor area */}
          {htmlEditMode === "visual" ? (
            // biome-ignore lint/a11y/noStaticElementInteractions: click-to-deselect overlay wrapping the editor iframe; keyboard users deselect via Escape inside the iframe or the X button
            // biome-ignore lint/a11y/useKeyWithClickEvents: click-to-deselect overlay; keyboard deselect is handled inside the iframe (Escape) and the sidebar X button
            <div
              className="flex-1 overflow-auto bg-[#e8e5e1]"
              onClick={() => {
                sendToIframe({ type: "deselect" });
                setHtmlSelection(null);
              }}
            >
              <div
                className={`mx-auto transition-all duration-300 ${htmlEditDevice === "mobile" ? "max-w-[375px] py-4" : "max-w-[600px] py-4"}`}
              >
                {/* biome-ignore lint/a11y/noStaticElementInteractions: wrapper only stops click propagation so clicks on the email card don't deselect; not an interactive control */}
                {/* biome-ignore lint/a11y/useKeyWithClickEvents: onClick only calls stopPropagation; there is no keyboard-actionable behavior to mirror */}
                <div
                  className={`bg-white shadow-xl overflow-hidden ${htmlEditDevice === "mobile" ? "rounded-[20px] border-[3px] border-[#ccc]" : "rounded-lg"}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {htmlEditDevice === "mobile" && (
                    <div className="bg-[#ccc] py-1 flex justify-center rounded-t-[18px]">
                      <div className="w-16 h-1 rounded-full bg-[#aaa]" />
                    </div>
                  )}
                  <iframe
                    ref={htmlIframeRef}
                    srcDoc={buildIframeHtml(stableHtmlCode)}
                    className="w-full border-0"
                    style={{ minHeight: htmlEditDevice === "mobile" ? 600 : 900 }}
                    title="Email Editor"
                  />
                  {htmlEditDevice === "mobile" && (
                    <div className="bg-[#ccc] py-2 flex justify-center rounded-b-[18px]">
                      <div className="w-10 h-1 rounded-full bg-[#aaa]" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex overflow-hidden">
              <textarea
                value={htmlCode}
                onChange={(e) =>
                  setBlocks([{ ...blocks[0], props: { ...blocks[0].props, code: e.target.value } }])
                }
                className="flex-1 bg-[#131110] text-emerald-300/80 text-xs font-mono p-4 focus:outline-none resize-none leading-relaxed"
                spellCheck={false}
              />
              <div className="w-[45%] border-l border-white/[0.06] overflow-auto bg-white">
                <iframe
                  srcDoc={buildIframeHtml(htmlCode).replace(editingScript, "")}
                  className="w-full border-0"
                  style={{ minHeight: 1500 }}
                  title="Preview"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>
          )}
        </div>

        {/* Right: Properties Sidebar */}
        <div className="w-72 shrink-0 border-l border-white/[0.06] bg-[#222020] flex flex-col">
          <div className="p-3 border-b border-white/[0.06] flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#D4836A]/15 flex items-center justify-center text-[#D4836A]">
              {htmlSelection?.type === "image" ? (
                <ImageIcon className="w-3.5 h-3.5" />
              ) : htmlSelection?.type === "link" ? (
                <MousePointerClick className="w-3.5 h-3.5" />
              ) : htmlSelection?.type === "text" ? (
                <Type className="w-3.5 h-3.5" />
              ) : htmlSelection?.type === "section" ? (
                <Palette className="w-3.5 h-3.5" />
              ) : (
                <Palette className="w-3.5 h-3.5" />
              )}
            </div>
            <p className="text-xs font-semibold text-white uppercase tracking-wider">
              {htmlSelection ? htmlSelection.type : "Properties"}
            </p>
            {htmlSelection && (
              <button
                type="button"
                onClick={() => {
                  sendToIframe({ type: "deselect" });
                  setHtmlSelection(null);
                }}
                className="ml-auto p-1 text-[#78716C] hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-auto">{renderSidebar()}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[500px] rounded-2xl border border-white/[0.06] overflow-hidden bg-[#1C1917]">
      {/* ─── Left: Block Palette ─── */}
      <div className="w-56 shrink-0 border-r border-white/[0.06] bg-[#222020] flex flex-col">
        <div className="p-3 border-b border-white/[0.06]">
          <p className="text-xs font-semibold text-white uppercase tracking-wider">Blocks</p>
          <p className="text-[10px] text-[#5C5955] mt-0.5">Click to add, drag to reorder</p>
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-1">
          {BLOCK_DEFS.map((def) => (
            <button
              type="button"
              key={def.type}
              onClick={() => addBlock(def)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left text-sm text-[#A8A29E] hover:text-white hover:bg-white/[0.05] transition-colors group"
            >
              <div className="w-7 h-7 rounded-md bg-white/[0.04] group-hover:bg-[#D4836A]/15 flex items-center justify-center text-[#78716C] group-hover:text-[#D4836A] transition-colors">
                {def.icon}
              </div>
              {def.label}
              <Plus className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-50 transition-opacity" />
            </button>
          ))}
        </div>
        {/* Saved Blocks */}
        {savedBlocks.length > 0 && (
          <div className="border-t border-white/[0.06]">
            <button
              type="button"
              onClick={() => setShowSavedBlocks(!showSavedBlocks)}
              className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-semibold text-[#5C5955] uppercase tracking-wider hover:text-[#A8A29E] transition-colors"
            >
              <span>Saved Blocks ({savedBlocks.length})</span>
              <span className="text-[#5C5955]">{showSavedBlocks ? "−" : "+"}</span>
            </button>
            {showSavedBlocks && (
              <div className="px-2 pb-2 space-y-1">
                {savedBlocks.map((sb) => (
                  <button
                    type="button"
                    key={sb.id}
                    onClick={() => {
                      try {
                        const props = JSON.parse(sb.blockData);
                        const def = BLOCK_DEFS.find((d) => d.type === sb.blockType);
                        if (def) {
                          addBlock({ ...def, defaultProps: props });
                        }
                      } catch {
                        /* ignore */
                      }
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs text-[#A8A29E] hover:text-white hover:bg-white/[0.05] transition-colors"
                  >
                    <span className="text-[#5C5955]">
                      {BLOCK_DEFS.find((d) => d.type === sb.blockType)?.icon || "•"}
                    </span>
                    <span className="truncate">{sb.name}</span>
                    <Plus className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-50" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="p-2 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={() => setShowAiModal(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-violet-600/20 to-fuchsia-600/20 text-violet-300 border border-violet-500/20 hover:from-violet-600/30 hover:to-fuchsia-600/30 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            Generate with AI
          </button>
        </div>
        <div className="p-2 border-t border-white/[0.06] flex items-center gap-1">
          <button
            type="button"
            onClick={undo}
            disabled={undoStack.length === 0}
            className="p-2 rounded-lg text-[#78716C] hover:text-white hover:bg-white/[0.05] disabled:opacity-25 transition-colors"
            title="Undo"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={redoStack.length === 0}
            className="p-2 rounded-lg text-[#78716C] hover:text-white hover:bg-white/[0.05] disabled:opacity-25 transition-colors"
            title="Redo"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="p-2 rounded-lg text-[#78716C] hover:text-white hover:bg-white/[0.05] transition-colors"
            title="Preview"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ─── Center: Canvas ─── */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: click-empty-canvas to deselect; the canvas wraps interactive block controls so it cannot itself be a button */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: deselect is also reachable via each block's X button; the canvas only clears selection on background click */}
      <div className="flex-1 overflow-auto bg-[#131110] p-6" onClick={() => setSelectedId(null)}>
        <div className="max-w-[600px] mx-auto">
          {blocks.length === 0 ? (
            <div className="border-2 border-dashed border-white/[0.08] rounded-2xl p-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.03] flex items-center justify-center mx-auto mb-4">
                <Plus className="w-7 h-7 text-[#5C5955]" />
              </div>
              <p className="text-[#78716C] text-sm mb-1">Start building your email</p>
              <p className="text-[#5C5955] text-xs">
                Click a block from the left or use the + button below
              </p>
              <div className="mt-6">
                <InsertBlockButton onAdd={(def) => addBlock(def, 0)} />
              </div>
            </div>
          ) : (
            <div>
              {/* Top insert button */}
              <InsertBlockButton onAdd={(def) => addBlock(def, 0)} />

              {blocks.map((block, idx) => (
                <div key={block.id}>
                  {/* biome-ignore lint/a11y/noStaticElementInteractions: draggable block row wraps the block's own action buttons and inline-editable content; it cannot itself be a button */}
                  {/* biome-ignore lint/a11y/useKeyWithClickEvents: selecting/reordering is also available via the per-block toolbar (up/down/select) buttons */}
                  <div
                    draggable
                    onDragStart={(e) => {
                      // Don't start drag if editing text
                      const target = e.target as HTMLElement;
                      if (target.isContentEditable) {
                        e.preventDefault();
                        return;
                      }
                      handleDragStart(idx);
                    }}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragEnd={() => {
                      setDragIndex(null);
                      setDragOverIndex(null);
                    }}
                    onDrop={() => handleDrop(idx)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId(block.id);
                    }}
                    className={`relative group/block transition-all cursor-pointer ${
                      dragOverIndex === idx && dragIndex !== idx ? "pt-1" : ""
                    } ${dragIndex === idx ? "opacity-30 scale-[0.98]" : ""}`}
                  >
                    {/* Drag-over indicator */}
                    {dragOverIndex === idx && dragIndex !== idx && (
                      <div className="absolute top-0 left-4 right-4 h-0.5 bg-[#D4836A] rounded-full z-20" />
                    )}

                    {/* Selection wrapper */}
                    <div
                      className={`relative rounded-lg transition-all ${
                        selectedId === block.id
                          ? "ring-2 ring-[#D4836A] ring-offset-2 ring-offset-[#131110]"
                          : "ring-0 hover:ring-1 hover:ring-white/[0.1] hover:ring-offset-1 hover:ring-offset-[#131110]"
                      }`}
                    >
                      {/* Floating toolbar (left grip) */}
                      <div
                        className={`absolute -left-11 top-1/2 -translate-y-1/2 transition-opacity z-10 ${
                          selectedId === block.id
                            ? "opacity-100"
                            : "opacity-0 group-hover/block:opacity-60"
                        }`}
                      >
                        <div className="p-1 text-[#78716C] hover:text-white cursor-grab active:cursor-grabbing">
                          <GripVertical className="w-4 h-4" />
                        </div>
                      </div>

                      {/* Block type badge */}
                      <div
                        className={`absolute -top-2.5 left-3 px-2 py-0 text-[10px] font-semibold uppercase tracking-wider bg-[#131110] z-10 transition-all rounded ${
                          selectedId === block.id
                            ? "text-[#D4836A] opacity-100"
                            : "text-[#5C5955] opacity-0 group-hover/block:opacity-100"
                        }`}
                      >
                        {block.type}
                      </div>

                      {/* Block actions toolbar */}
                      {selectedId === block.id && (
                        <div className="absolute -top-3.5 right-2 flex items-center gap-0.5 bg-[#2D2926] rounded-lg border border-white/[0.1] px-1.5 py-1 z-10 shadow-lg shadow-black/30">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              moveBlock(block.id, -1);
                            }}
                            disabled={idx === 0}
                            className="p-1 text-[#78716C] hover:text-white disabled:opacity-25 transition-colors"
                            title="Move up"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              moveBlock(block.id, 1);
                            }}
                            disabled={idx === blocks.length - 1}
                            className="p-1 text-[#78716C] hover:text-white disabled:opacity-25 transition-colors"
                            title="Move down"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          <div className="w-px h-4 bg-white/[0.08] mx-0.5" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              duplicateBlock(block.id);
                            }}
                            className="p-1 text-[#78716C] hover:text-white transition-colors"
                            title="Duplicate"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteBlock(block.id);
                            }}
                            className="p-1 text-red-400/70 hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* ★ Inline-editable block content ★ */}
                      <div className="overflow-hidden">
                        <BlockPreview
                          block={block}
                          isSelected={selectedId === block.id}
                          onUpdate={(key, value) => updateBlockProp(block.id, key, value)}
                        />
                      </div>

                      {/* Click hint for unselected blocks */}
                      {selectedId !== block.id && (
                        <div className="absolute inset-0 rounded-lg opacity-0 group-hover/block:opacity-100 transition-opacity pointer-events-none">
                          <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 rounded text-[10px] text-white/60">
                            Click to edit
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Insert button between blocks */}
                  <InsertBlockButton onAdd={(def) => addBlock(def, idx + 1)} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Right: Properties Panel ─── */}
      <div className="w-72 shrink-0 border-l border-white/[0.06] bg-[#222020] flex flex-col">
        {selectedBlock ? (
          <>
            <div className="p-3 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-[#D4836A]/15 flex items-center justify-center text-[#D4836A]">
                  {BLOCK_DEFS.find((d) => d.type === selectedBlock.type)?.icon}
                </div>
                <p className="text-xs font-semibold text-white uppercase tracking-wider">
                  {selectedBlock.type}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="p-1 text-[#78716C] hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-3">
              <PropertiesPanel
                block={selectedBlock}
                onChange={(props) => updateBlockProps(selectedBlock.id, props)}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-3">
              <MousePointerClick className="w-6 h-6 text-[#5C5955]" />
            </div>
            <p className="text-sm text-[#78716C] mb-1">Select a block to edit</p>
            <p className="text-xs text-[#5C5955]">
              Click any block on the canvas, or add one from the left panel
            </p>
            <div className="mt-6 w-full space-y-2">
              <p className="text-[10px] font-semibold text-[#5C5955] uppercase tracking-wider">
                Quick tips
              </p>
              <div className="text-[11px] text-[#5C5955] space-y-1.5 text-left">
                <p>• Click text on canvas to edit inline</p>
                <p>• Drag blocks to reorder</p>
                <p>• Use + buttons to insert blocks</p>
                <p>• Drop images directly on canvas</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Preview Modal ─── */}
      {previewOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
          <div className="bg-[#2D2926] rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
              <p className="text-sm font-semibold text-white">Email Preview</p>
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg overflow-hidden border border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("desktop")}
                    className={`p-1.5 transition-colors ${previewDevice === "desktop" ? "bg-[#D4836A]/20 text-[#D4836A]" : "text-[#78716C] hover:text-white"}`}
                  >
                    <Monitor className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("mobile")}
                    className={`p-1.5 transition-colors ${previewDevice === "mobile" ? "bg-[#D4836A]/20 text-[#D4836A]" : "text-[#78716C] hover:text-white"}`}
                  >
                    <Smartphone className="w-4 h-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  className="p-2 text-[#78716C] hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6 bg-[#131110]">
              <div
                className={`mx-auto transition-all ${previewDevice === "mobile" ? "max-w-[375px]" : "max-w-[600px]"}`}
              >
                <div
                  className={`overflow-hidden shadow-2xl ${previewDevice === "mobile" ? "border-[3px] border-[#3a3735] rounded-[24px]" : "border border-white/[0.08] rounded-xl"}`}
                >
                  {previewDevice === "mobile" && (
                    <div className="bg-[#3a3735] py-1 flex justify-center">
                      <div className="w-16 h-1 rounded-full bg-[#555]" />
                    </div>
                  )}
                  <iframe
                    srcDoc={getPreviewHtml()}
                    className="w-full border-0 bg-[#1C1917]"
                    style={{ height: previewDevice === "mobile" ? "600px" : "500px" }}
                    title="Email Preview"
                  />
                  {previewDevice === "mobile" && (
                    <div className="bg-[#3a3735] py-2 flex justify-center">
                      <div className="w-10 h-1 rounded-full bg-[#555]" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── AI Generate Modal ─── */}
      {showAiModal && (
        // biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop; click-outside-to-close wraps the dialog, and the dialog has its own X button for keyboard users
        // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click-to-close is mirrored by the dialog's X button (keyboard-reachable)
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6"
          onClick={() => !aiGenerating && setShowAiModal(false)}
        >
          {/* biome-ignore lint/a11y/noStaticElementInteractions: dialog wrapper only stops backdrop click propagation; not an interactive control */}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: onClick only calls stopPropagation; no keyboard-actionable behavior to mirror */}
          <div
            className="bg-[#2D2926] rounded-2xl max-w-lg w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">AI Email Generator</p>
                  <p className="text-[10px] text-[#78716C]">
                    Generates editable blocks directly in the builder
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !aiGenerating && setShowAiModal(false)}
                className="p-1.5 text-[#78716C] hover:text-white transition-colors rounded-lg hover:bg-white/[0.05]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <span className="block text-xs font-medium text-[#A8A29E] mb-2">Template Type</span>
                <div className="flex flex-wrap gap-1.5">
                  {AI_TEMPLATE_TYPES.map((t) => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => setAiTemplateType(t.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        aiTemplateType === t.id
                          ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                          : "bg-white/[0.03] text-[#A8A29E] border border-white/[0.06] hover:bg-white/[0.06] hover:text-white"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label
                  htmlFor={aiPromptId}
                  className="block text-xs font-medium text-[#A8A29E] mb-2"
                >
                  Describe Your Email
                </label>
                <textarea
                  id={aiPromptId}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g., A newsletter about our upcoming AI workshop in Sydney, with speaker highlights and early-bird pricing..."
                  rows={3}
                  className="w-full bg-[#1C1917] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-[#5C5955] focus:outline-none focus:border-violet-500/40 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAiGenerate();
                  }}
                  // biome-ignore lint/a11y/noAutofocus: focus the prompt input when the AI modal opens
                  autoFocus
                />
              </div>
              {aiError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-300">
                  {aiError}
                </div>
              )}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleAiGenerate}
                  disabled={aiGenerating || !aiPrompt.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-lg shadow-violet-500/20"
                >
                  {aiGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Generating blocks...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" /> Generate Email{" "}
                      <span className="text-xs opacity-60 ml-1">Ctrl+Enter</span>
                    </>
                  )}
                </button>
              </div>
              {blocks.length > 0 && !aiGenerating && (
                <p className="text-[11px] text-[#5C5955] text-center">
                  This will replace your current blocks. Use undo to restore.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
