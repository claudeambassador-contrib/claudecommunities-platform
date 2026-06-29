"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type CSVRow,
  categoriseRole,
  parseLumaCSV,
  ROLE_CATEGORIES,
  ROLE_COLOURS,
  ROLE_COLUMNS,
  type RoleCategory,
} from "@/lib/luma-csv";

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "upload" | "results";
type AudienceFilter =
  | "everyone"
  | "developers"
  | "founders"
  | "product-managers"
  | "marketers-gtm"
  | "operators"
  | "industry-specific";
type ShortlistBucket = "new" | "not-recently-selected" | "previously-invited";

interface UploadedFile {
  name: string;
  rows: CSVRow[];
}

interface EventAppearance {
  fileName: string;
  status: string;
  checkedIn: boolean;
}

interface Candidate {
  name: string;
  email: string;
  role: string;
  roleCategory: RoleCategory;
  company: string;
  interests: string;
  experienceLevel: string;
  history: EventAppearance[];
  declined: boolean;
}

interface AIResult {
  email: string;
  fitScore: number;
  recommended: boolean;
  reasoning: string;
}

interface Selection {
  active: boolean;
  selected: Set<string>;
  onToggle: (email: string) => void;
  onSetMany: (emails: string[], selected: boolean) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRoleFromRow(row: CSVRow): string {
  for (const col of ROLE_COLUMNS) {
    const val = (row[col] || "").trim();
    if (val) return val;
  }
  return "";
}

function matchesAudienceFilter(c: Candidate, filter: AudienceFilter): boolean {
  switch (filter) {
    case "everyone":
    case "industry-specific":
      return true;
    case "developers":
      return (
        c.roleCategory === "Software Engineers / Devs" ||
        /engineer|developer|dev|sre|software/i.test(c.role)
      );
    case "founders":
      return c.roleCategory === "Founders / C-Suite / Directors";
    case "product-managers":
      return c.roleCategory === "Product / Design";
    case "marketers-gtm":
      return /market|growth|gtm|sales|business dev/i.test(c.role);
    case "operators":
      return c.roleCategory === "Management / Operations";
  }
}

function buildCandidates(
  pastFiles: UploadedFile[],
  currentFile: UploadedFile,
): { candidates: Candidate[]; buckets: Record<ShortlistBucket, Candidate[]> } {
  // Build history map from past files
  const historyMap = new Map<string, EventAppearance[]>();
  for (const file of pastFiles) {
    for (const row of file.rows) {
      const email = (row.email || "").toLowerCase().trim();
      if (!email) continue;
      const appearances = historyMap.get(email) || [];
      appearances.push({
        fileName: file.name,
        status: (row.approval_status || "").toLowerCase(),
        checkedIn: !!(row.checked_in_at || "").trim(),
      });
      historyMap.set(email, appearances);
    }
  }

  // Get current waitlisted candidates
  const waitlisted = currentFile.rows.filter((r) => {
    const status = (r.approval_status || "").toLowerCase();
    return status === "waitlist" || status === "declined" || status === "pending_approval";
  });

  const candidates: Candidate[] = [];
  const buckets: Record<ShortlistBucket, Candidate[]> = {
    new: [],
    "not-recently-selected": [],
    "previously-invited": [],
  };

  for (const row of waitlisted) {
    const email = (row.email || "").toLowerCase().trim();
    if (!email) continue;
    const role = getRoleFromRow(row);
    const declined = (row.approval_status || "").toLowerCase() === "declined";
    const history = historyMap.get(email) || [];
    const wasApproved = history.some(
      (h) => h.status === "approved" || h.status === "attended" || h.checkedIn,
    );

    let bucket: ShortlistBucket;
    if (history.length === 0) bucket = "new";
    else if (!wasApproved) bucket = "not-recently-selected";
    else bucket = "previously-invited";

    const candidate: Candidate = {
      name: (row.name || "").trim(),
      email,
      role,
      roleCategory: categoriseRole(role),
      company: (row["Where do you work or study? What is your title?"] || "").trim(),
      interests: (
        row[
          "What Claude Code features or capabilities are you most interested in discussing at this meetup?"
        ] || ""
      ).trim(),
      experienceLevel: (row["What is your experience level with Claude Code?"] || "").trim(),
      history,
      declined,
    };

    candidates.push(candidate);
    buckets[bucket].push(candidate);
  }

  return { candidates, buckets };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({
  title,
  count,
  headerRight,
  children,
}: {
  title: string;
  count?: number;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
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
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#5A5855",
          }}
        >
          {title}
        </span>
        {count !== undefined && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#7C6FCD",
              background: "rgba(124,111,205,0.15)",
              borderRadius: 10,
              padding: "2px 8px",
            }}
          >
            {count}
          </span>
        )}
        {headerRight && <div style={{ marginLeft: "auto" }}>{headerRight}</div>}
      </div>
      {children}
    </div>
  );
}

function PersonCard({ candidate, selection }: { candidate: Candidate; selection?: Selection }) {
  const catIndex = ROLE_CATEGORIES.indexOf(candidate.roleCategory);
  const colour = ROLE_COLOURS[catIndex >= 0 ? catIndex : ROLE_COLOURS.length - 1];
  const truncatedInterests =
    candidate.interests.length > 100
      ? `${candidate.interests.slice(0, 100)}...`
      : candidate.interests;

  // Declined guests stay visible but can't be picked for export.
  const selectable = selection?.active && !candidate.declined;
  // In select mode the whole row is a <label>, so clicking anywhere toggles the checkbox.
  const Wrapper: React.ElementType = selectable ? "label" : "div";

  return (
    <Wrapper
      style={{
        borderLeft: `3px solid ${colour}`,
        padding: "12px 16px",
        background: "rgba(255,255,255,0.02)",
        borderRadius: "0 8px 8px 0",
        marginBottom: 8,
        display: "flex",
        alignItems: "center",
        gap: 12,
        cursor: selectable ? "pointer" : "default",
        opacity: candidate.declined ? 0.55 : 1,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: "#E8E6DF" }}>{candidate.name}</span>
          <span style={{ fontSize: 12, color: "#6A6860" }}>{candidate.email}</span>
        </div>
        <div style={{ fontSize: 12, color: "#9A9890", marginBottom: 4 }}>
          {candidate.role}
          {candidate.company && candidate.company !== candidate.role && ` — ${candidate.company}`}
        </div>
        {truncatedInterests && (
          <div style={{ fontSize: 12, color: "#6A6860", marginBottom: 4 }}>
            {truncatedInterests}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {candidate.declined && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 6,
                background: "rgba(224,112,112,0.12)",
                border: "0.5px solid rgba(224,112,112,0.4)",
                color: "#E07070",
              }}
            >
              Declined
            </span>
          )}
          {candidate.experienceLevel && (
            <span
              style={{
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 6,
                background: "rgba(255,255,255,0.06)",
                border: "0.5px solid rgba(255,255,255,0.12)",
                color: "#9A9890",
              }}
            >
              {candidate.experienceLevel}
            </span>
          )}
          {candidate.history.length > 0 && (
            <span
              style={{
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 6,
                background: "rgba(124,111,205,0.1)",
                border: "0.5px solid rgba(124,111,205,0.25)",
                color: "#9A9890",
              }}
            >
              {candidate.history.length} past event{candidate.history.length !== 1 ? "s" : ""}
              {" — "}
              {candidate.history.map((h) => h.fileName.replace(/\.csv$/, "")).join(", ")}
            </span>
          )}
        </div>
      </div>
      {selection?.active &&
        (candidate.declined ? (
          <span style={{ fontSize: 11, color: "#E07070", flexShrink: 0 }}>Declined</span>
        ) : (
          <input
            type="checkbox"
            checked={selection.selected.has(candidate.email)}
            onChange={() => selection.onToggle(candidate.email)}
            aria-label={`Select ${candidate.name || candidate.email} for export`}
            style={{
              width: 18,
              height: 18,
              accentColor: "#7C6FCD",
              cursor: "pointer",
              flexShrink: 0,
            }}
          />
        ))}
    </Wrapper>
  );
}

function RoleGroup({
  category,
  candidates,
  selection,
}: {
  category: RoleCategory;
  candidates: Candidate[];
  selection?: Selection;
}) {
  const catIndex = ROLE_CATEGORIES.indexOf(category);
  const colour = ROLE_COLOURS[catIndex >= 0 ? catIndex : ROLE_COLOURS.length - 1];

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: colour,
          marginBottom: 8,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: colour,
            display: "inline-block",
          }}
        />
        {category} ({candidates.length})
      </div>
      {candidates.map((c) => (
        <PersonCard key={c.email} candidate={c} selection={selection} />
      ))}
    </div>
  );
}

function SelectAllCheckbox({
  candidates,
  selection,
}: {
  candidates: Candidate[];
  selection: Selection;
}) {
  const ref = useRef<HTMLInputElement>(null);
  // Declined guests can't be exported, so they're not part of "select all".
  const emails = candidates.filter((c) => !c.declined).map((c) => c.email);
  const selectedCount = emails.filter((e) => selection.selected.has(e)).length;
  const allSelected = emails.length > 0 && selectedCount === emails.length;
  const someSelected = selectedCount > 0 && !allSelected;

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = someSelected;
  }, [someSelected]);

  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        color: "#9A9890",
        cursor: "pointer",
      }}
    >
      Select all
      <input
        ref={ref}
        type="checkbox"
        checked={allSelected}
        onChange={() => selection.onSetMany(emails, !allSelected)}
        style={{ width: 18, height: 18, accentColor: "#7C6FCD", cursor: "pointer" }}
      />
    </label>
  );
}

function BucketSection({
  title,
  candidates,
  selection,
}: {
  title: string;
  candidates: Candidate[];
  selection?: Selection;
}) {
  // Group by role category
  const grouped = new Map<RoleCategory, Candidate[]>();
  for (const c of candidates) {
    const list = grouped.get(c.roleCategory) || [];
    list.push(c);
    grouped.set(c.roleCategory, list);
  }

  // Sort groups by ROLE_CATEGORIES order
  const sortedGroups = [...grouped.entries()].sort(
    (a, b) => ROLE_CATEGORIES.indexOf(a[0]) - ROLE_CATEGORIES.indexOf(b[0]),
  );

  return (
    <SectionCard
      title={title}
      count={candidates.length}
      headerRight={
        selection?.active && candidates.length > 0 ? (
          <SelectAllCheckbox candidates={candidates} selection={selection} />
        ) : undefined
      }
    >
      {candidates.length === 0 ? (
        <div style={{ fontSize: 13, color: "#6A6860" }}>No candidates in this category</div>
      ) : (
        sortedGroups.map(([category, list]) => (
          <RoleGroup key={category} category={category} candidates={list} selection={selection} />
        ))
      )}
    </SectionCard>
  );
}

function StatCard({
  value,
  label,
  valueStyle,
}: {
  value: string | number;
  label: string;
  valueStyle?: React.CSSProperties;
}) {
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
        style={{
          fontSize: 32,
          fontWeight: 600,
          color: "#E8E6DF",
          lineHeight: 1,
          marginBottom: 6,
          ...valueStyle,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12, color: "#6A6860" }}>{label}</div>
    </div>
  );
}

function FileChip({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: "rgba(255,255,255,0.06)",
        border: "0.5px solid rgba(255,255,255,0.12)",
        borderRadius: 8,
        padding: "6px 12px",
        fontSize: 13,
        color: "#C8C6BE",
      }}
    >
      <span
        style={{
          maxWidth: 200,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {name}
      </span>
      <button
        type="button"
        onClick={onRemove}
        style={{
          background: "none",
          border: "none",
          color: "#6A6860",
          cursor: "pointer",
          fontSize: 16,
          lineHeight: 1,
          padding: 0,
        }}
      >
        &times;
      </button>
    </div>
  );
}

function DropZone({
  label,
  multiple,
  files,
  onFiles,
  onRemove,
}: {
  label: string;
  multiple: boolean;
  files: UploadedFile[];
  onFiles: (newFiles: UploadedFile[]) => void;
  onRemove: (index: number) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(
    (fileList: FileList | File[]) => {
      const toProcess = Array.from(fileList);
      const results: UploadedFile[] = [];
      let pending = toProcess.length;

      for (const file of toProcess) {
        if (!file.name.endsWith(".csv")) {
          setError("Please upload .csv files only.");
          return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const rows = parseLumaCSV(e.target?.result as string);
            results.push({ name: file.name, rows });
          } catch {
            setError(`Couldn't parse ${file.name}. Make sure it's a Luma guest export.`);
          }
          pending--;
          if (pending === 0 && results.length > 0) {
            setError(null);
            onFiles(results);
          }
        };
        reader.readAsText(file);
      }
    },
    [onFiles],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      processFiles(e.dataTransfer.files);
    },
    [processFiles],
  );

  return (
    <div style={{ flex: 1 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#9A9890",
          marginBottom: 8,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </div>
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
          padding: "32px 24px",
          textAlign: "center",
          cursor: "pointer",
          background: dragging ? "rgba(124,111,205,0.07)" : "rgba(255,255,255,0.02)",
          transition: "all 0.2s ease",
          minHeight: 120,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.5 }}>&#8593;</div>
        <div style={{ fontSize: 13, color: "#C8C6BE", marginBottom: 4 }}>
          Drop {multiple ? "CSV files" : "a CSV file"} here
        </div>
        <div style={{ fontSize: 12, color: "#6A6860" }}>or click to browse</div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          multiple={multiple}
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files) processFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {error && <div style={{ marginTop: 8, fontSize: 12, color: "#E07070" }}>{error}</div>}
      {files.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
          {files.map((f, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: files lack unique ids and may share names; removal is index-based so index is part of identity
            <FileChip key={`${f.name}-${i}`} name={f.name} onRemove={() => onRemove(i)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── AI Invite List Modal ───────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 7) return "#4ADE80";
  if (score >= 4) return "#FACC15";
  return "#F87171";
}

function InviteListModal({
  results,
  candidateMap,
  onClose,
}: {
  results: AIResult[];
  candidateMap: Map<string, Candidate>;
  onClose: () => void;
}) {
  const handleExportCSV = useCallback(() => {
    const headers = [
      "Name",
      "Email",
      "Role",
      "Company",
      "Experience Level",
      "Interests",
      "History",
      "Fit Score",
      "Recommended",
      "Reasoning",
    ];
    const rows = results.map((r) => {
      const c = candidateMap.get(r.email);
      const historyLabel = !c?.history.length
        ? "New"
        : c.history.some((h) => h.status === "approved" || h.status === "attended" || h.checkedIn)
          ? `Invited (${c.history.length} events)`
          : `Applied ${c.history.length}x, never selected`;
      return [
        c?.name || "",
        r.email,
        c?.role || "",
        c?.company || "",
        c?.experienceLevel || "",
        c?.interests || "",
        historyLabel,
        String(r.fitScore),
        r.recommended ? "Yes" : "No",
        r.reasoning,
      ];
    });
    const escapeCsv = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [headers.join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invite-list-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [results, candidateMap]);

  const recommended = results.filter((r) => r.recommended);

  return (
    // biome-ignore lint/a11y/useSemanticElements: backdrop overlay wraps the dialog content; a native <button> cannot contain the dialog, so role="button" is used for the click-away-to-close affordance
    <div
      role="button"
      tabIndex={0}
      aria-label="Close dialog"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        style={{
          background: "#1C1917",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 16,
          width: "95vw",
          maxWidth: 1280,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
          color: "#E8E6DF",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>Invite List</div>
            <div style={{ fontSize: 12, color: "#6A6860", marginTop: 2 }}>
              {recommended.length} recommended of {results.length} evaluated
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={handleExportCSV}
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "#C8C6BE",
                background: "rgba(124,111,205,0.2)",
                border: "0.5px solid rgba(124,111,205,0.4)",
                borderRadius: 8,
                padding: "7px 16px",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                fontSize: 18,
                color: "#6A6860",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px 8px",
                lineHeight: 1,
              }}
            >
              &times;
            </button>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflow: "auto", flex: 1 }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
            }}
          >
            <thead>
              <tr
                style={{
                  position: "sticky",
                  top: 0,
                  background: "#1C1917",
                  zIndex: 1,
                }}
              >
                {["Score", "Name", "Email", "Role", "History", "Reasoning"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "8px 8px",
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "#5A5855",
                      borderBottom: "1px solid rgba(255,255,255,0.08)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const c = candidateMap.get(r.email);
                const catIndex = c ? ROLE_CATEGORIES.indexOf(c.roleCategory) : -1;
                const colour = ROLE_COLOURS[catIndex >= 0 ? catIndex : ROLE_COLOURS.length - 1];
                return (
                  <tr
                    key={r.email}
                    style={{
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      background: r.recommended ? "rgba(74,222,128,0.04)" : "transparent",
                    }}
                  >
                    <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: scoreColor(r.fitScore),
                        }}
                      >
                        {r.fitScore}
                      </span>
                      {r.recommended && (
                        <span
                          style={{
                            marginLeft: 4,
                            fontSize: 9,
                            fontWeight: 700,
                            padding: "2px 4px",
                            borderRadius: 4,
                            background: "rgba(74,222,128,0.15)",
                            color: "#4ADE80",
                            verticalAlign: "middle",
                          }}
                        >
                          REC
                        </span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: "6px 8px",
                        fontWeight: 500,
                        fontSize: 12,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c?.name || r.email}
                    </td>
                    <td style={{ padding: "6px 8px", color: "#9A9890", fontSize: 12 }}>
                      {r.email}
                    </td>
                    <td style={{ padding: "6px 8px", whiteSpace: "nowrap", fontSize: 12 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: colour,
                            display: "inline-block",
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ color: "#C8C6BE" }}>{c?.role || "—"}</span>
                      </span>
                    </td>
                    <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>
                      {(() => {
                        if (!c?.history.length)
                          return (
                            <span
                              style={{
                                fontSize: 10,
                                padding: "2px 6px",
                                borderRadius: 6,
                                background: "rgba(74,222,128,0.1)",
                                border: "0.5px solid rgba(74,222,128,0.25)",
                                color: "#4ADE80",
                              }}
                            >
                              New
                            </span>
                          );
                        const wasInvited = c.history.some(
                          (h) => h.status === "approved" || h.status === "attended" || h.checkedIn,
                        );
                        if (wasInvited)
                          return (
                            <span
                              style={{
                                fontSize: 10,
                                padding: "2px 6px",
                                borderRadius: 6,
                                background: "rgba(124,111,205,0.1)",
                                border: "0.5px solid rgba(124,111,205,0.25)",
                                color: "#9A9890",
                              }}
                            >
                              Invited ({c.history.length})
                            </span>
                          );
                        return (
                          <span
                            style={{
                              fontSize: 10,
                              padding: "2px 6px",
                              borderRadius: 6,
                              background: "rgba(250,204,21,0.1)",
                              border: "0.5px solid rgba(250,204,21,0.25)",
                              color: "#FACC15",
                            }}
                          >
                            {c.history.length}x, never selected
                          </span>
                        );
                      })()}
                    </td>
                    <td style={{ padding: "6px 8px", color: "#6A6860", fontSize: 11 }}>
                      {r.reasoning}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AIEvaluation({
  candidates,
  textareaRef,
}: {
  candidates: Candidate[];
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AIResult[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidateMap = new Map(candidates.map((c) => [c.email, c]));

  const handleEvaluate = useCallback(async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setResults([]);
    try {
      const resp = await fetch("/api/admin/tools/attendance-planner/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          candidates: candidates.map((c) => ({
            name: c.name,
            email: c.email,
            role: c.role,
            roleCategory: c.roleCategory,
            company: c.company,
            interests: c.interests,
            experienceLevel: c.experienceLevel,
            historyCount: c.history.length,
          })),
        }),
      });
      if (!resp.ok) throw new Error(`Server error: ${resp.status}`);
      const data = await resp.json();
      const sorted = (data.evaluations || []).sort(
        (a: AIResult, b: AIResult) => b.fitScore - a.fitScore,
      );
      setResults(sorted);
      setShowModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Evaluation failed");
    } finally {
      setLoading(false);
    }
  }, [prompt, candidates]);

  return (
    <>
      <SectionCard title="AI Invite List">
        <div style={{ fontSize: 12, color: "#9A9890", marginBottom: 12 }}>
          Describe your event or desired audience and the AI will rank all candidates by fit.
        </div>
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder='e.g. "Claude for Founders at Antler — targeting founders and early-stage companies"'
          style={{
            width: "100%",
            minHeight: 80,
            background: "rgba(255,255,255,0.04)",
            border: "0.5px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
            padding: 12,
            fontSize: 13,
            color: "#E8E6DF",
            resize: "vertical",
            fontFamily: "inherit",
            marginBottom: 12,
            boxSizing: "border-box",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={handleEvaluate}
            disabled={loading || !prompt.trim()}
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: loading || !prompt.trim() ? "#5A5855" : "#C8C6BE",
              background:
                loading || !prompt.trim() ? "rgba(255,255,255,0.03)" : "rgba(124,111,205,0.2)",
              border: "0.5px solid rgba(124,111,205,0.4)",
              borderRadius: 8,
              padding: "8px 20px",
              cursor: loading || !prompt.trim() ? "default" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {loading ? "Evaluating..." : "Generate Invite List"}
          </button>
          {results.length > 0 && !loading && (
            <button
              type="button"
              onClick={() => setShowModal(true)}
              style={{
                fontSize: 12,
                color: "#7C6FCD",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                textDecoration: "underline",
              }}
            >
              View last results ({results.length})
            </button>
          )}
        </div>
        {error && <div style={{ fontSize: 13, color: "#E07070", marginTop: 12 }}>{error}</div>}
      </SectionCard>
      {showModal && results.length > 0 && (
        <InviteListModal
          results={results}
          candidateMap={candidateMap}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

const FILTER_OPTIONS: { value: AudienceFilter; label: string }[] = [
  { value: "everyone", label: "Everyone" },
  { value: "developers", label: "Developers" },
  { value: "founders", label: "Founders" },
  { value: "product-managers", label: "Product Managers" },
  { value: "marketers-gtm", label: "Marketers / GTM" },
  { value: "operators", label: "Operators" },
  { value: "industry-specific", label: "Industry Specific" },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AttendancePlanner() {
  const [phase, setPhase] = useState<Phase>("upload");
  const [pastFiles, setPastFiles] = useState<UploadedFile[]>([]);
  const [currentFile, setCurrentFile] = useState<UploadedFile | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [buckets, setBuckets] = useState<Record<ShortlistBucket, Candidate[]>>({
    new: [],
    "not-recently-selected": [],
    "previously-invited": [],
  });
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter>("everyone");
  const [activeTab, setActiveTab] = useState<ShortlistBucket | "all">("all");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const aiTextareaRef = useRef<HTMLTextAreaElement>(null);

  const toggleSelect = useCallback((email: string) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }, []);

  const setManySelected = useCallback((emails: string[], selected: boolean) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      for (const email of emails) {
        if (selected) next.add(email);
        else next.delete(email);
      }
      return next;
    });
  }, []);

  const handleDownloadCsv = useCallback(() => {
    const byEmail = new Map(candidates.map((c) => [c.email, c]));
    const escapeCsv = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = [...selectedEmails]
      .map((email) => byEmail.get(email))
      .filter((c): c is Candidate => c !== undefined && !c.declined)
      .map((c) => [c.name, c.email]);
    const csv = [["Name", "Email"].join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join(
      "\n",
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendee-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [candidates, selectedEmails]);

  const handleAnalyse = useCallback(() => {
    if (!currentFile || pastFiles.length === 0) return;
    const result = buildCandidates(pastFiles, currentFile);
    setCandidates(result.candidates);
    setBuckets(result.buckets);
    setAudienceFilter("everyone");
    setActiveTab("all");
    setSelectMode(false);
    setSelectedEmails(new Set());
    setPhase("results");
  }, [pastFiles, currentFile]);

  const handleReset = useCallback(() => {
    setPhase("upload");
    setPastFiles([]);
    setCurrentFile(null);
    setCandidates([]);
    setBuckets({ new: [], "not-recently-selected": [], "previously-invited": [] });
    setAudienceFilter("everyone");
    setActiveTab("all");
    setSelectMode(false);
    setSelectedEmails(new Set());
  }, []);

  const canAnalyse = pastFiles.length > 0 && currentFile !== null;

  // Apply audience filter to each bucket
  const filterBucket = (list: Candidate[]) =>
    list.filter((c) => matchesAudienceFilter(c, audienceFilter));
  const filteredNew = filterBucket(buckets.new);
  const filteredNotSelected = filterBucket(buckets["not-recently-selected"]);
  const filteredPrevInvited = filterBucket(buckets["previously-invited"]);
  const allFiltered = [...filteredNew, ...filteredNotSelected, ...filteredPrevInvited];

  // Most common role across all candidates
  const roleCounts = new Map<RoleCategory, number>();
  for (const c of candidates) {
    roleCounts.set(c.roleCategory, (roleCounts.get(c.roleCategory) || 0) + 1);
  }
  let mostCommonRole: RoleCategory = "Other / Non-Tech";
  let maxRoleCount = 0;
  for (const [role, count] of roleCounts) {
    if (count > maxRoleCount) {
      maxRoleCount = count;
      mostCommonRole = role;
    }
  }

  return (
    <div
      style={{
        background: "#111110",
        color: "#E8E6DF",
        fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
        borderRadius: 16,
        padding: 24,
      }}
    >
      {phase === "upload" && (
        <div>
          <div
            style={{
              display: "flex",
              gap: 24,
              marginBottom: 24,
              flexWrap: "wrap",
            }}
          >
            <DropZone
              label="Past Events"
              multiple
              files={pastFiles}
              onFiles={(newFiles) => setPastFiles((prev) => [...prev, ...newFiles])}
              onRemove={(i) => setPastFiles((prev) => prev.filter((_, idx) => idx !== i))}
            />
            <DropZone
              label="Current Event"
              multiple={false}
              files={currentFile ? [currentFile] : []}
              onFiles={(newFiles) => {
                if (newFiles.length > 0) setCurrentFile(newFiles[0]);
              }}
              onRemove={() => setCurrentFile(null)}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <button
              type="button"
              onClick={handleAnalyse}
              disabled={!canAnalyse}
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: canAnalyse ? "#E8E6DF" : "#5A5855",
                background: canAnalyse ? "rgba(124,111,205,0.25)" : "rgba(255,255,255,0.03)",
                border: `0.5px solid ${canAnalyse ? "rgba(124,111,205,0.5)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 8,
                padding: "10px 32px",
                cursor: canAnalyse ? "pointer" : "default",
              }}
            >
              Analyse
            </button>
          </div>
        </div>
      )}

      {phase === "results" && (
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
            <div style={{ fontSize: 18, fontWeight: 600, color: "#E8E6DF" }}>
              Cross-Reference Results
            </div>
            <button
              type="button"
              onClick={handleReset}
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
              Upload new files
            </button>
          </div>

          {/* Summary stats */}
          <SectionCard title="Summary">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 12,
              }}
            >
              <StatCard value={candidates.length} label="Total candidates" />
              <StatCard value={buckets.new.length} label="New applicants" />
              <StatCard value={buckets["not-recently-selected"].length} label="Never selected" />
              <StatCard value={buckets["previously-invited"].length} label="Previously invited" />
              <StatCard
                value={mostCommonRole}
                label="Most common role"
                valueStyle={{ fontSize: 14, color: "#7C6FCD", lineHeight: 1.3 }}
              />
            </div>
          </SectionCard>

          {/* Audience filter + Create Invite List */}
          <div
            style={{
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <select
              value={audienceFilter}
              onChange={(e) => setAudienceFilter(e.target.value as AudienceFilter)}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "0.5px solid rgba(255,255,255,0.12)",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 13,
                color: "#C8C6BE",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {audienceFilter !== "everyone" && (
              <span style={{ fontSize: 12, color: "#6A6860" }}>
                Showing {allFiltered.length} of {candidates.length}
              </span>
            )}
            <div style={{ marginLeft: "auto", display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setSelectMode((prev) => !prev)}
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: selectMode ? "#E8E6DF" : "#C8C6BE",
                  background: selectMode ? "rgba(124,111,205,0.35)" : "rgba(255,255,255,0.06)",
                  border: "0.5px solid rgba(124,111,205,0.4)",
                  borderRadius: 8,
                  padding: "8px 16px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {selectMode ? "Done selecting" : "Select for export"}
              </button>
              {selectMode && (
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  disabled={selectedEmails.size === 0}
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: selectedEmails.size === 0 ? "#5A5855" : "#C8C6BE",
                    background:
                      selectedEmails.size === 0
                        ? "rgba(255,255,255,0.03)"
                        : "rgba(124,111,205,0.2)",
                    border: "0.5px solid rgba(124,111,205,0.4)",
                    borderRadius: 8,
                    padding: "8px 16px",
                    cursor: selectedEmails.size === 0 ? "default" : "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Download CSV{selectedEmails.size > 0 ? ` (${selectedEmails.size})` : ""}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  aiTextareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                  setTimeout(() => aiTextareaRef.current?.focus(), 400);
                }}
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#C8C6BE",
                  background: "rgba(124,111,205,0.2)",
                  border: "0.5px solid rgba(124,111,205,0.4)",
                  borderRadius: 8,
                  padding: "8px 16px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Create Invite List
              </button>
            </div>
          </div>

          {/* Bucket tabs */}
          {(() => {
            const tabs: { key: ShortlistBucket | "all"; label: string; candidates: Candidate[] }[] =
              [
                { key: "all", label: "All", candidates: allFiltered },
                { key: "new", label: "New — Never Invited", candidates: filteredNew },
                {
                  key: "not-recently-selected",
                  label: "Applied — Never Selected",
                  candidates: filteredNotSelected,
                },
                {
                  key: "previously-invited",
                  label: "Previously Invited",
                  candidates: filteredPrevInvited,
                },
              ];
            const active = tabs.find((t) => t.key === activeTab) || tabs[0];
            return (
              <>
                <div
                  style={{
                    display: "flex",
                    gap: 0,
                    marginBottom: 16,
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      style={{
                        padding: "10px 18px",
                        fontSize: 13,
                        fontWeight: activeTab === tab.key ? 600 : 400,
                        color: activeTab === tab.key ? "#E8E6DF" : "#6A6860",
                        background: "none",
                        border: "none",
                        borderBottom:
                          activeTab === tab.key ? "2px solid #7C6FCD" : "2px solid transparent",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        fontFamily: "inherit",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {tab.label}
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          color: activeTab === tab.key ? "#7C6FCD" : "#5A5855",
                        }}
                      >
                        {tab.candidates.length}
                      </span>
                    </button>
                  ))}
                </div>
                <BucketSection
                  title={active.label}
                  candidates={active.candidates}
                  selection={{
                    active: selectMode,
                    selected: selectedEmails,
                    onToggle: toggleSelect,
                    onSetMany: setManySelected,
                  }}
                />
              </>
            );
          })()}

          {/* AI Evaluation — declined guests are out of consideration */}
          <AIEvaluation
            candidates={allFiltered.filter((c) => !c.declined)}
            textareaRef={aiTextareaRef}
          />
        </div>
      )}
    </div>
  );
}
