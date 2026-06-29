"use client";

import { ArrowLeft, Bell, Camera, Loader2, Save } from "lucide-react";
import { useRef, useState } from "react";
import ImageCropperModal from "@/components/ImageCropperModal";
import ManageAccountButton from "@/components/ManageAccountButton";
import { TenantLink, useTenantRouter } from "@/components/TenantBaseProvider";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { uploadFile } from "@/lib/upload-client";

const AVATAR_MAX_EDGE = 400;
const COVER_MAX_EDGE = 1600;
const COVER_ASPECT = 4 / 1;

interface User {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  coverImage: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  twitter: string | null;
  linkedin: string | null;
  github: string | null;
}

interface ProfileSettingsFormProps {
  user: User;
}

export default function ProfileSettingsForm({ user }: ProfileSettingsFormProps) {
  const router = useTenantRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [name, setName] = useState(user.name || "");
  const [bio, setBio] = useState(user.bio || "");
  const [location, setLocation] = useState(user.location || "");
  const [website, setWebsite] = useState(user.website || "");
  const [twitter, setTwitter] = useState(user.twitter || "");
  const [linkedin, setLinkedin] = useState(user.linkedin || "");
  const [github, setGithub] = useState(user.github || "");
  const [image, setImage] = useState(user.image || "");
  const [coverImage, setCoverImage] = useState(user.coverImage || "");

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState<"avatar" | "cover" | null>(null);
  const [cropTarget, setCropTarget] = useState<{ file: File; type: "avatar" | "cover" } | null>(
    null,
  );

  const handleFileSelected = (file: File, type: "avatar" | "cover") => {
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be less than 10MB");
      return;
    }
    setError("");
    setCropTarget({ file, type });
  };

  const handleCropConfirm = async (cropped: File) => {
    if (!cropTarget) return;
    const { type } = cropTarget;
    setCropTarget(null);
    setIsUploading(type);
    try {
      const result = await uploadFile(cropped, {
        folder: type === "avatar" ? "community/avatars" : "community/covers",
      });
      if (type === "avatar") {
        setImage(result.url);
      } else {
        setCoverImage(result.url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setIsUploading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    setSuccess(false);

    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          bio,
          location,
          website,
          twitter,
          linkedin,
          github,
          image,
          coverImage,
        }),
      });

      if (res.ok) {
        setSuccess(true);
        router.refresh();
        setTimeout(() => {
          router.push(`/community/profile/${user.id}`);
        }, 1000);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to update profile");
      }
    } catch (_err) {
      setError("Failed to update profile");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {cropTarget && (
        <ImageCropperModal
          file={cropTarget.file}
          aspect={cropTarget.type === "avatar" ? 1 : COVER_ASPECT}
          outputSize={cropTarget.type === "avatar" ? AVATAR_MAX_EDGE : COVER_MAX_EDGE}
          cropShape={cropTarget.type === "avatar" ? "round" : "rect"}
          title={cropTarget.type === "avatar" ? "Crop profile picture" : "Crop cover image"}
          onCancel={() => setCropTarget(null)}
          onConfirm={handleCropConfirm}
        />
      )}
      <form onSubmit={handleSubmit} className="space-y-6">
        <TenantLink
          href={`/community/profile/${user.id}`}
          className="inline-flex items-center gap-2 text-[#A8A29E] hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Profile
        </TenantLink>

        {/* Account / Authentication */}
        <div className="bg-[#2D2926] border border-white/[0.06] rounded-xl p-4 space-y-3">
          <div>
            <h3 className="text-lg font-medium text-white">Account &amp; Authentication</h3>
            <p className="text-sm text-[#A8A29E]">
              Change your email address, password, connected accounts and other login settings.
            </p>
          </div>
          <ManageAccountButton />
        </div>

        {/* Notifications */}
        <div className="bg-[#2D2926] border border-white/[0.06] rounded-xl p-4 space-y-3">
          <div>
            <h3 className="text-lg font-medium text-white">Notifications</h3>
            <p className="text-sm text-[#A8A29E]">
              Choose which mentions, replies, likes, messages and digests reach you by email.
            </p>
          </div>
          <TenantLink
            href="/community/settings/notifications"
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#2D2926] border border-[#D4836A]/40 text-white font-medium rounded-lg hover:bg-[#3a3431] hover:border-[#D4836A] transition-colors"
          >
            <Bell className="w-5 h-5 text-[#D4836A]" />
            Manage Notifications
          </TenantLink>
        </div>

        {/* Cover Image */}
        <div className="relative">
          <button
            type="button"
            className="block w-full h-32 rounded-xl bg-gradient-to-br from-[#D4836A]/30 via-[#2D2926] to-[#1C1917] overflow-hidden cursor-pointer"
            onClick={() => coverInputRef.current?.click()}
          >
            {coverImage && (
              <RemoteImage src={coverImage} alt="Cover" className="w-full h-full object-cover" />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
              <Camera className="w-8 h-8 text-white" />
            </div>
          </button>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelected(f, "cover");
              e.target.value = "";
            }}
          />

          {/* Avatar */}
          <button
            type="button"
            className="absolute -bottom-10 left-6 w-20 h-20 rounded-full bg-gradient-to-br from-[#D4836A] to-[#B66B54] flex items-center justify-center text-white text-3xl font-bold ring-4 ring-[#1C1917] cursor-pointer overflow-hidden"
            onClick={() => avatarInputRef.current?.click()}
          >
            {image ? (
              <RemoteImage src={image} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              name?.[0]?.toUpperCase() || "?"
            )}
            <div
              className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity ${
                isUploading === "avatar" ? "opacity-100" : "opacity-0 hover:opacity-100"
              }`}
            >
              {isUploading === "avatar" ? (
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              ) : (
                <Camera className="w-6 h-6 text-white" />
              )}
            </div>
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelected(f, "avatar");
              e.target.value = "";
            }}
          />
        </div>

        <div className="pt-8 space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="profile-name" className="block text-sm font-medium text-[#A8A29E] mb-1">
              Name
            </label>
            <input
              id="profile-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#2D2926] border border-white/[0.1] rounded-lg px-4 py-3 text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50"
              placeholder="Your name"
            />
          </div>

          {/* Bio */}
          <div>
            <label htmlFor="profile-bio" className="block text-sm font-medium text-[#A8A29E] mb-1">
              Bio
            </label>
            <textarea
              id="profile-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="w-full bg-[#2D2926] border border-white/[0.1] rounded-lg px-4 py-3 text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 resize-none"
              placeholder="Tell us about yourself"
            />
          </div>

          {/* Location */}
          <div>
            <label
              htmlFor="profile-location"
              className="block text-sm font-medium text-[#A8A29E] mb-1"
            >
              Location
            </label>
            <input
              id="profile-location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-[#2D2926] border border-white/[0.1] rounded-lg px-4 py-3 text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50"
              placeholder="City, Country"
            />
          </div>

          <div className="border-t border-white/[0.06] pt-4">
            <h3 className="text-lg font-medium text-white mb-4">Social Links</h3>

            {/* Website */}
            <div className="mb-4">
              <label
                htmlFor="profile-website"
                className="block text-sm font-medium text-[#A8A29E] mb-1"
              >
                Website
              </label>
              <input
                id="profile-website"
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full bg-[#2D2926] border border-white/[0.1] rounded-lg px-4 py-3 text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50"
                placeholder="https://yourwebsite.com"
              />
            </div>

            {/* Twitter */}
            <div className="mb-4">
              <label
                htmlFor="profile-twitter"
                className="block text-sm font-medium text-[#A8A29E] mb-1"
              >
                Twitter
              </label>
              <div className="flex">
                <span className="bg-[#1C1917] border border-r-0 border-white/[0.1] rounded-l-lg px-3 py-3 text-[#78716C]">
                  @
                </span>
                <input
                  id="profile-twitter"
                  type="text"
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value.replace("@", ""))}
                  className="flex-1 bg-[#2D2926] border border-white/[0.1] rounded-r-lg px-4 py-3 text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50"
                  placeholder="username"
                />
              </div>
            </div>

            {/* LinkedIn */}
            <div className="mb-4">
              <label
                htmlFor="profile-linkedin"
                className="block text-sm font-medium text-[#A8A29E] mb-1"
              >
                LinkedIn
              </label>
              <input
                id="profile-linkedin"
                type="text"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                className="w-full bg-[#2D2926] border border-white/[0.1] rounded-lg px-4 py-3 text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50"
                placeholder="linkedin.com/in/username or just username"
              />
            </div>

            {/* GitHub */}
            <div>
              <label
                htmlFor="profile-github"
                className="block text-sm font-medium text-[#A8A29E] mb-1"
              >
                GitHub
              </label>
              <input
                id="profile-github"
                type="text"
                value={github}
                onChange={(e) => setGithub(e.target.value)}
                className="w-full bg-[#2D2926] border border-white/[0.1] rounded-lg px-4 py-3 text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50"
                placeholder="username"
              />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          {success && (
            <p className="text-green-400 text-sm">Profile updated successfully! Redirecting...</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#D4836A] text-white font-medium rounded-lg hover:bg-[#c4775f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </>
  );
}
