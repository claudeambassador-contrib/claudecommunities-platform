"use client";

import { useEffect } from "react";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  side?: "left" | "right";
}

export default function Drawer({ open, onClose, children, side = "left" }: DrawerProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [open, onClose]);

  const translateClosed = side === "left" ? "-translate-x-full" : "translate-x-full";
  const panelPosition = side === "left" ? "left-0" : "right-0";

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop click-to-dismiss; keyboard users dismiss via the Escape handler above
    // biome-ignore lint/a11y/useKeyWithClickEvents: modal backdrop click-to-dismiss; keyboard users dismiss via the Escape handler above
    <div
      className={`fixed inset-0 z-50 transition-colors duration-300 ${
        open ? "bg-black/50 backdrop-blur-sm pointer-events-auto" : "pointer-events-none"
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`fixed top-0 ${panelPosition} bottom-0 w-[280px] bg-[#1C1917] overflow-y-auto transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : translateClosed
        }`}
      >
        {children}
      </div>
    </div>
  );
}
