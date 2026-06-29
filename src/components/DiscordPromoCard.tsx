"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useTenantConfig } from "@/components/TenantConfigProvider";
import { RemoteImage } from "@/components/ui/RemoteImage";

interface DiscordPromoCardProps {
  href: string;
  logoSrc: string;
}

const DISCORD_BLURPLE = "#5865F2";

export default function DiscordPromoCard({ href, logoSrc }: DiscordPromoCardProps) {
  const { countryName } = useTenantConfig();
  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      className="group relative block overflow-hidden rounded-3xl border border-white/[0.08] bg-[#1E1F2E]"
      style={{
        background: "linear-gradient(135deg, #1E1F2E 0%, #232547 50%, #2B2D5C 100%)",
      }}
    >
      {/* Animated glow blobs */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full blur-3xl"
        style={{ background: DISCORD_BLURPLE, opacity: 0.35 }}
        animate={{
          x: [0, 40, 0],
          y: [0, 30, 0],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full blur-3xl"
        style={{ background: "#8B92F8", opacity: 0.25 }}
        animate={{
          x: [0, -30, 0],
          y: [0, -20, 0],
        }}
        transition={{
          duration: 14,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 md:gap-8 p-6 md:p-8">
        {/* Floating logo */}
        <motion.div
          className="relative flex-shrink-0"
          animate={{ y: [0, -8, 0] }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <div
            className="absolute inset-0 rounded-full blur-2xl"
            style={{ background: DISCORD_BLURPLE, opacity: 0.5 }}
          />
          <RemoteImage
            src={logoSrc}
            alt="Discord"
            className="relative w-20 h-20 md:w-24 md:h-24 object-contain drop-shadow-[0_8px_24px_rgba(88,101,242,0.6)]"
          />
        </motion.div>

        {/* Copy */}
        <div className="flex-1 text-center md:text-left">
          <div className="inline-flex items-center gap-2 mb-2">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ background: DISCORD_BLURPLE }}
            />
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: "#A8AEFF" }}
            >
              We&apos;re on Discord
            </span>
          </div>
          <h3 className="text-xl md:text-2xl font-semibold text-white mb-2">
            Join the conversation between webinars
          </h3>
          <p className="text-white/70 text-[0.9375rem] leading-relaxed">
            {`Hang out with other Claude Code builders across ${countryName}, share what you're working on, and get help when you're stuck.`}
          </p>
        </div>

        {/* CTA */}
        <motion.div
          className="flex-shrink-0 inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-white font-semibold whitespace-nowrap shadow-[0_8px_28px_rgba(88,101,242,0.4)]"
          style={{ background: DISCORD_BLURPLE }}
          whileHover={{
            scale: 1.04,
            boxShadow: "0 12px 36px rgba(88,101,242,0.55)",
          }}
          transition={{ type: "spring", stiffness: 350, damping: 22 }}
        >
          Join the Discord
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </motion.div>
      </div>
    </motion.a>
  );
}
