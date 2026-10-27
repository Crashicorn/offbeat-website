// Independent read-only acceptance for the integrated Arena visitor journeys.
// Uses a local HTTP server and installed Chromium; never deploys or changes content.
"use strict";
const assert = require("node:assert/strict");
const puppeteer = require("puppeteer-core");
const base = process.env.RIG_BASE_URL || "http://127.0.0.1:8099";
const chrome = process.env.CHROME_BIN || "/usr/bin/google-chrome";
const paths = [
  "index.html", "all-dj-guides.html", "beginner-dj-hub.html",
  "dj-controllers-hub.html", "dj-software-hub.html", "dj-gear-hub.html",
  "dj-skills-performance-hub.html", "best-dj-controllers-2026.html",
  "best-dj-headphones-2026.html", "editorial-standards.html",
  "disclosure.html", "contact.html"
];
function visibleCount(page) {
  return page.$$eval(".library-item:not([hidden])", els => els.length);
}
(async () => {
  const browser = await puppeteer.launch({
    executablePath: chrome, headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
  });
  try {
    for (const width of [1440, 390]) {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      await page.setViewport({
        width, height: 900, isMobile: width < 600, hasTouch: width < 600
      });
      const errors = [];
      page.on("pageerror", e => errors.push(e.message));
      for (const path of paths) {
        const response = await page.goto(base + "/" + path, {
          waitUntil: "load", timeout: 20000
        });
        assert.equal(response.status(), 200, path + " must load");
        const state = await page.evaluate(() => ({
          main: document.querySelectorAll("main").length,
          title: document.title,
          overflow: document.documentElement.scrollWidth - innerWidth
        }));
        assert.equal(state.main, 1, path + " must have exactly one main");
        assert.ok(state.title.trim(), path + " must have a title");
        assert.ok(state.overflow <= 1, path + " overflows at " + width + "px: " + state.overflow);
        assert.deepEqual(errors, [], path + " browser errors at " + width + "px");
      }
      await page.goto(base + "/all-dj-guides.html", { waitUntil: "load" });
      const total = await page.$$eval(".library-item", els => els.length);
      assert.ok(total >= 100, "library must contain real guide links");
      assert.equal(await visibleCount(page), total, "all guides visible on first load");
      assert.equal(await page.$eval('[data-filter="all"]', el => el.getAttribute("aria-pressed")), "true");
      await page.click('.chip-filter[data-filter="controllers"]');
      const filtered = await visibleCount(page);
      assert.ok(filtered > 0 && filtered < total, "controller category must narrow the library");
      await page.click('.chip-filter[data-filter="all"]');
      assert.equal(await visibleCount(page), total, "All guides must restore full library");
      await page.type("[data-library-input]", "flx4");
      assert.ok((await visibleCount(page)) > 0, "keyword filter must find FLX4 guides");
      await page.click("[data-library-input]", { clickCount: 3 });
      await page.keyboard.press("Backspace");
      assert.equal(await visibleCount(page), total, "clearing filter must restore full library");

      // Search category is applied before top-12 result cap, not after.
      await page.click("[data-search-open]");
      await page.waitForSelector('.search-chip[data-group="controllers"]', { timeout: 10000 });
      await page.type("[data-search-input]", "dj");
      await page.click('.search-chip[data-group="controllers"]');
      const index = await page.evaluate(async () =>
        (await (await fetch("assets/search-index.json")).json())
      );
      const expected = Math.min(12, index.filter(item =>
        item.g === "controllers" &&
        (item.t + " " + item.d + " " + item.k).toLowerCase().includes("dj")
      ).length);
      assert.ok(expected > 0, "curated controller index must have DJ matches");
      const results = await page.$$eval("[data-search-results] li", els => els.length);
      assert.equal(results, expected, "search must not lose matching category results after global cap");
      await page.keyboard.press("Escape");
      assert.equal(await page.$eval("#site-search", el => el.hidden), true, "Escape closes search");

      if (width < 600) {
        await page.click(".nav-toggle");
        assert.equal(await page.$eval(".nav-toggle", el => el.getAttribute("aria-expanded")), "true");
        await page.click(".nav-toggle");
        assert.equal(await page.$eval(".nav-toggle", el => el.getAttribute("aria-expanded")), "false");
      }
      assert.deepEqual(errors, [], "library/search/navigation browser errors at " + width + "px");
      await context.close();
      console.log("PASS: " + width + "px 12-page journeys, library reset, search, nav, overflow");
    }
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
