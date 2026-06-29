/**
 * Strip markdown syntax from text for use in plain-text contexts
 * (email previews, card excerpts, meta descriptions, etc.)
 */
export function stripMarkdown(text: string): string {
  let result = text;

  // Code blocks → just the code
  result = result.replace(/```\w*\n([\s\S]*?)```/g, "$1");

  // Inline code
  result = result.replace(/`([^`]+)`/g, "$1");

  // Headers (remove # prefix)
  result = result.replace(/^#{1,3}\s+/gm, "");

  // Bold
  result = result.replace(/\*\*([^*]+)\*\*/g, "$1");

  // Italic
  result = result.replace(/_([^_]+)_/g, "$1");

  // Links → just the text
  result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // Blockquotes
  result = result.replace(/^>\s+/gm, "");

  // Unordered list markers
  result = result.replace(/^-\s+/gm, "");

  // Ordered list markers
  result = result.replace(/^\d+\.\s+/gm, "");

  return result;
}
