"use client";

import { ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useState, useTransition } from "react";
import type { FooterLink, TenantConfig } from "@/lib/tenant-config";
import { resizeImage, uploadFile } from "@/lib/upload-client";
import { saveCommunitySettings } from "./actions";

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-[#2D2926] rounded-xl border border-white/[0.06] p-6 space-y-4">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}

/** A single image field: preview + upload + clear. Stores a URL string. */
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
      const res = await uploadFile(resized, { folder: "tenant-branding" });
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
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="text-xs text-[#78716C] hover:text-red-400 w-fit"
            >
              Remove
            </button>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      </div>
    </Field>
  );
}

export default function SettingsClient({
  slug,
  name: initialName,
  customDomain: initialCustomDomain,
  config,
}: {
  slug: string;
  name: string;
  customDomain: string;
  config: TenantConfig;
}) {
  // Registry fields
  const [name, setName] = useState(initialName);
  const [customDomain, setCustomDomain] = useState(initialCustomDomain);

  // Config fields
  const [communityName, setCommunityName] = useState(config.communityName);
  const [shortName, setShortName] = useState(config.shortName);
  const [countryName, setCountryName] = useState(config.countryName);
  const [nationality, setNationality] = useState(config.nationality);
  const [communitySuperlative, setCommunitySuperlative] = useState(config.communitySuperlative);
  const [mapImage, setMapImage] = useState(config.mapImage);
  const [ogImage, setOgImage] = useState(config.ogImage);
  const [galleryImages, setGalleryImages] = useState(config.galleryImages);
  const [discordCommunityInvite, setDiscordCommunityInvite] = useState(
    config.discordCommunityInvite,
  );
  const [linkedinUrl, setLinkedinUrl] = useState(config.linkedinUrl ?? "");
  const [majorCities, setMajorCities] = useState(config.majorCities.join(", "));
  const [lang, setLang] = useState(config.lang);
  const [currency, setCurrency] = useState(config.currency);
  const [currencySymbol, setCurrencySymbol] = useState(config.currencySymbol);
  const [defaultTimezone, setDefaultTimezone] = useState(config.defaultTimezone);
  const [siteUrl, setSiteUrl] = useState(config.siteUrl);
  const [appUrl, setAppUrl] = useState(config.appUrl);
  const [fromEmail, setFromEmail] = useState(config.fromEmail);
  const [senderEmail, setSenderEmail] = useState(config.senderEmail);
  const [senderDomain, setSenderDomain] = useState(config.senderDomain);
  const [gaId, setGaId] = useState(config.gaId ?? "");
  const [merchEnabled, setMerchEnabled] = useState(config.merchEnabled);
  const [footerIndustries, setFooterIndustries] = useState(config.footerIndustries);
  const [footerResources, setFooterResources] = useState(config.footerResources);

  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function addGalleryImage(url: string) {
    if (url) setGalleryImages((prev) => [...prev, { src: url, alt: "" }]);
  }

  function save() {
    setResult(null);
    const nextConfig: Partial<TenantConfig> = {
      communityName,
      shortName,
      countryName,
      nationality,
      communitySuperlative,
      mapImage,
      ogImage,
      galleryImages,
      discordCommunityInvite,
      linkedinUrl: linkedinUrl.trim() || null,
      majorCities: majorCities
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
      lang,
      currency,
      currencySymbol,
      defaultTimezone,
      siteUrl,
      appUrl,
      fromEmail,
      senderEmail,
      senderDomain,
      gaId: gaId.trim() || null,
      merchEnabled,
      footerIndustries,
      footerResources,
    };
    startTransition(async () => {
      const res = await saveCommunitySettings({
        config: nextConfig,
        name: name.trim(),
        customDomain: customDomain.trim() || null,
      });
      setResult(
        res.ok ? { ok: true, message: "Settings saved." } : { ok: false, message: res.error },
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

      <Section title="Identity">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Display name" hint="Shown in the platform directory.">
            <input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Slug (permanent)">
            <input className={`${INPUT} opacity-60`} value={slug} disabled />
          </Field>
          <Field label="Community name" hint="Full name used across the site & metadata.">
            <input
              className={INPUT}
              value={communityName}
              onChange={(e) => setCommunityName(e.target.value)}
            />
          </Field>
          <Field label="Short name">
            <input
              className={INPUT}
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
            />
          </Field>
          <Field label="Country name">
            <input
              className={INPUT}
              value={countryName}
              onChange={(e) => setCountryName(e.target.value)}
            />
          </Field>
          <Field label="Nationality" hint='e.g. "New Zealand" — used in some copy.'>
            <input
              className={INPUT}
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
            />
          </Field>
          <Field label="Superlative" hint='Optional, e.g. "largest " (note trailing space).'>
            <input
              className={INPUT}
              value={communitySuperlative}
              onChange={(e) => setCommunitySuperlative(e.target.value)}
            />
          </Field>
          <Field label="Major cities" hint="Comma-separated.">
            <input
              className={INPUT}
              value={majorCities}
              onChange={(e) => setMajorCities(e.target.value)}
              placeholder="Auckland, Wellington, Christchurch"
            />
          </Field>
        </div>
      </Section>

      <Section title="Branding">
        <ImageField
          label="Front / hero image"
          value={mapImage}
          onChange={setMapImage}
          hint="The hero illustration on the community home page."
        />
        <ImageField
          label="Social share image"
          value={ogImage}
          onChange={setOgImage}
          hint="OpenGraph image used when the community is shared (1200×630)."
        />
        <Field label="Gallery" hint="Photos shown on the home page.">
          <div className="space-y-2">
            {galleryImages.map((img, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: gallery rows have no stable id and are edited in place, so the array index is part of the key
              <div key={`${img.src}-${i}`} className="flex items-center gap-3">
                <div className="relative w-16 h-12 rounded overflow-hidden bg-[#1C1917] border border-white/[0.06] shrink-0">
                  {img.src && (
                    <Image src={img.src} alt={img.alt} fill sizes="64px" className="object-cover" />
                  )}
                </div>
                <input
                  className={INPUT}
                  placeholder="Caption / alt text"
                  value={img.alt}
                  onChange={(e) =>
                    setGalleryImages((prev) =>
                      prev.map((x, xi) => (xi === i ? { ...x, alt: e.target.value } : x)),
                    )
                  }
                />
                <button
                  type="button"
                  onClick={() => setGalleryImages((prev) => prev.filter((_, xi) => xi !== i))}
                  className="p-2 rounded-lg text-[#78716C] hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <GalleryAdder onAdd={addGalleryImage} />
          </div>
        </Field>
      </Section>

      <Section title="Links">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Discord invite">
            <input
              className={INPUT}
              value={discordCommunityInvite}
              onChange={(e) => setDiscordCommunityInvite(e.target.value)}
            />
          </Field>
          <Field label="LinkedIn URL">
            <input
              className={INPUT}
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
            />
          </Field>
          <Field label="Merch store">
            <label className="inline-flex items-center gap-2 text-sm text-white mt-2">
              <input
                type="checkbox"
                checked={merchEnabled}
                onChange={(e) => setMerchEnabled(e.target.checked)}
              />
              Enable merch
            </label>
          </Field>
        </div>
      </Section>

      <Section title="Footer links">
        <FooterLinksField
          label="Industries"
          hint='Internal paths (e.g. "/for/saas") or full external URLs.'
          links={footerIndustries}
          onChange={setFooterIndustries}
        />
        <FooterLinksField
          label="Resources"
          hint="Full external URLs. Leave the URL blank to link to the Discord invite."
          links={footerResources}
          onChange={setFooterResources}
        />
      </Section>

      <Section title="Locale">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Language" hint='BCP-47, e.g. "en-NZ".'>
            <input className={INPUT} value={lang} onChange={(e) => setLang(e.target.value)} />
          </Field>
          <Field label="Default timezone" hint='e.g. "Pacific/Auckland".'>
            <input
              className={INPUT}
              value={defaultTimezone}
              onChange={(e) => setDefaultTimezone(e.target.value)}
            />
          </Field>
          <Field label="Currency">
            <input
              className={INPUT}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            />
          </Field>
          <Field label="Currency symbol">
            <input
              className={INPUT}
              value={currencySymbol}
              onChange={(e) => setCurrencySymbol(e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <Section title="URLs, email & analytics">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Custom domain" hint="Also add it to the Worker in Cloudflare to resolve.">
            <input
              className={INPUT}
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              placeholder="claudecommunity.co.nz"
            />
          </Field>
          <Field label="Site URL">
            <input className={INPUT} value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} />
          </Field>
          <Field label="App URL">
            <input className={INPUT} value={appUrl} onChange={(e) => setAppUrl(e.target.value)} />
          </Field>
          <Field label="GA4 measurement ID" hint="Leave blank to disable analytics.">
            <input className={INPUT} value={gaId} onChange={(e) => setGaId(e.target.value)} />
          </Field>
          <Field label="From email" hint='e.g. "Claude NZ <noreply@…>".'>
            <input
              className={INPUT}
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
            />
          </Field>
          <Field label="Sender email">
            <input
              className={INPUT}
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
            />
          </Field>
          <Field label="Sender domain" hint="Must be a verified sending domain.">
            <input
              className={INPUT}
              value={senderDomain}
              onChange={(e) => setSenderDomain(e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#D4836A] hover:bg-[#c4775f] disabled:bg-[#D4836A]/50 text-white font-medium rounded-xl transition-colors"
        >
          {pending && <Loader2 className="w-5 h-5 animate-spin" />}
          {pending ? "Saving…" : "Save settings"}
        </button>
      </div>
    </div>
  );
}

/** A repeatable list of {label, href} rows with add/remove. */
function FooterLinksField({
  label,
  hint,
  links,
  onChange,
}: {
  label: string;
  hint?: string;
  links: FooterLink[];
  onChange: (links: FooterLink[]) => void;
}) {
  return (
    <Field label={label} hint={hint}>
      <div className="space-y-2">
        {links.map((link, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: footer-link rows have no stable id and are edited in place, so the array index is part of the key
          <div key={`${link.label}-${i}`} className="flex items-center gap-3">
            <input
              className={INPUT}
              placeholder="Label"
              value={link.label}
              onChange={(e) =>
                onChange(links.map((x, xi) => (xi === i ? { ...x, label: e.target.value } : x)))
              }
            />
            <input
              className={INPUT}
              placeholder="https://… or /path"
              value={link.href}
              onChange={(e) =>
                onChange(links.map((x, xi) => (xi === i ? { ...x, href: e.target.value } : x)))
              }
            />
            <button
              type="button"
              onClick={() => onChange(links.filter((_, xi) => xi !== i))}
              className="p-2 rounded-lg text-[#78716C] hover:text-red-400"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...links, { label: "", href: "" }])}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] text-sm text-white w-fit"
        >
          <Plus className="w-4 h-4" />
          Add link
        </button>
      </div>
    </Field>
  );
}

/** Upload button that appends a new gallery image. */
function GalleryAdder({ onAdd }: { onAdd: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  return (
    <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] text-sm text-white cursor-pointer w-fit">
      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
      {uploading ? "Uploading…" : "Add photo"}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        disabled={uploading}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setUploading(true);
          try {
            const resized = await resizeImage(f, 2000);
            const res = await uploadFile(resized, { folder: "tenant-branding" });
            onAdd(res.url);
          } finally {
            setUploading(false);
          }
        }}
      />
    </label>
  );
}
