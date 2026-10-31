# Owner re-review: single Rig Architect

**Decision requested:** accept or reject the current Rig Architect for launch; the October 29 rejection predates this work and is not acceptance of it. The features and catalog corrections were integrated at baseline `1a47955b6dc8e886f831468f4689d7205bc3d9d9`. Review the **current exact head of draft PR #17**, which incorporates the subsequent Rig-browser assertion repair and this briefing. No merge or deployment is requested. **A successful CI run on the current exact head is required before owner acceptance.** The earlier `1a47955` run failed on an outdated spend-total assertion.

## What changed

- Before/after evidence: [bedroom desktop before](before-bedroom-starter-1440.png) → [after](after-bedroom-starter-1440.png); [bedroom mobile before](before-bedroom-starter-390.png) → [after](after-bedroom-starter-390.png). [Mobile DJ desktop after](after-mobile-pro-1440.png) · [mobile after](after-mobile-pro-390.png). These `single-rig` captures compare the pre-subtraction `195bd37` and the single-canvas baseline, **not** the later Agent A changes. Full capture conditions are in [README](README.md).
- [2bc01ba](https://github.com/Crashicorn/offbeat-website/commit/2bc01bae85d95188876a2177ab3f382aa1a249dc) removed the duplicate rendered booth and moved connections, shopping and save/share into optional views; `82e45f9` verified the single-rig baseline. It did not merely hide a second booth.
- Agent A's `f21ac77`, `25ce6d7`, `caef495` then added planned-route feedback and conservative cable quantity checks, revised purchase wording, and repaired clipped mobile picker cards. [Later desktop booth](../rig-architect-2026/bedroom-1440.png), [mobile picker](../rig-architect-2026/picker-390.png), [mobile routing limitation](../rig-architect-2026/mobile-rig-390.png). Catalog schematics are not product photos and route animation is a plan, not live audio.

## Catalog corrections included at this head

- FLX4 is estimated at $329, with a dated `price_basis` and manufacturer `price_source`; the FLX10, GRV6, HDJ-CUE1 and JBL EON715 benchmarks were also aligned with the cited guide or existing catalog basis. Prices are estimates, not live quotes.
- The Electro-Voice ZLX-12BT now uses a neutral PA outline rather than a JBL illustration. Generic microphone, riser, monitor-pad and USB entries use unbranded artwork; cable allowances use connector-labelled illustrations, not product images.
- Amazon search entries are labelled `search_fallback`. Exact Amazon identifiers were not verified and were not added.

## Code to inspect at the reviewed head

- [Role pills, line 1284](https://github.com/Crashicorn/offbeat-website/blob/1a47955b6dc8e886f831468f4689d7205bc3d9d9/assets/rig-builder.js#L1281-L1286): `getSpeakerRole(slot) === "crowd_pa" ? "📢 Crowd-Facing PA" : "🔊 DJ-Facing Monitors"`. This particular table pill is in the **empty-slot** branch; the canvas separately labels both roles.
- [Role-specific picker, lines 1483–1489](https://github.com/Crashicorn/offbeat-website/blob/1a47955b6dc8e886f831468f4689d7205bc3d9d9/assets/rig-builder.js#L1483-L1489): `modalTitle = "Crowd-Facing PA Speakers"` / `modalTitle = "DJ-Facing Booth Monitors"`. The picker filters by role before rendering.
- [Selection guard, lines 1989–1993](https://github.com/Crashicorn/offbeat-website/blob/1a47955b6dc8e886f831468f4689d7205bc3d9d9/assets/rig-builder.js#L1989-L1993): `if (!isSpeakerEligibleForRole(pickedItem, role))` triggers an `Incompatible Component` alert that says “Nearfield studio reference monitors lack the acoustic dispersion and headroom required for live sound reinforcement”. This is a guard, not independent verification of every speaker's suitability.
- [One canvas, lines 1139–1152](https://github.com/Crashicorn/offbeat-website/blob/1a47955b6dc8e886f831468f4689d7205bc3d9d9/assets/rig-builder.js#L1139-L1152): `visual-stage` renders monitor, controller and PA slots once, followed by optional connection details. The duplicate-booth removal is evidenced by the `2bc01ba` diff above.

## First-load compatibility status (expected — re-worded claim)

A fresh load of the default bedroom rig (DDJ-FLX4 + HD 25 + DM-40D + owned phone/tablet host; purchase total $627) renders the compatibility tag **"⚠️ Connection Verification Needed"** with exactly one warning item, **"Mobile Host, USB Audio and Power Need Verification"**, and zero fatal errors. This was re-verified against the compatibility engine at this head. The verdict is correct and intentional — it is not a defect to be removed:

- The preset's $0 `existing-mobile-device` host assumes you already own a compatible phone or tablet. Neither the preset description nor catalog data can confirm rekordbox mobile support, the USB audio path, or the separate 9V/3A supply for a buyer's specific device, so the engine reports the route as **workable pending verification**, not verified. The warning lists exactly those three buyer-actionable items.
- "Preliminary Match" requires zero warnings *and* zero fatal errors. Removing the mobile-host item cannot produce it: the DDJ-FLX4 is not standalone, so an empty host slot fails closed with the fatal **"Host Computer Required"** error and the tag would read **"❌ Incompatible Configuration"** — strictly worse. Substituting a priced laptop would break the preset's documented "no laptop purchase required" $627 contract.
- The behavior is test-locked: `tests/rig-builder-browser.cjs` asserts this warning is present on first load, and `tests/rig-builder-security.test.js` ("starter explicitly assumes an existing phone, not a $999 laptop") pins the $0 host item.

**Re-worded claim (supersedes any earlier "first load shows Preliminary Match" wording):** the default bedroom rig first loads as *a workable configuration with one explicit buyer-actionable verification warning* — tag **"⚠️ Connection Verification Needed"** — because the mobile-host route is conditional on the buyer's own phone, USB audio routing and separate 9V/3A power. The tag remains at "Connection Verification Needed" for as long as that configuration is selected, by design. It is not a green "Preliminary Match" and must not be described as one.

## Review boundaries

Estimates are not live retailer quotes, and some routes or additional speakers require manual compatibility checks. Owner review should decide whether the current schematic equipment, interactions and shopping plan are acceptable; no owner re-review has yet occurred. Catalog corrections from `1a47955` and Arena A’s Rig-browser test correction are included on this review branch. The matched screenshots are historical; review the current candidate and its exact-head CI results before deciding.
