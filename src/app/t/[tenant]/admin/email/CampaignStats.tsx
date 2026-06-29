"use client";

import { AlertCircle, CheckCircle, Send, Users } from "lucide-react";
import { useTenantConfig } from "@/components/TenantConfigProvider";

interface Campaign {
  id: string;
  name: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  sentAt: string | null;
}

interface Props {
  campaign: Campaign;
}

export default function CampaignStats({ campaign }: Props) {
  const config = useTenantConfig();

  const deliveryRate =
    campaign.recipientCount > 0
      ? Math.round((campaign.sentCount / campaign.recipientCount) * 100)
      : 0;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Not sent";
    return new Date(dateString).toLocaleDateString(config.lang, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#2D2926] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-[#A8A29E]" />
            <span className="text-sm text-[#A8A29E]">Recipients</span>
          </div>
          <p className="text-2xl font-bold text-white">{campaign.recipientCount}</p>
        </div>

        <div className="bg-[#2D2926] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Send className="w-4 h-4 text-[#D4836A]" />
            <span className="text-sm text-[#A8A29E]">Sent</span>
          </div>
          <p className="text-2xl font-bold text-white">{campaign.sentCount}</p>
        </div>

        <div className="bg-[#2D2926] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-sm text-[#A8A29E]">Delivery Rate</span>
          </div>
          <p className="text-2xl font-bold text-white">{deliveryRate}%</p>
        </div>

        <div className="bg-[#2D2926] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-sm text-[#A8A29E]">Failed</span>
          </div>
          <p className="text-2xl font-bold text-white">{campaign.failedCount}</p>
        </div>
      </div>

      {/* Delivery Progress Bar */}
      <div className="bg-[#2D2926] rounded-xl p-5">
        <h3 className="text-sm font-medium text-[#A8A29E] mb-3">Delivery Progress</h3>
        <div className="h-4 bg-[#1C1917] rounded-full overflow-hidden">
          <div className="h-full flex">
            <div
              className="bg-green-500 transition-all"
              style={{ width: `${(campaign.sentCount / campaign.recipientCount) * 100}%` }}
            />
            <div
              className="bg-red-500 transition-all"
              style={{ width: `${(campaign.failedCount / campaign.recipientCount) * 100}%` }}
            />
          </div>
        </div>
        <div className="flex items-center justify-between mt-3 text-sm">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 bg-green-500 rounded-full" />
              <span className="text-[#A8A29E]">{campaign.sentCount} delivered</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 bg-red-500 rounded-full" />
              <span className="text-[#A8A29E]">{campaign.failedCount} failed</span>
            </span>
          </div>
          <span className="text-[#78716C]">{formatDate(campaign.sentAt)}</span>
        </div>
      </div>

      {/* Info */}
      <div className="bg-[#2D2926] rounded-xl p-5">
        <h3 className="text-sm font-medium text-[#A8A29E] mb-3">Campaign Info</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-[#78716C]">Sent At</span>
            <span className="text-white">{formatDate(campaign.sentAt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#78716C]">Total Recipients</span>
            <span className="text-white">{campaign.recipientCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#78716C]">Successfully Delivered</span>
            <span className="text-green-400">{campaign.sentCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#78716C]">Failed Deliveries</span>
            <span className="text-red-400">{campaign.failedCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
