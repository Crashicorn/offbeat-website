/*
 * Buying-journey tests: the speaker planner, the Rig Studio connection panel
 * and the comparison-table touch targets.
 *
 * These extend tests/test_cable_plan.js. That suite proves the shared cable
 * model is right; this one proves the pages visitors actually touch are using
 * it — the speaker guide's planning step, the Rig Studio panel that names the
 * lead, and the mobile next-step links from N4.
 *
 * Everything is driven through the real DOM (tests/dom_harness.js) with real
 * clicks and change events, then asserted on rendered text, money and the
 * shopping list. jsdom has no layout engine, so the N4 block checks the
 * cascade (the 44px rule actually applies to the live anchors) rather than
 * measured pixel boxes; the MacBook pass still owns geometry.
 *
 * Run:  node tests/test_buying_journeys.js
 *       JSDOM_PATH=/path/to/jsdom node tests/test_buying_journeys.js
 */
const assert = require("assert");
const path = require("path");
const { startServer, openPage } = require("./dom_harness");

const catalog = require(path.join(__dirname, "..", "assets", "dj-gear-catalog.json"));
const byId = {};
catalog.items.forEach((item) => { byId[item.id] = item; });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function encode(payload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const slot = (slotId, category, itemId, extra) => Object.assign({ slotId, category, itemId, qty: 1, owned: false }, extra || {});

const money = (value) => Number(String(value).replace(/[^0-9.]/g, ""));

(async () => {
  const server = await startServer();
  let page = null;
  const open = async (url, options) => {
    if (page) page.close();
    page = await openPage(url, options);
    return page;
  };

  try {
    /* ---------------------------------------------- speaker planner (step 2) --
     * The finder answers "which job". The planner has to answer the question
     * that decides the purchase: what plugs into what, and what is in the box.
     */
    page = await openPage(server.base + "/best-dj-monitor-speakers.html", { expectRig: false });
    await wait(400);
    const planner = () => page.document.querySelector("[data-speaker-plan]");
    const options = () => page.queryAll("[data-speaker-plan] .speaker-plan-option");
    const primary = () => page.document.querySelector("[data-speaker-plan] .speaker-plan-option.is-primary");
    const setRadio = async (name, value) => {
      const input = page.document.querySelector(`input[name="${name}"][value="${value}"]`);
      assert.ok(input, `radio ${name}=${value} exists on the page`);
      input.checked = true;
      input.dispatchEvent(new page.window.Event("change", { bubbles: true }));
      await wait(250);
    };

    /* Default state: desk route, FLX4 checked in both groups. */
    assert.ok(planner() && planner().textContent.trim().length > 0, "the planner renders a plan on load");
    assert.strictEqual(options().length, 2, "the desk route shows a primary speaker and one alternative");
    assert.match(primary().textContent, /DM-40D/, "the desk route's primary is the DM-40D");
    assert.match(page.text("[data-speaker-plan]"), /Gold-Plated Dual RCA to Dual RCA/, "the planner names the actual lead");
    assert.strictEqual(money(page.text(".speaker-plan-option.is-primary .speaker-plan-total")), 161,
      "DM-40D pair ($149) + $12 verified lead = $161");

    /* Signal path names the socket the plan actually uses, not every socket the
       cabinet happens to own; the full input list stays available in the title. */
    const signalPath = page.document.querySelector(".speaker-plan-option.is-primary .speaker-plan-facts li b").textContent.replace(/\s+/g, " ").trim();
    assert.strictEqual(signalPath, "RCA (unbalanced) master \u2192 RCA",
      `the signal path should describe the RCA run only, got "${signalPath}"`);
    const pathTitle = page.document.querySelector(".speaker-plan-option.is-primary .speaker-plan-facts li b").getAttribute("title");
    assert.match(pathTitle, /RCA \/ 3\.5 mm/, "the title still lists every input on the cabinet");

    /* The box lead cannot substitute for the purchased lead — buyers need that. */
    assert.match(page.text("[data-speaker-plan]"), /does not replace this lead/,
      "the plan admits the included 3.5 mm lead cannot feed an RCA output");

    /* Deck swap: the FLX2 has a 3.5 mm master, so the DM-40D box lead covers it. */
    await setRadio("speaker-deck", "pioneer-ddj-flx2");
    assert.match(page.text("[data-speaker-plan]"), /No cable purchase/, "FLX2 + DM-40D is covered by the lead in the box");
    assert.strictEqual(money(page.text(".speaker-plan-option.is-primary .speaker-plan-total")), 149,
      "no cable is charged when the box lead fits");
    assert.ok(!/Verified lead|Planning allowance/.test(page.text("[data-speaker-plan] .speaker-plan-option.is-primary")),
      "a covered path shows neither a purchase nor an allowance");

    /* Back to the FLX4: the $12 lead has to come back with it. */
    await setRadio("speaker-deck", "pioneer-ddj-flx4");
    assert.match(page.text("[data-speaker-plan]"), /Gold-Plated Dual RCA to Dual RCA/,
      "swapping back to the FLX4 restores the RCA lead, not a stale 3.5 mm allowance");
    assert.strictEqual(money(page.text(".speaker-plan-option.is-primary .speaker-plan-total")), 161,
      "the restored plan still totals $161");

    /* Production route: HS5 needs a dual RCA → dual 1/4" TS lead. */
    await setRadio("speaker-use", "production");
    assert.match(primary().textContent, /Yamaha HS5/, "the production route's primary is the HS5");
    assert.match(primary().textContent, /Dual RCA to Dual 1\/4" TS/, "the HS5 plan uses a 1/4-inch lead, not a claimed RCA input");
    assert.strictEqual(money(page.text(".speaker-plan-option.is-primary .speaker-plan-total")), 413,
      "HS5 two units ($398) + $15 lead = $413");
    const alt = page.queryAll("[data-speaker-plan] .speaker-plan-option")[1];
    assert.match(alt.textContent, /Classic 5 \(Pair, Monitor Pack\)/, "the alternative names the exact KRK pack");
    assert.strictEqual(money(alt.querySelector(".speaker-plan-total").textContent), 311,
      "the KRK pack ($299) + RCA lead ($12) = $311");

    /* Quiet route: no speaker purchase, but a route out. */
    await setRadio("speaker-use", "quiet");
    assert.strictEqual(options().length, 0, "headphones-first removes the speaker options");
    assert.match(page.text("[data-speaker-plan]"), /No speaker purchase in this plan/, "the empty state explains itself");
    assert.strictEqual(page.query("[data-speaker-plan] .speaker-plan-cta").getAttribute("href"),
      "build-your-dj-setup.html?start=guide", "the empty state still links into Rig Studio");

    /* The deep link has to reproduce the number printed beside it. */
    await setRadio("speaker-use", "desk");
    await setRadio("speaker-deck", "pioneer-ddj-flx4");
    const plannerTotal = money(page.text(".speaker-plan-option.is-primary .speaker-plan-total"));
    const href = page.document.querySelector(".speaker-plan-option.is-primary .speaker-plan-cta").getAttribute("href");
    const rigPage = await openPage(new URL(href, server.base + "/").href);
    const rigCost = await rigPage.cost();
    const controllerPrice = Number(byId["pioneer-ddj-flx4"].price);
    assert.strictEqual(rigCost.buyTotal, plannerTotal + controllerPrice,
      `the planner's $${plannerTotal} plus the controller ($${controllerPrice}) must equal the Rig Studio bill ($${rigCost.buyTotal})`);
    const rigShopping = (await rigPage.shopping()).map((line) => line.itemId).sort();
    assert.deepStrictEqual(rigShopping, ["cable-rca-rca", "pioneer-ddj-flx4", "pioneer-dm40d"].sort(),
      "the handover carries the deck, the speaker and exactly one lead");
    rigPage.close();

    /* "I already own these" is a real buying journey: keep the guide price for
       the pair out of the bill, price only the lead, and hand the same
       ownership over to Rig Studio instead of billing the pair again. */
    const ownedBox = page.document.querySelector('input[name="speaker-owned"]');
    assert.ok(ownedBox, "the planner offers a 'I already own these speakers' control");
    ownedBox.checked = true;
    ownedBox.dispatchEvent(new page.window.Event("change", { bubbles: true }));
    await wait(250);
    assert.match(page.text("[data-speaker-plan]"), /You already own these speakers/, "the plan says the pair is owned");
    assert.strictEqual(page.text(".speaker-plan-option.is-primary .speaker-plan-price"), "Owned",
      "the owned pair is not priced again");
    assert.match(page.text(".speaker-plan-option.is-primary .speaker-plan-total"), /Lead only/, "the total is lead-only");
    assert.strictEqual(money(page.text(".speaker-plan-option.is-primary .speaker-plan-total")), 12,
      "owning the pair leaves only the $12 lead");
    const ownedHref = page.document.querySelector(".speaker-plan-option.is-primary .speaker-plan-cta").getAttribute("href");
    const ownedRig = await openPage(new URL(ownedHref, server.base + "/").href);
    const ownedCost = await ownedRig.cost();
    assert.strictEqual(ownedCost.buyTotal, 12 + controllerPrice,
      `the hand-off bills the controller and the lead only, got $${ownedCost.buyTotal}`);
    assert.strictEqual(ownedCost.ownedTotal, Number(byId["pioneer-dm40d"].price),
      "the speaker the visitor already owns is carried over as owned, not dropped or charged");
    ownedRig.close();
    ownedBox.checked = false;
    ownedBox.dispatchEvent(new page.window.Event("change", { bubbles: true }));
    await wait(250);
    assert.strictEqual(money(page.text(".speaker-plan-option.is-primary .speaker-plan-total")), 161,
      "unchecking ownership restores the full speakers + lead price");

    assert.deepStrictEqual(page.consoleErrors, [], `speaker planner console errors: ${page.consoleErrors.join(" | ")}`);

    /* ------------------------------------------- Rig Studio connection panel --
     * The panel is the rig's own answer to "what connects this to that". */
    page = await open(server.base + "/build-your-dj-setup.html?preset=bedroom-starter");
    const rows = () => page.queryAll(".rs-connect-row");
    assert.strictEqual(rows().length, 1, "one speaker path renders one connection row");
    assert.strictEqual(rows().length, (await page.cableLines()).length,
      "the panel shows the same number of paths as the shopping list");
    const rowText = rows()[0].textContent.replace(/\s+/g, " ");
    assert.match(rowText, /2 cabinets/, "the row distinguishes cabinets from signal feeds");
    assert.match(rowText, /1 signal feed/, "a master/slave pair is one feed");
    assert.match(rowText, /RCA \u2192 RCA/, "the row names the connector pair");
    assert.match(rowText, /Gold-Plated Dual RCA to Dual RCA/, "the row names the catalogue lead");
    assert.match(rowText, /On the list/, "an auto-added lead is not silently charged twice");

    /* Removing the lead must leave the panel honest: it prices the gap and
       offers the exact fix, and taking the fix restores one line, not two. */
    const state = await page.state();
    const cableSlot = state.items.find((item) => item.category === "cables" && item.itemId === "cable-rca-rca");
    assert.ok(cableSlot, "the preset carries the RCA lead as a real slot");
    const totalWithLead = (await page.cost()).buyTotal;
    await page.click(`[data-rs="remove"][data-slot="${cableSlot.slotId}"]`);
    assert.strictEqual(rows().length, 1, "removing the lead does not remove the speaker path");
    assert.match(rows()[0].textContent, /\$12/, "the row shows the price of the missing lead");
    const fix = page.query(".rs-connect-fix");
    assert.ok(fix, "the panel offers a fix button for the missing lead");
    assert.strictEqual(fix.textContent.trim(), "Add $12", "the fix names the exact amount");
    assert.ok((await page.cost()).buyTotal < totalWithLead, "the bill drops while the lead is missing");
    await page.click(".rs-connect-fix");
    assert.match(rows()[0].textContent, /On the list/, "the fix puts the lead back on the list");
    assert.strictEqual((await page.cableLines()).length, 1, "the fix does not duplicate the lead");
    assert.strictEqual((await page.cost()).buyTotal, totalWithLead, "the bill returns to the pre-removal total");

    /* Cabinet count and feed count differ for independently powered monitors. */
    page = await open(server.base + "/build-your-dj-setup.html?preset=club-ready");
    const clubRow = rows()[0].textContent.replace(/\s+/g, " ");
    assert.match(clubRow, /2 cabinets/, "HS5 pair = two cabinets");
    assert.match(clubRow, /2 signal feeds/, "independently powered cabinets each need a feed");
    assert.match(clubRow, /XLR \u2192 XLR/, "the XLR master uses the XLR lead");

    /* N3 again, through the panel: a swap must not leave a stale allowance. */
    page = await open(server.base + "/build-your-dj-setup.html?rig=" + encode({
      n: "Swap check",
      i: [slot("ctl", "controllers", "pioneer-ddj-flx2"), slot("spk", "speakers", "pioneer-dm40d")]
    }));
    const beforeSwap = rows()[0].textContent.replace(/\s+/g, " ");
    assert.match(beforeSwap, /No cable purchase|3\.5 mm/, "FLX2 + DM-40D starts from the box lead");
    await page.openSlotDrawer("ctl", "controllers");
    await page.pickInDrawer("pioneer-ddj-flx4");
    const afterSwap = rows()[0].textContent.replace(/\s+/g, " ");
    assert.match(afterSwap, /RCA \u2192 RCA/, "the FLX4 swap switches the panel to the RCA lead");
    assert.ok(!/3\.5 mm to 1\/4|allowance/i.test(afterSwap), `no stale 3.5 mm allowance survives the swap: ${afterSwap}`);
    assert.deepStrictEqual(page.consoleErrors, [], `connection panel console errors: ${page.consoleErrors.join(" | ")}`);

    /* --------------------------------------- N4 comparison touch targets ----
     * The next-step links used to be ~20px text lines. Each one now has a 44px
     * target inside its own product cell, and the cell still names the product.
     */
    page = await open(server.base + "/controller-software-compatibility-matrix.html", { expectRig: false });
    await page.click('[data-mat-compare="flx4"]');
    await page.click('[data-mat-compare="flx10"]');
    await page.click("[data-compare-open]");
    const cells = page.window.eval(`Array.from(document.querySelectorAll('.matrix-compare-cell')).map(function (cell) {
      var links = Array.prototype.slice.call(cell.querySelectorAll('.matrix-compare-links > a'));
      return {
        product: cell.getAttribute('data-compare-product'),
        cellDisplay: getComputedStyle(cell).display,
        links: links.map(function (a) {
          return {
            text: a.textContent.trim(),
            href: a.getAttribute('href'),
            label: a.getAttribute('aria-label') || '',
            minHeight: getComputedStyle(a).minHeight,
            display: getComputedStyle(a).display,
            stillInCell: a.parentElement.parentElement === cell
          };
        })
      };
    })`);
    const plainCells = JSON.parse(JSON.stringify(cells));
    assert.strictEqual(plainCells.length, 2, "two shortlisted controllers produce two next-step cells");
    plainCells.forEach((cell) => {
      assert.strictEqual(cell.cellDisplay, "table-cell", `${cell.product} keeps a table cell of its own`);
      assert.ok(cell.links.length >= 2, `${cell.product} keeps both next-step links`);
      cell.links.forEach((link) => {
        assert.strictEqual(link.minHeight, "44px", `"${link.text}" for ${cell.product} has a 44px minimum target`);
        assert.strictEqual(link.display, "inline-flex", `"${link.text}" is laid out as a target, not a bare text run`);
        assert.ok(link.stillInCell, `"${link.text}" stays inside the ${cell.product} cell`);
        assert.ok(link.label.includes(cell.product), `"${link.text}" is labelled with ${cell.product}, got "${link.label}"`);
      });
      const rigLink = cell.links.find((link) => /Open Rig Studio/.test(link.text));
      assert.match(rigLink.href, /^build-your-dj-setup\.html\?add=/, "the rig link still carries a deep link");
    });
    /* The card-level actions got the same treatment so a phone tap lands first time. */
    const cardTargets = page.window.eval(`['.mat-actions-row .mat-link', '.mat-actions-row .mat-plan-btn', '.mat-actions-row .mat-compare-toggle'].map(function (selector) {
      var el = document.querySelector(selector);
      return { selector: selector, height: getComputedStyle(el).minHeight };
    })`);
    JSON.parse(JSON.stringify(cardTargets)).forEach((target) => {
      assert.strictEqual(target.height, "44px", `${target.selector} must be a 44px touch target`);
    });

    assert.deepStrictEqual(page.consoleErrors, [], `comparison console errors: ${page.consoleErrors.join(" | ")}`);

    console.log("Buying journeys: speaker planner routes and ownership, Rig Studio connection panel, comparison touch targets — all verified");
    server.close();
  } finally {
    if (page) page.close();
    await server.close().catch(() => {});
  }
})().catch((error) => {
  console.error("Buying journey test failed:", error.message);
  process.exit(1);
});
