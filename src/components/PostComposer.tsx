"use client";

import {
  BarChart2,
  Clock,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Plus,
  Send,
  Video,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { formatFileSize } from "@/lib/format";
import { uploadFile } from "@/lib/upload-client";
import LessonContent from "./LessonContent";
import MentionInput from "./MentionInput";
import { getFileIcon } from "./ui/fileIcons";
import { useToast } from "./ui/Toast";

interface Space {
  id: string;
  name: string;
  slug: string;
  color: string | null;
}

interface PostComposerProps {
  spaces: Space[];
  userName: string;
  userImage?: string | null;
  onPostCreated?: () => void;
  defaultSpaceSlug?: string;
}

interface UploadedFile {
  name: string;
  url: string;
  type: string;
  size: number;
  publicId?: string;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the form's handlers (submit + image/video/file uploads) close over many setState calls; extracting them would require threading a dozen setters as params and is not behavior-preserving
export default function PostComposer({
  spaces,
  userName,
  userImage,
  onPostCreated,
  defaultSpaceSlug,
}: PostComposerProps) {
  const toast = useToast();
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  // Default to the space matching the current view, or fall back to first space
  const defaultSpace = defaultSpaceSlug
    ? spaces.find((s) => s.slug === defaultSpaceSlug) || spaces[0]
    : spaces[0];
  const [selectedSpaceId, setSelectedSpaceId] = useState(defaultSpace?.id || "");

  // Update selected space when navigating between spaces
  useEffect(() => {
    if (defaultSpaceSlug) {
      const matchingSpace = spaces.find((s) => s.slug === defaultSpaceSlug);
      if (matchingSpace) {
        setSelectedSpaceId(matchingSpace.id);
      }
    }
  }, [defaultSpaceSlug, spaces]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTitle, setShowTitle] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [showPoll, setShowPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [pollEndsAt, setPollEndsAt] = useState<string>("");
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleMentionsChange = useCallback((userIds: string[]) => {
    setMentionedUserIds(userIds);
  }, []);

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
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || null,
          content: content.trim(),
          spaceId: selectedSpaceId,
          mediaUrl: mediaUrl,
          mediaType: mediaType,
          mentionedUserIds: mentionedUserIds,
          poll:
            showPoll && pollQuestion.trim() && pollOptions.filter((o) => o.trim()).length >= 2
              ? {
                  question: pollQuestion.trim(),
                  options: pollOptions.filter((o) => o.trim()),
                  endsAt: pollEndsAt || null,
                }
              : null,
          attachments: attachments.length > 0 ? attachments : null,
        }),
      });

      if (res.ok) {
        setContent("");
        setTitle("");
        setShowTitle(false);
        setMediaPreview(null);
        setMediaUrl(null);
        setMediaType(null);
        setUploadError(null);
        setMentionedUserIds([]);
        setShowPoll(false);
        setPollQuestion("");
        setPollOptions(["", ""]);
        setPollEndsAt("");
        setAttachments([]);
        onPostCreated?.();
      } else {
        const data = await res.json();
        console.error("Post creation failed:", data);
        toast.error(data.details || data.error || "Failed to create post");
      }
    } catch (error) {
      console.error("Failed to create post:", error);
      toast.error(
        "Failed to create post",
        error instanceof Error ? error.message : "Unknown error",
      );
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

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
      setMediaPreview(e.target?.result as string);
    };
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
      console.error("Failed to upload image:", error);
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

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
      setMediaPreview(e.target?.result as string);
    };
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
      console.error("Failed to upload video:", error);
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
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
    if (videoInputRef.current) {
      videoInputRef.current.value = "";
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Limit to 5 attachments total
    if (attachments.length + files.length > 5) {
      setUploadError("Maximum 5 attachments allowed");
      return;
    }

    setIsUploadingAttachment(true);
    setUploadError(null);

    const newAttachments: UploadedFile[] = [];

    for (const file of Array.from(files)) {
      // Max 25MB per file
      if (file.size > 25 * 1024 * 1024) {
        setUploadError(`File ${file.name} is too large. Maximum 25MB per file.`);
        continue;
      }

      try {
        const result = await upload(file, "community/attachments");
        if (result) {
          newAttachments.push({
            name: file.name,
            url: result.url,
            type: file.type,
            size: file.size,
            publicId: result.publicId,
          });
        }
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
        setUploadError(`Failed to upload ${file.name}`);
      }
    }

    setAttachments([...attachments, ...newAttachments]);
    setIsUploadingAttachment(false);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const maxLength = 2000;
  const remainingChars = maxLength - content.length;

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[#2D2926] rounded-2xl border border-white/[0.06] hover:border-white/[0.1] transition-colors duration-200 overflow-hidden"
    >
      {/* Header with Avatar and Input */}
      <div className="p-3 sm:p-4 pb-3">
        <div className="flex gap-2 sm:gap-3">
          <Avatar
            src={userImage}
            name={userName}
            alt={userName || "User"}
            className="w-10 h-10 rounded-full shrink-0"
            fallbackClassName="bg-gradient-to-br from-[#D4836A] to-[#B66B54] text-white font-semibold"
          />
          <div className="flex-1 min-w-0">
            {showTitle && (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Add a title..."
                className="w-full bg-transparent text-base font-semibold text-white placeholder-[#78716C] focus:outline-none mb-2"
              />
            )}
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className={`px-3 py-1 text-xs rounded-lg ${!showPreview ? "bg-[#D4836A] text-white" : "text-[#78716C] hover:text-white"}`}
              >
                Write
              </button>
              <button
                type="button"
                onClick={() => setShowPreview(true)}
                className={`px-3 py-1 text-xs rounded-lg ${showPreview ? "bg-[#D4836A] text-white" : "text-[#78716C] hover:text-white"}`}
              >
                Preview
              </button>
            </div>
            {showPreview ? (
              <div className="min-h-[56px] text-sm leading-relaxed">
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
                onMentionsChange={handleMentionsChange}
                placeholder="Share something with the community..."
                multiline
                rows={2}
                className="w-full bg-transparent text-white placeholder-[#78716C] focus:outline-none resize-none text-sm leading-relaxed"
              />
            )}
            <p className="text-xs text-[#57534E] mt-1">
              Supports markdown: **bold**, _italic_, ## headings, - lists, `code`, [links](url)
            </p>
          </div>
        </div>
      </div>

      {/* Upload Error */}
      {uploadError && (
        <div className="px-4 pb-3">
          <div className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg flex items-center justify-between">
            <span>{uploadError}</span>
            <button
              type="button"
              onClick={() => setUploadError(null)}
              className="ml-2 text-red-400 hover:text-red-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Media Preview */}
      {mediaPreview && (
        <div className="px-4 pb-3">
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
        </div>
      )}

      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="px-4 pb-3 space-y-2">
          {attachments.map((attachment, index) => {
            const FileIcon = getFileIcon(attachment.type);
            return (
              <div
                key={attachment.url}
                className="flex items-center gap-3 p-2.5 bg-[#1C1917] rounded-lg border border-white/[0.06]"
              >
                <div className="w-8 h-8 rounded-lg bg-[#2D2926] flex items-center justify-center shrink-0">
                  <FileIcon className="w-4 h-4 text-[#D4836A]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{attachment.name}</p>
                  <p className="text-xs text-[#78716C]">{formatFileSize(attachment.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeAttachment(index)}
                  className="p-1 hover:bg-white/[0.05] rounded text-[#78716C] hover:text-red-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Progress for Attachments */}
      {isUploadingAttachment && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 text-sm text-[#A8A29E]">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Uploading files...</span>
          </div>
        </div>
      )}

      {/* Poll Creator */}
      {showPoll && (
        <div className="px-4 pb-3">
          <div className="bg-[#1C1917] rounded-xl p-4 border border-white/[0.06]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm text-white font-medium">
                <BarChart2 className="w-4 h-4 text-[#D4836A]" />
                Create Poll
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPoll(false);
                  setPollQuestion("");
                  setPollOptions(["", ""]);
                  setPollEndsAt("");
                }}
                className="p-1 hover:bg-white/[0.05] rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-[#78716C]" />
              </button>
            </div>
            <input
              type="text"
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              placeholder="Ask a question..."
              className="w-full bg-[#2D2926] border border-white/[0.06] rounded-lg px-3 py-2 text-white placeholder-[#78716C] text-sm focus:outline-none focus:border-[#D4836A]/50 mb-3"
            />
            <div className="space-y-2">
              {pollOptions.map((option, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: pollOptions is a string[] with no stable id; entries are edited in place via controlled inputs and never reordered
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...pollOptions];
                      newOptions[index] = e.target.value;
                      setPollOptions(newOptions);
                    }}
                    placeholder={`Option ${index + 1}`}
                    className="flex-1 bg-[#2D2926] border border-white/[0.06] rounded-lg px-3 py-2 text-white placeholder-[#78716C] text-sm focus:outline-none focus:border-[#D4836A]/50"
                  />
                  {pollOptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== index))}
                      className="p-2 hover:bg-white/[0.05] rounded-lg text-[#78716C] hover:text-red-400 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {pollOptions.length < 4 && (
              <button
                type="button"
                onClick={() => setPollOptions([...pollOptions, ""])}
                className="flex items-center gap-1 mt-2 text-xs text-[#D4836A] hover:underline"
              >
                <Plus className="w-3 h-3" /> Add option
              </button>
            )}
            <div className="mt-3 pt-3 border-t border-white/[0.06]">
              <label
                htmlFor="poll-ends-at"
                className="flex items-center gap-2 text-xs text-[#78716C] mb-2"
              >
                <Clock className="w-3.5 h-3.5" /> Poll end date (optional)
              </label>
              <input
                id="poll-ends-at"
                type="datetime-local"
                value={pollEndsAt}
                onChange={(e) => setPollEndsAt(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full bg-[#2D2926] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#D4836A]/50 [color-scheme:dark]"
              />
            </div>
          </div>
        </div>
      )}

      {/* Bottom Toolbar */}
      <div className="px-3 sm:px-4 py-3 bg-[#1C1917]/50 border-t border-white/[0.06]">
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          {/* Left: Space selector */}
          <select
            value={selectedSpaceId}
            onChange={(e) => setSelectedSpaceId(e.target.value)}
            className="bg-[#1C1917] text-xs text-white rounded-lg px-2 sm:px-3 py-1.5 border border-white/[0.1] focus:outline-none focus:border-[#D4836A]/50 cursor-pointer max-w-[100px] sm:max-w-none truncate"
          >
            {spaces.map((space) => (
              <option key={space.id} value={space.id}>
                {space.name}
              </option>
            ))}
          </select>

          {/* Center: Action buttons */}
          <div className="flex items-center gap-0.5 sm:gap-1">
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
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => setShowTitle(!showTitle)}
              className={`p-2 rounded-lg transition-colors ${showTitle ? "text-[#D4836A] bg-[#D4836A]/10" : "text-[#78716C] hover:text-white hover:bg-white/[0.05]"}`}
              title="Add title"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={isUploadingMedia || !!mediaPreview}
              className="p-2 rounded-lg text-[#78716C] hover:text-white hover:bg-white/[0.05] transition-colors disabled:opacity-50"
              title="Add image"
            >
              {isUploadingMedia && mediaType === "image" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ImageIcon className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              disabled={isUploadingMedia || !!mediaPreview}
              className="p-2 rounded-lg text-[#78716C] hover:text-white hover:bg-white/[0.05] transition-colors disabled:opacity-50"
              title="Add video"
            >
              {isUploadingMedia && mediaType === "video" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Video className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowPoll(!showPoll)}
              className={`p-2 rounded-lg transition-colors ${showPoll ? "text-[#D4836A] bg-[#D4836A]/10" : "text-[#78716C] hover:text-white hover:bg-white/[0.05]"}`}
              title="Add poll"
            >
              <BarChart2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAttachment || attachments.length >= 5}
              className="p-2 rounded-lg text-[#78716C] hover:text-white hover:bg-white/[0.05] transition-colors disabled:opacity-50"
              title="Attach file"
            >
              {isUploadingAttachment ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Paperclip className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Right: Character count + Post button */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {content.length > 0 && (
              <span
                className={`text-xs hidden sm:inline ${remainingChars < 100 ? "text-[#D4836A]" : "text-[#78716C]"}`}
              >
                {remainingChars}
              </span>
            )}
            <button
              type="submit"
              disabled={
                !content.trim() || isSubmitting || isUploadingMedia || isUploadingAttachment
              }
              className="inline-flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2 rounded-lg bg-[#D4836A] text-white text-sm font-medium hover:bg-[#c4775f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isSubmitting ? "..." : "Post"}</span>
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
