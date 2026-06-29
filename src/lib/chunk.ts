// Split an array into fixed-size chunks. Primarily used to keep per-statement
// bound-parameter counts under D1's hard limit of 100 parameters per query
// (https://developers.cloudflare.com/d1/platform/limits/) — size the chunk for
// the number of params each row binds (e.g. ≤90 for a single-column `IN (...)`,
// smaller for multi-column `createMany`).
export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
