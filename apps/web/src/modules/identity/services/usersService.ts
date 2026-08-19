// biome-ignore lint/performance/noNamespaceImport: repository is the persistence boundary
import * as directoryRepo from "@/modules/identity/repositories/directoryRepository";
import {
  findEmailPreferences,
  pickPrefBooleans,
  upsertEmailPreferences,
} from "@/modules/identity/repositories/emailPreferencesRepository";
import {
  findByClerkId,
  listMembershipsForUser,
} from "@/modules/identity/repositories/usersRepository";
import {
  type DirectoryMember,
  EMAIL_PREF_DEFAULTS,
  type EmailPreferences,
  type EmailPreferencesInput,
  type ImportMemberInput,
  type ImportMemberResult,
  type InviteRecord,
  type ListUsersOptions,
  type MembershipRole,
  type PublicAuthor,
  type UserProfile,
  type UserSummary,
} from "@/modules/identity/types";
import type { Actor } from "@/shared/auth/actor";
import { ensurePermission } from "@/shared/auth/actor";
import { permissionsForRole } from "@/shared/auth/permissions";
import type { RegistryDb } from "@/shared/db/client";
import type { RegistryStore } from "@/shared/db/registryStore";
import { err, ok, type Result } from "@/shared/http/errors";

function clampPage(options: ListUsersOptions): { limit: number; offset: number; search?: string } {
  const limit = Math.min(100, Math.max(1, options.limit ?? 50));
  const offset = Math.max(0, options.offset ?? 0);
  const search = options.search?.trim() || undefined;
  return { limit, offset, search };
}

export async function listUsers(
  store: RegistryStore,
  actor: Actor,
  orgId: string,
  options: ListUsersOptions = {},
): Promise<Result<{ users: UserSummary[] }>> {
  const perm = ensurePermission(actor, "users.view");
  if (!perm.ok) {
    return perm;
  }
  if (!orgId) {
    return err("bad_request", 400, "orgId is required");
  }
  return ok({ users: await directoryRepo.listOrgMembers(store, orgId, clampPage(options)) });
}

/** Signed-in city directory — membership required, emails omitted. */
export async function listDirectory(
  store: RegistryStore,
  actor: Actor,
  orgId: string,
  options: ListUsersOptions = {},
): Promise<Result<{ users: DirectoryMember[] }>> {
  if (!actor.id) {
    return err("unauthenticated", 401);
  }
  if (!orgId) {
    return err("bad_request", 400, "orgId is required");
  }
  if (!actor.isSuperAdmin) {
    const membership = await directoryRepo.findMembership(store, actor.id, orgId);
    if (!membership) {
      return err("forbidden", 403, "City membership required");
    }
  }
  const users = await directoryRepo.listOrgMembers(store, orgId, clampPage(options));
  return ok({
    users: users.map((user) => ({
      createdAt: user.createdAt,
      displayName: user.displayName,
      id: user.id,
      imageUrl: user.imageUrl,
      role: user.role,
    })),
  });
}

export async function getOwnProfile(
  store: RegistryStore,
  actor: Actor,
): Promise<Result<{ user: UserProfile }>> {
  const user = await directoryRepo.findUserById(store, actor.id);
  if (!user) {
    return err("not_found", 404, "User not found");
  }
  return ok({ user });
}

/** Public display names for feed/cards. No email, no users.view required. */
export async function listPublicAuthors(
  store: RegistryStore,
  ids: readonly string[],
): Promise<{ authors: PublicAuthor[] }> {
  const users = await directoryRepo.findUsersByIds(store, ids);
  return {
    authors: users.map((user) => ({
      id: user.id,
      imageUrl: user.imageUrl,
      name: user.displayName?.trim() || "Member",
    })),
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CSV_LINE_RE = /\r?\n/;
const QUOTED_CELL_RE = /^"|"$/g;

function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return null;
  }
  return email;
}

export async function updateOwnProfile(
  store: RegistryStore,
  actor: Actor,
  input: { displayName: string },
): Promise<Result<{ user: UserProfile }>> {
  const name = input.displayName.trim();
  if (!name) {
    return err("bad_request", 400, "Name is required");
  }
  const user = await directoryRepo.updateUserProfile(store, actor.id, { displayName: name });
  if (!user) {
    return err("not_found", 404, "User not found");
  }
  return ok({ user });
}

async function upsertMember(
  store: RegistryStore,
  orgId: string,
  input: { displayName?: string; email: string },
): Promise<Result<{ created: boolean; invite: InviteRecord }>> {
  const email = normalizeEmail(input.email);
  if (!email) {
    return err("bad_request", 400, "Valid email is required");
  }
  const existing = await directoryRepo.findUserByEmail(store, email);
  if (existing) {
    const membership = await directoryRepo.findMembership(store, existing.id, orgId);
    if (!membership) {
      await directoryRepo.insertMembership(store, { orgId, role: "member", userId: existing.id });
    }
    return ok({
      created: false,
      invite: {
        createdAt: existing.createdAt,
        displayName: existing.displayName,
        email: existing.email,
        hasSignedUp: true,
        id: existing.id,
      },
    });
  }
  const user = await directoryRepo.insertUser(store, {
    clerkUserId: `invite_${crypto.randomUUID()}`,
    displayName: input.displayName?.trim() || null,
    email,
  });
  await directoryRepo.insertMembership(store, { orgId, role: "member", userId: user.id });
  return ok({
    created: true,
    invite: {
      createdAt: user.createdAt,
      displayName: user.displayName,
      email: user.email,
      hasSignedUp: false,
      id: user.id,
    },
  });
}

export async function inviteMember(
  store: RegistryStore,
  actor: Actor,
  orgId: string,
  input: { displayName?: string; email: string },
): Promise<Result<{ created: boolean; invite: InviteRecord }>> {
  const perm = ensurePermission(actor, "users.invite");
  if (!perm.ok) {
    return perm;
  }
  if (!orgId) {
    return err("bad_request", 400, "orgId is required");
  }
  return await upsertMember(store, orgId, input);
}

export async function listInvites(
  store: RegistryStore,
  actor: Actor,
  orgId: string,
): Promise<Result<{ invites: InviteRecord[] }>> {
  const perm = ensurePermission(actor, "users.invite");
  if (!perm.ok) {
    return perm;
  }
  if (!orgId) {
    return err("bad_request", 400, "orgId is required");
  }
  return ok({ invites: await directoryRepo.listInvitedMembers(store, orgId) });
}

export async function importMembers(
  store: RegistryStore,
  actor: Actor,
  orgId: string,
  rows: ImportMemberInput[],
): Promise<Result<ImportMemberResult>> {
  const perm = ensurePermission(actor, "users.import");
  if (!perm.ok) {
    return perm;
  }
  if (!orgId) {
    return err("bad_request", 400, "orgId is required");
  }
  if (rows.length === 0) {
    return err("bad_request", 400, "No users to import");
  }
  const result: ImportMemberResult = { created: 0, errors: [], skipped: 0, updated: 0 };
  // Sequential upserts avoid duplicate-email races on the same CSV.
  for (const row of rows) {
    // biome-ignore lint/performance/noAwaitInLoops: unique-email writes must stay sequential
    const invited = await upsertMember(store, orgId, row);
    if (!invited.ok) {
      result.errors.push({
        email: row.email || "missing",
        error: invited.error.message ?? invited.error.code,
      });
      result.skipped += 1;
      continue;
    }
    if (invited.created) {
      result.created += 1;
    } else {
      result.updated += 1;
    }
  }
  return ok(result);
}

export async function listEmailContacts(
  store: RegistryStore,
  actor: Actor,
  orgId: string,
): Promise<Result<{ users: UserSummary[] }>> {
  const perm = ensurePermission(actor, "email.view");
  if (!perm.ok) {
    return perm;
  }
  if (!orgId) {
    return err("bad_request", 400, "orgId is required");
  }
  return ok({ users: await directoryRepo.listOrgMembers(store, orgId, { limit: 200, offset: 0 }) });
}

export async function getEmailPreferences(
  store: RegistryStore,
  actor: Actor,
): Promise<Result<{ preferences: EmailPreferences }>> {
  if (!actor.id) {
    return err("unauthenticated", 401);
  }
  const existing = await findEmailPreferences(store, actor.id);
  return ok({ preferences: existing ?? EMAIL_PREF_DEFAULTS });
}

export async function updateEmailPreferences(
  store: RegistryStore,
  actor: Actor,
  input: EmailPreferencesInput,
): Promise<Result<{ preferences: EmailPreferences }>> {
  if (!actor.id) {
    return err("unauthenticated", 401);
  }
  return ok({
    preferences: await upsertEmailPreferences(store, actor.id, pickPrefBooleans(input)),
  });
}

/** Members who can receive campaign mail: not banned, has an email, not unsubscribed. */
export async function listCampaignRecipients(
  store: RegistryStore,
  orgId: string,
): Promise<Array<{ email: string; id: string }>> {
  return await directoryRepo.listOrgRecipients(store, orgId);
}

/** One-click unsubscribe (email webhooks / signed links): opt the address out of the digest. */
export async function unsubscribeByEmail(
  store: RegistryStore,
  email: string,
): Promise<Result<{ email: string }>> {
  const user = await directoryRepo.findUserByEmail(store, email);
  if (!user) {
    return err("not_found", 404, "Email not found");
  }
  await upsertEmailPreferences(store, user.id, { weeklyDigest: false });
  return ok({ email: user.email });
}

/** Change a member's role within an org. Callers own the permission checks. */
export async function setMembershipRole(
  store: RegistryStore,
  orgId: string,
  targetUserId: string,
  role: MembershipRole,
): Promise<Result<{ id: string; role: MembershipRole }>> {
  const user = await directoryRepo.findUserById(store, targetUserId);
  if (!user) {
    return err("not_found", 404, "User not found");
  }
  const updated = await directoryRepo.updateMembershipRole(store, orgId, targetUserId, role);
  if (!updated) {
    return err("not_found", 404, "User is not a member of this community");
  }
  return ok({ id: targetUserId, role });
}

function bestMembershipRole(
  roles: ReadonlyArray<string | null | undefined>,
): MembershipRole | null {
  if (roles.includes("owner")) {
    return "owner";
  }
  if (roles.includes("admin")) {
    return "admin";
  }
  if (roles.includes("member")) {
    return "member";
  }
  return null;
}

/** Resolve a transport-agnostic Actor for an already-verified Clerk user id (MCP bearer auth).
 *  Returns null for unknown or banned users. */
export async function actorFromClerkUserId(
  db: RegistryDb,
  clerkUserId: string,
): Promise<Actor | null> {
  const user = await findByClerkId(db, clerkUserId);
  if (!user || user.isBanned) {
    return null;
  }
  const memberships = await listMembershipsForUser(db, user.id);
  const role = user.isSuperAdmin ? "owner" : bestMembershipRole(memberships.map((row) => row.role));
  return {
    email: user.email,
    id: user.id,
    isSuperAdmin: user.isSuperAdmin,
    permissions: permissionsForRole(role),
  };
}

export function parseMemberCsv(csv: string): ImportMemberInput[] {
  const lines = csv
    .split(CSV_LINE_RE)
    .map((line) => line.trim())
    .filter(Boolean);
  const rows: ImportMemberInput[] = [];
  for (const line of lines) {
    const [first = "", second = ""] = line
      .split(",")
      .map((part) => part.trim().replace(QUOTED_CELL_RE, ""));
    if (first.toLowerCase() === "email") {
      continue;
    }
    const email = first.includes("@") ? first : second;
    const displayName = first.includes("@") ? second : first;
    if (!email) {
      continue;
    }
    rows.push({ displayName: displayName || undefined, email });
  }
  return rows;
}
