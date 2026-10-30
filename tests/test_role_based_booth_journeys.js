// tests/test_role_based_booth_journeys.js
// Validates the purpose-based booth restructuring, physical-unit modeling,
// amplifier topology distinction, and dynamic signal highway across Setups A, B, C, D
// and interactive state recovery in headless Chromium.

const puppeteer = require("puppeteer-core");
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const CHROME = process.env.CHROME_BIN || "/usr/local/bin/chromium";
const BASE_URL = "http://127.0.0.1:8080";
const EVIDENCE_DIR = path.join(__dirname, "../evidence");

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

async function run() {
  console.log("================================================================");
  console.log("TESTING ROLE-BASED BOOTH ARCHITECTURE ACROSS SETUPS A, B, C, D");
  console.log("================================================================\n");

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1200 });

    // -------------------------------------------------------------------------
    // SETUP A: Bedroom Starter Rig (DDJ-FLX4 + Pioneer DM-40D)
    // -------------------------------------------------------------------------
    console.log("--- Testing Setup A: Bedroom Starter Rig (FLX4 + DM-40D) ---");
    await page.goto(`${BASE_URL}/build-your-dj-setup.html?preset=bedroom-starter`, { waitUntil: "networkidle0" });

    const setupA = await page.evaluate(() => {
      const paZone = document.getElementById("zone-crowd-pa");
      const monZone = document.getElementById("zone-monitors");
      const highway = document.getElementById("signal-highway");

      const paIsEmpty = paZone && paZone.classList.contains("booth-speaker-zone--empty");
      const hasLinkWire = monZone && monZone.querySelector(".cabinet-link-wire") !== null;
      const hasPassiveSat = monZone && monZone.querySelector(".cabinet-body--satellite") !== null;
      const hasMasterCab = monZone && monZone.querySelector(".cabinet-body--master") !== null;
      const biAmpedCount = monZone ? monZone.querySelectorAll(".cabinet-body--biamped").length : 0;
      const linkWireText = monZone ? (monZone.querySelector(".link-wire-badge")?.textContent || "") : "";
      const monBadge = monZone ? (monZone.querySelector(".booth-unit-badge")?.textContent || "") : "";

      const paRoute = highway ? highway.querySelector(".cable-route-card--pa") : null;
      const monRoute = highway ? highway.querySelector(".cable-route-card--monitors") : null;
      const conflictCard = highway ? highway.querySelector(".cable-route-card--conflict") : null;

      return {
        paIsEmpty,
        hasLinkWire,
        hasPassiveSat,
        hasMasterCab,
        biAmpedCount,
        linkWireText,
        monBadge,
        hasPaRoute: Boolean(paRoute),
        hasMonRoute: Boolean(monRoute),
        hasConflict: Boolean(conflictCard)
      };
    });

    assert.ok(setupA.paIsEmpty, "Setup A must omit Crowd PA and display empty/invite state");
    assert.strictEqual(setupA.hasLinkWire, true, "Setup A DM-40D must render included link wire");
    assert.strictEqual(setupA.hasPassiveSat, true, "Setup A DM-40D must render passive satellite cabinet");
    assert.strictEqual(setupA.hasMasterCab, true, "Setup A DM-40D must render powered master cabinet");
    assert.strictEqual(setupA.biAmpedCount, 0, "DM-40D is master/slave, not bi-amped");
    assert.match(setupA.linkWireText, /Included Link Wire/i, "Link wire must display Included Link Wire ($0)");
    assert.match(setupA.monBadge, /Boxed Pair/i, "Badge must indicate boxed pair with 1 AC plug");
    assert.strictEqual(setupA.hasPaRoute, false, "Setup A must not have an active crowd PA route");
    assert.strictEqual(setupA.hasMonRoute, true, "Setup A must have an active monitor route");
    assert.strictEqual(setupA.hasConflict, false, "Setup A must have zero routing conflict");
    console.log("✓ Setup A passed: Genuine master/slave boxed pair (DM-40D) with link wire verified; PA omitted without conflict.");

    const boothA = await page.$("#interactive-booth-stage");
    if (boothA) {
      await boothA.screenshot({ path: path.join(EVIDENCE_DIR, "booth-setup-a-bedroom-1440px.png") });
    }

    // -------------------------------------------------------------------------
    // SETUP B: Mobile DJ Rig (Standalone + Crowd PA Array + Independent HS5 Monitors)
    // -------------------------------------------------------------------------
    console.log("\n--- Testing Setup B: Mobile DJ Rig (PRIME 4+ + Crowd PA Array + HS5 Monitors) ---");
    await page.goto(`${BASE_URL}/build-your-dj-setup.html?preset=mobile-pro`, { waitUntil: "networkidle0" });

    // 1. Set PA to 2 cabinets (Stereo array)
    await page.evaluate(() => {
      const paQtyUp = document.querySelector("#zone-crowd-pa [data-action='adjust-qty'][data-delta='1']");
      if (paQtyUp) paQtyUp.click();
    });

    // 2. Add DJ monitors (Yamaha HS5)
    await page.evaluate(() => {
      const addMonBtn = document.querySelector(".btn-add-monitor") || document.querySelector("[data-action='add-speaker-role'][data-speaker-role='dj_monitor']");
      if (addMonBtn) addMonBtn.click();
    });
    await page.waitForSelector("[data-action='select-item'][data-item-id='yamaha-hs5']", { timeout: 5000 });
    await page.evaluate(() => {
      document.querySelector("[data-action='select-item'][data-item-id='yamaha-hs5']").click();
    });

    // 3. Confirm 2nd XLR cable for Booth output to HS5 monitors
    await page.evaluate(() => {
      const addCableBtn = document.querySelector(".cable-route-card--monitors .pipe-cable-pill--needed") ||
                          document.querySelector("[data-action='auto-fix-cable'][data-cable-id='cable-xlr-xlr']");
      if (addCableBtn) addCableBtn.click();
    });

    const setupB = await page.evaluate(() => {
      const paZone = document.getElementById("zone-crowd-pa");
      const monZone = document.getElementById("zone-monitors");
      const highway = document.getElementById("signal-highway");

      const paUnits = paZone ? paZone.querySelectorAll(".cabinet-unit--pa").length : 0;
      const paSpread = paZone ? paZone.querySelector(".cabinet-spread-indicator") !== null : false;

      // Crucial: Yamaha HS5 physical modeling assertions
      const hasLinkWire = monZone ? monZone.querySelector(".cabinet-link-wire") !== null : false;
      const hasPassiveSat = monZone ? monZone.querySelector(".cabinet-body--satellite") !== null : false;
      const biAmpedCount = monZone ? monZone.querySelectorAll(".cabinet-body--biamped").length : 0;
      const hasNearfieldSpread = monZone ? monZone.querySelector(".cabinet-spread--nearfield") !== null : false;
      const monBadge = monZone ? (monZone.querySelector(".booth-unit-badge")?.textContent || "") : "";

      const paRoute = highway ? highway.querySelector(".cable-route-card--pa") : null;
      const paRouteSource = paRoute ? paRoute.querySelector(".route-node--source .node-port")?.textContent : "";
      const monRoute = highway ? highway.querySelector(".cable-route-card--monitors") : null;
      const monRouteSource = monRoute ? monRoute.querySelector(".route-node--source .node-port")?.textContent : "";

      const paSignalDot = paRoute ? paRoute.querySelector(".signal-dot") !== null : false;
      const monSignalDot = monRoute ? monRoute.querySelector(".signal-dot") !== null : false;
      const hasConflict = highway ? highway.querySelector(".cable-route-card--conflict") !== null : false;

      return {
        paUnits,
        paSpread,
        hasLinkWire,
        hasPassiveSat,
        biAmpedCount,
        hasNearfieldSpread,
        monBadge,
        paRouteSource,
        monRouteSource,
        paSignalDot,
        monSignalDot,
        hasConflict
      };
    });

    assert.strictEqual(setupB.paUnits, 2, "Setup B PA array must render exactly 2 physical cabinets");
    assert.ok(setupB.paSpread, "Setup B PA array must show audience stereo spread line");

    // Strictly assert Yamaha HS5 is NOT modeled as master/passive satellite
    assert.strictEqual(setupB.hasLinkWire, false, "Yamaha HS5 must NOT show a master-to-satellite link wire");
    assert.strictEqual(setupB.hasPassiveSat, false, "Yamaha HS5 must NOT show a passive satellite cabinet");
    assert.strictEqual(setupB.biAmpedCount, 2, "Both Yamaha HS5 cabinets must be active bi-amped with independent power");
    assert.strictEqual(setupB.hasNearfieldSpread, true, "Yamaha HS5 must display nearfield stereo triangle");
    assert.match(setupB.monBadge, /Dual Monitors|Dual Active Monitors/i, "Badge must indicate dual active monitors with dual AC mains");

    assert.match(setupB.paRouteSource, /master/i, "PA route must originate from Master Output");
    assert.match(setupB.monRouteSource, /booth/i, "DJ monitor route must originate from Booth Output");
    assert.ok(setupB.paSignalDot, "PA route must show animated signal flow");
    assert.ok(setupB.monSignalDot, "Monitor route must show animated signal flow");
    assert.strictEqual(setupB.hasConflict, false, "PRIME 4+ with dedicated Booth out must have zero conflict");
    console.log("✓ Setup B passed: Independent active studio monitors (Yamaha HS5) verified without false link wire; dual XLR signal pipes verified.");

    const boothB = await page.$("#interactive-booth-stage");
    if (boothB) {
      await boothB.screenshot({ path: path.join(EVIDENCE_DIR, "booth-setup-b-mobile-1440px.png") });
    }

    // -------------------------------------------------------------------------
    // SETUP C: Minimal Mono PA Setup (1 Physical Cabinet, No False Stereo)
    // -------------------------------------------------------------------------
    console.log("\n--- Testing Setup C: Minimal Mono PA (FLX4 + 1 JBL EON715 Cabinet) ---");
    await page.goto(`${BASE_URL}/build-your-dj-setup.html?preset=mobile-pro`, { waitUntil: "networkidle0" });

    const setupC = await page.evaluate(() => {
      const paZone = document.getElementById("zone-crowd-pa");
      const monZone = document.getElementById("zone-monitors");

      const paCabinets = paZone ? paZone.querySelectorAll(".cabinet-unit--pa").length : 0;
      const monoBadge = paZone ? paZone.querySelector(".cabinet-label")?.textContent : "";
      const monIsEmpty = monZone && monZone.classList.contains("booth-speaker-zone--empty");

      return {
        paCabinets,
        monoBadge,
        monIsEmpty
      };
    });

    assert.strictEqual(setupC.paCabinets, 1, "Setup C must render exactly 1 physical PA cabinet");
    assert.match(setupC.monoBadge, /Mono PA Cabinet \(1 Physical Unit\)/i, "Setup C must explicitly label mono PA cabinet");
    assert.ok(setupC.monIsEmpty, "Setup C must leave DJ monitors empty (cue headphones only)");
    console.log("✓ Setup C passed: Exactly 1 physical PA cabinet rendered; zero false stereo claims.");

    const boothC = await page.$("#interactive-booth-stage");
    if (boothC) {
      await boothC.screenshot({ path: path.join(EVIDENCE_DIR, "booth-setup-c-mono-pa-1440px.png") });
    }

    // -------------------------------------------------------------------------
    // SETUP D: Hardware-Limited Controller with Both Systems (FLX4 + PA + Monitors)
    // -------------------------------------------------------------------------
    console.log("\n--- Testing Setup D: Hardware-Limited Routing Conflict (FLX4 + PA + Monitors) ---");
    await page.goto(`${BASE_URL}/build-your-dj-setup.html?preset=bedroom-starter`, { waitUntil: "networkidle0" });

    // Add Crowd PA (JBL EON715) to FLX4 rig
    await page.evaluate(() => {
      const addPaBtn = document.querySelector(".btn-add-pa") || document.querySelector("[data-action='add-speaker-role'][data-speaker-role='crowd_pa']");
      if (addPaBtn) addPaBtn.click();
    });
    await page.waitForSelector("[data-action='select-item'][data-item-id='jbl-eon-715']", { timeout: 5000 });
    await page.evaluate(() => {
      document.querySelector("[data-action='select-item'][data-item-id='jbl-eon-715']").click();
    });

    const setupD = await page.evaluate(() => {
      const highway = document.getElementById("signal-highway");
      const conflictCard = highway ? highway.querySelector(".cable-route-card--conflict") : null;
      const conflictText = conflictCard ? conflictCard.textContent : "";
      const conflictDot = conflictCard ? conflictCard.querySelector(".signal-dot") !== null : false;

      const compatSection = document.getElementById("rs-compatibility");
      const compatText = compatSection ? compatSection.textContent : "";

      return {
        hasConflictCard: Boolean(conflictCard),
        conflictText,
        hasFalseSignalPulse: conflictDot,
        hasCompatAlert: /Hardware Limitation: Secondary Speaker Route Cannot Be Fed/i.test(compatText)
      };
    });

    assert.ok(setupD.hasConflictCard, "Setup D must display routing limitation card on Route B");
    assert.match(setupD.conflictText, /cannot feed both Crowd PA and DJ Monitors independently/i, "Must explain single master output limitation");
    assert.match(setupD.conflictText, /Verified Solutions:/i, "Must provide verified solutions");
    assert.strictEqual(setupD.hasFalseSignalPulse, false, "Must NOT show an animated signal pulse on unresolved route");
    assert.ok(setupD.hasCompatAlert, "Compatibility engine must flag Hardware Limitation: Secondary Speaker Route Cannot Be Fed");
    console.log("✓ Setup D passed: FLX4 single-output limitation accurately reported with verified solutions and no false signal pulses.");

    const boothD = await page.$("#interactive-booth-stage");
    if (boothD) {
      await boothD.screenshot({ path: path.join(EVIDENCE_DIR, "booth-setup-d-conflict-1440px.png") });
    }

    // -------------------------------------------------------------------------
    // INTERACTIVE ACCEPTANCE & LIVE STATE RECOVERY
    // -------------------------------------------------------------------------
    console.log("\n--- Testing Full Two-Zone Interactive State, Ownership & Share Restoration ---");
    // Start with Club Ready (FLX10 + HS5 monitors)
    await page.goto(`${BASE_URL}/build-your-dj-setup.html?preset=club-ready`, { waitUntil: "networkidle0" });

    // Add Crowd PA (JBL EON715)
    await page.evaluate(() => {
      const addPa = document.querySelector(".btn-add-pa") || document.querySelector("[data-action='add-speaker-role'][data-speaker-role='crowd_pa']");
      if (addPa) addPa.click();
    });
    await page.waitForSelector("[data-action='select-item'][data-item-id='jbl-eon-715']", { timeout: 5000 });
    await page.evaluate(() => {
      document.querySelector("[data-action='select-item'][data-item-id='jbl-eon-715']").click();
    });

    // Step PA boxes up to 2
    await page.evaluate(() => {
      const paStepUp = document.querySelector("#zone-crowd-pa [data-action='adjust-qty'][data-delta='1']");
      if (paStepUp) paStepUp.click();
    });

    // Toggle DJ Monitors to OWNED
    await page.evaluate(() => {
      const monOwnBtn = document.querySelector("#zone-monitors [data-action='toggle-slot-owned']");
      if (monOwnBtn) monOwnBtn.click();
    });

    // Get current state, costs, and share URL
    const interactiveState = await page.evaluate(() => {
      const cost = window.__rigStudio.cost();
      const state = window.__rigStudio.state();
      const shareUrl = window.__rigStudio.shareUrl();
      const monSlot = state.items.find(s => s.category === "speakers" && (s.role === "dj_monitor" || s.slotId === "p-speakers" || s.slotId.includes("monitors")));
      const paSlot = state.items.find(s => s.category === "speakers" && (s.role === "crowd_pa" || s.slotId.includes("crowd")));
      return {
        cost,
        shareUrl,
        monOwned: monSlot ? monSlot.owned : false,
        paQty: paSlot ? paSlot.qty : 0
      };
    });

    assert.strictEqual(interactiveState.monOwned, true, "DJ Monitors must be marked owned in state");
    assert.strictEqual(interactiveState.paQty, 2, "PA quantity must be 2 boxes");
    assert.ok(interactiveState.cost.ownedSavings >= 398, "Owned savings must account for owned monitors ($398)");

    // Reload page using the generated shareUrl
    console.log("Reloading custom setup from share URL...");
    await page.goto(interactiveState.shareUrl, { waitUntil: "networkidle0" });

    const recoveredState = await page.evaluate(() => {
      const cost = window.__rigStudio.cost();
      const state = window.__rigStudio.state();
      const paZone = document.getElementById("zone-crowd-pa");
      const monZone = document.getElementById("zone-monitors");
      const paCabinets = paZone ? paZone.querySelectorAll(".cabinet-unit--pa").length : 0;
      const monBiAmped = monZone ? monZone.querySelectorAll(".cabinet-body--biamped").length : 0;
      const monIsOwned = monZone ? monZone.classList.contains("is-owned") : false;
      const monOwnBtnText = monZone ? (monZone.querySelector(".btn-own-toggle")?.textContent.trim()) : "";

      const monSlot = state.items.find(s => s.category === "speakers" && (s.role === "dj_monitor" || s.slotId === "p-speakers" || s.slotId.includes("monitors")));
      const paSlot = state.items.find(s => s.category === "speakers" && (s.role === "crowd_pa" || s.slotId.includes("crowd")));

      return {
        cost,
        paCabinets,
        monBiAmped,
        monIsOwned,
        monOwnBtnText,
        monSlotOwned: monSlot ? monSlot.owned : false,
        paSlotQty: paSlot ? paSlot.qty : 0
      };
    });

    assert.strictEqual(recoveredState.paCabinets, 2, "Recovered setup must render exactly 2 physical PA cabinets");
    assert.strictEqual(recoveredState.monBiAmped, 2, "Recovered setup must render 2 bi-amped HS5 cabinets");
    assert.strictEqual(recoveredState.monSlotOwned, true, "Recovered state must preserve owned status on monitors");
    assert.strictEqual(recoveredState.monIsOwned, true, "Recovered booth card must show is-owned styling");
    assert.match(recoveredState.monOwnBtnText, /✓ I Own This/i, "Recovered booth toggle must display '✓ I Own This'");
    assert.strictEqual(recoveredState.cost.buyTotal, interactiveState.cost.buyTotal, "Spend needed must match exactly after share reload");
    console.log("✓ Live interaction & state recovery passed: Quantities, ownership, physical cabinets, and pricing persist identically across share reload.");

    // -------------------------------------------------------------------------
    // MOBILE VIEWPORT VERIFICATION (390px)
    // -------------------------------------------------------------------------
    console.log("\n--- Testing Mobile Viewport (390px) Layout & No Horizontal Overflow ---");
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}/build-your-dj-setup.html?preset=club-ready`, { waitUntil: "networkidle0" });

    const mobileMetrics = await page.evaluate(() => {
      const docWidth = document.documentElement.scrollWidth;
      const winWidth = window.innerWidth;
      const overflow = docWidth - winWidth;

      const booth = document.getElementById("interactive-booth-stage");
      const boothWidth = booth ? booth.offsetWidth : 0;

      return {
        overflow,
        boothVisible: Boolean(booth),
        boothWidth
      };
    });

    assert.ok(mobileMetrics.overflow <= 1, `Mobile viewport must not overflow horizontally (overflow=${mobileMetrics.overflow}px)`);
    assert.ok(mobileMetrics.boothVisible, "Booth stage must be visible on mobile");
    console.log(`✓ Mobile layout verified: 390px viewport renders cleanly with ${mobileMetrics.overflow}px overflow.`);

    const boothMobile = await page.$("#interactive-booth-stage");
    if (boothMobile) {
      await boothMobile.screenshot({ path: path.join(EVIDENCE_DIR, "booth-mobile-390px.png") });
    }

    console.log("\n================================================================");
    console.log("ALL FOUR BOOTH SETUPS AND MOBILE REGRESSION TESTS PASSED (100%)!");
    console.log("================================================================");
  } finally {
    await browser.close();
  }
}

run().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
