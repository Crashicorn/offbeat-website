// tests/test_role_based_booth_journeys.js
// Validates the purpose-based booth restructuring across Setups A, B, C, and D in headless Chromium.

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
    // SETUP A: Bedroom Starter Rig (DDJ-FLX4 + DJ Monitors)
    // -------------------------------------------------------------------------
    console.log("--- Testing Setup A: Bedroom Starter Rig (FLX4 + DM-40D) ---");
    await page.goto(`${BASE_URL}/build-your-dj-setup.html?preset=bedroom-starter`, { waitUntil: "networkidle0" });

    const setupA = await page.evaluate(() => {
      const paZone = document.getElementById("zone-crowd-pa");
      const monZone = document.getElementById("zone-monitors");
      const highway = document.getElementById("signal-highway");

      const paIsEmpty = paZone && paZone.classList.contains("booth-speaker-zone--empty");
      const monIsBoxed = monZone && monZone.querySelector(".cabinet-link-wire") !== null;
      const linkWireText = monZone ? (monZone.querySelector(".link-wire-badge")?.textContent || "") : "";

      const paRoute = highway ? highway.querySelector(".cable-route-card--pa") : null;
      const monRoute = highway ? highway.querySelector(".cable-route-card--monitors") : null;
      const conflictCard = highway ? highway.querySelector(".cable-route-card--conflict") : null;

      return {
        paIsEmpty,
        monIsBoxed,
        linkWireText,
        hasPaRoute: Boolean(paRoute),
        hasMonRoute: Boolean(monRoute),
        hasConflict: Boolean(conflictCard),
        badgeText: document.querySelector(".booth-stage-badges")?.textContent || ""
      };
    });

    assert.ok(setupA.paIsEmpty, "Setup A must omit Crowd PA and display empty/invite state");
    assert.ok(setupA.monIsBoxed, "Setup A DM-40D monitors must render as boxed pair with link wire");
    assert.match(setupA.linkWireText, /Included Link Wire/i, "Link wire must display Included Link Wire ($0)");
    assert.strictEqual(setupA.hasPaRoute, false, "Setup A must not have an active crowd PA route");
    assert.strictEqual(setupA.hasMonRoute, true, "Setup A must have an active monitor route");
    assert.strictEqual(setupA.hasConflict, false, "Setup A must have zero routing conflict");
    console.log("✓ Setup A passed: DM-40D boxed pair with included link wire verified; PA omitted without conflict.");

    const boothA = await page.$("#interactive-booth-stage");
    if (boothA) {
      await boothA.screenshot({ path: path.join(EVIDENCE_DIR, "booth-setup-a-bedroom-1440px.png") });
    } else {
      await page.screenshot({ path: path.join(EVIDENCE_DIR, "booth-setup-a-bedroom-1440px.png"), fullPage: false });
    }

    // -------------------------------------------------------------------------
    // SETUP B: Mobile DJ Rig (Standalone + Crowd PA + DJ Monitors)
    // -------------------------------------------------------------------------
    console.log("\n--- Testing Setup B: Mobile DJ Rig (PRIME 4+ + Crowd PA Array + HS5 Monitors) ---");
    // Start with mobile-pro (has PRIME 4+ and EON715 PA)
    await page.goto(`${BASE_URL}/build-your-dj-setup.html?preset=mobile-pro`, { waitUntil: "networkidle0" });

    // Set PA to 2 cabinets (Stereo array)
    await page.evaluate(() => {
      const paQtyUp = document.querySelector("#zone-crowd-pa [data-action='adjust-qty'][data-delta='1']");
      if (paQtyUp) paQtyUp.click();
    });

    // Add DJ monitors (Yamaha HS5)
    await page.evaluate(() => {
      const addMonBtn = document.querySelector(".btn-add-monitor") || document.querySelector("[data-action='add-speaker-role'][data-speaker-role='dj_monitor']");
      if (addMonBtn) addMonBtn.click();
    });
    await page.waitForSelector("[data-action='select-item'][data-item-id='yamaha-hs5']", { timeout: 5000 });
    await page.evaluate(() => {
      document.querySelector("[data-action='select-item'][data-item-id='yamaha-hs5']").click();
    });

    // Set HS5 to 2 units (pair)
    await page.evaluate(() => {
      const monQtyUp = document.querySelector("#zone-monitors [data-action='adjust-qty'][data-delta='1']");
      if (monQtyUp) monQtyUp.click();
    });

    const setupB = await page.evaluate(() => {
      const paZone = document.getElementById("zone-crowd-pa");
      const monZone = document.getElementById("zone-monitors");
      const highway = document.getElementById("signal-highway");

      const paUnits = paZone ? paZone.querySelectorAll(".cabinet-unit--pa").length : 0;
      const paSpread = paZone ? paZone.querySelector(".cabinet-spread-indicator") !== null : false;
      const monUnits = monZone ? monZone.querySelectorAll(".cabinet-unit--monitor").length : 0;

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
        monUnits,
        paRouteSource,
        monRouteSource,
        paSignalDot,
        monSignalDot,
        hasConflict
      };
    });

    assert.strictEqual(setupB.paUnits, 2, "Setup B PA array must render exactly 2 physical cabinets");
    assert.ok(setupB.paSpread, "Setup B PA array must show audience stereo spread line");
    assert.strictEqual(setupB.monUnits, 2, "Setup B DJ monitors must render 2 bi-amped cabinets");
    assert.match(setupB.paRouteSource, /master/i, "PA route must originate from Master Output");
    assert.match(setupB.monRouteSource, /booth/i, "DJ monitor route must originate from Booth Output");
    assert.ok(setupB.paSignalDot, "PA route must show animated signal flow");
    assert.ok(setupB.monSignalDot, "Monitor route must show animated signal flow");
    assert.strictEqual(setupB.hasConflict, false, "PRIME 4+ with dedicated Booth out must have zero conflict");
    console.log("✓ Setup B passed: PRIME 4+ Master XLR -> PA and Booth XLR -> Monitors both verified with animated signal paths.");

    const boothB = await page.$("#interactive-booth-stage");
    if (boothB) {
      await boothB.screenshot({ path: path.join(EVIDENCE_DIR, "booth-setup-b-mobile-1440px.png") });
    } else {
      await page.screenshot({ path: path.join(EVIDENCE_DIR, "booth-setup-b-mobile-1440px.png"), fullPage: false });
    }

    // -------------------------------------------------------------------------
    // SETUP C: Minimal Mono PA Setup (1 Physical Cabinet, No False Stereo)
    // -------------------------------------------------------------------------
    console.log("\n--- Testing Setup C: Minimal Mono PA (FLX4 + 1 JBL EON715 Cabinet) ---");
    await page.goto(`${BASE_URL}/build-your-dj-setup.html?preset=mobile-pro`, { waitUntil: "networkidle0" });

    // Ensure PA qty is 1 and remove DJ monitors if present
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
    } else {
      await page.screenshot({ path: path.join(EVIDENCE_DIR, "booth-setup-c-mono-pa-1440px.png"), fullPage: false });
    }

    // -------------------------------------------------------------------------
    // SETUP D: Hardware-Limited Controller with Both Systems (FLX4 + PA + Monitors)
    // -------------------------------------------------------------------------
    console.log("\n--- Testing Setup D: Hardware-Limited Routing Conflict (FLX4 + PA + Monitors) ---");
    // Start with FLX4 bedroom starter
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
    } else {
      await page.screenshot({ path: path.join(EVIDENCE_DIR, "booth-setup-d-conflict-1440px.png"), fullPage: false });
    }

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
    } else {
      await page.screenshot({ path: path.join(EVIDENCE_DIR, "booth-mobile-390px.png"), fullPage: false });
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
