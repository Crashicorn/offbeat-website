# Publication readiness — Offbeat Arena dev candidate

_Status at 2026-10-26 · branch `arena/7c2cadef-offbeat-website` · PR #5
(base: `arena/cde31182-offbeat-website`, the PR #4 head)._

**State of this branch: development-complete, not accepted, not deployed.**
Nothing here touches offbeatinc.com. Merging PRs and any DNS/hosting change
remain owner actions; this document is the evidence pack for that decision.

---

## What this campaign changed (vs PR #4 head `efa5732`)

| Commit | Change |
| --- | --- |
| `1393154` | Product media rolled out to 17 equipment guides: 21 new model-accurate technical drawings (55 total), renderer hardening (word-boundary model matching, banner/slot/duo placements, Rig Studio caption links), two pre-existing layout breaks repaired (crushed lists in the under-$500 guide, letterboxed tall mixer drawings). |
| `6080f7b` | All 8 hardware reviews open with their actual model (labelled technical illustration); the FLX4 review keeps its verified Commons photo. |
| `23a0b8d` | Buyer-truth repair of `best-dj-controllers-under-500-2026.html`: fabricated “2026 Tested Review ★★★★★ 4.2/5” block removed; Rane One reframed as an honestly labelled over-budget stretch (verified against rane.com); DDJ-FLX6-GT spec claims corrected (verified against pioneerdj.com); table, FAQ, meta and JSON-LD made consistent; buy button no longer points at the wrong product. Bylines normalised (see owner decisions). |
| `ed1ff9c` | Hero photography redistributed (worst repeat 20 → 14 pages; previously unused `mobile-dj-hero.jpg` in service); hero alt text and dimensions canonicalised per photograph; Pexels attribution follows its photo. Enforced by `tools/hero_assignments.py`. |
| `3886ce7` | Six editorial diagrams repaletted to the site scheme and placed where they teach (phrase counting, EQ, phase, track structure, signal chain, budget split). Budget figures retuned to the host article's own allocation bands. |
| `076f78b` | Four orphan pages (zero inbound links) adopted into topical related-guides lists; standard buy rows added to the FLX2, GRV6, Prime GO and Numark Scratch reviews (were dead ends — no retailer path); `tests/test_journeys.js` added. |
| `7e4ebde` | Trust sweep: privacy Consent-Mode passage in reader voice; Rig Studio “29 components” corrected to the 31 in its catalog; mixers banner no longer contradicts the page's own three-path verdict; curated search index patched for the repaired guide. |

## Verification performed (all green at `7e4ebde`)

- `tools/check_site.py` — 118 pages, no problems.
- `tests/check_site_structure.py` — 118/118.
- `tests/test_rig_studio.js`, `test_mixlab.js`, `test_controller_matrix.js`,
  `test_speaker_finder.js`, `test_flx4_comparison.js`, `test_flx4_verdict.js` — pass.
- `tests/test_journeys.js` — 6/6 end-to-end journeys with real clicks, 0 page
  errors: beginner first-controller purchase into Rig Studio; upgrader via the
  under-$1,000 guide; software comparer driving the live matrix filter
  (13 → 6 cards); Mix Lab learner starting decks and switching lessons;
  wedding-gig reader reaching onward planning links; Spotlight Search `/`
  → “flx4 review” → review.
- Rendered audits across all 118 pages (desktop + mobile): no overflow, no
  broken images, no console errors. Representative stills in
  `evidence/publication-completion-2026-10/`.

## Area assessment

| Area | Verdict | Notes |
| --- | --- | --- |
| Guide library & navigation | **READY** | No orphan pages except 404 (by design); hubs, TOC, related lists consistent. |
| Equipment-guide product media | **READY** | Every named pick shows its model as a labelled drawing or licensed photo; nothing AI-generated is passed off as photography. |
| Hardware reviews | **READY** | Model-accurate heroes; verdict sections end with a buy row; Rig Studio handoffs for all catalog models. |
| Interactive tools (Rig Studio, Mix Lab, matrix, speaker finder, search) | **READY** | Dedicated suites + journey tests pass; `?add=` handoffs verified in-browser. |
| Trust signals (disclosures, dated prices, no invented scores) | **READY** | The one fabricated score block found sitewide was removed; spec claims on the worst page re-verified against manufacturer pages. |
| Privacy & consent | **READY** | Behaviour unchanged (consent-gated GA4); copy simplified without dropping facts. |
| Review copy tone | **NEEDS WORK** | “Review positioning” sections on the FLX2 and GRV6 reviews read like internal editorial notes (e.g. “keeps it from competing with larger controller pages”). Rewrite or cut before launch. |
| Photography depth | **NEEDS WORK** | 16 editorial photos across ~100 articles; worst share now 14 pages. More licensed photography (esp. desk/software scenes) would lift finish further. |
| Search index tooling | **NEEDS WORK** | `tools/build_index.py` is older than the committed index format (147 curated entries vs 116 regenerated). Warning added to the tool; reconcile before any regeneration. |
| DDJ-400 image hotlink | **NEEDS WORK** | `pioneer-ddj-400-vs-flx4.html` hotlinks upload.wikimedia.org. Localise the file at deploy (could not be downloaded in the dev sandbox) or swap to the existing local DDJ-400 drawing. |
| Launch logistics | **EXTERNAL BLOCKER** | See owner decisions below. |

## Owner decisions required (external blockers)

1. **Byline “Jake Morrison.”** Two pages (`numark-scratch-review.html`,
   `serato-dj-pro-review.html`) were bylined to a named person who appears
   nowhere else on the site and has no bio, while 102 pages use “Offbeat
   Editorial Team.” They were normalised to the team byline. If Jake Morrison
   is a real contributor, restore the name and add a bio/author page;
   otherwise no action.
2. **Affiliate IDs.** 242 Amazon links use `tag=offbeatdj-20` — confirm this
   is the owner's active Associates ID. Three non-Amazon links carry an
   Amazon-style `?tag=offbeat0f-20` (Sweetwater ATH-M20x and DJM-250MK2,
   zZounds DDJ-FLX10) where the parameter is almost certainly inert —
   replace with real programme links or strip. The zZounds CTA on the
   mixers guide (“No credit check · 45-day price guarantee”) repeats retailer
   programme claims that were not re-verified in this campaign.
3. **Analytics property.** Pages reference GA4 `G-9MG87ETLPT`; confirm the
   property and the Enhanced Measurement dashboard state described in
   `privacy.html` at deploy time.
4. **Deployment itself.** `CNAME` points at offbeatinc.com. Cutover (merge
   chain PR #2 → #3 → #4 → #5 as applicable, DNS, hosting) is owner's call;
   this branch alone does not deploy anything.
5. **Price freshness.** Stated figures are dated October 2026 per site
   convention. Set a recheck cadence before launch so “dated snapshot”
   copy stays honest.

## Explicitly deferred / rejected

- **Historical score bars** (referenced commit `70874c6`): examined and
  rejected — restoring rating-bar visuals would pressure the site back
  toward invented scores, which the README forbids.
- **Rane One in the Rig Studio catalog**: kept out until it can be added
  with a verified current price and spec provenance, per catalog rules.
- **Manufacturer product photography**: only two verified Commons photos
  exist in-repo; everything else is a labelled technical drawing. Licensing
  press imagery is a business decision for later, not a launch blocker.
- **`offbeat-analytics.js`** at repo root is a 51-byte dead marker; harmless,
  remove or document at owner's discretion.
