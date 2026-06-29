import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requirePermissionResponse } from "@/lib/route-auth";

export async function GET() {
  const auth = await requirePermissionResponse("email.view");
  if (!auth.ok) return auth.response;

  const prisma = await getPrisma();
  try {
    const blocks = await prisma.emailSavedBlock.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, blockType: true, blockData: true, category: true },
    });
    return NextResponse.json(blocks);
  } catch (error) {
    console.error("Failed to fetch saved blocks:", error);
    return NextResponse.json({ error: "Failed to fetch saved blocks" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requirePermissionResponse("email.edit");
  if (!auth.ok) return auth.response;

  const prisma = await getPrisma();
  try {
    const { name, blockType, blockData, category } = await req.json();
    if (!name?.trim() || !blockType || !blockData) {
      return NextResponse.json(
        { error: "Name, blockType, and blockData are required" },
        { status: 400 },
      );
    }

    const block = await prisma.emailSavedBlock.create({
      data: {
        name: name.trim(),
        blockType,
        blockData: typeof blockData === "string" ? blockData : JSON.stringify(blockData),
        category: category || "general",
      },
    });
    return NextResponse.json(block);
  } catch (error) {
    console.error("Failed to save block:", error);
    return NextResponse.json({ error: "Failed to save block" }, { status: 500 });
  }
}
