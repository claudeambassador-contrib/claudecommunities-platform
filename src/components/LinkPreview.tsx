"use client";

import { useEffect, useState } from "react";
import { RemoteImage } from "@/components/ui/RemoteImage";

interface LinkPreviewData {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  favicon: string | null;
}

// Client-side cache to prevent re-fetches on re-renders
const previewCache = new Map<string, LinkPreviewData | null>();

export default function LinkPreview({ url }: { url: string }) {
  const [data, setData] = useState<LinkPreviewData | null>(previewCache.get(url) ?? null);
  const [loading, setLoading] = useState(!previewCache.has(url));
  const [error, setError] = useState(false);

  useEffect(() => {
    if (previewCache.has(url)) {
      const cached = previewCache.get(url);
      if (!cached) setError(true);
      return;
    }

    let cancelled = false;

    fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then((res) => {
        if (res.status === 204 || !res.ok) {
          previewCache.set(url, null);
          if (!cancelled) setError(true);
          return null;
        }
        return res.json();
      })
      .then((result) => {
        if (cancelled) return;
        if (result) {
          previewCache.set(url, result);
          setData(result);
        }
      })
      .catch(() => {
        previewCache.set(url, null);
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (error || (!loading && !data)) return null;

  if (loading) {
    return (
      <div className="mt-3 flex gap-3 p-3 bg-[#1C1917] rounded-xl border border-white/[0.06] animate-pulse">
        <div className="w-24 h-24 bg-white/[0.06] rounded-lg shrink-0" />
        <div className="flex-1 space-y-2 py-1">
          <div className="h-3 bg-white/[0.06] rounded w-1/3" />
          <div className="h-4 bg-white/[0.06] rounded w-3/4" />
          <div className="h-3 bg-white/[0.06] rounded w-full" />
        </div>
      </div>
    );
  }

  const domain = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  })();

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="mt-3 flex gap-3 p-3 bg-[#1C1917] rounded-xl border border-white/[0.06] hover:border-[#D4836A]/20 transition-colors group/preview cursor-pointer no-underline block"
    >
      {data?.image && (
        <div className="w-24 h-24 rounded-lg overflow-hidden shrink-0 bg-black/20">
          <RemoteImage
            src={data?.image}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}
      <div className="flex-1 min-w-0 py-0.5">
        <div className="flex items-center gap-1.5 mb-1">
          {data?.favicon && (
            <RemoteImage
              src={data?.favicon}
              alt=""
              className="w-4 h-4 rounded"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <span className="text-xs text-[#78716C] truncate">{data?.siteName || domain}</span>
        </div>
        {data?.title && (
          <p className="text-sm font-medium text-white group-hover/preview:text-[#D4836A] transition-colors line-clamp-2 leading-snug">
            {data?.title}
          </p>
        )}
        {data?.description && (
          <p className="text-xs text-[#A8A29E] line-clamp-2 mt-1 leading-relaxed">
            {data?.description}
          </p>
        )}
      </div>
    </a>
  );
}
