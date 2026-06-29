import {
  useApp,
  useHostStyles,
} from "@modelcontextprotocol/ext-apps/react";
import { useEffect, useState } from "react";
import { SpeakerManager } from "./views/SpeakerManager";
import { SlidesPreview } from "./views/SlidesPreview";

type ViewState =
  | { kind: "loading" }
  | { kind: "speakers"; eventId: string; bearerToken?: string; origin?: string }
  | { kind: "slides"; eventId: string }
  | { kind: "empty" };

export function App() {
  const [view, setView] = useState<ViewState>({ kind: "loading" });

  const { app } = useApp({
    appInfo: { name: "Claude Community MCP", version: "0.1.0" },
    capabilities: {},
  });

  useHostStyles(app);

  useEffect(() => {
    if (!app) return;

    // ontoolinput fires while the tool is in flight — we use it to clear
    // stale state, but bearerToken / origin only land on the result _meta.
    app.ontoolinput = () => {
      setView({ kind: "loading" });
    };

    app.ontoolresult = (result) => {
      const sc = result.structuredContent as Record<string, unknown> | undefined;
      const meta = result._meta as Record<string, unknown> | undefined;
      if (!sc) return;
      const v = sc.view as string | undefined;
      const eventId = sc.eventId as string | undefined;
      if (v === "speakers" && eventId) {
        setView({
          kind: "speakers",
          eventId,
          bearerToken: meta?.bearerToken as string | undefined,
          origin: meta?.origin as string | undefined,
        });
      } else if (v === "slides" && eventId) {
        setView({ kind: "slides", eventId });
      }
    };
  }, [app]);

  if (!app || view.kind === "loading") {
    return (
      <div className="flex h-full items-center justify-center text-claude-cream/60">
        Loading…
      </div>
    );
  }

  if (view.kind === "speakers") {
    return (
      <SpeakerManager
        app={app}
        eventId={view.eventId}
        bearerToken={view.bearerToken}
        origin={view.origin}
      />
    );
  }

  if (view.kind === "slides") {
    return <SlidesPreview app={app} eventId={view.eventId} />;
  }

  return (
    <div className="flex h-full items-center justify-center text-center text-claude-cream/60">
      <div>
        <p className="text-lg font-medium">Claude Community MCP</p>
        <p className="mt-2 text-sm">
          Call <code className="rounded bg-white/10 px-1">openSpeakerManager</code> or{" "}
          <code className="rounded bg-white/10 px-1">openSlidesPreview</code>.
        </p>
      </div>
    </div>
  );
}
