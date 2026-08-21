import {
  auditLog,
  emailPreferences,
  pendingAdminGrants,
  userMemberships,
  users,
} from "@/modules/identity/schema.registry";
import {
  impactLabCoffeeCodes,
  impactLabConfig,
  impactLabInterests,
  impactLabParticipants,
  impactLabSponsors,
  impactLabStatements,
  impactLabTeams,
  impactLabVotes,
} from "@/modules/impact-lab/schema.registry";
import { tenantSettings, tenants } from "@/modules/tenants/schema.registry";

/** Stable object of registry tables for drizzle + RegistryStore. */
export function createRegistrySchema() {
  return {
    auditLog,
    emailPreferences,
    impactLabCoffeeCodes,
    impactLabConfig,
    impactLabInterests,
    impactLabParticipants,
    impactLabSponsors,
    impactLabStatements,
    impactLabTeams,
    impactLabVotes,
    pendingAdminGrants,
    tenantSettings,
    tenants,
    userMemberships,
    users,
  };
}

export type RegistryTables = ReturnType<typeof createRegistrySchema>;
