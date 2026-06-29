import { ArrowRight, PlayCircle } from "lucide-react";
import { TenantLink } from "@/components/TenantBaseProvider";
import { RemoteImage } from "@/components/ui/RemoteImage";

interface WebinarPromoBarProps {
  href: string;
  title: string;
  description: string;
  thumbnailUrl: string;
}

export default function WebinarPromoBar({
  href,
  title,
  description,
  thumbnailUrl,
}: WebinarPromoBarProps) {
  return (
    <section className="bg-[#1C1917] border-y border-white/[0.06] px-6 py-6">
      <div className="max-w-[1200px] mx-auto">
        <TenantLink
          href={href}
          className="group flex flex-col md:flex-row items-stretch md:items-center gap-5 md:gap-6 bg-[#2D2926] hover:bg-[#36302C] border border-white/[0.06] hover:border-[#D4836A]/40 rounded-2xl p-4 md:p-5 transition-all duration-300 hover:shadow-[0_12px_40px_rgba(212,131,106,0.12)]"
        >
          <div className="relative flex-shrink-0 w-full md:w-[180px] aspect-video rounded-xl overflow-hidden bg-black">
            <RemoteImage
              src={thumbnailUrl}
              alt={title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/20 transition-colors">
              <PlayCircle className="w-12 h-12 text-white drop-shadow-lg group-hover:scale-110 transition-transform" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-2 mb-2">
              <span className="inline-block w-2 h-2 rounded-full bg-[#D4836A]" />
              <span className="text-[#D4836A] text-xs font-semibold uppercase tracking-wider">
                New Webinar
              </span>
            </div>
            <h3 className="text-[#FAF9F6] text-lg md:text-xl font-semibold mb-1 truncate">
              {title}
            </h3>
            <p className="text-[#A8A29E] text-sm md:text-[0.9375rem] line-clamp-2">{description}</p>
          </div>

          <div className="flex-shrink-0 flex md:flex-col items-center md:items-end justify-between md:justify-center gap-2">
            <span className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#D4836A] text-[#1C1917] font-semibold whitespace-nowrap group-hover:bg-[#E09880] group-hover:-translate-y-0.5 transition-all duration-300">
              Watch Now
              <ArrowRight className="w-4 h-4" />
            </span>
          </div>
        </TenantLink>
      </div>
    </section>
  );
}
