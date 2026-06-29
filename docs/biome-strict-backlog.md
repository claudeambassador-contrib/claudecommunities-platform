# Biome strict-rules backlog

> **RESOLVED (2026-06-20).** The full ratchet has landed on
> `chore/lint-zero-warnings`: all 939 Biome warnings were cleared, every rule
> below is now at `"error"` in `biome.json`, and `bun run lint` / `bun run
> check` are at **zero warnings**. Intentional cases are justified inline with
> `// biome-ignore <rule>: <reason>` (≈249 directives, dominated by raw `<img>`
> for slide/canvas export and intentional effect-dep omissions). The sections
> below are kept for historical context only — there is no outstanding backlog.

Manual cleanup needed to ratchet remaining `warn`-level Biome rules to `error`.
Current state: `bun run lint` passes; these rules fire as warnings only.

Plan reference: `~/.claude/plans/twinkly-toasting-fiddle.md` (Phase 4).
Last updated after Phase 3 landed (commits `58d4cce` → `a9d107e`).

## Semi-mechanical (good "low-hanging fruit" PR)

Auto-fixable in principle but only via Biome's `--unsafe` transforms, which
broke type-checking on this codebase (TDZ via `useExhaustiveDependencies`).
Apply by hand, or carefully with `--unsafe` per-file + immediate tsc check.

| Rule | Sites | Group |
|---|---|---|
| `correctness/noUnusedImports` | 19 | correctness |
| `complexity/useOptionalChain` | 19 | complexity |
| `complexity/useLiteralKeys` | 9 | complexity |
| `style/useTemplate` | 31 | style |

## Design / type work

Requires judgment per call site.

| Rule | Sites | Notes |
|---|---|---|
| `style/noNonNullAssertion` | 25 | Each `!` needs replacement with a real null check or type narrowing. |
| `suspicious/noExplicitAny` | 15 | Replace `any` with proper types; some may legitimately need `unknown` + narrow. |
| `complexity/noExcessiveCognitiveComplexity` | 32 | Threshold currently 25; either refactor or bump threshold further. Per-file decision. |
| `suspicious/noConsole` | 82 | Currently allows `warn`/`error`. Decide: delete debug logs vs. expand allowlist vs. route through a logger. |

## Accessibility (largest manual backlog)

Carried from Phase 1 downgrades. These are quality issues; users will benefit.

| Rule | Sites | Typical fix |
|---|---|---|
| `a11y/useButtonType` | 307 | Add `type="button"` (or `submit`/`reset`) to every `<button>`. Mostly mechanical, codemod candidate. |
| `a11y/noLabelWithoutControl` | 93 | Wrap label around control or add `htmlFor` linking to `id`. |
| `a11y/noStaticElementInteractions` | 46 | Replace `onClick` on `<div>`/`<span>` with `<button>`, or add role+keyboard handlers. |
| `a11y/useKeyWithClickEvents` | 44 | Pair `onClick` with `onKeyDown`/`onKeyUp` (or use a real button). |
| `correctness/useExhaustiveDependencies` | 47 | Audit `useEffect`/`useCallback` deps. `--unsafe` autofix UNSAFE here (TDZ). Manual only. |
| `suspicious/noArrayIndexKey` | 49 | Use a stable id from the item instead of array index. |
| `a11y/noSvgWithoutTitle` | 29 | Add `<title>` element, or `role="img" aria-label`, or `aria-hidden` for decorative. |
| `a11y/useValidAriaRole` | 12 | Fix or remove invalid `role` attributes. |
| `security/noDangerouslySetInnerHtml` | 11 | Each site needs review — sanitize or eliminate. |
| `a11y/useMediaCaption` | 7 | Add `<track kind="captions">` to `<video>`/`<audio>`. |
| `a11y/noAutofocus` | 6 | Remove `autoFocus` or justify per case. |
| `correctness/noSwitchDeclarations` | 6 | Wrap `case` bodies in blocks when declaring `let`/`const`. |
| `suspicious/noAssignInExpressions` | 2 | Hoist assignment out of expression. |
| `suspicious/useIterableCallbackReturn` | 2 | Ensure callback returns expected value. |
| `suspicious/noMisleadingCharacterClass` | 1 | Fix regex character class. |
| `suspicious/noShadowRestrictedNames` | 1 | Rename shadowing identifier. |

## Suggested PR slicing

1. **Imports + small wins** — `noUnusedImports` + `useOptionalChain` + `useLiteralKeys` + `noSwitchDeclarations` + the 1–2-site suspicious rules. Probably <300 LOC, fast review.
2. **Template literals + button types** — `useTemplate` + `useButtonType`. Both highly mechanical, can codemod. Large diff but low cognitive load.
3. **Console & any cleanup** — `noConsole` + `noExplicitAny`. Likely intertwined (debug logs around poorly-typed code).
4. **Hooks deps audit** — `useExhaustiveDependencies` alone. Risky enough to land separately with manual testing.
5. **Label + keyboard a11y** — `noLabelWithoutControl` + `noStaticElementInteractions` + `useKeyWithClickEvents`. UI-heavy review.
6. **Remaining a11y polish** — `noSvgWithoutTitle`, `useValidAriaRole`, `useMediaCaption`, `noAutofocus`.
7. **Non-null + complexity refactors** — `noNonNullAssertion` + `noExcessiveCognitiveComplexity` + `noArrayIndexKey`. Per-file refactor judgment.
8. **Security pass** — `noDangerouslySetInnerHtml`, plus any `--unsafe`-only fixes left.

After each PR: bump the affected rule(s) in `biome.json` from `"warn"` to
`"error"`. Done signal: `git grep "warn" biome.json` returns only rules we
deliberately keep lenient.

## Known constraints

- `biome check --write --unsafe` breaks types via TDZ on this repo (e.g.
  `useExhaustiveDependencies` reorders dep arrays past `useCallback`
  declarations). Use safe-fix only, or unsafe per-file with immediate
  `tsc --noEmit` verification.
- No-op ESLint plugin stubs in `eslint.config.mjs` reference dropped
  packages so 5 inline `eslint-disable` comments still resolve. Will fall
  off naturally as those files are touched. If they're still around after
  the backlog is cleared, delete them.
