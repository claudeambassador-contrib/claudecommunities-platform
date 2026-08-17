export interface SlideGeneratorState {
  data: unknown;
  scope: string;
  updatedAt: string | null;
}

export interface SlideStatePutResult {
  scope: string;
  updatedAt: string;
}

export interface SlideStateWriteDeps {
  invalidateForScope?: (scope: string) => Promise<void>;
}

export interface SlideStylePresetCreateBody {
  data: unknown;
  name: string;
}

export interface SlideStylePresetUpdateBody {
  data?: unknown;
  name?: string;
}

export interface SlideStylePresetCreated {
  id: string;
  name: string;
}

export interface SlideStylePresetDetail extends SlideStylePresetCreated {
  createdAt: string;
  data: unknown;
  updatedAt: string;
}

export interface StartExportInput {
  disambiguateFilenames?: boolean;
  eventId: string;
  filenameBase: string;
  force?: boolean;
  refWidth?: number;
  slideIds: string[];
  speakerIds: string[];
}

export interface SlideExportWorkflowParams {
  disambiguateFilenames: boolean;
  eventId: string;
  filenameBase: string;
  force: boolean;
  jobId: string;
  orgId: string;
  refWidth: number;
  slideIds: string[];
  speakerIds: string[];
  totalPairs: number;
  userId: string;
}

export interface SlideWorkflowInstanceStatus {
  errorMessage?: string;
  status: string;
}

export interface SlideExportWorkflowPort {
  create: (params: SlideExportWorkflowParams) => Promise<void>;
  getInstanceStatus?: (jobId: string) => Promise<SlideWorkflowInstanceStatus | null>;
}

export interface SlideRenderOutput {
  key?: string;
  pngBytes?: Uint8Array;
}

export interface SlideRenderer {
  render: (html: string) => Promise<SlideRenderOutput>;
}

export interface SlideStorage {
  publicUrl: (key: string) => string;
  putBytes: (
    key: string,
    bytes: Uint8Array,
    contentType: string,
  ) => Promise<{ key: string; url: string }>;
}

export interface CachedRenderLookup {
  eventId: string;
  refWidth: number;
  slideId: string;
  speakerId: string;
}

export interface CachedRender {
  contentHash: string;
  url: string;
}

export interface SlideRenderCache {
  getFresh: (lookup: CachedRenderLookup) => Promise<CachedRender | null>;
}

export interface SlideExportStartDeps {
  workflow: SlideExportWorkflowPort;
}

export interface SlideExportStatusDeps {
  now?: Date;
  storage?: Pick<SlideStorage, "publicUrl">;
  workflow?: SlideExportWorkflowPort;
}

export interface SlideExportCacheDeps {
  cache: SlideRenderCache;
  resolveSpeakerName?: (speakerId: string) => Promise<string | null>;
}

export type SlideExportJobStatusValue = "queued" | "running" | "completed" | "failed";

export interface SlideExportJobListItem {
  id: string;
  status: SlideExportJobStatusValue;
}

export interface SlideExportJobDetail {
  completedCount: number;
  errorMessage: string | null;
  eventId: string | null;
  id: string;
  outputKind: "png" | "zip" | null;
  params: SlideExportWorkflowParams | null;
  resultKey: string | null;
  status: SlideExportJobStatusValue;
  totalCount: number;
  updatedAt: string;
  userId: string | null;
}

export interface SlideExportJobStatus {
  completedCount: number;
  downloadFilename?: string;
  errorMessage?: string;
  jobId: string;
  outputKind?: "png" | "zip";
  outputUrl?: string;
  status: SlideExportJobStatusValue;
  totalCount: number;
}

export interface ShortCircuitResult {
  contentHash: string;
  filename: string;
  kind: "png";
  url: string;
}
