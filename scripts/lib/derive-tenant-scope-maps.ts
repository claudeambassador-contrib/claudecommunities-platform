/**
 * Pure derivation of the two tenant-scope maps from the Prisma DMMF model list.
 *
 * This is the SINGLE source of the map logic — it replicates exactly what the
 * (now-deleted) module-top-level IIFEs in `src/lib/tenant-scope.ts` computed.
 * It is consumed by:
 *   • `scripts/gen-tenant-scope-maps.mjs` (codegen, runs in Node where
 *     `Prisma.dmmf` is available) → writes `src/lib/tenant-scope-maps.generated.ts`.
 *   • `test/iso/tenant-scope-maps.test.ts` (drift guard) → recomputes from the
 *     live DMMF and asserts deep-equality with the committed generated file.
 *
 * Keeping the logic here (not duplicated) guarantees the generated file and the
 * drift check can never silently diverge.
 *
 * NB: takes the DMMF model list as input — it does NOT touch `Prisma.dmmf`
 * itself, so it carries no edge-runtime hazard. The CALLERS read the DMMF (in
 * Node only); this function is pure.
 */
import { isTenantScoped } from "../../src/lib/tenant-models";

/** The minimal shape of a DMMF model we depend on. */
type DmmfField = {
  name: string;
  kind: string;
  type: string;
  relationName?: string;
};
type DmmfModel = { name: string; fields: readonly DmmfField[] };

export type TenantScopeMaps = {
  RELATIONS: Record<string, Record<string, string>>;
  SCALAR_FK_TO_REL: Record<string, Record<string, string>>;
};

/**
 * model → (relationField → targetModel). Mirrors the original `RELATIONS` IIFE.
 */
function buildRelations(models: readonly DmmfModel[]): Record<string, Record<string, string>> {
  const map: Record<string, Record<string, string>> = {};
  for (const m of models) {
    const rels: Record<string, string> = {};
    for (const f of m.fields) if (f.kind === "object" && f.relationName) rels[f.name] = f.type;
    map[m.name] = rels;
  }
  return map;
}

/**
 * model → (scalarFKField → relationField) for scalar FKs targeting a
 * TENANT-SCOPED model. Mirrors the original `SCALAR_FK_TO_REL` IIFE.
 */
function buildScalarFkToRel(
  models: readonly DmmfModel[],
): Record<string, Record<string, string>> {
  const map: Record<string, Record<string, string>> = {};
  for (const m of models) {
    const scalars = new Set(m.fields.filter((f) => f.kind === "scalar").map((f) => f.name));
    const entry: Record<string, string> = {};
    for (const f of m.fields) {
      if (f.kind === "object" && f.relationName && isTenantScoped(f.type)) {
        const fk = `${f.name}Id`;
        if (scalars.has(fk)) entry[fk] = f.name;
      }
    }
    if (Object.keys(entry).length) map[m.name] = entry;
  }
  return map;
}

/** Derive both maps from the DMMF model list. */
export function deriveTenantScopeMaps(models: readonly DmmfModel[]): TenantScopeMaps {
  return {
    RELATIONS: buildRelations(models),
    SCALAR_FK_TO_REL: buildScalarFkToRel(models),
  };
}
