# Rig Architect round 7 evidence

Chromium, 1280×800 and 390×844, with consent dismissed before capture. `before-*` is the baseline with the review-head readiness patch applied; `after-*` is this change. `*-first.png` is the initial viewport, `*-expanded.png` is the full page with all three sections open, `*-headphones.png` is the affected card, and `*-selected.png` follows selecting Sony MDR-7506. JSON records the supplied DOM measurement. Reproduce with `CHROME_BIN=<chromium> AUDIT_LABEL=after node tests/rig-floor-audit.cjs` against a server on port 8080 (or `BASE_URL`).

| Width / state | Before page / beyond / visible | After page / beyond / visible |
|---|---|---|
| 1280 first | 0 / 0 / 1 (+56px) | 0 / 0 / 0 |
| 1280 expanded | 0 / 0 / 1 (+56px) | 0 / 0 / 0 |
| 1280 Sony selected | 0 / 0 / 1 (+71px) | 0 / 0 / 0 |
| 390 first, expanded, selected | 0 / 0 / 0 each | 0 / 0 / 0 each |

The first-visit authored example displays `Est. $627 total` and an informational host note, not a compatibility verification. It assumes an already-owned compatible mobile host and calls out USB audio and separately powered 9V/3A supply, not included in the estimate. [Pioneer DJ's DDJ-FLX4 page](https://www.pioneerdj.com/en/product/dj-controllers/ddj-flx4/) describes multi-device support and separate power for smartphone use; it cannot verify any visitor's device, software, power supply or physical connections. The underlying deep checks and `__rigStudio.checks()` still report the host warning; only this untouched first-visit example's display is neutral. Edited, restored, shared and explicitly selected preset rigs show the warning normally. Selecting Sony, reloading the edited rig, opening a shared rig and choosing the preset explicitly were tested at both widths. No claim of host/power/audio verification is made.

The independent speaker cable allocation and conservative host readiness from review commit `36ea42af61b6a78507a55c585f6cf163ce579344` were applied by function rather than merging. The legacy role-journey changes from `03cb048b33fd101c6dedd2cb8115e33cb7ca981f` were mirrored, with explicit default-open assertions and the actual picker button selector. Role journeys cover missing routes and FLX4 output limitations; security tests cover mobile/host warnings and cable quantities. The owner has not accepted this work.
