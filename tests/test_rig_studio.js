/* Browser test for the Rig Studio (build-your-dj-setup.html).
 *
 * Replaces the old test_rig_architect.js, which drove the retired
 * "Rig Architect" DOM (.booth-card, .picker-card, .rig-spec-table). The studio
 * is now a state machine that re-renders, so this test asserts on money and
 * readiness numbers rather than on card markup.
 *
 * Run:  node tests/test_rig_studio.js      (expects a static server on :8099)
 *       PORT=8080 node tests/test_rig_studio.js
 */
const assert = require("assert");

function loadPuppeteer() {
  const candidates = [
    process.env.PUPPETEER_CORE,
    "/tmp/browser/node_modules/puppeteer-core",
    "/tmp/node_modules/puppeteer-core",
    "puppeteer-core"
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      return require(c);
    } catch (e) {
      /* try the next path */
    }
  }
  throw new Error("puppeteer-core not found; set PUPPETEER_CORE to its install path");
}
const puppeteer = loadPuppeteer();

const PORT = process.env.PORT || 8099;
const BASE = `http://127.0.0.1:${PORT}`;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: "/tmp/chromium",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto(`${BASE}/build-your-dj-setup.html`, { waitUntil: "load" });
  await page.waitForSelector('[data-rs="quiz-open"]', { timeout: 8000 });

  /* 1 — the start screen offers the three ways in plus templates */
  const paths = await page.$$eval(".rs-path", (els) => els.map((e) => e.getAttribute("data-rs")));
  assert.deepStrictEqual(paths, ["quiz-open", "start-scratch", "start-owned"], "three start paths expected");
  const templates = await page.$$eval('[data-rs="preset"]', (els) => els.length);
  assert.ok(templates >= 3, `expected editable templates, found ${templates}`);

  /* 2 — a template builds a full rig with a cost panel and readiness checks */
  await page.click('[data-rs="preset"][data-preset="club-ready"]');
  await page.waitForSelector(".rs-bar-stats", { timeout: 5000 });
  await wait(300);
  const chip = await page.$eval("[data-cost-chip]", (el) => el.textContent.trim());
  assert.ok(/\$[\d,]+/.test(chip), `cost chip should show a total, got: ${chip}`);
  const checks = await page.evaluate(() => window.__rigStudio.readiness().length);
  assert.ok(checks >= 4, `expected readiness checks, found ${checks}`);
  const wires = await page.$$eval(".rs-wire", (els) => els.length);
  assert.ok(wires > 0, "the signal map should draw connections");
  const priceBefore = await page.evaluate(() => window.__rigStudio.cost());
  assert.ok(priceBefore.buyTotal > 0, "a template should need purchases");

  /* 3 — owning a line removes it from the money owed, not from the rig */
  const firstOwn = await page.$('[data-rs="own"]');
  await firstOwn.click();
  await wait(250);
  const priceAfter = await page.evaluate(() => window.__rigStudio.cost());
  assert.ok(priceAfter.buyTotal < priceBefore.buyTotal, "marking gear as owned should lower the bill");
  assert.strictEqual(priceAfter.fullTotal, priceBefore.fullTotal, "the rig's full value should not change");

  /* 4 — swapping gear changes the rig and the cost reacts */
  const modelBefore = await page.evaluate(() => window.__rigStudio.state().items.filter((i) => i.category === "controllers")[0].itemId);
  await page.click('[data-rs="pick"][data-cat="controllers"]');
  await page.waitForSelector(".rs-drawer", { timeout: 4000 });
  const optionCount = await page.$$eval(".rs-option", (els) => els.length);
  assert.ok(optionCount > 3, `candidate list should be populated, got ${optionCount}`);
  const otherPick = await page.evaluate(() => {
    const btn = document.querySelector("[data-drawer-use]");
    if (!btn) return null;
    const id = btn.getAttribute("data-drawer-use");
    btn.click();
    return id;
  });
  await wait(400);
  const modelAfter = await page.evaluate(() => window.__rigStudio.state().items.filter((i) => i.category === "controllers")[0].itemId);
  assert.ok(otherPick, "a swap target should be available in the drawer");
  assert.notStrictEqual(modelAfter, modelBefore, "picking another deck should change the rig");

  /* 5 — quantities: adding a second speaker changes the line count and the cost */
  const qtyBefore = await page.evaluate(() => {
    const s = window.__rigStudio.state().items.filter((i) => i.category === "speakers");
    return { units: s.reduce((n, x) => n + (x.qty || 1), 0), buy: window.__rigStudio.cost().buyTotal };
  });
  const qtyClicked = await page.evaluate(() => {
    /* the plus button on a speaker line, found through its slot id */
    const items = window.__rigStudio.state().items.filter((i) => i.category === "speakers");
    for (const it of items) {
      const btn = document.querySelector(`[data-rs="qty"][data-step="1"][data-slot="${it.slotId}"]`);
      if (btn && !btn.disabled) { btn.click(); return it.slotId; }
    }
    return null;
  });
  assert.ok(qtyClicked, "a speaker line should offer a working quantity stepper");
  await wait(300);
  const qtyAfter = await page.evaluate(() => {
    const s = window.__rigStudio.state().items.filter((i) => i.category === "speakers");
    return { units: s.reduce((n, x) => n + (x.qty || 1), 0), buy: window.__rigStudio.cost().buyTotal };
  });
  assert.ok(qtyAfter.units > qtyBefore.units, "the quantity stepper should add a speaker");
  assert.ok(qtyAfter.buy > qtyBefore.buy, "a second speaker should cost more");

  /* 6 — the shopping list only contains what is still missing */
  const shop = await page.evaluate(() => window.__rigStudio.shoppingList());
  assert.ok(shop.length > 0, "there should be something to buy");
  const ownedLineIds = shop.map((s) => s.itemId);
  const ownedIds = await page.evaluate(() =>
    window.__rigStudio.state().items.filter((i) => i.owned).map((i) => i.itemId)
  );
  ownedIds.forEach((id) => {
    assert.ok(!ownedLineIds.includes(id), `owned item ${id} should not be on the shopping list`);
  });

  /* 7 — save, then compare the saved build against the current one */
  await page.click('.rs-bar-actions [data-rs="save"]');
  await page.waitForSelector("[data-save-name]", { timeout: 3000 });
  await page.type("[data-save-name]", "Studio test rig");
  await page.click('[data-rs="do-save"]');
  await wait(500);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("offbeat.rigs.saved") || "[]"));
  assert.ok(saved.some((s) => s.name === "Studio test rig"), "the build should be saved locally");

  const compareBtn = await page.$('.rs-saved-card [data-rs="compare-saved"]');
  assert.ok(compareBtn, "each saved build should offer a compare action");
  await compareBtn.click();
  await wait(500);
  const cmpTitle = await page.$eval(".rs-modal h2, [role=dialog] h2", (el) => el.textContent.trim());
  assert.ok(/Compare/.test(cmpTitle), `compare modal should open, got: ${cmpTitle}`);
  const cmpA = await page.$eval("[data-cmp-a]", (el) => el.value);
  const cmpB = await page.$eval("[data-cmp-b]", (el) => el.value);
  assert.notStrictEqual(cmpA, cmpB, "the two compare slots should start on different builds");
  await page.click('[data-rs="close-modal"]');
  await wait(300);

  /* 8 — sharing round-trips: the link rebuilds the same name and the same bill */
  const share = await page.evaluate(() => window.__rigStudio.shareUrl());
  assert.ok(share && share.includes("?rig="), "share URL should carry the rig payload");
  const shared = await browser.newPage();
  await shared.setViewport({ width: 1280, height: 900 });
  await shared.goto(share, { waitUntil: "load" });
  await shared.waitForSelector(".rs-bar-stats", { timeout: 8000 });
  const sharedState = await shared.evaluate(() => ({
    cost: window.__rigStudio.cost(),
    count: window.__rigStudio.state().items.length
  }));
  assert.strictEqual(sharedState.count, await page.evaluate(() => window.__rigStudio.state().items.length),
    "the shared link should rebuild every line");
  assert.strictEqual(sharedState.cost.buyTotal, await page.evaluate(() => window.__rigStudio.cost().buyTotal),
    "the shared link should rebuild the same bill");
  await shared.close();

  /* 9 — mobile keeps the studio usable without horizontal overflow */
  const mobile = await browser.newPage();
  await mobile.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await mobile.goto(`${BASE}/build-your-dj-setup.html?preset=club-ready`, { waitUntil: "load" });
  await mobile.waitForSelector(".rs-bar-stats", { timeout: 8000 });
  const widths = await mobile.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  assert.strictEqual(widths[0], widths[1], `no horizontal overflow expected at 390px, got ${widths}`);
  await mobile.close();

  assert.deepStrictEqual(errors, [], `console errors: ${errors.join(" | ")}`);

  await browser.close();
  console.log("Rig Studio: all checks passed, 0 console errors");
})().catch((err) => {
  console.error("Rig Studio test failed:", err.message);
  process.exit(1);
});
