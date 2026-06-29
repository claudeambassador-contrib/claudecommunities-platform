/**
 * Allowlisted icons for industry-page use-case cards.
 *
 * Single source of truth shared by the renderer (`/for/[slug]`), the admin
 * editor's icon picker, and the save-path validator (`services/industries`).
 * Constraining `useCase.icon` to this set means the editor offers a fixed picker
 * and the service can reject arbitrary strings — no arbitrary icon imports, and
 * the renderer's `INDUSTRY_ICON_MAP[name]` lookup always resolves.
 */
import {
  BarChart3,
  Camera,
  ClipboardCheck,
  ClipboardList,
  Code,
  CreditCard,
  Eye,
  FileText,
  Globe,
  GraduationCap,
  Home,
  Layers,
  Layout,
  LayoutDashboard,
  Lightbulb,
  Link as LinkIcon,
  type LucideIcon,
  Mail,
  MapPin,
  MessageSquare,
  Monitor,
  Package,
  PenTool,
  Play,
  Plug,
  Presentation,
  Rocket,
  Search,
  Shield,
  ShoppingBag,
  Split,
  Target,
  UserCircle,
  Users,
  Wallet,
} from "lucide-react";

/** name → lucide component. The renderer maps `useCase.icon` through this. */
export const INDUSTRY_ICON_MAP: Record<string, LucideIcon> = {
  ShoppingBag,
  CreditCard,
  Package,
  Wallet,
  ClipboardList,
  BarChart3,
  Layout,
  Mail,
  Split,
  Users,
  FileText,
  Rocket,
  Shield,
  Code,
  LayoutDashboard,
  Layers,
  Home,
  Search,
  UserCircle,
  Globe,
  MapPin,
  Camera,
  Monitor,
  Target,
  PenTool,
  Lightbulb,
  Presentation,
  MessageSquare,
  Plug,
  GraduationCap,
  ClipboardCheck,
  Play,
  Link: LinkIcon,
  Eye,
};

/** The allowlisted icon names (the editor's picker + the validator). */
export const INDUSTRY_ICON_NAMES = Object.keys(INDUSTRY_ICON_MAP);

/** True iff `name` is an allowlisted use-case icon. */
export function isIndustryIcon(name: string): boolean {
  return name in INDUSTRY_ICON_MAP;
}
