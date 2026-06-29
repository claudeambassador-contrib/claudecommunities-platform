import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { completeOnboarding, getOnboardingStatus } from "@/lib/services/users";

// POST - Mark onboarding as complete
export const POST = withService(async (request: Request) => {
  const user = await requireSessionUser();
  const { completed } = await request.json();

  if (completed) {
    await completeOnboarding(user);
  }
  return NextResponse.json({ success: true });
});

// GET - Check onboarding status
export const GET = withService(async () => {
  const user = await requireSessionUser();
  return NextResponse.json(await getOnboardingStatus(user));
});
