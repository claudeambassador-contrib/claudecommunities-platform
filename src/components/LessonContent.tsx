"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

const SessionTimeline = dynamic(() => import("@/components/interactive/SessionTimeline"), {
  ssr: false,
});
const TypewriterDemo = dynamic(() => import("@/components/interactive/TypewriterDemo"), {
  ssr: false,
});
const KnowledgeCheck = dynamic(() => import("@/components/interactive/KnowledgeCheck"), {
  ssr: false,
});
const InteractiveChecklist = dynamic(
  () => import("@/components/interactive/InteractiveChecklist"),
  { ssr: false },
);
const AnimatedDiagram = dynamic(() => import("@/components/interactive/AnimatedDiagram"), {
  ssr: false,
});
const LessonIntroPlayer = dynamic(() => import("@/components/interactive/LessonIntroPlayer"), {
  ssr: false,
});
const ThreeJSHero = dynamic(() => import("@/components/interactive/ThreeJSHero"), { ssr: false });
const FloatingFiles3D = dynamic(() => import("@/components/interactive/FloatingFiles3D"), {
  ssr: false,
});
const NetworkGraph3D = dynamic(() => import("@/components/interactive/NetworkGraph3D"), {
  ssr: false,
});
// Lazy import the individual players
const TerminalDemoPlayer = dynamic(
  () =>
    import("@/components/interactive/RemotionPlayers").then((m) => ({
      default: m.TerminalDemoPlayer,
    })),
  { ssr: false },
);
const CoworkUIDemoPlayer = dynamic(
  () =>
    import("@/components/interactive/RemotionPlayers").then((m) => ({
      default: m.CoworkUIDemoPlayer,
    })),
  { ssr: false },
);
const FileFlowDemoPlayer = dynamic(
  () =>
    import("@/components/interactive/RemotionPlayers").then((m) => ({
      default: m.FileFlowDemoPlayer,
    })),
  { ssr: false },
);
const TaskFlowDemoPlayer = dynamic(
  () =>
    import("@/components/interactive/RemotionPlayers").then((m) => ({
      default: m.TaskFlowDemoPlayer,
    })),
  { ssr: false },
);

interface LessonContentProps {
  content: string;
  lessonNumber?: number;
  lessonTitle?: string;
  lessonDuration?: string;
  courseTitle?: string;
}

// Interactive block data keyed by component name
const INTERACTIVE_DATA: Record<string, Record<string, unknown>> = {
  "session-timeline": {},
  "cowork-diagram": {},
  "prep-checklist": {
    items: [
      { text: "Install Claude Code CLI", tip: "Run: npm install -g @anthropic-ai/claude-code" },
      {
        text: "Set up your API key or subscription",
        tip: "You can use Claude Max, Claude Pro, or your own API key",
      },
      {
        text: "Have a project or idea ready",
        tip: "Even a small bug fix or feature idea works great",
      },
      { text: "Test your setup works", tip: "Run 'claude' in your terminal to verify" },
      { text: "Join the community Discord/Slack", tip: "Links are in the community sidebar" },
      {
        text: "Block out the full session time",
        tip: "Typically 70 minutes — avoid scheduling conflicts",
      },
    ],
  },
  "claude-conversation-demo": {
    conversation: [
      {
        role: "user" as const,
        text: "Hey Claude, I'm at a co-work session and want to add dark mode to my React app. Where should I start?",
      },
      {
        role: "claude" as const,
        text: "Great project for a co-work session! Let me look at your codebase...\n\nI can see you're using Tailwind CSS — perfect. Here's my plan:\n1. Add a ThemeProvider with React context\n2. Add a toggle component\n3. Update your tailwind.config to use 'class' strategy\n\nShall I start with the ThemeProvider?",
      },
      { role: "user" as const, text: "Yes! Let's do it." },
      {
        role: "claude" as const,
        text: "Done! I've created `src/context/ThemeProvider.tsx` with localStorage persistence, added a `ThemeToggle` button component, and updated your layout to wrap everything in the provider. Try toggling it — your Tailwind dark: classes will now work everywhere.",
      },
    ],
  },
  "session-quiz": {
    questions: [
      {
        question: "What's the recommended first step when joining a Claude Co-work session?",
        options: [
          "Immediately start coding",
          "Share your goal for the session during check-in",
          "Wait until someone tells you what to do",
          "Open Claude and start a new conversation",
        ],
        correctIndex: 1,
        explanation:
          "The check-in phase is where everyone shares their goals. This helps facilitators pair people up and ensures you get the most from the session.",
      },
      {
        question: "How long is the typical 'Deep Work' phase in a co-work session?",
        options: ["15 minutes", "30 minutes", "45 minutes", "60 minutes"],
        correctIndex: 2,
        explanation:
          "The deep work phase is 45 minutes — the longest segment. This is where the real magic happens with focused coding alongside Claude.",
      },
      {
        question: "What should you do if you get stuck during a co-work session?",
        options: [
          "Give up and switch to a different project",
          "Ask in the session chat or raise your hand for help",
          "Silently struggle through it alone",
          "Leave the session early",
        ],
        correctIndex: 1,
        explanation:
          "Co-work sessions are collaborative! Facilitators and other members are there to help. Asking for help often leads to the best breakthroughs.",
      },
      {
        question: "What happens during 'Show & Tell' at the end of a session?",
        options: [
          "A formal code review of everyone's work",
          "Participants voluntarily share what they built or learned",
          "A test to see who accomplished the most",
          "The facilitator gives a lecture",
        ],
        correctIndex: 1,
        explanation:
          "Show & Tell is a casual, voluntary sharing time. It's a great way to get feedback, inspire others, and celebrate everyone's progress.",
      },
    ],
  },
  "tips-conversation-demo": {
    conversation: [
      {
        role: "user" as const,
        text: "I have a bug where my API endpoint returns 500 sometimes. Here's the error log...",
      },
      {
        role: "claude" as const,
        text: "I can see the issue — your database connection pool is exhausting under concurrent requests. Let me look at your connection setup...",
      },
      {
        role: "user" as const,
        text: "Actually, can you also check if there's a race condition in the auth middleware?",
      },
      {
        role: "claude" as const,
        text: "Good instinct! Yes, there are actually two issues:\n\n1. **Connection pool**: Your pool max is set to 5 but you're getting 20+ concurrent requests. I'll increase it to 20 and add proper connection release.\n\n2. **Race condition**: Your `verifyToken()` call isn't awaited properly in the middleware chain. When two requests hit simultaneously, the second one proceeds without auth.\n\nLet me fix both. The connection pool fix is in `src/lib/db.ts` and the race condition fix is in `src/middleware.ts`.",
      },
    ],
  },
  "post-session-checklist": {
    items: [
      {
        text: "Commit and push your work",
        tip: "Even work-in-progress — create a branch if needed",
      },
      {
        text: "Write a brief summary of what you accomplished",
        tip: "Post it in the community feed to help others learn",
      },
      {
        text: "Note any questions that came up",
        tip: "Great topics for your next session or community post",
      },
      {
        text: "Thank anyone who helped you",
        tip: "A quick message goes a long way in building community",
      },
      {
        text: "Plan your next session goal",
        tip: "Having a goal ready means you can hit the ground running",
      },
    ],
  },
  // Remotion video demos
  "terminal-setup": {
    commands: [
      { input: "claude", output: "Welcome to Claude Desktop\nOpening authentication..." },
      {
        input: "# Switch to Cowork mode in the app",
        output: "✓ Cowork mode activated\n  Ready to work with your files",
      },
      {
        input: "Organise my Downloads folder by file type",
        output:
          "Planning...\n  → Found 23 files in Downloads\n  → Creating folders: Documents, Images, Spreadsheets\n  → Moving files...\n✓ 23 files organized into 3 folders",
      },
    ],
  },
  "terminal-files": {
    commands: [
      {
        input: "Process all receipts in my Expenses folder",
        output: "Scanning folder...\n  → Found 8 receipt images",
      },
      {
        input: "# Claude reads each receipt image",
        output:
          "  → Extracting: date, vendor, amount, category\n  → Processing receipt 1/8... Woolworths $47.20\n  → Processing receipt 2/8... Uber $23.50\n  → Processing receipt 3/8... Officeworks $189.00\n  ...\n✓ All 8 receipts processed",
      },
      {
        input: "Create an expense spreadsheet with totals",
        output:
          "Creating expenses.xlsx...\n  → Added 8 line items\n  → Formulas: SUM, category totals\n  → Conditional formatting applied\n✓ Saved to Documents/expenses.xlsx",
      },
    ],
  },
  "terminal-research": {
    commands: [
      {
        input: "Research project management tools for small teams in Australia",
        output:
          "Searching web sources...\n  → Comparing: Monday.com, Asana, ClickUp, Linear, Notion",
      },
      {
        input: "# Claude gathers pricing and features",
        output:
          "  → Pricing data collected for all 5 tools\n  → Feature comparison matrix built\n  → Australian-specific notes added",
      },
      {
        input: "Create a comparison spreadsheet and summary report",
        output:
          "Creating comparison.xlsx...\n  → Tab 1: Feature matrix\n  → Tab 2: Pricing comparison\n  → Tab 3: Recommendation\nCreating summary.pdf...\n  → Executive summary with top pick\n✓ Both files saved to Documents/",
      },
    ],
  },
  "terminal-project": {
    commands: [
      {
        input: "Create a project called 'Q1 Reporting'",
        output: "✓ Project created: Q1 Reporting\n  Add folders and instructions to get started",
      },
      {
        input: "# Add project instructions",
        output:
          "Instructions saved:\n  → Company: Smith Design Co\n  → Date format: DD/MM/YYYY\n  → Currency: AUD\n  → Template: quarterly-template.docx",
      },
      {
        input: "Generate this quarter's report from the sales data",
        output:
          "Using project context...\n  → Reading sales-q1.csv (342 rows)\n  → Applying quarterly-template.docx\n  → Generating charts: revenue, growth, segments\n  → Writing executive summary\n✓ Q1-Report-2026.pdf saved to project folder",
      },
    ],
  },
  // Cowork UI demo
  "cowork-ui": {},
  // File flow demo
  "file-flow": {},
  // Task flow demo
  "task-flow": { taskName: "Organize my Downloads folder" },
  "task-flow-research": { taskName: "Research and compare PM tools" },
  // Three.js components
  "threejs-hero-cowork": { title: "Claude Cowork", subtitle: "Your AI desktop assistant" },
  "threejs-hero-files": { title: "File Management", subtitle: "Organize, create, and process" },
  "threejs-hero-research": { title: "Research & Analysis", subtitle: "From data to insights" },
  "floating-files": {
    files: [
      { name: "report.pdf", type: "pdf" },
      { name: "photo.jpg", type: "jpg" },
      { name: "budget.xlsx", type: "xlsx" },
      { name: "notes.doc", type: "doc" },
      { name: "receipt.pdf", type: "pdf" },
      { name: "banner.jpg", type: "jpg" },
      { name: "data.xlsx", type: "xlsx" },
      { name: "memo.doc", type: "doc" },
    ],
  },
  "network-graph": {},
};

export default function LessonContent({
  content,
  lessonNumber,
  lessonTitle,
  lessonDuration,
  courseTitle,
}: LessonContentProps) {
  // Split content by interactive markers: {{component:name}}
  const segments = useMemo(() => {
    const parts = content.split(/(\{\{component:[a-z-]+\}\})/g);
    return parts.map((part, index) => {
      const match = part.match(/^\{\{component:([a-z-]+)\}\}$/);
      if (match) {
        return { type: "interactive" as const, name: match[1], key: index };
      }
      return { type: "text" as const, content: part, key: index };
    });
  }, [content]);

  const parseContent = (text: string) => {
    let html = text;

    // Headers
    html = html.replace(
      /^### (.+)$/gm,
      '<h3 class="text-lg font-semibold text-white mt-6 mb-3">$1</h3>',
    );
    html = html.replace(
      /^## (.+)$/gm,
      '<h2 class="text-xl font-semibold text-white mt-8 mb-4">$1</h2>',
    );
    html = html.replace(
      /^# (.+)$/gm,
      '<h1 class="text-2xl font-bold text-white mt-8 mb-4">$1</h1>',
    );

    // Code blocks
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, _lang, code) => {
      return `<pre class="bg-[#1C1917] rounded-lg p-4 overflow-x-auto my-4"><code class="text-sm text-[#E7E5E4] font-mono">${escapeHtml(code.trim())}</code></pre>`;
    });

    // Inline code
    html = html.replace(
      /`([^`]+)`/g,
      '<code class="bg-white/10 px-1.5 py-0.5 rounded text-sm font-mono text-[#D4836A]">$1</code>',
    );

    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-white">$1</strong>');

    // Italic
    html = html.replace(/_([^_]+)_/g, '<em class="italic">$1</em>');

    // @mentions
    html = html.replace(
      /@(\w+(?:\s[A-Z]\w*)?)/g,
      '<span class="text-[#D4836A] font-medium">@$1</span>',
    );

    // Links
    html = html.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-[#D4836A] hover:underline">$1</a>',
    );

    // Bare URLs
    html = html.replace(
      /(?<!href="|">)(https?:\/\/[^\s<>"')\]]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-[#D4836A] hover:underline break-all">$1</a>',
    );

    // Blockquotes
    html = html.replace(
      /^> (.+)$/gm,
      '<blockquote class="border-l-2 border-[#D4836A] pl-4 text-[#A8A29E] italic my-4">$1</blockquote>',
    );

    // Unordered lists
    html = html.replace(/^- (.+)$/gm, '<li class="ml-4 text-[#E7E5E4]">$1</li>');
    html = html.replace(
      /(<li[^>]*>.*<\/li>\n?)+/g,
      '<ul class="list-disc list-inside space-y-2 my-4">$&</ul>',
    );

    // Numbered lists
    html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 text-[#E7E5E4]">$1</li>');

    // Paragraphs
    html = html.replace(
      /^(?!<[hpuolb]|$)(.+)$/gm,
      '<p class="text-[#E7E5E4] leading-relaxed my-4">$1</p>',
    );

    // Clean up empty paragraphs
    html = html.replace(/<p[^>]*>\s*<\/p>/g, "");

    return html;
  };

  const escapeHtml = (text: string) => {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const renderInteractive = (name: string) => {
    const data = INTERACTIVE_DATA[name] || {};

    switch (name) {
      case "session-timeline":
        return <SessionTimeline />;
      case "cowork-diagram":
        return <AnimatedDiagram />;
      case "prep-checklist":
        return <InteractiveChecklist items={data.items as Array<{ text: string; tip: string }>} />;
      case "post-session-checklist":
        return <InteractiveChecklist items={data.items as Array<{ text: string; tip: string }>} />;
      case "claude-conversation-demo":
      case "tips-conversation-demo":
        return (
          <TypewriterDemo
            conversation={data.conversation as Array<{ role: "user" | "claude"; text: string }>}
          />
        );
      case "session-quiz":
        return (
          <KnowledgeCheck
            questions={
              data.questions as Array<{
                question: string;
                options: string[];
                correctIndex: number;
                explanation: string;
              }>
            }
          />
        );
      case "lesson-intro":
        if (lessonNumber && lessonTitle) {
          return (
            <LessonIntroPlayer
              lessonNumber={lessonNumber}
              lessonTitle={lessonTitle}
              lessonDuration={lessonDuration || ""}
              courseTitle={courseTitle || ""}
            />
          );
        }
        return null;
      // Remotion video demos
      case "terminal-setup":
      case "terminal-files":
      case "terminal-research":
      case "terminal-project":
        return (
          <TerminalDemoPlayer
            commands={data.commands as Array<{ input: string; output: string; delay?: number }>}
          />
        );
      case "cowork-ui":
        return <CoworkUIDemoPlayer />;
      case "file-flow":
        return <FileFlowDemoPlayer />;
      case "task-flow":
      case "task-flow-research":
        return <TaskFlowDemoPlayer taskName={(data.taskName as string) || "Complete task"} />;
      // Three.js 3D components
      case "threejs-hero-cowork":
      case "threejs-hero-files":
      case "threejs-hero-research":
        return <ThreeJSHero title={data.title as string} subtitle={data.subtitle as string} />;
      case "floating-files":
        return (
          <FloatingFiles3D
            files={data.files as Array<{ name: string; type: "pdf" | "xlsx" | "jpg" | "doc" }>}
          />
        );
      case "network-graph":
        return <NetworkGraph3D />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-0">
      {segments.map((segment) => {
        if (segment.type === "interactive") {
          const component = renderInteractive(segment.name);
          if (!component) return null;
          return (
            <div key={segment.key} className="my-8">
              {component}
            </div>
          );
        }
        if (!segment.content.trim()) return null;
        return (
          <div
            key={segment.key}
            className="prose prose-invert max-w-none"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: server-authored lesson content rendered through the in-app parseContent markdown parser, which escapes code blocks via escapeHtml
            dangerouslySetInnerHTML={{ __html: parseContent(segment.content) }}
          />
        );
      })}
    </div>
  );
}
