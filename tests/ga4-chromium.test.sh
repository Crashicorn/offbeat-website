#!/usr/bin/env bash
# Real-Chromium network/cookie capture for assets/offbeat-analytics.js (GA4, #967).
#
#   Run:  bash tests/ga4-chromium.test.sh
#
# Starts a local static server (tests/ga4-server.js), drives a REAL headless
# Chromium per scenario (isolated profile, synthetic data only) against the
# served GA4 harness, extracts the queued GA command log + real resource/cookie
# state, and asserts the privacy contract (tests/ga4-chromium-capture.js).
#
#   - no consent / reject -> zero Google requests + zero GA cookie
#   - accept -> one minimized pageview (path-only, no referrer, bounded title)
#   - secret ?q=/?email=  -> never in page_location; affiliate_click drops URLs/text
#   - unknown event / nested secret -> dropped (closed allowlist)
#   - history pushState -> no double pageview, no token leak
#   - withdraw -> stops sends + clears first-party _ga + persists denied
#   - desktop + mobile -> accessible choice UI present
#
# Exits 0 on all-pass, 1 on any failure.
set -u
cd "$(dirname "$0")/.."
PORT="${PORT:-8236}"
BASE="http://127.0.0.1:$PORT"
RESULTS="$(mktemp -d)"
SRV=0
cleanup() { [ -n "$SRV" ] && kill "$SRV" 2>/dev/null; rm -rf "$RESULTS"; }
trap cleanup EXIT

# 1) start server
node tests/ga4-server.js "$PORT" >"$RESULTS/server.log" 2>&1 &
SRV=$!
up=0
for _ in $(seq 1 80); do
  if curl -sf "$BASE/assets/offbeat-analytics.js" > /dev/null 2>&1; then up=1; break; fi
  sleep 0.1
done
if [ "$up" -ne 1 ]; then echo "FATAL: test server did not come up"; exit 1; fi

# 2) run each scenario in real headless Chromium (isolated profile)
profile="$(mktemp -d)"
dump() { # name [extraQuery] [w] [h]
  local name="$1"; local extra="${2:-}"; local w="${3:-1280}"; local h="${4:-900}"
  local prof; prof="$(mktemp -d)"
  google-chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars \
    --virtual-time-budget=9000 --window-size="$w,$h" --user-data-dir="$prof" \
    --dump-dom "$BASE/tests/ga4-consent.harness.html?scenario=$name$extra" 2>/dev/null \
    | grep -oE '__RESULT__\{.*\}__RESULT_END__' \
    | sed -E 's/^__RESULT__//; s/__RESULT_END__$//' > "$RESULTS/$name.json"
  rm -rf "$prof"
}
dump "fresh"
dump "reject-click"
dump "accept-click"
dump "preset-granted"
dump "preset-denied"
dump "withdraw"
dump "secret-query" "&q=a%40b.example.test&token=" "secret-token" 2>/dev/null || dump "secret-query"
dump "arbitrary-event"
dump "history"
dump "fresh-mobile" "" 390 844

# 3) assert
node tests/ga4-chromium-capture.js "$RESULTS"
rc=$?
exit "$rc"
