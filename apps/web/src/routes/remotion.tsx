import { Player } from "@remotion/player";
import { createFileRoute, Link } from "@tanstack/react-router";
import { WebsiteTour } from "@/modules/remotion/website-tour";

export const Route = createFileRoute("/remotion")({
  component: RemotionPage,
  head: () => ({ meta: [{ title: "Website Tour" }] }),
});

function RemotionPage() {
  return (
    <main
      className="stack"
      style={{
        alignItems: "center",
        background: "#1C1917",
        minHeight: "100dvh",
        padding: 24,
      }}
    >
      <h1 style={{ color: "#FAF9F6", fontSize: 28, margin: 0 }}>Website tour</h1>
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
      <p style={{ color: "#A8A29E", margin: 0 }}>20 seconds · 1920×1080 · 30fps</p>
      <Link className="btn" to="/">
        Back to directory
      </Link>
    </main>
  );
}
