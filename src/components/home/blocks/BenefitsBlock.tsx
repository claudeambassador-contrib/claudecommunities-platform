import type { BenefitsBlock as BenefitsBlockData } from "@/lib/cms/blocks";
import { resolveBenefits } from "@/lib/cms/defaults";
import type { TenantConfig } from "@/lib/tenant-config";
import { iconFor } from "./icons";

export default function BenefitsBlock({
  block,
  cfg,
}: {
  block: BenefitsBlockData;
  cfg: TenantConfig;
}) {
  const b = resolveBenefits(block, cfg);

  return (
    <section className="px-6 bg-gradient-to-b from-[#1C1917] to-[#292524] pt-16 pb-24">
      <div className="max-w-[1200px] mx-auto">
        <h2 className="text-3xl md:text-4xl font-semibold text-center mb-16">{b.heading}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {b.cards.map((card) => {
            const Icon = iconFor(card.icon);
            return (
              <div
                key={card.title}
                className="bg-[#2D2926] p-8 rounded-2xl border border-white/[0.06] hover:-translate-y-1 hover:border-[#D4836A]/30 hover:shadow-[0_12px_40px_rgba(212,131,106,0.1)] transition-all duration-300"
              >
                <div className="w-12 h-12 bg-[#D4836A]/15 rounded-xl flex items-center justify-center mb-5">
                  <Icon className="w-6 h-6 text-[#D4836A]" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{card.title}</h3>
                <p className="text-[#A8A29E] text-[0.9375rem]">{card.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
