"use client";

import {
  AlertCircle,
  AlertTriangle,
  ArrowUpDown,
  BarChart3,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  Loader2,
  MousePointerClick,
  Send,
  UserMinus,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTenantConfig } from "@/components/TenantConfigProvider";

interface OverviewStats {
  totalSent: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  unsubscribeRate: number;
}

interface CampaignPerformance {
  id: string;
  name: string;
  sentAt: string;
  sentCount: number;
  opens: number;
  openRate: number;
  clicks: number;
  clickRate: number;
  bounces: number;
  status: string;
}

interface TopLink {
  url: string;
  clicks: number;
}

interface AnalyticsData {
  overview: OverviewStats;
  campaigns: CampaignPerformance[];
  topLinks: TopLink[];
}

type SortField = "name" | "sentAt" | "sentCount" | "openRate" | "clickRate" | "bounces";
type SortDir = "asc" | "desc";
type TimeRange = "7d" | "30d" | "90d" | "all";

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "all", label: "All" },
];

export default function AnalyticsPage() {
  const config = useTenantConfig();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<TimeRange>("30d");
  const [sortField, setSortField] = useState<SortField>("sentAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/email/analytics?range=${range}`);
      if (!res.ok) throw new Error("Failed to fetch analytics");
      const result: AnalyticsData = await res.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const sortedCampaigns = useMemo(() => {
    if (!data) return [];
    return [...data.campaigns].sort((a, b) => {
      let aVal: string | number = a[sortField];
      let bVal: string | number = b[sortField];

      if (sortField === "sentAt" || sortField === "name") {
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
        return sortDir === "asc"
          ? aVal.localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal);
      }

      return sortDir === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [data, sortField, sortDir]);

  const maxLinkClicks = useMemo(() => {
    if (!data || data.topLinks.length === 0) return 1;
    return Math.max(...data.topLinks.map((l) => l.clicks));
  }, [data]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(config.lang, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  const truncateUrl = (url: string, maxLength = 60) => {
    if (url.length <= maxLength) return url;
    return `${url.substring(0, maxLength)}...`;
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    }
    return sortDir === "asc" ? (
      <ChevronUp className="w-3 h-3" />
    ) : (
      <ChevronDown className="w-3 h-3" />
    );
  };

  const statCards: {
    label: string;
    value: string;
    icon: React.ReactNode;
    color: string;
    indicatorColor: string;
  }[] = data
    ? [
        {
          label: "Total Sent",
          value: formatNumber(data.overview.totalSent),
          icon: <Send className="w-5 h-5" />,
          color: "text-[#D4836A]",
          indicatorColor: "bg-[#D4836A]",
        },
        {
          label: "Open Rate",
          value: `${data.overview.openRate.toFixed(1)}%`,
          icon: <Eye className="w-5 h-5" />,
          color: "text-green-400",
          indicatorColor: data.overview.openRate >= 20 ? "bg-green-400" : "bg-red-400",
        },
        {
          label: "Click Rate",
          value: `${data.overview.clickRate.toFixed(1)}%`,
          icon: <MousePointerClick className="w-5 h-5" />,
          color: "text-blue-400",
          indicatorColor: data.overview.clickRate >= 2 ? "bg-green-400" : "bg-red-400",
        },
        {
          label: "Bounce Rate",
          value: `${data.overview.bounceRate.toFixed(1)}%`,
          icon: <AlertTriangle className="w-5 h-5" />,
          color: "text-amber-400",
          indicatorColor: data.overview.bounceRate <= 2 ? "bg-green-400" : "bg-red-400",
        },
        {
          label: "Unsubscribe Rate",
          value: `${data.overview.unsubscribeRate.toFixed(1)}%`,
          icon: <UserMinus className="w-5 h-5" />,
          color: "text-red-400",
          indicatorColor: data.overview.unsubscribeRate <= 0.5 ? "bg-green-400" : "bg-red-400",
        },
      ]
    : [];

  return (
    <div className="min-h-screen bg-[#1C1917] pt-[72px]">
      <div className="max-w-[1400px] mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#E7E5E4]">Email Analytics</h1>
            <p className="text-sm text-[#78716C] mt-1">Track campaign performance and engagement</p>
          </div>

          {/* Time range pills */}
          <div className="flex items-center gap-1 bg-[#2D2926] rounded-xl p-1 border border-white/[0.06]">
            {TIME_RANGES.map((tr) => (
              <button
                type="button"
                key={tr.value}
                onClick={() => setRange(tr.value)}
                className={`px-3 py-1.5 rounded-lg text-sm transition font-medium ${
                  range === tr.value
                    ? "bg-[#D4836A] text-white"
                    : "text-[#78716C] hover:text-[#E7E5E4]"
                }`}
              >
                {tr.label}
              </button>
            ))}
          </div>
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
        ) : data ? (
          <>
            {/* Overview stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
              {statCards.map((card) => (
                <div
                  key={card.label}
                  className="rounded-2xl border border-white/[0.06] bg-[#2D2926] p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={card.color}>{card.icon}</span>
                    <div className={`w-2 h-2 rounded-full ${card.indicatorColor}`} />
                  </div>
                  <p className="text-2xl font-bold text-[#E7E5E4]">{card.value}</p>
                  <p className="text-xs text-[#78716C] mt-1">{card.label}</p>
                </div>
              ))}
            </div>

            {/* Campaign performance table */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#2D2926] overflow-hidden mb-8">
              <div className="px-5 py-4 border-b border-white/[0.06]">
                <h2 className="text-base font-semibold text-[#E7E5E4]">Campaign Performance</h2>
              </div>

              {sortedCampaigns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-[#78716C]">
                  <BarChart3 className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">No campaigns in this time range</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        {[
                          { field: "name" as SortField, label: "Campaign" },
                          { field: "sentAt" as SortField, label: "Sent Date" },
                          { field: "sentCount" as SortField, label: "Sent" },
                          { field: "openRate" as SortField, label: "Opens" },
                          { field: "clickRate" as SortField, label: "Clicks" },
                          { field: "bounces" as SortField, label: "Bounces" },
                        ].map((col) => (
                          <th
                            key={col.field}
                            onClick={() => handleSort(col.field)}
                            className="text-left text-xs font-medium text-[#78716C] uppercase tracking-wider px-4 py-3 cursor-pointer hover:text-[#E7E5E4] transition select-none"
                          >
                            <div className="flex items-center gap-1">
                              {col.label}
                              <SortIcon field={col.field} />
                            </div>
                          </th>
                        ))}
                        <th className="text-left text-xs font-medium text-[#78716C] uppercase tracking-wider px-4 py-3">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: per-row render with nested expand/collapse JSX conditionals and stat formatting, not branching logic */}
                      {sortedCampaigns.map((campaign) => (
                        <>
                          <tr
                            key={campaign.id}
                            onClick={() =>
                              setExpandedCampaign(
                                expandedCampaign === campaign.id ? null : campaign.id,
                              )
                            }
                            className="border-b border-white/[0.03] hover:bg-white/[0.03] transition cursor-pointer"
                          >
                            <td className="px-4 py-3 text-sm text-[#E7E5E4] font-medium max-w-[200px] truncate">
                              {campaign.name}
                            </td>
                            <td className="px-4 py-3 text-sm text-[#78716C]">
                              {formatDate(campaign.sentAt)}
                            </td>
                            <td className="px-4 py-3 text-sm text-[#E7E5E4]">
                              {formatNumber(campaign.sentCount)}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span className="text-[#E7E5E4]">{formatNumber(campaign.opens)}</span>
                              <span className="text-[#78716C] ml-1">
                                ({campaign.openRate.toFixed(1)}%)
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span className="text-[#E7E5E4]">
                                {formatNumber(campaign.clicks)}
                              </span>
                              <span className="text-[#78716C] ml-1">
                                ({campaign.clickRate.toFixed(1)}%)
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-[#E7E5E4]">{campaign.bounces}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2 py-0.5 text-xs rounded-full ${
                                  campaign.status === "sent"
                                    ? "bg-green-500/15 text-green-400"
                                    : campaign.status === "sending"
                                      ? "bg-blue-500/15 text-blue-400"
                                      : "bg-[#78716C]/20 text-[#78716C]"
                                }`}
                              >
                                {campaign.status}
                              </span>
                            </td>
                          </tr>

                          {/* Expanded detail row */}
                          {expandedCampaign === campaign.id && (
                            <tr
                              key={`${campaign.id}-detail`}
                              className="border-b border-white/[0.03]"
                            >
                              <td colSpan={7} className="px-4 py-4">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                  <div className="bg-[#1C1917] rounded-xl p-3">
                                    <p className="text-xs text-[#78716C] mb-1">Delivery Rate</p>
                                    <p className="text-lg font-bold text-[#E7E5E4]">
                                      {campaign.sentCount > 0
                                        ? (
                                            ((campaign.sentCount - campaign.bounces) /
                                              campaign.sentCount) *
                                            100
                                          ).toFixed(1)
                                        : 0}
                                      %
                                    </p>
                                  </div>
                                  <div className="bg-[#1C1917] rounded-xl p-3">
                                    <p className="text-xs text-[#78716C] mb-1">Open Rate</p>
                                    <p className="text-lg font-bold text-[#E7E5E4]">
                                      {campaign.openRate.toFixed(1)}%
                                    </p>
                                    <div className="w-full h-1.5 bg-white/[0.06] rounded-full mt-2 overflow-hidden">
                                      <div
                                        className="h-full bg-green-400 rounded-full transition-all"
                                        style={{
                                          width: `${Math.min(campaign.openRate, 100)}%`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                  <div className="bg-[#1C1917] rounded-xl p-3">
                                    <p className="text-xs text-[#78716C] mb-1">Click Rate</p>
                                    <p className="text-lg font-bold text-[#E7E5E4]">
                                      {campaign.clickRate.toFixed(1)}%
                                    </p>
                                    <div className="w-full h-1.5 bg-white/[0.06] rounded-full mt-2 overflow-hidden">
                                      <div
                                        className="h-full bg-blue-400 rounded-full transition-all"
                                        style={{
                                          width: `${Math.min(campaign.clickRate * 5, 100)}%`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                  <div className="bg-[#1C1917] rounded-xl p-3">
                                    <p className="text-xs text-[#78716C] mb-1">Bounce Rate</p>
                                    <p className="text-lg font-bold text-[#E7E5E4]">
                                      {campaign.sentCount > 0
                                        ? ((campaign.bounces / campaign.sentCount) * 100).toFixed(1)
                                        : 0}
                                      %
                                    </p>
                                    <div className="w-full h-1.5 bg-white/[0.06] rounded-full mt-2 overflow-hidden">
                                      <div
                                        className="h-full bg-red-400 rounded-full transition-all"
                                        style={{
                                          width: `${
                                            campaign.sentCount > 0
                                              ? Math.min(
                                                  (campaign.bounces / campaign.sentCount) *
                                                    100 *
                                                    10,
                                                  100,
                                                )
                                              : 0
                                          }%`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Top Clicked Links */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#2D2926] overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.06]">
                <h2 className="text-base font-semibold text-[#E7E5E4]">Top Clicked Links</h2>
              </div>

              {data.topLinks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-[#78716C]">
                  <MousePointerClick className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">No link clicks recorded yet</p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.03]">
                  {data.topLinks.map((link) => {
                    const barWidth = (link.clicks / maxLinkClicks) * 100;
                    return (
                      <div key={link.url} className="px-5 py-3 hover:bg-white/[0.03] transition">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <ExternalLink className="w-3.5 h-3.5 text-[#78716C] flex-shrink-0" />
                            <span className="text-sm text-[#E7E5E4] truncate" title={link.url}>
                              {truncateUrl(link.url)}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-[#E7E5E4] ml-4 flex-shrink-0">
                            {formatNumber(link.clicks)} click
                            {link.clicks !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-white/[0.04] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#D4836A] rounded-full transition-all duration-500"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
