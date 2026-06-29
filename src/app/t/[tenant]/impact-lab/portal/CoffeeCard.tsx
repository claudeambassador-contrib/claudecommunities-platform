"use client";

import { Check, Coffee, Loader2, RotateCw } from "lucide-react";
import { useRef, useState } from "react";

interface CoffeeCardProps {
  name: string;
  role: string;
  team: { name: string; color: string; tableNumber: string | null } | null;
  coffeeCode: string;
  note: string;
  redeemed: boolean;
  redeemedAt: string | null;
}

export default function CoffeeCard(props: CoffeeCardProps) {
  const [flipped, setFlipped] = useState(false);
  const [redeemed, setRedeemed] = useState(props.redeemed);
  const [redeemedAt, setRedeemedAt] = useState(props.redeemedAt);
  const [busy, setBusy] = useState(false);
  const [pointer, setPointer] = useState({ x: 50, y: 50, active: false });
  const ref = useRef<HTMLDivElement>(null);

  const accent = props.team?.color || "#D4836A";

  function onMove(e: React.PointerEvent) {
    // Touch drags should scroll the page / flip the card — only do the 3D
    // tilt for a mouse, so the card doesn't jitter under a finger on mobile.
    if (e.pointerType !== "mouse") return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPointer({
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
      active: true,
    });
  }
  function onLeave() {
    setPointer({ x: 50, y: 50, active: false });
  }

  const rx = ((50 - pointer.y) / 50) * 12;
  const ry = ((pointer.x - 50) / 50) * 12;

  async function redeem(e: React.MouseEvent) {
    e.stopPropagation();
    if (busy || redeemed) return;
    setBusy(true);
    try {
      const res = await fetch("/api/impact-lab/coffee", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setRedeemed(true);
        setRedeemedAt(data.coffeeRedeemedAt);
      }
    } finally {
      setBusy(false);
    }
  }

  const glare = {
    background: `radial-gradient(circle 140px at ${pointer.x}% ${pointer.y}%, rgba(255,255,255,0.6), transparent 70%)`,
    mixBlendMode: "soft-light" as const,
    opacity: pointer.active ? 1 : 0.35,
  };
  const foil = {
    background:
      "linear-gradient(115deg, transparent 16%, rgba(255,0,132,0.55) 30%, rgba(255,210,0,0.55) 42%, rgba(0,255,196,0.55) 56%, rgba(120,80,255,0.55) 70%, transparent 86%)",
    backgroundSize: "260% 260%",
    backgroundPosition: `${pointer.x}% ${pointer.y}%`,
    mixBlendMode: "color-dodge" as const,
    opacity: pointer.active ? 0.55 : 0.22,
  };

  return (
    <div className="flex flex-col items-center">
      {/* biome-ignore lint/a11y/useSemanticElements: cannot be a native <button> — this card wraps a nested redeem <button>, which is invalid HTML inside a button */}
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        aria-label="Flip coffee pass"
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        onClick={() => setFlipped((f) => !f)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setFlipped((f) => !f);
          }
        }}
        className="cursor-pointer select-none"
        style={{ perspective: "1100px", width: "100%", maxWidth: 360 }}
      >
        <div
          style={{
            transform: `rotateY(${flipped ? 180 : 0}deg)`,
            transformStyle: "preserve-3d",
            transition: "transform 0.6s cubic-bezier(0.2,0.75,0.2,1)",
          }}
        >
          <div
            style={{
              transform: `rotateX(${rx}deg) rotateY(${ry}deg)`,
              transformStyle: "preserve-3d",
              transition: pointer.active ? "transform 0.06s linear" : "transform 0.45s ease-out",
              position: "relative",
              width: "100%",
              aspectRatio: "1.45 / 1",
            }}
          >
            {/* ── Front ──────────────────────────────────────── */}
            <div
              className="absolute inset-0 overflow-hidden rounded-2xl border border-white/15 shadow-2xl"
              style={{
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                background: `linear-gradient(135deg, ${accent} 0%, #2A1D17 58%, #160F0C 100%)`,
              }}
            >
              <div className="absolute inset-0" style={foil} />
              <div className="absolute inset-0" style={glare} />
              <div className="relative flex h-full flex-col justify-between p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Coffee className="h-5 w-5 text-white" />
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/90">
                      Coffee Pass
                    </span>
                  </div>
                  <span className="rounded-full bg-black/30 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-white/80">
                    {props.role}
                  </span>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-widest text-white/60">Holder</p>
                  <p className="truncate text-xl font-semibold text-white">{props.name}</p>
                  <div className="mt-1 flex items-center gap-2 text-sm text-white/80">
                    <span
                      className="h-2.5 w-2.5 rounded-full ring-2 ring-white/30"
                      style={{ background: accent }}
                    />
                    {props.team ? props.team.name : "No team yet"}
                    {props.team?.tableNumber && (
                      <span className="text-white/50">· Table {props.team.tableNumber}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-white/60">
                  <span className="inline-flex items-center gap-1">
                    <RotateCw className="h-3 w-3" />
                    {redeemed ? "Tap to view your code" : "Tap to redeem your coffee"}
                  </span>
                  {redeemed && (
                    <span className="inline-flex items-center gap-1 text-emerald-300">
                      <Check className="h-3 w-3" /> Redeemed
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* ── Back ───────────────────────────────────────── */}
            <div
              className="absolute inset-0 overflow-hidden rounded-2xl border border-white/15 shadow-2xl"
              style={{
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
                background: "linear-gradient(135deg, #2A1D17 0%, #160F0C 100%)",
              }}
            >
              <div
                className="absolute inset-0"
                style={{ ...foil, opacity: pointer.active ? 0.4 : 0.15 }}
              />
              <div className="relative flex h-full flex-col justify-between p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                    {redeemed ? "Your coffee code" : "Free coffee"}
                  </span>
                  <Coffee className="h-4 w-4 text-white/70" />
                </div>

                <div className="text-center">
                  {redeemed ? (
                    <>
                      <p
                        className="font-mono text-3xl font-bold tracking-[0.15em] text-white"
                        style={{ textShadow: `0 0 18px ${accent}` }}
                      >
                        {props.coffeeCode}
                      </p>
                      <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-emerald-300">
                        <Check className="h-3.5 w-3.5" />
                        Redeemed{redeemedAt ? ` · ${formatTime(redeemedAt)}` : ""}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-mono text-3xl font-bold tracking-[0.35em] text-white/20">
                        ••••••
                      </p>
                      <p className="mt-2 text-xs text-white/55">Press redeem to reveal your code</p>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={redeem}
                  disabled={busy || redeemed}
                  className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed"
                  style={{
                    background: redeemed ? "rgba(255,255,255,0.1)" : accent,
                    color: redeemed ? "rgba(255,255,255,0.6)" : "#160F0C",
                  }}
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : redeemed ? (
                    "Redeemed"
                  ) : (
                    "Redeem coffee"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-4 max-w-xs text-center text-xs text-text-muted">{props.note}</p>
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}
