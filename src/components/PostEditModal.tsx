"use client";

import { Image as ImageIcon, Plus, Send, Video, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { uploadFile } from "@/lib/upload-client";
import LessonContent from "./LessonContent";
import MentionInput from "./MentionInput";
import { useToast } from "./ui/Toast";

interface Space {
  id: string;
  name: string;
  slug: string;
  color: string | null;
}

interface Post {
  id: string;
  title: string | null;
  content: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  space: {
    id: string;
    name: string;
    slug: string;
    color: string | null;
  };
}

interface PostEditModalProps {
  post: Post;
  spaces: Space[];
  onClose: () => void;
  onSaved: () => void;
}

export default function PostEditModal({ post, spaces, onClose, onSaved }: PostEditModalProps) {
  const toast = useToast();
  const [content, setContent] = useState(post.content);
  const [title, setTitle] = useState(post.title || "");
  const [selectedSpaceId, setSelectedSpaceId] = useState(post.space.id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTitle, setShowTitle] = useState(!!post.title);
  const [mediaPreview, setMediaPreview] = useState<string | null>(post.mediaUrl || null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(post.mediaUrl || null);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(
    post.mediaType as "image" | "video" | null,
  );
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const upload = (file: File, folder: string) =>
    uploadFile(file, { folder, onProgress: setUploadProgress });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !selectedSpaceId || isSubmitting) return;

    // Validate media - if we have a preview but no URL, upload may still be processing
    if (mediaPreview && !mediaUrl) {
      setUploadError("Please wait for media upload to complete");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || null,
          content: content.trim(),
          spaceId: selectedSpaceId,
          mediaUrl: mediaUrl,
          mediaType: mediaType,
        }),
      });

      if (res.ok) {
        onSaved();
        onClose();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update post");
      }
    } catch (error) {
      console.error("Failed to update post:", error);
      toast.error("Failed to update post");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("Please select an image file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Image must be less than 10MB");
      return;
    }

    setIsUploadingMedia(true);
    setUploadProgress(0);
    setUploadError(null);
    setMediaType("image");

    const reader = new FileReader();
    reader.onload = (e) => setMediaPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    try {
      const result = await upload(file, "community/images");
      if (result?.url) {
        setMediaUrl(result.url);
        setMediaPreview(result.url);
      } else {
        console.error("Upload returned no URL:", result);
        setUploadError("Upload completed but no URL received");
        setMediaPreview(null);
        setMediaType(null);
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Failed to upload image");
      setMediaPreview(null);
      setMediaType(null);
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      setUploadError("Please select a video file");
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setUploadError("Video must be less than 100MB");
      return;
    }

    setIsUploadingMedia(true);
    setUploadProgress(0);
    setUploadError(null);
    setMediaType("video");

    const reader = new FileReader();
    reader.onload = (e) => setMediaPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    try {
      const result = await upload(file, "community/videos");
      if (result?.url) {
        setMediaUrl(result.url);
        setMediaPreview(result.url);
      } else {
        console.error("Upload returned no URL:", result);
        setUploadError("Upload completed but no URL received");
        setMediaPreview(null);
        setMediaType(null);
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Failed to upload video");
      setMediaPreview(null);
      setMediaType(null);
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const removeMedia = () => {
    setMediaPreview(null);
    setMediaUrl(null);
    setMediaType(null);
    setUploadError(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const maxLength = 2000;
  const remainingChars = maxLength - content.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close edit dialog"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-[#2D2926] rounded-2xl border border-white/[0.1] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <h2 className="text-lg font-semibold text-white">Edit Post</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[#78716C] hover:text-white hover:bg-white/[0.05] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Title toggle */}
            {showTitle ? (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Add a title..."
                className="w-full bg-[#1C1917] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50"
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowTitle(true)}
                className="flex items-center gap-2 text-sm text-[#78716C] hover:text-[#D4836A] transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add title
              </button>
            )}

            {/* Content */}
            <div>
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setShowPreview(false)}
                  className={`px-3 py-1 text-sm rounded-lg ${!showPreview ? "bg-[#D4836A] text-white" : "text-[#78716C] hover:text-white"}`}
                >
                  Write
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreview(true)}
                  className={`px-3 py-1 text-sm rounded-lg ${showPreview ? "bg-[#D4836A] text-white" : "text-[#78716C] hover:text-white"}`}
                >
                  Preview
                </button>
              </div>
              {showPreview ? (
                <div className="min-h-[150px] px-4 py-3 bg-[#1C1917] border border-white/[0.08] rounded-xl">
                  {content ? (
                    <LessonContent content={content} />
                  ) : (
                    <p className="text-[#57534E] text-sm italic">Nothing to preview</p>
                  )}
                </div>
              ) : (
                <MentionInput
                  value={content}
                  onChange={(v) => setContent(v.slice(0, maxLength))}
                  placeholder="What's on your mind?"
                  multiline
                  rows={6}
                  className="w-full bg-[#1C1917] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 resize-none"
                />
              )}
              <p className="text-xs text-[#57534E] mt-1">
                Supports markdown: **bold**, _italic_, ## headings, - lists, `code`, [links](url)
              </p>
            </div>

            {/* Upload Error */}
            {uploadError && (
              <div className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg flex items-center justify-between">
                <span>{uploadError}</span>
                <button type="button" onClick={() => setUploadError(null)}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Media Preview */}
            {mediaPreview && (
              <div className="relative rounded-xl overflow-hidden bg-black/20">
                {mediaType === "image" ? (
                  <RemoteImage
                    src={mediaPreview}
                    alt="Preview"
                    className="w-full max-h-[300px] object-contain"
                  />
                ) : (
                  <video src={mediaPreview} className="w-full max-h-[300px]" controls>
                    <track kind="captions" srcLang="en" src="" default />
                  </video>
                )}
                {isUploadingMedia && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                    <div className="text-center w-3/4 max-w-xs">
                      <div className="mb-3">
                        <span className="text-2xl font-bold text-white">{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-white/20 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-[#D4836A] h-full rounded-full transition-all duration-300 ease-out"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <span className="text-sm text-white/80 mt-2 block">Uploading...</span>
                    </div>
                  </div>
                )}
                {!isUploadingMedia && (
                  <button
                    type="button"
                    onClick={removeMedia}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {/* Space selector */}
            <div>
              <label htmlFor="edit-post-space" className="block text-sm text-[#78716C] mb-2">
                Space
              </label>
              <select
                id="edit-post-space"
                value={selectedSpaceId}
                onChange={(e) => setSelectedSpaceId(e.target.value)}
                className="w-full bg-[#1C1917] border border-white/[0.08] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#D4836A]/50"
              >
                {spaces.map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-white/[0.06] bg-[#1C1917]/50">
            <div className="flex items-center justify-between">
              {/* Media buttons */}
              <div className="flex items-center gap-1">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleVideoSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={isUploadingMedia}
                  className="p-2 rounded-lg text-[#78716C] hover:text-white hover:bg-white/[0.05] transition-colors disabled:opacity-50"
                  title="Add image"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  disabled={isUploadingMedia}
                  className="p-2 rounded-lg text-[#78716C] hover:text-white hover:bg-white/[0.05] transition-colors disabled:opacity-50"
                  title="Add video"
                >
                  <Video className="w-5 h-5" />
                </button>
              </div>

              {/* Submit */}
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs ${remainingChars < 100 ? "text-[#D4836A]" : "text-[#78716C]"}`}
                >
                  {remainingChars}
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-[#78716C] hover:text-white hover:bg-white/[0.05] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!content.trim() || isSubmitting || isUploadingMedia}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#D4836A] text-white font-medium hover:bg-[#c4775f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
