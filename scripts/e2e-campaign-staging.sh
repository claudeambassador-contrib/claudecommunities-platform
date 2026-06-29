#!/usr/bin/env bash
# End-to-end test harness for CampaignSendWorkflow on staging.
#
# Seeds N test users with Resend simulator emails (delivered+eNNN@resend.dev,
# bounced+eNNN@resend.dev, complained+eNNN@resend.dev), attaches them to a
# fresh UserTag, creates a draft EmailCampaign targeting that tag, then lets
# you trigger the workflow and watch counters tick.
#
# Everything is prefixed `e2e-campaign-` so `cleanup` wipes the lot in one
# pass. Re-running `seed` doesn't clash — each run gets its own timestamped
# sub-prefix (runId), so you can stack tests if you want to.
#
# Usage:
#   scripts/e2e-campaign-staging.sh seed [count]      Default 250 recipients
#   scripts/e2e-campaign-staging.sh stats <campaignId>
#   scripts/e2e-campaign-staging.sh monitor <campaignId> [intervalSec]
#   scripts/e2e-campaign-staging.sh tail              Tail worker logs (campaign-send only)
#   scripts/e2e-campaign-staging.sh send <campaignId> Prints a DevTools snippet
#   scripts/e2e-campaign-staging.sh cleanup           Removes all e2e-campaign-* rows
#   scripts/e2e-campaign-staging.sh help
#
# Requires: wrangler installed (project-local at node_modules/.bin/wrangler),
# the user's wrangler login wired to the Cloudflare account that owns the
# `claudecommunity-db` D1 instance.

set -euo pipefail

WRANGLER="${WRANGLER:-./node_modules/.bin/wrangler}"
ENV="staging"
DB="DB"
STAGING_URL="${STAGING_URL:-https://staging.claudecommunity.com.au}"

# All seeded rows share this prefix so cleanup is exact-match deletable.
PREFIX="e2e-campaign-"

# ── Helpers ───────────────────────────────────────────────────────────────

die() {
  echo "error: $*" >&2
  exit 1
}

require_wrangler() {
  # Honour absolute paths + commands on PATH; only check for executability
  # when WRANGLER is a relative path that obviously points at a file.
  if [[ "$WRANGLER" == */* ]] && [ ! -x "$WRANGLER" ]; then
    die "wrangler not found at $WRANGLER — run \`bun install\` first, or set WRANGLER=<path>"
  fi
}

# Run a D1 SQL command remotely on staging.
d1_exec() {
  local sql="$1"
  "$WRANGLER" d1 execute "$DB" --remote --env "$ENV" --command "$sql"
}

# Run a D1 SQL file remotely on staging.
d1_file() {
  local file="$1"
  "$WRANGLER" d1 execute "$DB" --remote --env "$ENV" --file "$file"
}

# Run a D1 SQL command + return JSON.
d1_json() {
  local sql="$1"
  "$WRANGLER" d1 execute "$DB" --remote --env "$ENV" --json --command "$sql"
}

# ── seed ──────────────────────────────────────────────────────────────────

cmd_seed() {
  require_wrangler
  local count="${1:-250}"
  if ! [[ "$count" =~ ^[0-9]+$ ]] || [ "$count" -lt 1 ] || [ "$count" -gt 5000 ]; then
    die "count must be an integer 1..5000 (got '$count')"
  fi

  local run_id
  run_id="$(date -u +%Y%m%dT%H%M%SZ)"
  local tag_id="${PREFIX}tag-${run_id}"
  local tag_name="e2e-campaign ${run_id}"
  local campaign_id="${PREFIX}campaign-${run_id}"
  local campaign_name="E2E test ${run_id}"
  local segment_query
  segment_query="$(printf '{"tagIds":["%s"]}' "$tag_id")"

  echo "[seed] runId=${run_id} count=${count}"
  echo "[seed] writing temp SQL file..."

  # Build the SQL in a temp file rather than as a giant --command — D1's CLI
  # has length limits on inline commands and 250 INSERTs blow past them.
  local sql_file
  sql_file="$(mktemp -t e2e-campaign-seed-XXXXXX.sql)"

  {
    echo "-- e2e-campaign seed runId=${run_id}"
    # No explicit BEGIN/COMMIT: D1 rejects raw transaction-control SQL
    # ("use state.storage.transaction() instead of BEGIN TRANSACTION/SAVEPOINT").
    # `wrangler d1 execute --file` already applies the file as one atomic batch.

    # Tag
    printf 'INSERT INTO "UserTag" ("id","name","category","createdAt") VALUES (%s,%s,%s,CURRENT_TIMESTAMP);\n' \
      "$(sql_quote "$tag_id")" \
      "$(sql_quote "$tag_name")" \
      "$(sql_quote "e2e-test")"

    # Users + assignments. Mix of simulator addresses so we exercise:
    #   - sent path (delivered@)
    #   - bounce webhook → suppression list (bounced@)
    #   - complaint webhook → suppression list (complained@)
    # Ratio: 80% delivered, 10% bounced, 10% complained.
    for ((n = 1; n <= count; n++)); do
      local n_padded
      n_padded="$(printf '%04d' "$n")"
      local user_id="${PREFIX}user-${run_id}-${n_padded}"
      local clerk_id="${PREFIX}clerk-${run_id}-${n_padded}"
      local kind
      if   (( n % 10 == 0 )); then kind="bounced"
      elif (( n % 10 == 5 )); then kind="complained"
      else                         kind="delivered"
      fi
      local email="${kind}+e2e${run_id}-${n_padded}@resend.dev"
      local name="E2E ${run_id} #${n_padded}"

      printf 'INSERT INTO "User" ("id","clerkId","name","email","role","lastSeen","isOnline","isOnboarded","isBanned","points","level","createdAt","updatedAt") VALUES (%s,%s,%s,%s,%s,CURRENT_TIMESTAMP,0,1,0,0,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);\n' \
        "$(sql_quote "$user_id")" \
        "$(sql_quote "$clerk_id")" \
        "$(sql_quote "$name")" \
        "$(sql_quote "$email")" \
        "$(sql_quote "member")"

      printf 'INSERT INTO "UserTagAssignment" ("id","userId","tagId","createdAt") VALUES (%s,%s,%s,CURRENT_TIMESTAMP);\n' \
        "$(sql_quote "${PREFIX}assign-${run_id}-${n_padded}")" \
        "$(sql_quote "$user_id")" \
        "$(sql_quote "$tag_id")"
    done

    # Draft campaign targeting the tag.
    local campaign_html
    campaign_html="$(campaign_html_body "$run_id" "$count")"

    printf 'INSERT INTO "EmailCampaign" ("id","name","subject","html","templateType","status","segmentQuery","recipientCount","sentCount","failedCount","openCount","clickCount","bounceCount","unsubscribeCount","createdAt","updatedAt") VALUES (%s,%s,%s,%s,%s,%s,%s,0,0,0,0,0,0,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);\n' \
      "$(sql_quote "$campaign_id")" \
      "$(sql_quote "$campaign_name")" \
      "$(sql_quote "[E2E ${run_id}] CampaignSendWorkflow test (${count} recipients)")" \
      "$(sql_quote "$campaign_html")" \
      "$(sql_quote "custom")" \
      "$(sql_quote "draft")" \
      "$(sql_quote "$segment_query")"
  } > "$sql_file"

  echo "[seed] applying to D1 (--remote --env $ENV)..."
  d1_file "$sql_file"
  rm -f "$sql_file"

  cat <<EOF

[seed] done.

  runId         = ${run_id}
  tag           = ${tag_name}  (id: ${tag_id})
  recipients    = ${count}    (80% delivered, 10% bounced, 10% complained)
  campaignId    = ${campaign_id}

Next steps:
  1) In one terminal: tail logs
       $(printf '%s tail' "$0")
  2) Trigger the send (either click Send in /admin/email/campaigns/${campaign_id}/edit
     while signed in as an admin, OR paste the DevTools snippet from
       $(printf '%s send %s' "$0" "$campaign_id")
  3) In another terminal: watch counters
       $(printf '%s monitor %s' "$0" "$campaign_id")
  4) When done:
       $(printf '%s cleanup' "$0")
EOF
}

# Minimal SQL string-quote: wraps in '...' and doubles internal single quotes.
sql_quote() {
  local s="$1"
  printf "'%s'" "${s//\'/\'\'}"
}

# HTML body that exercises {{name}} replacement so we can sanity-check the
# personalisation pipeline. Kept simple on purpose.
campaign_html_body() {
  local run_id="$1"
  local count="$2"
  cat <<HTML
<div style="font-family: -apple-system, sans-serif; max-width: 560px;">
  <h2>End-to-end test (runId ${run_id})</h2>
  <p>Hi {{name}},</p>
  <p>This is an automated test of <code>CampaignSendWorkflow</code> on staging.
     It went out to ${count} simulator recipients on <code>@resend.dev</code>;
     no real inboxes were touched.</p>
  <p>If you can read this in the Resend dashboard, the full pipeline
     (segment resolution → batch send → idempotency keys → permissive
     validation → EmailSend reconciliation) is working.</p>
  <p style="color: #666; font-size: 12px;">{{email}}</p>
</div>
HTML
}

# ── send (instructions) ───────────────────────────────────────────────────

cmd_send() {
  local campaign_id="${1:-}"
  if [ -z "$campaign_id" ]; then die "usage: $0 send <campaignId>"; fi
  cat <<EOF
Send the campaign by either:

  (a) Browser: open ${STAGING_URL}/admin/email while signed in as admin,
      find the "${campaign_id}" row and click Send.

  (b) DevTools console (faster): open ${STAGING_URL} signed in as admin,
      then paste:

          fetch('/api/admin/email/campaigns/${campaign_id}/send', { method: 'POST' })
            .then(r => r.json())
            .then(console.log)

      The response includes the workflowId you'll see in logs.

After triggering, run:
    $0 monitor ${campaign_id}
EOF
}

# ── stats ────────────────────────────────────────────────────────────────

cmd_stats() {
  require_wrangler
  local campaign_id="${1:-}"
  if [ -z "$campaign_id" ]; then die "usage: $0 stats <campaignId>"; fi

  echo "── EmailCampaign ────────────────────────────────────────────────"
  d1_exec "SELECT id, status, recipientCount, sentCount, failedCount, bounceCount, unsubscribeCount, sentAt FROM \"EmailCampaign\" WHERE id = $(sql_quote "$campaign_id");"

  echo
  echo "── EmailSend status breakdown ───────────────────────────────────"
  d1_exec "SELECT status, COUNT(*) AS n FROM \"EmailSend\" WHERE campaignId = $(sql_quote "$campaign_id") GROUP BY status ORDER BY n DESC;"

  echo
  echo "── Suppression-list additions from this run ─────────────────────"
  # Best-effort — only rows added via webhook after this campaign started.
  d1_exec "SELECT reason, COUNT(*) AS n FROM \"EmailSuppressionList\" WHERE email LIKE 'bounced+e2e%@resend.dev' OR email LIKE 'complained+e2e%@resend.dev' GROUP BY reason ORDER BY n DESC;"
}

# ── monitor ──────────────────────────────────────────────────────────────

cmd_monitor() {
  require_wrangler
  local campaign_id="${1:-}"
  local interval="${2:-5}"
  if [ -z "$campaign_id" ]; then die "usage: $0 monitor <campaignId> [intervalSec]"; fi
  if ! [[ "$interval" =~ ^[0-9]+$ ]] || [ "$interval" -lt 2 ]; then
    die "intervalSec must be an integer ≥ 2"
  fi

  echo "[monitor] polling every ${interval}s — Ctrl-C to exit"
  echo
  local tick=0
  while true; do
    tick=$((tick + 1))
    echo "── tick ${tick}  $(date -u +%H:%M:%SZ) ────────────────────────"
    cmd_stats "$campaign_id" || true
    echo
    # Detect terminal state and exit naturally.
    local terminal
    terminal="$(d1_json "SELECT status FROM \"EmailCampaign\" WHERE id = $(sql_quote "$campaign_id");" \
      | grep -oE '"status":"[^"]+"' | head -1 | cut -d'"' -f4 || true)"
    if [ "$terminal" = "sent" ] || [ "$terminal" = "errored" ]; then
      echo "[monitor] campaign reached terminal status=${terminal}"
      break
    fi
    sleep "$interval"
  done
}

# ── tail logs ────────────────────────────────────────────────────────────

cmd_tail() {
  require_wrangler
  echo "[tail] streaming staging worker logs filtered to [campaign-send]"
  # `--format pretty` is human-readable; pipe through grep so other workers
  # (slide-export, publish-post) don't drown out our signal.
  "$WRANGLER" tail --env "$ENV" --format pretty 2>&1 | grep --line-buffered "\[campaign-send\]"
}

# ── cleanup ──────────────────────────────────────────────────────────────

cmd_cleanup() {
  require_wrangler
  echo "[cleanup] removing all e2e-campaign-* rows from staging D1..."
  # Order matters when FK cascades aren't reliable; do EmailSend first
  # explicitly even though Campaign + User cascades would handle it, so
  # we get accurate row counts back from each delete.
  d1_exec "DELETE FROM \"EmailSend\"          WHERE campaignId LIKE 'e2e-campaign-%' OR userId LIKE 'e2e-campaign-%';"
  d1_exec "DELETE FROM \"UserTagAssignment\"  WHERE id         LIKE 'e2e-campaign-%' OR userId LIKE 'e2e-campaign-%' OR tagId LIKE 'e2e-campaign-%';"
  d1_exec "DELETE FROM \"EmailCampaign\"      WHERE id         LIKE 'e2e-campaign-%';"
  d1_exec "DELETE FROM \"UserTag\"            WHERE id         LIKE 'e2e-campaign-%';"
  d1_exec "DELETE FROM \"User\"               WHERE id         LIKE 'e2e-campaign-%';"
  # Suppression entries created by webhooks during the test — keyed by
  # email, not id. Match the e2e prefix in the email local-part.
  d1_exec "DELETE FROM \"EmailSuppressionList\" WHERE email LIKE 'bounced+e2e%@resend.dev' OR email LIKE 'complained+e2e%@resend.dev';"
  echo "[cleanup] done."
}

# ── help ─────────────────────────────────────────────────────────────────

cmd_help() {
  sed -n '2,24p' "$0" | sed 's/^# \?//'
}

# ── dispatch ─────────────────────────────────────────────────────────────

cmd="${1:-help}"
shift || true
case "$cmd" in
  seed)    cmd_seed    "$@" ;;
  send)    cmd_send    "$@" ;;
  stats)   cmd_stats   "$@" ;;
  monitor) cmd_monitor "$@" ;;
  tail)    cmd_tail    "$@" ;;
  cleanup) cmd_cleanup "$@" ;;
  help|-h|--help) cmd_help ;;
  *) die "unknown command: $cmd  (try \`$0 help\`)" ;;
esac
