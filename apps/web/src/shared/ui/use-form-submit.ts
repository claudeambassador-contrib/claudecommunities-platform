import { useRouter } from "@tanstack/react-router";
import { type FormEvent, useCallback, useRef, useState } from "react";

/** The shape every guarded mutation server fn resolves to. */
export type FormResult = { ok: true } | { error: string; ok: false };

export interface UseFormSubmitOptions<T extends FormResult> {
  /** Run `router.invalidate()` after success. Default true. */
  invalidate?: boolean;
  /** Runs after success (and after invalidation) — for navigation etc. */
  onSuccess?: (result: Extract<T, { ok: true }>, form: HTMLFormElement) => void | Promise<void>;
  /** Reset the form after a successful submit. Default false. */
  resetOnSuccess?: boolean;
  /** Called with the extracted FormData; return the server fn's result. */
  submit: (formData: FormData) => Promise<T>;
  /** Message shown on success. A function receives the ok-result payload. */
  successMessage?: string | ((result: Extract<T, { ok: true }>) => string);
}

export interface FormSubmit {
  /** Error message from the last submit, or null. Exclusive with `success`. */
  error: string | null;
  /** Wire to `<form onSubmit={...}>`. Guards against double submits. */
  handleSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  /** True while the submit fn is in flight — disable the submit button. */
  pending: boolean;
  /** Success message from the last submit, or null. Exclusive with `error`. */
  success: string | null;
}

/** Read a string field off FormData, defaulting missing/file values to "". */
export function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * Shared submit plumbing for the hand-rolled route forms: preventDefault,
 * FormData extraction, a pending flag (double-submit guard), distinct
 * error/success messages, optional reset, and automatic router.invalidate().
 */
export function useFormSubmit<T extends FormResult>(options: UseFormSubmitOptions<T>): FormSubmit {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      // biome-ignore lint/suspicious/noUnnecessaryConditions: pendingRef is mutated below; this guards against re-entrant double submits
      if (pendingRef.current) {
        return;
      }
      const form = event.currentTarget;
      const submitter =
        event.nativeEvent instanceof SubmitEvent ? event.nativeEvent.submitter : null;
      const formData = new FormData(form, submitter);
      pendingRef.current = true;
      setPending(true);
      setError(null);
      setSuccess(null);
      try {
        const opts = optionsRef.current;
        const result = await opts.submit(formData);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        const okResult = result as Extract<T, { ok: true }>;
        if (opts.resetOnSuccess) {
          form.reset();
        }
        setSuccess(
          typeof opts.successMessage === "function"
            ? opts.successMessage(okResult)
            : (opts.successMessage ?? null),
        );
        if (opts.invalidate !== false) {
          await router.invalidate();
        }
        await opts.onSuccess?.(okResult, form);
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        pendingRef.current = false;
        setPending(false);
      }
    },
    [router],
  );

  return { error, handleSubmit, pending, success };
}
