/**
 * A v4 UUID that works in EVERY runtime we target — including a browser tab
 * served over plain `http://`. `crypto.randomUUID()` is **secure-context-only**
 * (HTTPS / localhost); over `http://<host>` it's `undefined`, so calling it
 * directly throws `crypto.randomUUID is not a function` and crashes the render.
 * `crypto.getRandomValues()` has no such restriction, so we synthesize a v4 UUID
 * from it when `randomUUID` is missing. On the Worker and on HTTPS pages the fast
 * native path is used unchanged.
 *
 * Use this in CLIENT components instead of `crypto.randomUUID()`. (Server-only
 * code may call `crypto.randomUUID()` directly — workerd always provides it.)
 */
export function uuid(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  if (c?.getRandomValues) {
    const b = c.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40; // version 4
    b[8] = (b[8] & 0x3f) | 0x80; // variant 10
    const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
  }
  // Crypto entirely absent — never on workerd/browser, but stay non-throwing.
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
