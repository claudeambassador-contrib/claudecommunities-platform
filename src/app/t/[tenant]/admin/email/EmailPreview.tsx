"use client";

import { Monitor, Smartphone, X } from "lucide-react";
import { useState } from "react";
import { useTenantConfig } from "@/components/TenantConfigProvider";
import { renderCampaignHtml } from "@/lib/email/blocks";
import { wrapEmailContent } from "@/lib/email/wrap";
import CampaignStats from "./CampaignStats";

interface Campaign {
  id: string;
  name: string;
  subject: string;
  html: string;
  blocks?: string | null;
  status: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  sentAt: string | null;
}

interface Props {
  campaign: Campaign;
  onClose: () => void;
}

export default function EmailPreview({ campaign, onClose }: Props) {
  const { siteUrl, appUrl } = useTenantConfig();
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
  const [showStats, setShowStats] = useState(campaign.status === "sent");

  // Regenerate HTML from blocks when available so fixes to blockToHtml
  // propagate to existing campaigns without requiring a manual re-save.
  // Falls back to the stored html (legacy / imported-HTML campaigns).
  const renderedHtml = renderCampaignHtml(campaign.html, campaign.blocks, { siteUrl });

  // Replace placeholders with sample data
  const previewHtml = renderedHtml
    .replace(/\{\{name\}\}/g, "John")
    .replace(/\{\{email\}\}/g, "john@example.com")
    .replace(/\{\{subject\}\}/g, campaign.subject);

  // Use the exact wrapper the send pipeline uses so the preview matches the
  // delivered email. wrapEmailContent normalizes any embedded doctype/html/body
  // tags so legacy campaigns and full-document templates both render correctly.
  const fullHtml = wrapEmailContent(previewHtml, { appUrl });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#2D2926] rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <div>
            <h2 className="text-lg font-semibold text-white">{campaign.name}</h2>
            <p className="text-sm text-[#78716C]">Subject: {campaign.subject}</p>
          </div>
          <div className="flex items-center gap-3">
            {campaign.status === "sent" && (
              <div className="flex rounded-lg overflow-hidden border border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowStats(false)}
                  className={`px-3 py-1.5 text-sm transition-colors ${
                    !showStats ? "bg-[#D4836A] text-white" : "text-[#A8A29E] hover:bg-white/[0.05]"
                  }`}
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => setShowStats(true)}
                  className={`px-3 py-1.5 text-sm transition-colors ${
                    showStats ? "bg-[#D4836A] text-white" : "text-[#A8A29E] hover:bg-white/[0.05]"
                  }`}
                >
                  Stats
                </button>
              </div>
            )}
            {!showStats && (
              <div className="flex rounded-lg overflow-hidden border border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setViewMode("desktop")}
                  className={`p-2 transition-colors ${
                    viewMode === "desktop"
                      ? "bg-[#D4836A] text-white"
                      : "text-[#A8A29E] hover:bg-white/[0.05]"
                  }`}
                  title="Desktop view"
                >
                  <Monitor className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("mobile")}
                  className={`p-2 transition-colors ${
                    viewMode === "mobile"
                      ? "bg-[#D4836A] text-white"
                      : "text-[#A8A29E] hover:bg-white/[0.05]"
                  }`}
                  title="Mobile view"
                >
                  <Smartphone className="w-4 h-4" />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-[#78716C] hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5 bg-[#1C1917]">
          {showStats ? (
            <CampaignStats campaign={campaign} />
          ) : (
            <div
              className={`mx-auto transition-all ${
                viewMode === "mobile" ? "max-w-[375px]" : "max-w-[600px]"
              }`}
            >
              <div className="bg-white rounded-lg overflow-hidden shadow-xl">
                <iframe
                  srcDoc={fullHtml}
                  className="w-full border-0"
                  style={{ height: viewMode === "mobile" ? "600px" : "500px" }}
                  title="Email Preview"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
