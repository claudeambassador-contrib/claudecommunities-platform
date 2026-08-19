import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";

interface Payload {
  d1Binding: string;
  jobId: string;
  orgId: string;
}

export class SlideExportWorkflow extends WorkflowEntrypoint<Env, Payload> {
  async run(event: WorkflowEvent<Payload>, step: WorkflowStep) {
    const { jobId } = event.payload;

    await step.do("mark-running", async () => ({ jobId, status: "running" }));
    await step.do("render", async () => ({
      // Browser Rendering + R2 zip lands in a later slice.
      resultKey: `exports/${jobId}.zip`,
    }));
    await step.do("finalize", async () => ({ status: "completed" as const }));
  }
}
