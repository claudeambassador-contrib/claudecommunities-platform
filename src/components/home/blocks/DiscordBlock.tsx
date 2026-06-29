import DiscordPromoCard from "@/components/DiscordPromoCard";
import type { TenantConfig } from "@/lib/tenant-config";

export default function DiscordBlock({ cfg }: { cfg: TenantConfig }) {
  return (
    <section className="bg-[#1C1917] px-6 py-16">
      <div className="max-w-[1000px] mx-auto">
        <DiscordPromoCard
          href={cfg.discordCommunityInvite}
          logoSrc="/images/webinar-2026-04/discord-logo.png"
        />
      </div>
    </section>
  );
}
