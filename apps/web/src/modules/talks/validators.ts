const EMAIL_MARKER = "@";

export function isValidEmail(value: string): boolean {
  return value.includes(EMAIL_MARKER);
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
    return parsed.pathname.startsWith("/api/files/") || parsed.hostname.endsWith(".r2.dev");
  } catch {
    return false;
  }
}
