# Rig Architect Experience Restructuring: Role-Based Booth, Physical Topology & Interactive Acceptance

**Date:** 2026-10-29  
**Branch:** `arena/4eafba31-offbeat-website`  
**Base Commit:** `303c83aca907c7761bbc10bf6cca07f86eabefd8`  
**Test Suite:** `tests/test_role_based_booth_journeys.js` (100% PASS in headless Chromium)

---

## 1. Executive Summary & Physical Accuracy Corrections

In accordance with owner directive #6510995855 and acceptance criteria, the Rig Architect experience has been refined to eliminate physical modeling errors and ensure strict alignment between hardware capabilities, amplifier topologies, cable supplies, and interactive state persistence:

1. **Strict Topology Modeling (Master/Satellite vs Independent Bi-Amped)**:
   - **Genuine Master/Passive-Satellite Boxed Pairs (e.g. Pioneer DJ DM-40D, DM-50D)**:
     * Left cabinet is the **Powered Master** (built-in amplifier, inputs, power LED, dedicated AC power cord).
     * Right cabinet is the **Passive Satellite** (speaker-wire input only, powered from master cabinet).
     * Visible, labeled interconnect link wire (`⚡ Included Link Wire ($0)`) connects master to satellite.
     * Single stereo audio run feeds the master cabinet. Packaged as 1 retail box with 1 AC plug.
   - **Independently Powered Active Studio Monitors (e.g. Yamaha HS5, KRK Classic 5, KRK ROKIT 5 G4)**:
     * Previous flaw resolved: Fixed `renderMonitorCabinetVisual()` which previously conflated any `speaker_units === 2` item with master/satellite pairs.
     * Yamaha HS5 is now modeled with complete physical fidelity: **2 Active Bi-Amped cabinets**, each with its own internal amplifier, independent illuminated power LED, independent AC mains power feed, and balanced XLR/TRS input.
     * Form a **Nearfield Stereo Triangle** without any link wire or passive satellite designation.
     * Packaging explicitly reflects real-world purchasing: `2 Retail Units (2 Active Cabinets · Dual AC Mains)` ($199 each, billed at $398 for the pair).
2. **Missing vs Confirmed Cable Verification**:
   - Routes no longer declare "Verified" or display animated neon pulses merely because the catalog suggests a compatible cable.
   - If an external cable is required and missing from the visitor's rig, the route enters **Standby Mode** (`pipe--standby`, dashed track, zero false signal pulses).
   - The interactive cable pill presents an actionable prompt: `[+ Add to Rig ($price)]`. Clicking the pill confirms the cable, increments/adds it to the itemized checklist, and immediately activates the animated signal dot.
   - If a cable is included in the equipment box (e.g. DM-40D 3.5mm-to-RCA lead), the route is verified at $0.
3. **Hardware-Accurate Routing Limitations**:
   - Single-output hardware (e.g. Pioneer DDJ-FLX4) attempting to drive both Crowd PA and DJ Monitors displays the high-contrast **Routing Limitation Box** on Route B.
   - Details 3 verified real-world solutions without invented outputs, passive Y-cables, or false signal animations.
4. **Interactive Two-Zone State & Share Persistence**:
   - Live interaction verified: Simultaneously configuring PA and monitors, stepping package quantities, toggling ownership, and verifying cost deductions.
   - Reloading via serialized share URL (`?rig=...`) restores 100% identical booth visuals, physical cabinet counts, ownership states, compatibility alerts, and itemized checklist prices.

---

## 2. End-to-End Headless Chromium Journey Results

Execution of `tests/test_role_based_booth_journeys.js` against local development server (`http://127.0.0.1:8080`):

| Setup / Journey | Configuration | Key Verifications | Status |
| :--- | :--- | :--- | :--- |
| **Setup A** | **Bedroom Starter Rig**<br>(DDJ-FLX4 + Pioneer DM-40D) | • Genuine master/satellite boxed pair (`hasLinkWire: true`, `hasPassiveSatellite: true`, `hasMasterCab: true`, `biAmpedCount: 0`).<br>• Visible `⚡ Included Link Wire ($0)`.<br>• Crowd PA empty/omitted.<br>• Route B: in-box cable ($0) verified.<br>• Zero false routing conflicts. | **PASS** |
| **Setup B** | **Mobile DJ Rig**<br>(Denon PRIME 4+ + JBL EON715 Array + Yamaha HS5 Monitors) | • Crowd PA: 2 physical PA cabinets with Audience Stereo Spread.<br>• DJ Monitors: 2 active bi-amped monitors (`hasLinkWire: false`, `hasPassiveSatellite: false`, `biAmpedCount: 2`, `hasNearfieldSpread: true`).<br>• Route A: `[XLR master]` → EON715 with animated signal dots.<br>• Route B: `[XLR booth]` → HS5 with animated signal dots.<br>• Dual XLR cables accounted for; zero routing conflict. | **PASS** |
| **Setup C** | **Minimal Mono PA**<br>(DDJ-FLX4 + 1× JBL EON715 Cabinet) | • Exactly 1 physical PA cabinet rendered (`.cabinet-unit--mono`).<br>• Explicit label: `Mono PA Cabinet (1 Physical Unit)`.<br>• Zero false stereo claims.<br>• DJ Monitors empty (cue headphones monitoring). | **PASS** |
| **Setup D** | **Hardware-Limited Routing Conflict**<br>(DDJ-FLX4 + EON715 PA + HS5 Monitors) | • DDJ-FLX4 feeds PA via single RCA Master out.<br>• Route B displays high-contrast routing limitation box.<br>• Clearly explains single-output hardware constraint.<br>• Details 3 verified solutions without false signal pulses.<br>• Compatibility engine flags fatal limitation. | **PASS** |
| **Interactive State Recovery** | **Two-Zone Customization & Share Reload**<br>(FLX10 + 2× EON715 PA + HS5 Monitors Owned) | • PA quantity stepped to 2 boxes (2 physical cabinets).<br>• Monitors toggled to owned (saved $398, spend updated).<br>• Share URL generated, loaded in fresh Chromium page.<br>• Recovered page verified: 2 PA cabinets, 2 bi-amped HS5 cabinets, owned status preserved, identical spend total. | **PASS** |
| **Mobile Viewport** | **390px Viewport Regression**<br>(Club-Ready Rig on iPhone 14 geometry) | • 0px horizontal overflow (`scrollWidth - clientWidth <= 1px`).<br>• Complete booth stage stacks into responsive vertical columns.<br>• Zero clipped retailer action buttons. | **PASS** |

---

## 3. Visual Evidence Captures

The following high-resolution captures have been generated and preserved in `evidence/`:
- `evidence/booth-setup-a-bedroom-1440px.png`: Setup A desktop view showing DM-40D master/passive-satellite pair with included link wire and empty PA state.
- `evidence/booth-setup-b-mobile-1440px.png`: Setup B desktop view showing dual-speaker array (Stereo PA mains + Stereo active bi-amped HS5 booth monitors with nearfield triangle) with Master XLR and Booth XLR live signal pipes.
- `evidence/booth-setup-c-mono-pa-1440px.png`: Setup C desktop view confirming single mono PA cabinet and zero false stereo claims.
- `evidence/booth-setup-d-conflict-1440px.png`: Setup D desktop view demonstrating high-contrast routing limitation alert on Route B without false signal pulses.
- `evidence/booth-mobile-390px.png`: Responsive 390px mobile view verifying zero overflow and clean stacking.
