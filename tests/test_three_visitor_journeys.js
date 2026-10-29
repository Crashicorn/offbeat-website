/*
 * Verification test for the three primary visitor journeys:
 *
 * Journey A: DJ Software selection based on hardware, OS, streaming, and ownership cost.
 * Journey B: Assembling and customizing a complete working DJ rig in Rig Studio,
 *            swapping controllers, adding accessories, handling cable reconciliation,
 *            toggling owned equipment, and obtaining a shareable shopping/setup plan.
 * Journey C: Comparing standalone systems (XDJ-AZ vs Prime 4+), verifying streaming/media
 *            tradeoffs, and traversing interactive bridges to Software Advisor and Rig Studio.
 *
 * Run:
 *   node tests/test_three_visitor_journeys.js
 */

const assert = require("assert");
const http = require("http");
const fs = require("fs");
const path = require("path");

function loadPuppeteer() {
  const candidates = [
    process.env.PUPPETEER_CORE,
    "/tmp/browser/node_modules/puppeteer-core",
    "/tmp/node_modules/puppeteer-core",
    "puppeteer-core"
  ].filter(Boolean);
  for (const c of candidates) {
    try { return require(c); } catch (e) {}
  }
  throw new Error("puppeteer-core not found");
}

const puppeteer = loadPuppeteer();
const CHROME_PATH = process.env.CHROME_PATH || "/usr/local/bin/chromium";
const PORT = 8995;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const ROOT = path.resolve(__dirname, "..");

function startStaticServer() {
  const mime = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".woff2": "font/woff2"
  };

  const server = http.createServer((req, res) => {
    let reqPath = req.url.split("?")[0].split("#")[0];
    if (reqPath === "/") reqPath = "/index.html";
    const filePath = path.join(ROOT, decodeURIComponent(reqPath));

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": mime[ext] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}

(async () => {
  console.log("Starting server for three visitor journeys test...");
  const server = await startStaticServer();

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
  });

  try {
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on("pageerror", err => consoleErrors.push(err.message));
    page.on("console", msg => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    // =========================================================================
    // JOURNEY A: Software Advisor
    // =========================================================================
    console.log("\n--- Testing Journey A: Software Selection & Ownership Cost ---");
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/dj-software-hub.html`, { waitUntil: "networkidle0" });

    // Verify 7 questions rendered
    const questionCount = await page.$$eval(".swa-question", els => els.length);
    assert.strictEqual(questionCount, 7, "Journey A: 7 questions rendered in advisor");

    // Select XDJ-AZ standalone setup: mode=standalone, hardware=xdj_az, os=macos, music=streaming, budget=free
    await page.click('input[name="sw_mode"][value="standalone"]');
    await page.click('input[name="sw_hardware"][value="xdj_az"]');
    await page.click('input[name="sw_os"][value="macos"]');
    const toggleRefine = await page.$('[data-swa-toggle-refine]');
    if (toggleRefine) await toggleRefine.click();
    await page.click('input[name="sw_music"][value="streaming"]');
    await page.click('input[name="sw_budget"][value="free"]');

    // Wait for card updates
    await page.waitForSelector(".swa-card");
    const advisorResults = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll(".swa-card")).map(c => {
        const title = c.querySelector("h4") ? c.querySelector("h4").textContent.trim() : "";
        const badge = c.querySelector(".swa-badge") ? c.querySelector(".swa-badge").textContent.trim() : "";
        const text = c.textContent;
        const links = Array.from(c.querySelectorAll(".swa-next a")).map(a => ({
          href: a.getAttribute("href"),
          text: a.textContent.trim()
        }));
        return { title, badge, text, links };
      });
      const nextSteps = document.querySelector(".swa-next-steps");
      return {
        cards,
        hasBridge: !!nextSteps,
        bridgeTitle: nextSteps ? nextSteps.querySelector("h4").textContent.trim() : ""
      };
    });

    const rbCard = advisorResults.cards.find(c => c.title === "rekordbox");
    assert.ok(rbCard, "rekordbox card present for XDJ-AZ standalone");
    assert.strictEqual(rbCard.badge, "No licence cost", "rekordbox Free tier prepares XDJ-AZ standalone");
    assert.ok(rbCard.text.includes("Spotify StreamingDirectPlay"), "rekordbox standalone note highlights Spotify StreamingDirectPlay on XDJ-AZ");
    assert.ok(rbCard.links.some(l => l.href.includes("build-your-dj-setup.html")), "rekordbox card links to Rig Studio setup planning");

    const engineCard = advisorResults.cards.find(c => c.title === "Engine DJ");
    assert.ok(engineCard, "Engine DJ card present");
    assert.strictEqual(engineCard.badge, "Doesn't fit", "Engine DJ does not drive XDJ-AZ");

    assert.ok(advisorResults.hasBridge, "Software Advisor renders next-steps Rig Studio bridge");
    console.log("✓ Journey A verified: XDJ-AZ standalone streaming logic, $0 prep tier, and Rig Studio bridge verified.");

    // =========================================================================
    // JOURNEY B: Rig Studio Assembly, Customization & Usable Shopping Plan
    // =========================================================================
    console.log("\n--- Testing Journey B: Rig Studio Equipment Assembly & Planning ---");
    await page.goto(`${BASE_URL}/build-your-dj-setup.html?preset=club-ready`, { waitUntil: "networkidle0" });

    const initialCost = await page.evaluate(() => window.__rigStudio.cost());
    console.log("Initial club-ready rig cost:", initialCost);
    assert.strictEqual(initialCost.itemCount, 7, "Club-ready preset has 7 items");

    // 1. Swap controller from FLX10 to Prime 4+
    await page.click(".rs-node--hero, .booth-card--main");
    await page.waitForSelector("button[data-drawer-use='denon-prime-4-plus']");
    await page.evaluate(() => document.querySelector("button[data-drawer-use='denon-prime-4-plus']").click());
    await page.waitForFunction(() => {
      const state = window.__rigStudio.state();
      const ctrl = state.items.find(i => i.category === "controllers");
      return ctrl && ctrl.itemId === "denon-prime-4-plus";
    });

    // 2. Add accessories: Microphone, Laptop Stand, Storage Drive
    // Add microphone
    await page.evaluate(() => {
      const btn = document.querySelector(".rs-add-chip[data-cat='microphones']");
      if (btn) btn.click();
    });
    await page.waitForSelector("button[data-drawer-use='mic-shure-sm58']");
    await page.evaluate(() => document.querySelector("button[data-drawer-use='mic-shure-sm58']").click());
    await new Promise(r => setTimeout(r, 200));

    // Add stand
    await page.evaluate(() => {
      const btn = document.querySelector(".rs-add-chip[data-cat='stands']");
      if (btn) btn.click();
    });
    await page.waitForSelector("button[data-drawer-use='laptop-stand-pyle']");
    await page.evaluate(() => document.querySelector("button[data-drawer-use='laptop-stand-pyle']").click());
    await new Promise(r => setTimeout(r, 200));

    // 3. Mark headphones (HD 25) as owned
    await page.evaluate(() => {
      const hpToggle = Array.from(document.querySelectorAll(".rs-own-toggle")).find(b => {
        const item = b.closest(".rs-item");
        return item && item.textContent.includes("HD 25");
      });
      if (hpToggle) hpToggle.click();
    });
    await new Promise(r => setTimeout(r, 200));

    // Check updated cost after customization
    const customizedCost = await page.evaluate(() => window.__rigStudio.cost());
    console.log("Customized cost with Prime 4+, Mic, Stand, and owned headphones:", customizedCost);
    assert.ok(customizedCost.ownedTotal > 100, "Owned total includes owned gear (HD 25 headphones)");
    assert.ok(customizedCost.buyTotal > 0, "Buy total reflects remaining items to purchase");

    // 4. Verify checks and shopping list
    const checks = await page.evaluate(() => window.__rigStudio.checks());
    assert.ok(checks.some(c => c.key === "host" && c.note.includes("runs its own playback")), "Prime 4+ recognized as self-contained standalone host");
    assert.ok(checks.some(c => c.key === "cables" && c.level === "ok"), "Cables cleanly matched for HS5 + Prime 4+");

    // 5. Test share URL reproduction
    const shareUrl = await page.evaluate(() => window.__rigStudio.shareUrl());
    assert.ok(shareUrl.includes("rig="), "Rig Studio creates deep share link with encoded state");

    // Open shared rig in new page
    const sharePage = await browser.newPage();
    await sharePage.goto(shareUrl, { waitUntil: "networkidle0" });
    const restoredCost = await sharePage.evaluate(() => window.__rigStudio.cost());
    assert.strictEqual(restoredCost.buyTotal, customizedCost.buyTotal, "Shared URL perfectly restores buy total");
    assert.strictEqual(restoredCost.ownedTotal, customizedCost.ownedTotal, "Shared URL perfectly restores owned total");
    assert.strictEqual(restoredCost.itemCount, customizedCost.itemCount, "Shared URL perfectly restores item count");
    await sharePage.close();

    console.log("✓ Journey B verified: swapping controllers, adding accessories, owned equipment accounting, cable routing, and share restoration pass.");

    // =========================================================================
    // JOURNEY C: Standalone Comparison, Verification & Interactive Bridges
    // =========================================================================
    console.log("\n--- Testing Journey C: Standalone Hardware Comparison & Ecosystem Bridges ---");
    await page.goto(`${BASE_URL}/xdj-az-vs-denon-prime-4-plus.html`, { waitUntil: "networkidle0" });

    // Verify Spotify StreamingDirectPlay assertion
    const pageText = await page.evaluate(() => document.body.textContent);
    assert.ok(pageText.includes("Spotify StreamingDirectPlay"), "XDJ-AZ confirms Spotify StreamingDirectPlay");
    assert.ok(pageText.includes("Spotify Premium"), "Spotify StreamingDirectPlay specifies Spotify Premium requirement");

    // Verify interactive decision bridge tools
    const bridgeTools = await page.evaluate(() => {
      const section = document.querySelector("#standalone-workflow-tools");
      if (!section) return null;
      const links = Array.from(section.querySelectorAll("a.ofb-btn")).map(a => ({
        href: a.getAttribute("href"),
        text: a.textContent.trim()
      }));
      return links;
    });

    assert.ok(bridgeTools && bridgeTools.length === 2, "Interactive standalone workflow bridge tools present on comparison page");
    assert.ok(bridgeTools.some(l => l.href.includes("dj-software-hub.html#software-advisor")), "Links to Software Advisor with standalone mode preset");
    assert.ok(bridgeTools.some(l => l.href.includes("build-your-dj-setup.html?add=")), "Links to Rig Studio with standalone system preloaded");

    // Verify best-standalone-dj-systems.html bridge as well
    await page.goto(`${BASE_URL}/best-standalone-dj-systems.html`, { waitUntil: "networkidle0" });
    const parentBridge = await page.$("#standalone-decision-tools");
    assert.ok(parentBridge, "Parent standalone guide contains interactive workflow bridge section");

    console.log("✓ Journey C verified: XDJ-AZ vs Prime 4+ facts, Spotify DirectPlay, and interactive bridge navigation pass.");

    assert.strictEqual(consoleErrors.length, 0, `No console errors encountered across any journey: ${consoleErrors.join("; ")}`);
    console.log("\nALL THREE VISITOR JOURNEYS FULLY VALIDATED AND PASSING!");

  } finally {
    await browser.close();
    server.close();
  }
})().catch(err => {
  console.error("Test failed:", err);
  process.exitCode = 1;
});
