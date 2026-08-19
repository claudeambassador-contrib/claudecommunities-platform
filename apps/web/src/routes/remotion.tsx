import { Player } from "@remotion/player";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { WebsiteTour } from "@/shared/ui/website-tour";

export const Route = createFileRoute("/remotion")({
  component: RemotionPage,
  head: () => ({ meta: [{ title: "Website Tour" }] }),
});

function RemotionPage(): ReactElement {
  return (
    <main className="stack min-h-dvh items-center bg-ink p-6">
      <h1 className="m-0 text-[28px] text-cream">Website tour</h1>
      <Player
        autoPlay
        component={WebsiteTour}
        compositionHeight={1080}
        compositionWidth={1920}
        controls
        durationInFrames={600}
        fps={30}
        loop
        style={{ borderRadius: 12, height: 540, width: 960 }}
      />
      <p className="muted m-0">20 seconds · 1920×1080 · 30fps</p>
      <Link className="btn" to="/">
        Back to directory
      </Link>
    </main>
  );
}
