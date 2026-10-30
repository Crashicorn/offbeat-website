# Rig Architect visual comparison

Baseline: commit 41aec875d59fc79a5fe47a24aade9288c4afd1b2. After: equipment-first redesign. Each PNG is a viewport capture at device scale 1 from a fresh Chromium page with the same preset URL, default equipment and ownership, no saved state, and unanswered analytics consent. Bedroom Starter is FLX4 + DM-40D; Mobile Pro is PRIME 4+ + one EON715 (not a two-zone setup). Neither comparison silently changes the preset to make it look better.

- `comparison-before/bedroom-starter-1440.png` and `comparison-after/bedroom-starter-1440.png`
- `comparison-before/mobile-pro-1440.png` and `comparison-after/mobile-pro-1440.png`
- `comparison-before/bedroom-starter-390.png` and `comparison-after/bedroom-starter-390.png`
- `comparison-before/mobile-pro-390.png` and `comparison-after/mobile-pro-390.png`

Inspection: the controller, monitor and PA choices are visible together on desktop instead of being displaced by the PA and cable panels; the component artwork is larger and clickable. At 390px the controller and route summary appear sooner, but the speaker choices and headphones still require scrolling, particularly while consent is unanswered. The desktop consent prompt can overlap the lower-right portion of the canvas. The schematic product illustrations and grouped speaker tiles communicate selection, not a realistic physical booth or the actual direction of each cabinet. Quantities and technical routes remain in the expandable detail view.

Real Chromium interaction is exercised by `tests/rig-visual-interactions.cjs`: add HS5 monitors, reject them as PA picker candidates, swap PA to QSC, mark it owned, change controller to FLX4, inspect the routing limitation, save, and restore the exported share link. Estimated spend changed $3,800 → $2,901 after marking the PA owned; the changed-controller shared rig reloaded at $1,001. This is a functional check, not a substitute for human usability testing.
