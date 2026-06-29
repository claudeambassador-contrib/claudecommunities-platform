import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { enrollInCourse } from "@/lib/services/courses";

export const POST = withService(async (request: Request) => {
  const user = await requireSessionUser();
  const { courseId } = await request.json();
  return NextResponse.json(await enrollInCourse(user, courseId));
});
