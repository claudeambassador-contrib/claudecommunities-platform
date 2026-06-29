import { NextResponse } from "next/server";
import { getPlatformPrisma, getPrisma } from "@/lib/prisma";
import { sendEmail, wrapEmailContent } from "@/lib/resend";
import { getTenantConfig } from "@/lib/tenant-config";
import { runWithTenant } from "@/lib/tenant-context";

export async function POST(req: Request) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Cross-tenant read (platform plane): which enrollments are due, and whose.
    // Each is then processed under its OWN tenant scope so the per-step reads,
    // writes, and email config all belong to the enrollment's tenant — not one
    // host's (the prior single-host bug this closes).
    const platform = await getPlatformPrisma();
    const due = await platform.automationEnrollment.findMany({
      where: { status: "active", nextActionAt: { lte: new Date() } },
      select: { id: true, tenantId: true },
      take: 100, // Process up to 100 per invocation
    });

    if (due.length === 0) {
      return NextResponse.json({ message: "No pending automations", processed: 0 });
    }

    // Group due enrollment ids by tenant; drain each tenant in its own scope.
    const idsByTenant = new Map<string, string[]>();
    for (const { id, tenantId } of due) {
      const list = idsByTenant.get(tenantId);
      if (list) list.push(id);
      else idsByTenant.set(tenantId, [id]);
    }

    let processed = 0;
    let errors = 0;

    for (const [tenantId, ids] of idsByTenant) {
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: cognitive complexity is per-function; the per-tenant automation-processing branches would carry the same score if extracted, so reducing it requires a real decomposition out of scope for a lint pass
      await runWithTenant(tenantId, async () => {
        const db = await getPrisma(); // scoped to tenantId
        const { appUrl } = await getTenantConfig(); // this tenant's email base URL

        const enrollments = await db.automationEnrollment.findMany({
          where: { id: { in: ids } },
          include: {
            automation: {
              include: { steps: { orderBy: { stepOrder: "asc" } } },
            },
            user: { select: { id: true, name: true, email: true } },
          },
        });

        for (const enrollment of enrollments) {
          try {
            const { automation, user } = enrollment;
            const steps = automation.steps;
            const currentStep = steps.find((s) => s.stepOrder === enrollment.currentStep);

            if (!currentStep) {
              // No more steps — mark as completed
              await db.automationEnrollment.update({
                where: { id: enrollment.id },
                data: { status: "completed", completedAt: new Date() },
              });
              processed++;
              continue;
            }

            const config = JSON.parse(currentStep.config);

            switch (currentStep.stepType) {
              case "email": {
                if (!user.email) break;

                let html = config.html || "<p>Hello {{name}},</p>";
                html = html.replace(/\{\{name\}\}/g, user.name || "there");
                html = html.replace(/\{\{email\}\}/g, user.email);

                const wrappedHtml = wrapEmailContent(html, { appUrl });
                await sendEmail({
                  to: user.email,
                  subject: config.subject || "Message from Claude Community",
                  html: wrappedHtml,
                });

                // Advance to next step
                const nextStep = steps.find((s) => s.stepOrder === enrollment.currentStep + 1);
                if (nextStep) {
                  await db.automationEnrollment.update({
                    where: { id: enrollment.id },
                    data: { currentStep: enrollment.currentStep + 1, nextActionAt: new Date() },
                  });
                } else {
                  await db.automationEnrollment.update({
                    where: { id: enrollment.id },
                    data: { status: "completed", completedAt: new Date() },
                  });
                }
                break;
              }

              case "delay": {
                const delayMinutes = config.delayMinutes || config.duration || 1440; // default 24h
                const nextActionAt = new Date(Date.now() + delayMinutes * 60 * 1000);

                // Advance step and set next action time
                const nextStep = steps.find((s) => s.stepOrder === enrollment.currentStep + 1);
                if (nextStep) {
                  await db.automationEnrollment.update({
                    where: { id: enrollment.id },
                    data: { currentStep: enrollment.currentStep + 1, nextActionAt },
                  });
                } else {
                  await db.automationEnrollment.update({
                    where: { id: enrollment.id },
                    data: { status: "completed", completedAt: new Date() },
                  });
                }
                break;
              }

              case "condition": {
                // Simple condition evaluation
                let conditionMet = false;

                if (config.field === "has_tag" && config.value) {
                  const tagAssignment = await db.userTagAssignment.findFirst({
                    where: { userId: user.id, tagId: config.value },
                  });
                  conditionMet = !!tagAssignment;
                } else if (config.field === "in_list" && config.value) {
                  const membership = await db.contactListMember.findFirst({
                    where: { userId: user.id, listId: config.value },
                  });
                  conditionMet = !!membership;
                }

                // Advance based on condition — for now, just advance to next step
                const nextStep = steps.find((s) => s.stepOrder === enrollment.currentStep + 1);
                if (nextStep) {
                  await db.automationEnrollment.update({
                    where: { id: enrollment.id },
                    data: {
                      currentStep: enrollment.currentStep + 1,
                      nextActionAt: new Date(),
                    },
                  });
                } else {
                  await db.automationEnrollment.update({
                    where: { id: enrollment.id },
                    data: {
                      status: conditionMet ? "completed" : "exited",
                      completedAt: new Date(),
                    },
                  });
                }
                break;
              }
            }

            processed++;
          } catch (err) {
            console.error(`Error processing enrollment ${enrollment.id}:`, err);
            errors++;
          }
        }
      });
    }

    return NextResponse.json({ processed, errors, total: due.length });
  } catch (error) {
    console.error("Automation processing error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
