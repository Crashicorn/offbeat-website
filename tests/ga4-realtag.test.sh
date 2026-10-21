#!/usr/bin/env bash
# Real-Google-tag (gtag.js) consent-mode capture for assets/offbeat-analytics.js (#967).
#
#   Run:  bash tests/ga4-realtag.test.sh
#
# Qualifying real-network suite: loads the ACTUAL Google tag for G-9MG87ETLPT
# (real gtag.js, fetched from Google) in a real headless Chromium per scenario
# with an isolated profile, on real served pages. All outbound requests to
# Google's analytics/ad endpoints are intercepted at the network layer (CDP
# Fetch), captured verbatim, and answered locally (empty 204) so NOTHING
# reaches the GA account, while the real consent-mode engine, real cookie code
# and real minimization paths run on the page.
#
#   T1 no consent  T2 consent+minimization+consent order   T3 reject
#   T4 withdraw -> teardown reload -> zero further egress  T5 persistence
#   T6 outbound link leak-free        T7 history no double view
#   T8 UI/a11y (compact, accessible, honest)
#
# Requires: google-chrome, Node >= 20, outbound HTTPS to
# www.googletagmanager.com (to fetch the real tag).
#
# Exits 0 on all-pass, 1 on any failure.
set -u
cd "$(dirname "$0")/.."
PORT="${PORT:-8236}"
BASE="http://127.0.0.1:$PORT"
SRV=0
cleanup() { [ -n "$SRV" ] && kill "$SRV" 2>/dev/null; }
trap cleanup EXIT

node tests/ga4-server.js "$PORT" >/dev/null 2>&1 &
SRV=$!
up=0
for _ in $(seq 1 80); do
  if curl -sf "$BASE/assets/offbeat-analytics.js" >/dev/null 2>&1; then up=1; break; fi
  sleep 0.1
done
if [ "$up" -ne 1 ]; then echo "FATAL: test server did not come up"; exit 1; fi

if ! command -v google-chrome >/dev/null 2>&1; then echo "FATAL: google-chrome not found"; exit 1; fi
if ! curl -sf -m 20 -o /dev/null "https://www.googletagmanager.com/gtag/js?id=G-9MG87ETLPT"; then
  echo "FATAL: no outbound HTTPS to www.googletagmanager.com (cannot fetch the real Google tag)"; exit 1;
fi

BASE="$BASE" RT_PORT_BASE="${RT_PORT_BASE:-9500}" node tests/ga4-realtag-capture.js
exit $?
