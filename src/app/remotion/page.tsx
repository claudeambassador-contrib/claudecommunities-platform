"use client";

import { Player } from "@remotion/player";
import { WebsiteTour } from "@/remotion/WebsiteTour";

export default function RemotionPage() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        gap: 24,
        padding: 24,
        backgroundColor: "#1C1917",
      }}
    >
      <h1
        style={{
          color: "#FAF9F6",
          fontSize: 28,
          fontWeight: 700,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        Website Tour
      </h1>
      <Player
        component={WebsiteTour}
        compositionWidth={1920}
        compositionHeight={1080}
        durationInFrames={600}
        fps={30}
        style={{ width: 960, height: 540, borderRadius: 12 }}
        controls
        autoPlay
        loop
      />
      <p
        style={{
          color: "#A8A29E",
          fontSize: 14,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        20 seconds &bull; 1920&times;1080 &bull; 30fps
      </p>
    </div>
  );
}
