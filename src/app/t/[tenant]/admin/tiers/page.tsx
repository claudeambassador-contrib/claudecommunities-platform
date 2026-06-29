export const dynamic = "force-dynamic";

import { CreditCard, Crown, Edit, Eye, EyeOff, Plus, Trash2, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { Can } from "@/components/admin/Can";
import { TenantLink } from "@/components/TenantBaseProvider";
import { getCurrentUserWithPermissions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";

async function getTiers() {
  const db = await getPrisma();
  return await db.membershipTier.findMany({
    orderBy: { order: "asc" },
    include: {
      _count: { select: { subscriptions: true } },
    },
  });
}

export default async function AdminTiersPage() {
  const user = await getCurrentUserWithPermissions();
  if (!user) redirect(tenantHref(await getTenantBase(), "/login"));
  if (!hasPermission(user, "tiers.view"))
    redirect(tenantHref(await getTenantBase(), "/admin?error=unauthorized"));

  const tiers = await getTiers();

  return (
    <div className="min-h-screen bg-[#1C1917]">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Actions */}
        <Can permission="tiers.edit">
          <div className="flex items-center justify-end mb-8">
            <TenantLink
              href="/admin/tiers/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#D4836A] text-white rounded-lg font-medium hover:bg-[#c4775f] transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Tier
            </TenantLink>
          </div>
        </Can>

        {/* Tier List */}
        <div className="space-y-4">
          {tiers.length === 0 ? (
            <div className="bg-[#2D2926] rounded-2xl border border-white/[0.06] p-12 text-center">
              <CreditCard className="w-12 h-12 text-[#57534E] mx-auto mb-4" />
              <p className="text-[#78716C] mb-4">No membership tiers created yet</p>
              <Can permission="tiers.edit">
                <TenantLink
                  href="/admin/tiers/new"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#D4836A] text-white rounded-lg font-medium hover:bg-[#c4775f] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create Your First Tier
                </TenantLink>
              </Can>
            </div>
          ) : (
            tiers.map((tier) => {
              const features = tier.features ? JSON.parse(tier.features) : [];
              return (
                <div
                  key={tier.id}
                  className="bg-[#2D2926] rounded-2xl border border-white/[0.06] p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{
                          backgroundColor: `${tier.color || "#D4836A"}20`,
                          color: tier.color || "#D4836A",
                        }}
                      >
                        <Crown className="w-6 h-6" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-white">{tier.name}</h3>
                          {tier.isActive ? (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400">
                              Active
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-white/10 text-[#78716C]">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-[#78716C] mb-3">{tier.description}</p>

                        <div className="flex items-center gap-6 text-sm">
                          <div>
                            <span className="text-2xl font-bold text-white">${tier.price}</span>
                            <span className="text-[#78716C]">/month</span>
                          </div>
                          {tier.yearlyPrice && (
                            <div className="text-[#78716C]">${tier.yearlyPrice}/year</div>
                          )}
                          <div className="flex items-center gap-1 text-[#78716C]">
                            <Users className="w-4 h-4" />
                            {tier._count.subscriptions} subscribers
                          </div>
                        </div>

                        {features.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {features.slice(0, 4).map((feature: string) => (
                              <span
                                key={feature}
                                className="px-2 py-1 text-xs bg-white/[0.05] text-[#A8A29E] rounded-lg"
                              >
                                {feature}
                              </span>
                            ))}
                            {features.length > 4 && (
                              <span className="px-2 py-1 text-xs bg-white/[0.05] text-[#78716C] rounded-lg">
                                +{features.length - 4} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Can permission="tiers.edit">
                        <button
                          type="button"
                          className="p-2 rounded-lg text-[#78716C] hover:text-white hover:bg-white/5 transition-colors"
                          title={tier.isActive ? "Deactivate" : "Activate"}
                        >
                          {tier.isActive ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                        <TenantLink
                          href={`/admin/tiers/${tier.id}/edit`}
                          className="p-2 rounded-lg text-[#78716C] hover:text-white hover:bg-white/5 transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </TenantLink>
                      </Can>
                      <Can permission="tiers.delete">
                        <button
                          type="button"
                          className="p-2 rounded-lg text-[#78716C] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </Can>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Info */}
        <div className="mt-8 p-4 bg-[#2D2926] rounded-xl border border-white/[0.06]">
          <h3 className="font-medium text-white mb-2">Payment Integration</h3>
          <p className="text-sm text-[#78716C]">
            To enable payments, configure your Stripe API keys in the environment variables. Once
            configured, users will be able to subscribe to paid tiers directly.
          </p>
        </div>
      </div>
    </div>
  );
}
