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
export type FileFlowFolder = {
  name: string;
  files: string[];
};

export type FileFlowDemoProps = {
  beforeFiles: string[];
  afterFolders: FileFlowFolder[];
};

/* ── Colour tokens ────────────────────────────────────── */
const BG = "#1C1917";
const CARD_BG = "#2D2926";
const ACCENT = "#D4836A";
const ACCENT_GLOW = "rgba(212, 131, 106, 0.3)";
const TEXT_PRIMARY = "#FFFFFF";
const TEXT_SECONDARY = "#A8A29E";
const TEXT_DIM = "#6B7280";
const FONT = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

/* ── File type colours ────────────────────────────────── */
function getFileColor(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "pdf":
      return "#EF4444";
    case "xlsx":
    case "xls":
    case "csv":
      return "#22C55E";
    case "jpg":
    case "jpeg":
    case "png":
    case "gif":
    case "svg":
    case "webp":
      return "#3B82F6";
    case "doc":
    case "docx":
    case "txt":
    case "md":
      return ACCENT;
    case "mp4":
    case "mov":
    case "avi":
      return "#A855F7";
    case "zip":
    case "rar":
    case "7z":
      return "#F59E0B";
    default:
      return TEXT_DIM;
  }
}

function getFileIcon(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "pdf":
      return "PDF";
    case "xlsx":
    case "xls":
      return "XLS";
    case "csv":
      return "CSV";
    case "jpg":
    case "jpeg":
      return "JPG";
    case "png":
      return "PNG";
    case "gif":
      return "GIF";
    case "svg":
      return "SVG";
    case "doc":
    case "docx":
      return "DOC";
    case "txt":
      return "TXT";
    case "mp4":
      return "MP4";
    case "zip":
      return "ZIP";
    default:
      return ext.toUpperCase().slice(0, 3);
  }
}

/* ── Deterministic pseudo-random ──────────────────────── */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

/* ── File icon component ──────────────────────────────── */
const FileIcon: React.FC<{
  filename: string;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  opacity: number;
  glowing?: boolean;
}> = ({ filename, x, y, rotation, scale, opacity, glowing }) => {
  const color = getFileColor(filename);
  const label = getFileIcon(filename);

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `rotate(${rotation}deg) scale(${scale})`,
        opacity,
        transition: "none",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: 64,
          height: 78,
          borderRadius: 8,
          background: `linear-gradient(145deg, ${CARD_BG}, #232020)`,
          border: `1.5px solid ${glowing ? color : "rgba(255,255,255,0.08)"}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          boxShadow: glowing
            ? `0 0 20px ${color}55, 0 4px 16px rgba(0,0,0,0.5)`
            : "0 2px 8px rgba(0,0,0,0.3)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Corner fold */}
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 14,
            height: 14,
            background: `linear-gradient(135deg, transparent 50%, ${color}44 50%)`,
            borderBottomLeftRadius: 4,
          }}
        />
        {/* Extension badge */}
        <div
          style={{
            background: color,
            borderRadius: 4,
            padding: "2px 8px",
            fontSize: 10,
            fontWeight: 800,
            color: "#fff",
            letterSpacing: "0.5px",
            fontFamily: FONT,
          }}
        >
          {label}
        </div>
        {/* Filename */}
        <div
          style={{
            fontSize: 8,
            color: TEXT_SECONDARY,
            fontFamily: FONT,
            maxWidth: 56,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            textAlign: "center",
          }}
        >
          {filename}
        </div>
      </div>
    </div>
  );
};

/* ── Folder component ─────────────────────────────────── */
const Folder: React.FC<{
  name: string;
  fileCount: number;
  x: number;
  y: number;
  opacity: number;
  scale: number;
  color: string;
}> = ({ name, fileCount, x, y, opacity, scale, color }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      opacity,
      transform: `scale(${scale})`,
    }}
  >
    {/* Folder tab */}
    <div
      style={{
        width: 50,
        height: 12,
        background: color,
        borderTopLeftRadius: 6,
        borderTopRightRadius: 6,
        marginLeft: 4,
        opacity: 0.8,
      }}
    />
    {/* Folder body */}
    <div
      style={{
        width: 130,
        minHeight: 60,
        background: `linear-gradient(145deg, ${CARD_BG}, #252220)`,
        border: `1.5px solid ${color}55`,
        borderRadius: 8,
        borderTopLeftRadius: 2,
        padding: "10px 12px",
        boxShadow: `0 4px 16px rgba(0,0,0,0.3), 0 0 12px ${color}22`,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: TEXT_PRIMARY,
          fontFamily: FONT,
          marginBottom: 4,
        }}
      >
        {name}
      </div>
      <div
        style={{
          fontSize: 10,
          color,
          fontFamily: FONT,
          fontWeight: 500,
        }}
      >
        {fileCount} file{fileCount !== 1 ? "s" : ""}
      </div>
    </div>
  </div>
);

/* ── Sparkle ──────────────────────────────────────────── */
const Sparkle: React.FC<{
  x: number;
  y: number;
  size: number;
  opacity: number;
  rotation: number;
}> = ({ x, y, size, opacity, rotation }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: size,
      height: size,
      opacity,
      transform: `rotate(${rotation}deg)`,
      pointerEvents: "none",
    }}
  >
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5Z" fill={ACCENT} />
    </svg>
  </div>
);

/* ── Main composition ─────────────────────────────────── */
export const FileFlowDemo: React.FC<FileFlowDemoProps> = ({ beforeFiles, afterFolders }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const totalFiles = beforeFiles.length;
  const totalFolders = afterFolders.length;

  /* ── Phase timing (150 frames) ──────────────────────── */
  /* 0-30:   Files appear scattered on left */
  /* 30-50:  Files glow and lift */
  /* 50-90:  Files fly to right side into folders */
  /* 90-120: Folders receive files, snap animation */
  /* 120-150: Counter animates, final polish */

  /* Generate scattered positions for files (left side) */
  const scatteredPositions = beforeFiles.map((_, i) => {
    const seed = i + 1;
    const cols = 4;
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      x: 60 + col * 85 + (seededRandom(seed * 3) - 0.5) * 40,
      y: 100 + row * 100 + (seededRandom(seed * 7) - 0.5) * 30,
      rotation: (seededRandom(seed * 11) - 0.5) * 25,
    };
  });

  /* Map each file to its target folder and position within */
  const fileTargets = beforeFiles.map((file) => {
    for (let fi = 0; fi < afterFolders.length; fi++) {
      const folder = afterFolders[fi];
      if (folder.files.includes(file)) {
        const indexInFolder = folder.files.indexOf(file);
        return { folderIndex: fi, indexInFolder };
      }
    }
    return { folderIndex: 0, indexInFolder: 0 };
  });

  /* Folder positions (right side) */
  const folderPositions = afterFolders.map((_, i) => ({
    x: 620 + (i % 2) * 160,
    y: 80 + Math.floor(i / 2) * 140,
  }));

  /* Target positions for files in folders */
  const targetPositions = beforeFiles.map((_, i) => {
    const target = fileTargets[i];
    const folderPos = folderPositions[target.folderIndex];
    return {
      x: folderPos.x + 10 + target.indexInFolder * 8,
      y: folderPos.y + 35,
      rotation: 0,
    };
  });

  /* ── Animate each file ──────────────────────────────── */
  const fileElements = beforeFiles.map((file, i) => {
    const scattered = scatteredPositions[i];
    const target = targetPositions[i];

    /* Stagger the flight: each file starts flying at a slightly different time */
    const flyStart = 50 + i * 3;
    const flyEnd = flyStart + 25;

    /* Phase 1: Appear (0-30) */
    const appearDelay = i * 2;
    const appearOpacity = interpolate(frame, [appearDelay, appearDelay + 8], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const appearScale = spring({
      frame: Math.max(0, frame - appearDelay),
      fps,
      config: { damping: 12, stiffness: 150, mass: 0.4 },
    });

    /* Phase 2: Glow (30-50) */
    const isGlowing = frame >= 30 && frame < flyEnd;
    const glowPulse =
      frame >= 30 && frame < 50
        ? interpolate(frame, [30, 40, 50], [0, 1, 0.5], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        : 0;

    /* Phase 3: Fly (50+stagger - end) */
    const flyProgress = interpolate(frame, [flyStart, flyEnd], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    });

    /* Lift effect before flying */
    const liftY =
      frame >= 30 && frame < flyStart
        ? interpolate(frame, [30, flyStart], [0, -15], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        : 0;

    /* Arc the flight path upward */
    const arcHeight = -80 - seededRandom(i * 17) * 60;
    const arcY =
      flyProgress > 0 && flyProgress < 1 ? arcHeight * Math.sin(flyProgress * Math.PI) : 0;

    const currentX = interpolate(flyProgress, [0, 1], [scattered.x, target.x]);
    const currentY = interpolate(flyProgress, [0, 1], [scattered.y, target.y]) + arcY + liftY;
    const currentRotation = interpolate(flyProgress, [0, 1], [scattered.rotation, target.rotation]);

    /* Snap scale when landing */
    const landingSnap =
      frame >= flyEnd
        ? spring({
            frame: frame - flyEnd,
            fps,
            config: { damping: 8, stiffness: 200, mass: 0.3 },
          })
        : 1;
    const snapScale = frame >= flyEnd ? interpolate(landingSnap, [0, 0.5, 1], [1.15, 0.95, 1]) : 1;

    /* After landing, shrink into folder */
    const shrinkAfterLand =
      frame >= flyEnd + 8
        ? interpolate(frame, [flyEnd + 8, flyEnd + 15], [1, 0.4], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        : 1;
    const fadeAfterLand =
      frame >= flyEnd + 8
        ? interpolate(frame, [flyEnd + 8, flyEnd + 15], [1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        : 1;

    const finalScale = appearScale * snapScale * shrinkAfterLand;
    const finalOpacity = appearOpacity * fadeAfterLand;

    return (
      <FileIcon
        // biome-ignore lint/suspicious/noArrayIndexKey: positional animation list keyed to per-index scattered/target positions; never reordered, filenames may repeat
        key={i}
        filename={file}
        x={currentX}
        y={currentY}
        rotation={currentRotation}
        scale={finalScale}
        opacity={finalOpacity}
        glowing={isGlowing && glowPulse > 0.3}
      />
    );
  });

  /* ── Animate folders appearing ──────────────────────── */
  const folderElements = afterFolders.map((folder, i) => {
    const folderAppearStart = 45 + i * 6;
    const folderOpacity = interpolate(frame, [folderAppearStart, folderAppearStart + 12], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const folderScale = spring({
      frame: Math.max(0, frame - folderAppearStart),
      fps,
      config: { damping: 14, stiffness: 120, mass: 0.5 },
    });

    /* Determine the main color from the first file */
    const mainColor = folder.files.length > 0 ? getFileColor(folder.files[0]) : ACCENT;
    const pos = folderPositions[i];

    /* File count updates as files land */
    const landedCount = beforeFiles.filter((_file, fileIdx) => {
      const target = fileTargets[fileIdx];
      const flyEnd = 50 + fileIdx * 3 + 25;
      return target.folderIndex === i && frame >= flyEnd + 8;
    }).length;

    return (
      <Folder
        key={folder.name}
        name={folder.name}
        fileCount={landedCount}
        x={pos.x}
        y={pos.y}
        opacity={folderOpacity}
        scale={folderScale}
        color={mainColor}
      />
    );
  });

  /* ── Counter animation ──────────────────────────────── */
  const counterStart = 115;
  const counterOpacity = interpolate(frame, [counterStart, counterStart + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const counterSlide = spring({
    frame: Math.max(0, frame - counterStart),
    fps,
    config: { damping: 15, stiffness: 100, mass: 0.5 },
  });
  const counterY = interpolate(counterSlide, [0, 1], [20, 0]);

  /* ── Sparkles during flight phase ───────────────────── */
  const sparkles = Array.from({ length: 8 }, (_, i) => {
    const sparkStart = 55 + i * 8;
    const sparkDuration = 20;
    const sparkLocalFrame = frame - sparkStart;
    if (sparkLocalFrame < 0 || sparkLocalFrame > sparkDuration) return null;

    const sparkOpacity = interpolate(
      sparkLocalFrame,
      [0, 5, sparkDuration - 5, sparkDuration],
      [0, 0.8, 0.8, 0],
      { extrapolateRight: "clamp", extrapolateLeft: "clamp" },
    );
    const sparkRotation = sparkLocalFrame * 8;
    const sparkSize = 12 + seededRandom(i * 13) * 10;

    return (
      <Sparkle
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length generated decorative list, positions seeded by index, never reordered
        key={`sparkle-${i}`}
        x={400 + seededRandom(i * 19) * 200}
        y={100 + seededRandom(i * 23) * 300}
        size={sparkSize}
        opacity={sparkOpacity}
        rotation={sparkRotation}
      />
    );
  });

  /* ── Divider arrow ──────────────────────────────────── */
  const arrowOpacity = interpolate(frame, [40, 55], [0, 0.6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const arrowPulse = interpolate(frame % 60, [0, 30, 60], [0.5, 0.8, 0.5], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG,
        fontFamily: FONT,
        overflow: "hidden",
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 1200,
          height: 700,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(212,131,106,0.06) 0%, transparent 65%)`,
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
        }}
      />

      {/* Section labels */}
      <div
        style={{
          position: "absolute",
          top: 40,
          left: 180,
          opacity: interpolate(frame, [5, 15], [0, 0.7], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          fontSize: 16,
          color: TEXT_DIM,
          fontWeight: 600,
          letterSpacing: "2px",
          textTransform: "uppercase",
        }}
      >
        Before
      </div>
      <div
        style={{
          position: "absolute",
          top: 40,
          right: 220,
          opacity: interpolate(frame, [45, 55], [0, 0.7], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          fontSize: 16,
          color: TEXT_DIM,
          fontWeight: 600,
          letterSpacing: "2px",
          textTransform: "uppercase",
        }}
      >
        After
      </div>

      {/* Center arrow */}
      <div
        style={{
          position: "absolute",
          top: "45%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          opacity: arrowOpacity * arrowPulse,
        }}
      >
        <svg width="60" height="40" viewBox="0 0 60 40" fill="none" aria-hidden="true">
          <path
            d="M5 20H45M45 20L35 10M45 20L35 30"
            stroke={ACCENT}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Files */}
      {fileElements}

      {/* Folders */}
      {folderElements}

      {/* Sparkles */}
      {sparkles}

      {/* Counter bar */}
      <div
        style={{
          position: "absolute",
          bottom: 50,
          left: "50%",
          transform: `translateX(-50%) translateY(${counterY}px)`,
          opacity: counterOpacity,
          background: CARD_BG,
          borderRadius: 12,
          padding: "12px 28px",
          border: `1px solid rgba(212,131,106,0.2)`,
          boxShadow: `0 4px 20px rgba(0,0,0,0.3), 0 0 20px ${ACCENT_GLOW}`,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 18, color: ACCENT, fontWeight: 700 }}>✓</span>
        <span
          style={{
            fontSize: 16,
            color: TEXT_PRIMARY,
            fontWeight: 600,
          }}
        >
          {totalFiles} files organized into {totalFolders} folders
        </span>
      </div>

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
