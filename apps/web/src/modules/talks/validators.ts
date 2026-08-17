const EMAIL_MARKER = "@";

export function isValidEmail(value: string): boolean {
  return value.includes(EMAIL_MARKER);
}

function publicR2Host(): string | null {
  try {
    return new URL(process.env.R2_PUBLIC_URL || "").hostname || null;
  } catch {
    return null;
  }
}

export function isStorageUrl(url: string): boolean {
  if (url.startsWith("/api/files/")) {
    return true;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return false;
    }
    const publicHost = publicR2Host();
    return (
      parsed.pathname.startsWith("/api/files/") ||
      parsed.hostname.endsWith(".r2.dev") ||
      Boolean(publicHost && parsed.hostname === publicHost)
    );
  } catch {
    return false;
  }
}
