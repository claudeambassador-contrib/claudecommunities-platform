import Image from "next/image";
import type { GalleryBlock as GalleryBlockData } from "@/lib/cms/blocks";
import { resolveGallery } from "@/lib/cms/defaults";
import type { TenantConfig } from "@/lib/tenant-config";

export default function GalleryBlock({
  block,
  cfg,
}: {
  block: GalleryBlockData;
  cfg: TenantConfig;
}) {
  // Images come from config; self-hide when the tenant has no meetup photos.
  if (cfg.galleryImages.length === 0) return null;
  const g = resolveGallery(block, cfg);

  return (
    <section className="bg-[#D4836A]">
      <div className="text-center py-12 px-6">
        <h2 className="text-3xl md:text-4xl font-semibold text-[#1C1917] mb-3">{g.heading}</h2>
        <p className="text-[#1C1917]/70 text-lg">{g.subheading}</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-1">
        {cfg.galleryImages.map((img) => (
          <div key={img.src} className="aspect-square overflow-hidden">
            <Image
              src={img.src}
              alt={img.alt}
              width={400}
              height={400}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
              loading="lazy"
              sizes="(max-width: 768px) 50vw, 20vw"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
