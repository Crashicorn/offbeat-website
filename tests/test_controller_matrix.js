/* Browser coverage for the distinct Traktor Play / Traktor Pro entries and FLX4 handoff.
 *
 * Run with a static server on :8099 (or PORT=4173) and local Chromium / Puppeteer:
 *   PUPPETEER_CORE=/path/to/puppeteer-core node tests/test_controller_matrix.js
 */
const assert = require("assert");

function loadPuppeteer() {
  const candidates = [
    process.env.PUPPETEER_CORE,
    "/tmp/browser/node_modules/puppeteer-core",
    "/tmp/node_modules/puppeteer-core",
    "puppeteer-core"
  ].filter(Boolean);
  for (const candidate of candidates) {
    try { return require(candidate); } catch (error) { /* try next */ }
  }
  throw new Error("puppeteer-core not found; set PUPPETEER_CORE to its install path");
}

const puppeteer = loadPuppeteer();
const PORT = process.env.PORT || 8099;
const BASE = `http://127.0.0.1:${PORT}`;

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE || "/tmp/chromium",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
  });
  const errors = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 980 });
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto(`${BASE}/controller-software-compatibility-matrix.html`, { waitUntil: "load" });
    await page.waitForSelector("#mat-flx4 .mat-software-grid", { timeout: 8000 });

    const flx4 = await page.$eval("#mat-flx4", (card) => {
      const statuses = {};
      for (const cell of card.querySelectorAll(".mat-soft-cell")) {
        statuses[cell.querySelector("span").innerText.trim()] = cell.querySelector(".mat-badge").innerText.trim();
      }
      return {
        primary: card.querySelector(".mat-primary").innerText,
        statuses,
        facts: card.querySelector(".mat-quick-facts").innerText,
        platforms: card.querySelector(".mat-more-grid").textContent,
        rig: card.querySelector(".mat-plan-btn").getAttribute("href")
      };
    });
    assert.match(flx4.primary, /Traktor Play/, "the FLX4 summary should identify Traktor Play");
    assert.strictEqual(flx4.statuses["Traktor Play"], "Included", "Traktor Play is listed separately and included");
    assert.strictEqual(flx4.statuses["Traktor Pro"], "Supported", "Traktor Pro support should be listed separately from Traktor Play");
    assert.strictEqual(flx4.statuses["djay Pro"], "Paid", "the paid djay Pro tier should not be presented as included");
    assert.match(flx4.facts, /Controller · compatible app required/, "the matrix should not incorrectly label the FLX4 laptop-only");
    assert.match(flx4.platforms, /selected rekordbox modes also support iOS\/Android/, "the matrix should retain the documented mobile-mode caveat");
    assert.strictEqual(flx4.rig, "build-your-dj-setup.html?add=pioneer-ddj-flx4", "the matrix should hand off the exact catalog product to Rig Studio");
    const versionNote = await page.$eval(".matrix-version-note", (node) => node.innerText);
    assert.match(versionNote, /Traktor Pro 4\.4\.0/i, "the page should identify the documented Pro integration version");
    assert.ok(await page.$('.matrix-version-note a[href^="https://support.native-instruments.com/"]'), "the version note should link to Native Instruments support");

    await page.select("[data-mat-soft]", "traktorplay");
    let shown = await page.$$eval(".matrix-card .mat-title", (nodes) => nodes.map((node) => node.innerText.trim()));
    assert.deepStrictEqual(shown, ["Pioneer DDJ-FLX4"], "the Traktor Play filter should find the FLX4");
    await page.select("[data-mat-soft]", "traktor");
    shown = await page.$$eval(".matrix-card .mat-title", (nodes) => nodes.map((node) => node.innerText.trim()));
    assert.ok(shown.includes("Pioneer DDJ-FLX4"), "the separate Traktor Pro filter should find its documented plug-and-play support");

    await page.select("[data-mat-soft]", "all");
    await page.click('[data-mat-compare="flx4"]');
    await page.click('[data-mat-compare="flx10"]');
    await page.click("[data-compare-open]");
    await page.waitForSelector(".matrix-compare-table", { timeout: 5000 });
    const comparison = await page.$eval(".matrix-compare-table", (table) => table.innerText);
    assert.match(comparison, /Traktor Play/, "shortlist comparison should include a separate Traktor Play row");
    assert.ok(comparison.toUpperCase().includes("TRAKTOR PRO\tSUPPORTED"), "shortlist comparison should show Traktor Pro as a distinct supported tier");

    const mobile = await browser.newPage();
    await mobile.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    mobile.on("pageerror", (error) => errors.push(String(error)));
    mobile.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await mobile.goto(`${BASE}/controller-software-compatibility-matrix.html`, { waitUntil: "load" });
    const widths = await mobile.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    assert.deepStrictEqual(widths, [390, 390], `the compatibility path should fit a 390px mobile viewport: ${widths}`);
    await mobile.select("[data-mat-soft]", "traktorplay");
    assert.strictEqual(await mobile.$eval("#mat-flx4 .mat-title", (node) => node.innerText.trim()), "Pioneer DDJ-FLX4",
      "the edition-specific filter should remain usable on mobile");

    assert.deepStrictEqual(errors, [], `browser console errors: ${errors.join(" | ")}`);
    await mobile.close();
    console.log("Controller matrix: FLX4 app tiers, Traktor Play/Pro distinction, filters, comparison and mobile fit; 0 console errors");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error("Controller matrix test failed:", error.message);
  process.exit(1);
});
