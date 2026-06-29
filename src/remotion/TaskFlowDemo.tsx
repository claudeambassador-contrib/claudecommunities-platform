import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

/* ── Types ────────────────────────────────────────────── */
export type TaskFlowDemoProps = {
  taskName: string;
};

/* ── Colour tokens ────────────────────────────────────── */
const BG = "#1C1917";
const CARD_BG = "#2D2926";
const ACCENT = "#D4836A";
const ACCENT_GLOW = "rgba(212, 131, 106, 0.35)";
const GREEN = "#4ADE80";
const TEXT_PRIMARY = "#FFFFFF";
const TEXT_SECONDARY = "#A8A29E";
const TEXT_DIM = "#6B7280";
const FONT = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

/* ── Pipeline stages ──────────────────────────────────── */
const STAGES = [
  { name: "Describe", icon: "describe" },
  { name: "Plan", icon: "plan" },
  { name: "Approve", icon: "approve" },
  { name: "Execute", icon: "execute" },
  { name: "Deliver", icon: "deliver" },
] as const;

type StageIcon = (typeof STAGES)[number]["icon"];

/* ── Stage timing (180 frames total, ~36 frames per stage) */
function getStagePhase(frame: number): { active: number; progress: number } {
  const stageFrames = 32;
  const startOffset = 15;
  const adjustedFrame = Math.max(0, frame - startOffset);
  const active = Math.min(4, Math.floor(adjustedFrame / stageFrames));
  const progress = Math.min(1, (adjustedFrame % stageFrames) / stageFrames);
  return { active, progress };
}

/* ── Typing cursor animation ──────────────────────────── */
const TypingCursor: React.FC<{ frame: number }> = ({ frame }) => {
  const blink = Math.floor(frame / 6) % 2 === 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <div
        style={{
          width: 28,
          height: 2,
          background: TEXT_PRIMARY,
          borderRadius: 1,
          opacity: 0.6,
        }}
      />
      <div
        style={{
          width: 2,
          height: 18,
          background: blink ? ACCENT : "transparent",
          borderRadius: 1,
        }}
      />
    </div>
  );
};

/* ── Bullet list appearing ────────────────────────────── */
const BulletList: React.FC<{ frame: number; progress: number }> = ({ progress }) => {
  const items = 3;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {Array.from({ length: items }, (_, i) => {
        const itemProgress = Math.max(0, (progress * items - i) / 1);
        const opacity = Math.min(1, itemProgress);
        return (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: static count-based render that never reorders or inserts
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              opacity,
            }}
          >
            <div
              style={{
                width: 4,
                height: 4,
                borderRadius: "50%",
                background: ACCENT,
                flexShrink: 0,
              }}
            />
            <div
              style={{
                width: 20 + i * 8,
                height: 2,
                background: TEXT_SECONDARY,
                borderRadius: 1,
                opacity: 0.5,
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

/* ── Checkmark stamp ──────────────────────────────────── */
const CheckStamp: React.FC<{ frame: number; fps: number; startFrame: number }> = ({
  frame,
  fps,
  startFrame,
}) => {
  const localFrame = frame - startFrame;
  if (localFrame < 0) return null;

  const stampScale = spring({
    frame: localFrame,
    fps,
    config: { damping: 8, stiffness: 200, mass: 0.4 },
  });
  const stampScaleValue = interpolate(stampScale, [0, 0.5, 1], [2.5, 0.9, 1]);
  const stampOpacity = interpolate(localFrame, [0, 3], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <div
      style={{
        transform: `scale(${stampScaleValue})`,
        opacity: stampOpacity,
      }}
    >
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <circle cx="14" cy="14" r="12" stroke={GREEN} strokeWidth="2.5" fill="none" />
        <path
          d="M8 14.5L12 18.5L20 10.5"
          stroke={GREEN}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

/* ── Spinning gear ────────────────────────────────────── */
const SpinningGear: React.FC<{ frame: number; progress: number }> = ({ frame, progress }) => {
  const rotation = frame * 4;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
      <div style={{ transform: `rotate(${rotation}deg)` }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke={ACCENT} strokeWidth="1.5" />
          <path
            d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
            stroke={ACCENT}
            strokeWidth="1.5"
          />
        </svg>
      </div>
      {/* Mini progress bar */}
      <div
        style={{
          width: 32,
          height: 3,
          background: "rgba(255,255,255,0.1)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${progress * 100}%`,
            height: "100%",
            background: ACCENT,
            borderRadius: 2,
          }}
        />
      </div>
    </div>
  );
};

/* ── File with sparkle ────────────────────────────────── */
const FileSparkle: React.FC<{ frame: number; fps: number; startFrame: number }> = ({
  frame,
  fps,
  startFrame,
}) => {
  const localFrame = frame - startFrame;
  if (localFrame < 0) return null;

  const bounceScale = spring({
    frame: localFrame,
    fps,
    config: { damping: 10, stiffness: 160, mass: 0.4 },
  });
  const sparkleRotation = localFrame * 6;
  const sparkleOpacity = interpolate(localFrame, [0, 5, 25, 32], [0, 1, 1, 0.8], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <div
      style={{
        position: "relative",
        transform: `scale(${bounceScale})`,
        opacity: sparkleOpacity,
      }}
    >
      {/* File icon */}
      <svg width="24" height="28" viewBox="0 0 24 28" fill="none" aria-hidden="true">
        <path
          d="M4 2h10l6 6v16a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2z"
          fill={CARD_BG}
          stroke={ACCENT}
          strokeWidth="1.5"
        />
        <path d="M14 2v6h6" stroke={ACCENT} strokeWidth="1.5" />
        <path d="M7 16h10M7 20h6" stroke={TEXT_DIM} strokeWidth="1" />
      </svg>
      {/* Sparkle */}
      <div
        style={{
          position: "absolute",
          top: -6,
          right: -8,
          transform: `rotate(${sparkleRotation}deg)`,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill={ACCENT} aria-hidden="true">
          <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5Z" />
        </svg>
      </div>
    </div>
  );
};

/* ── Stage inner content ──────────────────────────────── */
const StageContent: React.FC<{
  icon: StageIcon;
  frame: number;
  fps: number;
  progress: number;
  stageStartFrame: number;
}> = ({ icon, frame, fps, progress, stageStartFrame }) => {
  switch (icon) {
    case "describe":
      return <TypingCursor frame={frame} />;
    case "plan":
      return <BulletList frame={frame} progress={progress} />;
    case "approve":
      return <CheckStamp frame={frame} fps={fps} startFrame={stageStartFrame + 8} />;
    case "execute":
      return <SpinningGear frame={frame} progress={progress} />;
    case "deliver":
      return <FileSparkle frame={frame} fps={fps} startFrame={stageStartFrame + 5} />;
    default:
      return null;
  }
};

/* ── Pipeline node ────────────────────────────────────── */
const PipelineNode: React.FC<{
  stage: (typeof STAGES)[number];
  index: number;
  frame: number;
  fps: number;
  isActive: boolean;
  isComplete: boolean;
  stageProgress: number;
}> = ({ stage, index, frame, fps, isActive, isComplete, stageProgress }) => {
  /* Appear animation */
  const appearDelay = 5 + index * 6;
  const nodeOpacity = interpolate(frame, [appearDelay, appearDelay + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const nodeScale = spring({
    frame: Math.max(0, frame - appearDelay),
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.5 },
  });

  /* Active scale pulse */
  const activeScale = isActive ? 1.08 + Math.sin(frame * 0.15) * 0.02 : 1;

  /* Glow intensity */
  const glowIntensity = isActive ? 0.5 : isComplete ? 0.2 : 0;

  /* Border color */
  const borderColor = isActive ? ACCENT : isComplete ? GREEN : "rgba(255,255,255,0.08)";

  /* BG gradient */
  const bgGradient = isActive
    ? `linear-gradient(145deg, ${CARD_BG}, #352E2A)`
    : isComplete
      ? `linear-gradient(145deg, #2A302A, ${CARD_BG})`
      : `linear-gradient(145deg, ${CARD_BG}, #252220)`;

  const stageStartFrame = 15 + index * 32;

  return (
    <div
      style={{
        opacity: nodeOpacity,
        transform: `scale(${nodeScale * activeScale})`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        position: "relative",
      }}
    >
      {/* Glow behind node */}
      {glowIntensity > 0 && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: 120,
            height: 120,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${isActive ? ACCENT_GLOW : "rgba(74,222,128,0.15)"} 0%, transparent 70%)`,
            transform: "translate(-50%, -50%)",
            opacity: glowIntensity,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Node card */}
      <div
        style={{
          width: 100,
          height: 100,
          borderRadius: 16,
          background: bgGradient,
          border: `2px solid ${borderColor}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: isActive
            ? `0 0 24px ${ACCENT_GLOW}, 0 4px 16px rgba(0,0,0,0.3)`
            : "0 2px 8px rgba(0,0,0,0.2)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Content animation */}
        {(isActive || isComplete) && (
          <StageContent
            icon={stage.icon}
            frame={frame}
            fps={fps}
            progress={stageProgress}
            stageStartFrame={stageStartFrame}
          />
        )}
        {/* Inactive state: dimmed icon */}
        {!isActive && !isComplete && (
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              border: `2px solid ${TEXT_DIM}`,
              opacity: 0.4,
            }}
          />
        )}
      </div>

      {/* Stage label */}
      <span
        style={{
          fontSize: 14,
          fontWeight: isActive ? 700 : 500,
          color: isActive ? ACCENT : isComplete ? GREEN : TEXT_DIM,
          fontFamily: FONT,
          letterSpacing: "0.5px",
        }}
      >
        {stage.name}
      </span>

      {/* Active indicator dot */}
      {isActive && (
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: ACCENT,
            boxShadow: `0 0 8px ${ACCENT}`,
            position: "absolute",
            bottom: -8,
          }}
        />
      )}
    </div>
  );
};

/* ── Animated connecting arrow ────────────────────────── */
const ConnectingArrow: React.FC<{
  index: number;
  frame: number;
  fps: number;
  filled: boolean;
}> = ({ index, frame, filled }) => {
  const appearDelay = 8 + index * 6;
  const opacity = interpolate(frame, [appearDelay, appearDelay + 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const fillProgress = filled
    ? interpolate(frame, [15 + index * 32 + 28, 15 + (index + 1) * 32], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.out(Easing.ease),
      })
    : 0;

  return (
    <div
      style={{
        width: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity,
        marginBottom: 26,
      }}
    >
      <div style={{ position: "relative", width: 50, height: 4 }}>
        {/* Track */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(255,255,255,0.06)",
            borderRadius: 2,
          }}
        />
        {/* Fill */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            width: `${fillProgress * 100}%`,
            background: `linear-gradient(90deg, ${GREEN}, ${ACCENT})`,
            borderRadius: 2,
          }}
        />
        {/* Arrow head */}
        <div
          style={{
            position: "absolute",
            right: -6,
            top: "50%",
            transform: "translateY(-50%)",
            width: 0,
            height: 0,
            borderLeft: `8px solid ${fillProgress > 0.9 ? ACCENT : "rgba(255,255,255,0.15)"}`,
            borderTop: "5px solid transparent",
            borderBottom: "5px solid transparent",
          }}
        />
      </div>
    </div>
  );
};

/* ── Main composition ─────────────────────────────────── */
export const TaskFlowDemo: React.FC<TaskFlowDemoProps> = ({ taskName }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { active: activeStage, progress: stageProgress } = getStagePhase(frame);

  /* Task name appears at top */
  const titleOpacity = interpolate(frame, [3, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(frame, [3, 15], [15, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.ease),
  });

  /* Background ambient glow follows active stage */
  const glowX = interpolate(activeStage, [0, 4], [25, 75]);
  const glowPulse = 0.08 + Math.sin(frame * 0.08) * 0.03;

  /* Completion state */
  const allComplete = frame >= 175;
  const completionOpacity = interpolate(frame, [170, 178], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG,
        fontFamily: FONT,
        overflow: "hidden",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Ambient glow following active stage */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: `${glowX}%`,
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(212,131,106,${glowPulse}) 0%, transparent 70%)`,
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          transition: "left 0.5s ease",
        }}
      />

      {/* Secondary glow */}
      <div
        style={{
          position: "absolute",
          top: "60%",
          left: "50%",
          width: 800,
          height: 300,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(212,131,106,0.04) 0%, transparent 70%)`,
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
        }}
      />

      {/* Task name header */}
      <div
        style={{
          position: "absolute",
          top: 60,
          left: "50%",
          transform: `translateX(-50%) translateY(${titleY}px)`,
          opacity: titleOpacity,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 13,
            color: TEXT_DIM,
            fontWeight: 600,
            letterSpacing: "3px",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Task Lifecycle
        </div>
        <div
          style={{
            fontSize: 24,
            color: TEXT_PRIMARY,
            fontWeight: 700,
            maxWidth: 600,
          }}
        >
          {taskName}
        </div>
      </div>

      {/* Pipeline */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginTop: 30,
        }}
      >
        {STAGES.map((stage, i) => (
          <React.Fragment key={stage.name}>
            <PipelineNode
              stage={stage}
              index={i}
              frame={frame}
              fps={fps}
              isActive={activeStage === i}
              isComplete={activeStage > i}
              stageProgress={activeStage === i ? stageProgress : activeStage > i ? 1 : 0}
            />
            {i < STAGES.length - 1 && (
              <ConnectingArrow index={i} frame={frame} fps={fps} filled={activeStage > i} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Completion overlay */}
      {allComplete && (
        <div
          style={{
            position: "absolute",
            bottom: 80,
            left: "50%",
            transform: "translateX(-50%)",
            opacity: completionOpacity,
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: CARD_BG,
            borderRadius: 12,
            padding: "12px 28px",
            border: `1px solid ${GREEN}55`,
            boxShadow: `0 4px 20px rgba(0,0,0,0.3), 0 0 16px rgba(74,222,128,0.15)`,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke={GREEN} strokeWidth="2" />
            <path
              d="M8 12l3 3 5-5"
              stroke={GREEN}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span
            style={{
              fontSize: 16,
              color: TEXT_PRIMARY,
              fontWeight: 600,
            }}
          >
            Task complete
          </span>
        </div>
      )}

      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.3) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
