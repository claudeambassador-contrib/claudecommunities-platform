import { TenantLink } from "@/components/TenantBaseProvider";
import type { AudienceSplitBlock as AudienceSplitBlockData } from "@/lib/cms/blocks";
import { resolveAudienceSplit } from "@/lib/cms/defaults";
import type { TenantConfig } from "@/lib/tenant-config";
import { iconFor } from "./icons";

/** Fixed two-entry accent palette applied by card index (matches today). */
const ACCENTS = [
  { bar: "from-[#60A5FA] to-[#A78BFA]", icon: "text-[#60A5FA]" },
  { bar: "from-[#D4836A] to-[#4ADE80]", icon: "text-[#D4836A]" },
] as const;

export default function AudienceSplitBlock({
  block,
  cfg,
}: {
  block: AudienceSplitBlockData;
  cfg: TenantConfig;
}) {
  const a = resolveAudienceSplit(block, cfg);

  return (
    <section className="py-24 px-6">
      <div className="max-w-[1200px] mx-auto">
        <h2 className="text-3xl md:text-4xl font-semibold text-center mb-4">{a.heading}</h2>
        <p className="text-center text-[#A8A29E] text-lg max-w-[600px] mx-auto mb-12">
          {a.subheading}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {a.cards.map((card, i) => {
            const accent = ACCENTS[i % ACCENTS.length];
            const Icon = iconFor(card.icon);
            return (
              <TenantLink
                key={card.href}
                href={card.href}
                className="block bg-[#2D2926] p-10 rounded-3xl border border-white/[0.06] hover:-translate-y-2 hover:shadow-lg transition-all duration-300 relative overflow-hidden group"
              >
                <div
                  className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${accent.bar}`}
                />
                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-6">
                  <Icon className={`w-8 h-8 ${accent.icon}`} />
                </div>
                <h3 className="text-2xl font-semibold mb-4">{card.title}</h3>
                <p className="text-[#A8A29E] mb-6">{card.desc}</p>
                <span className="text-[#D4836A] font-semibold inline-flex items-center gap-2 group-hover:gap-3 transition-all">
                  {card.ctaLabel || "Learn More →"}
                </span>
              </TenantLink>
            );
          })}
        </div>
      </div>
    </section>
  );
}
