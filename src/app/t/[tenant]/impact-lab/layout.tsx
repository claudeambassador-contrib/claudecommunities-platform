import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Impact Lab Portal",
  description: "Participant portal for the Claude Impact Lab hackathon.",
  robots: { index: false, follow: false },
};

export default function ImpactLabLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-claude-dark text-text-primary">{children}</div>;
}
