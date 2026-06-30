/**
 * Escape a string for safe interpolation into raw HTML, neutralising the five
 * characters that can break out of element/attribute context.
 *
 * Use on any user- or admin-provided value before placing it in raw HTML
 * (email templates, the lesson/markdown preview parsers, etc.). Do NOT use on
 * values that are intentionally HTML (e.g. an admin-authored campaign body).
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
