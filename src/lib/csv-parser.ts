// CSV Parser for Luma guest lists and general CSV imports

export interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
  suggestedMapping: Record<string, string>;
}

// Parse CSV text into structured data
export function parseCSV(csvText: string): ParsedCSV {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim());

  if (lines.length === 0) {
    return { headers: [], rows: [], suggestedMapping: {} };
  }

  // Parse headers
  const headers = parseCSVLine(lines[0]);

  // Parse data rows
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length > 0) {
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });
      rows.push(row);
    }
  }

  // Generate suggested column mapping
  const suggestedMapping = generateColumnMapping(headers);

  return { headers, rows, suggestedMapping };
}

// Parse a single CSV line, handling quoted values
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          current += '"';
          i++;
        } else {
          // End of quoted value
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }

  values.push(current.trim());
  return values;
}

// Generate suggested column mapping based on header names
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: flat sequence of near-identical per-field pattern-match blocks with slightly differing match semantics (exact vs includes vs space-stripped); extracting a shared helper would obscure those per-field differences without reducing real complexity
function generateColumnMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const lowerHeaders = headers.map((h) => h.toLowerCase());

  // Email mappings
  const emailPatterns = ["email", "e-mail", "email address", "emailaddress"];
  for (const pattern of emailPatterns) {
    const idx = lowerHeaders.findIndex((h) => h.includes(pattern));
    if (idx !== -1) {
      mapping.email = headers[idx];
      break;
    }
  }

  // Name mappings
  const namePatterns = ["name", "full name", "fullname", "display name"];
  for (const pattern of namePatterns) {
    const idx = lowerHeaders.findIndex((h) => h === pattern || h.includes(pattern));
    if (idx !== -1) {
      mapping.name = headers[idx];
      break;
    }
  }

  // First/Last name
  const firstNamePatterns = ["first name", "firstname", "first_name", "given name"];
  for (const pattern of firstNamePatterns) {
    const idx = lowerHeaders.findIndex((h) => h.includes(pattern.replace(" ", "")));
    if (idx !== -1) {
      mapping.first_name = headers[idx];
      break;
    }
  }

  const lastNamePatterns = ["last name", "lastname", "last_name", "surname", "family name"];
  for (const pattern of lastNamePatterns) {
    const idx = lowerHeaders.findIndex((h) => h.includes(pattern.replace(" ", "")));
    if (idx !== -1) {
      mapping.last_name = headers[idx];
      break;
    }
  }

  // LinkedIn mappings (Luma format)
  const linkedinPatterns = [
    "linkedin",
    "linkedin profile",
    "what is your linkedin",
    "linkedin url",
    "linkedin.com",
  ];
  for (const pattern of linkedinPatterns) {
    const idx = lowerHeaders.findIndex((h) => h.includes(pattern));
    if (idx !== -1) {
      mapping.linkedin = headers[idx];
      break;
    }
  }

  // Work/Study (Luma format - maps to bio or tagline)
  const workPatterns = [
    "where do you work",
    "work or study",
    "company",
    "organization",
    "workplace",
  ];
  for (const pattern of workPatterns) {
    const idx = lowerHeaders.findIndex((h) => h.includes(pattern));
    if (idx !== -1) {
      mapping.work_study = headers[idx];
      break;
    }
  }

  // Experience level (Luma format)
  const experiencePatterns = [
    "experience level",
    "experience",
    "what is your experience",
    "skill level",
  ];
  for (const pattern of experiencePatterns) {
    const idx = lowerHeaders.findIndex((h) => h.includes(pattern));
    if (idx !== -1) {
      mapping.experience_level = headers[idx];
      break;
    }
  }

  // City
  const cityPatterns = ["city", "location", "where are you"];
  for (const pattern of cityPatterns) {
    const idx = lowerHeaders.findIndex((h) => h.includes(pattern));
    if (idx !== -1) {
      mapping.city = headers[idx];
      break;
    }
  }

  // Approval status (Luma format - for filtering)
  const approvalPatterns = ["approval", "approval_status", "status", "approved"];
  for (const pattern of approvalPatterns) {
    const idx = lowerHeaders.findIndex((h) => h.includes(pattern));
    if (idx !== -1) {
      mapping.approval_status = headers[idx];
      break;
    }
  }

  return mapping;
}

// Filter rows by approval status (for Luma imports)
export function filterApprovedRows(
  rows: Record<string, string>[],
  approvalColumn?: string,
): Record<string, string>[] {
  if (!approvalColumn) {
    return rows;
  }

  return rows.filter((row) => {
    const status = row[approvalColumn]?.toLowerCase();
    // Accept if approved, accepted, or no status
    return !status || status === "approved" || status === "accepted" || status === "yes";
  });
}

// Convert parsed CSV rows to import-ready user objects
export function mapRowsToUsers(
  rows: Record<string, string>[],
  columnMapping: Record<string, string>,
): Array<{
  email: string;
  name?: string;
  linkedin?: string;
  bio?: string;
  tagline?: string;
  experienceLevel?: string;
  city?: string;
}> {
  return rows
    .map((row) => {
      // Get email
      const email = row[columnMapping.email]?.toLowerCase().trim() || "";

      // Get name
      let name = "";
      if (columnMapping.name) {
        name = row[columnMapping.name] || "";
      } else if (columnMapping.first_name || columnMapping.last_name) {
        const firstName = row[columnMapping.first_name] || "";
        const lastName = row[columnMapping.last_name] || "";
        name = `${firstName} ${lastName}`.trim();
      }

      // Get other fields
      const linkedin = row[columnMapping.linkedin] || "";
      const workStudy = row[columnMapping.work_study] || "";
      const experienceLevel = row[columnMapping.experience_level] || "";
      const city = row[columnMapping.city] || "";

      return {
        email,
        name: name || undefined,
        linkedin: linkedin || undefined,
        bio: workStudy || undefined,
        tagline: workStudy ? workStudy.substring(0, 100) : undefined,
        experienceLevel: experienceLevel || undefined,
        city: city || undefined,
      };
    })
    .filter((user) => user.email); // Only include users with valid email
}
