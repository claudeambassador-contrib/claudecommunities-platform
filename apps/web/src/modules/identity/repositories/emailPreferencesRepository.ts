import { eq } from "drizzle-orm";
import {
  EMAIL_PREF_DEFAULTS,
  type EmailPreferences,
  type EmailPreferencesInput,
} from "@/modules/identity/types";
import type { RegistryStore } from "@/shared/db/registryStore";
import { newId } from "@/shared/ids";

const PREF_KEYS = [
  "mentions",
  "replies",
  "likes",
  "messages",
  "weeklyDigest",
  "eventReminders",
] as const;

function first<T>(rows: T[]): T | undefined {
  const [row] = rows;
  return row;
}

function toPrefs(row: EmailPreferences): EmailPreferences {
  return {
    eventReminders: row.eventReminders,
    likes: row.likes,
    mentions: row.mentions,
    messages: row.messages,
    replies: row.replies,
    weeklyDigest: row.weeklyDigest,
  };
}

export function pickPrefBooleans(input: object): EmailPreferencesInput {
  const raw = input as Record<string, unknown>;
  const out: EmailPreferencesInput = {};
  for (const key of PREF_KEYS) {
    if (typeof raw[key] === "boolean") {
      out[key] = raw[key];
    }
  }
  return out;
}

export async function findEmailPreferences(
  store: RegistryStore,
  userId: string,
): Promise<EmailPreferences | null> {
  const { emailPreferences } = store.tables;
  const row = first(
    await store.db
      .select()
      .from(emailPreferences)
      .where(eq(emailPreferences.userId, userId))
      .limit(1),
  );
  return row ? toPrefs(row) : null;
}

export async function upsertEmailPreferences(
  store: RegistryStore,
  userId: string,
  input: EmailPreferencesInput,
): Promise<EmailPreferences> {
  const { emailPreferences } = store.tables;
  const existing = first(
    await store.db
      .select()
      .from(emailPreferences)
      .where(eq(emailPreferences.userId, userId))
      .limit(1),
  );
  const now = new Date();
  const patch = pickPrefBooleans(input);
  if (!existing) {
    const created = { ...EMAIL_PREF_DEFAULTS, ...patch };
    await store.db.insert(emailPreferences).values({
      eventReminders: created.eventReminders,
      id: newId("epref"),
      likes: created.likes,
      mentions: created.mentions,
      messages: created.messages,
      replies: created.replies,
      updatedAt: now,
      userId,
      weeklyDigest: created.weeklyDigest,
    });
    return created;
  }
  const next: EmailPreferences = {
    eventReminders: patch.eventReminders ?? existing.eventReminders,
    likes: patch.likes ?? existing.likes,
    mentions: patch.mentions ?? existing.mentions,
    messages: patch.messages ?? existing.messages,
    replies: patch.replies ?? existing.replies,
    weeklyDigest: patch.weeklyDigest ?? existing.weeklyDigest,
  };
  await store.db
    .update(emailPreferences)
    .set({ ...next, updatedAt: now })
    .where(eq(emailPreferences.userId, userId));
  return next;
}
