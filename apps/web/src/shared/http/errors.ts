export interface ServiceError {
  code: string;
  message?: string;
  status: number;
}

export type Ok<T> = { ok: true } & T;
export interface Err {
  error: ServiceError;
  ok: false;
}
export type Result<T> = Ok<T> | Err;

/** Use for `Result<Empty>` when a success carries no payload. */
export type Empty = Record<never, never>;

export function ok<T extends object>(value: T): Ok<T> {
  return { ok: true, ...value };
}

export function err(code: string, status: number, message?: string): Err {
  return { error: { code, message, status }, ok: false };
}

export function isErr<T>(r: Result<T>): r is Err {
  return !r.ok;
}
