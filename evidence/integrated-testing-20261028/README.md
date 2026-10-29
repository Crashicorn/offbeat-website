# Integrated Offbeat Release Verification — October 28, 2026

## 1. Executive Summary

This integration release consolidates the three isolated work streams from `Crashicorn/offbeat-website` without deploying to production or merging the upstream source branches:

1. **PR #12 (`5ec3095`):** Recovered interactive DJ Software Advisor on `dj-software-hub.html` with five-verdict recommendation engine (`fits`, `costs`, `partial`, `check`, `blocked`), three-year total cost of ownership calculator, deep-linking, and accessibility support.
2. **PR #13 (`0b730a1`):** Corrected standalone hardware guides across four pages (`denon-sc6000-review.html`, `denon-prime-go-review.html`, `xdj-az-vs-denon-prime-4-plus.html`, `best-standalone-dj-systems.html`) removing hallucinated specifications, clarifying player vs. all-in-one categories, and validating connectivity and streaming services.
3. **PR #14 (`5c502b6`):** Restored verified licensed editorial photography across three pages (`dj-laptop-setup-guide.html`, `dj-software-hub.html`, `midi-controllers-for-music-production.html`), replacing repetitive and inaccurate images with responsive 1200×750 Pexels assets and honest photographer attributions.

**Common Base Commit:** `f580788397fc5836ffcb026cc7c0e0f74d7170c6` (branch `arena/849667ed-offbeat-website`).

---

## 2. Key Reconciliations

### `dj-software-hub.html` (PR #12 + PR #14)
Both PR #12 and PR #14 modified `dj-software-hub.html`. The integration cleanly reconciles both sets of improvements:
- **Interactive Decision Engine Preserved (from #12):** The 7-question interactive Software Advisor (`#software-advisor`), loaded datasets (`assets/software-advisor-data.js`), client script (`assets/software-advisor.js`), and styling (`assets/software-advisor.css`) are intact.
- **Hero Photography & Metadata Preserved (from #14):**
  - Restored hero image: `assets/img/editorial/pexels-dj-nightclub-booth-4062561.jpg` (Erik Mclean, 1200×750, 16:10).
  - OpenGraph / Twitter cards: Pointing to `pexels-dj-nightclub-booth-4062561.jpg`.
  - Alt text: *"A DJ performing in a vibrant nightclub booth with a multi-deck controller and a laptop displaying live DJ performance software"*.
  - Attribution: `<figcaption class="img-attribution">Photograph by <a href="..." target="_blank" rel="noopener">Erik Mclean</a> on Pexels. Illustrative live performance booth; not an endorsement of a single software platform.</figcaption>`.
- **Hero Copy & Actions:** Features the "Find my software" jump-link button alongside "7 platforms compared".

### Standalone Hardware Guides (PR #13)
All four corrected standalone guides and reviews are preserved in full:
- `denon-sc6000-review.html`: Clarifies that the SC6000 is a dedicated media player requiring a separate mixer; confirms 3 USB-A drive ports; notes that the SC6000 is an official accessory that does not unlock Serato DJ Pro by itself without supported mixer hardware. Erroneous claims (12.1-inch screen, 0% skipping, ~$1,799, 7.2 lbs) eliminated.
- `denon-prime-go-review.html`: Distinguishes generation capabilities (Apple Music and Amazon Music Unlimited are listed for GO+, not original GO).
- `xdj-az-vs-denon-prime-4-plus.html`: Confirms PRIME 4+ has dedicated XLR booth outputs while XDJ-AZ has 1/4" TRS booth; details 4-deck standalone vs link playback.
- `best-standalone-dj-systems.html`: Accurate buying table and category breakdowns across AlphaTheta/Pioneer DJ and Engine DJ hardware.

---

## 3. Buyer-Facing Claims & Verification Status

All licensing, pricing, and compatibility claims were checked against vendor documentation:

| Category | Claim / Value | Source / Evidence | Status |
|---|---|---|---|
| **rekordbox** | Free tier exports USBs & runs Performance on Hardware Unlock gear. Core $12/mo ($120/yr), Creative $18/mo ($180/yr), Professional $36/mo ($360/yr). | [rekordbox plans](https://rekordbox.com/en/plan/) & [Hardware Unlock list](https://rekordbox.com/en/support/hardware-unlock/) | Verified |
| **Serato** | Lite is free with 50+ controllers. Pro is $11.99/mo or $299 perpetual. Suite is $14.99/mo or $499 perpetual. | [Serato pricing](https://serato.com/dj/pro/pricing) & [hardware list](https://serato.com/dj/hardware) | Verified |
| **Traktor** | Pro 4 is $149 perpetual. Traktor Play (2-deck) is $49. No free tier. | [Native Instruments Traktor](https://www.native-instruments.com/products/traktor-pro) | Verified |
| **djay Pro** | $6.99/mo or $49.99/yr. Free tier covers basic 2-deck mixing. | [Algoriddim djay](https://www.algoriddim.com/) | Verified |
| **VirtualDJ** | Free for home/keyboard use. Home Plus ($49–$199 per controller) or Pro ($19/mo or $299 once). | [VirtualDJ buy](https://virtualdj.com/buy/) | Verified |
| **Engine DJ** | Free OS on Denon/Numark hardware; free desktop prep app. | [Engine DJ downloads](https://enginedj.com/downloads) | Verified |
| **Mixxx** | 100% free and open source (GPL v2+). | [Mixxx.org](https://mixxx.org/) | Verified |
| **Denon SC6000** | Requires external audio mixer; 3 USB-A ports; dual-layer playback; Serato accessory. | [Denon SC6000](https://www.denondj.com/sc6000-prime.html) & [Serato listing](https://serato.com/dj/hardware/denon-dj-sc6000-prime) | Verified |
| **PRIME GO / GO+** | Built-in rechargeable battery; GO+ adds Apple Music and Amazon Music. | [Engine DJ Streaming Matrix](https://enginedj.com/streaming) | Verified |
| **XDJ-AZ / PRIME 4+** | PRIME 4+ XLR booth, AZ TRS booth; AZ 4-deck link/standalone architecture. | [AlphaTheta XDJ-AZ](https://alphatheta.com/en/product/all-in-one-dj-system/xdj-az/black/) & [Denon PRIME 4+](https://www.denondj.com/prime-4-plus.html) | Verified |
| **AlphaTheta XDJ-AZ Spotify** | Confirmed standalone StreamingDirectPlay with Spotify Premium over Wi-Fi/Ethernet; requires firmware update (independent reports cite v2.00); no stream recording. | [AlphaTheta XDJ-AZ](https://alphatheta.com/en/product/all-in-one-dj-system/xdj-az/black/) | Verified |

### Explicitly Flagged Unresolved / Ambiguous Claims
- **Engine OS Standalone Spotify:** Not available natively on Engine OS hardware; users must prepare tracks or use supported services (TIDAL, Beatport, Beatsource, Amazon Music, Apple Music on GO+).
- **VirtualDJ Infinity Non-Commercial License Pricing:** VirtualDJ does not publish a standardized fixed web price for older one-time controller unlocks without logging into specific account serials. The advisor marks this as requiring direct check rather than guessing a number.

---

## 4. Integrated Automated Testing Results

Real headless Chromium browser tests were executed against all seven updated pages across 1440px desktop and 390px mobile viewports:

- **Browser:** Chromium 153.0.8010.0
- **Pages Tested:**
  1. `denon-sc6000-review.html`
  2. `denon-prime-go-review.html`
  3. `xdj-az-vs-denon-prime-4-plus.html`
  4. `best-standalone-dj-systems.html`
  5. `dj-laptop-setup-guide.html`
  6. `midi-controllers-for-music-production.html`
  7. `dj-software-hub.html`
- **Results:**
  - HTTP 200 on all routes.
  - Horizontal overflow: `0px` across all 14 desktop and mobile viewport tests.
  - Broken images: `0`.
  - Failed network requests (4xx/5xx): `0`.
  - Console and uncaught page errors: `0`.
  - Local internal link validation: 100% resolve to valid workspace files.
  - Interactive Software Advisor: Tested across 15 real user journeys, keyboard input, reset logic, 5-verdict rendering, and deep link URL queries.
  - FAQ Details toggles: Verified operable via keyboard navigation on all pages.

Visual evidence captures saved in `evidence/integrated-testing-20261028/`:
- Desktop & mobile screenshots for all 7 updated pages.
- Detailed metrics in `evidence/integrated-testing-20261028/integration-results.json`.

---

## 5. Staging Preview

A live HTTP staging preview server is running in the workspace:
- **Port:** `8080` (bound to `0.0.0.0`)
- **Key Routes for Visual Review:**
  - `/dj-software-hub.html` (Reconciled Advisor + Nightclub Hero Photo)
  - `/dj-laptop-setup-guide.html` (Mixing Hands on Laptop Photo)
  - `/midi-controllers-for-music-production.html` (DAW/Pad Controller Photo)
  - `/denon-sc6000-review.html` (Standalone Media Player Guide)
  - `/denon-prime-go-review.html` (Battery Standalone Guide)
  - `/xdj-az-vs-denon-prime-4-plus.html` (Flagship Comparison Guide)
  - `/best-standalone-dj-systems.html` (All-in-One vs Player Round-Up)
