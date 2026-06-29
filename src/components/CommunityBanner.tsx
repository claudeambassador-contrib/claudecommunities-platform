"use client";

import { Calendar, MessageSquare, UserCheck, Users } from "lucide-react";
import { TenantLink } from "@/components/TenantBaseProvider";
import { useTenantConfig } from "@/components/TenantConfigProvider";

interface CommunityBannerProps {
  memberCount: number;
  postCount: number;
  eventCount: number;
  connectionsCount: number;
}

export default function CommunityBanner({
  memberCount,
  postCount,
  eventCount,
  connectionsCount,
}: CommunityBannerProps) {
  const { countryName } = useTenantConfig();
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-[#2D2926] via-[#3D3430] to-[#2D2926] border-b border-white/[0.06]">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#D4836A] rounded-full blur-[128px]" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-[#8B5CF6] rounded-full blur-[96px]" />
      </div>

      <div className="relative max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex flex-col items-center text-center gap-6">
          {/* Text Content */}
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2 sm:mb-3">
              Claude Code Community
              <span className="block text-[#D4836A]">{countryName}</span>
            </h1>
            <p className="text-sm sm:text-base text-[#A8A29E] max-w-lg mx-auto leading-relaxed">
              {`Connect with Claude Code enthusiasts across ${countryName}.`} Share your projects,
              get help, and join local meetups in your city.
            </p>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-center gap-4 sm:gap-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-1">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-[#D4836A]" />
                <span className="text-xl sm:text-2xl font-bold text-white">{memberCount}</span>
              </div>
              <span className="text-[10px] sm:text-xs text-[#78716C] uppercase tracking-wider">
                Members
              </span>
            </div>
            <div className="w-px h-10 sm:h-12 bg-white/[0.1]" />
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-1">
                <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-[#10B981]" />
                <span className="text-xl sm:text-2xl font-bold text-white">{postCount}</span>
              </div>
              <span className="text-[10px] sm:text-xs text-[#78716C] uppercase tracking-wider">
                Posts
              </span>
            </div>
            <div className="w-px h-10 sm:h-12 bg-white/[0.1]" />
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-1">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-[#8B5CF6]" />
                <span className="text-xl sm:text-2xl font-bold text-white">{eventCount}</span>
              </div>
              <span className="text-[10px] sm:text-xs text-[#78716C] uppercase tracking-wider">
                Events
              </span>
            </div>
            <div className="w-px h-10 sm:h-12 bg-white/[0.1]" />
            <TenantLink href="/community/connections" className="text-center group">
              <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-1">
                <UserCheck className="w-4 h-4 sm:w-5 sm:h-5 text-[#F59E0B] group-hover:text-[#D4836A] transition-colors" />
                <span className="text-xl sm:text-2xl font-bold text-white group-hover:text-[#D4836A] transition-colors">
                  {connectionsCount}
                </span>
              </div>
              <span className="text-[10px] sm:text-xs text-[#78716C] uppercase tracking-wider group-hover:text-[#D4836A] transition-colors">
                Connections
              </span>
            </TenantLink>
          </div>
        </div>
      </div>
    </div>
  );
}
