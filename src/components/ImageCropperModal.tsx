"use client";

import { Loader2, X, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

interface ImageCropperModalProps {
  file: File;
  aspect: number;
  /** Output longest-edge size in pixels. */
  outputSize: number;
  /** Cropper shape: 'round' shows a circular preview, 'rect' a rectangular one. */
  cropShape?: "round" | "rect";
  title?: string;
  onCancel: () => void;
  onConfirm: (file: File) => void | Promise<void>;
}

export default function ImageCropperModal({
  file,
  aspect,
  outputSize,
  cropShape = "rect",
  title = "Crop image",
  onCancel,
  onConfirm,
}: ImageCropperModalProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setIsProcessing(true);
    try {
      const cropped = await getCroppedFile(imageSrc, croppedAreaPixels, outputSize, file);
      await onConfirm(cropped);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl bg-[#1C1917] border border-white/[0.08] rounded-xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
          <h3 className="text-white font-medium">{title}</h3>
          <button
            type="button"
            onClick={onCancel}
            className="text-[#A8A29E] hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative bg-black h-[60vh] max-h-[480px]">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              cropShape={cropShape}
              showGrid={cropShape === "rect"}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              restrictPosition
            />
          )}
        </div>

        <div className="px-5 py-4 space-y-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-3">
            <ZoomOut className="w-4 h-4 text-[#A8A29E]" />
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-[#D4836A]"
              aria-label="Zoom"
            />
            <ZoomIn className="w-4 h-4 text-[#A8A29E]" />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isProcessing}
              className="px-4 py-2 rounded-lg text-[#A8A29E] hover:text-white hover:bg-white/[0.04] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isProcessing || !croppedAreaPixels}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#D4836A] text-white font-medium hover:bg-[#c4775f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
              {isProcessing ? "Processing…" : "Apply"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

async function getCroppedFile(
  _imageSrc: string,
  area: Area,
  outputSize: number,
  sourceFile: File,
): Promise<File> {
  const bitmap = await createImageBitmap(sourceFile);

  const aspect = area.width / area.height;
  let outW: number;
  let outH: number;
  if (aspect >= 1) {
    outW = Math.min(Math.round(area.width), outputSize);
    outH = Math.round(outW / aspect);
  } else {
    outH = Math.min(Math.round(area.height), outputSize);
    outW = Math.round(outH * aspect);
  }

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Canvas not supported");
  }

  ctx.drawImage(
    bitmap,
    Math.max(0, Math.round(area.x)),
    Math.max(0, Math.round(area.y)),
    Math.round(area.width),
    Math.round(area.height),
    0,
    0,
    outW,
    outH,
  );
  bitmap.close();

  const outputType = ["image/jpeg", "image/png", "image/webp"].includes(sourceFile.type)
    ? sourceFile.type
    : "image/jpeg";

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, outputType, 0.92),
  );
  if (!blob) throw new Error("Failed to encode cropped image");

  const ext = outputType.split("/")[1];
  const baseName = sourceFile.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${baseName}.${ext}`, {
    type: outputType,
    lastModified: Date.now(),
  });
}
