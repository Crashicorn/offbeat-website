"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function page(name) {
  return fs.readFileSync(path.join(__dirname, "..", name), "utf8");
}

function faqPairs(html) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map(match => JSON.parse(match[1]));
  const faq = blocks.find(block => block["@type"] === "FAQPage");
  assert.ok(faq, "FAQPage structured data must exist");
  const visible = [...html.matchAll(/<details><summary>([\s\S]*?)<\/summary><p>([\s\S]*?)<\/p><\/details>/g)]
    .map(match => ({ question: match[1], answer: match[2] }));
  assert.equal(faq.mainEntity.length, 5, "five FAQ questions");
  assert.equal(visible.length, 5, "five visible answers");
  for (const item of faq.mainEntity) {
    assert.ok(visible.some(pair => pair.question === item.name && pair.answer === item.acceptedAnswer.text),
      "visible FAQ and JSON-LD disagree: " + item.name);
  }
}

test("FLX4 software and predecessor claims match primary vendor facts", () => {
  const html = page("pioneer-ddj-flx4-review.html");
  faqPairs(html);
  assert.match(html, /Serato DJ Lite already includes basic Stems/);
  assert.match(html, /DDJ-400 also had/);
  assert.match(html, /DDJ-400 already had Beat FX controls/);
  assert.match(html, /Traktor Play is officially supported/);
  assert.match(html, /compatible computer or supported mobile device/);
  assert.match(html, /separately supplied 9V\/3A power source/);
  assert.doesNotMatch(html, /DDJ-400 needed external|Serato DJ Pro adds four decks, Stems|laptop is required for every set|\$9\.99\/month|absent on the DDJ-400|a built-in audio interface, a Beat FX section, and a licence/);
  assert.match(html, /https:\/\/serato\.com\/dj\/lite/);
  assert.match(html, /https:\/\/www\.pioneerdj\.com\/en\/product\/dj-controllers\/ddj-flx4\//);
});

test("headphone comparison never equates sensitivity to max SPL", () => {
  const html = page("best-dj-headphones-2026.html");
  faqPairs(html);
  assert.match(html, /99 dB\/mW sensitivity is not max SPL/);
  assert.match(html, /Audio-Technica ATH-M50x specification/);
  assert.doesNotMatch(html, /Club-Ready Picks Tested/);
  assert.doesNotMatch(html, /SPL Max|low max SPL \(99 dB|106 dB max SPL|100\+ dB SPL for loud club/);
  const table = html.match(/<table class="comparison-table">([\s\S]*?)<\/table>/);
  assert.ok(table, "comparison table exists");
  const rows = [...table[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(match => match[1]);
  assert.equal(rows.length, 7, "header plus six product rows");
  rows.forEach((row, index) => {
    const cells = [...row.matchAll(/<(?:th|td)>[\s\S]*?<\/(?:th|td)>/g)];
    assert.equal(cells.length, 5, "consistent five-column row " + index);
  });
});

test("Rig Spotlight deep links match catalog product identity, unit and planning price", () => {
  const catalog = JSON.parse(page("assets/dj-gear-catalog.json"));
  const index = JSON.parse(page("assets/search-index.json"));
  const products = new Map(catalog.items.map(item => [item.id, item]));
  const deepLinks = index.filter(item => typeof item.u === "string" &&
    item.u.startsWith("build-your-dj-setup.html?add="));
  assert.ok(deepLinks.length >= 30, "curated product links must remain searchable");
  const seen = new Set();
  const normalized = value => String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const entry of deepLinks) {
    const id = new URL(entry.u, "https://offbeatinc.com/").searchParams.get("add");
    const product = products.get(id);
    assert.ok(product, "search deep link targets missing catalog ID: " + id);
    assert.ok(!seen.has(id), "duplicate curated search target: " + id);
    seen.add(id);
    assert.equal(entry.title, entry.t, id + " title fields diverge");
    assert.equal(entry.url, entry.u, id + " URL fields diverge");
    assert.equal(entry.desc, entry.d, id + " description fields diverge");
    assert.ok(normalized(entry.t).includes(normalized(product.model.split("(")[0])),
      id + " search label names a different product: " + entry.t + " vs " + product.model);
    const price = entry.t.match(/\(\$([\d,]+(?:\.\d+)?)(?:\s+est\.)?\)/i);
    if (price) {
      assert.equal(Number(price[1].replace(/,/g, "")), product.price,
        id + " search price differs from catalog planning price");
    }
  }
  for (const [id, units] of [["krk-rokit-5-g4", 1], ["krk-classic-5-pair", 2]]) {
    assert.equal(products.get(id).speaker_units, units, id + " sale unit count");
    assert.ok(seen.has(id), id + " must have a separate search deep link");
  }
});


test("MixTrack Go included stereo RCA lead covers two independent Classic 5 monitors", () => {
  const catalog = JSON.parse(page("assets/dj-gear-catalog.json"));
  const { OffbeatGear } = require("../assets/gear-connections.js");
  const byId = id => catalog.items.find(item => item.id === id);
  const controller = byId("numark-mixtrack-go");
  const pair = byId("krk-classic-5-pair");
  assert.equal(controller.included_cables[0].feeds_covered, 2,
    "the supplied stereo 3.5mm-to-dual-RCA lead has two independent RCA speaker-end plugs");
  const plan = OffbeatGear.connectionPlan(catalog, controller, pair, 1);
  assert.equal(plan.feeds, 2, "the Classic 5 pair requires two mono feeds");
  assert.equal(plan.kind, "included", "one supplied dual-RCA lead reaches both cabinets");
  assert.equal(plan.units, 0, "do not charge a second lead for a complete included path");
  assert.equal(plan.outputsNeeded, 1, "the stereo adapter uses one stereo master output");
  assert.equal(plan.conflict, false, "a valid pair must not be marked impossible");

  // Future partial-coverage regression: two feeds included, three required.
  // An extra output and purchased cable must be charged, not labelled free.
  const threeFeedPair = JSON.parse(JSON.stringify(pair));
  threeFeedPair.connection.feeds_per_box = 3;
  const twoOutputController = JSON.parse(JSON.stringify(controller));
  twoOutputController.outputs.push({ ...twoOutputController.outputs[0], role: "booth", label: "Second stereo output" });
  const partial = OffbeatGear.connectionPlan(catalog, twoOutputController, threeFeedPair, 1);
  assert.equal(partial.feeds, 3);
  assert.equal(partial.coveredFeeds, 2);
  assert.equal(partial.kind, "allowance", "remaining feed needs a priced lead, not included status");
  assert.equal(partial.units, 1, "one additional cable purchase required");
  assert.equal(partial.outputsNeeded, 2, "included and purchased leads consume two sockets");
  assert.match(partial.note, /2 of 3 feeds already come with/);
});

test("Inpulse 500 buyer facts match Hercules across the budget and main guides", () => {
  const budget = page("best-dj-controllers-under-200.html");
  const main = page("best-dj-controllers-2026.html");
  assert.match(budget, /Hercules DJControl Inpulse 500[\\s\\S]*?<td>140 mm \\(5\\.5 in\\)<\\/td>/,
    "the comparison table must state the manufacturer's 140 mm jog diameter");
  assert.match(budget, /140 mm \\(5\\.5-inch\\) jog wheels/);
  assert.match(budget, /Beatmatch Guide lights assist manual tempo practice in both DJUCED and Serato DJ Lite/);
  assert.match(budget, /https:\\/\\/www\\.hercules\\.com\\/en\\/product\\/dj-control-inpulse-500\\//);
  assert.match(main, /Hercules DJControl Inpulse 500[\\s\\S]*?140mm jog wheels/);
  assert.doesNotMatch(budget, /114\\s*mm|DJUCED\\/Rekordbox learning lights|Serato users get the hardware without those cues/);
});
