"use client";

import {
  AlertCircle,
  ArrowRight,
  Calendar,
  Eye,
  EyeOff,
  Layout,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Can } from "@/components/admin/Can";
import { useTenantRouter } from "@/components/TenantBaseProvider";
import { useTenantConfig } from "@/components/TenantConfigProvider";
import { blocksToHtml } from "../EmailBuilder";

interface Template {
  id: string;
  name: string;
  description?: string;
  category: string;
  blocks?: string;
  html: string;
  createdAt: string;
}

const CATEGORIES = ["All", "Announcement", "Newsletter", "Event", "Welcome", "Custom"] as const;

type Category = (typeof CATEGORIES)[number];

const categoryColors: Record<string, string> = {
  Announcement: "bg-blue-500/15 text-blue-400",
  Newsletter: "bg-purple-500/15 text-purple-400",
  Event: "bg-orange-500/15 text-orange-400",
  Welcome: "bg-green-500/15 text-green-400",
  Custom: "bg-[#78716C]/20 text-[#78716C]",
};

function TemplatePreview({ html, blocks }: { html: string; blocks?: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { siteUrl } = useTenantConfig();

  // Generate HTML from blocks if html is empty
  const previewHtml = useMemo(() => {
    if (html) return html;
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
      /* ignore parse errors */
    }
    return "";
  }, [html, blocks, siteUrl]);

  useEffect(() => {
    if (iframeRef.current && previewHtml) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { margin: 0; padding: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; background: #1C1917; color: #E7E5E4; overflow: hidden; }
              img { max-width: 100%; height: auto; }
              * { box-sizing: border-box; }
              table { border-collapse: collapse; }
            </style>
          </head>
          <body>${previewHtml}</body>
          </html>
        `);
        doc.close();
      }
    }
  }, [previewHtml]);

  return (
    <div className="relative w-full h-40 bg-white rounded-lg overflow-hidden">
      <iframe
        ref={iframeRef}
        className="w-[400%] h-[400%] origin-top-left border-0 pointer-events-none"
        style={{ transform: "scale(0.25)" }}
        title="Template preview"
        sandbox="allow-same-origin"
      />
    </div>
  );
}

const IMPORT_CATEGORIES = ["announcement", "newsletter", "event", "welcome", "custom"] as const;

function ImportHTMLModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const [html, setHtml] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("custom");
  const [showPreview, setShowPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const previewIframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (previewIframeRef.current && showPreview && html) {
      const doc = previewIframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(
          `<!DOCTYPE html><html><head><style>body{margin:0;padding:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#1C1917;color:#E7E5E4;}img{max-width:100%;height:auto;}*{box-sizing:border-box;}table{border-collapse:collapse;}</style></head><body>${html}</body></html>`,
        );
        doc.close();
      }
    }
  }, [html, showPreview]);

  const handleImport = async () => {
    if (!name.trim()) {
      setImportError("Template name is required");
      return;
    }
    if (!html.trim()) {
      setImportError("HTML content is required");
      return;
    }
    setImporting(true);
    setImportError(null);
    try {
      const blocks = JSON.stringify([{ type: "html", props: { code: html } }]);
      const res = await fetch("/api/admin/email/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), category, blocks, html }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to import template");
      }
      onImported();
      onClose();
      setHtml("");
      setName("");
      setCategory("custom");
      setShowPreview(false);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/[0.06] bg-[#2D2926] shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b border-white/[0.06] bg-[#2D2926] rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-[#D4836A]" />
            <h2 className="text-lg font-semibold text-[#E7E5E4]">Import HTML</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] text-[#78716C] hover:text-[#E7E5E4] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Name input */}
          <div>
            <label
              htmlFor="import-template-name"
              className="block text-sm font-medium text-[#A8A29E] mb-1.5"
            >
              Template Name
            </label>
            <input
              id="import-template-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My Custom Newsletter"
              className="w-full px-3 py-2 rounded-xl border border-white/[0.06] bg-[#1C1917] text-[#E7E5E4] placeholder-[#78716C] text-sm focus:outline-none focus:ring-2 focus:ring-[#D4836A]/50"
            />
          </div>

          {/* Category select */}
          <div>
            <label
              htmlFor="import-template-category"
              className="block text-sm font-medium text-[#A8A29E] mb-1.5"
            >
              Category
            </label>
            <select
              id="import-template-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-white/[0.06] bg-[#1C1917] text-[#E7E5E4] text-sm focus:outline-none focus:ring-2 focus:ring-[#D4836A]/50"
            >
              {IMPORT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* HTML textarea */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="import-template-html" className="text-sm font-medium text-[#A8A29E]">
                HTML Content
              </label>
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-1.5 text-xs text-[#D4836A] hover:text-[#c4775f] transition"
              >
                {showPreview ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    Hide Preview
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    Preview
                  </>
                )}
              </button>
            </div>
            <textarea
              id="import-template-html"
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              placeholder="Paste your raw HTML here..."
              rows={10}
              className="w-full px-3 py-2 rounded-xl border border-white/[0.06] bg-[#1C1917] text-[#E7E5E4] placeholder-[#78716C] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#D4836A]/50 resize-y"
            />
          </div>

          {/* Preview iframe */}
          {showPreview && html.trim() && (
            <div>
              <label
                htmlFor="import-template-preview"
                className="block text-sm font-medium text-[#A8A29E] mb-1.5"
              >
                Preview
              </label>
              <div className="rounded-xl border border-white/[0.06] overflow-hidden bg-[#1C1917]">
                <iframe
                  id="import-template-preview"
                  ref={previewIframeRef}
                  className="w-full border-0"
                  style={{ height: "400px" }}
                  title="HTML Preview"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>
          )}

          {/* Error */}
          {importError && (
            <div className="flex items-center gap-2 p-3 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {importError}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-[#78716C] hover:text-[#E7E5E4] transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={importing}
              className="flex items-center gap-2 px-5 py-2 bg-[#D4836A] text-white rounded-xl hover:bg-[#c4775f] transition text-sm font-medium disabled:opacity-50"
            >
              {importing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              Import
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const config = useTenantConfig();
  const router = useTenantRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetch once on mount; fetchTemplates is stable for this purpose
  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/email/templates");
      if (!res.ok) throw new Error("Failed to fetch templates");
      const data = await res.json();
      setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/email/templates/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete template");
      setTemplates(templates.filter((t) => t.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete template");
    } finally {
      setDeleting(null);
    }
  };

  const handleUseTemplate = (id: string) => {
    router.push(`/admin/email?template=${id}`);
  };

  const filtered =
    activeCategory === "All"
      ? templates
      : templates.filter((t) => t.category.toLowerCase() === activeCategory.toLowerCase());

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(config.lang, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-[#1C1917] pt-[72px]">
      <div className="max-w-[1400px] mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#E7E5E4]">Templates</h1>
            <p className="text-sm text-[#78716C] mt-1">
              {templates.length} template{templates.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Can permission="email.edit">
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#2D2926] text-[#E7E5E4] rounded-xl border border-white/[0.06] hover:bg-[#D4836A] hover:border-[#D4836A] transition text-sm font-medium"
            >
              <Upload className="w-4 h-4" />
              Import HTML
            </button>
          </Can>
        </div>

        {/* Import HTML Modal */}
        <ImportHTMLModal
          open={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImported={() => fetchTemplates()}
        />

        {/* Category filter pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          {CATEGORIES.map((cat) => (
            <button
              type="button"
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-sm transition ${
                activeCategory === cat
                  ? "bg-[#D4836A] text-white"
                  : "bg-[#2D2926] text-[#78716C] hover:text-[#E7E5E4] border border-white/[0.06]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Error state */}
        {error && (
          <div className="flex items-center gap-3 p-4 mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Loading state */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-[#D4836A] animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#78716C]">
            <Layout className="w-10 h-10 mb-3 opacity-50" />
            <p className="text-sm">
              {activeCategory === "All"
                ? "No templates yet"
                : `No ${activeCategory.toLowerCase()} templates`}
            </p>
          </div>
        ) : (
          /* Template grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((template) => (
              <div
                key={template.id}
                className="rounded-2xl border border-white/[0.06] bg-[#2D2926] overflow-hidden group"
              >
                {/* Preview */}
                <TemplatePreview html={template.html} blocks={template.blocks} />

                {/* Info */}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-semibold text-[#E7E5E4] line-clamp-1">
                      {template.name}
                    </h3>
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full flex-shrink-0 ml-2 ${
                        categoryColors[template.category] || categoryColors.Custom
                      }`}
                    >
                      {template.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-[#78716C] mb-4">
                    <Calendar className="w-3 h-3" />
                    {formatDate(template.createdAt)}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Can permission="email.edit">
                      <button
                        type="button"
                        onClick={() => handleUseTemplate(template.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#D4836A] text-white rounded-xl hover:bg-[#c4775f] transition text-sm font-medium"
                      >
                        Use Template
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </Can>
                    <Can permission="email.delete">
                      <button
                        type="button"
                        onClick={() => handleDelete(template.id)}
                        disabled={deleting === template.id}
                        className="p-2 rounded-xl border border-white/[0.06] hover:bg-red-500/10 hover:border-red-500/20 text-[#78716C] hover:text-red-400 transition"
                      >
                        {deleting === template.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </Can>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
