"use client";

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Globe,
  Loader2,
  Mail,
  Save,
  Shield,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTenantConfig } from "@/components/TenantConfigProvider";

interface EmailSettings {
  senderName: string;
  senderEmail: string;
  trackOpens: boolean;
  trackClicks: boolean;
  bounceAction: "disable" | "ignore";
  domain: string;
  domainVerified: boolean;
  spfStatus: "verified" | "pending" | "failed";
  dkimStatus: "verified" | "pending" | "failed";
  dmarcStatus: "verified" | "pending" | "failed";
}

function Toggle({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!value)}
      className={`w-9 h-5 rounded-full transition-colors relative ${
        value ? "bg-[#D4836A]" : "bg-white/[0.1]"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <div
        className={`w-3.5 h-3.5 rounded-full bg-white absolute top-[3px] transition-transform ${
          value ? "translate-x-[19px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}

const dnsStatusConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> =
  {
    verified: {
      label: "Verified",
      icon: <CheckCircle className="w-4 h-4" />,
      className: "text-green-400",
    },
    pending: {
      label: "Pending",
      icon: <Loader2 className="w-4 h-4 animate-spin" />,
      className: "text-amber-400",
    },
    failed: {
      label: "Failed",
      icon: <AlertTriangle className="w-4 h-4" />,
      className: "text-red-400",
    },
  };

export default function SettingsPage() {
  const config = useTenantConfig();
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetch once on mount; fetchSettings is stable for this purpose
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/email/settings");
      if (!res.ok) throw new Error("Failed to fetch settings");
      const data: EmailSettings = await res.json();
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/admin/email/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderName: settings.senderName,
          trackOpens: settings.trackOpens,
          trackClicks: settings.trackClicks,
          bounceAction: settings.bounceAction,
        }),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof EmailSettings>(key: K, value: EmailSettings[K]) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  return (
    <div className="min-h-screen bg-[#1C1917] pt-[72px]">
      <div className="max-w-[800px] mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#E7E5E4]">Email Settings</h1>
          <p className="text-sm text-[#78716C] mt-1">Configure your email sending preferences</p>
        </div>

        {/* Error state */}
        {error && (
          <div className="flex items-center gap-3 p-4 mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Success state */}
        {success && (
          <div className="flex items-center gap-3 p-4 mb-4 rounded-2xl border border-green-500/20 bg-green-500/10 text-green-400">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">Settings saved successfully</p>
          </div>
        )}

        {/* Loading state */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-[#D4836A] animate-spin" />
          </div>
        ) : settings ? (
          <div className="space-y-6">
            {/* Sender Configuration */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#2D2926] p-5">
              <div className="flex items-center gap-2 mb-4">
                <Mail className="w-5 h-5 text-[#D4836A]" />
                <h2 className="text-base font-semibold text-[#E7E5E4]">Sender Configuration</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="sender-name" className="block text-sm text-[#78716C] mb-1.5">
                    Default Sender Name
                  </label>
                  <input
                    id="sender-name"
                    type="text"
                    value={settings.senderName}
                    onChange={(e) => updateSetting("senderName", e.target.value)}
                    placeholder="e.g. Claude Community"
                    className="w-full px-3 py-2.5 bg-[#1C1917] border border-white/[0.06] rounded-xl text-[#E7E5E4] placeholder-[#78716C] text-sm focus:outline-none focus:border-[#D4836A]/50"
                  />
                </div>
                <div>
                  <label htmlFor="sender-email" className="block text-sm text-[#78716C] mb-1.5">
                    Sender Email
                  </label>
                  <input
                    id="sender-email"
                    type="text"
                    value={config.senderEmail}
                    readOnly
                    className="w-full px-3 py-2.5 bg-[#1C1917]/50 border border-white/[0.04] rounded-xl text-[#78716C] text-sm cursor-not-allowed"
                  />
                  <p className="text-xs text-[#78716C] mt-1.5">
                    Sender email cannot be changed. Contact support to update.
                  </p>
                </div>
              </div>
            </div>

            {/* Tracking */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#2D2926] p-5">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-[#D4836A]" />
                <h2 className="text-base font-semibold text-[#E7E5E4]">Tracking</h2>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[#E7E5E4]">Open Tracking</p>
                    <p className="text-xs text-[#78716C] mt-0.5">
                      Track when recipients open your emails
                    </p>
                  </div>
                  <Toggle
                    value={settings.trackOpens}
                    onChange={(v) => updateSetting("trackOpens", v)}
                  />
                </div>
                <div className="border-t border-white/[0.06]" />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[#E7E5E4]">Click Tracking</p>
                    <p className="text-xs text-[#78716C] mt-0.5">
                      Track when recipients click links in your emails
                    </p>
                  </div>
                  <Toggle
                    value={settings.trackClicks}
                    onChange={(v) => updateSetting("trackClicks", v)}
                  />
                </div>
              </div>
            </div>

            {/* Bounce Handling */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#2D2926] p-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-[#D4836A]" />
                <h2 className="text-base font-semibold text-[#E7E5E4]">Bounce Handling</h2>
              </div>

              <p className="text-sm text-[#78716C] mb-4">
                Choose how to handle email addresses that bounce. Disabling bounced addresses
                prevents sending to invalid emails and protects your sender reputation.
              </p>

              <div>
                <label htmlFor="bounce-action" className="block text-sm text-[#78716C] mb-1.5">
                  On bounce, the recipient should be:
                </label>
                <select
                  id="bounce-action"
                  value={settings.bounceAction}
                  onChange={(e) =>
                    updateSetting("bounceAction", e.target.value as "disable" | "ignore")
                  }
                  className="w-full px-3 py-2.5 bg-[#1C1917] border border-white/[0.06] rounded-xl text-[#E7E5E4] text-sm focus:outline-none focus:border-[#D4836A]/50 appearance-none"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2378716C' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 12px center",
                  }}
                >
                  <option value="disable">Disabled from future sends</option>
                  <option value="ignore">Ignored (continue sending)</option>
                </select>
              </div>
            </div>

            {/* Domain Authentication */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#2D2926] p-5">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-5 h-5 text-[#D4836A]" />
                <h2 className="text-base font-semibold text-[#E7E5E4]">Domain Authentication</h2>
              </div>

              <div className="flex items-center gap-2 mb-5">
                <span className="text-sm text-[#E7E5E4]">
                  {settings.domain || config.senderDomain}
                </span>
                {settings.domainVerified ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-green-500/15 text-green-400">
                    <CheckCircle className="w-3 h-3" />
                    Verified
                  </span>
                ) : (
                  <span className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-amber-500/15 text-amber-400">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Pending Verification
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {(
                  [
                    { key: "spfStatus" as const, label: "SPF" },
                    { key: "dkimStatus" as const, label: "DKIM" },
                    { key: "dmarcStatus" as const, label: "DMARC" },
                  ] as const
                ).map((dns) => {
                  const status = dnsStatusConfig[settings[dns.key]] || dnsStatusConfig.pending;
                  return (
                    <div
                      key={dns.key}
                      className="flex items-center justify-between p-3 rounded-xl bg-[#1C1917]"
                    >
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-[#78716C]" />
                        <span className="text-sm text-[#E7E5E4]">{dns.label}</span>
                      </div>
                      <div className={`flex items-center gap-1.5 text-sm ${status.className}`}>
                        {status.icon}
                        {status.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Save button */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#D4836A] text-white rounded-xl hover:bg-[#c4775f] transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Settings
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
