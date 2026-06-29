/**
 * ServiceError — thrown by service-layer modules so adapters (API routes,
 * MCP tools) can translate to their transport's error shape.
 *
 * Each error carries an HTTP-style `status` and a stable `code` so MCP and
 * route handlers can both react consistently.
 */
export type ServiceErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "bad_request"
  | "conflict"
  | "rate_limited"
  | "unavailable"
  | "internal";

const CODE_TO_STATUS: Record<ServiceErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  bad_request: 400,
  conflict: 409,
  rate_limited: 429,
  unavailable: 503,
  internal: 500,
};

export class ServiceError extends Error {
  code: ServiceErrorCode;
  status: number;
  /** Optional structured detail (e.g. zod issues). */
  details?: unknown;

  constructor(code: ServiceErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    this.status = CODE_TO_STATUS[code];
    this.details = details;
  }
}

export function isServiceError(err: unknown): err is ServiceError {
  return err instanceof ServiceError;
}
