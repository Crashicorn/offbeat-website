/* Browser coverage for the room-first speaker selector and its Rig Studio handoff.
 *
 * Run with a static server on :8099 (or PORT=4173) and a local Chromium / Puppeteer:
 *   PUPPETEER_CORE=/path/to/puppeteer-core node tests/test_speaker_finder.js
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
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const PAIR_RIG = "eyJuIjoiR2VhciBjb25uZWN0aW9uIiwiaSI6W3siY2F0ZWdvcnkiOiJjb250cm9sbGVycyIsIml0ZW1JZCI6InBpb25lZXItZGRqLWZseDQiLCJxdHkiOjEsIm93bmVkIjpmYWxzZX0seyJjYXRlZ29yeSI6InNwZWFrZXJzIiwiaXRlbUlkIjoicGlvbmVlci1kbTQwZCIsInF0eSI6MSwib3duZWQiOmZhbHNlfV19";

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE || "/tmp/chromium",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });

  try {
    await page.goto(`${BASE}/best-dj-monitor-speakers.html`, { waitUntil: "load" });
    await page.waitForSelector(".speaker-finder-result", { timeout: 5000 });
    assert.strictEqual(await page.$$eval('input[name="speaker-use"]', (items) => items.length), 4,
      "the finder should offer four actual visitor situations");
    assert.strictEqual(await page.$eval('[data-speaker-result="desk"]', (node) => node.hidden), false,
      "the first useful route should render without an interaction");

    const paths = [
      ["production", "speaker-hs5"],
      ["room", "speaker-eon715"],
      ["quiet", null],
      ["desk", "speaker-dm40d"]
    ];
    for (const [value, expected] of paths) {
      await page.click(`input[name="speaker-use"][value="${value}"]`);
      await wait(80);
      const state = await page.evaluate((selected) => ({
        visibleResult: !document.querySelector(`[data-speaker-result="${selected}"]`).hidden,
        highlighted: Array.from(document.querySelectorAll(".speaker-product.is-recommended")).map((node) => node.id),
        selectedLabels: Array.from(document.querySelectorAll(".speaker-choice.is-selected input")).map((node) => node.value)
      }), value);
      assert.strictEqual(state.visibleResult, true, `${value} should reveal its own explanation`);
      assert.deepStrictEqual(state.selectedLabels, [value], `${value} should update the selected state`);
      if (expected) assert.ok(state.highlighted.includes(expected), `${value} should point to ${expected}`);
      else assert.deepStrictEqual(state.highlighted, [], "headphones-first should not force a speaker purchase");
    }

    await page.goto(`${BASE}/build-your-dj-setup.html?rig=${PAIR_RIG}`, { waitUntil: "load" });
    await page.waitForSelector(".rs-bar-stats", { timeout: 8000 });
    const rigItems = await page.evaluate(() => window.__rigStudio.state().items.map((item) => item.itemId));
    assert.ok(rigItems.includes("pioneer-ddj-flx4"), "the cable example should restore its controller");
    assert.ok(rigItems.includes("pioneer-dm40d"), "the cable example should restore its matching speaker pair");

    await page.goto(`${BASE}/build-your-dj-setup.html?add=jbl-eon-715`, { waitUntil: "load" });
    await page.waitForSelector(".rs-bar-stats", { timeout: 8000 });
    const added = await page.evaluate(() => window.__rigStudio.state().items.map((item) => item.itemId));
    assert.ok(added.includes("jbl-eon-715"), "a PA result should open Rig Studio with that exact model selected");

    const mobile = await browser.newPage();
    await mobile.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    const mobileErrors = [];
    mobile.on("pageerror", (error) => mobileErrors.push(String(error)));
    mobile.on("console", (message) => { if (message.type() === "error") mobileErrors.push(message.text()); });
    await mobile.goto(`${BASE}/best-dj-monitor-speakers.html`, { waitUntil: "load" });
    const widths = await mobile.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    assert.deepStrictEqual(widths, [390, 390], `the mobile buying path should not overflow horizontally: ${widths}`);
    await mobile.click('input[name="speaker-use"][value="room"]');
    assert.strictEqual(await mobile.$eval('[data-speaker-result="room"]', (node) => node.hidden), false,
      "the PA recommendation should remain operable on mobile");

    assert.deepStrictEqual(errors.concat(mobileErrors), [], `browser console errors: ${errors.concat(mobileErrors).join(" | ")}`);
    await mobile.close();
    console.log("Speaker finder: four paths, exact Rig Studio handoff, mobile layout, 0 console errors");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error("Speaker finder test failed:", error.message);
  process.exit(1);
});
