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
  // Make an explicit privacy choice so the consent dialog cannot intercept UI clicks.
  if (!denyStorage && await page.$(".ob-consent-btn")) {
    await page.click(".ob-consent-btn:nth-child(2)");
  }
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
    // An unanswered consent choice must remain visible, not cover mobile gear,
    // and must never start analytics. Exercise both consent and withdrawal.
    {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
      let googleRequests = 0;
      await page.setRequestInterception(true);
      page.on("request", request => {
        if (/googletagmanager\.com|google-analytics\.com/.test(request.url())) {
          googleRequests++;
          request.abort();
        } else request.continue();
      });
      await page.goto(base + "/build-your-dj-setup.html?preset=mobile-pro", { waitUntil: "load" });
      await page.waitForSelector(".visual-controller .visual-pick");
      assert.equal(await page.evaluate(() => window.offbeatConsentState()), "unknown");
      assert.equal(googleRequests, 0, "no analytics requests before a choice");
      assert.equal(await page.$eval(".ob-consent", el => getComputedStyle(el).position), "static");
      assert.equal(await page.$eval(".ob-consent-link", el => el.getAttribute("href")), "privacy.html");
      // Click the actual controller while the banner remains unanswered.
      await page.click(".visual-controller .visual-pick");
      await page.waitForSelector(".picker-dialog", { visible: true });
      await page.click(".picker-close");
      assert.equal(await page.evaluate(() => window.offbeatConsentState()), "unknown");
      await page.click(".ob-consent-btn:nth-child(2)");
      assert.equal(await page.evaluate(() => window.offbeatConsentState()), "denied");
      await page.reload({ waitUntil: "load" });
      assert.equal(googleRequests, 0, "denied choice must persist without analytics");
      assert.equal(await page.$(".ob-consent"), null);
      await page.click("[data-reopen-consent]");
      assert.equal(await page.evaluate(() => document.activeElement?.textContent), "Allow analytics",
        "reopening consent from the footer must focus the in-flow choices");
      const reopenedTop = await page.$eval(".ob-consent", el => el.getBoundingClientRect().top);
      assert.ok(reopenedTop >= 0 && reopenedTop < 844, "reopened consent must be in view");
      await page.click(".ob-consent-btn:nth-child(1)");
      await page.waitForFunction(() => window.offbeatConsentState() === "granted" && window.__obGtagBooted);
      assert.equal(googleRequests, 0, "preview hosts must not load Google even when allowed");
      await page.click("[data-reopen-consent]");
      await Promise.all([
        page.waitForNavigation({ waitUntil: "load" }),
        page.click(".ob-consent-btn:nth-child(2)")
      ]);
      assert.equal(await page.evaluate(() => window.offbeatConsentState()), "denied");
      assert.equal(await page.$('script[src*="googletagmanager.com/gtag/js"]'), null,
        "withdrawal must tear down the analytics tag");
      await context.close();
      console.log("PASS: mobile consent is non-overlapping and analytics remains opt-in and withdrawable");
    }
    // A multi-cabinet PA line can consume two stereo output pairs. A second
    // monitor line must not reuse those occupied outputs merely because four
    // XLR cable packs are selected in the shopping list.
    {
      const rig = { name: "Multi-output capacity", items: [
        { slotId: "deck", category: "controllers", itemId: "denon-prime-4-plus", qty: 1, owned: true },
        { slotId: "pa", category: "speakers", itemId: "jbl-eon-715", role: "crowd_pa", qty: 3, owned: false },
        { slotId: "mon", category: "speakers", itemId: "krk-rokit-5-g4", role: "dj_monitor", qty: 4, owned: false },
        { slotId: "leads", category: "cables", itemId: "cable-xlr-xlr", qty: 4, owned: false }
      ] };
      const encoded = encodeURIComponent(Buffer.from(encodeURIComponent(JSON.stringify(rig)), "utf8").toString("base64"));
      const { page, context, errors } = await visit(browser, 1440, "?rig=" + encoded);
      const routes = await page.evaluate(() => window.__rigStudio.connections());
      assert.equal(routes.length, 2);
      assert.equal(routes[0].outputsNeeded, 2, "three JBL PA cabinets need two output pairs");
      assert.equal(routes[1].outputsNeeded, 2, "four KRK monitors need two more output pairs");
      assert.equal(routes[1].conflict, true, "only three compatible XLR output pairs exist");
      assert.match(await page.$eval(".visual-route", el => el.textContent), /Routing limitation|Incompatible/);
      assert.match(await page.$eval(".compat-items-grid", el => el.textContent),
        /Secondary Speaker Route Cannot Be Fed/);
      assert.equal((await page.evaluate(() => window.__rigStudio.checks())).find(c => c.key === "cables").level,
        "warn", "public checks must not declare a fourth XLR output verified");
      assert.deepEqual(errors, [], "no browser JS errors during over-capacity routing");
      await context.close();
      console.log("PASS: multi-pair PA and monitor routes cannot reuse occupied XLR outputs");
    }

    for (const width of [1440, 390]) {
      const { page, context, errors, metrics } = await visit(browser, width);
      // One visual editor; supporting sections remain independently expandable.
      const structure = await page.evaluate(() => ({
        canvas: document.querySelectorAll('.visual-stage').length,
        controllers: document.querySelectorAll('.visual-controller img').length,
        oldBooths: document.querySelectorAll('.rig-booth-stage, #zone-crowd-pa, #zone-monitors').length,
        tiers: document.querySelectorAll('.spec-card--tier, [data-tier-preset]').length,
        spend: document.querySelectorAll('.quick-spend-card').length,
        height: document.documentElement.scrollHeight,
        photo: !!document.querySelector('.rig-hero-photo img'),
        controllerTop: document.querySelector('.visual-controller').getBoundingClientRect().top
      }));
      assert.equal(structure.canvas, 1);
      assert.equal(structure.controllers, 1);
      assert.equal(structure.oldBooths, 0);
      assert.equal(structure.tiers, 0);
      assert.equal(structure.spend, 1);
      assert.ok(structure.photo, 'editorial hero includes contextual photography');
      assert.ok(structure.height > 0, 'page renders with supporting views');
      assert.ok(structure.controllerTop < 900, 'controller begins in the first viewport');
      assert.equal(await page.$eval('#rig-shopping', el => el.open), true, 'shopping is open by default');
      assert.equal(await page.$eval('#rig-connections', el => el.open), width >= 700, 'connections opens on desktop');
      await page.$eval('.visual-route-link', el => el.scrollIntoView({block:'center',behavior:'instant'}));
      await page.click('.visual-route-link');
      assert.equal(await page.$eval('#rig-connections', el => el.open), true);
      assert.equal(await page.$eval('#rig-shopping', el => el.open), true, 'both views can remain open');
      const controllerSlot = await page.$eval('.visual-controller .visual-own', el => el.dataset.slotId);
      const plus = '#rig-shopping [data-action="step-qty"][data-step="1"][data-slot-id="' + controllerSlot + '"]';
      await page.click(plus);
      assert.equal(await page.$eval('.metric-val--spend', el => el.textContent.trim()), '$956', 'quantity updates the single spend summary');
      assert.equal(await page.$eval('#rig-shopping', el => el.open), true, 'editing keeps shopping view open');
      const minus = '#rig-shopping [data-action="step-qty"][data-step="-1"][data-slot-id="' + controllerSlot + '"]';
      await page.click(minus);
      assert.equal(await page.$eval('.metric-val--spend', el => el.textContent.trim()), '$627');
      assert.ok(await page.$('#rig-shopping a.btn-retail'), 'retailer destinations remain available');
      await page.click('#rig-manage > summary');
      assert.equal(await page.$eval('#rig-shopping', el => el.open), true);
      assert.equal(await page.$eval('#rig-connections', el => el.open), true);
      assert.equal(await page.$eval('#rig-manage', el => el.open), true);
      await page.click('#rig-manage > summary');
      // HD 25 already includes a native 3.5mm plug; do not upsell an adapter.
      const initialAlerts = await page.$eval(".compat-items-grid", el => el.textContent);
      assert.doesNotMatch(initialAlerts, /Headphone Connector Adapter Needed|Headphone Jack Adapter Advisory/);
      assert.match(initialAlerts, /Included Speaker Cable Matches/,
        "DM-40D bundle must supply the compatible analog lead");
      assert.doesNotMatch(initialAlerts, /Audio Cable Needed/,
        "default must not upsell a separate audio cable");
      const includedLabel = await page.$eval(".cable-title", el => el.textContent.trim());
      assert.match(includedLabel, /Speaker Package Includes Audio Cable/);
      // Starter assumes a compatible phone already owned, not a forced laptop purchase.
      assert.equal(metrics.spend, "$627", "starter excludes a new laptop and stand");
      assert.match(initialAlerts, /Mobile Host, USB Audio and Power Need Verification/);
      const initialOwned = await page.$eval(".quick-spend-card .qsc-sub", el => el.textContent.trim());
      assert.match(initialOwned, /Saved \$0 owned/, "default ownership deduction must be zero");
      const before = Number(metrics.spend.replace(/[^\d.]/g, ""));
      assert.ok(Number.isFinite(before) && before > 0, "initial spend must be a real amount");
      await page.click('.visual-controller [data-action="toggle-slot-owned"]');
      const afterText = await page.$eval(".metric-val--spend", (el) => el.textContent.trim());
      const after = Number(afterText.replace(/[^\d.]/g, ""));
      assert.ok(after < before, "marking an owned controller must reduce remaining spend");
      assert.deepEqual(errors, [], "browser errors after owned-toggle");

      // Every preset button must quote the same full total displayed after
      // selecting it, including host laptop, speakers, cables and accessories.
      const expectedPresets = [
        ["bedroom-starter", "$627"],
        ["club-ready", "$3,360"],
        ["mobile-pro", "$3,102"],
        ["traktor-techno", "$1,780"]
      ];
      for (const [id, expectedPrice] of expectedPresets) {
        if (width < 600) { await page.$eval('.mobile-presets summary', el => el.scrollIntoView({block:'center', behavior:'instant'})); await page.click('.mobile-presets summary'); }
        const presetSelector = (width < 600 ? '.mobile-presets ' : '.rig-preset-strip ') + '[data-preset-id="' + id + '"]';
        const badge = await page.$eval(presetSelector + ' .preset-badge', el => el.textContent.trim());
        assert.equal(badge, "Est. " + expectedPrice + " total", id + " badge");
        await page.click(presetSelector);
        const actualSpend = await page.$eval(".metric-val--spend", el => el.textContent.trim());
        assert.equal(actualSpend, expectedPrice, id + " purchase cost must match advertised total");
      }
      await context.close();
      console.log("PASS: " + width + "px real catalog/render/owned-budget/no-overflow");
    }

    // A cheaper FLX2 with an already-owned compatible phone must not be
    // falsely rejected or force a laptop purchase. Verify real mobile DOM.
    const flx2Mobile = {
      name: "FLX2 mobile starter",
      items: [
        { slotId: "c", category: "controllers", itemId: "pioneer-ddj-flx2", qty: 1, owned: false },
        { slotId: "h", category: "headphones", itemId: "sennheiser-hd25", qty: 1, owned: false },
        { slotId: "s", category: "speakers", itemId: "pioneer-dm40d", qty: 1, owned: false },
        { slotId: "m", category: "laptops", itemId: "existing-mobile-device", qty: 1, owned: true }
      ]
    };
    const flx2Query = "?rig=" + encodeURIComponent(
      Buffer.from(encodeURIComponent(JSON.stringify(flx2Mobile)), "binary").toString("base64")
    );
    const flx2Visit = await visit(browser, 390, flx2Query);
    const flx2Alerts = await flx2Visit.page.$eval(".compat-items-grid", el => el.textContent);
    assert.equal(flx2Visit.metrics.spend, "$497", "FLX2 mobile route does not force a laptop");
    assert.match(flx2Alerts, /FLX2 Mobile Host, USB Audio and Power Need Verification/);
    assert.match(flx2Alerts, /some Android devices cannot/);
    assert.doesNotMatch(flx2Alerts, /Mobile Host Not Verified for This Controller/);
    await flx2Visit.context.close();

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
      readiness: window.__rigStudio.compatibility().readiness,
      alerts: document.querySelector(".compat-items-grid")?.textContent || ""
    }));
    assert.match(missingState.tag, /Incompatible Configuration/);
    assert.match(missingState.alerts, /DJ Controller or Mixer Required/);
    assert.match(await missingController.page.$eval('.visual-critical', el => el.textContent), /DJ Controller or Mixer Required/, 'critical incompatibility remains visible without opening details');
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
      readiness: window.__rigStudio.compatibility().readiness,
      alerts: document.querySelector(".compat-items-grid")?.textContent || ""
    }));
    assert.match(silentState.tag, /Incompatible Configuration/);
    assert.match(silentState.alerts, /Headphones or Speakers Required/);
    assert.match(await silentRig.page.$eval('.visual-critical', el => el.textContent), /Headphones or Speakers Required/);
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
      readiness: window.__rigStudio.compatibility().readiness,
      alerts: document.querySelector(".compat-items-grid")?.textContent || ""
    }));
    assert.match(multiState.tag, /Manual Routing Review Required/);
    assert.match(multiState.alerts, /Multiple controllers Need Manual Verification/);
    assert.ok(multiState.readiness <= 50);
    assert.deepEqual(multi.errors, []);
    // The compare modal must show every controller and actual unowned spend,
    // not just the first controller's unit price or the full owned valuation.
    await multi.page.click('#rig-manage > summary');
    await multi.page.click('[data-action="open-compare"]');
    await multi.page.waitForSelector("#compare-content-grid");
    const compareText = await multi.page.$eval("#compare-content-grid", el => el.textContent);
    assert.match(compareText, /To buy:\s*\$639/);
    assert.match(compareText, /Full value:\s*\$2,838/);
    assert.match(compareText, /Already owned:\s*\$2,199/);
    assert.match(compareText, /Denon DJ Prime 4\+ \(×1, Owned, \$2,199\)/);
    assert.match(compareText, /Pioneer DJ DDJ-FLX4 \(×1, Buy, \$329\)/);
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
      readiness: window.__rigStudio.compatibility().readiness,
      alerts: document.querySelector(".compat-items-grid")?.textContent || ""
    }));
    assert.match(quantityState.tag, /Manual Routing Review Required/);
    assert.match(quantityState.alerts, /Multiple controllers Need Manual Verification/);
    assert.ok(quantityState.readiness <= 50);
    assert.deepEqual(quantity.errors, []);
    await quantity.context.close();
    console.log("PASS: two controllers via one quantity stepper require routing review");

    // Connection auto-fix must add the recommended cable, not silently
    // replace an unrelated owned cable or discard its quantity. A buyer may
    // need both RCA and XLR cabling for different equipment/venues.
    const cableFixRig = {
      name: "Keep owned RCA when adding XLR",
      items: [
        { slotId: "ctrl", category: "controllers", itemId: "denon-prime-go", qty: 1, owned: false },
        { slotId: "hp", category: "headphones", itemId: "sennheiser-hd25", qty: 1, owned: false },
        { slotId: "sp", category: "speakers", itemId: "yamaha-hs5", qty: 1, owned: false },
        { slotId: "rca", category: "cables", itemId: "cable-rca-rca", qty: 2, owned: true }
      ]
    };
    const cableFixQuery = "?rig=" + encodeURIComponent(
      Buffer.from(encodeURIComponent(JSON.stringify(cableFixRig)), "binary").toString("base64")
    );
    const cableFix = await visit(browser, 390, cableFixQuery);
    const spendBeforeCable = await cableFix.page.$eval(".metric-val--spend", el =>
      Number(el.textContent.replace(/[^\d.]/g, "")));
    const fixSelector = '.compat-items-grid [data-action="auto-fix-cable"][data-cable-id="cable-xlr-xlr"]';
    assert.ok(await cableFix.page.$(fixSelector), "XLR suggestion must be available");
    await cableFix.page.click('#rig-connections > summary');
    await cableFix.page.click(fixSelector);
    const cableFixResult = await cableFix.page.evaluate(() => ({
      state: JSON.parse(localStorage.getItem("offbeat.rig.active")),
      spend: Number((document.querySelector(".metric-val--spend")?.textContent || "").replace(/[^\d.]/g, "")),
      alerts: document.querySelector(".compat-items-grid")?.textContent || ""
    }));
    const originalCable = cableFixResult.state.items.find(s => s.itemId === "cable-rca-rca");
    const addedCable = cableFixResult.state.items.filter(s => s.itemId === "cable-xlr-xlr");
    assert.ok(originalCable, "auto-fix must preserve existing RCA cable");
    assert.equal(originalCable.qty, 2, "existing cable quantity must survive");
    assert.equal(originalCable.owned, true, "existing cable ownership must survive");
    assert.equal(addedCable.length, 1, "XLR fix must add exactly one cable slot");
    assert.equal(addedCable[0].owned, false, "new cable is not automatically owned");
    assert.equal(cableFixResult.spend, spendBeforeCable + 28, "only new cable price increases spend");
    assert.match(cableFixResult.alerts, /Listed Audio Connection Match/);
    assert.deepEqual(cableFix.errors, [], "no JS errors after cable auto-fix");
    await cableFix.context.close();
    console.log("PASS: connection fix adds XLR without discarding owned RCA cables");

    // Buyer-facing compatibility must agree with the booth: one XLR cable
    // pack does not serve three PA cabinets, and an unsupported second output
    // must never be reported as a verified cable route.
    const routeRig = {
      name: "Three PA cabinets",
      items: [
        { slotId: "ctrl", category: "controllers", itemId: "denon-prime-4-plus", qty: 1, owned: true },
        { slotId: "hp", category: "headphones", itemId: "ath-m50x", qty: 1, owned: true },
        { slotId: "pa", category: "speakers", role: "crowd_pa", itemId: "jbl-eon-715", qty: 3, owned: false },
        { slotId: "xlr", category: "cables", itemId: "cable-xlr-xlr", qty: 1, owned: false }
      ]
    };
    const rigQuery = rig => "?rig=" + encodeURIComponent(
      Buffer.from(encodeURIComponent(JSON.stringify(rig)), "binary").toString("base64")
    );
    const shortCables = await visit(browser, 390, rigQuery(routeRig));
    assert.equal(await shortCables.page.evaluate(() =>
      __rigStudio.checks().find(c => c.key === "cables").level), "warn");
    assert.match(await shortCables.page.$eval("#rs-compatibility", e => e.textContent),
      /Speaker Cable Quantity or Routing Needs Review/);
    assert.match(await shortCables.page.$eval(".visual-pa", e => e.textContent), /Cable needed/);
    assert.deepEqual(shortCables.errors, []);
    await shortCables.context.close();

    routeRig.items.find(s => s.category === "cables").qty = 2;
    const enoughCables = await visit(browser, 390, rigQuery(routeRig));
    assert.equal(await enoughCables.page.evaluate(() =>
      __rigStudio.checks().find(c => c.key === "cables").level), "ok");
    assert.match(await enoughCables.page.$eval("#rs-compatibility", e => e.textContent),
      /Listed Audio Connection Match/);
    assert.match(await enoughCables.page.$eval(".visual-pa", e => e.textContent), /Cable in plan/);
    assert.deepEqual(enoughCables.errors, []);
    await enoughCables.context.close();

    // Regression: the same XLR SKU is already owned, but three independent
    // PA cabinets require another purchased pack. Auto-fix must never mark
    // an extra pack as owned or remove it from the shopping budget.
    const ownedCableRoute = {
      name: "Owned XLR needs another pack",
      items: routeRig.items.map(s => ({ ...s }))
    };
    const ownedXlr = ownedCableRoute.items.find(s => s.category === "cables");
    ownedXlr.qty = 1;
    ownedXlr.owned = true;
    const ownedFix = await visit(browser, 390, rigQuery(ownedCableRoute));
    assert.equal(await ownedFix.page.evaluate(() =>
      __rigStudio.checks().find(c => c.key === "cables").level), "warn");
    const spendBeforeOwnedFix = await ownedFix.page.evaluate(() => __rigStudio.stats().purchase);
    const ownedFixButton = '.visual-pa [data-action="auto-fix-cable"][data-cable-id="cable-xlr-xlr"]';
    assert.ok(await ownedFix.page.$(ownedFixButton), "missing PA cable must offer auto-fix");
    await ownedFix.page.click(ownedFixButton);
    const fixedOwned = await ownedFix.page.evaluate(() => ({
      cables: __rigStudio.state().items.filter(s => s.itemId === "cable-xlr-xlr"),
      spend: __rigStudio.stats().purchase,
      shopping: __rigStudio.shoppingList().filter(s => s.itemId === "cable-xlr-xlr"),
      cableCheck: __rigStudio.checks().find(c => c.key === "cables").level
    }));
    assert.deepEqual(fixedOwned.cables.map(s => [s.qty, s.owned]), [[1, true], [1, false]],
      "owned and new-to-buy cable packs must remain distinct");
    assert.equal(fixedOwned.spend, spendBeforeOwnedFix + 28,
      "extra required cable must increase out-of-pocket estimate");
    assert.equal(fixedOwned.shopping.length, 1);
    assert.equal(fixedOwned.shopping[0].lineTotal, 28);
    assert.equal(fixedOwned.cableCheck, "ok");
    await ownedFix.page.reload({ waitUntil: "networkidle0" });
    await ownedFix.page.waitForSelector(".visual-pa");
    const restoredCables = await ownedFix.page.evaluate(() =>
      __rigStudio.state().items.filter(s => s.itemId === "cable-xlr-xlr")
        .map(s => [s.qty, s.owned]));
    assert.deepEqual(restoredCables, [[1, true], [1, false]],
      "shared URL reload must preserve owned vs purchased cable packs");
    assert.deepEqual(ownedFix.errors, []);
    await ownedFix.context.close();
    console.log("PASS: owned XLR auto-fix purchases a distinct pack and survives share reload");

    routeRig.items[0].itemId = "pioneer-ddj-flx4";
    routeRig.items[2].qty = 1;
    routeRig.items.push({ slotId: "mon", category: "speakers", role: "dj_monitor",
      itemId: "pioneer-dm40d", qty: 1, owned: false });
    const outputConflict = await visit(browser, 390, rigQuery(routeRig));
    assert.equal(await outputConflict.page.evaluate(() =>
      __rigStudio.checks().find(c => c.key === "cables").level), "warn");
    assert.equal(await outputConflict.page.evaluate(() =>
      __rigStudio.checks().find(c => c.key === "host").level), "warn",
      "standalone USB-only host cannot be reported as connected to FLX4");
    assert.match(await outputConflict.page.$eval(".visual-route", e => e.textContent), /limitation/i);
    assert.deepEqual(outputConflict.errors, []);
    await outputConflict.context.close();
    console.log("PASS: insufficient PA cable packs and FLX4 dual-output conflict never show green readiness");

    // Guide-to-planner links must not wipe an existing saved shopping list.
    // Replacing a controller resets only its own purchase/quantity state;
    // accessory links append rather than replacing a different cable.
    const handoff = await visit(browser, 390);
    await handoff.page.evaluate(() => {
      localStorage.setItem("offbeat.rig.active", JSON.stringify({
        name: "Owner's Existing DJ Rig",
        items: [
          { slotId: "ctrl", category: "controllers", itemId: "pioneer-ddj-flx4", qty: 2, owned: true },
          { slotId: "hp", category: "headphones", itemId: "sennheiser-hd25", qty: 1, owned: true },
          { slotId: "sp", category: "speakers", itemId: "pioneer-dm40d", qty: 1, owned: false },
          { slotId: "host", category: "laptops", itemId: "macbook-air-m2", qty: 1, owned: true },
          { slotId: "mic", category: "microphones", itemId: "mic-shure-sm58", qty: 1, owned: false },
          { slotId: "rca", category: "cables", itemId: "cable-rca-rca", qty: 1, owned: false }
        ]
      }));
    });
    async function followGuideLink(itemId) {
      await handoff.page.goto(base + "/build-your-dj-setup.html?add=" + encodeURIComponent(itemId), {
        waitUntil: "load", timeout: 20000
      });
      await handoff.page.waitForSelector(".rig-dashboard-shell", { timeout: 15000 });
      return handoff.page.evaluate(() => ({
        state: JSON.parse(localStorage.getItem("offbeat.rig.active")),
        url: location.search,
        spend: document.querySelector(".metric-val--spend")?.textContent.trim()
      }));
    }
    let linked = await followGuideLink("denon-prime-4-plus");
    let slots = linked.state.items;
    assert.equal(linked.state.name, "Owner's Existing DJ Rig", "preserve user-defined rig name");
    assert.equal(slots.length, 6, "controller swap must not discard other equipment");
    assert.deepEqual(
      slots.filter(s => s.category === "controllers").map(s => [s.itemId, s.qty, s.owned]),
      [["denon-prime-4-plus", 1, false]],
      "different controller must not inherit old model's quantity or owned state"
    );
    assert.equal(slots.find(s => s.category === "laptops").owned, true);
    assert.equal(slots.find(s => s.category === "headphones").owned, true);
    assert.ok(slots.some(s => s.itemId === "mic-shure-sm58"));
    assert.ok(slots.some(s => s.itemId === "cable-rca-rca"));
    assert.match(linked.url, /^\?rig=/, "guide import must yield shareable current rig URL");
    assert.ok(Number(linked.spend.replace(/[^\d.]/g, "")) > 2000,
      "spend must reflect new unowned controller, not silently reset to default rig");

    linked = await followGuideLink("cable-xlr-xlr");
    assert.ok(linked.state.items.some(s => s.itemId === "cable-rca-rca"),
      "adding XLR must preserve existing RCA cable");
    assert.ok(linked.state.items.some(s => s.itemId === "cable-xlr-xlr"),
      "new cable must appear in shopping list");
    const accessoryCount = linked.state.items.length;
    linked = await followGuideLink("cable-xlr-xlr");
    assert.equal(linked.state.items.length, accessoryCount,
      "following the same accessory link twice must not duplicate purchases");

    // Following a link for equipment already owned must not mark it unowned.
    await handoff.page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem("offbeat.rig.active"));
      const controller = state.items.find(s => s.category === "controllers");
      controller.owned = true;
      controller.qty = 2;
      localStorage.setItem("offbeat.rig.active", JSON.stringify(state));
    });
    linked = await followGuideLink("denon-prime-4-plus");
    const same = linked.state.items.find(s => s.category === "controllers");
    assert.equal(same.owned, true, "same-product guide link preserves ownership");
    assert.equal(same.qty, 2, "same-product guide link preserves quantity");
    assert.deepEqual(handoff.errors, [], "guide handoffs must not throw browser errors");
    await handoff.context.close();
    console.log("PASS: guide-to-planner preserves rig, ownership, quantities and accessory purchases");

    // A real buyer selecting DDJ-GRV6 with a phone must see the supported
    // two-deck path and its limits, not a false "incompatible" verdict.
    // The same mobile host remains blocked for a controller not qualified here.
    function mobileRigLink(controllerId, hostId = "existing-mobile-device") {
      const state = { name: "Mobile host check", items: [
        { slotId: "ctrl", category: "controllers", itemId: controllerId, qty: 1, owned: false },
        { slotId: "hp", category: "headphones", itemId: "sennheiser-hd25", qty: 1, owned: true },
        { slotId: "host", category: "laptops", itemId: hostId, qty: 1, owned: true }
      ] };
      return "?rig=" + encodeURIComponent(Buffer.from(
        encodeURIComponent(JSON.stringify(state)), "binary").toString("base64"));
    }
    for (const width of [1440, 390]) {
      const mobileGRV6 = await visit(browser, width, mobileRigLink("alphatheta-ddj-grv6"));
      const shown = await mobileGRV6.page.evaluate(() => ({
        status: document.querySelector(".compat-status-tag")?.textContent.trim(),
        alerts: document.querySelector(".compat-items-grid")?.textContent || ""
      }));
      assert.match(shown.alerts, /GRV6 Mobile: Two Decks Only/);
      assert.match(shown.alerts, /channels 1 and 2/);
      assert.match(shown.alerts, /USB-C and Power Required/);
      assert.doesNotMatch(shown.alerts, /Mobile Host Not Verified for This Controller/);
      assert.doesNotMatch(shown.status, /Incompatible/);
      assert.deepEqual(mobileGRV6.errors, [], "GRV6 mobile UI must not throw");
      await mobileGRV6.context.close();
    }
    // Numark's official mobile djay support must not be rejected. Equally,
    // a selected controller-to-speaker cable cannot carry Bluetooth MIDI audio:
    // both master and cue outputs are disabled in that mode.
    for (const controllerId of ["numark-mixtrack-go", "numark-party-mix-3"]) {
      for (const width of [1440, 390]) {
        const mobileNumark = await visit(browser, width, mobileRigLink(controllerId));
        const shown = await mobileNumark.page.evaluate(() => ({
          status: document.querySelector(".compat-status-tag")?.textContent.trim() || "",
          alerts: document.querySelector(".compat-items-grid")?.textContent || ""
        }));
        assert.match(shown.alerts, /Numark Mobile: USB-C vs Bluetooth Audio Routing/);
        assert.match(shown.alerts, /Bluetooth MIDI disables the controller's master AND headphone audio outputs/);
        assert.match(shown.alerts, /5V\/500mA/);
        assert.doesNotMatch(shown.alerts, /Mobile Host Not Verified for This Controller/);
        assert.doesNotMatch(shown.status, /Incompatible/);
        assert.deepEqual(mobileNumark.errors, [], "Numark mobile browser journey must not throw");
        await mobileNumark.context.close();
      }
    }
    const mobileUnsupported = await visit(browser, 390, mobileRigLink("pioneer-ddj-flx10"));
    const blocked = await mobileUnsupported.page.$eval(".compat-items-grid", el => el.textContent);
    assert.match(blocked, /Mobile Host Not Verified for This Controller/);
    assert.deepEqual(mobileUnsupported.errors, [], "unverified mobile host UI must not throw");
    await mobileUnsupported.context.close();
    // The older preset and the newer Studio builder use different catalog
    // IDs for the same already-owned phone. Neither may bypass compatibility
    // checks or masquerade as a fully verified computer connection.
    for (const hostId of ["existing-mobile-device", "existing-mobile-app-device"]) {
      for (const controllerId of ["pioneer-ddj-flx2", "alphatheta-ddj-grv6",
        "numark-mixtrack-go", "numark-party-mix-3"]) {
        const mobile = await visit(browser, 390, mobileRigLink(controllerId, hostId));
        const checks = await mobile.page.evaluate(() => window.__rigStudio.checks());
        const host = checks.find(check => check.key === "host");
        assert.equal(host.level, "warn", hostId + " + " + controllerId + " must require mobile setup verification");
        assert.match(host.title, /Mobile Host|GRV6 Mobile|Numark Mobile/,
          "public host check must identify the controller-specific mobile limitation");
        assert.match(host.note, /USB|Bluetooth|power|mobile/i);
        const builderAlerts = await mobile.page.$eval(".compat-items-grid", el => el.textContent);
        assert.doesNotMatch(builderAlerts, /Mobile Host Not Verified for This Controller/);
        assert.deepEqual(mobile.errors, [], "cross-planner mobile host browser errors");
        await mobile.context.close();
      }
      const unsupported = await visit(browser, 390, mobileRigLink("pioneer-ddj-flx10", hostId));
      const host = await unsupported.page.evaluate(() => window.__rigStudio.checks().find(c => c.key === "host"));
      assert.equal(host.level, "bad", "unverified phone route must fail closed in Studio");
      const alerts = await unsupported.page.$eval(".compat-items-grid", el => el.textContent);
      assert.match(alerts, /Mobile Host Not Verified for This Controller/);
      await unsupported.context.close();
    }
    console.log("PASS: GRV6 supported two-deck mobile journey; unverified controller blocked");

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
