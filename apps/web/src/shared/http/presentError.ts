import type { ServiceError } from "./errors";

const MESSAGES: Record<string, string> = {
  bad_request: "That input couldn't be saved. Check the fields and try again.",
  banned: "This account has been suspended.",
  conflict: "That already exists — pick a different name.",
  forbidden: "You don't have permission to do that.",
  invalid_input: "That input couldn't be saved. Check the fields and try again.",
  not_found: "That page or record doesn't exist.",
  unauthenticated: "Sign in to continue.",
};

export function presentError(error: ServiceError): string {
  return error.message ?? MESSAGES[error.code] ?? "Something went wrong. Please try again.";
}
