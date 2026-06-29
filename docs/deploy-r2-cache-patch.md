# Deploy patch: non-fatal R2 incremental-cache population

**Patch file:** `patches/@opennextjs%2Fcloudflare@1.19.11.patch`
(wired via `patchedDependencies` in `package.json`, re-applied on every
`bun install`).

## Symptom

Cloudflare Workers-Build deploys started failing on **2026-06-23** at the
remote cache-population step, with no change to our code or dependencies:

```
Populating remote R2 incremental cache...
Error: Failed to provision remote R2 bucket "ccau-next-cache-staging" for
binding "NEXT_INC_CACHE_R2_BUCKET": Failed to check whether bucket exists:
Invalid response body while trying to fetch
https://api.cloudflare.com/client/v4/accounts/.../r2/buckets/ccau-next-cache-staging:
Premature close
```

## Root cause — Cloudflare-side, not ours

`opennextjs-cloudflare deploy` runs `populateCache remote`, which calls
`ensureR2Bucket()` → `client.r2.buckets.get()` against the Cloudflare REST API
to check the cache bucket exists before seeding it. That API call is returning a
**truncated HTTP response body ("Premature close")** from the CF build runner.

This is **not** a version drift or a transient flake:

- The last *successful* deploy (commit `957b105`, 2026-06-22) already used
  `@opennextjs/cloudflare@1.19.11` (published 2026-05-19) and `cloudflare@4.5.0`.
  The **same versions** succeeded on the 22nd and failed on the 23rd.
- The Cloudflare SDK already retries network errors internally (`maxRetries=2`),
  and a wrapper retry (`scripts/cf-deploy.mjs`, 3×) on top of that still failed
  every attempt — ~9 tries total. A real flake would have caught a success.
- Upstream report [opennextjs-cloudflare#1285][1285] is the same error, started
  at a specific wall-clock moment ("we haven't changed our deployment process"),
  and spans multiple `1.19.x` versions — i.e. a Cloudflare API change, not a
  package regression.

A downgrade does **not** help: the only `@opennextjs/cloudflare` version that
avoids the REST bucket-check is pre-`1.18.0` (before PR #1159), which predates
our Next 16 / Wrangler 4.86 peer requirements.

## The patch

Remote incremental-cache population is a **best-effort optimization** — at
runtime the Worker reads R2 through its binding regardless, so a skipped
populate just means a cold cache that warms lazily on first request. The patch
wraps the incremental-cache switch in `dist/cli/commands/populate-cache.js` so a
**remote** failure logs a warning and continues instead of aborting the deploy
(local population stays fatal). This is the community-accepted fix from #1285.

```js
try {
  switch (name) { /* R2 / KV / static cases unchanged */ }
} catch (e) {
  if (populateCacheOptions.target === "remote") {
    logger.warn(`Remote incremental cache population failed, continuing. Cause: ${...}`);
  } else {
    throw e;
  }
}
```

## Why this is safe and self-healing

- **Correctness is unaffected.** ISR/`unstable_cache` pages regenerate on first
  hit and repopulate R2 on demand; the only cost of a skipped populate is a few
  slower first requests + a little extra Worker CPU until the cache warms.
- **Self-healing.** When Cloudflare fixes their API, population succeeds again
  with **zero further changes** — the warning simply stops firing and the cache
  is seeded at deploy time as before.

## When to remove it

Once `opennextjs-cloudflare` ships an upstream fix (track #1285) **and** the
Cloudflare API stops returning "Premature close":

1. Delete `patches/@opennextjs%2Fcloudflare@1.19.11.patch`.
2. Remove the `patchedDependencies` entry in `package.json`.
3. `bun install` and redeploy; confirm the build log shows
   `Successfully populated cache with N entries`.

If a future `bun install` bumps `@opennextjs/cloudflare` past `1.19.11`, the
version-pinned patch will fail to apply and Bun will error — re-create it with
`bun patch @opennextjs/cloudflare` against the same change, or drop it if the
upstream fix has landed.

## Related

- `scripts/cf-deploy.mjs` — the deploy command used by `staging:deploy:cf` /
  `production:deploy:cf`. Its retry loop is now largely redundant (the patch
  makes the failing step non-fatal) but is harmless; it stays as the CF deploy
  entrypoint.

## References

- [opennextjs-cloudflare#1285 — "Failed to provision remote R2 bucket … Premature close"][1285] (the matching report + community fix)
- [opennextjs-cloudflare#1273 — wrangler deploy silently hangs at populateCache][1273]
- [opennextjs-cloudflare#1171 — v1.18.0 breaks R2 Cache population][1171] (context: the populate rewrite that introduced the REST bucket-check)
- [node-fetch#1614 — "Premature close" on response-body reads][nf1614] (the underlying fetch failure class)

[1285]: https://github.com/opennextjs/opennextjs-cloudflare/issues/1285
[1273]: https://github.com/opennextjs/opennextjs-cloudflare/issues/1273
[1171]: https://github.com/opennextjs/opennextjs-cloudflare/issues/1171
[nf1614]: https://github.com/node-fetch/node-fetch/discussions/1614
