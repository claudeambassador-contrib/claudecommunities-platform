import { NextResponse } from "next/server";
import { requirePermissionResponse } from "@/lib/route-auth";
import { evaluateCandidates } from "@/lib/services/attendance-evaluator";

export async function POST(req: Request) {
  const auth = await requirePermissionResponse("tools.use");
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const { prompt, candidates } = body;

  if (!prompt || !candidates || !Array.isArray(candidates) || candidates.length === 0) {
    return NextResponse.json(
      { error: "prompt and candidates array are required" },
      { status: 400 },
    );
  }

  try {
    const evaluations = await evaluateCandidates(prompt, candidates);
    return NextResponse.json({ evaluations });
  } catch (error) {
    console.error("Evaluation failed:", error);
    return NextResponse.json({ error: "Evaluation failed" }, { status: 500 });
  }
}
