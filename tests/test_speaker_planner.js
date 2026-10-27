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
    /* A: the DM-40D box's passive 3.5 mm-to-dual-RCA converter is reversible, so
       an RCA master needs no extra lead. The planner must say so and charge $0. */
    assert.match(page.text("[data-speaker-plan]"), /3\.5 mm stereo mini-plug to dual RCA converter cable/,
      "the planner names the lead that actually ships in the box");
    assert.match(page.text("[data-speaker-plan]"), /In the box/, "the in-box lead is not sold back to the buyer");
    assert.strictEqual(money(page.text(".speaker-plan-option.is-primary .speaker-plan-total")), 149,
      "DM-40D pair only: the box lead covers the FLX4's RCA master");

    /* Signal path names the socket the plan actually uses, not every socket the
       cabinet happens to own; the full input list stays available in the title. */
    const signalPath = page.document.querySelector(".speaker-plan-option.is-primary .speaker-plan-facts li b").textContent.replace(/\s+/g, " ").trim();
    assert.strictEqual(signalPath, "RCA (unbalanced) master \u2192 3.5 mm",
      `the signal path should describe the socket actually used, got "${signalPath}"`);
    const pathTitle = page.document.querySelector(".speaker-plan-option.is-primary .speaker-plan-facts li b").getAttribute("title");
    assert.match(pathTitle, /RCA \/ 3\.5 mm/, "the title still lists every input on the cabinet");

    /* When the box lead genuinely cannot help, the plan has to say so. The
       KRK Classic 5 pack ships XLR leads and an RCA master cannot use them. */
    await setRadio("speaker-use", "production");
    const classic = page.queryAll("[data-speaker-plan] .speaker-plan-option")[1];
    assert.match(classic.textContent, /does not replace this lead/,
      "the plan admits the Classic 5 pack's XLR leads cannot feed an RCA output");
    await setRadio("speaker-use", "desk");

    /* Deck swap: the FLX2 has a 3.5 mm master, so the DM-40D box lead covers it. */
    await setRadio("speaker-deck", "pioneer-ddj-flx2");
    assert.match(page.text("[data-speaker-plan]"), /No cable purchase/, "FLX2 + DM-40D is covered by the lead in the box");
    assert.strictEqual(money(page.text(".speaker-plan-option.is-primary .speaker-plan-total")), 149,
      "no cable is charged when the box lead fits");
    assert.ok(!/Verified lead|Planning allowance/.test(page.text("[data-speaker-plan] .speaker-plan-option.is-primary")),
      "a covered path shows neither a purchase nor an allowance");

    /* Back to the FLX4: still no purchase, but the plan must describe the
       reversed orientation rather than silently claiming the same path. */
    await setRadio("speaker-deck", "pioneer-ddj-flx4");
    const backPath = page.document.querySelector(".speaker-plan-option.is-primary .speaker-plan-facts li b").textContent.replace(/\s+/g, " ").trim();
    assert.strictEqual(backPath, "RCA (unbalanced) master \u2192 3.5 mm",
      `the FLX4 plan should show the RCA master into the 3.5 mm input, got "${backPath}"`);
    assert.match(page.text("[data-speaker-plan]"), /either way round/, "the reversed passive lead is explained, not hidden");
    assert.strictEqual(money(page.text(".speaker-plan-option.is-primary .speaker-plan-total")), 149,
      "no stale cable charge survives the deck swap");

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
    assert.deepStrictEqual(rigShopping, ["pioneer-ddj-flx4", "pioneer-dm40d"].sort(),
      "the handover carries the deck and the speaker, and no cable the box already supplies");
    const rigPanel = rigPage.queryAll(".rs-connect-row");
    assert.strictEqual(rigPanel.length, 1, "Rig Studio shows one connection row for the handed-off path");
    assert.match(rigPanel[0].textContent, /In the box/, "the handed-off rig credits the lead in the box");
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
    assert.match(page.text("[data-speaker-plan]"), /only prices the lead/, "the headline switches to the lead");
    const ownedHref = page.document.querySelector(".speaker-plan-option.is-primary .speaker-plan-cta").getAttribute("href");
    const ownedRig = await openPage(new URL(ownedHref, server.base + "/").href);
    const ownedCost = await ownedRig.cost();
    assert.strictEqual(ownedCost.buyTotal, controllerPrice,
      `the hand-off bills the controller only, because the lead ships in the already-owned box, got $${ownedCost.buyTotal}`);
    assert.strictEqual(ownedCost.ownedTotal, Number(byId["pioneer-dm40d"].price),
      "the speaker the visitor already owns is carried over as owned, not dropped or charged");
    ownedRig.close();
    ownedBox.checked = false;
    ownedBox.dispatchEvent(new page.window.Event("change", { bubbles: true }));
    await wait(250);
    assert.strictEqual(money(page.text(".speaker-plan-option.is-primary .speaker-plan-total")), 149,
      "unchecking ownership restores the speakers price");

    /* Every deck × route combination has to keep the same promise: the number
       on the card is the number Rig Studio charges once the controller is
       added. Two decks that stand in for "another deck with RCA/XLR out" carry
       no controller slot, so their hand-off is speakers + lead only. */
    const sweep = [
      { deck: "pioneer-ddj-flx2", controller: "pioneer-ddj-flx2" },
      { deck: "pioneer-ddj-flx4", controller: "pioneer-ddj-flx4" },
      { deck: "output-xlr", controller: null }
    ];
    for (const combo of sweep) {
      for (const use of ["desk", "production", "room"]) {
        await setRadio("speaker-use", use);
        await setRadio("speaker-deck", combo.deck);
        const card = page.document.querySelector(".speaker-plan-option.is-primary");
        assert.ok(card, `a plan renders for ${combo.deck} + ${use}`);
        const total = money(card.querySelector(".speaker-plan-total").textContent);
        const handoff = card.querySelector(".speaker-plan-cta").getAttribute("href");
        const sweepRig = await openPage(new URL(handoff, server.base + "/").href);
        const sweepCost = await sweepRig.cost();
        const expected = total + (combo.controller ? Number(byId[combo.controller].price) : 0);
        assert.strictEqual(sweepCost.buyTotal, expected,
          `${combo.deck} + ${use}: planner $${total} must match the rig bill ($${sweepCost.buyTotal} vs $${expected})`);
        /* One speaker line in the hand-off means exactly one connection row,
           and any cable line may only exist if the plan says it is bought. */
        const panelRows = sweepRig.queryAll(".rs-connect-row").length;
        assert.strictEqual(panelRows, 1, `${combo.deck} + ${use}: one speaker line, one connection row`);
        const plan = (await sweepRig.connections())[0];
        const boughtLines = (await sweepRig.cableLines()).filter((line) => line.charged && !line.spare);
        if (plan.kind === "included" || plan.kind === "unresolved") {
          assert.strictEqual(boughtLines.length, 0,
            `${combo.deck} + ${use}: a ${plan.kind} path must not carry a cable purchase: ${JSON.stringify(boughtLines)}`);
        } else {
          assert.strictEqual(boughtLines.length, 1,
            `${combo.deck} + ${use}: a priced path carries exactly one lead line`);
        }
        sweepRig.close();
      }
    }
    await setRadio("speaker-use", "desk");
    await setRadio("speaker-deck", "pioneer-ddj-flx4");

    assert.deepStrictEqual(page.consoleErrors, [], `speaker planner console errors: ${page.consoleErrors.join(" | ")}`);

    /* ------------------------------------------- Rig Studio connection panel --
     * The panel is the rig's own answer to "what connects this to that". */
    page = await open(server.base + "/build-your-dj-setup.html?preset=bedroom-starter");
    const rows = () => page.queryAll(".rs-connect-row");
    assert.strictEqual(rows().length, 1, "one speaker path renders one connection row");
    /* The panel is one row per speaker line, not per cable purchase: a line can
       be covered by the box or unresolved and still deserve a row. */
    assert.strictEqual(rows().length, (await page.connections()).length,
      "the panel shows one row per speaker line");
    assert.strictEqual(rows().length, 1, "bedroom-starter has one speaker line");
    const rowText = rows()[0].textContent.replace(/\s+/g, " ");
    assert.match(rowText, /2 cabinets/, "the row distinguishes cabinets from signal feeds");
    assert.match(rowText, /1 signal feed/, "a master/slave pair is one feed");
    /* Defect A in the panel: the FLX4 + DM-40D line is covered by the retail
       box, so the row says so and no cable is charged. */
    assert.match(rowText, /RCA \u2192 3.5 mm/, "the row names the connector pair actually used");
    assert.match(rowText, /3.5 mm stereo mini-plug to dual RCA converter cable/, "the row names the box lead");
    assert.match(rowText, /In the box/, "the panel credits the lead that ships with the speakers");
    assert.strictEqual((await page.cableLines()).length, 0, "no cable purchase is invented for a covered line");
    assert.strictEqual(page.queryAll(".rs-connect-fix").length, 0, "a covered line offers nothing to buy");

    /* Removing a *needed* lead must leave the panel honest: it prices the gap
       and offers the exact fix, and taking the fix restores one line, not two.
       FLX4 + HS5 is a genuine purchase ($15 dual RCA to dual 1/4-inch TS). */
    page = await open(server.base + "/build-your-dj-setup.html?rig=" + encode({
      n: "Cable fix",
      i: [slot("ctl", "controllers", "pioneer-ddj-flx4"), slot("spk", "speakers", "yamaha-hs5")]
    }));
    assert.match(rows()[0].textContent, /Dual RCA to Dual 1\/4" TS/, "the row names the verified lead");
    assert.match(rows()[0].textContent, /On the list/, "an auto-added lead is not silently charged twice");
    const state = await page.state();
    const cableSlot = state.items.find((item) => item.category === "cables" && item.itemId === "cable-rca-trs");
    assert.ok(cableSlot, "the rig carries the 1/4-inch lead as a real slot");
    const totalWithLead = (await page.cost()).buyTotal;
    await page.click(`[data-rs="remove"][data-slot="${cableSlot.slotId}"]`);
    assert.strictEqual(rows().length, 1, "removing the lead does not remove the speaker path");
    assert.match(rows()[0].textContent, /\$15/, "the row shows the price of the missing lead");
    const fix = page.query(".rs-connect-fix");
    assert.ok(fix, "the panel offers a fix button for the missing lead");
    assert.strictEqual(fix.textContent.trim(), "Add $15", "the fix names the exact amount");
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

    /* Speakers with no deck yet: say what is missing instead of pretending the
       jacks are unknown. The row still shows cabinets and the feed count. */
    page = await open(server.base + "/build-your-dj-setup.html?rig=" + encode({
      n: "Speakers first",
      i: [slot("spk", "speakers", "pioneer-dm40d")]
    }));
    const lonely = rows()[0].textContent.replace(/\s+/g, " ");
    assert.match(lonely, /2 cabinets/, "the speaker-only row still counts cabinets");
    assert.match(lonely, /Add the deck and this row will name the lead it needs/, "the row names the real gap");
    assert.match(lonely, /No deck yet/, "no cable is priced before there is a deck");
    assert.strictEqual(page.query(".rs-connect-fix").textContent.trim(), "Choose a deck", "the row offers the deck picker");
    assert.match(page.query(".rs-connect-summary").textContent, /Waiting on a deck/, "the summary counts the waiting line");
    assert.strictEqual((await page.cableLines()).length, 0, "nothing is added to the shopping list yet");
    assert.deepStrictEqual(page.consoleErrors, [], `speaker-only console errors: ${page.consoleErrors.join(" | ")}`);

    /* N3 again, through the panel: a swap must not leave a stale allowance. */
    page = await open(server.base + "/build-your-dj-setup.html?rig=" + encode({
      n: "Swap check",
      i: [slot("ctl", "controllers", "pioneer-ddj-flx2"), slot("spk", "speakers", "pioneer-dm40d")]
    }));
    const beforeSwap = rows()[0].textContent.replace(/\s+/g, " ");
    assert.match(beforeSwap, /3\.5 mm/, "FLX2 + DM-40D starts from the box lead");
    await page.openSlotDrawer("ctl", "controllers");
    await page.pickInDrawer("pioneer-ddj-flx4");
    const afterSwap = rows()[0].textContent.replace(/\s+/g, " ");
    assert.match(afterSwap, /RCA \u2192 3\.5 mm/, "the FLX4 swap re-derives the path from its RCA master");
    assert.ok(!/allowance/i.test(afterSwap), `no stale allowance survives the swap: ${afterSwap}`);
    assert.strictEqual((await page.cost()).buyTotal, 329 + 149,
      "the swap does not resurrect the $12 cable the box already supplies");
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
