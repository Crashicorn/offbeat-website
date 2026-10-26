# Controller selection-path redesign — visual verification

This is new work against checkpoint `2e3eb76` (not inherited Rig Studio, Mix Lab, guide-library, or navigation work).

## Evidence

- `before/controllers-1440.png` and `before/controllers-390.png` render the checkpoint HTML at matching desktop/mobile widths. The Wikimedia hero fails in the sandbox and the page falls back to a schematic with a “photo could not be loaded” caption.
- `after/controllers-1440.png` and `after/controllers-390.png` show the locally served DDJ-FLX4 Commons photograph and the shorter, shortlist-directed hero.
- `after/shortlist-1440.png` and `after/shortlist-390.png` show the five workflow-first picks and direct links to the detailed verdicts. A native disclosure keeps the full five-row specification comparison available without forcing it into the initial scan.

## Browser checks

- Rendered at 1440 px and 390 px; document width matched each viewport, with no horizontal overflow or page errors.
- The hero photo loaded locally at 1920 × 1080. Its source and CC BY-SA 4.0 credit remain visible.
- All five shortlist cards resolve to five individual pick sections. The spec disclosure opens and contains all five models.
- The hub and FLX4 review hero CTAs both land on the shortlist; card links land on the corresponding verdict.
- The Roland DJ-707M has no verified local product photo in the catalog. Its standalone section instead uses an explicitly labeled, published-spec workflow sketch (dual-USB handoff and Main/Booth/Zone outputs); it is not presented as product photography.
