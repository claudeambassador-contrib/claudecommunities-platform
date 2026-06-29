"use client";

import { AlertCircle, CheckCircle2, Linkedin, Trash2, Zap } from "lucide-react";
import { useState } from "react";
import { TenantLink, useTenantBase } from "@/components/TenantBaseProvider";
import { useTenantConfig } from "@/components/TenantConfigProvider";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import type { ConnectorId, SocialAccountSummary } from "@/lib/social/types";
import { tenantHref } from "@/lib/tenant-base";
import { ZernioConnectDialog } from "./ZernioConnectDialog";

interface Props {
  accounts: SocialAccountSummary[];
  connectedCount: number | null;
  error: string | null;
}

const CONNECTOR_LABEL: Record<ConnectorId, string> = {
  linkedin: "LinkedIn (direct API)",
  zernio: "via Zernio",
};

export function SocialSettings({ accounts, connectedCount, error }: Props) {
  const toast = useToast();
  const base = useTenantBase();
  const [removing, setRemoving] = useState<SocialAccountSummary | null>(null);
  const [zernioOpen, setZernioOpen] = useState(false);

  const direct = accounts.filter((a) => a.connector === "linkedin");
  const zernio = accounts.filter((a) => a.connector === "zernio");

  const handleRemove = async (id: string) => {
    const res = await fetch(`/api/admin/social/accounts/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Account disconnected");
      window.location.reload();
    } else {
      const data = (await res.json()) as { error?: string };
      toast.error(data.error ?? "Failed to disconnect");
    }
    setRemoving(null);
  };

  return (
    <div className="min-h-screen bg-[#1C1917]">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-6">
          <TenantLink href="/admin/social" className="text-xs text-[#78716C] hover:text-white">
            ← Back to Social
          </TenantLink>
          <h1 className="text-2xl font-bold text-white mt-2">Connected accounts</h1>
          <p className="text-[#78716C] text-sm mt-1">
            Pick one or both connectors. Each connection routes posts to LinkedIn through a
            different integration — useful while the direct LinkedIn API approval is pending.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <span>Connection failed: {error}</span>
          </div>
        )}
        {connectedCount !== null && (
          <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 mt-0.5" />
            <span>
              Connected {connectedCount} account{connectedCount === 1 ? "" : "s"}.
            </span>
          </div>
        )}

        {/* LinkedIn direct */}
        <ConnectorSection
          icon={<Linkedin className="w-5 h-5 text-[#7CB8F0]" />}
          title="LinkedIn (direct)"
          subtitle="OAuth with LinkedIn. Requires Community Management API approval — review can take weeks."
          actionLabel={direct.length > 0 ? "Reconnect" : "Connect"}
          actionForm={
            <form
              action={tenantHref(base, "/api/admin/social/accounts/linkedin/connect")}
              method="GET"
            >
              <button
                type="submit"
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[#0a66c2] text-white hover:bg-[#0857a8]"
              >
                {direct.length > 0 ? "Reconnect" : "Connect"}
              </button>
            </form>
          }
          accounts={direct}
          onRemove={setRemoving}
          emptyText="No LinkedIn pages connected via the direct API yet."
        />

        {/* Zernio */}
        <ConnectorSection
          icon={<Zap className="w-5 h-5 text-[#D4836A]" />}
          title="Zernio"
          subtitle="Post via zernio.com using a Zernio API key. No LinkedIn API approval needed — connect your LinkedIn in Zernio's dashboard first."
          actionLabel={zernio.length > 0 ? "Add another" : "Connect"}
          actionForm={
            <button
              type="button"
              onClick={() => setZernioOpen(true)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[#D4836A] text-white hover:bg-[#C26F56]"
            >
              {zernio.length > 0 ? "Add another" : "Connect"}
            </button>
          }
          accounts={zernio}
          onRemove={setRemoving}
          emptyText="No accounts connected through Zernio yet."
        />

        {/* Setup notes */}
        <section className="rounded-xl border border-white/[0.06] bg-[#2D2926] p-4 mt-6">
          <h3 className="text-sm font-semibold text-white mb-2">Setup notes</h3>
          <ul className="text-xs text-[#A8A29E] space-y-1.5 list-disc list-inside">
            <li>
              <strong className="text-white">Direct:</strong> create an app at{" "}
              <a
                href="https://developer.linkedin.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#7CB8F0] hover:underline"
              >
                developer.linkedin.com
              </a>
              , request the <strong className="text-white">Community Management API</strong>{" "}
              product, set the redirect URI to{" "}
              <code className="text-[#D4836A]">/api/admin/social/accounts/linkedin/callback</code>,
              and set the worker secrets <code className="text-[#D4836A]">LINKEDIN_CLIENT_ID</code>,{" "}
              <code className="text-[#D4836A]">LINKEDIN_CLIENT_SECRET</code>, and{" "}
              <code className="text-[#D4836A]">SOCIAL_OAUTH_STATE_SECRET</code>.
            </li>
            <li>
              <strong className="text-white">Zernio:</strong> connect your LinkedIn account(s) on
              the{" "}
              <a
                href="https://zernio.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#7CB8F0] hover:underline"
              >
                zernio.com dashboard
              </a>
              , then create an API key (Settings → API Keys, format{" "}
              <code className="text-[#D4836A]">sk_…</code>) and paste it into the Connect dialog. No
              worker secrets required.
            </li>
          </ul>
          {accounts.length > 0 && (
            <p className="text-xs text-[#78716C] mt-3">
              <strong className="text-[#A8A29E]">Tip:</strong> account rows below show which
              connector they use ({Object.values(CONNECTOR_LABEL).join(", ")}).
            </p>
          )}
        </section>
      </div>

      <ZernioConnectDialog
        open={zernioOpen}
        onClose={() => setZernioOpen(false)}
        onConnected={() => {
          setZernioOpen(false);
          window.location.reload();
        }}
      />

      <ConfirmDialog
        open={!!removing}
        title="Disconnect this account?"
        description={`Scheduled posts targeted at "${removing?.displayName}" will be deleted along with the account.`}
        confirmLabel="Disconnect"
        variant="destructive"
        onConfirm={async () => {
          if (removing) await handleRemove(removing.id);
        }}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}

function ConnectorSection({
  icon,
  title,
  subtitle,
  actionForm,
  accounts,
  onRemove,
  emptyText,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  actionLabel: string;
  actionForm: React.ReactNode;
  accounts: SocialAccountSummary[];
  onRemove: (a: SocialAccountSummary) => void;
  emptyText: string;
}) {
  const config = useTenantConfig();
  return (
    <section className="rounded-xl border border-white/[0.06] bg-[#2D2926] mb-4">
      <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <h2 className="text-white font-semibold">{title}</h2>
            <p className="text-xs text-[#78716C] max-w-md">{subtitle}</p>
          </div>
        </div>
        {actionForm}
      </div>
      <div className="p-4">
        {accounts.length === 0 ? (
          <p className="text-sm text-[#78716C]">{emptyText}</p>
        ) : (
          <ul className="space-y-2">
            {accounts.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between p-3 rounded-lg border border-white/[0.06]"
              >
                <div>
                  <p className="text-sm text-white">{a.displayName}</p>
                  <p className="text-xs text-[#78716C]">
                    {CONNECTOR_LABEL[a.connector]} · {a.accountType} ·{" "}
                    {a.isExpired
                      ? "credentials expired — reconnect"
                      : a.expiresAt
                        ? `expires ${new Date(a.expiresAt).toLocaleDateString(config.lang)}`
                        : "no expiry"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(a)}
                  className="p-2 text-[#78716C] hover:text-red-300 hover:bg-red-500/10 rounded-lg"
                  title="Disconnect"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
