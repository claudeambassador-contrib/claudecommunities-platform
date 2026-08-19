import { describe, expect, it } from "vitest";
import type { ServiceError } from "@/shared/http/errors";
import { presentError } from "@/shared/http/presentError";

describe("presentError", () => {
  it("prefers an explicit message over the code table", () => {
    const error: ServiceError = { code: "forbidden", message: "Custom message", status: 403 };
    expect(presentError(error)).toBe("Custom message");
  });

  it("maps 'forbidden' to its table entry", () => {
    expect(presentError({ code: "forbidden", status: 403 })).toBe(
      "You don't have permission to do that.",
    );
  });

  it("maps 'unauthenticated' to its table entry", () => {
    expect(presentError({ code: "unauthenticated", status: 401 })).toBe("Sign in to continue.");
  });

  it("maps 'not_found' to its table entry", () => {
    expect(presentError({ code: "not_found", status: 404 })).toBe(
      "That page or record doesn't exist.",
    );
  });

  it("maps 'banned' to its table entry", () => {
    expect(presentError({ code: "banned", status: 403 })).toBe("This account has been suspended.");
  });

  it("maps 'bad_request' to its table entry", () => {
    expect(presentError({ code: "bad_request", status: 400 })).toBe(
      "That input couldn't be saved. Check the fields and try again.",
    );
  });

  it("maps 'invalid_input' to its table entry", () => {
    expect(presentError({ code: "invalid_input", status: 400 })).toBe(
      "That input couldn't be saved. Check the fields and try again.",
    );
  });

  it("maps 'conflict' to its table entry", () => {
    expect(presentError({ code: "conflict", status: 409 })).toBe(
      "That already exists — pick a different name.",
    );
  });

  it("falls back to a generic message for an unknown code without a message", () => {
    expect(presentError({ code: "totally_unknown", status: 500 })).toBe(
      "Something went wrong. Please try again.",
    );
  });
});
