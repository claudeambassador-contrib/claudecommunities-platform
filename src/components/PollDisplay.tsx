"use client";

import { BarChart2, Check, Clock } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface PollOption {
  id: string;
  text: string;
  votes: number;
  percentage: number;
}

interface Poll {
  id: string;
  question: string;
  endsAt: string | null;
  options: PollOption[];
  totalVotes: number;
  userVotedOptionId: string | null;
  hasEnded: boolean;
}

interface PollDisplayProps {
  pollId: string;
  disabled?: boolean;
}

export default function PollDisplay({ pollId, disabled = false }: PollDisplayProps) {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVoting, setIsVoting] = useState(false);

  const fetchPoll = useCallback(async () => {
    try {
      const res = await fetch(`/api/polls/${pollId}`);
      if (res.ok) {
        const data = await res.json();
        setPoll(data);
      }
    } catch (error) {
      console.error("Failed to fetch poll:", error);
    } finally {
      setIsLoading(false);
    }
  }, [pollId]);

  useEffect(() => {
    fetchPoll();
  }, [fetchPoll]);

  const handleVote = async (optionId: string) => {
    if (disabled || isVoting || poll?.hasEnded) return;

    setIsVoting(true);

    // Optimistic update
    if (poll) {
      const oldVotedOptionId = poll.userVotedOptionId;
      const newOptions = poll.options.map((opt) => {
        let newVotes = opt.votes;
        if (opt.id === optionId) newVotes += 1;
        if (opt.id === oldVotedOptionId) newVotes -= 1;
        return { ...opt, votes: newVotes };
      });
      const newTotal = newOptions.reduce((sum, opt) => sum + opt.votes, 0);
      setPoll({
        ...poll,
        userVotedOptionId: optionId,
        totalVotes: newTotal,
        options: newOptions.map((opt) => ({
          ...opt,
          percentage: newTotal > 0 ? Math.round((opt.votes / newTotal) * 100) : 0,
        })),
      });
    }

    try {
      const res = await fetch(`/api/polls/${pollId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId }),
      });

      if (res.ok) {
        // Refetch to get accurate numbers
        fetchPoll();
      }
    } catch (error) {
      console.error("Failed to vote:", error);
      fetchPoll(); // Revert on error
    } finally {
      setIsVoting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-[#1C1917] rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-white/[0.1] rounded w-3/4 mb-4"></div>
        <div className="space-y-2">
          <div className="h-10 bg-white/[0.1] rounded"></div>
          <div className="h-10 bg-white/[0.1] rounded"></div>
        </div>
      </div>
    );
  }

  if (!poll) {
    return null;
  }

  const hasVoted = poll.userVotedOptionId !== null;
  const canVote = !disabled && !poll.hasEnded && !isVoting;

  // Calculate time remaining
  const getTimeRemaining = () => {
    if (!poll.endsAt || poll.hasEnded) return null;

    const now = new Date();
    const endTime = new Date(poll.endsAt);
    const diffMs = endTime.getTime() - now.getTime();

    if (diffMs <= 0) return null;

    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
      return `${diffDays}d ${diffHours % 24}h left`;
    } else if (diffHours > 0) {
      return `${diffHours}h ${diffMins % 60}m left`;
    } else if (diffMins > 0) {
      return `${diffMins}m left`;
    } else {
      return "Ending soon";
    }
  };

  const timeRemaining = getTimeRemaining();

  return (
    <div className="bg-[#1C1917] rounded-xl p-4 border border-white/[0.06]">
      {/* Question */}
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 className="w-4 h-4 text-[#D4836A]" />
        <h4 className="text-white font-medium">{poll.question}</h4>
      </div>

      {/* Options */}
      <div className="space-y-2">
        {poll.options.map((option) => {
          const isSelected = option.id === poll.userVotedOptionId;

          return (
            <button
              type="button"
              key={option.id}
              onClick={() => handleVote(option.id)}
              disabled={!canVote}
              className={`w-full relative overflow-hidden rounded-lg transition-all ${
                canVote ? "hover:border-[#D4836A]/50 cursor-pointer" : "cursor-default"
              } ${isSelected ? "border-2 border-[#D4836A]" : "border border-white/[0.1]"}`}
            >
              {/* Progress bar background */}
              {hasVoted && (
                <div
                  className="absolute inset-0 bg-[#D4836A]/10 transition-all duration-300"
                  style={{ width: `${option.percentage}%` }}
                />
              )}

              {/* Content */}
              <div className="relative flex items-center justify-between p-3">
                <div className="flex items-center gap-2">
                  {isSelected && (
                    <span className="w-5 h-5 rounded-full bg-[#D4836A] flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </span>
                  )}
                  <span className="text-sm text-white">{option.text}</span>
                </div>
                {hasVoted && (
                  <span className="text-sm text-[#78716C] font-medium">{option.percentage}%</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.06]">
        <span className="text-xs text-[#78716C]">
          {poll.totalVotes} {poll.totalVotes === 1 ? "vote" : "votes"}
        </span>
        {poll.hasEnded && (
          <span className="text-xs text-[#78716C] flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Poll ended
          </span>
        )}
        {timeRemaining && (
          <span className="text-xs text-[#D4836A] flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {timeRemaining}
          </span>
        )}
      </div>
    </div>
  );
}
