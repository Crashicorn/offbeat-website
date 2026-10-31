# Sitewide publication pass — 2026-10-30

Branch `arena/110caa00-offbeat-website`, cut from the PR #14 head
`82e45f9` (`arena/4eafba31-offbeat-website`). Scope: everything on the
Offbeat site **except** the Rig Architect — `build-your-dj-setup.html`,
`assets/rig-builder.js`, `assets/rig-studio.css`, `assets/dj-gear-catalog.json`
and the Rig evidence were not touched.

Every claim below was checked in a real headless Chromium against a local
static server, at 1440 px and 390 px.

---

## 1. The header's "Tools" link went nowhere on 112 pages

**Before:** the primary navigation pointed `Tools` at
`all-dj-guides.html#tools`. No page on the site contains `id="tools"`, so the
header link was a no-op that dropped the reader at the top of the library.
Two other pages shipped a different six- or nine-item menu again.

**After:** one canonical seven-item nav on all 119 pages, written by
`tools/unify_nav.py` (idempotent, `--check` mode for CI). `Tools` now opens a
real page.

| | |
| --- | --- |
| before | `nav` variants: 3 (112 / 5 / 1 pages) |
| after | `nav` variants: 1 (119 pages) |
| evidence | `01-home-hero-before.jpg` / `-after.jpg` |

## 2. New tools hub (`dj-tools.html`)

The site's seven interactive tools were only findable by scrolling: two were
on the homepage, five were buried inside guides. There is now one page that
says what each tool does, what it needs, how long it takes, what its limit is,
and which guide explains it.

The screenshots are real captures of the running tools, not stock imagery —
`assets/img/tools/*.jpg`.

| | |
| --- | --- |
| before | no tools index; the header link was broken |
| after | `dj-tools.html` + a tools band on the library page |
| evidence | `08-tools-hub-after.jpg`, `09-tools-hub-rows-after.jpg`, `03-library-tools-*.jpg` |

## 3. A promised tool that did not exist

`best-dj-monitor-speakers.html` (three links) and `best-dj-turntables-2026.html`
(one link) both sent readers to `best-dj-headphones-2026.html#headphone-fit`
with copy promising a "headphone fit finder". The anchor, the section, and the
`headphone-fit.js` mount were all gone; only the stylesheet and script were
still in the repo, which is why `tests/test_headphone_fit.js` kept passing — it
tests the script against a fake DOM, not the page.

The section is restored with three use cases, three verdicts that link to the
full reviews below, and a no-JavaScript fallback line.

| | |
| --- | --- |
| before | 4 deep links landed on the top of the page; no finder |
| after | panel present, choices switch verdicts, `#pick-hd-25` / `#pick-mdr-7506` / `#pick-hdj-x10` resolve |
| evidence | `05-headphone-fit-before.jpg` (the gap) / `-after.jpg` |
| test | `tests/test_headphone_fit_page.js` — fails on `82e45f9`, passes here |

## 4. Homepage trust and layout defects

| Defect | Correction |
| --- | --- |
| "See all **118** guides" while the library said 115 and About said 116. | All three now say 115, which is what `tools/build_index.py` counts. |
| "kept current with October 2026 pricing, **genuine hardware tests**, and zero sponsored rankings" | The site does no hands-on testing — `editorial-standards.html` says so explicitly. Rewritten to "specifications read from manufacturer documentation, prices checked against retailer listings in October 2026". |
| "**Field Tested** · Headphones" kicker on the headphone story card | "Buying guide · Headphones". |
| Lead feature "evaluated on **physical jog feel**" | "compared on documented jog and platter hardware, the licence each one unlocks…". |
| "Top pick: Pioneer DDJ-FLX4 (**$299**)" | "about $329", matching the controller guide and the review. |
| "**Two** browser tools" (there are seven) | "Browser tools that solve real DJ problems" + a link to all seven. |
| Rig presets quoted as "Bedroom Starter ($597) to Standalone Mobile ($3,052)" from the homepage | Removed. Those totals are owned by the rig catalogue and go stale whenever it changes. |
| Four "start here" cards, four budget tiers and four setup tiles each rendered as **three plus an orphan** at 1440 px | Balanced 2×2 grids. |
| Hero metadata separators were flex pseudo-elements that could wrap the dot onto its own line | Text separators that wrap with their label. |

Evidence: `01-home-hero-*`, `02-home-paths-*`, `06-mobile-home-*`.

## 5. Buyer misinformation repaired (highest-traffic pages first)

### `best-budget-dj-equipment.html` — linked from the homepage

* **"The Pioneer DJ DDJ-FLX4 remains the gold standard… immense community
  support and high resale value… integrates perfectly"** — replaced with the
  figures the controller guide already uses: about $329 (some listings $399
  MSRP), two channels, 16 pads, 5-inch capacitive jogs, USB-C bus power,
  rekordbox + Serato DJ Lite with Pro as a paid upgrade, and an explicit
  "what you give up" (two channels, no standalone, plastic chassis).
* **"powerhouse… robust build"** on the Inpulse 500 — replaced with list
  $349.99 vs about $299 street, 140 mm jogs, and the narrower software
  ecosystem.
* **"$80–$100 for an entry-level studio monitor"** — that is one cabinet, while
  the sentence above promised "a pair of monitors". A pair cannot be bought for
  one cabinet's price; the guidance is now $130–$160 for a *pair* with the
  DM-40D reference, and the page says to drop speakers before headphones.
* **"flat frequency response"** for a specific model — an unmeasured claim;
  removed.
* **Comparison table** listed "Industry Sync", "Career Aspirants" and a
  **$349 Traktor Kontrol S2** that the site's own under-$200 guide treats as a
  used-market option. Rebuilt with price / software in the box / what it is
  good at / what you give up, and the removed row is explained in a note.
* The `h1` promised **"Controllers & Mixers"**; the page never discusses a
  mixer. Retitled to controllers, headphones and monitors.

Evidence: `04-budget-guide-before.jpg` / `-after.jpg`.

### Mixer guides

`best-dj-mixer-under-500.html` and `best-dj-mixers-beginners.html` both told
readers the DJM-250MK2 has "a layout that is **identical to professional
gear**" / "**matches exactly** what you'll find on club gear later". A club DJM
has four channels, a full effects section and booth routing; a two-channel
beginner mixer does not. Both lines now describe partial habit transfer and say
what is missing.

### Spotlight search ranked products above answers

Typing `flx4 review` returned, in order: the rig-planner product line, a
headphone, two cables — and then, sixth, the review. Search filtered the index
in curation order and never scored relevance.

Entries are now scored (exact/prefix title match, token hits in title vs
description, editorial pages above `?add=` planner shortcuts). The FLX4 review
is first. The product entry also carried the stale "$299" price and "gold
standard" copy; both are corrected.

Evidence: `07-search-rank-before.jpg` / `-after.jpg`.

## 6. Broken journeys and a hotlinked image

* `best-standalone-dj-systems.html` and `xdj-az-vs-denon-prime-4-plus.html`
  linked to `dj-software-hub.html#software-advisor?sw_mode=standalone` — the
  query string sat *inside* the fragment, so the advisor never received it.
  Corrected to `?sw_mode=standalone#software-advisor`; verified in the browser:
  the page scrolls to the advisor and prefills the standalone answer.
* `pioneer-ddj-flx4-review.html` hotlinked a Wikimedia thumbnail with an
  `onerror` fallback hack. It failed to load in our own sweep. The identical
  licensed photo was already in the repo
  (`assets/img/products/photos/pioneer-ddj-flx4-commons.jpg`), so the hero now
  uses the local file and the attribution caption is unchanged.
* `tools/build_index.py` appended search entries keyed `t/d/u/c` while the UI
  read `title/desc/url/category`, so every regenerated entry rendered as
  "undefined". Generator and loader now agree on one shape.

## 7. Content discovery

* The guide library now has a tools band above the filter, and the library page
  is generated from `tools/library-template.html` again — previously the
  template had drifted (old nav, `<h4>` footer, no search-group chips, missing
  `quick-search.js`), so any regeneration would have silently downgraded the
  page. The template now carries the sitewide footer and nav.
* The library template no longer lists the tools hub as a "Start here" guide.
* Sitemap gained `dj-tools.html` (118 URLs, zero pages missing).
* Search placeholder counts corrected ("115 guides, 29 hardware models and 7
  interactive tools").

## Validation

All runs below are on this branch, against `python3 -m http.server`, with a real
Chromium 153 (headless shell) and a local build of puppeteer-core.

| Check | Result |
| --- | --- |
| `python3 tools/check_site.py` | 119 pages, no problems |
| `python3 tests/check_site_structure.py` | 119/119 pass |
| `node tests/sweep_all_pages.js` (new) | 119 pages × 2 viewports — no horizontal overflow, exactly one `h1`, no broken images, no console/page errors, unified nav |
| `node tests/test_journeys.js` | **6/6** (was 3/6 on `82e45f9`; three journeys targeted components that no longer exist) |
| `node tests/test_headphone_fit_page.js` (new) | pass here, fail on `82e45f9` |
| `node tests/test_headphone_fit.js` | pass |
| Internal link + anchor crawl (local script) | 0 broken links/anchors (was 118+4) |
| Mobile drawer, 390 px | opens/closes, `aria-expanded` toggles, 7 links, no overflow, closes on navigation |
| Search, `/` shortcut | opens, ranks, `Enter` navigates |

Pre-existing failures left alone (they fail identically on `82e45f9`, and two of
them test the Rig page, which this branch must not change):
`test_controller_matrix.js`, `test_speaker_finder.js`, `test_buying_journeys.js`
(depend on Rig Studio selectors such as `.rs-bar`), `test_software_advisor.js`
(needs `jsdom`), `test_trainer_e2e.js` (module resolution).

## Ranked remaining launch blockers

1. **Affiliate links are all generic Amazon searches.** All 216 Amazon links are
   `/s?k=<query>` with `tag=offbeatdj-20`. Converting them to `/dp/` product
   pages needs verified ASINs; inventing them would be worse than a search.
   Owner decision — the tag itself is preserved everywhere.
2. **Price spread between the rig catalogue and the guides.** The catalogue and
   the search entry carried $299 for the DDJ-FLX4 while the guides say about
   $329. The search entry is fixed; the catalogue is Rig-owned and still says
   $299. Decide one source of truth before launch.
3. **Photography depth.** 20 editorial photographs carry 115 hero slots; the
   worst repeat is 14 pages. Requirements are listed below.
4. **Search index vs library drift.** `assets/search-index.json` is 148
   entries, curated, with 29 `?add=` planner shortcuts, while the library is
   generated from page metadata. They are reconciled by hand; `build_index.py`
   preserves curated entries but will not detect a page whose title changed in
   the index.
5. **Consent banner covers content on a phone.** On 390 px the banner sits over
   the first screen of body copy until dismissed. Behaviour is unchanged
   (consent-gated GA4), and the GA4 harnesses are untouched, so this is a
   layout follow-up rather than a fix made blind.
6. **"Independent since 2015"** appears on the homepage and About, and is
   carried in the Organization JSON-LD `foundingDate`. Nothing in the repo
   evidences the date; confirm it is true or drop it.

## Image requirements (for the image-research group)

Authentic, licensed photography is the single biggest remaining lift on
"does this look like a real publication". Priorities, in order:

1. **Three software-scene photos** to break up `software-desk.jpg` (13 hero
   slots) and `hero-breakdown.jpg` (14). One showing Serato/rekordbox on a
   laptop next to a controller, one on a plain home desk at night, one of a
   laptop-only setup.
2. **Production desk variety** for `production-hero.jpg` (13 slots): one
   bedroom-producer desk, one hardware-only rack, one plugin session close-up.
3. **Controller close-ups** for `controller-macro.jpg` (11 slots) so the
   controller guides stop sharing one jog-wheel frame.
4. **Booth/skills photos** where the crowd is visible but not the same frame
   (`booth-wide.jpg` 11, `skills-hero.jpg` 8).
5. **Separate Pexels/Commons shots already in the repo but barely used** —
   `mobile-dj-hero.jpg` (1), `hero-wedding.jpg` (1), `pexels-mixer-knobs`
   (2), `pexels-dj-laptop-mixing` (1). Cheap wins: reassign two or three
   laptop/gear pages to the laptop shot before buying anything new.

Do **not** generate product photographs. Existing model-accurate drawings and
the two credited Commons photos are the honest ceiling until licensed press
imagery is a business decision. The seven tool screenshots in
`assets/img/tools/` are real captures and can be regenerated at any time by
re-running `tests/capture_release_evidence.js` style captures.

## Integration notes for PR #14

* **Order of operations.** Land this branch **after** the Rig work, or rebase it
  onto the merged Rig head first. The only shared files are `assets/style.css`
  (this branch appends one new section at the very end) and the shared shell in
  every page (`<nav>` and `<footer>`). Nothing in `assets/style.css` before the
  "2026-10 sitewide release pass" banner comment is modified.
* **`assets/style.css`** — my additions are the last block: hero-meta
  separators, `.hero-index` / `.tool-row` / `.link-rail` for the tools hub,
  `.library-toolband`, and the four-item grid overrides. If the Rig branch also
  appends to the file, keep both blocks; there is no selector overlap.
* **Nav.** If the Rig branch renamed the rid page or its nav label, re-run
  `python3 tools/unify_nav.py` afterwards — it rewrites every page's header from
  one list, so a rename is a one-line edit in that file.
* **Homepage rig copy.** The homepage no longer quotes preset totals
  ($597 / $3,052). If the Rig work publishes new headline presets, quote them
  *from the rig catalogue* rather than hard-coding numbers again.
* **`assets/dj-gear-catalog.json`** still prices the DDJ-FLX4 at $299 while
  every editorial page says about $329. That file is Rig-owned; please reconcile
  in whichever branch owns it.
* **`dj-tools.html`** links to the rig planner by name only ("Rig planner").
  If the tool is renamed, update `dj-tools.html`, `tools/library-template.html`
  and `tools/unify_nav.py`.
* **Search.** `assets/search-index.json` was edited by hand (one FLX4 entry);
  `tools/build_index.py` preserves curated entries, so regenerating the library
  is safe.
