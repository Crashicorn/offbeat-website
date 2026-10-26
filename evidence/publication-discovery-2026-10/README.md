# Publication discovery and article evidence

Browser screenshots captured against the local static site on 25 October 2026. Fold images show the initial viewport; full-page images are labeled `full`. Browser: local Chromium/Playwright at desktop 1440px and mobile 390px. These are visual review artifacts, not deployment captures.

## Discovery library

- `all-guides-desktop-fold.png`, `all-guides-mobile-fold.png` — initial desktop/mobile presentation.
- `all-guides-desktop.png`, `all-guides-mobile.png` — full library, including filters, topic paths, and footer.

## Editorial journeys and product examples

- `career-desktop-fold.png`, `career-mobile-fold.png` — revised beginner-to-career roadmap.
- `gigs-desktop-fold.png`, `gigs-mobile-fold.png`, `gigs-desktop-full.png`, `gigs-mobile-full.png` — new booking guide, from route selection and pitch example to agreement checklist and next steps.
- `software-desktop-fold.png`, `software-mobile-fold.png` — workflow-based DJ software comparison.
- `controllers-desktop-fold.png`, `controllers-mobile-fold.png`, `controllers-product-section.png` — controller guide and catalog-matched illustration, visibly labeled as an illustration; the TOC now includes recommendation badges with spacing.
- `headphones-desktop-fold.png`, `headphones-mobile-fold.png`, `headphones-product-section.png` — headphone guide and illustration section.

## Interaction and responsive checks

- All Guides: 111 cards; Gear filter returns 63; `FLX4` search returns 8; mobile menu exposes seven links.
- Checked query/filter/sort/clear/empty-state and global search behavior in the earlier discovery round.
- Career and gigs pages: all local `#fragment` links resolve; the "Make a plan" CTA reaches `#booking-plan`; all JSON-LD blocks parse.
- Controller table: recommendation badges appear in generated TOC as `Pioneer DDJ-FLX4 — Best Overall` (rather than concatenated text).
- At a 390px viewport, the library, career, gigs, software, controller and headphone pages had no horizontal overflow.
- Local network restrictions blocked the credited Wikimedia Commons controller photograph during this test; the guide's `onerror` fallback rendered the exact catalog-matched FLX4 schematic and says so in its caption. The original photo link and attribution remain.
