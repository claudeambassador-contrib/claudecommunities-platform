import { ArrowLeft, Download, FileText } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { TenantLink } from "@/components/TenantBaseProvider";
import { getCurrentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";

export const dynamic = "force-dynamic";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function EventResourcesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const db = await getPrisma();
  const { slug } = await params;

  const event = await db.event.findFirst({
    where: { AND: [{ isActive: true }, { OR: [{ slug }, { id: slug }] }] },
    select: { id: true, slug: true, title: true },
  });

  if (!event) {
    notFound();
  }

  const user = await getCurrentUser();
  if (!user) {
    const eventPath = `/events/${event.slug || event.id}/resources`;
    redirect(
      tenantHref(await getTenantBase(), `/login?redirect_url=${encodeURIComponent(eventPath)}`),
    );
  }

  const resources = await db.eventResource.findMany({
    where: { eventId: event.id },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      description: true,
      fileUrl: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
    },
  });

  return (
    <div className="min-h-screen bg-[#1C1917]">
      <div className="pt-[92px] px-6">
        <div className="max-w-3xl mx-auto">
          <TenantLink
            href={`/events/${event.slug || event.id}`}
            className="inline-flex items-center gap-2 text-sm text-[#A8A29E] hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Event
          </TenantLink>

          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Resources</h1>
          <p className="text-[#A8A29E] mb-8">{event.title}</p>

          {resources.length === 0 ? (
            <div className="text-center py-12 text-[#A8A29E]">
              No resources have been uploaded for this event yet.
            </div>
          ) : (
            <div className="space-y-3 pb-12">
              {resources.map((r) => (
                <a
                  key={r.id}
                  href={r.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-4 p-4 rounded-xl bg-[#2D2926] border border-white/[0.06] hover:border-[#D4836A]/40 hover:bg-[#3D3936] transition-colors"
                >
                  <div className="w-11 h-11 rounded-lg bg-[#D4836A]/15 flex items-center justify-center text-[#D4836A] flex-shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium">{r.title}</div>
                    {r.description && (
                      <div className="text-sm text-[#A8A29E] mt-1">{r.description}</div>
                    )}
                    <div className="text-xs text-[#78716C] mt-1 truncate">
                      {r.fileName} · {formatBytes(r.fileSize)}
                    </div>
                  </div>
                  <Download className="w-5 h-5 text-[#78716C] group-hover:text-white flex-shrink-0 mt-1" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
