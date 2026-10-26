# DDJ-400 vs DDJ-FLX4 comparison refresh — 26 October 2026

The inherited comparison used unsupported per-category `/10` scores and contained a false claim that the DDJ-FLX4 added four-channel support. The replacement compares the archived DDJ-400 and current DDJ-FLX4 using vendor-published facts, makes their shared two-channel / built-in-audio-interface / RCA-master foundations explicit, and routes current buyers into software compatibility and Rig Studio.

## Before / after screenshots

The before images are rendered from branch commit `6fcee3e` (the speaker-discovery milestone, before this refresh). The after set is from the current working tree.

- `before-flx4-comparison-desktop.png`
- `before-flx4-comparison-mobile.png`
- `after-flx4-comparison-desktop.png` — new decision panel and start of the paired factual cards.
- `after-flx4-comparison-facts-desktop.png` — two-model facts, source caveat, and comparison table.
- `after-flx4-comparison-mobile.png` — stacked quick decision and model cards at 390 px.

The cyan marks in the model cards are equal-length decorative separators. They encode no score or measurement.

## Manufacturer/source findings reflected in the page

- Pioneer/AlphaTheta's current DDJ-FLX4 page identifies it as a two-channel model, lists rekordbox, Serato DJ Lite, Traktor Play and djay, and describes USB-C, RCA master output, built-in audio interface, Smart Fader and Smart CFX. Its US page listed about $329 on the check date.
- Pioneer/AlphaTheta's archived DDJ-400 page documents its two-channel layout, built-in sound card, USB Type-B, RCA master and djay support. Pioneer specifications list 132 mm jogs.
- Serato's DDJ-FLX4 hardware page lists 5-inch capacitive-touch jogs.
- Native Instruments' [controller setup guide](https://support.native-instruments.com/support/solutions/articles/69000879434-traktor-controller-setup-guide) lists the FLX4 as a third-party plug-and-play controller for Traktor; its [release notes](https://support.native-instruments.com/support/solutions/articles/69000879414-what-s-new-in-traktor-pro-play-4-5) say Traktor Pro 4.4.0 added FLX4 plug-and-play support. The separate [Traktor Play setup article](https://support.native-instruments.com/support/solutions/articles/69000879384-how-to-set-up-3rd-party-controllers-with-traktor-play) calls Play the streamlined tier, offers FLX4 owners a free copy, and says Pro 4 is fully compatible. Traktor Pro is supported separately; it is not the FLX4's included Play license. NI notes that Traktor Pro microphone input may require manual routing.
- AlphaTheta's DDJ-400 support article says the archived DDJ-400 is not compatible with Serato, while Serato also hosts a DDJ-400 hardware page. The public vendor sources conflict; the page reports that uncertainty instead of promising compatibility.
- The matrix now has separate Traktor Play and Traktor Pro filters/statuses for the FLX4; the Pro filter reflects Native Instruments' documented support.

## Verification

- `python3 tools/check_site.py` — 118 pages, no problems.
- `python3 tests/check_site_structure.py` — 118/118 pages passed.
- `node --check assets/matrix-tool.js` and syntax checks for the added browser tests — clean.
- `tests/test_flx4_verdict.js` — factual verdict, official source links, exact FLX4 Rig Studio handoff, mobile fit.
- `tests/test_flx4_comparison.js` — shared and changed facts, the DDJ-400 Serato source conflict, no product ratings, exact Rig Studio handoff, mobile fit.
- `tests/test_controller_matrix.js` — FLX4 app tiers, separate Traktor Play/Pro filtering and comparison.
- All three browser tests report no page-script errors. In this sandbox the externally hosted Wikimedia DDJ-400 hero image cannot be fetched; its existing `onerror` handler loads the local editorial fallback and changes the alt text/caption to identify it as illustrative. The test verifies that fallback is labeled honestly.
- The mobile document width remains 390 px at a 390 px viewport; comparison-table scrolling stays inside its wrapper.
