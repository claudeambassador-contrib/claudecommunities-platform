import { ArrowRight, Calendar, User } from "lucide-react";
import Image from "next/image";
import { Fragment } from "react";
import { TenantLink } from "@/components/TenantBaseProvider";
import type { HeroBlock as HeroBlockData } from "@/lib/cms/blocks";
import { resolveHero } from "@/lib/cms/defaults";
import type { TenantConfig } from "@/lib/tenant-config";

export default function HeroBlock({
  block,
  cfg,
  isSignedIn,
  firstName,
  userImage,
}: {
  block: HeroBlockData;
  cfg: TenantConfig;
  isSignedIn: boolean;
  firstName: string;
  userImage?: string;
}) {
  const h = resolveHero(block, cfg);
  const headingLines = h.heading.split("\n");

  return (
    <section
      className={`bg-[#D4836A] flex items-center px-6 ${isSignedIn ? "min-h-screen pt-24 pb-28" : "min-h-screen pt-24 pb-16"} relative`}
    >
      <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div className="text-[#1C1917] lg:order-1 order-2">
          <div className="inline-block bg-[#1C1917]/15 text-[#1C1917] px-4 py-2 rounded-full text-sm font-semibold mb-6 border border-[#1C1917]/20">
            {h.badge}
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] font-semibold leading-[1.1] mb-6">
            {headingLines.map((line, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: heading lines have no stable id; order is the identity.
              <Fragment key={`${i}-${line}`}>
                {i > 0 && <br />}
                {line}
              </Fragment>
            ))}
          </h1>
          <p className="text-xl text-[#1C1917]/80 max-w-[480px] mb-8 leading-relaxed">{h.body}</p>
          <div className="flex flex-wrap gap-4">
            <TenantLink
              href="#events"
              className="inline-flex items-center justify-center px-7 py-4 rounded-xl bg-[#1C1917] text-[#FAF9F6] font-semibold hover:bg-[#292524] hover:-translate-y-0.5 transition-all duration-300 shadow-lg"
            >
              {h.primaryCtaLabel}
            </TenantLink>
            {isSignedIn ? (
              <TenantLink
                href="/community"
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-transparent text-[#1C1917] font-semibold border-2 border-[#1C1917] hover:bg-[#1C1917]/10 transition-all duration-300"
              >
                Go to Community
                <ArrowRight className="w-5 h-5" />
              </TenantLink>
            ) : (
              <TenantLink
                href="/login"
                className="inline-flex items-center justify-center px-7 py-4 rounded-xl bg-transparent text-[#1C1917] font-semibold border-2 border-[#1C1917] hover:bg-[#1C1917]/10 transition-all duration-300"
              >
                Join Community
              </TenantLink>
            )}
          </div>
        </div>
        <div className="flex justify-center lg:order-2 order-1">
          <Image
            src={cfg.mapImage}
            alt={`${cfg.communityName} Map`}
            width={994}
            height={644}
            className="rounded-3xl max-w-full h-auto"
            priority
            sizes="(max-width: 768px) 100vw, 500px"
            fetchPriority="high"
          />
        </div>
      </div>
      {/* Welcome Back Banner - floats at bottom of hero */}
      {isSignedIn && (
        <div className="absolute bottom-8 left-0 right-0 z-10 px-6">
          <div className="max-w-[1000px] mx-auto bg-[#1C1917]/95 backdrop-blur-xl border border-white/[0.1] rounded-2xl p-5 md:p-6 flex flex-col md:flex-row items-center gap-5 md:gap-6 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
            <div className="flex items-center gap-4 flex-shrink-0">
              {userImage ? (
                <Image
                  src={userImage}
                  alt={firstName}
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-full object-cover border-2 border-[#D4836A]/40"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-[#D4836A] flex items-center justify-center text-white text-lg font-semibold">
                  {firstName[0]?.toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-[#FAF9F6] font-semibold">Welcome back, {firstName}</p>
                <p className="text-[#A8A29E] text-sm">Jump back into the community</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 md:ml-auto">
              <TenantLink
                href="/community"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#D4836A] text-[#1C1917] font-semibold hover:bg-[#E09880] hover:-translate-y-0.5 transition-all duration-300"
              >
                Go to Community
                <ArrowRight className="w-4 h-4" />
              </TenantLink>
              <TenantLink
                href="#events"
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/[0.06] text-[#FAF9F6] text-sm font-medium hover:bg-white/[0.12] transition-all"
              >
                <Calendar className="w-4 h-4 text-[#A8A29E]" />
                Events
              </TenantLink>
              <TenantLink
                href="/community/profile"
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/[0.06] text-[#FAF9F6] text-sm font-medium hover:bg-white/[0.12] transition-all"
              >
                <User className="w-4 h-4 text-[#A8A29E]" />
                Profile
              </TenantLink>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
