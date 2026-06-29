"use client";

import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";
import { SlideImage } from "@/components/slide-generator/SlideImage";
import { useTenantConfig } from "@/components/TenantConfigProvider";

const DEFAULT_LOGO = "/icons/favicon.png";

export default function QRCodeGenerator() {
  const config = useTenantConfig();
  const SITE_URL = config.siteUrl;
  const [inputText, setInputText] = useState(SITE_URL);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasQR, setHasQR] = useState(false);
  const [copied, setCopied] = useState(false);
  const [logoEnabled, setLogoEnabled] = useState(true);
  const [logoSrc, setLogoSrc] = useState(DEFAULT_LOGO);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const drawLogo = useCallback((canvas: HTMLCanvasElement, src: string) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const logoSize = canvas.width * 0.22;
      const x = (canvas.width - logoSize) / 2;
      const y = (canvas.height - logoSize) / 2;
      // White background behind logo for contrast
      const pad = 4;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x - pad, y - pad, logoSize + pad * 2, logoSize + pad * 2);
      ctx.drawImage(img, x, y, logoSize, logoSize);
    };
    img.src = src;
  }, []);

  const updateQRCode = useCallback(async () => {
    if (!canvasRef.current || !inputText) {
      setHasQR(false);
      return;
    }
    try {
      await QRCode.toCanvas(canvasRef.current, inputText, {
        width: 200,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
        errorCorrectionLevel: "H", // High correction to survive logo overlay
      });
      if (logoEnabled && logoSrc) {
        drawLogo(canvasRef.current, logoSrc);
      }
      setHasQR(true);
    } catch {
      setHasQR(false);
    }
  }, [inputText, logoEnabled, logoSrc, drawLogo]);

  useEffect(() => {
    const id = setTimeout(updateQRCode, 300);
    return () => clearTimeout(id);
  }, [updateQRCode]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.href = canvasRef.current.toDataURL("image/png");
    link.download = "qrcode.png";
    link.click();
  };

  const handleCopy = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) return;
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not supported or permission denied
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setLogoSrc(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="space-y-4">
        <div>
          <label htmlFor="qr-input" className="block text-sm font-medium text-[#A8A29E] mb-2">
            Enter URL or Text
          </label>
          <div className="relative">
            <input
              id="qr-input"
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Enter URL or text to generate QR code"
              className="w-full px-3 py-2 bg-[#1C1917] border border-white/[0.1] rounded-lg text-white placeholder-[#57534E] focus:outline-none focus:ring-2 focus:ring-[#7C6FCD] focus:border-transparent"
            />
            {inputText && (
              <button
                type="button"
                onClick={() => setInputText("")}
                className="absolute right-2 top-2 text-[#57534E] hover:text-[#A8A29E]"
              >
                &times;
              </button>
            )}
          </div>
        </div>

        {/* Logo option */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={logoEnabled}
              onChange={(e) => setLogoEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-white/[0.2] bg-[#1C1917] text-[#7C6FCD] focus:ring-[#7C6FCD] focus:ring-offset-0"
            />
            <span className="text-sm text-[#A8A29E]">Center logo</span>
          </label>
          {logoEnabled && (
            <div className="flex items-center gap-2">
              {logoSrc && (
                <SlideImage
                  src={logoSrc}
                  alt="Logo preview"
                  className="w-6 h-6 rounded object-contain bg-white"
                />
              )}
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="text-xs text-[#7C6FCD] hover:text-[#9B8FE6] transition-colors"
              >
                Change image
              </button>
              {logoSrc !== DEFAULT_LOGO && (
                <button
                  type="button"
                  onClick={() => setLogoSrc(DEFAULT_LOGO)}
                  className="text-xs text-[#57534E] hover:text-[#A8A29E] transition-colors"
                >
                  Reset
                </button>
              )}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col items-center space-y-4">
          <div className="bg-white p-4 rounded-lg min-h-[220px] min-w-[220px] flex items-center justify-center">
            {inputText ? (
              <canvas ref={canvasRef} />
            ) : (
              <p className="text-[#78716C] text-sm">Enter text to generate QR code</p>
            )}
          </div>

          {hasQR && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleDownload}
                className="px-6 py-2 bg-[#7C6FCD] hover:bg-[#6B5FBC] text-white rounded-lg transition-colors font-medium text-sm"
              >
                Download
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="px-6 py-2 bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/[0.1] rounded-lg transition-colors font-medium text-sm"
              >
                {copied ? "Copied!" : "Copy to Clipboard"}
              </button>
            </div>
          )}
        </div>

        <p className="text-xs text-[#57534E] text-center">
          Supports URLs, email addresses, phone numbers, and plain text. Generated client-side.
        </p>
      </div>
    </div>
  );
}
