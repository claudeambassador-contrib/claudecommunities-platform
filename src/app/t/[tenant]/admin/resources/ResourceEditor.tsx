"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Can } from "@/components/admin/Can";
import { useTenantRouter } from "@/components/TenantBaseProvider";
import type { ResourceSpeaker } from "@/lib/resources";
import type { ResourceInput } from "@/lib/services/resources";
import { createResourceAction, saveResourceAction } from "./actions";

const INPUT =
  "w-full px-4 py-2.5 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 transition-colors";
const LABEL = "block text-sm font-medium text-[#A8A29E] mb-1.5";

const EMPTY_RESOURCE: ResourceInput = {
  slug: "",
  title: "",
  shortTitle: "",
  description: "",
  summary: "",
  takeaways: [],
  youtubeId: "",
  publishedAt: "",
  duration: "",
  tags: [],
  speakers: [],
  isPublished: true,
};

const EMPTY_SPEAKER: ResourceSpeaker = {
  name: "",
  role: "",
  company: "",
  photo: "",
  linkedin: "",
  bio: "",
};

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className={LABEL}>{label}</span>
      {children}
      {hint && <p className="text-xs text-[#78716C] mt-1">{hint}</p>}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      className={INPUT}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function TextAreaInput({
  value,
  onChange,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <textarea
      className={INPUT}
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-[#2D2926] rounded-xl border border-white/[0.06] p-4 space-y-4">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Can permission="resources.edit">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] text-sm text-white w-fit"
      >
        <Plus className="w-4 h-4" />
        {label}
      </button>
    </Can>
  );
}

/** A list of plain strings (tags, takeaways) with add/remove. */
function StringList({
  label,
  items,
  onChange,
  addLabel,
  multiline,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  addLabel: string;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <span className={LABEL}>{label}</span>
      {items.map((item, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: edited in place, no stable id — a content-based key drops focus after one keystroke
        <div key={i} className="flex items-start gap-2">
          {multiline ? (
            <textarea
              className={INPUT}
              rows={2}
              value={item}
              placeholder={placeholder}
              onChange={(e) => onChange(items.map((it, j) => (j === i ? e.target.value : it)))}
            />
          ) : (
            <input
              className={INPUT}
              value={item}
              placeholder={placeholder}
              onChange={(e) => onChange(items.map((it, j) => (j === i ? e.target.value : it)))}
            />
          )}
          <Can permission="resources.edit">
            <button
              type="button"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="p-2 rounded-lg text-[#78716C] hover:text-red-400 shrink-0"
              aria-label="Remove"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </Can>
        </div>
      ))}
      <AddButton label={addLabel} onClick={() => onChange([...items, ""])} />
    </div>
  );
}

export default function ResourceEditor({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: ResourceInput;
}) {
  const router = useTenantRouter();
  const [v, setV] = useState<ResourceInput>(initial ?? EMPTY_RESOURCE);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function patch(next: Partial<ResourceInput>) {
    setV((prev) => ({ ...prev, ...next }));
  }

  /** Update one speaker in place (spreads the existing speaker so fields without
   * an input — photoPosition, companyLogoAlt, … — are preserved). */
  function updateSpeaker(i: number, next: Partial<ResourceSpeaker>) {
    patch({ speakers: v.speakers.map((s, j) => (j === i ? { ...s, ...next } : s)) });
  }

  function save() {
    setResult(null);
    startTransition(async () => {
      const res =
        mode === "create" ? await createResourceAction(v) : await saveResourceAction(v.slug, v);
      if (res.ok) {
        if (mode === "create") {
          router.push(`/admin/resources/${res.slug}`);
          return;
        }
        setResult({ ok: true, message: "Resource saved." });
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
          className={`p-3 rounded-lg text-sm ${result.ok ? "bg-[#10B981]/10 text-[#10B981]" : "bg-red-500/10 text-red-400"}`}
        >
          {result.message}
        </div>
      )}

      <Section title="Basics">
        <Field
          label="Slug"
          hint={
            mode === "edit"
              ? "The public URL is fixed for this resource."
              : "Lowercase words separated by hyphens. The page lives at /resources/<slug>."
          }
        >
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#78716C] font-mono">/resources/</span>
            <input
              className={`${INPUT} font-mono`}
              value={v.slug}
              disabled={mode === "edit"}
              placeholder="my-workflow-video"
              onChange={(e) => patch({ slug: e.target.value })}
            />
          </div>
        </Field>
        <Field label="Title">
          <TextInput value={v.title} onChange={(title) => patch({ title })} />
        </Field>
        <Field label="Short title" hint="Compact label used in some layouts.">
          <TextInput value={v.shortTitle} onChange={(shortTitle) => patch({ shortTitle })} />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="YouTube video ID" hint="The part after ?v= — e.g. 741M58bjNLc.">
            <TextInput value={v.youtubeId} onChange={(youtubeId) => patch({ youtubeId })} />
          </Field>
          <Field label="Published date" hint="ISO date, e.g. 2026-05-02.">
            <TextInput
              value={v.publishedAt}
              onChange={(publishedAt) => patch({ publishedAt })}
              placeholder="2026-05-02"
            />
          </Field>
          <Field label="Duration (optional)" hint='e.g. "12 min".'>
            <TextInput value={v.duration ?? ""} onChange={(duration) => patch({ duration })} />
          </Field>
          <Field label="Status">
            <label className="inline-flex items-center gap-2 text-sm text-[#D6D3D1] mt-2">
              <input
                type="checkbox"
                checked={v.isPublished}
                onChange={(e) => patch({ isPublished: e.target.checked })}
                className="accent-[#D4836A] w-4 h-4"
              />
              Published (visible on /resources)
            </label>
          </Field>
        </div>
      </Section>

      <Section title="Copy">
        <Field label="Description" hint="Longer intro shown on the detail page.">
          <TextAreaInput value={v.description} onChange={(description) => patch({ description })} />
        </Field>
        <Field label="Summary" hint="Concise line used in cards, metadata & JSON-LD.">
          <TextAreaInput value={v.summary} onChange={(summary) => patch({ summary })} rows={2} />
        </Field>
        <StringList
          label="Tags"
          items={v.tags}
          onChange={(tags) => patch({ tags })}
          addLabel="Add tag"
          placeholder="Claude Code"
        />
        <StringList
          label="What you'll learn"
          items={v.takeaways}
          onChange={(takeaways) => patch({ takeaways })}
          addLabel="Add takeaway"
          multiline
        />
      </Section>

      <Section title="Speakers">
        <div className="space-y-3">
          {v.speakers.map((s, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: edited in place, no stable id
              key={i}
              className="rounded-xl border border-white/[0.06] p-4 space-y-3 relative"
            >
              <Can permission="resources.edit">
                <button
                  type="button"
                  onClick={() => patch({ speakers: v.speakers.filter((_, j) => j !== i) })}
                  className="absolute top-3 right-3 p-1.5 rounded-lg text-[#78716C] hover:text-red-400"
                  aria-label="Remove speaker"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </Can>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Name">
                  <TextInput value={s.name} onChange={(name) => updateSpeaker(i, { name })} />
                </Field>
                <Field label="Role">
                  <TextInput value={s.role} onChange={(role) => updateSpeaker(i, { role })} />
                </Field>
                <Field label="Company">
                  <TextInput
                    value={s.company}
                    onChange={(company) => updateSpeaker(i, { company })}
                  />
                </Field>
                <Field label="Photo URL">
                  <TextInput value={s.photo} onChange={(photo) => updateSpeaker(i, { photo })} />
                </Field>
                <Field label="LinkedIn URL">
                  <TextInput
                    value={s.linkedin}
                    onChange={(linkedin) => updateSpeaker(i, { linkedin })}
                  />
                </Field>
                <Field label="Website (optional)">
                  <TextInput
                    value={s.website ?? ""}
                    onChange={(website) => updateSpeaker(i, { website })}
                  />
                </Field>
                <Field label="Company logo URL (optional)">
                  <TextInput
                    value={s.companyLogo ?? ""}
                    onChange={(companyLogo) => updateSpeaker(i, { companyLogo })}
                  />
                </Field>
              </div>
              <Field label="Bio">
                <TextAreaInput value={s.bio} onChange={(bio) => updateSpeaker(i, { bio })} />
              </Field>
            </div>
          ))}
          <AddButton
            label="Add speaker"
            onClick={() => patch({ speakers: [...v.speakers, { ...EMPTY_SPEAKER }] })}
          />
        </div>
      </Section>

      <Can permission="resources.edit">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#D4836A] hover:bg-[#c4775f] disabled:bg-[#D4836A]/50 text-white font-medium rounded-xl transition-colors"
        >
          {pending && <Loader2 className="w-5 h-5 animate-spin" />}
          {pending ? "Saving…" : mode === "create" ? "Create resource" : "Save resource"}
        </button>
      </Can>
    </div>
  );
}
