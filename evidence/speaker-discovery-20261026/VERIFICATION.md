# Room-first speaker discovery — 26 October 2026

A substantial redesign of `best-dj-monitor-speakers.html`, replacing the inherited wattage / SPL comparison-table layout with a room-first buyer journey that distinguishes desk monitors, production monitoring, powered PA and a headphones-first budget path.

## Before / after

The before screenshots are rendered from the unmodified `2b6c704` checkpoint. The after screenshots are from the updated page. Both sets use the same headless Chromium viewport and the same scroll position for the first content view.

- `before-speaker-guide-desktop.png` — inherited intro, unsupported Quick Verdict, and generic comparison table.
- `before-speaker-guide-mobile.png` — inherited mobile reading flow.
- `after-speaker-guide-desktop.png` — custom signal-path diagram and the four-choice room finder.
- `after-speaker-guide-mobile.png` — responsive editorial opening and finder.
- `after-speaker-shortlist-desktop.png` — model-specific illustrated cards, factual inputs, trade-offs and selection highlights.
- `after-speaker-shortlist-mobile.png` — single-column product cards on a 390 px viewport.

Product graphics are the repository's labeled technical illustrations, not generated or misrepresented product photographs. The new guide links to the manufacturer sources for the listed specifications and states that its price labels are planning estimates rather than live quotes.

## Verification

- `python3 tools/check_site.py` — 118 pages, clean.
- `python3 tests/check_site_structure.py` — 118/118 pages passed.
- `node --check assets/speaker-finder.js` and `node --check tests/test_speaker_finder.js` — clean.
- `tests/test_speaker_finder.js` in headless Chromium — all four routes, exact model handoff to Rig Studio, mobile layout, zero console errors.
- `tests/test_rig_studio.js` in headless Chromium — all existing Rig Studio checks passed, zero console errors.
- Mobile overflow check — 390 px document width equals 390 px viewport width.
- Deep-link check — the DDJ-FLX4 + DM-40D example opens in Rig Studio with both exact catalog items selected.
