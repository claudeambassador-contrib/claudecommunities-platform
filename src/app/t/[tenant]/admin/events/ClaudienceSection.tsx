"use client";

import { Check, Copy, Download, ExternalLink, KeyRound, Loader2, QrCode } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";

const QR_LOGO = "/icons/favicon.png";

interface ClaudienceEvent {
  id: string;
  claudienceSessionCode?: string | null;
  claudienceSessionPassword?: string | null;
  claudienceSessionUrl?: string | null;
  claudienceSurveyId?: string | null;
  claudienceSurveyUrl?: string | null;
  claudienceNotificationEmail?: string | null;
}

interface Props {
  event: ClaudienceEvent;
  onProvisioned: (patch: Partial<ClaudienceEvent> & { feedbackUrl?: string | null }) => void;
}

export default function ClaudienceSection({ event, onProvisioned }: Props) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState(event.claudienceNotificationEmail || "");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailSavedAt, setEmailSavedAt] = useState<number | null>(null);

  useEffect(() => {
    setEmailDraft(event.claudienceNotificationEmail || "");
  }, [event.claudienceNotificationEmail]);

  const create = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/${event.id}/claudience`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationEmail: emailDraft.trim() || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        sessionCode: string;
        sessionPassword: string;
        sessionUrl: string;
        surveyId: string;
        surveyUrl: string;
        feedbackUrl?: string;
        notificationEmail?: string | null;
      };
      onProvisioned({
        claudienceSessionCode: data.sessionCode,
        claudienceSessionPassword: data.sessionPassword,
        claudienceSessionUrl: data.sessionUrl,
        claudienceSurveyId: data.surveyId,
        claudienceSurveyUrl: data.surveyUrl,
        claudienceNotificationEmail: data.notificationEmail ?? null,
        feedbackUrl: data.feedbackUrl,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  const saveEmail = async () => {
    setEmailSaving(true);
    setError(null);
    try {
      const next = emailDraft.trim();
      const res = await fetch(`/api/admin/events/${event.id}/claudience`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationEmail: next || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { notificationEmail: string | null };
      onProvisioned({ claudienceNotificationEmail: data.notificationEmail });
      setEmailSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setEmailSaving(false);
    }
  };

  const provisioned = !!event.claudienceSessionCode;
  const emailDirty = (emailDraft.trim() || null) !== (event.claudienceNotificationEmail || null);
  const showSaved = !emailDirty && emailSavedAt && Date.now() - emailSavedAt < 2000;

  return (
    <div className="p-4 border-t border-[#333] space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-white font-medium text-sm">Claudience (live session + feedback)</h4>
        {!provisioned && (
          <button
            type="button"
            onClick={create}
            disabled={creating}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg flex items-center gap-1.5 disabled:opacity-50"
          >
            {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Create session + survey
          </button>
        )}
      </div>

      {error && (
        <div className="text-xs bg-red-500/10 border border-red-500/30 text-red-300 rounded-lg p-2">
          {error}
        </div>
      )}

      {!provisioned ? (
        <>
          <p className="text-xs text-gray-500">
            Provisions a Claudience session and the standard post-event feedback survey. The session
            passcode is generated and stored here so you can access the admin view later.
          </p>
          <div>
            <label
              htmlFor="claudience-notif-email-new"
              className="block text-xs text-gray-400 mb-1"
            >
              Notification email (optional) — where survey results get sent
            </label>
            <input
              id="claudience-notif-email-new"
              type="email"
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg p-2 text-sm text-white"
            />
          </div>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <ClaudienceLinkCard
            title="Live session"
            url={event.claudienceSessionUrl || ""}
            subline={`Code: ${event.claudienceSessionCode}`}
          />
          <ClaudienceLinkCard title="Feedback survey" url={event.claudienceSurveyUrl || ""} />
          <div className="col-span-2 bg-[#2a2a2a] border border-[#444] rounded-lg p-3 flex items-center gap-3">
            <span className="text-xs text-gray-400 shrink-0">Admin passcode</span>
            <code className="font-mono text-sm text-white flex-1">
              {event.claudienceSessionPassword || "—"}
            </code>
            {event.claudienceSessionPassword && event.claudienceSessionUrl && (
              <a
                href={`${event.claudienceSessionUrl.replace("/s/", "/admin/")}#passcode=${encodeURIComponent(event.claudienceSessionPassword)}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Opens the Claudience admin and signs in automatically. Treat this link like the passcode itself."
                className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs rounded flex items-center gap-1"
              >
                <KeyRound className="w-3 h-3" /> Open admin
              </a>
            )}
            {event.claudienceSessionPassword && (
              <CopyButton text={event.claudienceSessionPassword} />
            )}
          </div>
          <div className="col-span-2 bg-[#2a2a2a] border border-[#444] rounded-lg p-3 flex items-center gap-3">
            <label htmlFor="claudience-notif-email" className="text-xs text-gray-400 shrink-0">
              Results email
            </label>
            <input
              id="claudience-notif-email"
              type="email"
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              placeholder="you@example.com"
              className="flex-1 bg-[#1f1f1f] border border-[#444] rounded p-1.5 text-sm text-white"
            />
            <button
              type="button"
              onClick={saveEmail}
              disabled={emailSaving || !emailDirty}
              className="px-3 py-1.5 bg-[#444] hover:bg-[#555] text-white text-sm rounded-lg disabled:opacity-50 flex items-center gap-1.5"
            >
              {emailSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {showSaved ? <Check className="w-3.5 h-3.5" /> : null}
              {showSaved ? "Saved" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ClaudienceLinkCard({
  title,
  url,
  subline,
}: {
  title: string;
  url: string;
  subline?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasQR, setHasQR] = useState(false);
  const [imgCopied, setImgCopied] = useState(false);

  useEffect(() => {
    if (!url || !canvasRef.current) {
      setHasQR(false);
      return;
    }
    let cancelled = false;
    const canvas = canvasRef.current;
    (async () => {
      try {
        await QRCode.toCanvas(canvas, url, {
          width: 160,
          margin: 2,
          color: { dark: "#000000", light: "#ffffff" },
          errorCorrectionLevel: "H",
        });
        if (cancelled) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          if (cancelled) return;
          const logoSize = canvas.width * 0.22;
          const x = (canvas.width - logoSize) / 2;
          const y = (canvas.height - logoSize) / 2;
          const pad = 4;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(x - pad, y - pad, logoSize + pad * 2, logoSize + pad * 2);
          ctx.drawImage(img, x, y, logoSize, logoSize);
          setHasQR(true);
        };
        img.src = QR_LOGO;
      } catch (err) {
        console.error("QR generation failed:", err);
        setHasQR(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  const downloadImage = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.href = canvasRef.current.toDataURL("image/png");
    link.download = `${title.toLowerCase().replace(/\s+/g, "-")}-qr.png`;
    link.click();
  };

  const copyImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) return;
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setImgCopied(true);
      setTimeout(() => setImgCopied(false), 1500);
    } catch (err) {
      console.error("Failed to copy QR image:", err);
    }
  };

  return (
    <div className="bg-[#2a2a2a] border border-[#444] rounded-lg p-3 flex flex-col items-center gap-2">
      <div className="w-full flex items-center justify-between">
        <span className="text-xs text-gray-400">{title}</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[#E07A5F] hover:underline flex items-center gap-1"
        >
          <ExternalLink className="w-3 h-3" /> Open
        </a>
      </div>
      <div className="bg-white rounded-lg p-2 flex items-center justify-center min-w-[180px] min-h-[180px]">
        {url ? <canvas ref={canvasRef} /> : <QrCode className="w-8 h-8 text-gray-400" />}
      </div>
      {hasQR && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={copyImage}
            className="px-2 py-1 bg-[#333] hover:bg-[#444] text-white text-xs rounded flex items-center gap-1"
            aria-label="Copy QR image"
          >
            {imgCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {imgCopied ? "Copied" : "Copy image"}
          </button>
          <button
            type="button"
            onClick={downloadImage}
            className="px-2 py-1 bg-[#333] hover:bg-[#444] text-white text-xs rounded flex items-center gap-1"
            aria-label="Download QR image"
          >
            <Download className="w-3 h-3" /> Save
          </button>
        </div>
      )}
      <div className="w-full">
        {subline && <div className="text-xs text-gray-500 truncate">{subline}</div>}
        <div className="flex items-center gap-1">
          <code className="text-[10px] text-gray-400 truncate flex-1">{url}</code>
          <CopyButton text={url} />
        </div>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="p-1 text-gray-400 hover:text-white"
      aria-label="Copy"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}
