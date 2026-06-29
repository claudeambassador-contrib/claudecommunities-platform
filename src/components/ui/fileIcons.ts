import { File, FileText, Image as ImageIcon, Video } from "lucide-react";

/** Maps a MIME type to the lucide icon used for attachment chips. */
export function getFileIcon(type: string) {
  if (type.startsWith("image/")) return ImageIcon;
  if (type.startsWith("video/")) return Video;
  if (type.includes("pdf") || type.includes("document") || type.includes("text")) return FileText;
  return File;
}
