"use client";

import Script from "next/script";

interface WistiaPlayerProps {
  mediaId: string;
  aspect?: number;
}

// Wistia ships a custom element <wistia-player>. TS doesn't know about it,
// so we cast the tag name to bypass IntrinsicElements checking.
const WistiaPlayerTag = "wistia-player" as unknown as React.FC<{
  "media-id": string;
  aspect?: string;
}>;

export default function WistiaPlayer({ mediaId, aspect = 16 / 9 }: WistiaPlayerProps) {
  const swatchUrl = `https://fast.wistia.com/embed/medias/${mediaId}/swatch`;
  const paddingTop = `${(1 / aspect) * 100}%`;

  return (
    <>
      <Script src="https://fast.wistia.com/player.js" strategy="afterInteractive" />
      <Script
        src={`https://fast.wistia.com/embed/${mediaId}.js`}
        strategy="afterInteractive"
        type="module"
      />
      <style>{`
        wistia-player[media-id='${mediaId}']:not(:defined) {
          background: #000 center / cover no-repeat url('${swatchUrl}');
          display: block;
          padding-top: ${paddingTop};
        }
      `}</style>
      <WistiaPlayerTag media-id={mediaId} aspect={String(aspect)} />
    </>
  );
}
