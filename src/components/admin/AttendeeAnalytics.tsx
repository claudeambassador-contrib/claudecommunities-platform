"use client";

import { toBlob } from "html-to-image";
import { type CSSProperties, useCallback, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CSVRow {
  [key: string]: string;
}

interface TopicCount {
  label: string;
  count: number;
}

interface RoleEntry {
  label: string;
  count: number;
  pct: number;
}

interface AnalysisData {
  total: number;
  dailyUsers: number;
  newUsers: number;
  smbPct: number;
  smb500: number;
  topicCounts: TopicCount[];
  rolesSorted: RoleEntry[];
  totalRoles: number;
  expCounts: Record<string, number>;
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────

function parseCSV(text: string): CSVRow[] {
  const lines = text.trim().split("\n");
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    return Object.fromEntries(headers.map((h, i) => [h.trim(), (values[i] || "").trim()]));
  });
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ─── Analysis ─────────────────────────────────────────────────────────────────

function analyseRows(rows: CSVRow[]): AnalysisData {
  const active = rows.filter((r) =>
    ["approved", "waitlist", "attended"].includes((r.approval_status || "").toLowerCase()),
  );

  const expCol = "What is your experience level with Claude Code?";
  const roleCol = "What is your role? (If Student, write Student)";
  const sizeCol = "Number of employees at your company?";
  const topicsCol =
    "What Claude Code features or capabilities are you most interested in discussing at this meetup?";

  // Experience
  const expCounts: Record<string, number> = {};
  for (const r of active) {
    const v = (r[expCol] || "").trim();
    if (v) expCounts[v] = (expCounts[v] || 0) + 1;
  }

  // Roles
  function categoriseRole(role: string): string {
    const r = role.toLowerCase();
    if (/student|associate\/student/.test(r)) return "Students";
    if (/founder|ceo|cto|coo|cfo|c-suite|director|owner|co-founder/.test(r))
      return "Founders / C-Suite / Directors";
    if (/engineer|developer|\bdev\b|sre|software|fullstack|backend|frontend/.test(r))
      return "Software Engineers / Devs";
    if (/manager|management|operations|\bops\b/.test(r)) return "Management / Operations";
    if (/consultant|freelance/.test(r)) return "Consultants / Freelancers";
    if (/product|design|\bux\b|\bui\b/.test(r)) return "Product / Design";
    if (/data|analyst|analytics|research|scientist/.test(r)) return "Data / Analytics / Research";
    return "Other / Non-Tech";
  }

  const roleCounts: Record<string, number> = {};
  for (const r of active) {
    const cat = categoriseRole(r[roleCol] || "");
    roleCounts[cat] = (roleCounts[cat] || 0) + 1;
  }
  const totalRoles = Object.values(roleCounts).reduce((a, b) => a + b, 0);

  // Company size
  const sizeCounts: Record<string, number> = {};
  for (const r of active) {
    const v = (r[sizeCol] || "").trim();
    if (v) sizeCounts[v] = (sizeCounts[v] || 0) + 1;
  }
  const totalWithSize = Object.values(sizeCounts).reduce((a, b) => a + b, 0);
  const smb500 = sizeCounts["1-500"] || 0;
  const smbPct = totalWithSize > 0 ? Math.round((smb500 / totalWithSize) * 100) : 0;

  // Topics
  const topicDefs = [
    { label: "Skills & Plugins", keywords: ["skill", "plugin"] },
    { label: "Agentic Workflows", keywords: ["agentic", "agent workflow", "agentic workflow"] },
    { label: "Multi-Agent Teams", keywords: ["multi-agent", "multi agent", "agent team"] },
    { label: "Automation", keywords: ["automat"] },
    { label: "Sub-Agents", keywords: ["subagent", "sub-agent", "sub agent"] },
    { label: "Cowork", keywords: ["cowork"] },
    { label: "MCP", keywords: ["mcp"] },
    { label: "Code Quality", keywords: ["code quality", "best practice"] },
    { label: "Vibe Coding", keywords: ["vibe cod"] },
    { label: "Context Management", keywords: ["context"] },
    { label: "Research & Writing", keywords: ["research", "writing"] },
    { label: "Non-SWE Usage", keywords: ["non-swe", "non swe", "non-technical", "non technical"] },
  ];

  const topicCounts = topicDefs
    .map(({ label, keywords }) => ({
      label,
      count: active.filter((r) => {
        const t = (r[topicsCol] || "").toLowerCase();
        return keywords.some((kw) => t.includes(kw));
      }).length,
    }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count);

  const dailyUsers = active.filter((r) => /daily/i.test(r[expCol] || "")).length;
  const newUsers = active.filter((r) => /new but/i.test(r[expCol] || "")).length;

  const rolesSorted = Object.entries(roleCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({
      label,
      count,
      pct: Math.round((count / totalRoles) * 100),
    }));

  return {
    total: active.length,
    dailyUsers,
    newUsers,
    smbPct,
    smb500,
    topicCounts,
    rolesSorted,
    totalRoles,
    expCounts,
  };
}

// ─── Colours ──────────────────────────────────────────────────────────────────

const ROLE_COLOURS = [
  "#7C6FCD",
  "#C0496D",
  "#888780",
  "#1B9870",
  "#E09820",
  "#3578C8",
  "#C85025",
  "#4E8A1C",
];

const CHIP_STYLES = [
  { bg: "#2D2260", color: "#C8C0FF" },
  { bg: "#5C1A3A", color: "#F4A8CC" },
  { bg: "#0A3D2E", color: "#7ADDC0" },
  { bg: "#0C2E55", color: "#7EC0F5" },
  { bg: "#4A1E08", color: "#F5C07A" },
  { bg: "#3A1E00", color: "#EDAA5A" },
  { bg: "#1A3A08", color: "#A6D96A" },
  { bg: "#2A2A28", color: "#C8C6BE" },
  { bg: "#1E1A50", color: "#AEABF0" },
  { bg: "#052820", color: "#6DCFB0" },
  { bg: "#3A0C25", color: "#F0A0C0" },
  { bg: "#1A3020", color: "#90C880" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function TopicChip({ label, index }: { label: string; index: number }) {
  const style = CHIP_STYLES[index % CHIP_STYLES.length];
  return (
    <span
      style={{
        padding: "6px 14px",
        borderRadius: 20,
        fontSize: 13,
        fontWeight: 500,
        lineHeight: "1",
        display: "inline-flex",
        alignItems: "center",
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.color}22`,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function BarRow({
  label,
  count,
  pct,
  colour,
  maxPct,
}: {
  label: string;
  count: number;
  pct: number;
  colour: string;
  maxPct: number;
}) {
  const barWidth = maxPct > 0 ? (pct / maxPct) * 100 : pct;
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 10, gap: 10 }}>
      <div
        style={{
          width: 210,
          textAlign: "right",
          fontSize: 13,
          color: "#9A9890",
          flexShrink: 0,
          lineHeight: 1.3,
        }}
      >
        {label}
      </div>
      <div
        style={{
          flex: 1,
          background: "rgba(255,255,255,0.06)",
          borderRadius: 4,
          height: 28,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            width: `${Math.max(barWidth, 4)}%`,
            minWidth: 52,
            height: 28,
            background: colour,
            borderRadius: 4,
            paddingLeft: 10,
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            transition: "width 0.6s cubic-bezier(.4,0,.2,1)",
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: "#fff", opacity: 0.9 }}>{pct}%</span>
        </div>
      </div>
      <div style={{ width: 28, textAlign: "right", fontSize: 13, color: "#6A6860", flexShrink: 0 }}>
        {count}
      </div>
    </div>
  );
}

function InsightCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "0.5px solid rgba(255,255,255,0.1)",
        borderRadius: 10,
        padding: "18px 12px",
        textAlign: "center",
      }}
    >
      <div
        style={{ fontSize: 32, fontWeight: 600, color: "#E8E6DF", lineHeight: 1, marginBottom: 6 }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12, color: "#6A6860", lineHeight: 1.4 }}>{label}</div>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "0.5px solid rgba(255,255,255,0.1)",
        borderRadius: 12,
        padding: "20px 24px",
        marginBottom: 16,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "#5A5855",
          marginBottom: 16,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

// ─── Upload Screen ─────────────────────────────────────────────────────────────

function UploadScreen({ onData }: { onData: (data: AnalysisData, name: string) => void }) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file?.name.endsWith(".csv")) {
        setError("Please upload a .csv file.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const rows = parseCSV(e.target?.result as string);
          const data = analyseRows(rows);
          onData(data, file.name);
        } catch {
          setError("Couldn't parse this CSV. Make sure it's a Luma guest export.");
        }
      };
      reader.readAsText(file);
    },
    [onData],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      handleFile(e.dataTransfer.files[0]);
    },
    [handleFile],
  );

  return (
    <div
      style={{
        minHeight: 320,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
      }}
    >
      {/* biome-ignore lint/a11y/useSemanticElements: a native <button> cannot contain the nested file <input> (interactive content); role="button" is required */}
      <div
        role="button"
        tabIndex={0}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        style={{
          border: `1.5px dashed ${dragging ? "#7C6FCD" : "rgba(255,255,255,0.18)"}`,
          borderRadius: 16,
          padding: "48px 56px",
          textAlign: "center",
          cursor: "pointer",
          background: dragging ? "rgba(124,111,205,0.07)" : "rgba(255,255,255,0.02)",
          transition: "all 0.2s ease",
          maxWidth: 420,
          width: "100%",
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.5 }}>&#8593;</div>
        <div style={{ fontSize: 15, fontWeight: 500, color: "#C8C6BE", marginBottom: 8 }}>
          Drop your Luma CSV here
        </div>
        <div style={{ fontSize: 13, color: "#6A6860" }}>or click to browse</div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          style={{ display: "none" }}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      {error && <div style={{ marginTop: 16, fontSize: 13, color: "#E07070" }}>{error}</div>}
    </div>
  );
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────

function Dashboard({
  data,
  filename,
  onReset,
}: {
  data: AnalysisData;
  filename: string;
  onReset: () => void;
}) {
  const { total, dailyUsers, newUsers, smbPct, topicCounts, rolesSorted } = data;
  const topRole = rolesSorted[0];
  const maxPct = rolesSorted[0]?.pct || 1;
  const captureRef = useRef<HTMLDivElement>(null);
  const [copying, setCopying] = useState(false);

  const handleCopyImage = useCallback(async () => {
    if (!captureRef.current) return;
    setCopying(true);
    try {
      const blob = await toBlob(captureRef.current, {
        backgroundColor: "#111110",
        pixelRatio: 2,
      });
      if (!blob) return;
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    } catch {
      // Clipboard API not supported or permission denied
    } finally {
      setCopying(false);
    }
  }, []);

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#E8E6DF" }}>
            Attendee Analytics - Luma
          </div>
          <div style={{ fontSize: 12, color: "#5A5855", marginTop: 2 }}>
            {filename} &mdash; {total} registrants
          </div>
        </div>
        <button
          type="button"
          onClick={onReset}
          style={{
            fontSize: 12,
            color: "#6A6860",
            background: "none",
            border: "0.5px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
            padding: "6px 14px",
            cursor: "pointer",
          }}
        >
          Upload new file
        </button>
      </div>

      {/* Capture area */}
      <div ref={captureRef} style={{ background: "#111110", padding: "16px" }}>
        {/* Topics */}
        <SectionCard title="Most requested topics">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {topicCounts.map((t, i) => (
              <TopicChip key={t.label} label={t.label} index={i} />
            ))}
          </div>
        </SectionCard>

        {/* Roles */}
        <SectionCard title="Role / Job Function">
          {rolesSorted.map((r, i) => (
            <BarRow
              key={r.label}
              label={r.label}
              count={r.count}
              pct={r.pct}
              colour={ROLE_COLOURS[i % ROLE_COLOURS.length]}
              maxPct={maxPct}
            />
          ))}
        </SectionCard>

        {/* Insights */}
        <SectionCard title="Key insights for tonight">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
            }}
          >
            <InsightCard
              value={dailyUsers}
              label="Daily users who will want deep, advanced content"
            />
            <InsightCard
              value={newUsers}
              label="Brand new attendees who need live demos & basics"
            />
            <InsightCard
              value={topRole?.count || 0}
              label={`${topRole?.label || "Engineers"} — largest single job function`}
            />
            <InsightCard
              value={rolesSorted.find((r) => r.label.includes("Founder"))?.count || 0}
              label="Founders & C-suite looking at business impact"
            />
            <InsightCard
              value={rolesSorted.find((r) => r.label === "Students")?.count || 0}
              label="Students eager to learn and upskill"
            />
            <InsightCard value={`${smbPct}%`} label="Work at SMBs / startups (1-500 employees)" />
          </div>
        </SectionCard>
      </div>

      {/* Copy button */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
        <button
          type="button"
          onClick={handleCopyImage}
          disabled={copying}
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: copying ? "#5A5855" : "#C8C6BE",
            background: "rgba(255,255,255,0.06)",
            border: "0.5px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
            padding: "8px 20px",
            cursor: copying ? "default" : "pointer",
          }}
        >
          {copying ? "Copying..." : "Copy to Clipboard"}
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface AttendeeAnalyticsProps {
  initialData?: AnalysisData;
  className?: string;
  style?: CSSProperties;
}

export default function AttendeeAnalytics({
  initialData,
  className,
  style,
}: AttendeeAnalyticsProps) {
  const [data, setData] = useState<AnalysisData | null>(initialData || null);
  const [filename, setFilename] = useState("");

  const handleData = useCallback((analysed: AnalysisData, name: string) => {
    setData(analysed);
    setFilename(name);
  }, []);

  const handleReset = useCallback(() => {
    setData(null);
    setFilename("");
  }, []);

  return (
    <div
      className={className}
      style={{
        background: "#111110",
        color: "#E8E6DF",
        fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
        borderRadius: 16,
        padding: 24,
        ...style,
      }}
    >
      {data ? (
        <Dashboard data={data} filename={filename} onReset={handleReset} />
      ) : (
        <UploadScreen onData={handleData} />
      )}
    </div>
  );
}
