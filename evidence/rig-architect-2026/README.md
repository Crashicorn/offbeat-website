# Rig Architect browser review

Chromium 153, static server, 1440×900 desktop and 390×900 mobile. Images are screenshots of the running page: bedroom starter, monitor picker, and a modified mobile rig with a routing limitation. `mobile-rig` captures the complete booth section rather than the viewport. The gear illustrations are catalog schematics, not product photographs.

Run `tests/rig-architect-journeys.cjs` with `puppeteer-core`, `CHROME_BIN` and a static server (`BASE_URL`, default port 8080). It covers role filtering, an empty search, ownership, quantities, route limitations, save/load, sharing and editing after restore. The three-cabinet scenario checks that two cable packages are required before the route is marked planned.

Limits: estimates are not live prices; retailer stock and checkout quantity must be checked on the retailer site. The canvas is a schematic, not a scale model or live signal meter. Some cable/socket combinations and third or additional speaker routes need manual review. Mobile uses status labels rather than animated canvas wires. Compatibility and individual product facts still need owner/editorial review before release.
