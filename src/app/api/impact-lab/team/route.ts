import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { ServiceError } from "@/lib/services/_errors";
import { withService } from "@/lib/services/_route";
import {
  getParticipantFromSession,
  renameOwnTeam,
  submitOwnConcept,
} from "@/lib/services/impactLab";

// Participant-facing team actions: once people can see who they're grouped
// with, any teammate can rename the team and submit the team's concept.

const Input = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("rename"),
    name: z.string().trim().min(1).max(80),
  }),
  z.object({
    action: z.literal("concept"),
    title: z.string().trim().min(1).max(120),
    // Optional — teams late in the day often just want to lock in a
    // solution name for the People's Choice vote without writing a
    // long description.
    summary: z.string().trim().max(2000).optional().default(""),
    // Optional GitHub / repo / demo link. Stripped to null when empty
    // so the UI can fall back to "no link yet".
    repoUrl: z
      .string()
      .trim()
      .max(400)
      .url("Enter a full link starting with https://")
      .optional()
      .or(z.literal("")),
  }),
]);

export const POST = withService(async (request) => {
  const limited = rateLimit(request, { limit: 30, windowMs: 60_000, key: "impactlab:team" });
  if (limited) return limited;

  const participant = await getParticipantFromSession();
  if (!participant) throw new ServiceError("unauthenticated", "Not signed in");

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = Input.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please fill in every field." }, { status: 400 });
  }

  if (parsed.data.action === "rename") {
    const result = await renameOwnTeam(participant, parsed.data.name);
    return NextResponse.json({ ok: true, ...result });
  }

  const result = await submitOwnConcept(participant, parsed.data.title, parsed.data.summary, {
    repoUrl: parsed.data.repoUrl,
  });
  return NextResponse.json({ ok: true, ...result });
});
