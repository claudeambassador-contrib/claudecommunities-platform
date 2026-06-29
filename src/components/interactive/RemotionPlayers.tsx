"use client";

import { Player } from "@remotion/player";
import { lazy, Suspense } from "react";

const TerminalDemo = lazy(() =>
  import("@/remotion/TerminalDemo").then((m) => ({ default: m.TerminalDemo })),
);
const CoworkUIDemo = lazy(() =>
  import("@/remotion/CoworkUIDemo").then((m) => ({ default: m.CoworkUIDemo })),
);
const FileFlowDemo = lazy(() =>
  import("@/remotion/FileFlowDemo").then((m) => ({ default: m.FileFlowDemo })),
);
const TaskFlowDemo = lazy(() =>
  import("@/remotion/TaskFlowDemo").then((m) => ({ default: m.TaskFlowDemo })),
);

function VideoWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden border border-white/[0.06] my-8 bg-[#0D0D0D]">
      <Suspense
        fallback={
          <div className="aspect-video flex items-center justify-center bg-[#1C1917]">
            <div className="w-8 h-8 border-2 border-[#D4836A] border-t-transparent rounded-full animate-spin" />
          </div>
        }
      >
        {children}
      </Suspense>
    </div>
  );
}

export function TerminalDemoPlayer({
  commands,
}: {
  commands: Array<{ input: string; output: string; delay?: number }>;
}) {
  const framesPerCommand = 90;
  const totalFrames = commands.length * framesPerCommand + 30;

  return (
    <VideoWrapper>
      <Player
        component={TerminalDemo}
        inputProps={{ commands }}
        durationInFrames={totalFrames}
        compositionWidth={1920}
        compositionHeight={1080}
        fps={30}
        style={{ width: "100%", aspectRatio: "16/9" }}
        autoPlay
        loop
        controls
      />
    </VideoWrapper>
  );
}

export function CoworkUIDemoPlayer() {
  return (
    <VideoWrapper>
      <Player
        component={CoworkUIDemo}
        inputProps={{
          steps: [
            { label: "Switch to Cowork", description: "Click the Cowork tab" },
            { label: "Describe your task", description: "Type what you need done" },
            { label: "Review the plan", description: "Claude shows you what it will do" },
            { label: "Approve and run", description: "Click approve to start execution" },
          ],
        }}
        durationInFrames={180}
        compositionWidth={1920}
        compositionHeight={1080}
        fps={30}
        style={{ width: "100%", aspectRatio: "16/9" }}
        autoPlay
        loop
        controls
      />
    </VideoWrapper>
  );
}

export function FileFlowDemoPlayer() {
  return (
    <VideoWrapper>
      <Player
        component={FileFlowDemo}
        inputProps={{
          beforeFiles: [
            "report.pdf",
            "photo1.jpg",
            "budget.xlsx",
            "notes.docx",
            "receipt.pdf",
            "banner.png",
            "data.csv",
            "memo.docx",
            "chart.xlsx",
            "selfie.jpg",
            "invoice.pdf",
            "slides.pptx",
          ],
          afterFolders: [
            { name: "PDFs", files: ["report.pdf", "receipt.pdf", "invoice.pdf"] },
            { name: "Images", files: ["photo1.jpg", "banner.png", "selfie.jpg"] },
            { name: "Spreadsheets", files: ["budget.xlsx", "data.csv", "chart.xlsx"] },
            { name: "Documents", files: ["notes.docx", "memo.docx", "slides.pptx"] },
          ],
        }}
        durationInFrames={150}
        compositionWidth={1920}
        compositionHeight={1080}
        fps={30}
        style={{ width: "100%", aspectRatio: "16/9" }}
        autoPlay
        loop
        controls
      />
    </VideoWrapper>
  );
}

export function TaskFlowDemoPlayer({ taskName }: { taskName: string }) {
  return (
    <VideoWrapper>
      <Player
        component={TaskFlowDemo}
        inputProps={{ taskName }}
        durationInFrames={180}
        compositionWidth={1920}
        compositionHeight={1080}
        fps={30}
        style={{ width: "100%", aspectRatio: "16/9" }}
        autoPlay
        loop
        controls
      />
    </VideoWrapper>
  );
}
