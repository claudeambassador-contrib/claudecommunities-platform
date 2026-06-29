// Minimal Cloudflare Workers type declarations for dual-deployment support.
// These are only used when DEPLOY_TARGET=cloudflare at runtime.

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void
  passThroughOnException(): void
}

interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>
  exec(query: string): Promise<D1ExecResult>
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = unknown>(colName?: string): Promise<T | null>
  run<T = unknown>(): Promise<D1Result<T>>
  all<T = unknown>(): Promise<D1Result<T>>
  raw<T = unknown>(): Promise<T[]>
}

interface D1Result<T = unknown> {
  results?: T[]
  success: boolean
  error?: string
  meta?: Record<string, unknown>
}

interface D1ExecResult {
  count: number
  duration: number
}

interface R2Bucket {
  head(key: string): Promise<R2Object | null>
  get(key: string): Promise<R2ObjectBody | null>
  put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob, options?: R2PutOptions): Promise<R2Object>
  delete(keys: string | string[]): Promise<void>
  list(options?: R2ListOptions): Promise<R2Objects>
}

interface R2Object {
  key: string
  version: string
  size: number
  etag: string
  httpEtag: string
  httpMetadata?: R2HTTPMetadata
  customMetadata?: Record<string, string>
}

interface R2ObjectBody extends R2Object {
  body: ReadableStream
  bodyUsed: boolean
  arrayBuffer(): Promise<ArrayBuffer>
  text(): Promise<string>
  json<T = unknown>(): Promise<T>
  blob(): Promise<Blob>
}

interface R2PutOptions {
  httpMetadata?: R2HTTPMetadata
  customMetadata?: Record<string, string>
}

interface R2HTTPMetadata {
  contentType?: string
  contentLanguage?: string
  contentDisposition?: string
  contentEncoding?: string
  cacheControl?: string
  cacheExpiry?: Date
}

interface R2ListOptions {
  limit?: number
  prefix?: string
  cursor?: string
  delimiter?: string
  include?: ('httpMetadata' | 'customMetadata')[]
}

interface R2Objects {
  objects: R2Object[]
  truncated: boolean
  cursor?: string
  delimitedPrefixes: string[]
}

// ─── Cloudflare Workflows (minimal subset used by SlideExportWorkflow) ──
// The full set lives in @cloudflare/workers-types which this project doesn't
// pull in globally (the rest of the bindings are hand-rolled above to keep
// tsc fast and noise-free). Keep these in sync with the upstream types if
// the Workflows API evolves.

interface WorkflowInstanceCreateOptions<PARAMS = unknown> {
  id?: string
  params?: PARAMS
}

interface WorkflowInstanceStatus {
  status:
    | "queued"
    | "running"
    | "paused"
    | "errored"
    | "terminated"
    | "complete"
    | "waiting"
    | "waitingForPause"
    | "unknown"
  error?: { name: string; message: string }
  output?: unknown
}

interface WorkflowInstance {
  id: string
  status(): Promise<WorkflowInstanceStatus>
  pause(): Promise<void>
  resume(): Promise<void>
  restart(): Promise<void>
  terminate(): Promise<void>
}

interface Workflow<PARAMS = unknown> {
  get(id: string): Promise<WorkflowInstance>
  create(options?: WorkflowInstanceCreateOptions<PARAMS>): Promise<WorkflowInstance>
}

// `cloudflare:workers` is a virtual module the runtime provides; declaring it
// here lets TypeScript resolve `import { WorkflowEntrypoint } from "cloudflare:workers"`
// without pulling in the rest of @cloudflare/workers-types as globals.
declare module "cloudflare:workers" {
  export type WorkflowEvent<T> = {
    payload: T
    timestamp: Date
    instanceId: string
  }

  export type WorkflowBackoff = "constant" | "linear" | "exponential"

  export type WorkflowStepConfig = {
    retries?: {
      limit: number
      delay: number | string
      backoff?: WorkflowBackoff
    }
    timeout?: number | string
  }

  export class WorkflowStep {
    do<T>(name: string, callback: () => Promise<T>): Promise<T>
    do<T>(
      name: string,
      config: WorkflowStepConfig,
      callback: () => Promise<T>,
    ): Promise<T>
    sleep(name: string, duration: number | string): Promise<void>
    sleepUntil(name: string, timestamp: Date | number): Promise<void>
    waitForEvent<T = unknown>(
      name: string,
      options: { type: string; timeout?: number | string },
    ): Promise<T>
  }

  export abstract class WorkflowEntrypoint<Env = unknown, Params = unknown> {
    protected env: Env
    protected ctx: ExecutionContext
    abstract run(event: WorkflowEvent<Params>, step: WorkflowStep): Promise<unknown>
  }
}
