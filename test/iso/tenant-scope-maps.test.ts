import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { deriveTenantScopeMaps } from "../../scripts/lib/derive-tenant-scope-maps";
import {
  RELATIONS as GENERATED_RELATIONS,
  SCALAR_FK_TO_REL as GENERATED_SCALAR_FK_TO_REL,
} from "@/lib/tenant-scope-maps.generated";

// DRIFT GUARD. The tenant-scope maps are PRECOMPUTED at build time into
// `src/lib/tenant-scope-maps.generated.ts` (committed) so the chokepoint never
// touches the Prisma DMMF at runtime — that getter throws in the Cloudflare edge
// runtime. This test recomputes the maps from the LIVE DMMF (available here in
// Node) via the same derivation the codegen uses, and asserts the committed file
// is up to date. If the Prisma schema changes without regenerating, this fails —
// run `prisma generate` (the prebuild regenerates the maps) and re-commit.
describe("tenant-scope-maps.generated.ts is up to date with the Prisma schema", () => {
  const models = Prisma.dmmf.datamodel.models;
  const expected = deriveTenantScopeMaps(models);

  it("RELATIONS matches the live DMMF", () => {
    expect(GENERATED_RELATIONS).toEqual(expected.RELATIONS);
  });

  it("SCALAR_FK_TO_REL matches the live DMMF", () => {
    expect(GENERATED_SCALAR_FK_TO_REL).toEqual(expected.SCALAR_FK_TO_REL);
  });
});
