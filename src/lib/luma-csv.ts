// Shared Luma CSV utilities — extracted from AttendeeAnalytics

export interface CSVRow {
  [key: string]: string;
}

// The role column name varies between Luma exports
export const ROLE_COLUMNS = [
  "What is your role? (If Student, write Student)",
  "Where do you work or study? What is your title?",
] as const;

export const ROLE_CATEGORIES = [
  "Students",
  "Founders / C-Suite / Directors",
  "Software Engineers / Devs",
  "Management / Operations",
  "Consultants / Freelancers",
  "Product / Design",
  "Data / Analytics / Research",
  "Other / Non-Tech",
] as const;
export type RoleCategory = (typeof ROLE_CATEGORIES)[number];

export const ROLE_COLOURS = [
  "#7C6FCD",
  "#C0496D",
  "#888780",
  "#1B9870",
  "#E09820",
  "#3578C8",
  "#C85025",
  "#4E8A1C",
];

export const CHIP_STYLES = [
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

export function categoriseRole(rawRole: string): RoleCategory {
  const r = rawRole.toLowerCase();
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

function parseLumaCSVLine(line: string): string[] {
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

export function parseLumaCSV(text: string): CSVRow[] {
  const lines = text.trim().split("\n");
  const headers = parseLumaCSVLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseLumaCSVLine(line);
    return Object.fromEntries(headers.map((h, i) => [h.trim(), (values[i] || "").trim()]));
  });
}
