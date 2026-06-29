import { Composition } from "remotion";
import { CoworkUIDemo } from "./CoworkUIDemo";
import { FileFlowDemo } from "./FileFlowDemo";
import { LessonIntro } from "./LessonIntro";
import { MyComposition } from "./MyComposition";
import { TaskFlowDemo } from "./TaskFlowDemo";
import { calculateTerminalDuration, TerminalDemo } from "./TerminalDemo";
import { WebsiteTour } from "./WebsiteTour";

/* ── Default props for previewing new compositions ────── */

const defaultTerminalCommands = [
  {
    input: "claude cowork start",
    output: "✓ Cowork session started\n→ Watching ~/Projects for changes\n→ Ready for tasks",
  },
  {
    input: 'claude cowork task "Organize my Downloads folder"',
    output:
      "→ Scanning ~/Downloads...\n→ Found 47 files across 6 types\n→ Planning organization...\nDone — moved 47 files into 6 folders ✓",
  },
  {
    input: "claude cowork status",
    output: "Session: active (12m)\nTasks completed: 3\nFiles modified: 52\n✓ All tasks successful",
  },
];

const defaultCoworkSteps = [
  { label: "Switch to Cowork", description: "Click the Cowork tab to enter autonomous mode" },
  { label: "Describe your task", description: "Type what you want Claude to do" },
  { label: "Watch it execute", description: "Claude plans, you approve, it delivers" },
];

const defaultBeforeFiles = [
  "report.pdf",
  "vacation.jpg",
  "budget.xlsx",
  "notes.docx",
  "screenshot.png",
  "invoice.pdf",
  "headshot.jpg",
  "data.csv",
  "presentation.pdf",
  "logo.svg",
  "contract.docx",
  "receipt.pdf",
];

const defaultAfterFolders = [
  { name: "Documents", files: ["report.pdf", "invoice.pdf", "presentation.pdf", "receipt.pdf"] },
  { name: "Images", files: ["vacation.jpg", "screenshot.png", "headshot.jpg", "logo.svg"] },
  { name: "Spreadsheets", files: ["budget.xlsx", "data.csv"] },
  { name: "Writing", files: ["notes.docx", "contract.docx"] },
];

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MyComposition"
        component={MyComposition}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="LessonIntro"
        component={LessonIntro}
        durationInFrames={120}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          lessonNumber: 1,
          lessonTitle: "What is Claude Co-work?",
          lessonDuration: "5 min",
          courseTitle: "Claude Cowork for Beginners",
        }}
      />
      <Composition
        id="TerminalDemo"
        component={TerminalDemo}
        durationInFrames={calculateTerminalDuration(defaultTerminalCommands)}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          commands: defaultTerminalCommands,
        }}
      />
      <Composition
        id="CoworkUIDemo"
        component={CoworkUIDemo}
        durationInFrames={180}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          steps: defaultCoworkSteps,
        }}
      />
      <Composition
        id="FileFlowDemo"
        component={FileFlowDemo}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          beforeFiles: defaultBeforeFiles,
          afterFolders: defaultAfterFolders,
        }}
      />
      <Composition
        id="TaskFlowDemo"
        component={TaskFlowDemo}
        durationInFrames={180}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          taskName: "Organize my Downloads folder by file type",
        }}
      />
      <Composition
        id="WebsiteTour"
        component={WebsiteTour}
        durationInFrames={600}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
