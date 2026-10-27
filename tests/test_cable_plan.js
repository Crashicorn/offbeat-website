/*
 * Acceptance tests for the buyer-facing speaker / cabling model.
 *
 * These drive the real published page in a real DOM (see tests/dom_harness.js)
 * and assert on money, purchase lines and connection plans — not on source
 * strings. Everything here maps to a defect an independent review found:
 *
 *   N1  KRK identity conflation      → product identity and sockets
 *   N2  wrong cabling / stale charge → HS5, EON715, DM-40D, KRK paths
 *   N3  stale allowance on a swap    → FLX2 → FLX4 → FLX2
 *   (N4, touch targets, needs a layout engine: see test_flx4_comparison.js)
 *
 * Run:  node tests/test_cable_plan.js
 *       JSDOM_PATH=/path/to/jsdom node tests/test_cable_plan.js
 */
const assert = require("assert");
const path = require("path");
const { startServer, openPage } = require("./dom_harness");

const catalog = require(path.join(__dirname, "..", "assets", "dj-gear-catalog.json"));
const byId = {};
catalog.items.forEach((item) => { byId[item.id] = item; });

function encode(payload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function rigUrl(base, items, name) {
  return `${base}/build-your-dj-setup.html?rig=${encode({ n: name || "Test rig", i: items })}`;
}

const slot = (slotId, category, itemId, extra) => Object.assign({ slotId, category, itemId, qty: 1, owned: false }, extra || {});

(async () => {
  const server = await startServer();
  let page = null;
  const open = async (url) => {
    if (page) page.close();
    page = await openPage(url);
    return page;
  };

  try {
    /* ---------------------------------------------------------------- N1 --
     * KRK: the ROKIT 5 G4 and the Classic 5 are different products. */
    const rokit = byId["krk-rokit-5-g4"];
    const classic = byId["krk-classic-5-pair"];
    assert.ok(rokit && classic, "both KRK product lines exist as separate catalogue entries");
    assert.ok(!/classic/i.test(rokit.model), `the ROKIT entry must not mention Classic in its model name, got ${rokit.model}`);
    assert.ok(/rokit/i.test(rokit.model) && !/pair/i.test(rokit.model), `ROKIT 5 G4 is a single cabinet, got ${rokit.model}`);
    assert.deepStrictEqual(rokit.connection.inputs.map((i) => i.connector), ["combo_xlr_trs"],
      "the ROKIT 5 G4 has one balanced combo input and no RCA socket");
    assert.ok(rokit.speaker_units === 1, "the ROKIT 5 G4 is sold as one cabinet");
    assert.ok(!/kevlar/i.test(classic.driver_size), `the Classic 5 uses a glass-aramid woofer, got ${classic.driver_size}`);
    assert.deepStrictEqual(classic.connection.inputs.map((i) => i.connector), ["xlr", "trs", "rca"],
      "the Classic 5 has XLR, TRS and RCA inputs");
    assert.ok(classic.speaker_units === 2, "the Classic 5 monitor pack contains two cabinets");
    assert.ok((classic.included_cables || []).some((c) => c.from === "xlr" && c.to === "xlr"),
      "the Classic 5 monitor pack includes two XLR cables");

    /* The rig planner has to say the same thing the catalogue does. */
    await open(rigUrl(server.base, [
      slot("ctl", "controllers", "pioneer-ddj-flx4"),
      slot("spk", "speakers", "krk-rokit-5-g4")
    ]));
    let conn = (await page.connections())[0];
    assert.strictEqual(conn.socket, "combo_xlr_trs", "FLX4 → ROKIT 5 G4 lands on the combo socket");
    assert.strictEqual(conn.kind, "product", "an RCA → 1/4-inch lead is a verified product");
    assert.strictEqual(conn.label, "RCA → 1/4\" TS", `unexpected lead label ${conn.label}`);
    let speakers = await page.speakers();
    assert.strictEqual(speakers.cabinets, 1, "one ROKIT purchase is one cabinet");
    let output = (await page.checks()).find((c) => c.key === "output");
    assert.strictEqual(output.level, "warn", "a single ROKIT cabinet must read as mono");

    /* ---------------------------------------------------------------- N2 --
     * Yamaha HS5: XLR and TRS only, two cabinets, two feeds, one dual lead. */
    const hs5 = byId["yamaha-hs5"];
    assert.deepStrictEqual(hs5.connection.inputs.map((i) => i.connector), ["xlr", "trs"],
      "the HS5 has XLR and 1/4-inch TRS inputs and no RCA input");
    assert.strictEqual(hs5.connection.feeds_per_box, 2, "each HS5 cabinet needs its own feed");
    assert.ok(!/one dual RCA run/i.test(hs5.pack_note || ""), "the HS5 note must not claim a dual RCA run");
    assert.ok(/no RCA input/i.test(hs5.pack_note || ""), "the HS5 note should say there is no RCA input");

    /* A: the DM-40D box's passive 3.5 mm-to-dual-RCA converter is a conductor,
       not a one-way adapter: the FLX4's RCA master can use it in reverse, so
       this path buys no cable at all. */
    await open(rigUrl(server.base, [
      slot("ctl", "controllers", "pioneer-ddj-flx4"),
      slot("spk", "speakers", "pioneer-dm40d"),
      slot("cab", "cables", "cable-rca-rca")
    ]));
    let boxConn = (await page.connections())[0];
    assert.strictEqual(boxConn.kind, "included", `FLX4 → DM-40D must use the lead in the box, got ${boxConn.kind}`);
    assert.strictEqual(boxConn.label, "RCA → 3.5 mm", `the reversed orientation should be named plainly, got ${boxConn.label}`);
    assert.strictEqual(boxConn.reversedLead, true, "the plan should admit the box lead is being used the other way round");
    assert.strictEqual((await page.cost()).buyTotal, 329 + 149,
      "no cable is charged when the retail box already contains a lead that fits");
    const redundantLine = (await page.cableLines());
    assert.deepStrictEqual(redundantLine, [],
      `a $12 lead the box already provides must not be kept as a purchase: ${JSON.stringify(redundantLine)}`);

    /* Swap the speakers for HS5s through the real drawer. The $12 dual RCA
       cannot reach an HS5, so it must leave the bill and the right lead arrive. */
    await page.openSlotDrawer("spk", "speakers");
    await page.pickInDrawer("yamaha-hs5");
    const afterSwap = await page.cost();
    const linesAfterSwap = await page.shopping();
    assert.ok(!linesAfterSwap.some((l) => l.itemId === "cable-rca-rca"),
      `an incompatible dual RCA must not stay in the shopping list: ${JSON.stringify(linesAfterSwap)}`);
    assert.ok(linesAfterSwap.some((l) => l.itemId === "cable-rca-trs"),
      `the HS5 rig needs the dual RCA → 1/4-inch lead: ${JSON.stringify(linesAfterSwap)}`);
    assert.strictEqual(afterSwap.buyTotal, 329 + 398 + 15, `the HS5 rig should cost $742, got $${afterSwap.buyTotal}`);
    conn = (await page.connections())[0];
    assert.strictEqual(conn.feeds, 2, "a pair of HS5s has two independent feeds");
    assert.strictEqual(conn.units, 1, "one dual lead reaches both HS5 cabinets");
    output = (await page.checks()).find((c) => c.key === "output");
    assert.strictEqual(output.level, "ok", "two HS5 cabinets are a stereo pair");
    assert.ok(/independently powered/i.test(output.note), `the output note should explain the two feeds: ${output.note}`);

    /* A single EON715 is mono, needs one feed, and a second cabinet is a
       separate purchase with its own lead requirement. */
    await open(rigUrl(server.base, [
      slot("ctl", "controllers", "pioneer-ddj-flx4"),
      slot("spk", "speakers", "jbl-eon-715")
    ]));
    conn = (await page.connections())[0];
    assert.strictEqual(conn.cabinets, 1, "one EON715 purchase is one cabinet");
    assert.strictEqual(conn.units, 1, "one cabinet needs one lead purchase");
    output = (await page.checks()).find((c) => c.key === "output");
    assert.strictEqual(output.level, "warn", "one PA cabinet is mono");

    /* Two cabinets: still one dual lead, now stereo. */
    await page.click('[data-rs="qty"][data-slot="spk"][data-step="1"]');
    conn = (await page.connections())[0];
    assert.strictEqual(conn.cabinets, 2, "two EON715 purchases are two cabinets");
    assert.strictEqual(conn.feeds, 2, "two PA cabinets need two feeds");
    assert.strictEqual(conn.units, 1, "one dual RCA → 1/4-inch lead reaches two cabinets");
    output = (await page.checks()).find((c) => c.key === "output");
    assert.strictEqual(output.level, "ok", "two PA cabinets are stereo");
    assert.strictEqual((await page.cost()).buyTotal, 329 + 599 * 2 + 15,
      `two EON715s plus one lead should total $1,542, got $${(await page.cost()).buyTotal}`);

    /* Included cables are never charged: a 3.5 mm controller into a DM-40D
       pair uses the converter lead in the box. */
    await open(rigUrl(server.base, [
      slot("ctl", "controllers", "pioneer-ddj-flx2"),
      slot("spk", "speakers", "pioneer-dm40d"),
      slot("cab", "cables", "cable-aux-rca-allowance")
    ]));
    conn = (await page.connections())[0];
    assert.strictEqual(conn.kind, "included", "the DM-40D box supplies the 3.5 mm lead");
    assert.deepStrictEqual(await page.cableLines(), [], "a lead in the box must not be charged again");
    assert.strictEqual((await page.cost()).buyTotal, 199 + 149, `FLX2 + DM-40D should be $348, got $${(await page.cost()).buyTotal}`);
    let cableCheck = (await page.checks()).find((c) => c.key === "cables");
    assert.strictEqual(cableCheck.level, "ok", `the cable check should be satisfied: ${JSON.stringify(cableCheck)}`);

    /* A 3.5 mm output into HS5s has no verified lead, so the plan carries a
       labelled allowance rather than pretending a product exists. */
    await open(rigUrl(server.base, [
      slot("ctl", "controllers", "pioneer-ddj-flx2"),
      slot("spk", "speakers", "yamaha-hs5")
    ]));
    conn = (await page.connections())[0];
    assert.strictEqual(conn.kind, "allowance", "3.5 mm → 1/4-inch is an allowance, not a verified SKU");
    assert.strictEqual(conn.itemId, "cable-aux-trs-allowance", `unexpected allowance ${conn.itemId}`);
    const allowanceLine = (await page.shopping()).find((l) => l.itemId === "cable-aux-trs-allowance");
    assert.ok(allowanceLine, "the allowance is a real line with a price");
    assert.strictEqual(allowanceLine.lineTotal, 15);

    /* ---------------------------------------------------------------- N3 --
     * The reported swap: FLX2 → FLX4 keeps an incompatible $15 allowance and
     * bills $542 while saying the dual RCA is missing. It must reconcile. */
    await open(rigUrl(server.base, [
      slot("ctl", "controllers", "pioneer-ddj-flx2"),
      slot("hp", "headphones", "ath-m20x"),
      slot("spk", "speakers", "pioneer-dm40d"),
      slot("cab", "cables", "cable-aux-rca-allowance")
    ]));
    assert.strictEqual((await page.cost()).buyTotal, 397, "the FLX2 rig starts at $397, with the lead in the box");

    await page.openSlotDrawer("ctl", "controllers");
    await page.pickInDrawer("pioneer-ddj-flx4");
    const flx4 = await page.cost();
    const flx4Lines = await page.cableLines();
    assert.strictEqual(flx4.buyTotal, 329 + 49 + 149,
      `the corrected FLX4 rig is $527 because the DM-40D box lead covers it, got $${flx4.buyTotal}`);
    assert.deepStrictEqual(flx4Lines, [],
      `the stale 3.5 mm allowance must leave, and nothing replaces it: ${JSON.stringify(flx4Lines)}`);
    const shopText = await page.window.__rigStudio.shoppingText();
    assert.ok(/ESTIMATED TOTAL: \$527/.test(shopText), `the printed list agrees with the bill: ${shopText}`);
    assert.ok(!/allowance/.test(shopText), "no allowance survives the swap");
    assert.ok(!/dual RCA/i.test(shopText), "no RCA lead is charged when the box supplies one");

    /* And back: FLX2 → the lead in the box again, no stale dual RCA. */
    await page.openSlotDrawer("ctl", "controllers");
    await page.pickInDrawer("pioneer-ddj-flx2");
    const back = await page.cost();
    assert.strictEqual(back.buyTotal, 397, `switching back to FLX2 returns to $397, got $${back.buyTotal}`);
    assert.deepStrictEqual(await page.cableLines(), [], `the FLX2 rig needs no cable purchase: ${JSON.stringify(await page.cableLines())}`);

    /* A genuinely needed allowance is restored by a swap back, not forgotten. */
    await open(rigUrl(server.base, [
      slot("ctl", "controllers", "pioneer-ddj-flx2"),
      slot("hp", "headphones", "ath-m20x"),
      slot("spk", "speakers", "yamaha-hs5")
    ]));
    assert.strictEqual((await page.cost()).buyTotal, 199 + 49 + 398 + 15, "the FLX2 / HS5 rig carries the $15 allowance");
    await page.openSlotDrawer("ctl", "controllers");
    await page.pickInDrawer("pioneer-ddj-flx4");
    let lines = await page.cableLines();
    assert.ok(lines.some((l) => l.itemId === "cable-rca-trs"), `FLX4 + HS5 buys the RCA → 1/4-inch lead: ${JSON.stringify(lines)}`);
    assert.ok(!lines.some((l) => l.itemId === "cable-aux-trs-allowance"), "the 3.5 mm allowance is retired");
    assert.strictEqual((await page.cost()).buyTotal, 329 + 49 + 398 + 15);
    await page.openSlotDrawer("ctl", "controllers");
    await page.pickInDrawer("pioneer-ddj-flx2");
    lines = await page.cableLines();
    assert.ok(lines.some((l) => l.itemId === "cable-aux-trs-allowance"),
      `swapping back restores the 3.5 mm allowance: ${JSON.stringify(lines)}`);
    assert.ok(!lines.some((l) => l.itemId === "cable-rca-trs"), "the RCA lead does not linger");
    assert.strictEqual((await page.cost()).buyTotal, 199 + 49 + 398 + 15);

    /* Ownership survives every swap: a lead the buyer owns is never deleted. */
    await open(rigUrl(server.base, [
      slot("ctl", "controllers", "pioneer-ddj-flx4"),
      slot("spk", "speakers", "pioneer-dm40d"),
      slot("cab", "cables", "cable-rca-rca", { owned: true })
    ]));
    assert.strictEqual((await page.cost()).buyTotal, 329 + 149, "an owned lead is not charged");
    await page.openSlotDrawer("ctl", "controllers");
    await page.pickInDrawer("pioneer-ddj-flx2");
    const ownedBack = await page.cableLines();
    assert.ok(ownedBack.some((l) => l.itemId === "cable-rca-rca"),
      `an owned lead is kept as a spare, not deleted: ${JSON.stringify(ownedBack)}`);
    const spareLine = ownedBack.find((l) => l.itemId === "cable-rca-rca");
    assert.strictEqual(spareLine.spare, true, "an owned lead the rig cannot use is marked as a spare");
    assert.strictEqual((await page.cost()).buyTotal, 199 + 149, "the spare is not charged again");

    /* ------------------------------------------------- A/B  output budget --
     * A stereo master socket is one destination. Two DM-40D pairs on a FLX4
     * cannot both be fed by it, so the second line must stay visibly
     * unresolved and must not add a phantom $12 lead to the bill. */
    await open(rigUrl(server.base, [
      slot("deck", "controllers", "pioneer-ddj-flx4"),
      slot("pair1", "speakers", "pioneer-dm40d"),
      slot("pair2", "speakers", "pioneer-dm40d")
    ]));
    const pairPlans = await page.connections();
    assert.strictEqual(pairPlans.length, 2, "two speaker lines are planned separately");
    assert.strictEqual(pairPlans[0].kind, "included", "the first pair uses the box lead and owns the RCA output");
    assert.strictEqual(pairPlans[1].kind, "unresolved", `the second pair has no free output, got ${pairPlans[1].kind}`);
    assert.strictEqual(pairPlans[1].conflict, true, "the unresolved line is flagged for the UI");
    assert.strictEqual(pairPlans[1].units, 0, "an unresolved line must not price a cable it cannot use");
    assert.strictEqual((await page.cost()).buyTotal, 329 + 149 + 149,
      "two pairs cost two pairs and no phantom cable");
    assert.deepStrictEqual(await page.cableLines(), [],
      `no cable line is invented for the second pair: ${JSON.stringify(await page.cableLines())}`);
    const unresolvedChecks = await page.checks();
    const unresolvedCable = unresolvedChecks.find((c) => c.key === "cables");
    assert.strictEqual(unresolvedCable.level, "bad", "an unfeedable speaker line blocks readiness");
    assert.match(unresolvedCable.title, /Routing unresolved/i, `the check should name the gap: ${unresolvedCable.title}`);
    assert.match(unresolvedCable.note, /splitter/i, "the explanation names the missing hardware honestly");
    assert.ok(!/in stock|buy the .*splitter/i.test(unresolvedCable.note),
      "the fix is described, never sold as an unverified product");
    assert.match(unresolvedCable.note, /headphone socket is for cueing, not a second master/i,
      "the cue socket must never be offered as the second master");
    const unresolvedOutput = unresolvedChecks.find((c) => c.key === "output");
    assert.strictEqual(unresolvedOutput.level, "warn", "the output check reflects the unfeedable line");
    assert.match(unresolvedOutput.title, /without a verified feed/i, `unexpected output title: ${unresolvedOutput.title}`);
    /* The panel has to show both rows and offer a route out of the dead end. */
    const panelRows = page.queryAll(".rs-connect-row");
    assert.strictEqual(panelRows.length, 2, "the connection panel lists both speaker lines");
    assert.ok(/Routing unresolved/.test(panelRows[1].textContent), "the panel marks the unresolved line");
    assert.ok(page.queryAll(".rs-connect-fix--swap").length >= 1, "the panel offers a speaker swap for the dead end");

    /* The quantity stepper is the same physics: one box slot set to 2 is two
       pairs and two feeds, so it cannot quietly behave better than two slots. */
    await open(rigUrl(server.base, [
      slot("deck", "controllers", "pioneer-ddj-flx4"),
      slot("pair", "speakers", "pioneer-dm40d", { qty: 2 })
    ]));
    const steppedPair = (await page.connections())[0];
    assert.strictEqual(steppedPair.cabinets, 4, "two boxes are four cabinets");
    assert.strictEqual(steppedPair.feeds, 2, "two boxes are two stereo feeds");
    assert.strictEqual(steppedPair.kind, "unresolved", "one RCA master cannot feed two pairs");
    assert.strictEqual(steppedPair.conflict, true, "the stepper result is flagged like the second slot");
    assert.strictEqual((await page.cost()).buyTotal, 329 + 149 * 2, "the bill is two pairs and no cable");
    assert.deepStrictEqual(await page.cableLines(), [], "no lead is priced for the second pair");

    /* A deck with two real master outputs can feed two pairs: FLX10 resolves
       both lines on XLR and RCA respectively, with no invented hardware. */
    await open(rigUrl(server.base, [
      slot("deck", "controllers", "pioneer-ddj-flx10"),
      slot("pair1", "speakers", "yamaha-hs5"),
      slot("pair2", "speakers", "yamaha-hs5")
    ]));
    const twoLines = await page.connections();
    assert.strictEqual(twoLines.length, 2);
    assert.deepStrictEqual(twoLines.map((l) => l.kind), ["product", "product"],
      `both FLX10 lines resolve: ${JSON.stringify(twoLines.map((l) => [l.kind, l.label]))}`);
    assert.deepStrictEqual(twoLines.map((l) => l.output), ["xlr", "rca"],
      `each line takes a different master output: ${JSON.stringify(twoLines.map((l) => l.output))}`);
    assert.strictEqual((await page.checks()).find((c) => c.key === "cables").level, "ok");
    const twoLineBill = (await page.cost()).buyTotal;
    assert.strictEqual(twoLineBill, 1599 + 398 + 398 + 28 + 15,
      `both leads are real purchases, got $${twoLineBill}`);

    /* Ownership must not smuggle a second pair past the output budget: marking
       a pair owned still leaves the second line unfeedable. */
    await open(rigUrl(server.base, [
      slot("deck", "controllers", "pioneer-ddj-flx4"),
      slot("pair1", "speakers", "pioneer-dm40d", { owned: true }),
      slot("pair2", "speakers", "pioneer-dm40d")
    ]));
    const ownedPairPlans = await page.connections();
    assert.strictEqual(ownedPairPlans[1].kind, "unresolved",
      "owning the first pair does not create a second output");
    assert.strictEqual((await page.cost()).buyTotal, 329 + 149,
      "only the second pair is charged, and no cable is invented for it");

    /* ------------------------------------------------------- guide handoff --
     * The beginner guide and the studio guide must hand over a rig whose bill
     * equals the number printed on the page. */
    if (page) page.close();
    page = await openPage(server.base + "/best-dj-controllers-for-beginners.html", { expectRig: false });
    await page.window.document.querySelector('[data-bl-choose="pioneer-ddj-flx2"]').click();
    await new Promise((r) => setTimeout(r, 200));
    const guideTotal = page.text("[data-bl-total]");
    const href = page.document.querySelector("[data-bl-build]").getAttribute("href");
    const rigPage = await openPage(new URL(href, server.base + "/").href);
    const rigTotal = (await rigPage.cost()).buyTotal;
    assert.strictEqual(rigTotal, Number(String(guideTotal).replace(/[^0-9]/g, "")),
      `the guide total (${guideTotal}) must equal the Rig Studio bill ($${rigTotal})`);
    rigPage.close();

    assert.deepStrictEqual(page.consoleErrors, [], `console errors: ${page.consoleErrors.join(" | ")}`);
    console.log("Cable plan: KRK identity, HS5/EON/DM-40D paths, FLX2↔FLX4 reconciliation, ownership, guide handoff — all verified");
    server.close();
  } finally {
    if (page) page.close();
    await server.close().catch(() => {});
  }
})().catch((error) => {
  console.error("Cable plan test failed:", error.message);
  process.exit(1);
});
