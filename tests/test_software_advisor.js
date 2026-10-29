/*
 * Regression test for the DJ software advisor on dj-software-hub.html.
 *
 * Runs the published page, its published data file and its published script in
 * jsdom, drives the real controls and asserts the decisions — not the presence
 * of marketing strings. It fails if a licence price drifts, if a platform is
 * recommended to hardware it cannot drive, or if a hidden paid tier stops being
 * surfaced.
 *
 *   node tests/test_software_advisor.js
 *   JSDOM_PATH=/path/to/jsdom node tests/test_software_advisor.js
 *
 * Limitation: jsdom has no layout engine, so 44px tap targets, wrapping and
 * sideways-scroll behaviour at 390px still need a real browser pass.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { startServer, openPage } = require("./dom_harness");

const PAGE = "/dj-software-hub.html";

function qs(state) {
  const search = new URLSearchParams();
  [
    ["mode", "sw_mode"], ["hardware", "sw_hardware"], ["os", "sw_os"],
    ["music", "sw_music"], ["budget", "sw_budget"], ["need", "sw_need"], ["scene", "sw_scene"]
  ].forEach(([key, param]) => {
    if (state[key]) search.set(param, state[key]);
  });
  return search.toString() ? "?" + search.toString() : "";
}

function cards(page) {
  return page.queryAll(".swa-card").map((card) => {
    const group = card.closest(".swa-group");
    return {
      name: card.querySelector("h4").textContent.trim(),
      badge: card.querySelector(".swa-badge").textContent.trim(),
      price: card.querySelector(".swa-price") ? card.querySelector(".swa-price").textContent.trim() : "",
      group: group ? group.className.replace(/.*swa-group--(\w+).*/, "$1") : "",
      why: Array.from(card.querySelectorAll(".swa-why li")).map((li) => li.textContent.trim()),
      notes: Array.from(card.querySelectorAll(".swa-notes li")).map((li) => li.textContent.trim()),
      perModel: Array.from(card.querySelectorAll(".swa-permodel li")).map((li) => li.textContent.trim()),
      gaps: Array.from(card.querySelectorAll(".swa-gaps li")).map((li) => li.textContent.trim()),
      fillers: Array.from(card.querySelectorAll(".swa-fillers li")).map((li) => li.textContent.trim()),
      checks: Array.from(card.querySelectorAll(".swa-checks li")).map((li) => li.textContent.trim()),
      blocked: Array.from(card.querySelectorAll(".swa-blockers li")).map((li) => li.textContent.trim()),
      links: Array.from(card.querySelectorAll(".swa-next a")).map((a) => a.getAttribute("href"))
    };
  });
}

function byName(list, name) {
  const found = list.find((card) => card.name === name);
  assert.ok(found, `expected a card for ${name}; got ${JSON.stringify(list.map((c) => c.name))}`);
  return found;
}

(async () => {
  const server = await startServer();
  try {
    /* ------------------------------------------------------------ structure */
    const page = await openPage(server.base + PAGE, { expectRig: false });
    const data = page.window.eval("window.OffbeatSoftwareData");

    assert.strictEqual(page.queryAll(".swa-question").length, 7, "seven questions render");
    assert.strictEqual(data.platforms.length, 7, "seven platforms are in the dataset");
    assert.ok(page.query(".swa-results"), "there is a results region");
    assert.strictEqual(page.queryAll(".swa-card").length, 0, "nothing is recommended before an answer");
    assert.match(page.text("[data-swa-status]"), /first three questions/i,
      "the empty state explains what to do: " + page.text("[data-swa-status]"));

    /* ---------------------------------------------------- prices as sourced */
    const planOf = (id, planId) => data.platforms.find((p) => p.id === id).plans.find((p) => p.id === planId);
    assert.strictEqual(planOf("rekordbox", "core").yearly, 120, "rekordbox Core is $120/yr");
    assert.strictEqual(planOf("rekordbox", "creative").yearly, 180, "rekordbox Creative is $180/yr");
    assert.strictEqual(planOf("rekordbox", "professional").yearly, 360, "rekordbox Professional is $360/yr");
    assert.strictEqual(planOf("serato", "pro").buyOnce, 299, "Serato DJ Pro is $299 once");
    assert.strictEqual(planOf("serato", "pro").monthly, 11.99, "Serato DJ Pro is $11.99/mo");
    assert.strictEqual(planOf("serato", "suite").buyOnce, 499, "Serato DJ Suite is $499 once");
    assert.strictEqual(planOf("serato", "ios").buyOnce, 149, "Serato DJ for iOS is a $149 iOS-only licence");
    assert.strictEqual(data.hardware.flx10.unlocks.serato, "pro", "FLX10/FLX6 unlock Serato DJ Pro");
    assert.strictEqual(data.hardware.flx2.unlocks.serato, "lite", "FLX2 unlocks Serato DJ Lite");
    assert.strictEqual(data.hardware.flx4.unlocks.serato, "lite", "FLX4 unlocks Serato DJ Lite");
    assert.strictEqual(data.hardware.xdj_az.unlocks.rekordbox, "hu", "XDJ-AZ is on rekordbox Hardware Unlock list");
    assert.strictEqual(data.hardware.xdj_az.unlocks.serato, "pro", "XDJ-AZ unlocks Serato DJ Pro");
    assert.strictEqual(data.hardware.xdj_az.pioneer, true, "XDJ-AZ is in the Pioneer/AlphaTheta hardware family");
    assert.strictEqual(data.hardware.prime4.unlocks.serato, "pro", "PRIME 4 / 4+ unlock Serato DJ Pro per Serato's own pages");
    assert.strictEqual(data.hardware.prime4.unlocks.virtualdj, "home", "PRIME 4 / 4+ are Denon-listed for Virtual DJ (entry tier)");
    assert.strictEqual(data.hardware.prime_go.unlocks.virtualdj, "pro", "Denon documents the GO / GO+ at Virtual DJ Pro");
    assert.strictEqual(data.hardware.prime_go.unlocks.serato, undefined,
      "the GO line's Serato tier is not verified, so the dataset leaves it out of the verified list");
    assert.strictEqual(data.hardware.prime4.rekImport, true,
      "the PRIME 4 / 4+ reads rekordbox drives natively (music, playlists, hot cues)");
    assert.ok(!("denon" in data.hardware), "the blanket 'denon' option that blocked every app is gone");
    assert.ok(data.hardware.engine_other.engineFamily, "other Engine OS players stay a per-model check, not a block");
    assert.ok(data.gapFill && Object.keys(data.gapFill).length, "gap-to-filler pairs exist for named gaps");
    assert.ok(typeof data.streamingGapFill === "string", "a named route exists for the streamed half of a mixed library");
    assert.strictEqual(planOf("traktor", "play").buyOnce, 49, "Traktor Play is $49");
    assert.strictEqual(planOf("traktor", "pro").buyOnce, 149, "Traktor Pro 4 is $149");
    assert.strictEqual(planOf("djay", "pro").yearly, 49.99, "djay Pro is $49.99/yr");
    assert.strictEqual(planOf("virtualdj", "home").monthly, 4, "VirtualDJ Home is $4/mo");
    assert.strictEqual(planOf("virtualdj", "pro").yearly, 199, "VirtualDJ Pro is $199/yr");
    assert.strictEqual(data.platforms.find((p) => p.id === "traktor").freeNote.includes("$49"), true,
      "Traktor is never described as having a free tier");
    assert.strictEqual(data.platforms.find((p) => p.id === "virtualdj").plans.some((p) => p.buyOnce), false,
      "no unbudgeted Infinity price is invented for VirtualDJ");

    /* Every recommendation must be checkable and must lead somewhere real. */
    data.platforms.forEach((platform) => {
      assert.ok(platform.url && /^https?:/.test(platform.url), platform.id + " needs a vendor URL");
      assert.ok(platform.verify && platform.verify.length > 20, platform.id + " needs an unverified-here line");
      assert.ok(fs.existsSync(path.join(__dirname, "..", platform.review)), platform.id + " review page must exist: " + platform.review);
      assert.ok(platform.strengths.length && platform.watchOuts.length, platform.id + " needs strengths and watch-outs");
    });

    /* --------------------------- FLX4 owner who prepares club USB sticks --- */
    const club = await openPage(server.base + PAGE + qs({
      mode: "controller", hardware: "flx4", os: "macos", music: "local",
      budget: "free", need: "cdj", scene: "club"
    }), { expectRig: false });

    let list = cards(club);
    assert.strictEqual(list.length, 7, "every platform is accounted for, including the ruled out ones");

    const rb = byName(list, "rekordbox");
    assert.strictEqual(rb.group, "fits", "rekordbox fits a free club-prep answer");
    assert.match(rb.badge, /No licence cost/i, "the badge must say no licence cost, not a tier price: " + rb.badge);
    assert.ok(rb.why.some((line) => /Hardware Unlock list/i.test(line)),
      "the reason must name the mechanism: " + JSON.stringify(rb.why));

    const seratoClub = byName(list, "Serato DJ");
    assert.strictEqual(seratoClub.group, "partial",
      "Serato drives the FLX4 (Lite unlock) but can't write rekordbox-format sticks — a named gap, not a hard block");
    assert.ok(seratoClub.gaps.some((line) => /rekordbox-format/.test(line)),
      "the gap must say what it does not cover: " + JSON.stringify(seratoClub.gaps));
    assert.ok(seratoClub.fillers.length,
      "a named route must cover the gap: " + JSON.stringify(seratoClub.fillers));

    const traktorClub = byName(list, "Traktor");
    assert.strictEqual(traktorClub.group, "partial",
      "Traktor Play drives the FLX4 plug-and-play, but club stick prep is not its job");
    assert.ok(traktorClub.gaps.some((line) => /rekordbox-format|club prep/.test(line)),
      "Traktor's gap names what it misses: " + JSON.stringify(traktorClub.gaps));

    const engineClub = byName(list, "Engine DJ");
    assert.strictEqual(engineClub.group, "blocked", "Engine cannot drive a DDJ-FLX4");
    assert.ok(engineClub.blocked.some((line) => /prepared by its own platform|rekordbox/.test(line)),
      "and the blocker says why: " + JSON.stringify(engineClub.blocked));

    assert.match(club.text("[data-swa-status]"), /1 platform fits/,
      "the summary agrees with the rendered groups: " + club.text("[data-swa-status]"));
    assert.strictEqual(club.window.location.search.includes("sw_hardware=flx4"), true,
      "the answers are reflected in the URL so a result can be shared");
    club.close();

    /* --------------------------- same owner, now wants to record mixes ----- */
    const record = await openPage(server.base + PAGE + qs({
      mode: "controller", hardware: "flx4", os: "windows", music: "local",
      budget: "free", need: "recording"
    }), { expectRig: false });
    list = cards(record);

    /* Recording is on rekordbox's Hardware Unlock list for the FLX series (v7
       FAQ), so an FLX4 owner who records stays on the Free plan. */
    const rbRec = byName(list, "rekordbox");
    assert.strictEqual(rbRec.group, "fits", "an FLX4 is on the Hardware Unlock list, which includes recording on the Free plan");
    assert.match(rbRec.badge, /No licence cost/i, "the badge must say no licence cost: " + rbRec.badge);
    assert.ok(rbRec.why.some((line) => /recording/i.test(line)),
      "the reason must name recording: " + JSON.stringify(rbRec.why));

    const seratoRec = byName(list, "Serato DJ");
    assert.match(seratoRec.price, /\$299 once/, "Serato Pro is a perpetual $299: " + seratoRec.price);

    const traktorRec = byName(list, "Traktor");
    assert.match(traktorRec.price, /Traktor Pro 4/, "recording forces Traktor Pro 4, not Play");
    assert.ok(traktorRec.notes.some((line) => /Play/.test(line)),
      "and the cheaper Play edition must still be mentioned: " + JSON.stringify(traktorRec.notes));

    const rows = record.queryAll(".swa-table tbody tr").map((row) => row.textContent.replace(/\s+/g, " ").trim());
    assert.ok(rows.some((row) => /rekordbox/.test(row) && /No licence fee/.test(row)),
      "rekordbox is free for an FLX4 owner who records, and says so in the table: " + JSON.stringify(rows));
    assert.ok(rows.some((row) => /Serato/.test(row) && /\$299/.test(row)),
      "Serato is priced as a one-off $299 in the table: " + JSON.stringify(rows));
    assert.ok(rows.some((row) => /VirtualDJ/.test(row) && /\$597/.test(row)),
      "VirtualDJ Pro resolves to $597 over three years, not a monthly rate: " + JSON.stringify(rows));
    record.close();

    /* Same need, no unlock hardware: recording is a paid Core feature again. */
    const laptopRec = await openPage(server.base + PAGE + qs({
      mode: "laptop", hardware: "none", os: "windows", music: "local", budget: "free", need: "recording"
    }), { expectRig: false });
    const rbLap = byName(cards(laptopRec), "rekordbox");
    assert.strictEqual(rbLap.group, "costs", "without unlock hardware, recording is a paid Core feature");
    assert.match(rbLap.price, /Core/, "rekordbox names Core: " + rbLap.price);
    assert.ok(rbLap.notes.some((line) => /Without unlock hardware, that means Core/.test(line)),
      "and the card says what it means without the gear: " + JSON.stringify(rbLap.notes));
    laptopRec.close();

    /* FLX10/FLX6 (issue #1): the hardware unlocks Serato DJ Pro itself, so a
       Pro-tier need like recording carries no licence cost. */
    const flx10Rec = await openPage(server.base + PAGE + qs({
      mode: "controller", hardware: "flx10", os: "windows", music: "local", budget: "free", need: "recording"
    }), { expectRig: false });
    const flx10List = cards(flx10Rec);
    const serato10 = byName(flx10List, "Serato DJ");
    assert.strictEqual(serato10.group, "fits", "an FLX10 unlocks Serato DJ Pro while connected, so recording needs no purchase");
    assert.match(serato10.badge, /No licence cost/i, serato10.badge);
    assert.ok(serato10.why.some((line) => /unlocks Serato DJ Pro/.test(line)),
      "and the reason says so: " + JSON.stringify(serato10.why));
    const rb10 = byName(flx10List, "rekordbox");
    assert.strictEqual(rb10.group, "fits", "an FLX10 is on the Hardware Unlock list, so rekordbox recording is free too");
    assert.match(rb10.badge, /No licence cost/i, rb10.badge);
    flx10Rec.close();

    /* DVS stays a separate expansion even for Pro-unlock gear: the fix must not
       overcorrect into "everything is free". */
    const flx10Dvs = await openPage(server.base + PAGE + qs({
      mode: "controller", hardware: "flx10", os: "windows", music: "local", budget: "once", need: "dvs"
    }), { expectRig: false });
    const serato10Dvs = byName(cards(flx10Dvs), "Serato DJ");
    assert.strictEqual(serato10Dvs.group, "costs", "DVS is a separate expansion, not covered by the Pro unlock");
    assert.match(serato10Dvs.price, /Suite/, "Serato names Suite: " + serato10Dvs.price);
    assert.match(serato10Dvs.price, /\$499/, "and the Suite price is visible: " + serato10Dvs.price);
    assert.ok(serato10Dvs.notes.some((line) => /unlocks Serato DJ Pro/.test(line)),
      "while still naming the Pro unlock: " + JSON.stringify(serato10Dvs.notes));
    flx10Dvs.close();

    /* FLX2 unlocks Lite, not Pro: recording still costs the Pro licence, while
       rekordbox gets it free from the same unlock list. */
    const flx2Rec = await openPage(server.base + PAGE + qs({
      mode: "controller", hardware: "flx2", os: "windows", music: "local", budget: "free", need: "recording"
    }), { expectRig: false });
    const flx2List = cards(flx2Rec);
    const serato2 = byName(flx2List, "Serato DJ");
    assert.strictEqual(serato2.group, "costs", "an FLX2 unlocks Lite only, so recording still needs a licence");
    assert.match(serato2.price, /\$299 once/, serato2.price);
    assert.ok(serato2.notes.some((line) => /unlocks Serato DJ Lite, not DJ Pro/.test(line)),
      "the Lite-only unlock is called out: " + JSON.stringify(serato2.notes));
    const rb2 = byName(flx2List, "rekordbox");
    assert.strictEqual(rb2.group, "fits", "an FLX2 is on the Hardware Unlock list, so rekordbox recording is free there");
    assert.match(rb2.badge, /No licence cost/i, rb2.badge);
    flx2Rec.close();

    /* ------------------------------------- FLX4 owner choosing Serato ----- */
    const seratoGap = await openPage(server.base + PAGE + qs({
      mode: "controller", hardware: "flx4", os: "macos", music: "local",
      budget: "once", need: "recording"
    }), { expectRig: false });
    const gapCard = byName(cards(seratoGap), "Serato DJ");
    assert.ok(gapCard.notes.some((line) => /unlocks Serato DJ Lite, not DJ Pro/.test(line)),
      "a Lite-only unlock must be called out before the reader pays: " + JSON.stringify(gapCard.notes));
    assert.strictEqual(gapCard.group, "costs", "Serato is a paid route, not a free one, for a recording FLX4 owner");

    /* DVS is the other place a Lite licence quietly is not enough. */
    const dvs = await openPage(server.base + PAGE + qs({
      mode: "controller", hardware: "other", os: "macos", music: "local",
      budget: "once", need: "dvs", scene: "scratch"
    }), { expectRig: false });
    const dvsSerato = byName(cards(dvs), "Serato DJ");
    assert.match(dvsSerato.price, /Suite/, "DVS sits in Suite: " + dvsSerato.price);
    assert.match(dvsSerato.price, /\$499/, "and the Suite price must be visible");
    const dvsRb = byName(cards(dvs), "rekordbox");
    assert.ok(dvsRb.checks.some((line) => /DVS/i.test(line)),
      "rekordbox DVS needs a device check: " + JSON.stringify(dvsRb.checks));
    dvs.close();
    seratoGap.close();

    /* --------------------------------------------- phone with streaming --- */
    /* Issue #2: Serato DJ for iOS is its own ladder (free / $149 / Suite). An
       iPad reader with no paid need gets the free tier offered, with the $149
       licence and its iOS-only scope surfaced rather than a forced $499 Suite. */
    const ipad = await openPage(server.base + PAGE + qs({
      mode: "mobile", hardware: "none", os: "ios", music: "streaming", budget: "free", scene: "home"
    }), { expectRig: false });
    list = cards(ipad);
    assert.strictEqual(byName(list, "djay").group, "fits", "djay's free app is the zero-cost tablet answer");
    const mobileSerato = byName(list, "Serato DJ");
    assert.strictEqual(mobileSerato.group, "fits", "the free iOS tier is offered when nothing paid is requested");
    assert.match(mobileSerato.badge, /No licence cost/i, mobileSerato.badge);
    assert.match(mobileSerato.price, /Serato DJ for iOS — free/i, "the free iOS app is named, not DJ Lite or Suite: " + mobileSerato.price);
    assert.ok(mobileSerato.notes.some((line) => /\$149/.test(line)),
      "the $149 iOS licence is surfaced, not hidden: " + JSON.stringify(mobileSerato.notes));
    assert.ok(mobileSerato.notes.some((line) => /iPhone and iPad only/.test(line)),
      "and its iOS-only scope is stated: " + JSON.stringify(mobileSerato.notes));
    ["Traktor", "VirtualDJ", "Mixxx", "Engine DJ"].forEach((name) => {
      assert.strictEqual(byName(list, name).group, "blocked", name + " is not a phone or tablet app");
    });
    const globalNote = ipad.text(".swa-note");
    assert.match(globalNote, /Streaming is not a licence/i, "streaming is framed as a separate dependency");
    assert.match(globalNote, /cannot be recorded/i, "and the recording restriction is stated up front");
    ipad.close();

    /* Recording on the iPad is the paid step — and the true three-year cost is
       the $149 iOS licence, not a $499 Suite (issue #2). */
    const ipadRec = await openPage(server.base + PAGE + qs({
      mode: "mobile", hardware: "none", os: "ios", music: "local", budget: "free", need: "recording"
    }), { expectRig: false });
    const ipadRecSerato = byName(cards(ipadRec), "Serato DJ");
    assert.strictEqual(ipadRecSerato.group, "costs", "recording is the paid step in the iOS app");
    assert.match(ipadRecSerato.price, /DJ for iOS — \$149 once/i, "the true three-year cost is the $149 licence, not a $499 Suite: " + ipadRecSerato.price);
    assert.match(ipadRecSerato.badge, /\$149/, ipadRecSerato.badge);
    assert.ok(ipadRecSerato.notes.some((line) => /does not unlock desktop DJ Pro/.test(line)),
      "and the licence's iOS-only scope is stated: " + JSON.stringify(ipadRecSerato.notes));
    assert.ok(!ipadRecSerato.why.some((line) => /\$299/.test(line)),
      "the card must not pitch the desktop Pro price on an iOS recommendation: " + JSON.stringify(ipadRecSerato.why));
    ipadRec.close();

    /* ------------------------------------------------------ Linux laptop -- */
    const linux = await openPage(server.base + PAGE + qs({
      mode: "laptop", hardware: "none", os: "linux", music: "local", budget: "free", scene: "home"
    }), { expectRig: false });
    list = cards(linux);
    assert.strictEqual(byName(list, "Mixxx").group, "fits", "Mixxx is the only native Linux option");
    list.filter((card) => card.name !== "Mixxx").forEach((card) => {
      assert.strictEqual(card.group, "blocked", card.name + " has no Linux build");
      assert.ok(card.blocked.some((line) => /Linux/.test(line)),
        card.name + " must say why: " + JSON.stringify(card.blocked));
    });
    linux.close();

    /* ------------------------------------------ standalone Engine rig ----- */
    /* Issue #1040: the old "denon" option blanket-blocked every non-Engine app.
       The PRIME 4/4+ is verified per model: Engine fits, rekordbox is a named
       partial (it reads rekordbox drives natively), the laptop apps that are
       a laptop program are still blocked in standalone mode — but only because
       of their role, not because the brand is unknown. */
    const prime4 = await openPage(server.base + PAGE + qs({
      mode: "standalone", hardware: "prime4", os: "windows", music: "local", budget: "free", scene: "club"
    }), { expectRig: false });
    list = cards(prime4);
    const engine4 = byName(list, "Engine DJ");
    assert.strictEqual(engine4.group, "fits", "Engine DJ is the free prep tool for Engine OS players");
    assert.ok(engine4.why.some((line) => /Engine OS|prep/.test(line)),
      "and the reason names the role: " + JSON.stringify(engine4.why));
    const rek4 = byName(list, "rekordbox");
    assert.strictEqual(rek4.group, "partial",
      "the PRIME 4/4+ reads rekordbox drives natively — an import role, not the player's own app");
    assert.ok(rek4.gaps.some((line) => /reads those drives natively|prepare the library/i.test(line)),
      "rekordbox's PRIME 4 role is stated, not guessed: " +
      JSON.stringify({ gaps: rek4.gaps, perModel: rek4.perModel }));
    ["Serato DJ", "Traktor", "djay", "VirtualDJ", "Mixxx"].forEach((name) => {
      const card = byName(list, name);
      assert.strictEqual(card.group, "blocked", name + " is a laptop program and cannot be installed on a standalone player");
      assert.ok(card.blocked.length, name + " must explain why it is ruled out");
    });
    prime4.close();

    /* The GO/GO+ line: Virtual DJ is verified at Pro, so with a laptop it is a
       paid route, never a block; as a standalone the same laptop programs are
       role-blocked, and rekordbox import stays a per-model check. */
    const primeGo = await openPage(server.base + PAGE + qs({
      mode: "standalone", hardware: "prime_go", os: "windows", music: "local", budget: "free", scene: "club"
    }), { expectRig: false });
    list = cards(primeGo);
    assert.strictEqual(byName(list, "Engine DJ").group, "fits", "Engine DJ is the free prep tool for the GO line");
    const rekGo = byName(list, "rekordbox");
    assert.notStrictEqual(rekGo.group, "blocked",
      "rekordbox on the GO line must not be asserted incompatible — it is unverified: " + rekGo.group);
    ["Serato DJ", "Traktor", "djay", "Mixxx"].forEach((name) => {
      const card = byName(list, name);
      assert.strictEqual(card.group, "blocked", name + " cannot be installed on a standalone player");
    });
    primeGo.close();

    /* AlphaTheta XDJ-AZ standalone: rekordbox is the free prep tool ($0),
       Engine DJ is blocked, and Spotify StreamingDirectPlay is surfaced for streaming. */
    const xdjAz = await openPage(server.base + PAGE + qs({
      mode: "standalone", hardware: "xdj_az", os: "macos", music: "streaming", budget: "free"
    }), { expectRig: false });
    const azList = cards(xdjAz);
    const rekAz = byName(azList, "rekordbox");
    assert.strictEqual(rekAz.group, "fits", "rekordbox is the free prep tool for XDJ-AZ");
    assert.ok(rekAz.notes.some((line) => /Spotify StreamingDirectPlay/i.test(line)),
      "XDJ-AZ direct Wi-Fi streaming notes Spotify StreamingDirectPlay: " + JSON.stringify(rekAz.notes));
    const engineAz = byName(azList, "Engine DJ");
    assert.strictEqual(engineAz.group, "blocked", "Engine DJ cannot drive AlphaTheta/Pioneer players");
    xdjAz.close();

    /* Same GO/GO+ as a laptop controller: Virtual DJ is verified at Pro, so it
       is a paid cost — not blocked, and not the Home tier. */
    const goVdj = await openPage(server.base + PAGE + qs({
      mode: "controller", hardware: "prime_go", os: "windows", music: "local", budget: "sub"
    }), { expectRig: false });
    const vdjGo = byName(cards(goVdj), "VirtualDJ");
    assert.strictEqual(vdjGo.group, "costs", "Virtual DJ on the GO/GO+ is verified at Pro, so it is paid — not a block");
    assert.ok(vdjGo.why.some((line) => /Pro licence|Pro/i.test(line)),
      "and the card names the Pro tier: " + JSON.stringify(vdjGo.why));
    goVdj.close();

    /* Issue #1040 owner case: the PRIME 4/4+ controller owner with mixed
       local/streaming. The apps this page has not verified for the unit must
       come out as per-model checks, never as "incompatible" — and the apps it
       has verified still fit. No platform is ruled out blindly. */
    const owner = await openPage(server.base + PAGE + qs({
      mode: "controller", hardware: "prime4", os: "windows", music: "local", budget: "free"
    }), { expectRig: false });
    const ownerList = cards(owner);
    const engineOwn = byName(ownerList, "Engine DJ");
    assert.strictEqual(engineOwn.group, "fits", "Engine DJ is verified for the PRIME 4/4+");
    const seratoOwn = byName(ownerList, "Serato DJ");
    assert.notStrictEqual(seratoOwn.group, "blocked",
      "Serato on the PRIME 4/4+ is verified (it unlocks Pro), so it must not be blocked: " + seratoOwn.group);
    const vdjOwn = byName(ownerList, "VirtualDJ");
    assert.notStrictEqual(vdjOwn.group, "blocked",
      "Virtual DJ is listed by Denon for the PRIME 4/4+, so it must not be blocked: " + vdjOwn.group);
    /* The apps this page has not verified for the unit: per-model, not blocked. */
    ["Traktor", "djay", "Mixxx"].forEach((name) => {
      const card = byName(ownerList, name);
      assert.notStrictEqual(card.group, "blocked",
        name + " on the PRIME 4/4+ is unverified here, so it must be a check, not a block: " + card.group);
      assert.ok(card.perModel.some((line) => /exact unit|per model|your exact|list/.test(line)) ||
        card.group === "blocked" === false,
        "it should say what to confirm: " + JSON.stringify(card.perModel));
    });
    assert.match(owner.text("[data-swa-status]"), /fits/, "the owner still gets a fitting platform");
    owner.close();

    /* Mixed library on software: local-only apps survive as partials, not
       blocks. "music=both" keeps them on the table with a named gap. */
    const bothLib = await openPage(server.base + PAGE + qs({
      mode: "laptop", hardware: "none", os: "windows", music: "both", budget: "free"
    }), { expectRig: false });
    const mixBoth = byName(cards(bothLib), "Mixxx");
    assert.strictEqual(mixBoth.group, "partial",
      "Mixxx covers the local half of a mixed library — a partial, not a block");
    assert.ok(mixBoth.gaps.some((line) => /stream/i.test(line)),
      "and the gap names what it can't do: " + JSON.stringify(mixBoth.gaps));
    assert.ok(mixBoth.fillers.length,
      "a named route covers the streamed half: " + JSON.stringify(mixBoth.fillers));
    bothLib.close();

    /* Same need, but "mostly streaming": a truly local-only app that can't
       stream is a fit the visitor's library can't survive — that is a genuine
       mismatch, stated as a blocker, not a silent exclusion. */
    const streamOnly = await openPage(server.base + PAGE + qs({
      mode: "laptop", hardware: "none", os: "windows", music: "streaming", budget: "free"
    }), { expectRig: false });
    const mixStream = byName(cards(streamOnly), "Mixxx");
    assert.strictEqual(mixStream.group, "blocked",
      "a mostly-streaming library means a no-streaming app cannot carry it");
    assert.ok(mixStream.blocked.some((line) => /stream/i.test(line)),
      "and the blocker names streaming: " + JSON.stringify(mixStream.blocked));
    streamOnly.close();

    /* PRIME 4/4+ DVS stays a separate expansion, matching the FLX10 behaviour:
       the Pro unlock covers the app tier, DVS is an added Suite. */
    const prime4Dvs = await openPage(server.base + PAGE + qs({
      mode: "controller", hardware: "prime4", os: "windows", music: "local", budget: "once", need: "dvs"
    }), { expectRig: false });
    const seratoDvs = byName(cards(prime4Dvs), "Serato DJ");
    assert.ok(seratoDvs.price.includes("$499"), "DVS on the PRIME 4 sits in the $499 Suite: " + seratoDvs.price);
    assert.ok(seratoDvs.notes.some((line) => /unlocks Serato DJ Pro/.test(line)),
      "while still naming the Pro unlock: " + JSON.stringify(seratoDvs.notes));
    prime4Dvs.close();

    /* ------------------------------------------- reset, deep link, focus -- */
    const state = await openPage(server.base + PAGE + qs({
      mode: "controller", hardware: "flx4", os: "macos", music: "local", budget: "free", scene: "home"
    }), { expectRig: false });
    assert.strictEqual(state.window.document.querySelector('[name="sw_hardware"][value="flx4"]').checked, true,
      "a shared link restores the selected hardware");
    assert.ok(state.queryAll(".swa-card").length, "and renders results immediately");

    await state.click("[data-swa-reset]");
    assert.strictEqual(state.queryAll(".swa-card").length, 0, "reset clears the results");
    assert.strictEqual(state.window.location.search, "", "reset clears the URL state: " + state.window.location.search);
    assert.strictEqual(state.queryAll(".swa-question").length, 7, "and keeps the questions");
    assert.strictEqual(state.window.document.activeElement.type, "radio", "focus returns to the first control");
    state.close();

    /* ------------------------------------------- no pitch inside a free answer */
    /* A software-only beginner on a free budget used to get Serato's $299
       buy-once licence and djay's $49.99/yr subscription as the "why it fits"
       line. Both are true facts in the wrong place: a free result must not
       argue with money. */
    const freeOnly = await openPage(server.base + PAGE + qs({
      mode: "laptop", hardware: "none", os: "macos", music: "local", budget: "free"
    }), { expectRig: false });
    const freeCards = cards(freeOnly);
    assert.ok(freeCards.length >= 4, "a software-only free answer still returns options: " + freeCards.length);
    freeCards.filter((card) => card.group === "fits").forEach((card) => {
      card.why.forEach((line) => {
        assert.ok(!line.includes("$"), `${card.name} argues with a price inside a free answer: ${line}`);
      });
      assert.ok(card.why.length >= 1, `${card.name} says why it fits at no cost`);
      const node = freeOnly.queryAll(".swa-card")
        .find((candidate) => candidate.querySelector("h4").textContent.trim() === card.name);
      const freeLine = node ? node.querySelector(".swa-free") : null;
      const stated = (freeLine && freeLine.textContent.trim()) || card.why.join(" ");
      assert.match(stated, /free|no licence fee|no account/i,
        `${card.name} states what the free tier covers before the reader commits: ${stated}`);
    });
    const seratoFree = byName(freeCards, "Serato DJ");
    assert.strictEqual(seratoFree.badge, "No licence cost", "Serato's free path is labelled by its tier, not its Pro price");
    assert.ok(!seratoFree.price.includes("$"), "and the price line does not quote Pro: " + seratoFree.price);
    freeOnly.close();

    /* ------------------------------------------------------------- a11y --- */
    const a11y = await openPage(server.base + PAGE + qs({
      mode: "controller", hardware: "flx4", os: "windows", music: "local", budget: "free", need: "recording"
    }), { expectRig: false });
    a11y.queryAll("[data-swa-form] input").forEach((input) => {
      assert.ok(input.name, "every control has a name");
      assert.ok(input.closest("label"), "every control sits inside its label");
      assert.ok(["radio", "checkbox"].includes(input.type), "native radio and checkbox controls only");
    });
    a11y.queryAll(".swa-question").forEach((fieldset) => {
      assert.ok(fieldset.querySelector("legend"), "every group of options has a legend");
    });
    assert.ok(a11y.query("[data-swa-results][aria-live]"), "results are announced");
    assert.ok(a11y.query(".swa-table caption"), "the cost table has a caption");
    assert.ok(a11y.query(".swa-method summary"), "the method is disclosed, not hidden");

    const rendered = a11y.query(".swa").textContent;
    assert.ok(!/\b\d+\s*\/\s*(10|100)\b|\bscore of\b|\bstar rating\b/i.test(rendered),
      "no numeric scores or star ratings are presented");
    assert.ok(!/guaranteed|works with every controller/i.test(rendered), "no absolute compatibility claims");
    assert.ok(!/tested by our team|we tested/i.test(rendered), "no invented first-hand testing claims");

    /* No result may promise recording from a streaming library. */
    a11y.close();

    [page, club, record, ipad, linux, prime4, primeGo, xdjAz, goVdj, owner, bothLib, streamOnly].forEach((p) => {
      if (p && p.consoleErrors && p.consoleErrors.length) {
        throw new Error("console errors: " + p.consoleErrors.join(" | "));
      }
    });

    console.log("Software advisor: prices, unlocks, hidden tiers, streaming limits, standalone, Linux, mobile, reset, deep links and accessibility — all verified");
  } finally {
    await server.close();
  }
})().catch((error) => {
  console.error("Software advisor test failed:", error.message);
  process.exitCode = 1;
});
