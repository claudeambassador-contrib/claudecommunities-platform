import { BookOpen, Code, LayoutGrid, type LucideIcon, Paintbrush, Star, Users } from "lucide-react";
import type { AllowedIcon } from "@/lib/cms/blocks";

/**
 * Maps an `ALLOWED_ICONS` name to its lucide component. The read validator only
 * checks that `icon` is a string (not membership), so unknown names fall back to
 * a sensible default rather than rendering `undefined`.
 */
const ICONS: Record<AllowedIcon, LucideIcon> = {
  Users,
  BookOpen,
  Star,
  LayoutGrid,
  Code,
  Paintbrush,
};

export function iconFor(name: string): LucideIcon {
  return ICONS[name as AllowedIcon] ?? LayoutGrid;
}
