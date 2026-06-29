const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/g;

export function extractFirstUrl(text: string): string | null {
  const match = text.match(URL_REGEX);
  return match ? match[0] : null;
}

export function extractUrls(text: string): string[] {
  return text.match(URL_REGEX) || [];
}

export { URL_REGEX };
