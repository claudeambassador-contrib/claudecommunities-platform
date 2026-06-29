"use client";

import {
  Building2,
  Eraser,
  Globe,
  Linkedin,
  Loader2,
  Palette,
  Twitter,
  Upload,
  User,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ImageCropperModal from "@/components/ImageCropperModal";
import { useToast } from "@/components/ui/Toast";
import { uploadFile } from "@/lib/upload-client";
import { greyscaleAndUpload, removeBackgroundAndUpload } from "./imageEffects";
import { SlideImage } from "./SlideImage";
import type { SlideSpeaker } from "./types";

interface Props {
  open: boolean;
  speaker: SlideSpeaker | null;
  onCancel: () => void;
  onSave: (speaker: SlideSpeaker) => void;
}

type CropTarget = "headshot" | "logo";

function randomId(): string {
  return Math.random().toString(36).slice(2, 12);
}

export default function SpeakerEditModal({ open, speaker, onCancel, onSave }: Props) {
  const toast = useToast();
  const headshotRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [talkTitle, setTalkTitle] = useState("");
  const [talkDescription, setTalkDescription] = useState("");
  const [talkDescriptionShort, setTalkDescriptionShort] = useState("");
  const [headshotUrl, setHeadshotUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [twitter, setTwitter] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [website, setWebsite] = useState("");

  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropTarget, setCropTarget] = useState<CropTarget>("headshot");
  const [uploading, setUploading] = useState(false);
  const [effect, setEffect] = useState<"removeBg" | "greyscale" | null>(null);
  const [effectError, setEffectError] = useState<string | null>(null);

  const isEditing = !!speaker;

  useEffect(() => {
    if (!open) return;
    setName(speaker?.name ?? "");
    setTitle(speaker?.title ?? "");
    setCompany(speaker?.company ?? "");
    setTalkTitle(speaker?.talk_title ?? "");
    setTalkDescription(speaker?.talk_description ?? "");
    setTalkDescriptionShort(speaker?.talk_description_short ?? "");
    setHeadshotUrl(speaker?.headshot_url ?? "");
    setLogoUrl(speaker?.company_logo_url ?? "");
    setTwitter(speaker?.twitter_handle ?? "");
    setLinkedin(speaker?.linkedin_url ?? "");
    setWebsite(speaker?.website_url ?? "");
  }, [open, speaker]);

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>, target: CropTarget) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropTarget(target);
    setCropFile(file);
    e.target.value = "";
  };

  const handleCropConfirm = async (cropped: File) => {
    setCropFile(null);
    setUploading(true);
    try {
      const folder = cropTarget === "headshot" ? "speaker-headshots" : "speaker-logos";
      const { url } = await uploadFile(cropped, { folder });
      if (cropTarget === "headshot") setHeadshotUrl(url);
      else setLogoUrl(url);
    } catch (err) {
      console.error("Speaker image upload failed:", err);
      toast.error("Failed to upload image", err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveBackground = async () => {
    if (!headshotUrl || effect) return;
    setEffect("removeBg");
    setEffectError(null);
    try {
      const { url } = await removeBackgroundAndUpload(headshotUrl, uploadFile);
      setHeadshotUrl(url);
    } catch (err) {
      console.error("Background removal failed:", err);
      setEffectError("Background removal failed");
    } finally {
      setEffect(null);
    }
  };

  const handleGreyscale = async () => {
    if (!headshotUrl || effect) return;
    setEffect("greyscale");
    setEffectError(null);
    try {
      const { url } = await greyscaleAndUpload(headshotUrl, uploadFile);
      setHeadshotUrl(url);
    } catch (err) {
      console.error("Greyscale failed:", err);
      setEffectError("Greyscale failed");
    } finally {
      setEffect(null);
    }
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: speaker?.id ?? randomId(),
      name: name.trim(),
      title: title.trim() || null,
      company: company.trim() || null,
      talk_title: talkTitle.trim() || null,
      talk_description: talkDescription.trim() || null,
      talk_description_short: talkDescriptionShort.trim() || null,
      headshot_url: headshotUrl || null,
      company_logo_url: logoUrl || null,
      twitter_handle: twitter.trim() || null,
      linkedin_url: linkedin.trim() || null,
      website_url: website.trim() || null,
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-[#1C1917] border border-white/[0.08] rounded-xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
          <h3 className="text-white font-medium">{isEditing ? "Edit speaker" : "Add speaker"}</h3>
          <button
            type="button"
            onClick={onCancel}
            className="text-[#A8A29E] hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Images */}
          <div className="flex gap-4">
            <div className="flex-1 min-w-0">
              <label className="text-[#A8A29E] text-xs">
                Headshot
                <input
                  ref={headshotRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onSelectFile(e, "headshot")}
                />
              </label>
              {headshotUrl ? (
                <>
                  <div className="mt-1 relative group">
                    <div className="w-full aspect-square rounded-lg border border-white/[0.08] overflow-hidden bg-[#2D2926]">
                      <SlideImage
                        src={headshotUrl}
                        alt="Headshot"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => headshotRef.current?.click()}
                        disabled={uploading || effect !== null}
                        className="text-white text-xs px-2 py-1 rounded hover:bg-white/10 flex items-center gap-1"
                      >
                        <Upload className="w-3 h-3" />
                        Replace
                      </button>
                      <button
                        type="button"
                        onClick={() => setHeadshotUrl("")}
                        disabled={effect !== null}
                        className="text-white text-xs px-2 py-1 rounded hover:bg-white/10 disabled:opacity-50"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    {effect && (
                      <div className="absolute inset-0 bg-black/75 rounded-lg flex flex-col items-center justify-center gap-2 text-white text-[10px] text-center px-3">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {effect === "removeBg"
                          ? "Removing background…\nFirst use downloads ~40 MB of model"
                          : "Converting to greyscale…"}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 mt-1.5">
                    <button
                      type="button"
                      onClick={handleRemoveBackground}
                      disabled={uploading || effect !== null}
                      className="flex-1 inline-flex items-center justify-center gap-1 px-2 h-7 rounded text-[10px] text-[#A8A29E] hover:text-white bg-[#2D2926] hover:bg-white/[0.05] border border-white/[0.06] disabled:opacity-50"
                      title="Remove background — first use downloads ~40 MB"
                    >
                      <Eraser className="w-3 h-3" />
                      Remove bg
                    </button>
                    <button
                      type="button"
                      onClick={handleGreyscale}
                      disabled={uploading || effect !== null}
                      className="flex-1 inline-flex items-center justify-center gap-1 px-2 h-7 rounded text-[10px] text-[#A8A29E] hover:text-white bg-[#2D2926] hover:bg-white/[0.05] border border-white/[0.06] disabled:opacity-50"
                      title="Convert to greyscale"
                    >
                      <Palette className="w-3 h-3" />
                      Greyscale
                    </button>
                  </div>
                  {effectError && (
                    <div className="text-[10px] text-red-300/80 mt-1">{effectError}</div>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => headshotRef.current?.click()}
                  disabled={uploading}
                  className="w-full aspect-square mt-1 rounded-lg border-2 border-dashed border-white/[0.12] hover:border-[#D4836A] bg-[#2D2926] flex flex-col items-center justify-center gap-1 transition-colors"
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 text-[#A8A29E] animate-spin" />
                  ) : (
                    <User className="w-5 h-5 text-[#78716C]" />
                  )}
                  <span className="text-[10px] text-[#78716C]">
                    {uploading ? "Uploading…" : "Upload photo"}
                  </span>
                </button>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <label className="text-[#A8A29E] text-xs">
                Company Logo
                <input
                  ref={logoRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onSelectFile(e, "logo")}
                />
              </label>
              {logoUrl ? (
                <div className="mt-1 relative group">
                  <div className="w-full aspect-square rounded-lg border border-white/[0.08] bg-[#2D2926] flex items-center justify-center p-3">
                    <SlideImage
                      src={logoUrl}
                      alt="Logo"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => logoRef.current?.click()}
                      disabled={uploading}
                      className="text-white text-xs px-2 py-1 rounded hover:bg-white/10"
                    >
                      <Upload className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogoUrl("")}
                      className="text-white text-xs px-2 py-1 rounded hover:bg-white/10"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => logoRef.current?.click()}
                  disabled={uploading}
                  className="w-full aspect-square mt-1 rounded-lg border-2 border-dashed border-white/[0.12] hover:border-[#D4836A] bg-[#2D2926] flex flex-col items-center justify-center gap-1 transition-colors"
                >
                  <Building2 className="w-5 h-5 text-[#78716C]" />
                  <span className="text-[10px] text-[#78716C]">Upload logo</span>
                </button>
              )}
            </div>
          </div>

          <Field label="Name *">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
              className="w-full bg-[#2D2926] border border-white/[0.08] rounded-md px-2.5 h-9 text-sm text-white placeholder:text-[#52525b]"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Title / Role">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Senior Engineer"
                className="w-full bg-[#2D2926] border border-white/[0.08] rounded-md px-2.5 h-9 text-sm text-white placeholder:text-[#52525b]"
              />
            </Field>
            <Field label="Company">
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Anthropic"
                className="w-full bg-[#2D2926] border border-white/[0.08] rounded-md px-2.5 h-9 text-sm text-white placeholder:text-[#52525b]"
              />
            </Field>
          </div>

          <Field label="Talk title">
            <input
              value={talkTitle}
              onChange={(e) => setTalkTitle(e.target.value)}
              placeholder="Building the Future of APIs"
              className="w-full bg-[#2D2926] border border-white/[0.08] rounded-md px-2.5 h-9 text-sm text-white placeholder:text-[#52525b]"
            />
          </Field>

          <Field label="Talk description">
            <textarea
              value={talkDescription}
              onChange={(e) => setTalkDescription(e.target.value)}
              placeholder="A brief description of the talk…"
              rows={3}
              className="w-full bg-[#2D2926] border border-white/[0.08] rounded-md px-2.5 py-2 text-sm text-white placeholder:text-[#52525b] resize-none"
            />
          </Field>

          <Field label="Short description (slides) — ~1 line, falls back to the long version">
            <textarea
              value={talkDescriptionShort}
              onChange={(e) => setTalkDescriptionShort(e.target.value)}
              placeholder="One-line teaser sized for the speaker slide"
              rows={2}
              className="w-full bg-[#2D2926] border border-white/[0.08] rounded-md px-2.5 py-2 text-sm text-white placeholder:text-[#52525b] resize-none"
            />
          </Field>

          <Field label="Social links">
            <div className="space-y-2">
              <SocialRow icon={<Twitter className="w-3.5 h-3.5 text-[#78716C]" />}>
                <input
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                  placeholder="@handle"
                  className="w-full bg-[#2D2926] border border-white/[0.08] rounded-md px-2.5 h-8 text-sm text-white placeholder:text-[#52525b]"
                />
              </SocialRow>
              <SocialRow icon={<Linkedin className="w-3.5 h-3.5 text-[#78716C]" />}>
                <input
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  placeholder="linkedin.com/in/username"
                  className="w-full bg-[#2D2926] border border-white/[0.08] rounded-md px-2.5 h-8 text-sm text-white placeholder:text-[#52525b]"
                />
              </SocialRow>
              <SocialRow icon={<Globe className="w-3.5 h-3.5 text-[#78716C]" />}>
                <input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="example.com"
                  className="w-full bg-[#2D2926] border border-white/[0.08] rounded-md px-2.5 h-8 text-sm text-white placeholder:text-[#52525b]"
                />
              </SocialRow>
            </div>
          </Field>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 rounded-lg text-[#A8A29E] hover:text-white hover:bg-white/[0.04] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!name.trim()}
              className="flex-1 px-4 py-2 rounded-lg bg-[#D4836A] text-white font-medium hover:bg-[#c4775f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isEditing ? "Update speaker" : "Add speaker"}
            </button>
          </div>
        </div>
      </div>

      {cropFile && (
        <ImageCropperModal
          file={cropFile}
          aspect={1}
          outputSize={cropTarget === "headshot" ? 1024 : 512}
          cropShape={cropTarget === "headshot" ? "round" : "rect"}
          title={cropTarget === "headshot" ? "Crop headshot" : "Crop logo"}
          onCancel={() => setCropFile(null)}
          onConfirm={handleCropConfirm}
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: control is passed as children and always nested inside this label (every <Field> call wraps an input/textarea)
    <label className="block">
      <span className="text-[#A8A29E] text-xs">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function SocialRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <div className="shrink-0">{icon}</div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
