"use client";

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Clock,
  Edit,
  Eye,
  Mail,
  MoreHorizontal,
  Plus,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import { Can } from "@/components/admin/Can";
import { useTenantConfig } from "@/components/TenantConfigProvider";
import { htmlToBlocks } from "@/lib/email/html-to-blocks";
import { blocksToHtml, type EmailBlock } from "./EmailBuilder";
import EmailComposer from "./EmailComposer";
import EmailPreview from "./EmailPreview";

interface TemplateOption {
  id: string;
  name: string;
  description?: string;
  category: string;
  blocks?: string;
}

function TemplatePreviewMini({ blocks }: { blocks?: string }) {
  const ref = React.useRef<HTMLIFrameElement>(null);
  const { siteUrl } = useTenantConfig();
  const html = React.useMemo(() => {
    if (!blocks) return "";
    try {
      const parsed = JSON.parse(blocks);
      if (Array.isArray(parsed)) {
        return blocksToHtml(
          parsed.map((b: { type: string; props: Record<string, unknown> }) => ({
            id: Math.random().toString(36).slice(2),
            type: b.type as
              | "header"
              | "text"
              | "image"
              | "button"
              | "divider"
              | "spacer"
              | "columns"
              | "social"
              | "html",
            props: b.props,
          })),
          { siteUrl },
        );
      }
    } catch {
      /* */
    }
    return "";
  }, [blocks, siteUrl]);

  React.useEffect(() => {
    if (ref.current && html) {
      const doc = ref.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(
          `<!DOCTYPE html><html><head><style>body{margin:0;padding:6px;font-family:-apple-system,sans-serif;font-size:12px;background:#1C1917;color:#E7E5E4;overflow:hidden}table{border-collapse:collapse}img{max-width:100%;height:auto}*{box-sizing:border-box}</style></head><body>${html}</body></html>`,
        );
        doc.close();
      }
    }
  }, [html]);

  return (
    <iframe
      ref={ref}
      className="w-[300%] h-[300%] origin-top-left border-0 pointer-events-none"
      style={{ transform: "scale(0.333)" }}
      title="Preview"
      sandbox="allow-same-origin"
    />
  );
}

interface Campaign {
  id: string;
  name: string;
  subject: string;
  html: string;
  blocks: string | null;
  templateType: string;
  status: string;
  segmentQuery: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  updatedAt: string;
  _count?: { sends: number };
}

export default function AdminEmailPage() {
  const tenantConfig = useTenantConfig();
  const searchParams = useSearchParams();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [previewCampaign, setPreviewCampaign] = useState<Campaign | null>(null);
  const [actionMenu, setActionMenu] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [templateBlocks, setTemplateBlocks] = useState<EmailBlock[] | undefined>(undefined);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [availableTemplates, setAvailableTemplates] = useState<TemplateOption[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchCampaigns is a stable mount-only fetch; adding it would re-run on every render
  useEffect(() => {
    fetchCampaigns();
  }, []);

  // Handle ?template=ID query param from templates page
  useEffect(() => {
    const templateId = searchParams.get("template");
    if (templateId) {
      fetch(`/api/admin/email/templates/${templateId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((template) => {
          if (template?.blocks) {
            try {
              setTemplateBlocks(JSON.parse(template.blocks));
              setShowComposer(true);
            } catch {
              /* ignore parse errors */
            }
          }
        });
    }
  }, [searchParams]);

  const fetchCampaigns = async () => {
    try {
      const res = await fetch("/api/admin/email/campaigns");
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data);
      }
    } catch (error) {
      console.error("Failed to fetch campaigns:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this campaign?")) return;

    try {
      const res = await fetch(`/api/admin/email/campaigns/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setCampaigns(campaigns.filter((c) => c.id !== id));
        setActionMenu(null);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete campaign");
      }
    } catch (error) {
      console.error("Failed to delete:", error);
      alert("Failed to delete campaign");
    }
  };

  const handleSendTest = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/email/campaigns/${id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Test email sent to ${data.sentTo}`);
      } else {
        alert(data.error || "Failed to send test email");
      }
    } catch (error) {
      console.error("Failed to send test:", error);
      alert("Failed to send test email");
    }
    setActionMenu(null);
  };

  const handleSendCampaign = async (id: string) => {
    const campaign = campaigns.find((c) => c.id === id);
    if (!campaign) return;

    if (
      !confirm(
        `Are you sure you want to send "${campaign.name}" to all recipients? This cannot be undone.`,
      )
    ) {
      return;
    }

    setSending(id);
    setActionMenu(null);

    try {
      const res = await fetch(`/api/admin/email/campaigns/${id}/send`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok) {
        alert(data.message || `Campaign sending to ${data.totalRecipients} recipients!`);
        fetchCampaigns();
      } else {
        alert(data.error || "Failed to send campaign");
      }
    } catch (error) {
      console.error("Failed to send:", error);
      alert("Failed to send campaign");
    } finally {
      setSending(null);
    }
  };

  const handleSave = async (campaignData: Partial<Campaign>) => {
    try {
      if (editingCampaign) {
        const res = await fetch(`/api/admin/email/campaigns/${editingCampaign.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(campaignData),
        });
        if (res.ok) {
          fetchCampaigns();
          setShowComposer(false);
          setEditingCampaign(null);
          setTemplateBlocks(undefined);
        }
      } else {
        const res = await fetch("/api/admin/email/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(campaignData),
        });
        if (res.ok) {
          fetchCampaigns();
          setShowComposer(false);
          setTemplateBlocks(undefined);
        }
      }
    } catch (error) {
      console.error("Failed to save:", error);
      alert("Failed to save campaign");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-white/[0.05] text-[#A8A29E]">
            <Edit className="w-3 h-3" />
            Draft
          </span>
        );
      case "scheduled":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-blue-500/20 text-blue-400">
            <Clock className="w-3 h-3" />
            Scheduled
          </span>
        );
      case "sending":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-[#D4836A]/20 text-[#D4836A]">
            <Send className="w-3 h-3 animate-pulse" />
            Sending
          </span>
        );
      case "sent":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-green-500/20 text-green-400">
            <CheckCircle className="w-3 h-3" />
            Sent
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(tenantConfig.lang, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const openTemplatePicker = async () => {
    setShowTemplatePicker(true);
    setLoadingTemplates(true);
    try {
      const res = await fetch("/api/admin/email/templates");
      if (res.ok) {
        const data = await res.json();
        setAvailableTemplates(data);
      }
    } catch {
      /* ignore */
    }
    setLoadingTemplates(false);
  };

  const selectTemplate = (template: TemplateOption | null) => {
    if (template?.blocks) {
      try {
        const parsed = JSON.parse(template.blocks);
        const mapped = parsed.map((b: { type: string; props: Record<string, unknown> }) => ({
          id: Math.random().toString(36).slice(2, 10),
          type: b.type,
          props: b.props,
        }));
        setTemplateBlocks(mapped);
      } catch {
        setTemplateBlocks(undefined);
      }
    } else {
      setTemplateBlocks(undefined);
    }
    setShowTemplatePicker(false);
    setShowComposer(true);
  };

  if (showComposer) {
    return (
      <EmailComposer
        campaign={editingCampaign}
        onSave={handleSave}
        onCancel={() => {
          setShowComposer(false);
          setEditingCampaign(null);
          setTemplateBlocks(undefined);
        }}
        initialTemplateBlocks={templateBlocks}
      />
    );
  }

  if (showTemplatePicker) {
    return (
      <div className="min-h-screen bg-[#1C1917] pt-[72px]">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-8">
            <button
              type="button"
              onClick={() => setShowTemplatePicker(false)}
              className="p-2 rounded-lg text-[#A8A29E] hover:text-white hover:bg-white/5 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">Choose a Template</h1>
              <p className="text-sm text-[#78716C] mt-0.5">
                Start with a pre-built design or blank canvas
              </p>
            </div>
          </div>

          {/* Start Blank */}
          <button
            type="button"
            onClick={() => selectTemplate(null)}
            className="w-full mb-6 p-6 rounded-2xl border-2 border-dashed border-white/[0.08] hover:border-[#D4836A]/40 hover:bg-[#D4836A]/[0.03] transition-all text-left group"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-white/[0.03] group-hover:bg-[#D4836A]/10 flex items-center justify-center transition-colors">
                <Plus className="w-7 h-7 text-[#5C5955] group-hover:text-[#D4836A] transition-colors" />
              </div>
              <div>
                <p className="text-white font-semibold text-lg">Start from Scratch</p>
                <p className="text-[#78716C] text-sm">
                  Begin with a blank canvas and build your email block by block
                </p>
              </div>
            </div>
          </button>

          {/* Templates Grid */}
          {loadingTemplates ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-[#D4836A] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableTemplates.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => selectTemplate(t)}
                  className="text-left rounded-2xl border border-white/[0.06] bg-[#2D2926] hover:border-[#D4836A]/30 hover:bg-[#2D2926]/80 transition-all overflow-hidden group"
                >
                  {/* Preview */}
                  <div className="h-44 bg-[#1C1917] overflow-hidden relative">
                    <TemplatePreviewMini blocks={t.blocks} />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#2D2926] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  {/* Info */}
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-white font-semibold text-sm">{t.name}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-[#78716C] capitalize">
                        {t.category}
                      </span>
                    </div>
                    {t.description && (
                      <p className="text-[#78716C] text-xs line-clamp-2">{t.description}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1C1917]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Actions */}
        <Can permission="email.edit">
          <div className="flex items-center justify-end mb-8">
            <button
              type="button"
              onClick={openTemplatePicker}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#D4836A] text-white hover:bg-[#c4775f] transition-colors"
            >
              <Plus className="w-5 h-5" />
              New Campaign
            </button>
          </div>
        </Can>

        {/* Campaigns List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-[#D4836A] border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-12">
            <Mail className="w-12 h-12 text-[#78716C] mx-auto mb-4" />
            <p className="text-[#78716C] mb-4">No campaigns yet.</p>
            <Can permission="email.edit">
              <button
                type="button"
                onClick={() => setShowComposer(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#D4836A] text-white hover:bg-[#c4775f] transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create your first campaign
              </button>
            </Can>
          </div>
        ) : (
          <div className="space-y-4">
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="bg-[#2D2926] rounded-2xl border border-white/[0.06] p-5 hover:border-white/[0.1] transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-white truncate">{campaign.name}</h3>
                      {getStatusBadge(campaign.status)}
                    </div>
                    <p className="text-[#A8A29E] text-sm mb-3 truncate">
                      Subject: {campaign.subject}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-[#78716C]">
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {campaign.status === "sent"
                          ? `${campaign.sentCount}/${campaign.recipientCount} sent`
                          : `${campaign.recipientCount || "All"} recipients`}
                      </span>
                      {campaign.status === "sent" && campaign.failedCount > 0 && (
                        <span className="flex items-center gap-1 text-red-400">
                          <AlertCircle className="w-4 h-4" />
                          {campaign.failedCount} failed
                        </span>
                      )}
                      <span>
                        {campaign.sentAt
                          ? `Sent ${formatDate(campaign.sentAt)}`
                          : `Created ${formatDate(campaign.createdAt)}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {sending === campaign.id && (
                      <div className="w-5 h-5 border-2 border-[#D4836A] border-t-transparent rounded-full animate-spin"></div>
                    )}
                    <button
                      type="button"
                      onClick={() => setPreviewCampaign(campaign)}
                      className="p-2 rounded-lg text-[#78716C] hover:text-white hover:bg-white/5 transition-colors"
                      title="Preview"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setActionMenu(actionMenu === campaign.id ? null : campaign.id)
                        }
                        className="p-2 rounded-lg text-[#78716C] hover:text-white hover:bg-white/5 transition-colors"
                      >
                        <MoreHorizontal className="w-5 h-5" />
                      </button>
                      {actionMenu === campaign.id && (
                        <>
                          <button
                            type="button"
                            aria-label="Close menu"
                            className="fixed inset-0 z-10 cursor-default"
                            onClick={() => setActionMenu(null)}
                          />
                          <div className="absolute right-0 top-full mt-1 w-48 bg-[#1C1917] rounded-lg border border-white/[0.1] shadow-xl z-20 overflow-hidden">
                            {campaign.status === "draft" && (
                              <>
                                <Can permission="email.edit">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingCampaign(campaign);
                                      // Use saved blocks JSON if available, fall back to HTML parsing
                                      if (campaign.blocks) {
                                        try {
                                          const parsed = JSON.parse(campaign.blocks);
                                          setTemplateBlocks(
                                            parsed.map(
                                              (b: {
                                                type: string;
                                                props: Record<string, unknown>;
                                              }) => ({
                                                id: Math.random().toString(36).slice(2, 10),
                                                type: b.type,
                                                props: b.props,
                                              }),
                                            ),
                                          );
                                        } catch {
                                          if (campaign.html)
                                            setTemplateBlocks(htmlToBlocks(campaign.html));
                                        }
                                      } else if (campaign.html) {
                                        setTemplateBlocks(htmlToBlocks(campaign.html));
                                      }
                                      setShowComposer(true);
                                      setActionMenu(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-white hover:bg-white/5 transition-colors"
                                  >
                                    <Edit className="w-4 h-4" />
                                    Edit Campaign
                                  </button>
                                </Can>
                                <Can permission="email.send">
                                  <button
                                    type="button"
                                    onClick={() => handleSendTest(campaign.id)}
                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-white hover:bg-white/5 transition-colors"
                                  >
                                    <Mail className="w-4 h-4" />
                                    Send Test Email
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSendCampaign(campaign.id)}
                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[#D4836A] hover:bg-[#D4836A]/10 transition-colors"
                                  >
                                    <Send className="w-4 h-4" />
                                    Send Campaign
                                  </button>
                                </Can>
                                <hr className="border-white/[0.06] my-1" />
                              </>
                            )}
                            {campaign.status === "sent" && (
                              <button
                                type="button"
                                onClick={() => {
                                  // Show stats modal
                                  setPreviewCampaign(campaign);
                                  setActionMenu(null);
                                }}
                                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-white hover:bg-white/5 transition-colors"
                              >
                                <CheckCircle className="w-4 h-4" />
                                View Stats
                              </button>
                            )}
                            <Can permission="email.delete">
                              <button
                                type="button"
                                onClick={() => handleDelete(campaign.id)}
                                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete Campaign
                              </button>
                            </Can>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewCampaign && (
        <EmailPreview campaign={previewCampaign} onClose={() => setPreviewCampaign(null)} />
      )}
    </div>
  );
}
