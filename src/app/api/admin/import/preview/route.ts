import { type NextRequest, NextResponse } from "next/server";
import { getPlatformPrisma } from "@/lib/prisma";
import { requirePermissionResponse } from "@/lib/route-auth";

interface RawRow {
  [key: string]: string;
}

interface PreviewUser {
  email: string;
  name?: string;
  linkedin?: string;
  bio?: string;
  experienceLevel?: string;
  city?: string;
  exists: boolean;
}

// POST - Preview import results
export async function POST(request: NextRequest) {
  const auth = await requirePermissionResponse("users.import");
  if (!auth.ok) return auth.response;
  // Reads global User identity (email @unique) to flag which import rows already
  // exist — platform client, no tenant scope.
  const prisma = await getPlatformPrisma();

  const { rows, columnMapping } = (await request.json()) as {
    rows: RawRow[];
    columnMapping: Record<string, string>;
  };

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No data to preview" }, { status: 400 });
  }

  if (!columnMapping?.email) {
    return NextResponse.json({ error: "Email column mapping is required" }, { status: 400 });
  }

  const previewUsers: PreviewUser[] = [];
  const existingEmails: string[] = [];
  const newEmails: string[] = [];
  const invalidEmails: string[] = [];

  for (const row of rows) {
    // Extract email
    const email = row[columnMapping.email]?.toLowerCase().trim();
    if (!email || !isValidEmail(email)) {
      invalidEmails.push(email || "empty");
      continue;
    }

    const fields = extractFields(row, columnMapping);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      existingEmails.push(email);
    } else {
      newEmails.push(email);
    }

    previewUsers.push({
      email,
      ...fields,
      exists: !!existingUser,
    });
  }

  return NextResponse.json({
    total: rows.length,
    valid: previewUsers.length,
    invalid: invalidEmails.length,
    existing: existingEmails.length,
    new: newEmails.length,
    preview: previewUsers.slice(0, 20), // First 20 for preview
    invalidEmails: invalidEmails.slice(0, 10), // First 10 invalid
  });
}

function extractFields(
  row: RawRow,
  columnMapping: Record<string, string>,
): Omit<PreviewUser, "email" | "exists"> {
  // Extract name (can come from multiple columns)
  let name = "";
  if (columnMapping.name) {
    name = row[columnMapping.name] || "";
  } else if (columnMapping.first_name || columnMapping.last_name) {
    const firstName = row[columnMapping.first_name] || "";
    const lastName = row[columnMapping.last_name] || "";
    name = `${firstName} ${lastName}`.trim();
  }

  const linkedin = row[columnMapping.linkedin] || "";
  const bio = row[columnMapping.bio] || row[columnMapping.work_study] || "";
  const experienceLevel =
    row[columnMapping.experienceLevel] || row[columnMapping.experience_level] || "";
  const city = row[columnMapping.city] || "";

  return {
    name: name || undefined,
    linkedin: linkedin || undefined,
    bio: bio || undefined,
    experienceLevel: experienceLevel || undefined,
    city: city || undefined,
  };
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
