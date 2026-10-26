# DDJ-FLX4 verdict and compatibility refresh — 26 October 2026

The FLX4 review now uses the historical cyan-edged card treatment as a **factual verdict**, not a score. Its fixed cyan ticks are visual dividers, not meters. The card calls out the two-channel limit, RCA master, USB-C, software tiers and exact Rig Studio/software-matrix destinations.

## Before / after screenshots

- `before-flx4-verdict-desktop.png` and `before-flx4-verdict-mobile.png` — existing verdict and separate methodology callout before the redesign.
- `after-flx4-verdict-desktop.png` and `after-flx4-verdict-mobile.png` — source-led verdict card at desktop and 390 px mobile.

## Content changes

- Removed the unsupported `reviewRating` from structured data and aligned the review author type with the visible Offbeat editorial team.
- Corrected the DDJ-400 comparison: both generations have a built-in audio interface and Beat FX controls; those are not FLX4-exclusive upgrades.
- Replaced “best controller” / “largest jogs at the price” assertions and stale subscription prices with conditional buying guidance and verified product facts.
- Added the current Pioneer-listed FLX4 software choices (rekordbox, Serato DJ Lite, Traktor Play and djay), then cross-checked Native Instruments support: FLX4 owners can obtain the free, streamlined Traktor Play tier, while Traktor Pro 4.4.0+ separately provides plug-and-play integration. Pro is not bundled as the Play license; NI flags microphone-routing setup in Traktor Pro.
- Updated the interactive compatibility matrix with separate Traktor Play and Traktor Pro statuses/filters for the FLX4. The DDJ-400 is not represented as a current matrix model; its public Serato sources conflict, and the comparison page discloses that rather than guessing.

## Current software evidence

- [Pioneer / AlphaTheta FLX4 product page](https://www.pioneerdj.com/en/product/dj-controllers/ddj-flx4/) lists rekordbox, Serato DJ Lite, Traktor Play and djay; it says djay Pro is paid.
- [Native Instruments Traktor Play setup](https://support.native-instruments.com/support/solutions/articles/69000879384-how-to-set-up-3rd-party-controllers-with-traktor-play) says FLX4 owners can install a free Play copy and that Traktor Pro 4 is fully compatible.
- [Native Instruments Traktor Pro / Play release notes](https://support.native-instruments.com/support/solutions/articles/69000879414-what-s-new-in-traktor-pro-play-4-5) date FLX4 plug-and-play integration to Traktor Pro 4.4.0 and include current setup caveats, including manual mic input routing.

## Verification

- `tests/test_flx4_verdict.js` — product facts, source links, exact Rig Studio route, mobile fit.
- `tests/test_controller_matrix.js` — separate app-edition filters and comparison rows.
- `tests/test_flx4_comparison.js` — no scores, source caveat, mobile fit, exact Rig Studio route.
- Static HTML and JSON-LD checks pass; the compatibility matrix and Rig Studio report zero page-script errors.
