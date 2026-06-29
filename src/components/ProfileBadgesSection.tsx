"use client";

import {
  Award,
  Calendar,
  Heart,
  HelpCircle,
  MessageSquare,
  Star,
  TrendingUp,
  X,
} from "lucide-react";
import { useState } from "react";
import { LevelBadge, RoleBadge } from "./UserBadge";
import UserTagline from "./UserTagline";

// Level thresholds (points required for each level)
const LEVEL_THRESHOLDS: Record<number, number> = {
  1: 0,
  2: 100,
  3: 300,
  4: 600,
  5: 1000,
  6: 1500,
  7: 2500,
  8: 4000,
  9: 6000,
};

// Level names
const LEVEL_NAMES: Record<number, string> = {
  1: "Newcomer",
  2: "Member",
  3: "Contributor",
  4: "Active",
  5: "Enthusiast",
  6: "Expert",
  7: "Master",
  8: "Legend",
  9: "Champion",
};

// How to earn points
const POINTS_INFO = [
  { action: "Create a post", points: 10, icon: MessageSquare },
  { action: "Receive a like", points: 2, icon: Heart },
  { action: "Leave a comment", points: 5, icon: MessageSquare },
  { action: "Attend an event", points: 20, icon: Calendar },
  { action: "Complete profile", points: 25, icon: Award },
];

interface ProfileBadgesSectionProps {
  userId: string;
  role: string;
  tagline: string | null;
  points: number;
  level: number;
  isOwnProfile: boolean;
  subscriptionTier?: string;
}

export default function ProfileBadgesSection({
  userId,
  role,
  tagline,
  points,
  level,
  isOwnProfile,
  subscriptionTier,
}: ProfileBadgesSectionProps) {
  const [currentTagline, setCurrentTagline] = useState(tagline);
  const [showLevelsInfo, setShowLevelsInfo] = useState(false);

  // Calculate progress to next level
  const currentLevelMin = LEVEL_THRESHOLDS[level] || 0;
  const nextLevel = Math.min(level + 1, 9);
  const nextLevelMin = LEVEL_THRESHOLDS[nextLevel] || LEVEL_THRESHOLDS[9];
  const isMaxLevel = level >= 9;

  const pointsInCurrentLevel = points - currentLevelMin;
  const pointsNeededForNextLevel = nextLevelMin - currentLevelMin;
  const progressPercentage = isMaxLevel
    ? 100
    : Math.min(100, Math.round((pointsInCurrentLevel / pointsNeededForNextLevel) * 100));

  return (
    <div className="space-y-4">
      {/* Badges Row */}
      <div className="flex flex-wrap items-center gap-2">
        <RoleBadge roleName={role} size="md" showIcon />
        <LevelBadge level={level} size="md" showName />
        {subscriptionTier && subscriptionTier.toLowerCase() !== "free" && (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#D4836A]/20 text-[#D4836A] flex items-center gap-1">
            <Star className="w-3.5 h-3.5" />
            {subscriptionTier}
          </span>
        )}
      </div>

      {/* Tagline */}
      <UserTagline
        tagline={currentTagline}
        isEditable={isOwnProfile}
        userId={userId}
        onUpdate={setCurrentTagline}
      />

      {/* Points and Level Progress */}
      <div className="bg-[#1C1917] rounded-xl p-4 border border-white/[0.06]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-[#D4836A]" />
            <span className="text-white font-semibold">{points.toLocaleString()} points</span>
          </div>
          <div className="flex items-center gap-2">
            {!isMaxLevel && (
              <div className="flex items-center gap-1 text-sm text-[#78716C]">
                <TrendingUp className="w-4 h-4" />
                <span>
                  {nextLevelMin - points} to level {nextLevel}
                </span>
              </div>
            )}
            {isMaxLevel && <span className="text-sm text-[#D4836A] font-medium">Max Level</span>}
            <button
              type="button"
              onClick={() => setShowLevelsInfo(true)}
              className="p-1 text-[#78716C] hover:text-[#D4836A] transition-colors"
              title="How do points & levels work?"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative h-2 bg-[#2D2926] rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#D4836A] to-[#c4735a] rounded-full transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        <div className="flex items-center justify-between mt-2 text-xs text-[#78716C]">
          <span>Level {level}</span>
          {!isMaxLevel && <span>{progressPercentage}%</span>}
          {!isMaxLevel && <span>Level {nextLevel}</span>}
        </div>
      </div>

      {/* Levels Info Modal */}
      {showLevelsInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#2D2926] rounded-2xl border border-white/[0.06] w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-[#2D2926] p-4 border-b border-white/[0.06] flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Points & Levels</h2>
              <button
                type="button"
                onClick={() => setShowLevelsInfo(false)}
                className="p-1 text-[#78716C] hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-6">
              {/* How to earn points */}
              <div>
                <h3 className="text-sm font-semibold text-[#D4836A] uppercase tracking-wider mb-3">
                  How to Earn Points
                </h3>
                <div className="space-y-2">
                  {POINTS_INFO.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.action}
                        className="flex items-center justify-between p-2.5 bg-[#1C1917] rounded-lg"
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className="w-4 h-4 text-[#78716C]" />
                          <span className="text-sm text-[#E7E5E4]">{item.action}</span>
                        </div>
                        <span className="text-sm font-semibold text-[#D4836A]">+{item.points}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Level breakdown */}
              <div>
                <h3 className="text-sm font-semibold text-[#D4836A] uppercase tracking-wider mb-3">
                  Level Progression
                </h3>
                <div className="space-y-1.5">
                  {Object.entries(LEVEL_THRESHOLDS).map(([lvl, threshold]) => {
                    const lvlNum = parseInt(lvl, 10);
                    const isCurrentLevel = lvlNum === level;
                    const isAchieved = lvlNum <= level;
                    return (
                      <div
                        key={lvl}
                        className={`flex items-center justify-between p-2.5 rounded-lg transition-colors ${
                          isCurrentLevel
                            ? "bg-[#D4836A]/20 border border-[#D4836A]/30"
                            : isAchieved
                              ? "bg-[#1C1917]"
                              : "bg-[#1C1917]/50"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              isCurrentLevel
                                ? "bg-[#D4836A] text-white"
                                : isAchieved
                                  ? "bg-[#3D3936] text-white"
                                  : "bg-[#2D2926] text-[#78716C]"
                            }`}
                          >
                            {lvl}
                          </span>
                          <span
                            className={`text-sm ${
                              isCurrentLevel
                                ? "text-[#D4836A] font-medium"
                                : isAchieved
                                  ? "text-white"
                                  : "text-[#78716C]"
                            }`}
                          >
                            {LEVEL_NAMES[lvlNum]}
                          </span>
                        </div>
                        <span
                          className={`text-xs ${isAchieved ? "text-[#78716C]" : "text-[#57534E]"}`}
                        >
                          {threshold.toLocaleString()} pts
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
