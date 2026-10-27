// Review-only Chromium acceptance for the Arena rig planner.
// Run against a local static server: RIG_BASE_URL=http://127.0.0.1:8099 node tests/rig-builder-browser.cjs
// Requires puppeteer-core and a locally installed Chrome; never sends site data to third parties.
"use strict";

const assert = require("node:assert/strict");
const puppeteer = require("puppeteer-core");

const base = process.env.RIG_BASE_URL || "http://127.0.0.1:8099";
const chrome = process.env.CHROME_BIN || "/usr/bin/google-chrome";

async function visit(browser, width, suffix = "", denyStorage = false) {
  // Isolate browser storage between independent desktop/mobile journeys.
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await page.setViewport({ width, height: 900, isMobile: width < 600, hasTouch: width < 600 });
  if (denyStorage) {
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get() { throw new DOMException("Storage blocked", "SecurityError"); }
      });
    });
  }
  await page.goto(base + "/build-your-dj-setup.html" + suffix, {
    waitUntil: "load", timeout: 20000
  });
  await page.waitForSelector(".rig-dashboard-shell", { timeout: 15000 });
  const metrics = await page.evaluate(() => ({
    spend: document.querySelector(".metric-val--spend")?.textContent.trim() || "",
    overflow: document.documentElement.scrollWidth - innerWidth,
    title: document.title
  }));
  assert.match(metrics.spend, /\$/, "remaining purchase cost must show a dollar amount");
  assert.ok(metrics.overflow <= 1, width + "px viewport overflows by " + metrics.overflow + "px");
  assert.deepEqual(errors, [], "browser JS errors at " + width + "px");
  return { page, context, errors, metrics };
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: chrome, headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
  });
  try {
    for (const width of [1440, 390]) {
      const { page, context, errors, metrics } = await visit(browser, width);
      // HD 25 already includes a native 3.5mm plug; do not upsell an adapter.
      const initialAlerts = await page.$eval(".compat-items-grid", el => el.textContent);
      assert.doesNotMatch(initialAlerts, /Headphone Connector Adapter Needed|Headphone Jack Adapter Advisory/);
      // First-time buyers must not be assigned an imaginary owned laptop.
      assert.equal(metrics.spend, "$1,637", "default includes the full $999 laptop");
      const initialOwned = await page.$eval(".metric-val--owned", el => el.textContent.trim());
      assert.match(initialOwned, /\$0$/, "default ownership deduction must be zero");
      const before = Number(metrics.spend.replace(/[^\d.]/g, ""));
      assert.ok(Number.isFinite(before) && before > 0, "initial spend must be a real amount");
      await page.click('.booth-card--main [data-action="toggle-slot-owned"]');
      const afterText = await page.$eval(".metric-val--spend", (el) => el.textContent.trim());
      const after = Number(afterText.replace(/[^\d.]/g, ""));
      assert.ok(after < before, "marking an owned controller must reduce remaining spend");
      assert.deepEqual(errors, [], "browser errors after owned-toggle");

      // Every preset button must quote the same full total displayed after
      // selecting it, including host laptop, speakers, cables and accessories.
      const expectedPresets = [
        ["bedroom-starter", "$1,637"],
        ["club-ready", "$3,230"],
        ["mobile-pro", "$3,052"],
        ["traktor-techno", "$1,780"]
      ];
      for (const [id, expectedPrice] of expectedPresets) {
        const badge = await page.$eval('[data-preset-id="' + id + '"] .preset-badge', el => el.textContent.trim());
        assert.equal(badge, "Est. " + expectedPrice + " total", id + " badge");
        await page.click('[data-preset-id="' + id + '"]');
        const actualSpend = await page.$eval(".metric-val--spend", el => el.textContent.trim());
        assert.equal(actualSpend, expectedPrice, id + " purchase cost must match advertised total");
      }
      await context.close();
      console.log("PASS: " + width + "px real catalog/render/owned-budget/no-overflow");
    }

    // Accessories-only shared rigs must never show a green "Preliminary Match".
    const noController = {
      name: "Accessory-only rig",
      items: [
        { slotId: "hp", category: "headphones", itemId: "sennheiser-hd25", qty: 1, owned: true },
        { slotId: "sp", category: "speakers", itemId: "pioneer-dm40d", qty: 1, owned: false },
        { slotId: "host", category: "laptops", itemId: "macbook-air-m2", qty: 1, owned: true }
      ]
    };
    const noControllerQuery = "?rig=" + encodeURIComponent(
      Buffer.from(encodeURIComponent(JSON.stringify(noController)), "binary").toString("base64")
    );
    const missingController = await visit(browser, 390, noControllerQuery);
    const missingState = await missingController.page.evaluate(() => ({
      tag: document.querySelector(".compat-status-tag")?.textContent || "",
      readiness: Number((document.querySelector(".readiness-num")?.textContent || "").replace("%", "")),
      alerts: document.querySelector(".compat-items-grid")?.textContent || ""
    }));
    assert.match(missingState.tag, /Incompatible Configuration/);
    assert.match(missingState.alerts, /DJ Controller or Mixer Required/);
    assert.ok(missingState.readiness <= 40);
    await missingController.context.close();
    console.log("PASS: accessory-only shared rig visibly blocked as incomplete");

    // A standalone controller alone has no selected listening path.
    const noAudio = {
      name: "No listening device",
      items: [{ slotId: "ctrl", category: "controllers", itemId: "denon-prime-4-plus", qty: 1, owned: false }]
    };
    const noAudioQuery = "?rig=" + encodeURIComponent(
      Buffer.from(encodeURIComponent(JSON.stringify(noAudio)), "binary").toString("base64")
    );
    const silentRig = await visit(browser, 390, noAudioQuery);
    const silentState = await silentRig.page.evaluate(() => ({
      tag: document.querySelector(".compat-status-tag")?.textContent || "",
      readiness: Number((document.querySelector(".readiness-num")?.textContent || "").replace("%", "")),
      alerts: document.querySelector(".compat-items-grid")?.textContent || ""
    }));
    assert.match(silentState.tag, /Incompatible Configuration/);
    assert.match(silentState.alerts, /Headphones or Speakers Required/);
    assert.ok(silentState.readiness <= 40);
    await silentRig.context.close();
    console.log("PASS: standalone controller with no listening device is incomplete");

    // A second controller is counted in the budget but cannot silently inherit
    // the first controller's host and cable compatibility verdict.
    const twoControllers = {
      name: "Multi-controller routing needs review",
      items: [
        { slotId: "first", category: "controllers", itemId: "denon-prime-4-plus", qty: 1, owned: true },
        { slotId: "second", category: "controllers", itemId: "pioneer-ddj-flx4", qty: 1, owned: false },
        { slotId: "hp", category: "headphones", itemId: "sennheiser-hd25", qty: 1, owned: false },
        { slotId: "sp", category: "speakers", itemId: "pioneer-dm40d", qty: 1, owned: false },
        { slotId: "cable", category: "cables", itemId: "cable-rca-rca", qty: 1, owned: false }
      ]
    };
    const multiQuery = "?rig=" + encodeURIComponent(
      Buffer.from(encodeURIComponent(JSON.stringify(twoControllers)), "binary").toString("base64")
    );
    const multi = await visit(browser, 390, multiQuery);
    const multiState = await multi.page.evaluate(() => ({
      tag: document.querySelector(".compat-status-tag")?.textContent || "",
      readiness: Number((document.querySelector(".readiness-num")?.textContent || "").replace("%", "")),
      alerts: document.querySelector(".compat-items-grid")?.textContent || ""
    }));
    assert.match(multiState.tag, /Manual Routing Review Required/);
    assert.match(multiState.alerts, /Multiple controllers Need Manual Verification/);
    assert.ok(multiState.readiness <= 50);
    assert.deepEqual(multi.errors, []);
    await multi.context.close();
    console.log("PASS: multi-controller shared rig warns that additional routing is unverified");

    // A quantity stepper can add a second physical controller within one
    // slot. The compatibility verdict must still require manual routing review.
    const quantityRig = {
      name: "Two controllers in one slot",
      items: [
        { slotId: "ctrl", category: "controllers", itemId: "denon-prime-4-plus", qty: 2, owned: false },
        { slotId: "hp", category: "headphones", itemId: "sennheiser-hd25", qty: 1, owned: false }
      ]
    };
    const quantityQuery = "?rig=" + encodeURIComponent(
      Buffer.from(encodeURIComponent(JSON.stringify(quantityRig)), "binary").toString("base64")
    );
    const quantity = await visit(browser, 390, quantityQuery);
    const quantityState = await quantity.page.evaluate(() => ({
      tag: document.querySelector(".compat-status-tag")?.textContent || "",
      readiness: Number((document.querySelector(".readiness-num")?.textContent || "").replace("%", "")),
      alerts: document.querySelector(".compat-items-grid")?.textContent || ""
    }));
    assert.match(quantityState.tag, /Manual Routing Review Required/);
    assert.match(quantityState.alerts, /Multiple controllers Need Manual Verification/);
    assert.ok(quantityState.readiness <= 50);
    assert.deepEqual(quantity.errors, []);
    await quantity.context.close();
    console.log("PASS: two controllers via one quantity stepper require routing review");

    const payload = {
      name: '<img src=x onerror="alert(1)">',
      items: [{ slotId: 'x" onmouseover="alert(1)', category: "controllers",
        itemId: "pioneer-ddj-flx4", qty: 2, owned: false }]
    };
    const query = "?rig=" + encodeURIComponent(
      Buffer.from(encodeURIComponent(JSON.stringify(payload)), "binary").toString("base64")
    );
    const hostile = await visit(browser, 390, query);
    const injected = await hostile.page.evaluate(() =>
      Array.from(document.querySelectorAll("*")).some((el) =>
        /alert\(1\)/.test((el.getAttribute("onmouseover") || "") +
          (el.getAttribute("onerror") || "")))
    );
    assert.equal(injected, false, "untrusted shared rig must not create event-handler attributes");
    assert.deepEqual(hostile.errors, [], "hostile shared rig must not throw");
    await hostile.context.close();
    console.log("PASS: malicious shared URL cannot inject event handlers");

    const denied = await visit(browser, 390, "", true);
    assert.deepEqual(denied.errors, [], "storage-denied browser must remain usable");
    await denied.context.close();
    console.log("PASS: storage-disabled mobile browser still initializes");
  } finally {
    await browser.close();
  }
})().catch((err) => { console.error(err); process.exitCode = 1; });
