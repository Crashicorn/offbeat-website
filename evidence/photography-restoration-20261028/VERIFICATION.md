# Photography Restoration & Quality Verification (2026-10-28)

## Overview

Following external research reconciliation (CrashyCrash/offbeat-website issue #1042 and PR #1045), three high-impact pages across Offbeat were identified where missing, unrepresentative, or repetitive hero photography materially hurt the visitor experience:

1. `dj-laptop-setup-guide.html` ("How to Set Up a DJ Laptop in 2026: Specs, Settings, and Software")
   - **Previous Image:** `assets/img/editorial/gear-flatlay.jpg` (an accessory flatlay of headphones, USB keys, and audio cables on a dark floor; zero laptop or DJ controller present).
   - **Material Defect:** The guide specifically teaches DJs how to configure their laptop, OS, audio buffer, and USB controller connection for live performance. Showing a table flatlay of headphones and cables with no laptop or deck was confusing and repetitive (used across 11 site pages).
   - **Restored Photography:** `assets/img/editorial/pexels-dj-laptop-mixing-17858169.jpg` (Pexels #17858169 by Oliver Morgan Media).
   - **Visitor Improvement:** Depicts a real performance laptop with a DJ controller connected directly on a desk, with hands actively mixing and controlling the deck. Accurately illustrates the laptop-controller workflow.

2. `dj-software-hub.html` ("Choose a DJ platform once, and choose it properly")
   - **Previous Image:** `assets/img/editorial/software-desk.jpg` (a static laptop in a dark home office, repeated across 14 software pages and duplicated in the very first card immediately below the fold).
   - **Material Defect:** As the main hub page for the entire DJ Software vertical, the hero failed to communicate the live performance and club reality of DJ software platforms, and created immediate visual duplication with the cards directly below.
   - **Restored Photography:** `assets/img/editorial/pexels-dj-nightclub-booth-4062561.jpg` (Pexels #4062561 by Erik Mclean).
   - **Visitor Improvement:** Vibrant, high-energy nightclub DJ booth with DJ performing at a multi-deck controller, while a laptop prominently on a stand runs live multi-deck DJ software with active waveforms and cue points under club neon lights. Eliminates in-page duplication and elevates the software category hub.

3. `midi-controllers-for-music-production.html` ("Best MIDI Controllers for Music Production 2026")
   - **Previous Image:** `assets/img/editorial/production-hero.jpg` (a massive modular analog synthesizer rack and large studio monitors, repeated across 14 pages).
   - **Material Defect:** The article is dedicated to compact USB/DAW MIDI controllers, pad matrices, and keyboards (Ableton Push, Akai MPC, Akai MPK Mini, Arturia MiniLab). Depicting huge modular synth hardware had zero resemblance to the controllers reviewed. Furthermore, `og:image` and `twitter:image` had drifted into conflicting defaults (`og-default.jpg` vs `hero-breakdown.jpg`).
   - **Restored Photography:** `assets/img/editorial/pexels-music-production-workstation-27495246.jpg` (Pexels #27495246 by Giuseppe Di Maria).
   - **Visitor Improvement:** A genuine modern music production setup showing a laptop running Ableton Live, an audio mixer, and an Akai APC mini grid controller with illuminated pads and channel faders on a performance stand. Perfectly matches the subject matter and unifies social card metadata.

---

## Asset Provenance & License Verification

All three photographs are authentic Pexels assets independently verified from the research handoff:

| Asset File | Pexels ID | Photographer | Source Page | License | SHA-256 | Delivered Specs |
|---|---|---|---|---|---|---|
| `pexels-dj-laptop-mixing-17858169.jpg` | `17858169` | Oliver Morgan Media | [Pexels photo 17858169](https://www.pexels.com/photo/dj-using-sound-mixer-and-laptop-17858169/) | [Pexels License](https://www.pexels.com/license/) | `a0e4329d1f5bd3e4a9685e02ad77cfca96d3e5161b84e22acff91382183e7eda` | 1200 × 750 (16:10), 74 KB |
| `pexels-dj-nightclub-booth-4062561.jpg` | `4062561` | Erik Mclean | [Pexels photo 4062561](https://www.pexels.com/photo/dj-with-mixer-controller-in-night-club-4062561/) | [Pexels License](https://www.pexels.com/license/) | `acd3ecb36cdfdf8a6cfeaa2b5c7add2235d740a9bc8b166d1ba9ab2486072a7c` | 1200 × 750 (16:10), 100 KB |
| `pexels-music-production-workstation-27495246.jpg` | `27495246` | Giuseppe Di Maria | [Pexels photo 27495246](https://www.pexels.com/photo/a-laptop-and-a-mixer-on-a-table-27495246/) | [Pexels License](https://www.pexels.com/license/) | `6c84c03e59edc7ff8c31cbb0c7b22678dcc464e4084387a702ed7174d6195766` | 1200 × 750 (16:10), 124 KB |

Attributions and contextual disclaimer statements are displayed in honest `<figcaption class="img-attribution">` tags directly below each hero image, and all assets are recorded in `assets/img/editorial/IMAGE-CREDITS.md`.

---

## Chromium Visual & Layout Verification

Automated browser tests were conducted using real Chromium headless (`Chromium 153.0.8010.0`) at 1440px desktop and 390px mobile viewports:

- **Desktop (1440 × 900):**
  - `dj-laptop-setup-guide.html`: HTTP 200, hero image loaded (`naturalWidth: 1200`, `complete: true`), horizontal overflow = `0px`, 0 console errors.
  - `dj-software-hub.html`: HTTP 200, hero image loaded (`naturalWidth: 1200`, `complete: true`), horizontal overflow = `0px`, 0 console errors.
  - `midi-controllers-for-music-production.html`: HTTP 200, hero image loaded (`naturalWidth: 1200`, `complete: true`), horizontal overflow = `0px`, 0 console errors.

- **Mobile (390 × 844, 2x DPR):**
  - `dj-laptop-setup-guide.html`: hero image loaded (`naturalWidth: 1200`, `complete: true`), horizontal overflow = `0px`, headline fully legible, 0 console errors.
  - `dj-software-hub.html`: hero image loaded (`naturalWidth: 1200`, `complete: true`), horizontal overflow = `0px`, headline fully legible, 0 console errors.
  - `midi-controllers-for-music-production.html`: hero image loaded (`naturalWidth: 1200`, `complete: true`), horizontal overflow = `0px`, headline fully legible, 0 console errors.

Screenshots captured and stored in `evidence/photography-restoration-20261028/`:
- `before/dj-laptop-setup-desktop.png`, `before/dj-laptop-setup-mobile.png`
- `before/dj-software-hub-desktop.png`, `before/dj-software-hub-mobile.png`
- `before/midi-controllers-desktop.png`, `before/midi-controllers-mobile.png`
- `after/dj-laptop-setup-desktop.png`, `after/dj-laptop-setup-mobile.png`
- `after/dj-software-hub-desktop.png`, `after/dj-software-hub-mobile.png`
- `after/midi-controllers-desktop.png`, `after/midi-controllers-mobile.png`

---

## Boundaries & Non-Regressions

- The four reserved standalone-hardware pages (`denon-sc6000-review.html`, `denon-prime-go-review.html`, `xdj-az-vs-denon-prime-4-plus.html`, `best-standalone-dj-systems.html`) were **not modified**.
- No changes to software advisor, Rig Studio, speaker planner, catalog, global CSS, or production main.
- No AI-generated photorealistic hardware or unverified manufacturer media was used.
