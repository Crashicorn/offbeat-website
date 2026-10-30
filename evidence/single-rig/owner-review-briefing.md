# Owner re-review: single Rig Architect

**Decision requested:** accept or reject the current Rig Architect for launch; the October 29 rejection predates this work and is not acceptance of it. Review PR #17 at `d1c11f830050407c486d333fb6614744412cce32` (draft). No merge or deployment is requested. The later catalog-only follow-up on Agent A's branch is not yet included in that PR head.

## What changed

- Before/after evidence: [bedroom desktop before](before-bedroom-starter-1440.png) → [after](after-bedroom-starter-1440.png); [bedroom mobile before](before-bedroom-starter-390.png) → [after](after-bedroom-starter-390.png). [Mobile DJ desktop after](after-mobile-pro-1440.png) · [mobile after](after-mobile-pro-390.png). These `single-rig` captures compare the pre-subtraction `195bd37` and the single-canvas baseline, **not** the later Agent A changes. Full capture conditions are in [README](README.md).
- [2bc01ba](https://github.com/Crashicorn/offbeat-website/commit/2bc01bae85d95188876a2177ab3f382aa1a249dc) removed the duplicate rendered booth and moved connections, shopping and save/share into optional views; `82e45f9` verified the single-rig baseline. It did not merely hide a second booth.
- Agent A's `f21ac77`, `25ce6d7`, `caef495` then added planned-route feedback and conservative cable quantity checks, revised purchase wording, and repaired clipped mobile picker cards. [Later desktop booth](../rig-architect-2026/bedroom-1440.png), [mobile picker](../rig-architect-2026/picker-390.png), [mobile routing limitation](../rig-architect-2026/mobile-rig-390.png). Catalog schematics are not product photos and route animation is a plan, not live audio.

## Code to inspect at the reviewed head

- [Role pills, line 1284](https://github.com/Crashicorn/offbeat-website/blob/d1c11f830050407c486d333fb6614744412cce32/assets/rig-builder.js#L1281-L1286): `getSpeakerRole(slot) === "crowd_pa" ? "📢 Crowd-Facing PA" : "🔊 DJ-Facing Monitors"`. This particular table pill is in the **empty-slot** branch; the canvas separately labels both roles.
- [Role-specific picker, lines 1483–1489](https://github.com/Crashicorn/offbeat-website/blob/d1c11f830050407c486d333fb6614744412cce32/assets/rig-builder.js#L1483-L1489): `modalTitle = "Crowd-Facing PA Speakers"` / `modalTitle = "DJ-Facing Booth Monitors"`. The picker filters by role before rendering.
- [Selection guard, lines 1989–1993](https://github.com/Crashicorn/offbeat-website/blob/d1c11f830050407c486d333fb6614744412cce32/assets/rig-builder.js#L1989-L1993): `if (!isSpeakerEligibleForRole(pickedItem, role))` triggers an `Incompatible Component` alert that says “Nearfield studio reference monitors lack the acoustic dispersion and headroom required for live sound reinforcement”. This is a guard, not independent verification of every speaker's suitability.
- [One canvas, lines 1139–1152](https://github.com/Crashicorn/offbeat-website/blob/d1c11f830050407c486d333fb6614744412cce32/assets/rig-builder.js#L1139-L1152): `visual-stage` renders monitor, controller and PA slots once, followed by optional connection details. The duplicate-booth removal is evidenced by the `2bc01ba` diff above.

## Review boundaries

Estimates are not live retailer quotes, and some routes or additional speakers require manual compatibility checks. Owner review should decide whether the current schematic equipment, interactions and shopping plan are acceptable; no owner re-review has yet occurred. The later catalog changes require integration and review separately before they appear in PR #17.
