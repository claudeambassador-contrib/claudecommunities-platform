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
export type TerminalCommand = {
  input: string;
  output: string;
  delay?: number;
};

export type TerminalDemoProps = {
  commands: TerminalCommand[];
};

/* ── Colour tokens ────────────────────────────────────── */
const BG = "#1C1917";
const TERMINAL_BG = "#0D0D0D";
const TERMINAL_CHROME = "#1A1A1A";
const ACCENT = "#D4836A";
const GREEN = "#4ADE80";
const TEXT_PRIMARY = "#E7E5E4";
const TEXT_DIM = "#6B7280";
const TEXT_OUTPUT = "#A8A29E";
const FONT_MONO = "'SF Mono', 'Fira Code', 'JetBrains Mono', 'Cascadia Code', Consolas, monospace";

/* ── Scanline overlay ─────────────────────────────────── */
const Scanlines: React.FC = () => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      background:
        "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)",
      pointerEvents: "none",
      borderRadius: 12,
      zIndex: 10,
    }}
  />
);

/* ── Traffic light dots ───────────────────────────────── */
const TrafficLights: React.FC = () => (
  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
    <div
      style={{
        width: 12,
        height: 12,
        borderRadius: "50%",
        background: "#FF5F57",
        boxShadow: "0 0 6px rgba(255,95,87,0.4)",
      }}
    />
    <div
      style={{
        width: 12,
        height: 12,
        borderRadius: "50%",
        background: "#FEBC2E",
        boxShadow: "0 0 6px rgba(254,188,46,0.4)",
      }}
    />
    <div
      style={{
        width: 12,
        height: 12,
        borderRadius: "50%",
        background: "#28C840",
        boxShadow: "0 0 6px rgba(40,200,64,0.4)",
      }}
    />
  </div>
);

/* ── Blinking cursor ──────────────────────────────────── */
const Cursor: React.FC<{ frame: number; visible: boolean }> = ({ frame, visible }) => {
  if (!visible) return null;
  const blink = Math.floor(frame / 8) % 2 === 0;
  return (
    <span
      style={{
        display: "inline-block",
        width: 10,
        height: 22,
        backgroundColor: blink ? ACCENT : "transparent",
        marginLeft: 1,
        verticalAlign: "text-bottom",
        borderRadius: 1,
      }}
    />
  );
};

/* ── Single command block ─────────────────────────────── */
const CommandBlock: React.FC<{
  command: TerminalCommand;
  frame: number;
  fps: number;
  startFrame: number;
}> = ({ command, frame, startFrame }) => {
  const localFrame = frame - startFrame;
  if (localFrame < 0) return null;

  /* Typing animation: ~2 chars per frame */
  const charsPerFrame = 2;
  const typingFrames = Math.ceil(command.input.length / charsPerFrame);
  const typedChars = Math.min(command.input.length, Math.floor(localFrame * charsPerFrame));
  const displayedInput = command.input.slice(0, typedChars);
  const isTyping = typedChars < command.input.length;
  const typingDone = localFrame >= typingFrames;

  /* Output lines appear staggered after typing finishes */
  const outputLines = command.output.split("\n").filter((line) => line.length > 0);
  const outputStartFrame = typingFrames + 8;

  /* Fade-in for the entire block */
  const blockOpacity = interpolate(localFrame, [0, 5], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <div style={{ opacity: blockOpacity, marginBottom: 16 }}>
      {/* Prompt + input */}
      <div style={{ display: "flex", alignItems: "center", minHeight: 28 }}>
        <span
          style={{
            color: GREEN,
            marginRight: 8,
            fontSize: 20,
            fontWeight: 700,
            fontFamily: FONT_MONO,
          }}
        >
          ❯
        </span>
        <span
          style={{
            color: TEXT_PRIMARY,
            fontSize: 20,
            fontFamily: FONT_MONO,
            fontWeight: 500,
            letterSpacing: "0.3px",
          }}
        >
          {displayedInput}
        </span>
        <Cursor frame={frame} visible={isTyping || (!typingDone && localFrame > 0)} />
      </div>

      {/* Output lines */}
      {typingDone &&
        outputLines.map((line, i) => {
          const lineDelay = outputStartFrame + i * 3;
          const lineLocalFrame = localFrame - lineDelay;
          if (lineLocalFrame < 0) return null;

          const lineOpacity = interpolate(lineLocalFrame, [0, 4], [0, 1], {
            extrapolateRight: "clamp",
            extrapolateLeft: "clamp",
          });
          const lineSlide = interpolate(lineLocalFrame, [0, 4], [8, 0], {
            extrapolateRight: "clamp",
            extrapolateLeft: "clamp",
            easing: Easing.out(Easing.ease),
          });

          /* Highlight lines containing special markers */
          const isSuccess = line.includes("✓") || line.includes("Done") || line.includes("Success");
          const isAccent = line.includes("→") || line.includes("...");

          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: static output lines rendered in fixed order, never reordered or inserted
              key={i}
              style={{
                opacity: lineOpacity,
                transform: `translateY(${lineSlide}px)`,
                paddingLeft: 28,
                fontSize: 18,
                fontFamily: FONT_MONO,
                lineHeight: 1.6,
                color: isSuccess ? GREEN : isAccent ? ACCENT : TEXT_OUTPUT,
              }}
            >
              {line}
            </div>
          );
        })}
    </div>
  );
};

/* ── Calculate frames per command ─────────────────────── */
export function calculateTerminalDuration(commands: TerminalCommand[]): number {
  let total = 15; // initial delay
  for (const cmd of commands) {
    const typingFrames = Math.ceil(cmd.input.length / 2);
    const outputLines = cmd.output.split("\n").filter((l) => l.length > 0).length;
    const outputFrames = 8 + outputLines * 3 + 10;
    const pauseFrames = cmd.delay ?? 20;
    total += typingFrames + outputFrames + pauseFrames;
  }
  return total + 20; // trailing pause
}

/* ── Main composition ─────────────────────────────────── */
export const TerminalDemo: React.FC<TerminalDemoProps> = ({ commands }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  /* Window chrome animation */
  const windowScale = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 80, mass: 0.8 },
  });
  const windowOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
  });

  /* Calculate start frames for each command */
  const commandStartFrames: number[] = [];
  let runningFrame = 15;
  for (const cmd of commands) {
    commandStartFrames.push(runningFrame);
    const typingFrames = Math.ceil(cmd.input.length / 2);
    const outputLines = cmd.output.split("\n").filter((l) => l.length > 0).length;
    const outputFrames = 8 + outputLines * 3 + 10;
    const pauseFrames = cmd.delay ?? 20;
    runningFrame += typingFrames + outputFrames + pauseFrames;
  }

  /* Scroll offset: smoothly scroll up as content grows */
  const maxVisibleLines = 14;
  let totalLinesAbove = 0;
  for (let i = 0; i < commands.length; i++) {
    if (frame < commandStartFrames[i]) break;
    const outputLines = commands[i].output.split("\n").filter((l) => l.length > 0).length;
    totalLinesAbove += 1 + outputLines + 1; // prompt + output + gap
  }
  const overflowLines = Math.max(0, totalLinesAbove - maxVisibleLines);
  const scrollOffset = overflowLines * 32;

  /* Ambient glow behind terminal */
  const glowPulse = interpolate(frame % 120, [0, 60, 120], [0.3, 0.5, 0.3], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG,
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      {/* Background ambient glow */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 1000,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(212,131,106,${glowPulse * 0.15}) 0%, transparent 70%)`,
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
        }}
      />

      {/* Terminal window */}
      <div
        style={{
          opacity: windowOpacity,
          transform: `scale(${windowScale * 0.98 + 0.02})`,
          width: 1100,
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: `
            0 0 0 1px rgba(255,255,255,0.06),
            0 25px 80px rgba(0,0,0,0.6),
            0 0 60px rgba(212,131,106,0.08)
          `,
          position: "relative",
        }}
      >
        {/* Title bar */}
        <div
          style={{
            background: TERMINAL_CHROME,
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <TrafficLights />
          <span
            style={{
              color: TEXT_DIM,
              fontSize: 14,
              fontFamily: FONT_MONO,
              fontWeight: 500,
              letterSpacing: "0.5px",
            }}
          >
            Claude Desktop — Cowork
          </span>
          <div style={{ width: 52 }} />
        </div>

        {/* Terminal body */}
        <div
          style={{
            background: TERMINAL_BG,
            padding: "24px 28px",
            minHeight: 440,
            maxHeight: 480,
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* Scrollable content area */}
          <div
            style={{
              transform: `translateY(-${scrollOffset}px)`,
              transition: "transform 0.3s ease-out",
            }}
          >
            {commands.map((cmd, i) => (
              <CommandBlock
                // biome-ignore lint/suspicious/noArrayIndexKey: static command list rendered in fixed order, never reordered or inserted
                key={i}
                command={cmd}
                frame={frame}
                fps={fps}
                startFrame={commandStartFrames[i]}
              />
            ))}
          </div>

          {/* Bottom fade for scroll */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 60,
              background: `linear-gradient(transparent, ${TERMINAL_BG})`,
              pointerEvents: "none",
            }}
          />

          {/* Scanlines overlay */}
          <Scanlines />
        </div>
      </div>
    </AbsoluteFill>
  );
};
