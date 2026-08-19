const ALLOWED_MEETING_HOSTS = [
  "zoom.us",
  "us02web.zoom.us",
  "us04web.zoom.us",
  "us05web.zoom.us",
  "us06web.zoom.us",
  "meet.google.com",
  "teams.microsoft.com",
  "teams.live.com",
  "lu.ma",
  "luma.com",
];

function hostnameAllowed(hostname: string, allowed: readonly string[]): boolean {
  return allowed.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

export function isAllowedMeetingUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return false;
    }
    return hostnameAllowed(parsed.hostname, ALLOWED_MEETING_HOSTS);
  } catch {
    return false;
  }
}

export function isAllowedLumaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function isAllowedResourceUrl(url: string): boolean {
  if (url.startsWith("/api/files/")) {
    return true;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function isAllowedImageUrl(url: string): boolean {
  if (url.startsWith("/api/files/")) {
    return true;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return false;
    }
    return parsed.hostname === "images.lumacdn.com";
  } catch {
    return false;
  }
}

const TIMEZONE_RE = /^[A-Za-z_+\-/0-9]+$/;

export function isValidTimezone(timezone: string): boolean {
  return TIMEZONE_RE.test(timezone);
}
