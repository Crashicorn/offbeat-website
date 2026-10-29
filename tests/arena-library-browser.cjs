// Independent read-only acceptance for the integrated Arena visitor journeys.
// Uses a local HTTP server and installed Chromium; never deploys or changes content.
"use strict";
const assert = require("node:assert/strict");
const puppeteer = require("puppeteer-core");
const base = process.env.RIG_BASE_URL || "http://127.0.0.1:8099";
const chrome = process.env.CHROME_BIN || "/usr/bin/google-chrome";
const paths = [
  "index.html", "all-dj-guides.html", "beginner-dj-hub.html",
  "controller-software-compatibility-matrix.html",
  "dj-controllers-hub.html", "dj-software-hub.html", "dj-gear-hub.html",
  "dj-skills-performance-hub.html", "best-dj-controllers-2026.html",
  "best-dj-headphones-2026.html", "editorial-standards.html",
  "disclosure.html", "contact.html", "beatmatch-trainer.html"
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

      // The enriched Spotlight index includes curated hardware deep links.
      // Only ONE search dialog should open; category selection precedes cap.
      if (width < 600) {
        await page.click(".nav-toggle");
      }
      await page.click("[data-search-open]");
      await page.waitForSelector("#quick-search-backdrop:not([hidden])", { timeout: 10000 });
      assert.equal(await page.$eval("#site-search", el => el.hidden), true,
        "legacy search overlay must remain closed");
      await page.type("#quick-search-input", "dj");
      await page.click('.qs-pill[data-qs-filter="controllers"]');
      const index = await page.evaluate(async () =>
        (await (await fetch("assets/search-index.json")).json())
      );
      assert.ok(index.some(item => item.u.includes("?add=")),
        "curated hardware deep links must remain in the search index");
      const expected = Math.min(12, index.filter(item =>
        item.g === "controllers" &&
        (item.title + " " + item.desc + " " + item.category + " " + (item.k || "")).toLowerCase().includes("dj")
      ).length);
      assert.ok(expected > 0, "curated controller index must have DJ matches");
      const results = await page.$$eval("#qs-results-list .qs-result-item", els => els.length);
      assert.equal(results, expected, "Spotlight category must show all matching top results");
      await page.keyboard.press("Escape");
      assert.equal(await page.$eval("#quick-search-backdrop", el => el.hidden), true,
        "Escape closes Spotlight search");
      // Visitors search by the curated keyword field, not just guide titles.
      // A phone visitor also needs a visible tap target to dismiss the modal.
      await page.click("[data-search-open]");
      await page.waitForSelector("#quick-search-backdrop:not([hidden])");
      await page.type("#quick-search-input", "pcpartpicker");
      const keywordHits = await page.$eval("#qs-results-list .qs-result-item",
        links => Array.from(links, link => link.getAttribute("href")));
      assert.ok(keywordHits.includes("build-your-dj-setup.html"),
        "Spotlight must use curated index keywords for rig-planner discovery");
      await page.click("#qs-close-btn");
      assert.equal(await page.$eval("#quick-search-backdrop", el => el.hidden), true,
        "visible close button must dismiss Spotlight without a keyboard");

      if (width < 600) {
        await page.click(".nav-toggle");
      }

      if (width < 600) {
        await page.click(".nav-toggle");
        assert.equal(await page.$eval(".nav-toggle", el => el.getAttribute("aria-expanded")), "true");
        await page.click(".nav-toggle");
        assert.equal(await page.$eval(".nav-toggle", el => el.getAttribute("aria-expanded")), "false");
      }
      // Buyer-journey integrity: the matrix must never deep-link an unrelated
      // FLX4 when the selected controller is absent from the planner catalog.
      await page.goto(base + "/controller-software-compatibility-matrix.html", {
        waitUntil: "load"
      });
      await page.waitForSelector("#matrix-root .matrix-card", { timeout: 10000 });
      const matrixLinks = await page.$$eval(".matrix-card", cards => cards.map(card => {
        const link = card.querySelector(".mat-plan-btn");
        const url = new URL(link.href);
        return {
          id: card.id,
          add: url.searchParams.get("add"),
          pathname: url.pathname,
          label: link.textContent.trim()
        };
      }));
      const catalogIds = new Set(await page.evaluate(async () =>
        (await (await fetch("assets/dj-gear-catalog.json")).json()).items.map(item => item.id)
      ));
      assert.equal(matrixLinks.length, 13, "matrix must expose all 13 controller choices");
      for (const link of matrixLinks) {
        assert.ok(link.pathname.endsWith("/build-your-dj-setup.html"),
          link.id + " must navigate to the planner");
        if (link.add) {
          assert.ok(catalogIds.has(link.add),
            link.id + " must select a real catalog item");
        } else {
          assert.match(link.label, /select gear manually/i,
            link.id + " must disclose no model preselection");
        }
      }
      const byId = new Map(matrixLinks.map(link => [link.id, link]));
      assert.equal(byId.get("mat-flx4").add, "pioneer-ddj-flx4");
      assert.equal(byId.get("mat-prime4plus").add, "denon-prime-4-plus");
      for (const unlisted of ["flx6gt", "mixtrackpro", "traktors3",
                              "traktors4", "raneone", "xdjaz", "reloopmixon8"]) {
        assert.equal(byId.get("mat-" + unlisted).add, null,
          unlisted + " must not silently select an unrelated controller");
      }
      // Real Chromium must be able to start, CUE by button and keyboard,
      // and stop the trainer without throwing. Exact phase behavior is
      // separately asserted by the deterministic beatmatch-cue Node tests.
      await page.goto(base + "/beatmatch-trainer.html", { waitUntil: "load" });
      await page.click("[data-start]");
      assert.equal(await page.$eval(".teacher-stage",
        el => el.classList.contains("is-running")), true,
        "trainer must start from a visitor click");
      await page.click("[data-cue]");
      await page.keyboard.press("c");
      if (width < 600) {
        // Actual mobile Chromium touch input, not synthetic mouse dispatch:
        // the platter advertises swiping but previously listened only for
        // mousedown/mousemove and did nothing for a finger.
        await page.$eval("[data-platter-b]", el =>
          el.scrollIntoView({ block: "center", behavior: "instant" }));
        // Verify the touch actually lands on the platter, not a transient
        // scroll position left behind by the prior CUE-button click.
        await page.waitForFunction(() => {
          const p = document.querySelector("[data-platter-b]");
          const r = p.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return hit && (hit === p || p.contains(hit));
        }, { timeout: 2000 });
        const box = await page.$eval("[data-platter-b]", el => {
          const r = el.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });
        await page.evaluate(() => {
          window.__touchProbe = [];
          const p = document.querySelector("[data-platter-b]");
          for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel"]) {
            p.addEventListener(type, e => window.__touchProbe.push({
              type, pointerId: e.pointerId, y: e.clientY
            }), { capture: true });
          }
        });
        const neutral = Number(await page.$eval("[data-bpm-b]", el => el.textContent));
        await page.touchscreen.touchStart(box.x, box.y);
        await page.touchscreen.touchMove(box.x, box.y - 45);
        try {
          await page.waitForFunction(baseBpm =>
            Number(document.querySelector("[data-bpm-b]").textContent) > baseBpm * 1.1,
          { timeout: 1500 }, neutral);
        } catch (e) {
          const events = await page.evaluate(() => window.__touchProbe);
          throw new Error("Mobile jog did not accelerate: neutral=" + neutral +
            " events=" + JSON.stringify(events) + " cause=" + e.message);
        } finally {
          await page.touchscreen.touchEnd();
        }
        await page.waitForFunction(baseBpm =>
          Math.abs(Number(document.querySelector("[data-bpm-b]").textContent) - baseBpm) < 0.2,
        { timeout: 1500 }, neutral);
      }
      await page.click("[data-stop]");
      assert.equal(await page.$eval(".teacher-stage",
        el => el.classList.contains("is-running")), false,
        "trainer must stop after CUE interaction");
      assert.deepEqual(errors, [], "buyer/search/trainer browser errors at " + width + "px");

      await context.close();
      console.log("PASS: " + width + "px 14-page journeys, matrix, library, search, trainer CUE, nav, overflow");
    }
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
