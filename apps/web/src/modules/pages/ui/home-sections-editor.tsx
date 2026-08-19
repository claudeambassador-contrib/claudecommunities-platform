import type { ReactElement } from "react";
import { type ChangeEvent, useCallback, useState } from "react";
import type {
  AudienceSplitBlock,
  BenefitsBlock,
  Block,
  BlockType,
  CtaBlock,
  GalleryBlock,
  HeroBlock,
  RichTextBlock,
  WebinarBlock,
} from "@/modules/pages/types";
import { newId } from "@/shared/ids";
import { Can, useCan } from "@/shared/ui/can";

const TYPE_LABELS: Record<BlockType, string> = {
  audienceSplit: "Audience split",
  benefits: "Benefits",
  cta: "CTA",
  discord: "Discord",
  events: "Events",
  gallery: "Gallery",
  hero: "Hero",
  richText: "Rich text",
  webinar: "Webinar",
};

export type SaveHomeResult = { error: string; ok: false } | { ok: true };

export function HomeSectionsEditor({
  initialBlocks,
  onSave,
}: {
  initialBlocks: Block[];
  onSave: (blocks: Block[]) => Promise<SaveHomeResult>;
}): ReactElement {
  const can = useCan();
  const canEdit = can("pages.edit");
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const replaceBlock = useCallback((next: Block) => {
    setBlocks((current) => current.map((block) => (block.id === next.id ? next : block)));
    setNote(null);
  }, []);

  const moveBlock = useCallback((id: string, direction: -1 | 1) => {
    setBlocks((current) => {
      const index = current.findIndex((block) => block.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) {
        return current;
      }
      const copy = current.slice();
      const [item] = copy.splice(index, 1);
      if (!item) {
        return current;
      }
      copy.splice(target, 0, item);
      return copy;
    });
    setNote(null);
  }, []);

  const addHero = useCallback(() => {
    setBlocks((current) => [
      ...current,
      { body: "", enabled: true, heading: "", id: newId("blk"), type: "hero" },
    ]);
    setNote(null);
  }, []);

  const addRichText = useCallback(() => {
    setBlocks((current) => [
      ...current,
      { body: "", enabled: true, heading: "", id: newId("blk"), type: "richText" },
    ]);
    setNote(null);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setNote(null);
    const result = await onSave(blocks);
    setNote(result.ok ? "Saved" : result.error);
    setSaving(false);
  }, [blocks, onSave]);

  return (
    <div className="stack">
      {blocks.map((block, index) => (
        <SectionCard
          block={block}
          canEdit={canEdit}
          isFirst={index === 0}
          isLast={index === blocks.length - 1}
          key={block.id}
          onMove={moveBlock}
          onReplace={replaceBlock}
        />
      ))}
      <Can
        fallback={<p className="muted">You can view this page but not save changes.</p>}
        permission="pages.edit"
      >
        <div className="row">
          <button className="btn" onClick={addHero} type="button">
            Add hero
          </button>
          <button className="btn" onClick={addRichText} type="button">
            Add richText
          </button>
          <button className="btn btn-primary" disabled={saving} onClick={handleSave} type="button">
            Save
          </button>
        </div>
      </Can>
      {note ? <p className="muted">{note}</p> : null}
    </div>
  );
}

function SectionCard({
  block,
  canEdit,
  isFirst,
  isLast,
  onMove,
  onReplace,
}: {
  block: Block;
  canEdit: boolean;
  isFirst: boolean;
  isLast: boolean;
  onMove: (id: string, direction: -1 | 1) => void;
  onReplace: (next: Block) => void;
}): ReactElement {
  const handleEnabled = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onReplace({ ...block, enabled: event.target.checked });
    },
    [block, onReplace],
  );
  const handleMoveUp = useCallback(() => {
    onMove(block.id, -1);
  }, [block.id, onMove]);
  const handleMoveDown = useCallback(() => {
    onMove(block.id, 1);
  }, [block.id, onMove]);

  return (
    <article className="card stack">
      <div className="row justify-between">
        <strong>{TYPE_LABELS[block.type]}</strong>
        <label className="row" htmlFor={`${block.id}-enabled`}>
          <input
            checked={block.enabled}
            disabled={!canEdit}
            id={`${block.id}-enabled`}
            onChange={handleEnabled}
            type="checkbox"
          />
          Enabled
        </label>
      </div>
      <BlockFields block={block} disabled={!canEdit} onChange={onReplace} />
      <Can permission="pages.edit">
        <div className="row">
          <button className="btn" disabled={isFirst} onClick={handleMoveUp} type="button">
            Move up
          </button>
          <button className="btn" disabled={isLast} onClick={handleMoveDown} type="button">
            Move down
          </button>
        </div>
      </Can>
    </article>
  );
}

function BlockFields({
  block,
  disabled,
  onChange,
}: {
  block: Block;
  disabled: boolean;
  onChange: (next: Block) => void;
}): ReactElement | null {
  switch (block.type) {
    case "hero":
      return <HeroFields block={block} disabled={disabled} onChange={onChange} />;
    case "richText":
      return <RichTextFields block={block} disabled={disabled} onChange={onChange} />;
    case "webinar":
      return <WebinarFields block={block} disabled={disabled} onChange={onChange} />;
    case "benefits":
    case "audienceSplit":
      return <HeadingOnlyFields block={block} disabled={disabled} onChange={onChange} />;
    case "cta":
      return <CtaFields block={block} disabled={disabled} onChange={onChange} />;
    case "gallery":
      return <GalleryFields block={block} disabled={disabled} onChange={onChange} />;
    case "events":
    case "discord":
      return null;
    default:
      return null;
  }
}

function HeroFields({
  block,
  disabled,
  onChange,
}: {
  block: HeroBlock;
  disabled: boolean;
  onChange: (next: Block) => void;
}): ReactElement {
  const setHeading = useCallback(
    (heading: string) => onChange({ ...block, heading }),
    [block, onChange],
  );
  const setBody = useCallback((body: string) => onChange({ ...block, body }), [block, onChange]);
  const setBadge = useCallback((badge: string) => onChange({ ...block, badge }), [block, onChange]);
  const setPrimaryCtaLabel = useCallback(
    (primaryCtaLabel: string) => onChange({ ...block, primaryCtaLabel }),
    [block, onChange],
  );
  return (
    <>
      <TextField
        disabled={disabled}
        id={`${block.id}-heading`}
        label="Heading"
        onChange={setHeading}
        value={block.heading ?? ""}
      />
      <TextField
        disabled={disabled}
        id={`${block.id}-body`}
        label="Body"
        multiline
        onChange={setBody}
        value={block.body ?? ""}
      />
      <TextField
        disabled={disabled}
        id={`${block.id}-badge`}
        label="Badge"
        onChange={setBadge}
        value={block.badge ?? ""}
      />
      <TextField
        disabled={disabled}
        id={`${block.id}-primaryCtaLabel`}
        label="Primary CTA label"
        onChange={setPrimaryCtaLabel}
        value={block.primaryCtaLabel ?? ""}
      />
    </>
  );
}

function RichTextFields({
  block,
  disabled,
  onChange,
}: {
  block: RichTextBlock;
  disabled: boolean;
  onChange: (next: Block) => void;
}): ReactElement {
  const setHeading = useCallback(
    (heading: string) => onChange({ ...block, heading }),
    [block, onChange],
  );
  const setBody = useCallback((body: string) => onChange({ ...block, body }), [block, onChange]);
  return (
    <>
      <TextField
        disabled={disabled}
        id={`${block.id}-heading`}
        label="Heading"
        onChange={setHeading}
        value={block.heading ?? ""}
      />
      <TextField
        disabled={disabled}
        id={`${block.id}-body`}
        label="Body"
        multiline
        onChange={setBody}
        value={block.body}
      />
    </>
  );
}

function WebinarFields({
  block,
  disabled,
  onChange,
}: {
  block: WebinarBlock;
  disabled: boolean;
  onChange: (next: Block) => void;
}): ReactElement {
  const setTitle = useCallback((title: string) => onChange({ ...block, title }), [block, onChange]);
  const setDescription = useCallback(
    (description: string) => onChange({ ...block, description }),
    [block, onChange],
  );
  const setHref = useCallback((href: string) => onChange({ ...block, href }), [block, onChange]);
  const setThumbnailUrl = useCallback(
    (thumbnailUrl: string) => onChange({ ...block, thumbnailUrl }),
    [block, onChange],
  );
  return (
    <>
      <TextField
        disabled={disabled}
        id={`${block.id}-title`}
        label="Title"
        onChange={setTitle}
        value={block.title}
      />
      <TextField
        disabled={disabled}
        id={`${block.id}-description`}
        label="Description"
        multiline
        onChange={setDescription}
        value={block.description}
      />
      <TextField
        disabled={disabled}
        id={`${block.id}-href`}
        label="Href"
        onChange={setHref}
        value={block.href}
      />
      <TextField
        disabled={disabled}
        id={`${block.id}-thumbnailUrl`}
        label="Thumbnail URL"
        onChange={setThumbnailUrl}
        value={block.thumbnailUrl}
      />
    </>
  );
}

function HeadingOnlyFields({
  block,
  disabled,
  onChange,
}: {
  block: AudienceSplitBlock | BenefitsBlock;
  disabled: boolean;
  onChange: (next: Block) => void;
}): ReactElement {
  const setHeading = useCallback(
    (heading: string) => onChange({ ...block, heading }),
    [block, onChange],
  );
  return (
    <TextField
      disabled={disabled}
      id={`${block.id}-heading`}
      label="Heading"
      onChange={setHeading}
      value={block.heading ?? ""}
    />
  );
}

function CtaFields({
  block,
  disabled,
  onChange,
}: {
  block: CtaBlock;
  disabled: boolean;
  onChange: (next: Block) => void;
}): ReactElement {
  const setHeading = useCallback(
    (headingSignedOut: string) => onChange({ ...block, headingSignedOut }),
    [block, onChange],
  );
  const setBody = useCallback(
    (bodySignedOut: string) => onChange({ ...block, bodySignedOut }),
    [block, onChange],
  );
  const setCtaLabel = useCallback(
    (ctaLabelSignedOut: string) => onChange({ ...block, ctaLabelSignedOut }),
    [block, onChange],
  );
  return (
    <>
      <TextField
        disabled={disabled}
        id={`${block.id}-headingSignedOut`}
        label="Heading (signed out)"
        onChange={setHeading}
        value={block.headingSignedOut ?? ""}
      />
      <TextField
        disabled={disabled}
        id={`${block.id}-bodySignedOut`}
        label="Body (signed out)"
        multiline
        onChange={setBody}
        value={block.bodySignedOut ?? ""}
      />
      <TextField
        disabled={disabled}
        id={`${block.id}-ctaLabelSignedOut`}
        label="CTA label (signed out)"
        onChange={setCtaLabel}
        value={block.ctaLabelSignedOut ?? ""}
      />
    </>
  );
}

function GalleryFields({
  block,
  disabled,
  onChange,
}: {
  block: GalleryBlock;
  disabled: boolean;
  onChange: (next: Block) => void;
}): ReactElement {
  const setHeading = useCallback(
    (heading: string) => onChange({ ...block, heading }),
    [block, onChange],
  );
  const setSubheading = useCallback(
    (subheading: string) => onChange({ ...block, subheading }),
    [block, onChange],
  );
  return (
    <>
      <TextField
        disabled={disabled}
        id={`${block.id}-heading`}
        label="Heading"
        onChange={setHeading}
        value={block.heading ?? ""}
      />
      <TextField
        disabled={disabled}
        id={`${block.id}-subheading`}
        label="Subheading"
        onChange={setSubheading}
        value={block.subheading ?? ""}
      />
    </>
  );
}

function TextField({
  disabled,
  id,
  label,
  multiline = false,
  onChange,
  value,
}: {
  disabled: boolean;
  id: string;
  label: string;
  multiline?: boolean;
  onChange: (value: string) => void;
  value: string;
}): ReactElement {
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange(event.target.value);
    },
    [onChange],
  );

  return (
    <label className="stack stack-tight" htmlFor={id}>
      <span className="muted">{label}</span>
      {multiline ? (
        <textarea
          className="field w-full"
          disabled={disabled}
          id={id}
          onChange={handleChange}
          rows={4}
          value={value}
        />
      ) : (
        <input
          className="field w-full"
          disabled={disabled}
          id={id}
          onChange={handleChange}
          value={value}
        />
      )}
    </label>
  );
}
