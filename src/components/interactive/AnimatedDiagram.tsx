"use client";

import { Bot, FolderKanban, GraduationCap, User, Users, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface NodeData {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  description: string;
  details: string[];
  angle: number;
  floatDelay: number;
}

const nodes: NodeData[] = [
  {
    id: "claude",
    label: "Claude AI",
    icon: Bot,
    color: "#D4836A",
    description: "Your intelligent pair programmer",
    details: [
      "Helps write, review, and debug code",
      "Answers questions and explains concepts",
      "Suggests best practices and patterns",
      "Available 24/7 as your coding partner",
    ],
    angle: 0,
    floatDelay: 0,
  },
  {
    id: "community",
    label: "Community",
    icon: Users,
    color: "#60A5FA",
    description: "Fellow builders and learners",
    details: [
      "Share progress during Show & Tell",
      "Get peer feedback on your work",
      "Find collaboration opportunities",
      "Build accountability with regulars",
    ],
    angle: 90,
    floatDelay: 0.5,
  },
  {
    id: "projects",
    label: "Projects",
    icon: FolderKanban,
    color: "#4ADE80",
    description: "What you're building",
    details: [
      "Personal projects and side hustles",
      "Open source contributions",
      "Learning exercises and experiments",
      "Portfolio pieces and demos",
    ],
    angle: 180,
    floatDelay: 1,
  },
  {
    id: "mentors",
    label: "Mentors",
    icon: GraduationCap,
    color: "#FBBF24",
    description: "Experienced guides in the community",
    details: [
      "Session facilitators who keep things on track",
      "Experienced developers who share knowledge",
      "Help navigate challenges and blockers",
      "Provide career and project guidance",
    ],
    angle: 270,
    floatDelay: 1.5,
  },
];

export default function AnimatedDiagram() {
  const [expandedNode, setExpandedNode] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const centerX = dimensions.width / 2;
  const centerY = dimensions.height / 2;
  const radius = Math.min(dimensions.width, dimensions.height) * 0.3;

  const getNodePosition = useCallback(
    (angle: number) => {
      const rad = (angle * Math.PI) / 180;
      return {
        x: centerX + Math.cos(rad) * radius,
        y: centerY + Math.sin(rad) * radius,
      };
    },
    [centerX, centerY, radius],
  );

  return (
    <div className="w-full max-w-2xl mx-auto">
      <style>{`
        @keyframes ad-float-0 {
          0%, 100% { transform: translate(-50%, -50%) translateY(0px); }
          50% { transform: translate(-50%, -50%) translateY(-8px); }
        }
        @keyframes ad-float-1 {
          0%, 100% { transform: translate(-50%, -50%) translateY(0px); }
          50% { transform: translate(-50%, -50%) translateY(-10px); }
        }
        @keyframes ad-float-2 {
          0%, 100% { transform: translate(-50%, -50%) translateY(0px); }
          50% { transform: translate(-50%, -50%) translateY(-6px); }
        }
        @keyframes ad-float-3 {
          0%, 100% { transform: translate(-50%, -50%) translateY(0px); }
          50% { transform: translate(-50%, -50%) translateY(-9px); }
        }
        @keyframes ad-center-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(212, 131, 106, 0.3); }
          50% { box-shadow: 0 0 20px 6px rgba(212, 131, 106, 0.15); }
        }
        @keyframes ad-dash-flow {
          from { stroke-dashoffset: 16; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes ad-detail-in {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes ad-node-hover {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.1); }
        }
      `}</style>

      <div
        ref={containerRef}
        className="relative rounded-xl bg-[#1C1917] border border-white/[0.06] overflow-hidden"
        style={{ height: "380px" }}
      >
        {/* SVG connections */}
        {dimensions.width > 0 && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 1 }}
            aria-hidden="true"
          >
            {nodes.map((node) => {
              const pos = getNodePosition(node.angle);
              return (
                <line
                  key={`line-${node.id}`}
                  x1={centerX}
                  y1={centerY}
                  x2={pos.x}
                  y2={pos.y}
                  stroke={expandedNode === node.id ? node.color : "rgba(255,255,255,0.06)"}
                  strokeWidth={expandedNode === node.id ? 2 : 1.5}
                  strokeDasharray="6 4"
                  style={{
                    animation: "ad-dash-flow 0.8s linear infinite",
                    transition: "stroke 0.3s, stroke-width 0.3s",
                  }}
                />
              );
            })}
          </svg>
        )}

        {/* Center node: "You" */}
        {dimensions.width > 0 && (
          <div
            className="absolute z-10 flex flex-col items-center"
            style={{
              left: centerX,
              top: centerY,
              transform: "translate(-50%, -50%)",
            }}
          >
            <div
              className="w-16 h-16 rounded-full bg-[#2D2926] border-2 border-[#D4836A]/40 flex items-center justify-center"
              style={{ animation: "ad-center-pulse 3s ease-in-out infinite" }}
            >
              <User size={24} className="text-[#D4836A]" />
            </div>
            <span className="mt-1.5 text-xs font-semibold text-white">You</span>
          </div>
        )}

        {/* Outer nodes */}
        {dimensions.width > 0 &&
          nodes.map((node, i) => {
            const pos = getNodePosition(node.angle);
            const Icon = node.icon;
            const isExpanded = expandedNode === node.id;

            return (
              <button
                type="button"
                key={node.id}
                className={`absolute z-10 flex flex-col items-center group cursor-pointer`}
                style={{
                  left: pos.x,
                  top: pos.y,
                  animation: `ad-float-${i} ${3 + i * 0.4}s ease-in-out infinite`,
                  animationDelay: `${node.floatDelay}s`,
                }}
                onClick={() => setExpandedNode(isExpanded ? null : node.id)}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300"
                  style={{
                    backgroundColor: `${node.color}15`,
                    borderColor: isExpanded ? node.color : `${node.color}30`,
                    boxShadow: isExpanded ? `0 0 16px ${node.color}30` : "none",
                  }}
                >
                  <Icon
                    size={20}
                    style={{ color: node.color }}
                    className="transition-transform duration-200 group-hover:scale-110"
                  />
                </div>
                <span className="mt-1.5 text-[11px] font-medium text-[#A8A29E] group-hover:text-[#E7E5E4] transition-colors whitespace-nowrap">
                  {node.label}
                </span>
              </button>
            );
          })}

        {/* Expanded detail panel */}
        {expandedNode &&
          dimensions.width > 0 &&
          (() => {
            const node = nodes.find((n) => n.id === expandedNode);
            if (!node) return null;
            const Icon = node.icon;

            return (
              <div
                className="absolute z-20 w-[260px]"
                style={{
                  left: centerX,
                  top: centerY,
                  transform: "translate(-50%, -50%)",
                  animation: "ad-detail-in 0.3s ease-out",
                }}
              >
                <div
                  className="rounded-xl bg-[#2D2926] border p-4 shadow-2xl"
                  style={{ borderColor: `${node.color}30` }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${node.color}15` }}
                      >
                        <Icon size={16} style={{ color: node.color }} />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">{node.label}</h4>
                        <p className="text-[10px] text-[#78716C]">{node.description}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedNode(null);
                      }}
                      className="text-[#78716C] hover:text-[#A8A29E] transition-colors cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <ul className="space-y-1.5">
                    {node.details.map((detail, i) => (
                      <li
                        key={detail}
                        className="flex items-start gap-2 text-xs text-[#A8A29E]"
                        style={{
                          animation: `ad-detail-in 0.3s ease-out ${i * 50}ms both`,
                        }}
                      >
                        <span
                          className="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: `${node.color}60` }}
                        />
                        {detail}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })()}
      </div>
    </div>
  );
}
