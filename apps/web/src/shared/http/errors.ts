export type ServiceError = {
  code: string;
  status: number;
  message?: string;
};

export type Ok<T> = { ok: true } & T;
export type Err = { ok: false; error: ServiceError };
export type Result<T> = Ok<T> | Err;

export function ok<T extends object>(value: T): Ok<T> {
  return { ok: true, ...value };
}

export function err(code: string, status: number, message?: string): Err {
  return { ok: false, error: { code, status, message } };
}

export function isErr<T>(r: Result<T>): r is Err {
  return !r.ok;
}
