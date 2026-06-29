export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import RichTextBlock from "@/components/home/blocks/RichTextBlock";
import type { RichTextBlock as RichTextBlockData } from "@/lib/cms/blocks";
import { getPageByPath } from "@/lib/cms/page";
import { getTenantConfig, ogLocale, siteUrl } from "@/lib/tenant-config";

/**
 * Public render for tenant-authored content pages (the Pages CMS). Lives under
 * the reserved `/p/` prefix so it never collides with the first-class routes
 * (events, courses, …) and so the middleware can allowlist `/p/(.*)` as public
 * without enumerating arbitrary tenant paths. `force-dynamic` reads the
 * tenant-scoped row at request time so admin edits show immediately (mirrors the
 * sitemap/cities precedent). Reuses the home CMS `RichTextBlock` renderer.
 */
type Params = { params: Promise<{ slug: string[] }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const path = slug.join("/");
  const page = await getPageByPath(path);
  if (!page) return { title: "Page Not Found" };

  const { communityName } = await getTenantConfig();
  const url = `${await siteUrl()}/p/${path}`;
  const title = page.title ?? communityName;
  return {
    title,
    alternates: { canonical: url },
    openGraph: {
      title,
      url,
      type: "website",
      siteName: communityName,
      locale: await ogLocale(),
    },
  };
}

export default async function ContentPage({ params }: Params) {
  const { slug } = await params;
  const page = await getPageByPath(slug.join("/"));
  if (!page) notFound();

  const blocks = page.blocks.filter(
    (b): b is RichTextBlockData => b.type === "richText" && b.enabled !== false,
  );

  return (
    <div className="min-h-screen bg-[#1C1917] pt-[92px]">
      {page.title && (
        <header className="px-6 pt-8">
          <div className="max-w-[800px] mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold text-white">{page.title}</h1>
          </div>
        </header>
      )}
      {blocks.map((block) => (
        <RichTextBlock key={block.id} block={block} />
      ))}
    </div>
  );
}
