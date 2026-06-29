"use client";

import confetti from "canvas-confetti";
import { PartyPopper, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTenantConfig, useTenantId } from "@/components/TenantConfigProvider";

const STORAGE_KEY = "celebration-1000-members-seen";

const BRAND_COLORS = ["#D4836A", "#E7E5E4", "#F4A582", "#FFFFFF", "#A8A29E"];

function fireConfetti() {
  const duration = 4000;
  const end = Date.now() + duration;

  const burst = () => {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 70,
      origin: { x: 0, y: 0.7 },
      colors: BRAND_COLORS,
      zIndex: 70,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 70,
      origin: { x: 1, y: 0.7 },
      colors: BRAND_COLORS,
      zIndex: 70,
    });
    if (Date.now() < end) {
      requestAnimationFrame(burst);
    }
  };

  confetti({
    particleCount: 120,
    spread: 100,
    startVelocity: 45,
    origin: { x: 0.5, y: 0.6 },
    colors: BRAND_COLORS,
    zIndex: 70,
  });

  burst();
}

export default function MilestoneCelebration() {
  const { countryName } = useTenantConfig();
  const tenantId = useTenantId();
  const [open, setOpen] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: tenantId is inlined at build per region and never changes at runtime; the milestone timer is intentionally a mount-only effect and must not re-run.
  useEffect(() => {
    if (typeof window === "undefined") return;
    // The 1,000-members milestone is an AU-only achievement — don't show it
    // in regions that haven't hit it yet (e.g. NZ).
    if (tenantId !== "au") return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    const timer = setTimeout(() => {
      setOpen(true);
      fireConfetti();
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: handleClose only wraps stable setState/localStorage calls; the listener intentionally re-subscribes solely on `open`.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const handleClose = () => {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="relative w-full max-w-md bg-[#2D2926] rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden">
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close"
          className="absolute top-4 right-4 p-1.5 text-[#A8A29E] hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="px-8 pt-10 pb-8 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-[#D4836A] to-[#F4A582] flex items-center justify-center mb-5 shadow-lg shadow-[#D4836A]/20">
            <PartyPopper className="w-8 h-8 text-white" />
          </div>

          <p className="text-sm uppercase tracking-[0.2em] text-[#D4836A] font-semibold mb-3">
            Milestone unlocked
          </p>

          <h2 className="text-4xl font-bold text-white mb-3">1,000 members!</h2>

          <p className="text-[#A8A29E] leading-relaxed mb-6">
            {`We just hit a thousand Claude Code builders across ${countryName}. Thank you for being part of this community — for sharing wins, asking questions, and showing up at meetups. Here's to the next thousand.`}
          </p>

          <button
            type="button"
            onClick={handleClose}
            className="w-full px-6 py-3 bg-[#D4836A] hover:bg-[#C4735A] text-white rounded-lg font-medium transition-colors"
          >
            Let&apos;s keep building
          </button>
        </div>
      </div>
    </div>
  );
}
