"use client";

import {
  AlertCircle,
  Calendar,
  Edit,
  Loader2,
  Pause,
  Play,
  Plus,
  Trash2,
  Users,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Can } from "@/components/admin/Can";
import { useTenantConfig } from "@/components/TenantConfigProvider";

interface Automation {
  id: string;
  name: string;
  triggerType: string;
  status: "draft" | "active" | "paused";
  enrolledCount: number;
  createdAt: string;
  updatedAt: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-[#78716C]/20 text-[#78716C]" },
  active: { label: "Active", className: "bg-green-500/15 text-green-400" },
  paused: { label: "Paused", className: "bg-amber-500/15 text-amber-400" },
};

const triggerConfig: Record<string, { label: string; className: string }> = {
  signup: { label: "Signup", className: "bg-blue-500/15 text-blue-400" },
  tag_added: { label: "Tag Added", className: "bg-purple-500/15 text-purple-400" },
  event_rsvp: { label: "Event RSVP", className: "bg-orange-500/15 text-orange-400" },
  manual: { label: "Manual", className: "bg-[#78716C]/20 text-[#78716C]" },
};

export default function AutomationsPage() {
  const config = useTenantConfig();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only initial fetch
  useEffect(() => {
    fetchAutomations();
  }, []);

  const fetchAutomations = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/email/automations");
      if (!res.ok) throw new Error("Failed to fetch automations");
      const data = await res.json();
      setAutomations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load automations");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (automation: Automation) => {
    const newStatus = automation.status === "active" ? "paused" : "active";
    setToggling(automation.id);
    try {
      const res = await fetch(`/api/admin/email/automations/${automation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update automation");
      setAutomations(
        automations.map((a) => (a.id === automation.id ? { ...a, status: newStatus } : a)),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update automation");
    } finally {
      setToggling(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this automation?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/email/automations/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete automation");
      setAutomations(automations.filter((a) => a.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete automation");
    } finally {
      setDeletingId(null);
    }
  };

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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#E7E5E4]">Automations</h1>
            <p className="text-sm text-[#78716C] mt-1">Automated email workflows</p>
          </div>
          <Can permission="email.edit">
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-2 bg-[#D4836A] text-white rounded-xl hover:bg-[#c4775f] transition text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              New Automation
            </button>
          </Can>
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
        ) : automations.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-white/[0.06] bg-[#2D2926]">
            <div className="w-14 h-14 rounded-full bg-[#D4836A]/15 flex items-center justify-center mb-4">
              <Zap className="w-7 h-7 text-[#D4836A]" />
            </div>
            <h3 className="text-lg font-medium text-[#E7E5E4] mb-1">No automations yet</h3>
            <p className="text-sm text-[#78716C] mb-5 max-w-sm text-center">
              Create automated email workflows to engage your community members at the right moment.
            </p>
            <Can permission="email.edit">
              <button
                type="button"
                className="flex items-center gap-2 px-4 py-2 bg-[#D4836A] text-white rounded-xl hover:bg-[#c4775f] transition text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Create Your First Automation
              </button>
            </Can>
          </div>
        ) : (
          /* Automation cards */
          <div className="space-y-3">
            {automations.map((automation) => {
              const status = statusConfig[automation.status] || statusConfig.draft;
              const trigger = triggerConfig[automation.triggerType] || triggerConfig.manual;

              return (
                <div
                  key={automation.id}
                  className="rounded-2xl border border-white/[0.06] bg-[#2D2926] p-5 hover:bg-white/[0.02] transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {/* Name and badges */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-[#E7E5E4]">{automation.name}</h3>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${trigger.className}`}>
                          {trigger.label}
                        </span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${status.className}`}>
                          {status.label}
                        </span>
                      </div>

                      {/* Metadata */}
                      <div className="flex items-center gap-4 text-xs text-[#78716C]">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {automation.enrolledCount} enrolled
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Created {formatDate(automation.createdAt)}
                        </span>
                      </div>
                    </div>

                    <AutomationRowActions
                      automation={automation}
                      toggling={toggling === automation.id}
                      deleting={deletingId === automation.id}
                      onToggle={() => handleToggleStatus(automation)}
                      onDelete={() => handleDelete(automation.id)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function AutomationRowActions({
  automation,
  toggling,
  deleting,
  onToggle,
  onDelete,
}: {
  automation: Automation;
  toggling: boolean;
  deleting: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const isActive = automation.status === "active";
  const isDraft = automation.status === "draft";

  return (
    <div className="flex items-center gap-1.5 ml-4 flex-shrink-0">
      <Can permission="email.edit">
        <button
          type="button"
          className="p-2 rounded-lg hover:bg-white/[0.05] text-[#78716C] hover:text-[#E7E5E4] transition"
          title="Edit"
        >
          <Edit className="w-4 h-4" />
        </button>

        {!isDraft && (
          <button
            type="button"
            onClick={onToggle}
            disabled={toggling}
            className={`p-2 rounded-lg transition ${
              isActive
                ? "hover:bg-amber-500/10 text-[#78716C] hover:text-amber-400"
                : "hover:bg-green-500/10 text-[#78716C] hover:text-green-400"
            }`}
            title={isActive ? "Pause" : "Activate"}
          >
            {toggling ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isActive ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </button>
        )}

        {isDraft && (
          <button
            type="button"
            onClick={onToggle}
            disabled={toggling}
            className="p-2 rounded-lg hover:bg-green-500/10 text-[#78716C] hover:text-green-400 transition"
            title="Activate"
          >
            {toggling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          </button>
        )}
      </Can>

      <Can permission="email.delete">
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="p-2 rounded-lg hover:bg-red-500/10 text-[#78716C] hover:text-red-400 transition"
          title="Delete"
        >
          {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        </button>
      </Can>
    </div>
  );
}
