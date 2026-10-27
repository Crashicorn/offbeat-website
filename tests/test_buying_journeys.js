/* Real-browser regression test for the buying journeys an independent MacBook
 * review broke: the guide → Rig Studio cable allowance, speaker package
 * quantities, stereo readiness, comparison-table column identity and mobile
 * comparison use, plus shared/restored rigs.
 *
 * Run:  node tests/test_buying_journeys.js       (expects a static server on :8099)
 *       PORT=8080 PUPPETEER_CORE=/path/to/puppeteer-core node tests/test_buying_journeys.js
 *       CHROMIUM_EXECUTABLE=/path/to/chrome node tests/test_buying_journeys.js
 *
 * Assertions are on money, cabinet counts, readiness levels and rendered
 * geometry — not on whether a source string exists.
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

function dollars(text) {
  const match = String(text).match(/\$([\d,]+)/);
  return match ? Number(match[1].replace(/,/g, "")) : NaN;
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE || "/tmp/chromium",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const rigCost = () => page.evaluate(() => window.__rigStudio.cost());
  const rigChecks = () => page.evaluate(() => window.__rigStudio.checks());
  const rigSpeakers = () => page.evaluate(() => window.__rigStudio.speakers());
  const openRig = async (href) => {
    const target = href.startsWith("http") ? href : BASE + "/" + href;
    await page.goto(target, { waitUntil: "networkidle0" });
    await page.waitForSelector(".rs-bar", { timeout: 8000 });
    await wait(250);
  };

  try {
    /* ---------------------------------------------------------------- H1 --
     * The $15 FLX2 cable allowance must survive the hand-off, and the guide's
     * total must equal Rig Studio's bill to the dollar, in both ownership
     * states and after a controller change. */
    await page.goto(BASE + "/best-dj-controllers-for-beginners.html", { waitUntil: "networkidle0" });
    await page.waitForSelector("[data-bl-total]");
    await page.click('[data-bl-choose="pioneer-ddj-flx2"]');
    await wait(150);

    const guideFlx2 = await page.$eval("[data-bl-total]", (el) => el.textContent.trim());
    assert.strictEqual(dollars(guideFlx2), 412, `FLX2 guide total should be $412, got ${guideFlx2}`);
    const guideRows = await page.$$eval(".beginner-lab-line", (els) => els.map((el) => el.textContent.replace(/\s+/g, " ").trim()));
    assert.ok(guideRows.some((row) => /3\.5 mm → RCA cable allowance/.test(row) && /\$15/.test(row)),
      `the FLX2 line should show the $15 3.5 mm allowance, got ${JSON.stringify(guideRows)}`);
    assert.ok(guideRows.some((row) => /allowance/i.test(row)), "the allowance row should be labelled as an estimate");

    const flx2Href = await page.$eval("[data-bl-build]", (el) => el.getAttribute("href"));
    await openRig(flx2Href);
    const flx2Rig = await rigCost();
    assert.strictEqual(flx2Rig.buyTotal, 412, `Rig Studio should charge $412 for the same rig, got $${flx2Rig.buyTotal}`);
    assert.strictEqual(flx2Rig.fullTotal, 412, `full rig value should be $412, got $${flx2Rig.fullTotal}`);

    const allowanceChecks = await rigChecks();
    assert.ok(allowanceChecks.some((c) => c.key === "cables" && /\$15/.test(c.title)),
      `the cable check should account for the $15 allowance, got ${JSON.stringify(allowanceChecks.filter((c) => c.key === "cables"))}`);

    const shopText = await page.evaluate(() => window.__rigStudio.shoppingText());
    assert.ok(/3\.5 mm stereo mini-jack to dual RCA cable \(allowance\)/.test(shopText), "the shopping list carries the allowance");
    assert.ok(/no recommended SKU/i.test(shopText), "the shopping list says the allowance has no recommended SKU");
    assert.ok(/ESTIMATED TOTAL: \$412/.test(shopText), "the printed list totals $412");

    const ribbon = await page.$eval(".rs-ribbon", (el) => el.textContent.replace(/\s+/g, " ").trim());
    assert.ok(/guide/i.test(ribbon) && !/shared build/i.test(ribbon),
      `a guide hand-off must not claim to be someone else's shared build, got: ${ribbon}`);

    /* Ownership toggle in Rig Studio: the allowance stops being charged. */
    const cableSlotId = await page.evaluate(() => {
      const slot = window.__rigStudio.state().items.find((s) => s.category === "cables");
      return slot ? slot.slotId : null;
    });
    assert.ok(cableSlotId, "the imported rig has a cable line to toggle");
    await page.click(`[data-rs="own"][data-slot="${cableSlotId}"]`);
    await wait(250);
    const ownedRig = await rigCost();
    assert.strictEqual(ownedRig.buyTotal, 397, `owning the cable leaves $397, got $${ownedRig.buyTotal}`);
    assert.strictEqual(ownedRig.fullTotal, 412, "the full rig value does not change when a line is marked owned");
    const ownedChecks = await rigChecks();
    assert.ok(ownedChecks.some((c) => c.key === "cables" && c.level === "ok"),
      `an owned 3.5 mm lead should satisfy the cable check, got ${JSON.stringify(ownedChecks.filter((c) => c.key === "cables"))}`);

    /* Controller change in the guide: verified dual-RCA cable, no allowance. */
    await page.goto(BASE + "/best-dj-controllers-for-beginners.html", { waitUntil: "networkidle0" });
    await page.waitForSelector("[data-bl-total]");
    const flx4Href = await page.$eval("[data-bl-build]", (el) => el.getAttribute("href"));
    assert.strictEqual(dollars(await page.$eval("[data-bl-total]", (el) => el.textContent.trim())), 539);
    await openRig(flx4Href);
    const flx4Rig = await rigCost();
    assert.strictEqual(flx4Rig.buyTotal, 539, `FLX4 rig should cost $539, got $${flx4Rig.buyTotal}`);
    const flx4Cable = (await rigSpeakers()).cableRunsNeeded[0];
    assert.strictEqual(flx4Cable.cableId, "cable-rca-rca", "the FLX4 uses the verified dual RCA cable");
    assert.strictEqual(flx4Cable.allowanceId, null, "no allowance is charged when a verified cable exists");

    /* ---------------------------------------------------------------- H2 --
     * A retail pair is one purchase, two cabinets, one cable run. */
    await openRig("build-your-dj-setup.html?preset=bedroom-starter");
    const pairSpeakers = await rigSpeakers();
    assert.deepStrictEqual(pairSpeakers.boxes.map((b) => [b.itemId, b.qty, b.unitsPerBox]),
      [["pioneer-dm40d", 1, 2]], `one DM-40D box should be one purchase of two cabinets, got ${JSON.stringify(pairSpeakers.boxes)}`);
    assert.strictEqual(pairSpeakers.cabinets, 2, "a purchased pair is two physical speakers");
    assert.strictEqual(pairSpeakers.cableRunsNeeded.length, 1);
    assert.strictEqual(pairSpeakers.cableRunsNeeded[0].needed, 1, "a pair still needs one dual RCA run, not two");

    const pairCost = await rigCost();
    const pairChecks = await rigChecks();
    const output = pairChecks.find((c) => c.key === "output");
    assert.strictEqual(output.level, "ok", `a pair should read as stereo, got ${output.level}: ${output.title}`);
    assert.ok(/2 cabinets/.test(output.title), `the output check should count cabinets, got ${output.title}`);
    assert.ok(!/second speaker/i.test(output.note), `stereo guidance must not ask for a second speaker, got: ${output.note}`);
    assert.ok(!(await page.$(".rs-upgrade")), "a satisfied stereo pair should not be sold a second speaker");

    const mapNodes = await page.$$eval(".rs-node", (els) => els.map((el) => el.getAttribute("aria-label") || ""));
    assert.ok(mapNodes.some((label) => /^Left cabinet:/.test(label)), `the map should show a left cabinet, got ${JSON.stringify(mapNodes)}`);
    assert.ok(mapNodes.some((label) => /^Right cabinet:/.test(label)), `the map should show a right cabinet, got ${JSON.stringify(mapNodes)}`);
    assert.ok(!mapNodes.some((label) => /Add the right side/.test(label)), "a pair leaves no ghost asking for a right side");
    const wires = await page.$$eval(".rs-wire", (els) => els.map((el) => el.getAttribute("data-to") || ""));
    assert.ok(wires.some((to) => /speaker0/.test(to)) && wires.some((to) => /speaker1/.test(to)),
      `both cabinets should be wired, got ${JSON.stringify(wires)}`);

    /* Quantity stepper: two pairs = four cabinets, two purchases, two runs. */
    const speakerSlot = await page.evaluate(() => window.__rigStudio.state().items.find((s) => s.category === "speakers").slotId);
    await page.click(`[data-rs="qty"][data-slot="${speakerSlot}"][data-step="1"]`);
    await wait(300);
    const doubled = await rigSpeakers();
    const doubledCost = await rigCost();
    assert.strictEqual(doubled.cabinets, 4, "two pairs are four cabinets");
    assert.strictEqual(doubled.cableRunsNeeded[0].needed, 2, "two boxes need two cable runs");
    assert.strictEqual(doubledCost.fullTotal - pairCost.fullTotal, 149, "the second pair costs exactly one more box, not two speakers");
    await page.click(`[data-rs="qty"][data-slot="${speakerSlot}"][data-step="-1"]`);
    await wait(250);

    /* Single-cabinet product: one cabinet, mono, and the advice names a second unit. */
    await openRig("build-your-dj-setup.html?preset=bedroom-starter");
    const singleSlot = await page.evaluate(() => window.__rigStudio.state().items.find((s) => s.category === "speakers").slotId);
    await page.click(`[data-rs="pick"][data-slot="${singleSlot}"][data-cat="speakers"]`);
    await page.waitForSelector(".rs-drawer", { timeout: 4000 });
    await page.evaluate(() => {
      const use = [...document.querySelectorAll("[data-drawer-use]")].find((b) => b.getAttribute("data-drawer-use") === "jbl-eon-715");
      if (use) use.click();
    });
    await wait(400);
    const mono = await rigSpeakers();
    assert.strictEqual(mono.cabinets, 1, "a single PA cabinet is one cabinet");
    assert.strictEqual(mono.boxes[0].unitsPerBox, 1, "the EON715 is sold as one cabinet");
    const monoChecks = await rigChecks();
    const monoOutput = monoChecks.find((c) => c.key === "output");
    assert.strictEqual(monoOutput.level, "warn", `one cabinet should be flagged as mono, got ${monoOutput.level}: ${monoOutput.title}`);
    assert.ok(/mono/i.test(monoOutput.title), `the check should say mono, got ${monoOutput.title}`);
    const upgrade = await page.$eval(".rs-upgrade", (el) => el.textContent.replace(/\s+/g, " ").trim());
    assert.ok(/add a second JBL|EON715|second/i.test(upgrade), `the upgrade should offer a matching second cabinet, got: ${upgrade}`);
    const monoNodes = await page.$$eval(".rs-node", (els) => els.map((el) => el.getAttribute("aria-label") || ""));
    assert.ok(monoNodes.some((label) => /Add the right side/.test(label)), "a single cabinet leaves the right side visibly open");

    /* ------------------------------------------ staged purchase planning --
     * The "what to buy first" panel was added because the planner knew the
     * total but never the order. Its stages must be the same money as the
     * shopping list, and a cable allowance must be labelled, not hidden. */
    await openRig("build-your-dj-setup.html?preset=bedroom-starter");
    const stages = await page.evaluate(() => [...document.querySelectorAll("#rs-plan .rs-step")].map((el) => ({
      title: el.querySelector("h4").textContent.trim(),
      total: Number(el.querySelector(".rs-step-sum").textContent.replace(/[^0-9]/g, "")),
      running: Number(el.querySelector(".rs-step-run b").textContent.replace(/[^0-9]/g, "")),
      lines: [...el.querySelectorAll(".rs-step-lines li")].map((li) => li.textContent.replace(/\s+/g, " ").trim())
    })));
    const stageBill = await page.evaluate(() => window.__rigStudio.cost().buyTotal);
    assert.strictEqual(stages.length, 3, `expected three purchase stages, got ${stages.length}`);
    assert.strictEqual(stages.reduce((n, s2) => n + s2.total, 0), stageBill,
      `stages must add up to the bill (${stageBill}), got ${stages.map((s2) => s2.total)}`);
    assert.strictEqual(stages[stages.length - 1].running, stageBill, "the last running total is the whole bill");
    assert.ok(/Play tonight/.test(stages[0].title), `step 1 should be the playable chain, got ${stages[0].title}`);
    assert.ok(stages[1].lines.some((line) => /DM-40D \(Pair\)/.test(line)), "monitors belong to step 2");
    assert.ok(stages[0].lines.every((line) => !/DM-40D/.test(line)), "step 1 does not quietly include the monitors");

    /* A guide rig with the FLX2 allowance shows it in the plan, explicitly. */
    await page.goto(BASE + "/best-dj-controllers-for-beginners.html", { waitUntil: "networkidle0" });
    await page.waitForSelector("[data-bl-total]");
    await page.click('[data-bl-choose="pioneer-ddj-flx2"]');
    await wait(150);
    await openRig(await page.$eval("[data-bl-build]", (el) => el.getAttribute("href")));
    const allowanceStages = await page.$$eval("#rs-plan .rs-step-lines li", (els) => els.map((el) => el.textContent.replace(/\s+/g, " ").trim()));
    assert.ok(allowanceStages.some((line) => /3\.5 mm/.test(line) && /allowance/i.test(line) && /\$15/.test(line)),
      `the staged plan should show the $15 allowance as an allowance, got ${JSON.stringify(allowanceStages)}`);

    /* ---------------------------------------------------------------- H3 --
     * Each action cell must sit under its own product heading. */
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(BASE + "/controller-software-compatibility-matrix.html", { waitUntil: "networkidle0" });
    await page.waitForSelector("[data-mat-compare]");
    for (const id of ["flx4", "flx2", "raneone"]) await page.click(`[data-mat-compare="${id}"]`);
    await page.click("[data-compare-open]");
    await page.waitForSelector(".matrix-compare-table");
    await wait(250);

    const columnGeometry = await page.evaluate(() => {
      const table = document.querySelector(".matrix-compare-table");
      const heads = [...table.querySelectorAll("thead th")].map((th) => {
        const r = th.getBoundingClientRect();
        return { name: (th.getAttribute("data-compare-product") || "decision").trim(), x: Math.round(r.x), right: Math.round(r.right) };
      });
      const lastRow = table.querySelector("tbody tr:last-child");
      const cells = [...lastRow.children].map((cell) => {
        const r = cell.getBoundingClientRect();
        return {
          tag: cell.tagName,
          product: cell.getAttribute("data-compare-product"),
          x: Math.round(r.x),
          right: Math.round(r.right),
          display: getComputedStyle(cell).display,
          links: [...cell.querySelectorAll("a")].map((a) => ({ text: a.textContent.trim(), label: a.getAttribute("aria-label") }))
        };
      });
      return { heads, cells, rows: table.tBodies[0].rows.length };
    });

    const productHeads = columnGeometry.heads.filter((h) => h.name !== "decision");
    assert.strictEqual(productHeads.length, 3, "three controllers were shortlisted");
    const actionCells = columnGeometry.cells.slice(1);
    assert.strictEqual(actionCells.length, 3, "one action cell per controller");
    actionCells.forEach((cell, index) => {
      assert.strictEqual(cell.display, "table-cell", `action cell ${index} must stay a table cell, got ${cell.display}`);
      assert.strictEqual(cell.product, productHeads[index].name.replace(/&amp;/g, "&"),
        `action cell ${index} should belong to ${productHeads[index].name}, got ${cell.product}`);
      assert.ok(Math.abs(cell.x - productHeads[index].x) <= 1,
        `action cell ${index} should start under its own column (${productHeads[index].x}), got ${cell.x}`);
      assert.strictEqual(cell.links.length, 2, "each controller keeps its own guide and planner links");
      cell.links.forEach((link) => {
        assert.ok(link.label && link.label.length > 8, `link "${link.text}" should name its product for assistive tech`);
      });
    });
    /* The three cells must not share one column. */
    assert.strictEqual(new Set(actionCells.map((c) => c.x)).size, 3, "action links for different controllers must not stack in one column");

    /* ------------------------------------------------ H3 mobile usability --
     * Switching to a mobile viewport reloads the page, so the shortlist is
     * rebuilt through the same controls a phone user would use. */
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.reload({ waitUntil: "networkidle0" });
    await page.waitForSelector("[data-mat-compare]");
    for (const id of ["flx4", "flx2", "raneone"]) await page.click(`[data-mat-compare="${id}"]`);
    await page.click("[data-compare-open]");
    await page.waitForSelector(".matrix-compare-table");
    await wait(300);
    const mobileStart = await page.evaluate(() => {
      const sc = document.querySelector(".matrix-compare-scroll");
      return {
        scrollable: sc.scrollWidth > sc.clientWidth,
        legend: [...document.querySelectorAll(".matrix-compare-legend li")].map((li) => li.textContent.trim()),
        hintVisible: getComputedStyle(document.querySelector(".matrix-table-hint")).display !== "none"
      };
    });
    assert.ok(mobileStart.scrollable, "the comparison still scrolls sideways on a phone");
    assert.strictEqual(mobileStart.legend.length, 3, "a numbered legend names every compared controller");
    assert.ok(mobileStart.hintVisible, "the mobile scroll hint is visible");

    await page.evaluate(() => { document.querySelector(".matrix-compare-scroll").scrollLeft = 400; });
    await wait(300);
    const mobileScrolled = await page.evaluate(() => {
      const sc = document.querySelector(".matrix-compare-scroll");
      const firstCells = [...document.querySelectorAll(".matrix-compare-table tbody th")].slice(0, 3).map((th) => Math.round(th.getBoundingClientRect().x));
      const labels = [...document.querySelectorAll(".matrix-compare-table tbody td")].slice(0, 3)
        .map((td) => getComputedStyle(td, "::before").content);
      return { scrollLeft: Math.round(sc.scrollLeft), firstCells, labels };
    });
    assert.ok(mobileScrolled.scrollLeft > 0, "the comparison actually scrolled");
    assert.strictEqual(new Set(mobileScrolled.firstCells).size, 1,
      `the decision column should stay pinned while scrolling, got x positions ${mobileScrolled.firstCells}`);
    assert.ok(mobileScrolled.labels.some((content) => /Pioneer|Rane/i.test(content)),
      `scrolled cells should repeat their controller name, got ${JSON.stringify(mobileScrolled.labels)}`);

    /* ------------------------------------------- shared and restored rigs -- */
    await page.setViewport({ width: 1280, height: 900 });
    await openRig("build-your-dj-setup.html?preset=bedroom-starter");
    const shareUrl = await page.evaluate(() => window.__rigStudio.shareUrl());
    const beforeShare = await rigCost();

    /* A link somebody shares must still say so; it is not a guide hand-off. */
    await page.goto(shareUrl, { waitUntil: "networkidle0" });
    await page.waitForSelector(".rs-ribbon", { timeout: 6000 });
    const sharedRibbon = await page.$eval(".rs-ribbon", (el) => el.textContent.replace(/\s+/g, " ").trim());
    assert.ok(/shared build/i.test(sharedRibbon), `a shared link should say it is shared, got: ${sharedRibbon}`);
    const sharedCost = await rigCost();
    assert.strictEqual(sharedCost.buyTotal, beforeShare.buyTotal, "a shared rig restores the same money owed");
    assert.deepStrictEqual((await rigSpeakers()).boxes, [{ itemId: "pioneer-dm40d", qty: 1, unitsPerBox: 2 }]);

    /* Save a copy, then reload from browser storage: ownership and cabinets survive. */
    const hpSlot = await page.evaluate(() => window.__rigStudio.state().items.find((s) => s.category === "headphones").slotId);
    await page.click(`[data-rs="own"][data-slot="${hpSlot}"]`);
    await wait(250);
    const afterOwnership = await rigCost();
    await page.click('[data-rs="save"]');
    await page.waitForSelector("[data-save-name]", { timeout: 4000 });
    await page.type("[data-save-name]", "Journey test rig");
    await page.click('[data-rs="do-save"]');
    await wait(400);
    const savedNames = await page.evaluate(() => JSON.parse(localStorage.getItem("offbeat.rigs.saved") || "[]").map((s) => s.name));
    assert.ok(savedNames.includes("Journey test rig"), `the build should be stored locally, got ${JSON.stringify(savedNames)}`);

    const sharedAgain = await page.evaluate(() => window.__rigStudio.shareUrl());
    await page.goto(sharedAgain, { waitUntil: "networkidle0" });
    await page.waitForSelector(".rs-bar", { timeout: 6000 });
    await wait(250);
    const restored = await rigCost();
    assert.strictEqual(restored.buyTotal, afterOwnership.buyTotal, "a restored link keeps the ownership discount");
    assert.strictEqual(restored.fullTotal, afterOwnership.fullTotal, "a restored link keeps the same rig value");
    assert.strictEqual((await rigSpeakers()).cabinets, 2, "a restored pairing is still two cabinets");

    console.log("Buying journeys: guide hand-off money, ownership, speaker pairs, stereo map, staged plan, comparison columns, mobile scrolling and shared rigs all pass");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error("buying journey test failed:", error.message);
  process.exit(1);
});
