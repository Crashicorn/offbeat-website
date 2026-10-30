# Purchasing Integration Verification Evidence (Levels 1–4) — October 28, 2026

This directory contains visual and test execution evidence confirming the complete audit and repair of the purchasing experience across Offbeat's catalog, Rig Studio, Rig Builder, and standalone buying guides.

## Scope of Purchasing Reparations

### Level 1: Syntax & Link Hygiene
- All outgoing merchant links across the site and interactive tools use HTTPS (`https://...`).
- External retailer links include `rel="noopener"` (and `rel="nofollow noopener sponsored"` for commercial affiliate relationships).
- Approved Amazon Associates affiliate tracking tag `offbeatdj-20` is strictly maintained on all Amazon search and product destinations.
- Sweetwater and unpartnered destination links do not invent unauthorized or synthetic affiliate parameters; Sweetwater links use clean search format (`https://www.sweetwater.com/store/search?s=...`) with `rel="nofollow noopener"`.

### Level 2: Search Fallbacks & Clean Terms
- Replaced all broken/obsolete zZounds `/itemsearch?form=search&q=...` URLs (which returned 404 pages) with the active, working zZounds endpoint `/prodsearch?q=...`.
- Search fallbacks properly encode hardware model strings and clean category terms.

### Level 3: Exact SKU Product Detail Page Destinations
- Created structured `retailer_destinations` mapping across 35 items in `assets/dj-gear-catalog.json` and exposed lookup via `OffbeatGear.itemRetailerDestinations(item)`.
- Verified 27 exact, direct product detail pages (`https://www.zzounds.com/item--<SKU>`) across core 2026 DJ controllers, standalone all-in-one systems, headphones, speakers, and microphones:
  - Pioneer DJ DDJ-FLX4: `PIODDJFLX4`
  - Pioneer DJ DDJ-FLX10: `PIODDJFLX10`
  - AlphaTheta DDJ-FLX2: `APTDDJFLX2`
  - AlphaTheta DDJ-GRV6: `APTDDJGRV6`
  - AlphaTheta XDJ-AZ: `APTXDJAZ`
  - Denon DJ PRIME 4 G2: `DENPRIME4G2`
  - RANE SYSTEM ONE: `RNESYSTEMONE`
  - Numark Party Mix III: `NUMPARTYMIXIII`
  - Numark MixTrack Go: `NUMMIXTRACKGO`
  - Hercules DJControl Inpulse 500: `HERDJCINPULSE500`
  - Denon DJ PRIME GO+: `DENPRIMEGOPLUS`
  - Native Instruments Traktor MX2: `NATTRAKMX2`
  - Sennheiser HD 25: `SENHD25`
  - Audio-Technica ATH-M50x: `AUTATHM50X`
  - Audio-Technica ATH-M20x: `AUTATHM20X`
  - Pioneer DJ HDJ-CUE1: `PIOHDJCUE1`
  - Pioneer DJ DM-40D (Pair): `PIODM40D`
  - Pioneer DJ DM-50D (Pair): `PIODM50D`
  - Yamaha HS5 (Single unit): `YAMHS5`
  - KRK ROKIT 5 G5 (Single unit): `KRKRP5G5NA`
  - JBL EON715 (Single unit PA): `JBLEON715`
  - Shure SM58 Vocal Microphone: `SHUSM58`
  - CableCreation Balanced XLR Male to Female: `PGHPHM`
  - Hosa Dual RCA to RCA: `HOSCRA20`
  - Hosa Stereo RCA to Dual 1/4" TS: `HOSCPR20`
- Interactive shopping lists render exact buttons styled with `.rs-retail--exact` and `data-destination-type="exact"` with exact SKU tracking.

### Level 4: Packaging, Stock Status, Availability & Compliance
- **Speaker Packaging Guidance**:
  - Studio monitors sold as individual units (Yamaha HS5, KRK ROKIT 5 G5) display explicit badges: `📦 Sold individually at retailers (MPN: HS5, ~$199 each). Need 2 units for stereo pair ($398 total).`
  - Powered PA loudspeakers (JBL EON715) display explicit badges: `📦 Sold as single powered PA cabinet.`
  - Desktop monitor pairs (Pioneer DM-40D, DM-50D, KRK Classic 5 Pack) display explicit badges: `📦 Sold as complete pair in one retail box (active left + passive right).`
- **Stock & Discontinued Item Alerts**:
  - Discontinued hardware (Denon PRIME 4+, Denon PRIME GO original, Denon SC6000 PRIME, Shure SM58-LC, RANE FOUR) visibly display warning notices (`Discontinued / Out of stock at zZounds`).
  - Active, in-stock alternatives are recommended and linked directly (e.g. PRIME 4+ shopping line renders direct link to in-stock Denon DJ PRIME 4 G2 at `item--DENPRIME4G2`; PRIME GO links to PRIME GO+ at `item--DENPRIMEGOPLUS`).
- **Affiliate Agreement & Truth-in-Pricing Compliance**:
  - Full compliance with zZounds and FTC affiliate disclosures. Stale estimated prices are strictly separated from merchant links and labeled as "Offbeat benchmark planning estimates (October 2026), not real-time merchant quotes."
  - Shopping list summary totals explicitly use "Offbeat benchmark total" and "To buy (est.)", preventing misrepresentation of live quotes without real-time inventory APIs.

## Captured Visual Evidence
1. `01-club-ready-purchasing.png`: Rig Studio shopping list for the Club-Ready preset showing exact zZounds link attributes (`PIODDJFLX10`, `SENHD25`), packaging guidance badge on Yamaha HS5 (sold individually, need 2), and truth-in-pricing disclosures.
2. `02-mobile-pro-stock-alert.png`: Rig Studio shopping list for Mobile-Pro preset showing discontinued badge for Denon PRIME 4+, direct in-stock recommendation button for PRIME 4 G2, single PA speaker packaging notice on JBL EON715, and exact destination for Shure SM58.
3. `03-guide-xdj-az-vs-denon-prime-4-plus.png`: Head-to-head comparison guide showing exact links for XDJ-AZ (`APTXDJAZ`), PRIME 4 G2 (`DENPRIME4G2`), and discontinued direct listing for PRIME 4+ (`DENPRIME4PLUS`).
4. `03-guide-best-standalone-dj-systems.png`: Standalone roundup guide showing exact retailer buttons for AlphaTheta XDJ-AZ, Denon DJ PRIME 4 G2, and RANE SYSTEM ONE.
5. `03-guide-denon-sc6000-review.png`: SC6000 review page showing discontinued status badge and exact zZounds SKU link (`DENSC6000PRIME`).

## Automated Test Suites
- `tests/test_purchasing_levels.js`: Dedicated 6-part validation suite asserting Level 1 through Level 4 purchasing compliance.
- `tests/test_five_buyer_journeys.js`: End-to-end regression test covering all 5 core buyer journeys in Chromium.
