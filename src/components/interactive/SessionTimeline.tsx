"use client";

import { CheckCircle, Code, Presentation, Target, Users } from "lucide-react";
import { useState } from "react";

interface Phase {
  id: number;
  title: string;
  duration: string;
  icon: React.ElementType;
  description: string;
  details: string[];
}

const phases: Phase[] = [
  {
    id: 0,
    title: "Check-in",
    duration: "5 min",
    icon: Users,
    description: "Connect with fellow community members",
    details: [
      "Introduce yourself and share what you're working on",
      "Hear what others are building or learning",
      "Set the collaborative tone for the session",
      "Find potential collaboration partners",
    ],
  },
  {
    id: 1,
    title: "Goal Setting",
    duration: "5 min",
    icon: Target,
    description: "Define your session objectives",
    details: [
      "Write down 1-3 specific goals for the session",
      "Share your goals with the group for accountability",
      "Break large tasks into achievable chunks",
      "Identify any blockers you might need help with",
    ],
  },
  {
    id: 2,
    title: "Deep Work",
    duration: "45 min",
    icon: Code,
    description: "Focused building time with Claude",
    details: [
      "Work on your project with Claude as your pair programmer",
      "Stay focused — cameras on, mics muted",
      "Use the chat for quick questions or celebrations",
      "Take a short break halfway if needed",
    ],
  },
  {
    id: 3,
    title: "Show & Tell",
    duration: "10 min",
    icon: Presentation,
    description: "Share your progress and learnings",
    details: [
      "Demo what you built or learned during deep work",
      "Share interesting Claude prompts that worked well",
      "Get feedback and suggestions from the group",
      "Celebrate wins, no matter how small",
    ],
  },
  {
    id: 4,
    title: "Wrap-up",
    duration: "5 min",
    icon: CheckCircle,
    description: "Reflect and plan next steps",
    details: [
      "Summarize what you accomplished",
      "Note any action items for next session",
      "Share resources or links in the chat",
      "Schedule or confirm the next co-work session",
    ],
  },
];

export default function SessionTimeline() {
  const [activePhase, setActivePhase] = useState<number | null>(null);
  const [visitedPhases, setVisitedPhases] = useState<Set<number>>(new Set());

  const handlePhaseClick = (id: number) => {
    if (activePhase === id) {
      setActivePhase(null);
    } else {
      setActivePhase(id);
      setVisitedPhases((prev) => new Set([...prev, id]));
    }
  };

  const progress = (visitedPhases.size / phases.length) * 100;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <style>{`
        @keyframes timeline-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(212, 131, 106, 0.4); }
          50% { box-shadow: 0 0 20px 4px rgba(212, 131, 106, 0.2); }
        }
        @keyframes timeline-expand {
          from { opacity: 0; max-height: 0; }
          to { opacity: 1; max-height: 300px; }
        }
        @keyframes progress-fill {
          from { width: 0%; }
        }
        @keyframes timeline-icon-pop {
          0% { transform: scale(1); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        .timeline-active {
          animation: timeline-pulse 2s ease-in-out infinite;
        }
        .timeline-details-enter {
          animation: timeline-expand 0.4s ease-out forwards;
          overflow: hidden;
        }
        .timeline-icon-pop {
          animation: timeline-icon-pop 0.3s ease-out;
        }
      `}</style>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-[#A8A29E]">Session Progress</span>
          <span className="text-sm text-[#D4836A] font-medium">
            {visitedPhases.size}/{phases.length} phases explored
          </span>
        </div>
        <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#D4836A] to-[#E8A090] rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical connector line */}
        <div className="absolute left-[23px] top-8 bottom-8 w-[2px] bg-white/[0.06]" />

        <div className="space-y-3">
          {phases.map((phase) => {
            const isActive = activePhase === phase.id;
            const isVisited = visitedPhases.has(phase.id);
            const Icon = phase.icon;

            return (
              <div key={phase.id} className="relative">
                <button
                  type="button"
                  onClick={() => handlePhaseClick(phase.id)}
                  className={`
                    w-full text-left rounded-xl p-4 pl-14 transition-all duration-300 cursor-pointer
                    ${
                      isActive
                        ? "bg-[#2D2926] border border-[#D4836A]/60 timeline-active"
                        : isVisited
                          ? "bg-[#2D2926]/60 border border-white/[0.06] hover:border-[#D4836A]/30"
                          : "bg-[#2D2926]/40 border border-white/[0.06] hover:border-white/[0.12] hover:bg-[#2D2926]/60"
                    }
                  `}
                >
                  {/* Icon circle */}
                  <div
                    className={`
                      absolute left-3 top-4 w-[24px] h-[24px] rounded-full flex items-center justify-center
                      transition-all duration-300
                      ${
                        isActive
                          ? "bg-[#D4836A] text-white timeline-icon-pop"
                          : isVisited
                            ? "bg-[#D4836A]/20 text-[#D4836A]"
                            : "bg-white/[0.06] text-[#78716C]"
                      }
                    `}
                  >
                    <Icon size={14} />
                  </div>

                  {/* Header row */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3
                        className={`font-semibold text-sm transition-colors duration-300 ${
                          isActive ? "text-white" : "text-[#E7E5E4]"
                        }`}
                      >
                        {phase.title}
                      </h3>
                      <p className="text-xs text-[#A8A29E] mt-0.5">{phase.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-mono px-2 py-0.5 rounded-full ${
                          isActive
                            ? "bg-[#D4836A]/20 text-[#D4836A]"
                            : "bg-white/[0.06] text-[#78716C]"
                        }`}
                      >
                        {phase.duration}
                      </span>
                      <svg
                        className={`w-4 h-4 text-[#78716C] transition-transform duration-300 ${
                          isActive ? "rotate-180" : ""
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isActive && (
                    <div className="timeline-details-enter mt-3 pt-3 border-t border-white/[0.06]">
                      <ul className="space-y-2">
                        {phase.details.map((detail, i) => (
                          <li
                            // biome-ignore lint/suspicious/noArrayIndexKey: static per-phase detail list that never reorders or inserts
                            key={i}
                            className="flex items-start gap-2 text-sm text-[#A8A29E]"
                            style={{
                              animationDelay: `${i * 80}ms`,
                              animation: "timeline-expand 0.3s ease-out forwards",
                              opacity: 0,
                            }}
                          >
                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#D4836A]/60 flex-shrink-0" />
                            {detail}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Completion message */}
      {visitedPhases.size === phases.length && (
        <div
          className="mt-4 text-center py-3 rounded-xl bg-[#D4836A]/10 border border-[#D4836A]/20"
          style={{ animation: "timeline-expand 0.5s ease-out" }}
        >
          <p className="text-sm text-[#D4836A] font-medium">
            You've explored the full co-work session flow!
          </p>
        </div>
      )}
    </div>
  );
}
