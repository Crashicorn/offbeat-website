# Rig Studio — October 2026 rebuild

This folder is the visual evidence for the rig-planner work on
`arena/b77abbe0-offbeat-website` (branched from `da7b3cf`).

## What changed

The old `build-your-dj-setup.html` mounted `assets/rig-builder.js`: a dashboard
followed by a booth of five fixed cards, then a compatibility panel, a six-column
table and a saved-rigs strip. Everything was visible at once, the page opened with
a rig the visitor never chose, and the "booth" was decorative — the wires between
cards were a static CSS gradient, not a real connection.

The new page mounts `assets/rig-studio.js` + `assets/rig-studio.css` and splits the
journey into stages:

1. **Start** — three named ways in (guided setup, from scratch, build around what
   you own) plus four editable templates.
2. **Signal map** — a real wiring diagram. Wire status is computed from the
   controller's `master_outputs` against each speaker's `inputs`, and each cable
   run is counted, so "one stereo pair = one run, two PA speakers = two runs".
3. **Readiness** — six ordered checks (decks, host, cue, output, cables, media)
   each with a one-click fix instead of a wall of warnings.
4. **Cost** — one panel: full value, what you own, what is actually left to buy.
5. **Gear list** — grouped by role, with quantity steppers and ownership toggles.
6. **Shopping list** — only unowned pieces, with retailer links per line.
7. **Saved builds** — save, reopen, share, delete; comparison of any two builds.

## Gallery

| Before | After |
| --- | --- |
| `before-rig-page.png` — everything at once, fixed default rig | `after-start.png` — a deliberate starting choice |
| — (cables were a static gradient) | `after-deeplink-arrival.png` — arrival from a review with an honest gap count |
| — | `after-guided-result.png` — guided recommendation with reasons and a budget line |
| — (compare was a modal of two text lists) | `after-compare-in-swap-drawer.png` — compare candidate controllers while choosing |
| — | `after-mobile-signal-map.png` — the map reflows into an ordered chain on phones |
| — | `after-details-drawer.png`, `after-add-palette.png` — specs and add-equipment flows |

Screenshots were captured with headless Chromium at 1440×1000 and 390×844.
