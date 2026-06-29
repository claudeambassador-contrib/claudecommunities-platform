import type React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

type LessonIntroProps = {
  lessonNumber: number;
  lessonTitle: string;
  lessonDuration: string;
  courseTitle: string;
};

/* ── Colour tokens ─────────────────────────────────────── */
const BG = "#1C1917";
const ACCENT = "#D4836A";
const ACCENT_GLOW = "rgba(212, 131, 106, 0.35)";
const ACCENT_GLOW_SOFT = "rgba(212, 131, 106, 0.12)";
const TEXT_PRIMARY = "#FFFFFF";
const TEXT_SECONDARY = "#A8A29E";
const FONT = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

/* ── Decorative floating particle ──────────────────────── */
const Particle: React.FC<{
  frame: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  speed: number;
}> = ({ frame, x, y, size, delay, speed }) => {
  const adjustedFrame = Math.max(0, frame - delay);
  const opacity = interpolate(adjustedFrame, [0, 20, 100, 120], [0, 0.4, 0.4, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const yOffset = adjustedFrame * speed * -0.3;
  const xDrift = Math.sin(adjustedFrame * 0.05) * 15;

  return (
    <div
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        borderRadius: "50%",
        background: ACCENT,
        opacity,
        transform: `translate(${xDrift}px, ${yOffset}px)`,
        filter: "blur(1px)",
        pointerEvents: "none",
      }}
    />
  );
};

/* ── Horizontal accent line ────────────────────────────── */
const AccentLine: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const width = spring({
    frame: Math.max(0, frame - 25),
    fps,
    config: { damping: 30, stiffness: 80, mass: 0.8 },
  });

  const pulse = interpolate(frame, [80, 100, 120], [1, 1.15, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.ease),
  });

  return (
    <div
      style={{
        width: `${width * 120 * pulse}px`,
        height: 3,
        background: `linear-gradient(90deg, transparent, ${ACCENT}, transparent)`,
        borderRadius: 2,
        margin: "20px auto",
        opacity: interpolate(frame, [25, 35], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      }}
    />
  );
};

/* ── Main composition ──────────────────────────────────── */
export const LessonIntro: React.FC<LessonIntroProps> = ({
  lessonNumber,
  lessonTitle,
  lessonDuration,
  courseTitle,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  /* ── 1. Background gradient circle (frames 0-20) ────── */
  const circleScale = spring({
    frame,
    fps,
    config: { damping: 40, stiffness: 60, mass: 1.2 },
  });
  const circleOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  /* Subtle rotation of the background glow */
  const glowRotation = interpolate(frame, [0, 120], [0, 25], {
    extrapolateRight: "clamp",
  });

  /* Pulse effect for accent elements (frames 80-120) */
  const accentPulse = interpolate(frame, [80, 95, 110, 120], [1, 1.04, 0.98, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.ease),
  });

  /* ── 2. Course title (frames 10-40) ────────────────── */
  const courseTitleOpacity = interpolate(frame, [10, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const courseTitleY = interpolate(frame, [10, 35], [24, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.exp),
  });

  /* ── 3. Lesson number with spring physics (frames 20-50) */
  const numberSpring = spring({
    frame: Math.max(0, frame - 20),
    fps,
    config: { damping: 12, stiffness: 100, mass: 0.6 },
  });
  const numberOpacity = interpolate(frame, [20, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* ── 4. Typewriter for lesson title (frames 35-65) ──── */
  const typewriterProgress = interpolate(frame, [35, 65], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.ease),
  });
  const visibleChars = Math.floor(typewriterProgress * lessonTitle.length);
  const displayedTitle = lessonTitle.slice(0, visibleChars);
  const cursorVisible = frame >= 35 && frame <= 75 && Math.floor(frame / 4) % 2 === 0;

  /* ── 5. Duration badge (frames 50-70) ───────────────── */
  const badgeSlide = spring({
    frame: Math.max(0, frame - 50),
    fps,
    config: { damping: 18, stiffness: 120, mass: 0.5 },
  });
  const badgeX = interpolate(badgeSlide, [0, 1], [80, 0]);
  const badgeOpacity = interpolate(frame, [50, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* ── Particle seeds ─────────────────────────────────── */
  const particles = [
    { x: 15, y: 25, size: 4, delay: 5, speed: 0.8 },
    { x: 82, y: 70, size: 3, delay: 12, speed: 1.1 },
    { x: 30, y: 80, size: 5, delay: 8, speed: 0.6 },
    { x: 70, y: 20, size: 3, delay: 18, speed: 0.9 },
    { x: 50, y: 85, size: 4, delay: 25, speed: 0.7 },
    { x: 90, y: 45, size: 3, delay: 15, speed: 1.0 },
    { x: 10, y: 55, size: 5, delay: 30, speed: 0.5 },
    { x: 60, y: 15, size: 3, delay: 22, speed: 0.8 },
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG,
        fontFamily: FONT,
        overflow: "hidden",
      }}
    >
      {/* ── Background gradient circle ────────────────── */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 900,
          height: 900,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${ACCENT_GLOW} 0%, ${ACCENT_GLOW_SOFT} 40%, transparent 70%)`,
          transform: `translate(-50%, -50%) scale(${circleScale * 1.2}) rotate(${glowRotation}deg)`,
          opacity: circleOpacity * accentPulse,
          pointerEvents: "none",
        }}
      />

      {/* Secondary background glow — shifted for depth */}
      <div
        style={{
          position: "absolute",
          top: "45%",
          left: "55%",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(212,131,106,0.15) 0%, transparent 65%)`,
          transform: `translate(-50%, -50%) scale(${circleScale * 0.9}) rotate(${-glowRotation * 0.7}deg)`,
          opacity: circleOpacity * 0.7,
          pointerEvents: "none",
        }}
      />

      {/* ── Floating particles ────────────────────────── */}
      {particles.map((p, i) => (
        <Particle
          // biome-ignore lint/suspicious/noArrayIndexKey: static inline decorative particle list, never reordered
          key={i}
          frame={frame}
          {...p}
        />
      ))}

      {/* ── Subtle vignette overlay ───────────────────── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* ── Content layer ─────────────────────────────── */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          padding: "0 120px",
        }}
      >
        {/* Course title */}
        <Sequence from={10}>
          <div
            style={{
              opacity: courseTitleOpacity,
              transform: `translateY(${courseTitleY}px)`,
              textAlign: "center",
              marginBottom: 24,
            }}
          >
            <span
              style={{
                fontSize: 28,
                fontWeight: 500,
                color: TEXT_SECONDARY,
                letterSpacing: "3px",
                textTransform: "uppercase",
              }}
            >
              {courseTitle}
            </span>
          </div>
        </Sequence>

        {/* Accent line */}
        <AccentLine frame={frame} fps={fps} />

        {/* Lesson number */}
        <Sequence from={20}>
          <div
            style={{
              opacity: numberOpacity,
              transform: `scale(${numberSpring * accentPulse})`,
              textAlign: "center",
              marginTop: 16,
              marginBottom: 8,
              position: "relative",
            }}
          >
            {/* Ghost number behind for glow effect */}
            <span
              style={{
                position: "absolute",
                top: 0,
                left: "50%",
                transform: "translateX(-50%)",
                fontSize: 140,
                fontWeight: 900,
                color: ACCENT,
                opacity: 0.15,
                filter: "blur(20px)",
                lineHeight: 1,
                userSelect: "none",
              }}
            >
              {String(lessonNumber).padStart(2, "0")}
            </span>
            <span
              style={{
                fontSize: 140,
                fontWeight: 900,
                color: TEXT_PRIMARY,
                lineHeight: 1,
                position: "relative",
                display: "inline-block",
              }}
            >
              <span style={{ color: ACCENT, marginRight: 8, fontSize: 80, fontWeight: 600 }}>
                Lesson
              </span>
              {String(lessonNumber).padStart(2, "0")}
            </span>
          </div>
        </Sequence>

        {/* Lesson title — typewriter */}
        <Sequence from={35}>
          <div
            style={{
              textAlign: "center",
              marginTop: 20,
              minHeight: 60,
            }}
          >
            <span
              style={{
                fontSize: 48,
                fontWeight: 600,
                color: TEXT_PRIMARY,
                letterSpacing: "-0.5px",
                lineHeight: 1.3,
              }}
            >
              {displayedTitle}
            </span>
            {cursorVisible && (
              <span
                style={{
                  display: "inline-block",
                  width: 3,
                  height: 48,
                  backgroundColor: ACCENT,
                  marginLeft: 2,
                  verticalAlign: "text-bottom",
                  borderRadius: 1,
                }}
              />
            )}
          </div>
        </Sequence>

        {/* Duration badge */}
        <Sequence from={50}>
          <div
            style={{
              opacity: badgeOpacity,
              transform: `translateX(${badgeX}px) scale(${frame >= 80 ? accentPulse : 1})`,
              marginTop: 32,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                background: `linear-gradient(135deg, ${ACCENT}, #C06B52)`,
                borderRadius: 50,
                padding: "10px 28px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                boxShadow: `0 4px 20px ${ACCENT_GLOW}`,
              }}
            >
              {/* Clock icon (SVG) */}
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke={TEXT_PRIMARY}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: TEXT_PRIMARY,
                  letterSpacing: "0.5px",
                }}
              >
                {lessonDuration}
              </span>
            </div>
          </div>
        </Sequence>
      </AbsoluteFill>

      {/* ── Bottom corner badge ───────────────────────── */}
      <Sequence from={60}>
        <div
          style={{
            position: "absolute",
            bottom: 48,
            right: 60,
            opacity: interpolate(frame, [60, 75], [0, 0.5], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            display: "flex",
            alignItems: "center",
            gap: 8,
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
              color: TEXT_SECONDARY,
              letterSpacing: "2px",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            Claude Community
          </span>
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};
