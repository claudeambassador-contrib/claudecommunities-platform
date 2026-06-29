import "dotenv/config";
import prisma from "../src/lib/prisma";

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  const events = await prisma.event.findMany({
    where: { slug: null },
    select: { id: true, title: true, startTime: true },
  });

  console.log(`Found ${events.length} events without slugs`);

  for (const event of events) {
    const month = event.startTime.toLocaleString("en-AU", { month: "long" }).toLowerCase();
    const year = event.startTime.getFullYear();
    const base = `${toSlug(event.title)}-${month}-${year}`;
    let slug = base;
    let counter = 1;

    // Ensure uniqueness
    while (await prisma.event.findUnique({ where: { slug } })) {
      slug = `${base}-${counter}`;
      counter++;
    }

    await prisma.event.update({
      where: { id: event.id },
      data: { slug },
    });
    console.log(`  ${event.title} → ${slug}`);
  }

  console.log("Done!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
