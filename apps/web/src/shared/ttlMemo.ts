/**
 * Isolate-scoped TTL memo. Values persist across requests within one Worker
 * isolate and expire after ttlMs. Deliberately tiny: no LRU, no size cap —
 * keys are low-cardinality (users, city slugs).
 */
export function ttlMemo<T>(ttlMs: number): {
  get: (key: string) => T | undefined;
  set: (key: string, value: T) => void;
} {
  const entries = new Map<string, { at: number; value: T }>();
  return {
    get(key) {
      const hit = entries.get(key);
      if (!hit) {
        return;
      }
      if (Date.now() - hit.at > ttlMs) {
        entries.delete(key);
        return;
      }
      return hit.value;
    },
    set(key, value) {
      entries.set(key, { at: Date.now(), value });
    },
  };
}
