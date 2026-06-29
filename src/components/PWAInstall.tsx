"use client";

import { Download, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Show banner after a delay if not dismissed before
      const dismissed = localStorage.getItem("pwa-banner-dismissed");
      if (!dismissed) {
        setTimeout(() => setShowBanner(true), 3000);
      }
    };

    // Listen for successful install
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowBanner(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // Show iOS banner if on iOS and not dismissed
    if (iOS) {
      const dismissed = localStorage.getItem("pwa-banner-dismissed");
      if (!dismissed) {
        setTimeout(() => setShowBanner(true), 3000);
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }

    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setShowBanner(false);
    }

    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem("pwa-banner-dismissed", "true");
  };

  if (isInstalled || !showBanner) return null;

  return (
    <>
      {/* Install Banner */}
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-slide-up">
        <div className="bg-[#2D2926] rounded-2xl border border-white/[0.06] shadow-xl p-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#D4836A]/20 flex items-center justify-center shrink-0">
              <Smartphone className="w-6 h-6 text-[#D4836A]" />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white mb-1">Install Claude Code Community</h3>
              <p className="text-sm text-[#A8A29E] mb-3">
                Get quick access with our app. Works offline too!
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleInstall}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#D4836A] text-white rounded-lg text-sm font-medium hover:bg-[#c4775f] transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Install
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="px-4 py-2 text-[#A8A29E] hover:text-white text-sm transition-colors"
                >
                  Not now
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDismiss}
              className="p-1 text-[#78716C] hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* iOS Instructions Modal */}
      {showIOSInstructions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-[#2D2926] rounded-2xl border border-white/[0.06] p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-white mb-4">Install on iOS</h3>

            <div className="space-y-4 mb-6">
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-[#D4836A] text-white text-sm font-medium flex items-center justify-center shrink-0">
                  1
                </span>
                <p className="text-[#E7E5E4]">
                  Tap the <strong>Share</strong> button in Safari
                </p>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-[#D4836A] text-white text-sm font-medium flex items-center justify-center shrink-0">
                  2
                </span>
                <p className="text-[#E7E5E4]">
                  Scroll down and tap <strong>"Add to Home Screen"</strong>
                </p>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-[#D4836A] text-white text-sm font-medium flex items-center justify-center shrink-0">
                  3
                </span>
                <p className="text-[#E7E5E4]">
                  Tap <strong>"Add"</strong> to install
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowIOSInstructions(false);
                handleDismiss();
              }}
              className="w-full py-3 bg-white/[0.1] text-white rounded-xl font-medium hover:bg-white/[0.15] transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
