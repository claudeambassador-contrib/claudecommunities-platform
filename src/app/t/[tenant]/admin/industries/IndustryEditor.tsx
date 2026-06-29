"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Can } from "@/components/admin/Can";
import { useTenantRouter } from "@/components/TenantBaseProvider";
import { INDUSTRY_ICON_NAMES } from "@/lib/industry-icons";
import type { Vertical } from "@/lib/verticals";
import { createIndustryAction, saveIndustryAction } from "./actions";

const INPUT =
  "w-full px-4 py-2.5 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 transition-colors";
const LABEL = "block text-sm font-medium text-[#A8A29E] mb-1.5";

const EMPTY_VERTICAL: Vertical = {
  slug: "",
  name: "",
  tagline: "",
  title: "",
  description: "",
  keywords: [],
  ogTitle: "",
  ogDescription: "",
  heroHeading: "",
  heroSubheading: "",
  heroBadge: "",
  introParagraphs: [],
  useCases: [],
  benefits: [],
  features: [],
  faqs: [],
  relatedVerticals: [],
  ctaHeading: "",
  ctaDescription: "",
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
    <Can permission="pages.edit">
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

/** Generic repeatable-row editor for object arrays (benefits, useCases, …). */
function ArrayEditor<T>({
  label,
  items,
  empty,
  onChange,
  render,
  addLabel,
}: {
  label: string;
  items: T[];
  empty: () => T;
  onChange: (next: T[]) => void;
  render: (item: T, update: (next: T) => void) => React.ReactNode;
  addLabel: string;
}) {
  return (
    <div className="space-y-3">
      <span className={LABEL}>{label}</span>
      {items.map((item, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: rows are edited in place and have no stable id, so the index is part of the key
          key={i}
          className="rounded-xl border border-white/[0.06] p-4 space-y-3 relative"
        >
          <Can permission="pages.edit">
            <button
              type="button"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="absolute top-3 right-3 p-1.5 rounded-lg text-[#78716C] hover:text-red-400"
              aria-label="Remove"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </Can>
          {render(item, (next) => onChange(items.map((it, j) => (j === i ? next : it))))}
        </div>
      ))}
      <AddButton label={addLabel} onClick={() => onChange([...items, empty()])} />
    </div>
  );
}

/** A list of plain strings (keywords, intro paragraphs, related slugs, bullets). */
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
        // biome-ignore lint/suspicious/noArrayIndexKey: edited in place, no stable id
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
          <Can permission="pages.edit">
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

export default function IndustryEditor({
  mode,
  initial,
  slugLocked = false,
}: {
  mode: "create" | "edit";
  initial?: Vertical;
  /** Built-in overrides and existing pages keep a fixed slug. */
  slugLocked?: boolean;
}) {
  const router = useTenantRouter();
  const [v, setV] = useState<Vertical>(initial ?? EMPTY_VERTICAL);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function patch(next: Partial<Vertical>) {
    setV((prev) => ({ ...prev, ...next }));
  }

  function save() {
    setResult(null);
    startTransition(async () => {
      const res =
        mode === "create" ? await createIndustryAction(v) : await saveIndustryAction(v.slug, v);
      if (res.ok) {
        if (mode === "create") {
          router.push(`/admin/industries/${res.slug}`);
          return;
        }
        setResult({ ok: true, message: "Industry page saved." });
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
          label="Path"
          hint={
            slugLocked
              ? "The public URL is fixed for this page."
              : "Single segment — lowercase, hyphens. The page lives at /for/<path>."
          }
        >
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#78716C] font-mono">/for/</span>
            <input
              className={`${INPUT} font-mono`}
              value={v.slug}
              disabled={slugLocked}
              placeholder="fintech"
              onChange={(e) => patch({ slug: e.target.value })}
            />
          </div>
        </Field>
        <Field label="Name" hint="Used as “Claude Code for <name>” across the page.">
          <TextInput value={v.name} onChange={(name) => patch({ name })} placeholder="Fintech" />
        </Field>
        <Field label="Tagline" hint="Short line shown on the industries index card.">
          <TextInput value={v.tagline} onChange={(tagline) => patch({ tagline })} />
        </Field>
      </Section>

      <Section title="SEO">
        <Field label="SEO title">
          <TextInput value={v.title} onChange={(title) => patch({ title })} />
        </Field>
        <Field label="Meta description">
          <TextAreaInput value={v.description} onChange={(description) => patch({ description })} />
        </Field>
        <Field label="OG title">
          <TextInput value={v.ogTitle} onChange={(ogTitle) => patch({ ogTitle })} />
        </Field>
        <Field label="OG description">
          <TextAreaInput
            value={v.ogDescription}
            onChange={(ogDescription) => patch({ ogDescription })}
          />
        </Field>
        <StringList
          label="Keywords"
          items={v.keywords}
          onChange={(keywords) => patch({ keywords })}
          addLabel="Add keyword"
        />
      </Section>

      <Section title="Hero">
        <Field label="Badge">
          <TextInput value={v.heroBadge} onChange={(heroBadge) => patch({ heroBadge })} />
        </Field>
        <Field label="Heading">
          <TextInput value={v.heroHeading} onChange={(heroHeading) => patch({ heroHeading })} />
        </Field>
        <Field label="Subheading">
          <TextAreaInput
            value={v.heroSubheading}
            onChange={(heroSubheading) => patch({ heroSubheading })}
          />
        </Field>
      </Section>

      <Section title="Intro">
        <StringList
          label="Intro paragraphs"
          items={v.introParagraphs}
          onChange={(introParagraphs) => patch({ introParagraphs })}
          addLabel="Add paragraph"
          multiline
        />
      </Section>

      <Section title="Benefits (stats banner)">
        <ArrayEditor
          label="Benefits"
          items={v.benefits}
          empty={() => ({ stat: "", label: "" })}
          onChange={(benefits) => patch({ benefits })}
          addLabel="Add benefit"
          render={(b, update) => (
            <div className="space-y-3">
              <Field label="Stat">
                <TextInput
                  value={b.stat}
                  onChange={(stat) => update({ ...b, stat })}
                  placeholder="3x"
                />
              </Field>
              <Field label="Label">
                <TextInput value={b.label} onChange={(label) => update({ ...b, label })} />
              </Field>
            </div>
          )}
        />
      </Section>

      <Section title="Use cases">
        <ArrayEditor
          label="Use cases"
          items={v.useCases}
          empty={() => ({ title: "", description: "", icon: INDUSTRY_ICON_NAMES[0] })}
          onChange={(useCases) => patch({ useCases })}
          addLabel="Add use case"
          render={(u, update) => (
            <div className="space-y-3">
              <Field label="Icon">
                <select
                  className={INPUT}
                  value={u.icon}
                  onChange={(e) => update({ ...u, icon: e.target.value })}
                >
                  {INDUSTRY_ICON_NAMES.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Title">
                <TextInput value={u.title} onChange={(title) => update({ ...u, title })} />
              </Field>
              <Field label="Description">
                <TextAreaInput
                  value={u.description}
                  onChange={(description) => update({ ...u, description })}
                />
              </Field>
            </div>
          )}
        />
      </Section>

      <Section title="Features">
        <ArrayEditor
          label="Features"
          items={v.features}
          empty={() => ({ title: "", description: "", bulletPoints: [] })}
          onChange={(features) => patch({ features })}
          addLabel="Add feature"
          render={(f, update) => (
            <div className="space-y-3">
              <Field label="Title">
                <TextInput value={f.title} onChange={(title) => update({ ...f, title })} />
              </Field>
              <Field label="Description">
                <TextAreaInput
                  value={f.description}
                  onChange={(description) => update({ ...f, description })}
                />
              </Field>
              <StringList
                label="Bullet points"
                items={f.bulletPoints}
                onChange={(bulletPoints) => update({ ...f, bulletPoints })}
                addLabel="Add bullet"
              />
            </div>
          )}
        />
      </Section>

      <Section title="FAQs">
        <ArrayEditor
          label="FAQs"
          items={v.faqs}
          empty={() => ({ question: "", answer: "" })}
          onChange={(faqs) => patch({ faqs })}
          addLabel="Add FAQ"
          render={(q, update) => (
            <div className="space-y-3">
              <Field label="Question">
                <TextInput value={q.question} onChange={(question) => update({ ...q, question })} />
              </Field>
              <Field label="Answer">
                <TextAreaInput value={q.answer} onChange={(answer) => update({ ...q, answer })} />
              </Field>
            </div>
          )}
        />
      </Section>

      <Section title="Cross-linking & CTA">
        <StringList
          label="Related industries (paths)"
          items={v.relatedVerticals}
          onChange={(relatedVerticals) => patch({ relatedVerticals })}
          addLabel="Add related"
          placeholder="saas"
        />
        <Field label="CTA heading">
          <TextInput value={v.ctaHeading} onChange={(ctaHeading) => patch({ ctaHeading })} />
        </Field>
        <Field label="CTA description">
          <TextAreaInput
            value={v.ctaDescription}
            onChange={(ctaDescription) => patch({ ctaDescription })}
          />
        </Field>
      </Section>

      <Can permission="pages.edit">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#D4836A] hover:bg-[#c4775f] disabled:bg-[#D4836A]/50 text-white font-medium rounded-xl transition-colors"
        >
          {pending && <Loader2 className="w-5 h-5 animate-spin" />}
          {pending ? "Saving…" : mode === "create" ? "Create industry page" : "Save industry page"}
        </button>
      </Can>
    </div>
  );
}
