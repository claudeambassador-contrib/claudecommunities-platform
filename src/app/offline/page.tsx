"use client";

import { RefreshCw, WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[#1C1917] flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-[#D4836A]/20 flex items-center justify-center mx-auto mb-6">
          <WifiOff className="w-10 h-10 text-[#D4836A]" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-4">You're Offline</h1>

        <p className="text-[#A8A29E] mb-8">
          It looks like you've lost your internet connection. Some features may be unavailable until
          you're back online.
        </p>

        <div className="space-y-4">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#D4836A] text-white rounded-xl font-medium hover:bg-[#c4775f] transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>

          <p className="text-sm text-[#78716C]">
            Cached content may still be available. Try visiting a page you've viewed before.
          </p>
        </div>

        <div className="mt-12 p-6 bg-[#2D2926] rounded-xl border border-white/[0.06]">
          <h2 className="font-medium text-white mb-3">While you're offline:</h2>
          <ul className="text-left text-sm text-[#A8A29E] space-y-2">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D4836A] mt-2 shrink-0" />
              Previously viewed posts and courses may be available
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D4836A] mt-2 shrink-0" />
              Draft posts will be saved and synced when you're back online
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D4836A] mt-2 shrink-0" />
              Notifications will be delivered once you reconnect
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
