import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { TenantLink } from "@/components/TenantBaseProvider";
import type { CtaBlock as CtaBlockData } from "@/lib/cms/blocks";
import { resolveCta } from "@/lib/cms/defaults";
import type { TenantConfig } from "@/lib/tenant-config";

export default function CtaBlock({
  block,
  cfg,
  isSignedIn,
}: {
  block: CtaBlockData;
  cfg: TenantConfig;
  isSignedIn: boolean;
}) {
  const c = resolveCta(block, cfg);

  return (
    <section className="bg-[#D4836A] py-20 px-6">
      <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-12 items-center">
        <div className="text-center lg:text-left">
          {isSignedIn ? (
            <>
              <h2 className="text-3xl md:text-4xl font-semibold text-[#1C1917] mb-4">
                Jump Back In
              </h2>
              <p className="text-[#1C1917]/80 text-lg mb-8 max-w-[500px] mx-auto lg:mx-0">
                Your community is waiting. Check out what&apos;s new, join conversations, and
                connect with fellow builders.
              </p>
              <TenantLink
                href="/community"
                className="inline-flex items-center justify-center gap-2 px-9 py-5 rounded-xl bg-[#1C1917] text-[#FAF9F6] font-semibold text-lg hover:bg-[#292524] hover:-translate-y-0.5 transition-all duration-300 shadow-lg"
              >
                Go to Community
                <ArrowRight className="w-5 h-5" />
              </TenantLink>
            </>
          ) : (
            <>
              <h2 className="text-3xl md:text-4xl font-semibold text-[#1C1917] mb-4">
                {c.headingSignedOut}
              </h2>
              <p className="text-[#1C1917]/80 text-lg mb-8 max-w-[500px] mx-auto lg:mx-0">
                {c.bodySignedOut}
              </p>
              <TenantLink
                href="/login"
                className="inline-flex items-center justify-center px-9 py-5 rounded-xl bg-[#1C1917] text-[#FAF9F6] font-semibold text-lg hover:bg-[#292524] hover:-translate-y-0.5 transition-all duration-300 shadow-lg"
              >
                {c.ctaLabelSignedOut}
              </TenantLink>
            </>
          )}
        </div>
        <div className="flex justify-center lg:order-last order-first">
          <Image
            src="/images/claude-haiku.png"
            alt="Claude"
            width={300}
            height={300}
            className="rounded-2xl max-w-[200px] lg:max-w-[300px]"
          />
        </div>
      </div>
    </section>
  );
}
