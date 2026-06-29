"use client";

import { ChevronDown, ChevronUp, Loader2, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Can } from "@/components/admin/Can";
import type { AdminCity, CityInput } from "@/lib/services/cities";
import { removeCity, saveCity, saveOrder } from "./actions";

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

/** The editable form shape — keywords held as a comma-joined string. */
interface FormState {
  slug: string;
  name: string;
  state: string;
  stateFull: string;
  description: string;
  timezone: string;
  keywords: string;
  isCapital: boolean;
}

function cityToForm(city: AdminCity): FormState {
  return {
    slug: city.slug,
    name: city.name,
    state: city.state,
    stateFull: city.stateFull,
    description: city.description,
    timezone: city.timezone,
    keywords: city.keywords.join(", "),
    isCapital: city.isCapital,
  };
}

const BLANK_FORM: FormState = {
  slug: "",
  name: "",
  state: "",
  stateFull: "",
  description: "",
  timezone: "",
  keywords: "",
  isCapital: false,
};

function formToInput(form: FormState): CityInput {
  return {
    slug: form.slug.trim().toLowerCase(),
    name: form.name.trim(),
    state: form.state.trim(),
    stateFull: form.stateFull.trim(),
    description: form.description.trim(),
    timezone: form.timezone.trim(),
    isCapital: form.isCapital,
    keywords: form.keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean),
  };
}

export default function CitiesClient({ initialCities }: { initialCities: AdminCity[] }) {
  const [cities, setCities] = useState<AdminCity[]>(initialCities);
  // The original slug of the row currently being edited (null = none). `"__new__"`
  // is the sentinel for the blank add-city form so it can coexist with edits.
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [confirmingSlug, setConfirmingSlug] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function show(ok: boolean, message: string) {
    setResult({ ok, message });
  }

  function persistOrder(next: AdminCity[]) {
    const prev = cities;
    setCities(next);
    void saveOrder(next.map((c) => c.slug)).then((res) => {
      if (!res.ok) {
        setCities(prev);
        show(false, res.error);
      }
    });
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= cities.length) return;
    const next = [...cities];
    [next[index], next[target]] = [next[target], next[index]];
    persistOrder(next);
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
        {cities.length === 0 && (
          <p className="text-sm text-[#78716C]">No cities yet. Add one to get started.</p>
        )}
        {cities.map((city, index) => (
          <CityRow
            key={city.id}
            city={city}
            index={index}
            count={cities.length}
            expanded={editingSlug === city.slug}
            confirming={confirmingSlug === city.slug}
            onToggleExpand={() => setEditingSlug((s) => (s === city.slug ? null : city.slug))}
            onMove={(dir) => move(index, dir)}
            onConfirmToggle={() => setConfirmingSlug((s) => (s === city.slug ? null : city.slug))}
            onSaved={(saved) => {
              setCities((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
              setEditingSlug(null);
              show(true, `Saved ${saved.name}.`);
            }}
            onDeleted={() => {
              setCities((prev) => prev.filter((c) => c.id !== city.id));
              setConfirmingSlug(null);
              show(true, `Deleted ${city.name}.`);
            }}
            onError={(message) => show(false, message)}
          />
        ))}
      </div>

      <Can permission="cities.edit">
        {editingSlug === "__new__" ? (
          <CityForm
            isNew
            initial={BLANK_FORM}
            originalSlug={null}
            onCancel={() => setEditingSlug(null)}
            onSaved={(saved) => {
              setCities((prev) => [...prev, saved]);
              setEditingSlug(null);
              show(true, `Added ${saved.name}.`);
            }}
            onError={(message) => show(false, message)}
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setEditingSlug("__new__");
              setResult(null);
            }}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#D4836A] hover:bg-[#c4775f] text-white font-medium rounded-xl transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add city
          </button>
        )}
      </Can>
    </div>
  );
}

function CityRow({
  city,
  index,
  count,
  expanded,
  confirming,
  onToggleExpand,
  onMove,
  onConfirmToggle,
  onSaved,
  onDeleted,
  onError,
}: {
  city: AdminCity;
  index: number;
  count: number;
  expanded: boolean;
  confirming: boolean;
  onToggleExpand: () => void;
  onMove: (dir: -1 | 1) => void;
  onConfirmToggle: () => void;
  onSaved: (city: AdminCity) => void;
  onDeleted: () => void;
  onError: (message: string) => void;
}) {
  const [deleting, startDelete] = useTransition();

  function doDelete() {
    startDelete(async () => {
      const res = await removeCity(city.slug);
      if (res.ok) onDeleted();
      else onError(res.error);
    });
  }

  return (
    <div className="bg-[#2D2926] rounded-xl border border-white/[0.06]">
      <div className="flex items-center gap-3 p-4">
        <Can permission="cities.edit" fallback={<span className="w-[60px]" />}>
          <div className="flex flex-col">
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
              disabled={index === count - 1}
              className="p-1 rounded text-[#78716C] hover:text-white disabled:opacity-30 disabled:hover:text-[#78716C]"
              aria-label="Move down"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </Can>

        <button
          type="button"
          onClick={onToggleExpand}
          className="flex-1 flex items-center gap-3 text-left"
        >
          <span className="text-white font-medium">{city.name}</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              city.isCapital ? "bg-[#D4836A]/15 text-[#D4836A]" : "bg-white/[0.05] text-[#A8A29E]"
            }`}
          >
            {city.isCapital ? "Capital" : "Regional"}
          </span>
          <span className="text-xs text-[#78716C]">{city.state}</span>
        </button>

        <Can permission="cities.edit">
          {confirming ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={doDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-sm"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm
              </button>
              <button
                type="button"
                onClick={onConfirmToggle}
                className="px-3 py-1.5 rounded-lg text-sm text-[#78716C] hover:text-white"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onConfirmToggle}
              className="p-2 rounded-lg text-[#78716C] hover:text-red-400"
              aria-label="Delete city"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </Can>
      </div>

      {expanded && (
        <div className="border-t border-white/[0.06] p-4">
          <Can
            permission="cities.edit"
            fallback={<p className="text-sm text-[#78716C]">You have read-only access.</p>}
          >
            <CityForm
              initial={cityToForm(city)}
              originalSlug={city.slug}
              onCancel={onToggleExpand}
              onSaved={onSaved}
              onError={onError}
            />
          </Can>
        </div>
      )}
    </div>
  );
}

function CityForm({
  initial,
  originalSlug,
  isNew = false,
  onCancel,
  onSaved,
  onError,
}: {
  initial: FormState;
  originalSlug: string | null;
  isNew?: boolean;
  onCancel: () => void;
  onSaved: (city: AdminCity) => void;
  onError: (message: string) => void;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function save() {
    startTransition(async () => {
      const res = await saveCity(originalSlug, formToInput(form));
      if (res.ok) onSaved(res.city);
      else onError(res.error);
    });
  }

  return (
    <div
      className={
        isNew ? "bg-[#2D2926] rounded-xl border border-white/[0.06] p-6 space-y-4" : "space-y-4"
      }
    >
      {isNew && <h2 className="text-base font-semibold text-white">New city</h2>}
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Name">
          <input
            className={INPUT}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </Field>
        <Field label="Slug" hint="Lowercase, url-safe (e.g. new-south-wales).">
          <input
            className={INPUT}
            value={form.slug}
            onChange={(e) => set("slug", e.target.value)}
          />
        </Field>
        <Field label="State" hint='Abbreviation, e.g. "NSW".'>
          <input
            className={INPUT}
            value={form.state}
            onChange={(e) => set("state", e.target.value)}
          />
        </Field>
        <Field label="Full state name" hint='e.g. "New South Wales".'>
          <input
            className={INPUT}
            value={form.stateFull}
            onChange={(e) => set("stateFull", e.target.value)}
          />
        </Field>
        <Field label="Timezone" hint='IANA, e.g. "Australia/Sydney".'>
          <input
            className={INPUT}
            value={form.timezone}
            onChange={(e) => set("timezone", e.target.value)}
          />
        </Field>
        <Field label="Capital city">
          <label className="inline-flex items-center gap-2 text-sm text-white mt-2">
            <input
              type="checkbox"
              checked={form.isCapital}
              onChange={(e) => set("isCapital", e.target.checked)}
            />
            This is a capital city
          </label>
        </Field>
      </div>

      <Field label="Keywords" hint="Comma-separated, used for SEO on the city page.">
        <input
          className={INPUT}
          value={form.keywords}
          onChange={(e) => set("keywords", e.target.value)}
          placeholder="Claude Code Sydney, AI meetups Sydney"
        />
      </Field>

      <Field label="Description">
        <textarea
          className={`${INPUT} min-h-24`}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </Field>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#D4836A] hover:bg-[#c4775f] disabled:bg-[#D4836A]/50 text-white font-medium rounded-xl transition-colors"
        >
          {pending && <Loader2 className="w-5 h-5 animate-spin" />}
          {pending ? "Saving…" : isNew ? "Add city" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-3 text-sm text-[#78716C] hover:text-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
