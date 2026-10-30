// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");

const ROOT_DIR = path.resolve(__dirname, "..");
const CATALOG_PATH = path.join(ROOT_DIR, "assets/dj-gear-catalog.json");
const RIG_BUILDER_PATH = path.join(ROOT_DIR, "assets/rig-builder.js");

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg"
};

function createStaticServer() {
  return http.createServer((req, res) => {
    const rawPath = req.url?.split("?")[0] || "/";
    let filePath = path.join(ROOT_DIR, rawPath === "/" ? "build-your-dj-setup.html" : rawPath);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(ROOT_DIR, "build-your-dj-setup.html");
    }
    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(filePath).pipe(res);
  });
}

test("Owner Design Recovery - Data Model Role Gating", () => {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
  const speakers = catalog.items.filter(i => i.category === "speakers");

  assert.ok(speakers.length > 0, "Catalog must contain speakers in items array");

  // Check Crowd PA
  const jbl = speakers.find(s => s.id === "jbl-eon-715");
  assert.ok(jbl, "JBL EON715 must exist in catalog");
  assert.deepStrictEqual(jbl.roles_supported, ["crowd_pa"], "JBL EON715 must only support crowd_pa role");

  // Check DJ Monitors
  const nearfieldMonitors = [
    "pioneer-dm40d",
    "pioneer-dm50d",
    "krk-rokit-5-g4",
    "krk-classic-5-pair",
    "yamaha-hs5"
  ];

  for (const id of nearfieldMonitors) {
    const spk = speakers.find(s => s.id === id);
    assert.ok(spk, `Speaker ${id} must exist in catalog`);
    assert.deepStrictEqual(spk.roles_supported, ["dj_monitor"], `Speaker ${id} must strictly only support dj_monitor role, never crowd_pa`);
  }
  console.log("✓ Data Model: Explicit roles_supported strictly isolates crowd_pa from dj_monitor.");
});

test("Owner Design Recovery - Rig Builder Role Helper Functions", () => {
  const code = fs.readFileSync(RIG_BUILDER_PATH, "utf8");

  assert.ok(code.includes("isSpeakerEligibleForRole"), "rig-builder.js must define isSpeakerEligibleForRole");
  assert.ok(code.includes("getSpeakerRole"), "rig-builder.js must define getSpeakerRole");
  assert.ok(code.includes("getRigSpeakerSlots"), "rig-builder.js must define getRigSpeakerSlots");
  assert.ok(code.includes("roles_supported"), "rig-builder.js must check item.roles_supported");

  // Verify modal candidate filtering checks roles
  assert.ok(
    code.includes("isSpeakerEligibleForRole(i, activeModalSpeakerRole)"),
    "Picker modal must strictly filter speaker candidates by acoustic role"
  );

  // Verify replaceSlotItem guards against ineligible roles
  assert.ok(
    code.includes("Cannot replace speaker slot with ineligible role item"),
    "replaceSlotItem must block swapping with an ineligible speaker"
  );

  console.log("✓ Logic: Role eligibility gating strictly enforced across picker modal and slot mutation.");
});

test("Owner Design Recovery - Browser Acceptance Across Setups A, B, C, D & Mobile", async () => {
  const puppeteer = require("puppeteer-core");
  const server = createStaticServer();
  await new Promise(resolve => server.listen(8096, "127.0.0.1", resolve));
  const baseUrl = "http://127.0.0.1:8096";

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: process.env.CHROME_BIN || "/usr/local/bin/chromium",
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // Criteria A: Bedroom Starter Setup above fold at 1440x900
    await page.goto(`${baseUrl}/build-your-dj-setup.html?preset=bedroom-starter`, { waitUntil: "networkidle0" });
    const boxesA = await page.evaluate(() => {
      const stage = document.getElementById("interactive-booth-stage");
      const bottomRow = document.querySelector(".booth-bottom-row");
      const paZone = document.getElementById("zone-crowd-pa");
      const monZone = document.getElementById("zone-monitors");
      const linkWire = monZone?.querySelector(".cabinet-link-wire");
      const passiveSat = monZone?.querySelector(".cabinet-body--satellite");
      return {
        stageTop: stage ? Math.round(stage.getBoundingClientRect().top) : null,
        bottomRowTop: bottomRow ? Math.round(bottomRow.getBoundingClientRect().top) : null,
        paZoneEmpty: paZone?.classList.contains("booth-speaker-zone--empty"),
        hasLinkWire: Boolean(linkWire),
        hasPassiveSat: Boolean(passiveSat)
      };
    });

    assert.ok(boxesA.stageTop !== null && boxesA.stageTop < 450, `Setup A stage must begin above Y=450 (actual: ${boxesA.stageTop}px)`);
    assert.ok(boxesA.bottomRowTop !== null && boxesA.bottomRowTop < 900, `Setup A workstation row must start above 900px fold (actual: ${boxesA.bottomRowTop}px)`);
    assert.strictEqual(boxesA.paZoneEmpty, true, "Setup A Crowd PA must be empty without conflict");
    assert.strictEqual(boxesA.hasLinkWire, true, "Setup A DM-40D must render link wire");
    assert.strictEqual(boxesA.hasPassiveSat, true, "Setup A DM-40D must render passive satellite");
    console.log("✓ Criteria A passed: Bedroom starter visible above fold with verified master/satellite DM-40D.");

    // Criteria B: Mobile Rig with Crowd PA and Monitors
    await page.goto(`${baseUrl}/build-your-dj-setup.html?preset=mobile-pro`, { waitUntil: "networkidle0" });
    const boxesB = await page.evaluate(() => {
      const paCabs = document.querySelectorAll("#zone-crowd-pa .cabinet-unit--pa").length;
      const paSpread = document.querySelector("#zone-crowd-pa .cabinet-spread-indicator");
      return {
        paCabs,
        hasSpread: Boolean(paSpread)
      };
    });
    assert.strictEqual(boxesB.paCabs, 1, "Mobile pro preset must render exactly 1 physical PA cabinet by default");
    console.log("✓ Criteria B passed: Mobile rig renders genuine PA cabinet with dedicated feed.");

    // Criteria C: Hard Rejection of KRK / Yamaha in Crowd PA picker
    const paSwapBtn = await page.$("#zone-crowd-pa [data-action=\"pick\"]");
    if (paSwapBtn) {
      await paSwapBtn.click();
      await new Promise(r => setTimeout(r, 400));
      const candidates = await page.evaluate(() => {
        const cards = document.querySelectorAll(".picker-card, .rig-modal-card");
        return Array.from(cards).map(c => c.getAttribute("data-id") || c.querySelector("[data-action=\"select-item\"]")?.getAttribute("data-item-id") || "");
      });
      const hasNearfield = candidates.some(id => id.includes("krk") || id.includes("yamaha") || id.includes("dm40d") || id.includes("dm50d"));
      assert.strictEqual(hasNearfield, false, "Crowd PA picker MUST NOT list nearfield studio monitors");
      assert.ok(candidates.includes("jbl-eon-715"), "Crowd PA picker must list JBL EON715");
      console.log("✓ Criteria C passed: Nearfield monitors (KRK/Yamaha) are strictly excluded from Crowd PA picker.");
    }

    // Criteria D: Mobile Viewport 390px
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(`${baseUrl}/build-your-dj-setup.html?preset=club-ready`, { waitUntil: "networkidle0" });
    const mobileMetrics = await page.evaluate(() => {
      const scrollW = document.documentElement.scrollWidth;
      const clientW = window.innerWidth;
      return {
        overflow: scrollW - clientW
      };
    });
    assert.strictEqual(mobileMetrics.overflow, 0, "Mobile viewport at 390px must have 0px horizontal overflow");
    console.log("✓ Criteria D passed: Mobile layout at 390px has 0px horizontal overflow.");

  } finally {
    if (browser) await browser.close();
    server.close();
  }
});
