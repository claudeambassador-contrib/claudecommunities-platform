"use client";

import { Image as ImageIcon, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { uploadFile } from "@/lib/upload-client";

interface ImageUploadProps {
  onImageSelect: (imageUrl: string | null) => void;
  currentImage?: string | null;
  folder?: string;
}

export default function ImageUpload({
  onImageSelect,
  currentImage,
  folder = "community/images",
}: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentImage || null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be less than 10MB");
      return;
    }

    setIsUploading(true);

    // Create local preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    try {
      const result = await uploadFile(file, { folder });
      setPreview(result.url);
      onImageSelect(result.url);
    } catch (error) {
      console.error("Failed to upload image:", error);
      setError(error instanceof Error ? error.message : "Failed to upload image");
      setPreview(null);
      onImageSelect(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    setError(null);
    onImageSelect(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {error && (
        <div className="mb-2 text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</div>
      )}

      {preview ? (
        <div className="relative rounded-xl overflow-hidden bg-black/20">
          <RemoteImage src={preview} alt="Preview" className="w-full max-h-[300px] object-cover" />
          {isUploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
          )}
          {!isUploading && (
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="flex items-center gap-2 px-3 py-2 text-sm text-[#78716C] hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors disabled:opacity-50"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Uploading...</span>
            </>
          ) : (
            <>
              <ImageIcon className="w-4 h-4" />
              <span>Add image</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
