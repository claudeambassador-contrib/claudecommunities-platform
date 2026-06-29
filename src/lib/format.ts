/**
 * Shared display formatters. Previously copy-pasted across PostCard,
 * PostModal, CommentSection, and PostComposer.
 */

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Relative timestamp for feed content. `long` reads "5 minutes ago",
 * `short` reads "5m ago"; both fall back to an absolute date after a week.
 */
export function getTimeAgo(dateString: string, style: "long" | "short" = "long"): string {
  const date = new Date(dateString);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    return style === "long" ? `${mins} minute${mins > 1 ? "s" : ""} ago` : `${mins}m ago`;
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return style === "long" ? `${hours} hour${hours > 1 ? "s" : ""} ago` : `${hours}h ago`;
  }
  if (seconds < 604800) {
    const days = Math.floor(seconds / 86400);
    return style === "long" ? `${days} day${days > 1 ? "s" : ""} ago` : `${days}d ago`;
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(style === "long" ? { year: "numeric" } : {}),
  });
}
