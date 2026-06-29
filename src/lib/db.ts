// D1-only raw SQL helpers. Callers write SQLite-flavored SQL with `?` placeholders;
// D1 executes it directly with no translation.

import { chunk } from "@/lib/chunk";

async function getD1(): Promise<D1Database> {
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const { env } = await getCloudflareContext();
  return (env as Record<string, unknown>).DB as D1Database;
}

async function executeD1SQL(sql: string, params: unknown[]): Promise<unknown[]> {
  const db = await getD1();
  const stmt = db.prepare(sql);
  const result = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();
  return result.results ?? [];
}

export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  try {
    return (await executeD1SQL(sql, params)) as T[];
  } catch (error) {
    console.error("SQL Error:", error);
    console.error("SQL:", sql);
    console.error("Params:", params);
    throw error;
  }
}

export async function queryOne<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  const results = await query<T>(sql, params);
  return results[0];
}

// Run an `IN (...)` query in chunks so we never exceed D1's hard limit of 100
// bound parameters per query (https://developers.cloudflare.com/d1/platform/limits/).
// `buildSql` receives the `?,?,…` placeholder string for the current chunk and
// the chunk's ids are bound in order. Results from all chunks are concatenated.
export async function queryIn<T>(
  ids: unknown[],
  buildSql: (placeholders: string) => string,
): Promise<T[]> {
  const out: T[] = [];
  for (const batch of chunk(ids, 90)) {
    // 90 leaves headroom under D1's 100-param cap
    const placeholders = batch.map(() => "?").join(",");
    out.push(...(await query<T>(buildSql(placeholders), batch)));
  }
  return out;
}

// Run several statements as ONE D1 transaction (`env.DB.batch`). All succeed or
// all roll back. Statements execute in array order within a single transaction,
// so a leading `PRAGMA defer_foreign_keys=ON` defers FK enforcement to COMMIT
// for the whole batch (the only reliable way to bulk-delete across FK-linked
// tables without a hand-maintained topo order).
export async function runBatch(statements: { sql: string; params?: unknown[] }[]): Promise<void> {
  const db = await getD1();
  const prepared = statements.map((s) => {
    const stmt = db.prepare(s.sql);
    return s.params && s.params.length > 0 ? stmt.bind(...s.params) : stmt;
  });
  try {
    await db.batch(prepared);
  } catch (error) {
    console.error("SQL Batch Error:", error);
    throw error;
  }
}

export async function run(sql: string, params: unknown[] = []) {
  try {
    await executeD1SQL(sql, params);
    return { changes: 1 };
  } catch (error) {
    console.error("SQL Error:", error);
    console.error("SQL:", sql);
    console.error("Params:", params);
    throw error;
  }
}

// Legacy sync exports - these now throw errors as async is required
export function getDb(): never {
  throw new Error("getDb() is deprecated. Use async query/queryOne/run functions instead.");
}
