/**
 * The tenant-isolation chokepoint — a Prisma `$extends` query extension that
 * binds a `PrismaClient` to one `tenantId` and injects/filters it on every
 * operation, INCLUDING nested relation writes. This is the single most
 * correctness-critical module in the app (`docs/multi-tenancy-isolation-spec.md`
 * §2) and is locked by the CI isolation suite (`test/iso/`).
 *
 * Empirically validated (Prisma 7 + driver adapter):
 *   • Injecting `tenantId` into a `findUnique`/`update`/`delete` `where` filters
 *     at runtime — a by-id op against a foreign row returns null / throws P2025
 *     and never touches the row. No findUnique→findFirst rewrite needed.
 *   • Injecting `tenantId` into a nested `connect.where` makes a connect to a
 *     foreign-tenant row throw (no match). WITHOUT this, a nested `connect`
 *     sets an FK with no NOT-NULL net and links across tenants
 *     (IDOR-via-connect + cross-tenant read via `include`). So nested writes
 *     are scoped recursively, not just the top-level op.
 *   • Array `$transaction([...])` operations carry the extension.
 *
 * Fail closed: an unclassified model throws; an unhandled operation throws; if
 * the DMMF relation map can't be built, the module throws at load (we can't
 * safely scope nested writes without it).
 */
import { Prisma } from "@prisma/client";
import { classifyModel, isTenantScoped } from "./tenant-models";
import {
  RELATIONS,
  // Re-exported below so `@/lib/tenant-scope` stays the public import site
  // (test/iso/scalar-fk.test.ts imports SCALAR_FK_TO_REL from here).
  SCALAR_FK_TO_REL,
} from "./tenant-scope-maps.generated";

export { SCALAR_FK_TO_REL };

type Obj = Record<string, unknown>;

const asObj = (v: unknown): Obj => (v as Obj | undefined) ?? {};
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * The minimal shape of the base (un-extended) client `tenantScope` needs to
 * read-validate scalar FKs. `base.<model>.findFirst` runs WITHOUT the extension
 * (so no recursion), letting the handler check a scalar FK target is in-tenant.
 */
type Delegate = {
  findFirst: (args: unknown) => Promise<{ id: string } | null>;
};
type BaseDelegates = Record<string, Delegate>;

/**
 * Two static maps drive the nested-write scoping below. Both are PRECOMPUTED
 * from the Prisma DMMF at build time and committed as
 * `tenant-scope-maps.generated.ts` (imported above) — they are NOT built at
 * module load. Rationale: the Prisma DMMF accessor is a getter that THROWS in
 * the Cloudflare edge runtime ("not available when running in edge runtimes"), so
 * building these at runtime would 500 every request under workerd / `next dev`.
 * The maps depend only on the static schema (never on data), so precomputing
 * them is sound; `scripts/gen-tenant-scope-maps.ts` (the prebuild) regenerates
 * them and `test/iso/tenant-scope-maps.test.ts` fails if the committed file
 * drifts from the live DMMF. The original derivation logic lives in
 * `scripts/lib/derive-tenant-scope-maps.ts`.
 *
 * • `RELATIONS`: model → (relationField → targetModel). Lets `scopeNestedWrites`
 *   know which nested keys are tenant-scoped relations.
 * • `SCALAR_FK_TO_REL`: model → (scalarFKField → relationField) for every scalar
 *   FK targeting a TENANT-SCOPED model (FKs to GLOBAL targets like
 *   `authorId`/`userId` → User are excluded — they stay raw scalars). Drives
 *   `validateScalarFks`, the read-check that a raw scalar FK in write `data`
 *   (`post.create({ data: { spaceId: <other tenant> } })`) points in-tenant —
 *   the scalar analog of the nested-`connect` IDOR. Asserted complete +
 *   id-resolvable in CI (`test/iso/scalar-fk.test.ts`).
 */

/** Inject tenantId into a WhereUniqueInput (or array of them) used by connect/set/delete. */
function scopeWhereUnique(where: unknown, tenantId: string): unknown {
  if (Array.isArray(where)) return where.map((w) => ({ ...asObj(w), tenantId }));
  return { ...asObj(where), tenantId };
}

/** Scope one relation-write object: { connect, connectOrCreate, create, update, … }. */
function scopeRelationOp(target: string, relVal: Obj, tenantId: string): Obj {
  const out: Obj = { ...relVal };

  // Reference existing rows by unique selector → inject tenantId so a foreign
  // row can't be connected/attached/detached/deleted.
  if ("connect" in out) out.connect = scopeWhereUnique(out.connect, tenantId);
  if ("set" in out) out.set = scopeWhereUnique(out.set, tenantId);
  if (isObj(out.disconnect)) out.disconnect = scopeWhereUnique(out.disconnect, tenantId);
  if (Array.isArray(out.disconnect)) out.disconnect = scopeWhereUnique(out.disconnect, tenantId);
  if (isObj(out.delete) || Array.isArray(out.delete))
    out.delete = scopeWhereUnique(out.delete, tenantId);

  if ("connectOrCreate" in out) {
    const fix = (c: unknown) => {
      const o = asObj(c);
      return {
        ...o,
        where: scopeWhereUnique(o.where, tenantId),
        create: scopeCreateData(target, o.create, tenantId),
      };
    };
    out.connectOrCreate = Array.isArray(out.connectOrCreate)
      ? out.connectOrCreate.map(fix)
      : fix(out.connectOrCreate);
  }
  if ("create" in out) out.create = scopeCreateData(target, out.create, tenantId);
  if (isObj(out.createMany)) {
    const cm = out.createMany;
    const rows = Array.isArray(cm.data) ? cm.data : [cm.data];
    out.createMany = { ...cm, data: rows.map((r) => ({ ...asObj(r), tenantId })) };
  }
  if ("update" in out) {
    const fix = (u: unknown) => {
      const o = asObj(u);
      if ("where" in o || "data" in o) {
        return {
          ...o,
          ...(o.where ? { where: scopeWhereUnique(o.where, tenantId) } : {}),
          data: scopeNestedWrites(target, o.data, tenantId),
        };
      }
      return scopeNestedWrites(target, o, tenantId); // to-one bare data
    };
    out.update = Array.isArray(out.update) ? out.update.map(fix) : fix(out.update);
  }
  if ("upsert" in out) {
    const fix = (u: unknown) => {
      const o = asObj(u);
      return {
        ...o,
        where: scopeWhereUnique(o.where, tenantId),
        create: scopeCreateData(target, o.create, tenantId),
        update: scopeNestedWrites(target, o.update, tenantId),
      };
    };
    out.upsert = Array.isArray(out.upsert) ? out.upsert.map(fix) : fix(out.upsert);
  }
  if ("updateMany" in out) {
    const fix = (u: unknown) => {
      const o = asObj(u);
      return {
        ...o,
        where: { ...asObj(o.where), tenantId },
        data: scopeNestedWrites(target, o.data, tenantId),
      };
    };
    out.updateMany = Array.isArray(out.updateMany) ? out.updateMany.map(fix) : fix(out.updateMany);
  }
  if ("deleteMany" in out) {
    const fix = (u: unknown) => ({ ...asObj(u), where: { ...asObj(asObj(u).where), tenantId } });
    out.deleteMany = Array.isArray(out.deleteMany) ? out.deleteMany.map(fix) : fix(out.deleteMany);
  }
  return out;
}

/** Walk a write `data` object and scope each tenant-scoped nested relation. */
function scopeNestedWrites(model: string, data: unknown, tenantId: string): unknown {
  if (Array.isArray(data)) return data.map((d) => scopeNestedWrites(model, d, tenantId));
  if (!isObj(data)) return data;
  const rels = RELATIONS[model] ?? {};
  const out: Obj = {};
  for (const [k, v] of Object.entries(data)) {
    const target = rels[k];
    out[k] =
      target && isTenantScoped(target) && isObj(v) ? scopeRelationOp(target, v, tenantId) : v;
  }
  return out;
}

/**
 * Validate that every raw scalar FK in a top-level write `data` that points at a
 * tenant-scoped relation references a row INSIDE the current tenant — the scalar
 * analog of the nested-`connect` scoping. Rewriting the scalar to a `connect`
 * isn't viable (Prisma's checked/unchecked input split would force rewriting
 * EVERY FK incl. global `authorId`, plus null/disconnect handling), so we instead
 * read-validate against the base (un-extended) client: a foreign-tenant id finds
 * no row and the write is refused. `tenantId` is immutable (= slug), so there is
 * no TOCTOU on it. Null/undefined FKs (clearing) and FKs supplied as a relation
 * (`space:{connect}` — scoped on the write path) are skipped.
 *
 * Perf: adds ONE indexed `findFirst` per tenant-scoped scalar FK per write
 * (create/update/upsert). Redundant where the caller already proved the FK
 * in-tenant (e.g. `comments.ts` validates `postId` before create) — acceptable:
 * it's the load-bearing isolation guard for callers that DON'T, and a
 * by-(id, tenantId) lookup on a covered index is cheap next to the write itself.
 */
async function validateScalarFks(
  model: string,
  data: unknown,
  tenantId: string,
  base: BaseDelegates,
): Promise<void> {
  const fks = SCALAR_FK_TO_REL[model];
  if (!fks || !isObj(data)) return;
  const rels = RELATIONS[model] ?? {};
  const checks: Promise<void>[] = [];
  for (const [fk, rel] of Object.entries(fks)) {
    const val = data[fk];
    if (typeof val !== "string") continue; // null/undefined → not setting a cross-tenant FK
    if (rel in data) continue; // supplied as a relation write → scoped on the write path
    const target = rels[rel];
    if (!target) continue;
    const delegate = base[`${target[0].toLowerCase()}${target.slice(1)}`];
    checks.push(
      delegate.findFirst({ where: { id: val, tenantId }, select: { id: true } }).then((row) => {
        if (!row) {
          throw new Error(
            `[tenant-scope] ${model}.${fk}="${val}" references a row outside tenant "${tenantId}" ` +
              "(cross-tenant scalar FK rejected).",
          );
        }
      }),
    );
  }
  await Promise.all(checks);
}

/**
 * createMany cannot carry a per-row `connect`, so a scalar FK to a tenant-scoped
 * relation can't be validated as in-tenant — fail closed rather than plant a
 * cross-tenant FK silently. (No sanctioned scoped createMany writes such a FK
 * today; this guards future ones.)
 */
function assertNoTenantScopedScalarFk(model: string, rows: unknown[]): void {
  const fks = SCALAR_FK_TO_REL[model];
  if (!fks) return;
  const keys = Object.keys(fks);
  for (const r of rows) {
    const o = asObj(r);
    for (const fk of keys) {
      if (typeof o[fk] === "string") {
        throw new Error(
          `[tenant-scope] createMany on "${model}" writes scalar FK "${fk}" to a tenant-scoped ` +
            "relation, which cannot be validated per-row (createMany has no connect). Use create() " +
            "(scoped connect) or validate the FK target is in-tenant first. (fail-closed)",
        );
      }
    }
  }
}

/** Create data: stamp tenantId at the top AND scope nested relation writes. */
function scopeCreateData(model: string, data: unknown, tenantId: string): unknown {
  if (Array.isArray(data)) return data.map((d) => scopeCreateData(model, d, tenantId));
  return { ...asObj(scopeNestedWrites(model, data, tenantId)), tenantId };
}

/** Fail-closed model gate (see tenant-models.ts). */
function mustScope(model: string): boolean {
  const c = classifyModel(model);
  if (c === "unknown") {
    throw new Error(
      `[tenant-scope] Unclassified model "${model}". Add it to TENANT_SCOPED_MODELS ` +
        "or GLOBAL_MODELS in src/lib/tenant-models.ts (fail-closed).",
    );
  }
  return c === "tenant";
}

interface QueryCtx {
  model: string;
  operation: string;
  args: Obj | undefined;
  query: (args: Obj | undefined) => Promise<unknown>;
}

/**
 * Build the tenant-scope extension bound to `tenantId`. Apply with
 * `baseClient.$extends(tenantScope(tenantId, baseClient))` — `base` is the SAME
 * un-extended client, used to read-validate scalar FKs without recursion. A FRESH
 * extension must be bound per (request, tenant) — never share a scoped client
 * across tenants (§2.1 #3).
 */
export function tenantScope(tenantId: string, base: BaseDelegates) {
  const handler = async ({ model, operation, args, query }: QueryCtx): Promise<unknown> => {
    if (!mustScope(model)) return query(args);
    const a = asObj(args);
    const scopedWhere = () => ({ ...asObj(a.where), tenantId });

    switch (operation) {
      // Reads + by-unique deletes: filter/guard by tenantId in `where`.
      case "findUnique":
      case "findUniqueOrThrow":
      case "findFirst":
      case "findFirstOrThrow":
      case "findMany":
      case "count":
      case "aggregate":
      case "groupBy":
      case "delete":
      case "deleteMany":
        return query({ ...a, where: scopedWhere() });

      // Updates: scope the target AND recursively scope nested relation writes
      // (nested connect/connectOrCreate would otherwise cross tenants), and
      // read-validate any raw scalar FK in `data` is in-tenant.
      case "update":
      case "updateMany":
      case "updateManyAndReturn":
        await validateScalarFks(model, a.data, tenantId, base);
        return query({
          ...a,
          where: scopedWhere(),
          data: scopeNestedWrites(model, a.data, tenantId),
        });

      // create: validate scalar FKs, stamp tenantId + recursively scope nested writes.
      case "create":
        await validateScalarFks(model, a.data, tenantId, base);
        return query({ ...a, data: scopeCreateData(model, a.data, tenantId) });

      case "createMany":
      case "createManyAndReturn": {
        const rows = Array.isArray(a.data) ? a.data : [a.data];
        assertNoTenantScopedScalarFk(model, rows);
        return query({ ...a, data: rows.map((r) => ({ ...asObj(r), tenantId })) });
      }

      case "upsert":
        await validateScalarFks(model, a.create, tenantId, base);
        await validateScalarFks(model, a.update, tenantId, base);
        return query({
          ...a,
          where: scopedWhere(),
          create: scopeCreateData(model, a.create, tenantId),
          update: scopeNestedWrites(model, a.update, tenantId),
        });

      default:
        throw new Error(
          `[tenant-scope] Unhandled operation "${operation}" on tenant model "${model}" — ` +
            "refusing to run unscoped (fail-closed). Add it to src/lib/tenant-scope.ts.",
        );
    }
  };

  return Prisma.defineExtension({
    name: "tenant-scope",
    query: { $allModels: { $allOperations: (params) => handler(params as unknown as QueryCtx) } },
  });
}

/** Operations the chokepoint explicitly handles — asserted complete in CI. */
export const HANDLED_OPERATIONS = [
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
  "create",
  "createMany",
  "createManyAndReturn",
  "upsert",
] as const;
