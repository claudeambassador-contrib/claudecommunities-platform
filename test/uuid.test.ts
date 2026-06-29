import { afterEach, describe, expect, it } from "vitest";
import { uuid } from "@/lib/uuid";

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("uuid()", () => {
  const realCrypto = globalThis.crypto;
  afterEach(() => {
    Object.defineProperty(globalThis, "crypto", { value: realCrypto, configurable: true });
  });

  it("returns a v4 UUID via the native path when randomUUID exists", () => {
    expect(uuid()).toMatch(V4);
  });

  it("falls back to getRandomValues when randomUUID is missing (http / non-secure context)", () => {
    // Reproduce a plain-http browser: crypto exists, but randomUUID is undefined.
    Object.defineProperty(globalThis, "crypto", {
      value: { getRandomValues: realCrypto.getRandomValues.bind(realCrypto) },
      configurable: true,
    });
    const id = uuid();
    expect(id).toMatch(V4); // valid v4 with correct version/variant nibbles
    expect(uuid()).not.toBe(id); // and unique across calls
  });
});
