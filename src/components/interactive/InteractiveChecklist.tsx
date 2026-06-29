"use client";

import { Check, Sparkles } from "lucide-react";
import { useRef, useState } from "react";

interface ChecklistItem {
  text: string;
  tip: string;
}

interface InteractiveChecklistProps {
  items: ChecklistItem[];
}

export default function InteractiveChecklist({ items }: InteractiveChecklistProps) {
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const [hoveredItem, setHoveredItem] = useState<number | null>(null);
  const [recentlyChecked, setRecentlyChecked] = useState<number | null>(null);
  const tooltipRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleToggle = (index: number) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
        setRecentlyChecked(index);
        setTimeout(() => setRecentlyChecked(null), 600);
      }
      return next;
    });
  };

  const progress = items.length > 0 ? (checkedItems.size / items.length) * 100 : 0;
  const allDone = checkedItems.size === items.length && items.length > 0;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <style>{`
        @keyframes cl-check-pop {
          0% { transform: scale(0); }
          50% { transform: scale(1.3); }
          100% { transform: scale(1); }
        }
        @keyframes cl-item-check {
          0% { transform: translateX(0); }
          30% { transform: translateX(4px); }
          100% { transform: translateX(0); }
        }
        @keyframes cl-tooltip-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes cl-golden-glow {
          0%, 100% { box-shadow: 0 0 15px rgba(255, 215, 0, 0.15), 0 0 30px rgba(255, 215, 0, 0.05); }
          50% { box-shadow: 0 0 25px rgba(255, 215, 0, 0.3), 0 0 50px rgba(255, 215, 0, 0.1); }
        }
        @keyframes cl-celebration-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes cl-sparkle-float {
          0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.6; }
          50% { transform: translateY(-6px) rotate(180deg); opacity: 1; }
        }
        @keyframes cl-progress-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .cl-check-pop {
          animation: cl-check-pop 0.3s ease-out;
        }
        .cl-item-check {
          animation: cl-item-check 0.3s ease-out;
        }
      `}</style>

      <div
        className={`rounded-xl border overflow-hidden transition-all duration-500 ${
          allDone ? "bg-[#2D2926] border-yellow-500/20" : "bg-[#2D2926] border-white/[0.06]"
        }`}
        style={allDone ? { animation: "cl-golden-glow 2.5s ease-in-out infinite" } : undefined}
      >
        {/* Header */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between">
          <h3 className="text-white font-semibold text-sm">Session Preparation</h3>
          <span className="text-xs text-[#A8A29E] font-mono">
            {checkedItems.size}/{items.length}
          </span>
        </div>

        {/* Items */}
        <div className="px-5 space-y-1">
          {items.map((item, index) => {
            const isChecked = checkedItems.has(index);
            const isHovered = hoveredItem === index;
            const wasJustChecked = recentlyChecked === index;

            return (
              // biome-ignore lint/a11y/noStaticElementInteractions: mouse-only hover sets tooltip visibility; the interactive control is the inner keyboard-accessible button
              <div
                key={item.text}
                className="relative"
                onMouseEnter={() => setHoveredItem(index)}
                onMouseLeave={() => setHoveredItem(null)}
                ref={(el) => {
                  tooltipRefs.current[index] = el;
                }}
              >
                <button
                  type="button"
                  onClick={() => handleToggle(index)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left
                    transition-all duration-300 cursor-pointer
                    ${wasJustChecked ? "cl-item-check" : ""}
                    ${isChecked ? "bg-green-500/[0.07]" : "hover:bg-white/[0.03]"}
                  `}
                >
                  {/* Checkbox */}
                  <div
                    className={`
                      w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0
                      transition-all duration-300
                      ${
                        isChecked
                          ? "bg-green-500 border-green-500 cl-check-pop"
                          : "border-[#78716C]/40 hover:border-[#D4836A]/60"
                      }
                    `}
                  >
                    {isChecked && <Check size={12} className="text-white" strokeWidth={3} />}
                  </div>

                  {/* Text */}
                  <span
                    className={`text-sm transition-all duration-300 ${
                      isChecked
                        ? "text-[#A8A29E] line-through decoration-[#78716C]/40"
                        : "text-[#E7E5E4]"
                    }`}
                  >
                    {item.text}
                  </span>
                </button>

                {/* Tooltip */}
                {isHovered && !isChecked && (
                  <div
                    className="absolute left-10 -bottom-1 translate-y-full z-20 max-w-xs"
                    style={{ animation: "cl-tooltip-in 0.2s ease-out" }}
                  >
                    <div className="bg-[#1C1917] border border-white/[0.1] rounded-lg px-3 py-2 shadow-xl">
                      <p className="text-xs text-[#A8A29E] leading-relaxed">
                        <span className="text-[#D4836A] font-medium">Tip: </span>
                        {item.tip}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="px-5 pt-3 pb-4">
          <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${progress}%`,
                background: allDone
                  ? "linear-gradient(90deg, #FFD700, #FFA500)"
                  : "linear-gradient(90deg, #4ADE80, #22C55E)",
                animation:
                  progress > 0 && !allDone
                    ? "cl-progress-pulse 2s ease-in-out infinite"
                    : undefined,
              }}
            />
          </div>
        </div>

        {/* Celebration */}
        {allDone && (
          <div className="px-5 pb-5" style={{ animation: "cl-celebration-in 0.5s ease-out" }}>
            <div className="rounded-lg bg-yellow-500/[0.08] border border-yellow-500/20 px-4 py-3 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Sparkles
                  size={16}
                  className="text-yellow-500"
                  style={{
                    animation: "cl-sparkle-float 2s ease-in-out infinite",
                  }}
                />
                <span className="text-sm font-semibold text-yellow-400">All done!</span>
                <Sparkles
                  size={16}
                  className="text-yellow-500"
                  style={{
                    animation: "cl-sparkle-float 2s ease-in-out infinite 0.5s",
                  }}
                />
              </div>
              <p className="text-xs text-yellow-500/70">
                You're fully prepared for your co-work session
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
