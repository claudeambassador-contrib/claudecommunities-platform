import type React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

/* ── Types ────────────────────────────────────────────── */
export type CoworkUIStep = {
  label: string;
  description: string;
};

export type CoworkUIDemoProps = {
  steps: CoworkUIStep[];
};

/* ── Colour tokens ────────────────────────────────────── */
const BG = "#1C1917";
const WINDOW_BG = "#141210";
const SIDEBAR_BG = "#1A1816";
const ACCENT = "#D4836A";
const ACCENT_GLOW = "rgba(212, 131, 106, 0.25)";
const TEXT_PRIMARY = "#FFFFFF";
const TEXT_SECONDARY = "#A8A29E";
const TEXT_DIM = "#6B7280";
const CARD_BG = "#2D2926";
const GREEN = "#4ADE80";
const FONT = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

/* ── Animated cursor ──────────────────────────────────── */
const MouseCursor: React.FC<{
  x: number;
  y: number;
  clicking: boolean;
}> = ({ x, y, clicking }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      zIndex: 100,
      pointerEvents: "none",
      transform: `scale(${clicking ? 0.85 : 1})`,
      transition: "transform 0.1s ease",
    }}
  >
    {/* Cursor SVG */}
    <svg
      width="24"
      height="30"
      viewBox="0 0 24 30"
      fill="none"
      style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))" }}
      aria-hidden="true"
    >
      <path
        d="M4 1L4 22L9.5 17L15 26L18 24.5L12.5 15.5L20 14L4 1Z"
        fill="white"
        stroke="#333"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
    {/* Click ripple */}
    {clicking && (
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 30,
          height: 30,
          borderRadius: "50%",
          border: `2px solid ${ACCENT}`,
          opacity: 0.6,
          transform: "translate(-5px, -5px) scale(1.5)",
        }}
      />
    )}
  </div>
);

/* ── Floating annotation callout ──────────────────────── */
const Callout: React.FC<{
  label: string;
  description: string;
  frame: number;
  fps: number;
  startFrame: number;
  x: number;
  y: number;
  direction?: "left" | "right";
}> = ({ label, description, frame, fps, startFrame, x, y, direction = "right" }) => {
  const localFrame = frame - startFrame;
  if (localFrame < 0) return null;

  const fadeIn = interpolate(localFrame, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const slideIn = spring({
    frame: localFrame,
    fps,
    config: { damping: 15, stiffness: 120, mass: 0.5 },
  });
  const slideX =
    direction === "right"
      ? interpolate(slideIn, [0, 1], [30, 0])
      : interpolate(slideIn, [0, 1], [-30, 0]);

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        opacity: fadeIn,
        transform: `translateX(${slideX}px)`,
        zIndex: 50,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        flexDirection: direction === "right" ? "row" : "row-reverse",
      }}
    >
      {/* Connector dot */}
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: ACCENT,
          boxShadow: `0 0 12px ${ACCENT}`,
          marginTop: 6,
          flexShrink: 0,
        }}
      />
      {/* Label card */}
      <div
        style={{
          background: "rgba(45,41,38,0.95)",
          border: `1px solid ${ACCENT}`,
          borderRadius: 10,
          padding: "10px 16px",
          maxWidth: 260,
          boxShadow: `0 4px 20px rgba(0,0,0,0.4), 0 0 20px ${ACCENT_GLOW}`,
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: ACCENT,
            fontFamily: FONT,
            marginBottom: 3,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 13,
            color: TEXT_SECONDARY,
            fontFamily: FONT,
            lineHeight: 1.4,
          }}
        >
          {description}
        </div>
      </div>
    </div>
  );
};

/* ── Progress stage indicator ─────────────────────────── */
const ProgressStage: React.FC<{
  label: string;
  active: boolean;
  complete: boolean;
  frame: number;
  fps: number;
}> = ({ label, active, complete }) => {
  const scale = active ? 1.05 : 1;
  const bgColor = complete ? GREEN : active ? ACCENT : CARD_BG;
  const textColor = complete || active ? "#000" : TEXT_DIM;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        transform: `scale(${scale})`,
        transition: "transform 0.2s ease",
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: bgColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          color: textColor,
          fontWeight: 700,
          boxShadow: active ? `0 0 14px ${ACCENT_GLOW}` : "none",
        }}
      >
        {complete ? "✓" : ""}
      </div>
      <span
        style={{
          fontSize: 13,
          color: active || complete ? TEXT_PRIMARY : TEXT_DIM,
          fontFamily: FONT,
          fontWeight: active ? 600 : 400,
        }}
      >
        {label}
      </span>
    </div>
  );
};

/* ── Main composition ─────────────────────────────────── */
export const CoworkUIDemo: React.FC<CoworkUIDemoProps> = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  /* ── Phase timing (180 frames total) ────────────────── */
  const windowAppear = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 80, mass: 0.8 },
  });
  const windowOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
  });

  /* Phase 1: Window appears (0-20) */
  /* Phase 2: Chat tab active, then cursor moves (20-50) */
  const chatActive = frame < 50;
  const coworkActive = frame >= 50;

  /* Cursor position animation */
  const cursorRestX = 300;
  const cursorRestY = 150;
  const coworkTabX = 580;
  const coworkTabY = 60;

  const cursorX = interpolate(frame, [20, 40, 45], [cursorRestX, coworkTabX, coworkTabX], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.ease),
  });
  const cursorY = interpolate(frame, [20, 40, 45], [cursorRestY, coworkTabY, coworkTabY], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.ease),
  });
  const clicking = frame >= 44 && frame <= 48;
  const showCursor = frame >= 20 && frame <= 80;

  /* Phase 3: Cowork tab activates, content transitions (50-70) */
  const contentSwitch = interpolate(frame, [48, 58], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.ease),
  });

  /* Phase 4: Task typed into input (70-100) */
  const taskText = "Organize my Downloads folder by file type";
  const taskTypingProgress = interpolate(frame, [70, 100], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const taskVisible = Math.floor(taskTypingProgress * taskText.length);
  const displayedTask = taskText.slice(0, taskVisible);
  const taskCursorBlink = frame >= 70 && frame < 110 && Math.floor(frame / 6) % 2 === 0;

  /* Phase 5: Progress states (110-170) */
  const progressPhase = interpolate(frame, [110, 130, 150, 165], [0, 1, 2, 3], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const currentProgress = Math.floor(progressPhase);
  const progressLabels = ["Planning...", "Executing...", "Complete ✓"];

  /* Callout timing */
  const calloutData = [
    {
      startFrame: 52,
      x: 680,
      y: 35,
      label: "Cowork Mode",
      description: "Switch to autonomous task execution",
      direction: "right" as const,
    },
    {
      startFrame: 75,
      x: 680,
      y: 310,
      label: "Natural Language",
      description: "Describe your task in plain English",
      direction: "right" as const,
    },
    {
      startFrame: 115,
      x: 680,
      y: 185,
      label: "Smart Workflow",
      description: "Claude plans, you approve, it executes",
      direction: "right" as const,
    },
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG,
        justifyContent: "center",
        alignItems: "center",
        fontFamily: FONT,
        overflow: "hidden",
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          top: "40%",
          left: "35%",
          width: 800,
          height: 500,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(212,131,106,0.1) 0%, transparent 70%)`,
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
        }}
      />

      {/* App window container */}
      <div
        style={{
          opacity: windowOpacity,
          transform: `scale(${windowScale(windowAppear)})`,
          width: 950,
          height: 540,
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: `
            0 0 0 1px rgba(255,255,255,0.06),
            0 25px 80px rgba(0,0,0,0.6),
            0 0 40px rgba(212,131,106,0.06)
          `,
          position: "relative",
          background: WINDOW_BG,
        }}
      >
        {/* Title bar */}
        <div
          style={{
            background: SIDEBAR_BG,
            padding: "12px 18px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            borderBottom: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          {/* Traffic lights */}
          <div style={{ display: "flex", gap: 7 }}>
            {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
              <div
                key={c}
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: "50%",
                  background: c,
                }}
              />
            ))}
          </div>

          {/* Tab bar */}
          <div
            style={{
              display: "flex",
              gap: 0,
              marginLeft: 30,
              background: "rgba(255,255,255,0.03)",
              borderRadius: 8,
              padding: 3,
            }}
          >
            {/* Chat tab */}
            <div
              style={{
                padding: "7px 28px",
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 600,
                color: chatActive ? TEXT_PRIMARY : TEXT_DIM,
                background: chatActive ? "rgba(255,255,255,0.08)" : "transparent",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              Chat
            </div>
            {/* Cowork tab */}
            <div
              style={{
                padding: "7px 28px",
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 600,
                color: coworkActive ? TEXT_PRIMARY : TEXT_DIM,
                background: coworkActive
                  ? `linear-gradient(135deg, ${ACCENT}, #C06B52)`
                  : "transparent",
                boxShadow: coworkActive ? `0 2px 12px ${ACCENT_GLOW}` : "none",
                cursor: "pointer",
                transition: "all 0.3s",
              }}
            >
              Cowork
            </div>
          </div>

          {/* Window title */}
          <span
            style={{
              marginLeft: "auto",
              fontSize: 12,
              color: TEXT_DIM,
              fontWeight: 500,
            }}
          >
            Claude Desktop
          </span>
        </div>

        {/* Content area */}
        <div
          style={{
            display: "flex",
            height: "calc(100% - 46px)",
            position: "relative",
          }}
        >
          {/* Sidebar */}
          <div
            style={{
              width: 200,
              background: SIDEBAR_BG,
              borderRight: "1px solid rgba(255,255,255,0.04)",
              padding: "16px 12px",
            }}
          >
            {/* Sidebar items */}
            {["New task", "File organizer", "Email draft", "Code review"].map((item, i) => (
              <div
                key={item}
                style={{
                  padding: "8px 12px",
                  borderRadius: 6,
                  fontSize: 13,
                  color: i === 1 && coworkActive ? TEXT_PRIMARY : TEXT_DIM,
                  background: i === 1 && coworkActive ? "rgba(212,131,106,0.12)" : "transparent",
                  marginBottom: 4,
                  fontWeight: i === 1 && coworkActive ? 500 : 400,
                }}
              >
                {item}
              </div>
            ))}
          </div>

          {/* Main content */}
          <div
            style={{
              flex: 1,
              padding: "28px 32px",
              display: "flex",
              flexDirection: "column",
              position: "relative",
            }}
          >
            {/* Chat mode content (fades out) */}
            <div
              style={{
                opacity: 1 - contentSwitch,
                position: "absolute",
                inset: "28px 32px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: `linear-gradient(135deg, ${ACCENT}, #C06B52)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                }}
              >
                ✦
              </div>
              <span
                style={{
                  fontSize: 18,
                  color: TEXT_SECONDARY,
                  fontWeight: 500,
                }}
              >
                How can I help you today?
              </span>
            </div>

            {/* Cowork mode content (fades in) */}
            <div
              style={{
                opacity: contentSwitch,
                display: "flex",
                flexDirection: "column",
                gap: 20,
                flex: 1,
              }}
            >
              {/* Cowork header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: ACCENT,
                    boxShadow: `0 0 8px ${ACCENT}`,
                  }}
                />
                <span
                  style={{
                    fontSize: 16,
                    color: TEXT_PRIMARY,
                    fontWeight: 600,
                  }}
                >
                  Cowork Mode
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: TEXT_DIM,
                    marginLeft: 8,
                    background: "rgba(255,255,255,0.05)",
                    padding: "2px 8px",
                    borderRadius: 4,
                  }}
                >
                  Autonomous
                </span>
              </div>

              {/* Task input area */}
              <div
                style={{
                  background: CARD_BG,
                  borderRadius: 10,
                  padding: "16px 20px",
                  border: "1px solid rgba(255,255,255,0.06)",
                  minHeight: 60,
                }}
              >
                <span
                  style={{
                    fontSize: 15,
                    color: displayedTask ? TEXT_PRIMARY : TEXT_DIM,
                    fontFamily: FONT,
                    lineHeight: 1.5,
                  }}
                >
                  {displayedTask || "Describe your task..."}
                </span>
                {frame >= 70 && frame < 110 && (
                  <span
                    style={{
                      display: "inline-block",
                      width: 2,
                      height: 18,
                      background: taskCursorBlink ? ACCENT : "transparent",
                      marginLeft: 1,
                      verticalAlign: "text-bottom",
                    }}
                  />
                )}
              </div>

              {/* Progress section */}
              {frame >= 110 && (
                <div
                  style={{
                    background: CARD_BG,
                    borderRadius: 10,
                    padding: "18px 20px",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 14,
                    }}
                  >
                    {progressLabels.map((label, i) => {
                      const isActive = currentProgress === i;
                      const isComplete = currentProgress > i;
                      const stageOpacity = interpolate(
                        frame,
                        [110 + i * 18, 115 + i * 18],
                        [0, 1],
                        {
                          extrapolateLeft: "clamp",
                          extrapolateRight: "clamp",
                        },
                      );

                      return (
                        <div key={label} style={{ opacity: stageOpacity }}>
                          <ProgressStage
                            label={label}
                            active={isActive}
                            complete={isComplete}
                            frame={frame}
                            fps={fps}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Progress bar */}
                  <div
                    style={{
                      marginTop: 16,
                      height: 4,
                      background: "rgba(255,255,255,0.06)",
                      borderRadius: 2,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(100, (progressPhase / 3) * 100)}%`,
                        background: `linear-gradient(90deg, ${ACCENT}, ${GREEN})`,
                        borderRadius: 2,
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Animated cursor */}
        {showCursor && <MouseCursor x={cursorX} y={cursorY} clicking={clicking} />}
      </div>

      {/* Floating callouts */}
      {calloutData.map((callout) => (
        <Callout
          key={callout.label}
          label={callout.label}
          description={callout.description}
          frame={frame}
          fps={fps}
          startFrame={callout.startFrame}
          x={callout.x}
          y={callout.y}
          direction={callout.direction}
        />
      ))}
    </AbsoluteFill>
  );
};

/* Helper to convert spring value to window scale */
function windowScale(s: number): number {
  return 0.92 + s * 0.08;
}
