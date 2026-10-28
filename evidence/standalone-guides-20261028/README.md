# Standalone guide recovery and acceptance — October 28, 2026

Scope: issue https://github.com/CrashyCrash/offbeat-website/issues/1041. Four HTML pages only, plus this evidence and one targeted browser test. No advisor, shared equipment data, Rig Studio, global styling, production, merge or deployment changes.

## Recovered state

`/tmp/opencode/offbeat-mission-b` existed on `rescue/standalone-buying-guides-20261027`, HEAD `f580788397fc5836ffcb026cc7c0e0f74d7170c6`. GitHub's cumulative `Crashicorn/offbeat-website:arena/849667ed-offbeat-website` matched that SHA at discovery. Only `denon-sc6000-review.html` was dirty (12 insertions / 12 deletions in line-oriented diff); staged diff empty, other three target pages unchanged. No Mission B commit or delivery was claimed.

Before edits, status and binary patches were saved outside temporary storage at `/home/igpu/offbeat-recovery-20261028/`. Original unstaged patch SHA-256: `4727622f4eade3ae82af3d5247b4e0edc577a9d1471c96232423bb2126db221c`. The rescue branch reference was preserved; continuation uses `fix/standalone-guide-recovery-20261028`.

The durable interruption record was read: https://github.com/CrashyCrash/Forgotten-Value/blob/main/projects/offbeat-website/evidence/OFFBEAT-2026-10-28-OPENCODE-INTERRUPTION-AND-RECOVERY.md . Its transcript-derived plans are distinguished from the actual surviving diff: no all-in-one SC6000 or 12.1-inch SC6000M claim was found in that diff. Those erroneous plans were not adopted. The full owner-uploaded transcript was not available as an attached file in this recovery turn.

Useful Qwen edits included removal of invented skip/latency/price claims and some output corrections. They were incomplete: wrong key specs and FAQs remained. Its removal of SC6000 Wi-Fi and Ethernet-only comparison was rejected; Denon confirms Wi-Fi. Its fader-start/generalized ecosystem superiority claims were not retained. The completed guide removes unsupported Traktor compatibility, invented sound/performance/learning-time claims, conflicting undated prices and erroneous weight/output/service details.

Mission A PR #12 was read-only checked at `5ec3095db5ef539bcf39bea1593e8fae9f3bcd5e`, OPEN. No changes to that branch. GPU power limit read 490 W; no GPU settings or existing services/processes were changed. A separate loopback-only static preview was started on port 8973 for these checks.

## Manufacturer evidence

Direct source links are included beside the revised buying guidance on each page:

- [Denon SC6000](https://www.denondj.com/sc6000-prime.html) and [SC6000M](https://www.denondj.com/sc6000m-prime.html): player category, outputs/media, both 10.1-inch displays, motorized M platter. Current SC6000 page weight 5.8 kg / 12.76 lb; older manual discrepancy explicitly noted rather than presented as a measurement.
- [Serato SC6000 listing](https://serato.com/dj/hardware/denon-dj-sc6000-prime): Official Accessory, distinct from a primary hardware unlock.
- [Original GO](https://www.denondj.com/prime-go.html), [GO+ FAQ](https://support.enginedj.com/support/solutions/articles/69000860918-denon-dj-prime-go-frequently-asked-questions), [Engine service matrix](https://enginedj.com/streaming): generation-specific services, Ethernet removal, firmware baseline and manufacturer-rated battery comparison.
- [XDJ-AZ](https://alphatheta.com/en/product/all-in-one-dj-system/xdj-az/black/), [firmware history](https://downloads.support.alphatheta.com/firmwares/all-in-one-dj-systems/XDJ-AZ/XDJ-AZ-Firmware-Change-History-Ver130-EN.pdf), [PRIME 4+](https://www.denondj.com/prime-4-plus.html) and [its I/O/recording FAQ](https://support.denondj.com/en/support/solutions/articles/69000838474-denon-dj-prime-4-frequently-asked-questions): standalone subscriptions versus laptop unlocks, local recording, routing and media. PRIME 4+ booth is XLR, AZ booth is TRS. PRIME 4+ two microphone inputs are corroborated by the detailed FAQ; product-page summary fields are inconsistent.
- [OMNIS-DUO](https://alphatheta.com/en/product/all-in-one-dj-system/omnis-duo/indigo/), [Mixstream Pro Go](https://www.numark.com/product/mixstream-pro-go), [SC LIVE 4](https://www.denondj.com/sclive4): buying-table channels, storage, connections and power. Mixstream has balanced XLR mains; no dedicated booth output.

Uncertainty retained: AZ product page lists Spotify, while [AlphaTheta's AN/AZ comparison](https://alphatheta.com/en/product/all-in-one-dj-system/xdj-an/black/) omits it for AZ and linked 1.30 history establishes no Spotify minimum. Readers are told to confirm with AlphaTheta before buying for Spotify. No unsupported discontinuation status, exact market prices, guaranteed runtime, original-GO Apple/Amazon support, or standalone Spotify on Engine hardware is asserted. Recording is not promised across every model/service. No new OMNIS-DUO artwork was added; this delivery is confined to factual buying guidance and existing illustrations/styles.

## Chromium acceptance

`tests/standalone-guides-chromium.cjs` ran against the final HTML on loopback in Chrome for Testing 149.0.7827.55. `chromium-results.json` records all eight page/viewport combinations: all four pages at 390×1000 and 1440×1000. HTTP 200 throughout; no page overflow, broken images, failed HTTP responses, JS exceptions or console errors. All local main-content link targets exist. Visible FAQ questions/answers equal parsed FAQ JSON-LD on every page; every FAQ toggles by keyboard. Targeted model/license/port assertions pass.

The runner explicitly loads lazy images before evaluating them. Initial harness issues (collapsed FAQ `innerText`, testing an already-open details element, and checking lazy images before loading) were corrected in the harness; these were not hidden page failures.

Full-page screenshots for all eight combinations and desktop/mobile comparison-table screenshots are preserved locally under `/home/igpu/offbeat-recovery-20261028/browser/`. Table viewports were visually inspected: existing charcoal/violet/cyan styling retained; desktop table fits and mobile table is contained in a labelled, keyboard-focusable horizontal scroll region.

Replay using existing local dependencies (no installation):

```sh
python3 -m http.server 8973 --bind 127.0.0.1
PUPPETEER_MODULE=/tmp/browser/node_modules/puppeteer-core \
BROWSER_EXECUTABLE=/home/igpu/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome \
node tests/standalone-guides-chromium.cjs
```

No owner factual decision is required to review this PR. Editorial acceptance and any later merge/release remain owner decisions. Manufacturer Spotify ambiguity remains explicitly qualified; it is not a request for the owner to decide a technical fact.
