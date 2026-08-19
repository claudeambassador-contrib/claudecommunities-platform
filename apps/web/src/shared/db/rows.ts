/** Row-shaping helpers shared by every repository. */
export function first<T>(rows: T[]): T | undefined {
  return rows[0];
}

export function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}
