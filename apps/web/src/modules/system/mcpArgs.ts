import type { McpArgs } from "@/modules/system/types";
import { err, ok, type Result } from "@/shared/http/errors";

export function str(args: McpArgs, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" ? value : undefined;
}

/** Distinguishes omitted vs explicit null (live MCP allows scheduledAt: null). */
export function strOrNull(args: McpArgs, key: string): string | null | undefined {
  if (!(key in args)) {
    return undefined;
  }
  const value = args[key];
  if (value === null) {
    return null;
  }
  return typeof value === "string" ? value : undefined;
}

export function bool(args: McpArgs, key: string): boolean | undefined {
  const value = args[key];
  return typeof value === "boolean" ? value : undefined;
}

export function num(args: McpArgs, key: string): number | undefined {
  const value = args[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function strs(args: McpArgs, key: string): string[] | undefined {
  const value = args[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return undefined;
  }
  return value;
}

export function requireStr(args: McpArgs, key: string): Result<{ value: string }> {
  const value = str(args, key);
  if (!value) {
    return err("bad_request", 400, `${key} is required`);
  }
  return ok({ value });
}
