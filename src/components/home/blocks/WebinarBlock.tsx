import WebinarPromoBar from "@/components/WebinarPromoBar";
import type { WebinarBlock as WebinarBlockData } from "@/lib/cms/blocks";

export default function WebinarBlock({ block }: { block: WebinarBlockData }) {
  return (
    <WebinarPromoBar
      href={block.href}
      title={block.title}
      description={block.description}
      thumbnailUrl={block.thumbnailUrl}
    />
  );
}
