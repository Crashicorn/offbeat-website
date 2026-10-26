/* Browser coverage for the FLX4 evidence-led verdict card and its connected setup paths.
 *
 * Run with a static server on :8099 (or PORT=4173) and local Chromium / Puppeteer:
 *   PUPPETEER_CORE=/path/to/puppeteer-core node tests/test_flx4_verdict.js
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

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE || "/tmp/chromium",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
  });
  const errors = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 980 });
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto(`${BASE}/pioneer-ddj-flx4-review.html`, { waitUntil: "load" });
    await page.waitForSelector(".flx4-verdict-fact", { timeout: 5000 });

    const card = await page.evaluate(() => {
      const node = document.querySelector(".flx4-verdict");
      const facts = Array.from(node.querySelectorAll(".flx4-verdict-fact")).map((fact) => fact.innerText.replace(/\s+/g, " ").trim());
      const links = Array.from(node.querySelectorAll("a")).map((link) => ({ text: link.innerText.trim(), href: link.getAttribute("href") }));
      const rect = node.getBoundingClientRect();
      return {
        heading: node.querySelector("h2").innerText,
        facts,
        bars: node.querySelectorAll(".flx4-verdict-bar").length,
        links,
        sourceCount: node.querySelectorAll(".flx4-verdict-source a").length,
        width: rect.width,
        bodyWidth: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
        note: node.innerText
      };
    });
    assert.match(card.heading, /choose your software path/i, "the verdict should explain the controller's software choice");
    assert.strictEqual(card.facts.length, 5, "the card should show five concise product facts");
    assert.strictEqual(card.bars, 5, "each fact should receive the same decorative cyan accent, not a scaled rating");
    assert.ok(card.note.includes("FACTS, NOT A SCORE"), "the editorial framing should explicitly reject numeric scoring");
    assert.ok(card.facts.some((fact) => /Serato DJ Lite/.test(fact)), "software tier should be specific");
    assert.ok(card.facts.some((fact) => /Traktor Play.*Traktor Pro 4\.4\.0\+/.test(fact)), "the separate Play and Pro support tiers should be explicit");
    assert.ok(card.facts.some((fact) => /RCA · unbalanced/.test(fact)), "the output connection should be explicit");
    assert.ok(card.facts.some((fact) => /2 channels/.test(fact)), "the channel limit should be explicit");
    assert.strictEqual(card.sourceCount, 3, "manufacturer, Serato and Traktor sources should support the verdict facts");
    assert.ok(card.links.some((link) => link.href === "build-your-dj-setup.html?add=pioneer-ddj-flx4"), "the card should hand off to Rig Studio with the exact controller");
    assert.ok(card.links.some((link) => link.href === "controller-software-compatibility-matrix.html"), "the card should link to the broader software comparison");
    assert.strictEqual(card.bodyWidth, card.viewport, "the desktop buying path should not overflow horizontally");

    const rigHref = card.links.find((link) => link.href === "build-your-dj-setup.html?add=pioneer-ddj-flx4").href;
    await page.goto(new URL(rigHref, `${BASE}/pioneer-ddj-flx4-review.html`).href, { waitUntil: "load" });
    await page.waitForSelector(".rs-bar-stats", { timeout: 8000 });
    const rigItems = await page.evaluate(() => window.__rigStudio.state().items.map((item) => item.itemId));
    assert.ok(rigItems.includes("pioneer-ddj-flx4"), "the verdict CTA should add the exact FLX4 to Rig Studio");

    const mobile = await browser.newPage();
    await mobile.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    mobile.on("pageerror", (error) => errors.push(String(error)));
    mobile.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await mobile.goto(`${BASE}/pioneer-ddj-flx4-review.html`, { waitUntil: "load" });
    const mobileLayout = await mobile.evaluate(() => ({
      body: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
      card: Math.round(document.querySelector(".flx4-verdict").getBoundingClientRect().width),
      facts: document.querySelectorAll(".flx4-verdict-fact").length
    }));
    assert.strictEqual(mobileLayout.body, 390, `mobile page overflow: ${JSON.stringify(mobileLayout)}`);
    assert.strictEqual(mobileLayout.viewport, 390, "the mobile viewport should remain 390px");
    assert.ok(mobileLayout.card > 300 && mobileLayout.card <= mobileLayout.viewport, `the verdict card should fit the mobile content width: ${JSON.stringify(mobileLayout)}`);
    assert.strictEqual(mobileLayout.facts, 5, "all product facts should remain present on mobile");
    assert.deepStrictEqual(errors, [], `browser console errors: ${errors.join(" | ")}`);
    console.log("FLX4 verdict: factual cyan card, source links, exact Rig Studio handoff, mobile fit, 0 console errors");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error("FLX4 verdict test failed:", error.message);
  process.exit(1);
});
