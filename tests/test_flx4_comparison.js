/* Browser coverage for the evidence-led DDJ-400 vs DDJ-FLX4 comparison.
 *
 * Run with a static server on :8099 (or PORT=4173) and local Chromium / Puppeteer:
 *   PUPPETEER_CORE=/path/to/puppeteer-core node tests/test_flx4_comparison.js
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
function collectErrors(page, errors) {
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const url = message.location().url || "";
    // The legacy hero uses a properly attributed Wikimedia product photo and has a local,
    // explicitly illustrative fallback. Network egress is blocked in this test sandbox.
    if (url.includes("upload.wikimedia.org") && message.text().includes("Failed to load resource")) return;
    errors.push(message.text());
  });
}

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
    collectErrors(page, errors);
    await page.goto(`${BASE}/pioneer-ddj-400-vs-flx4.html`, { waitUntil: "load" });
    await page.waitForSelector(".flx4-compare-facts", { timeout: 5000 });

    const comparison = await page.evaluate(() => {
      const text = document.querySelector(".content-wrap").innerText;
      const cards = Array.from(document.querySelectorAll(".flx4-compare-model")).map((card) => ({
        heading: card.querySelector("h2").innerText,
        facts: card.querySelector(".flx4-model-facts").innerText,
        note: card.querySelector(".flx4-model-note").innerText
      }));
      const schemas = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map((node) => JSON.parse(node.textContent));
      return {
        text,
        cards,
        schemas,
        rig: document.querySelector('.flx4-compare-primary[href*="build-your-dj-setup"]').getAttribute("href"),
        scoreRows: document.querySelectorAll(".format-score-row").length,
        scores: document.querySelectorAll(".format-score-card").length,
        documentWidth: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth
      };
    });
    assert.strictEqual(comparison.cards.length, 2, "one factual card should be present for each model");
    assert.match(comparison.cards[0].heading, /DDJ-400/);
    assert.match(comparison.cards[1].heading, /DDJ-FLX4/);
    assert.match(comparison.cards[0].facts, /2-channel/);
    assert.match(comparison.cards[1].facts, /2-channel/);
    assert.match(comparison.text, /Serato status needs an extra check/, "the DDJ-400 Serato documentation conflict should be disclosed");
    assert.match(comparison.text, /Traktor Play is the free streamlined tier/, "the FLX4 software editions should be distinguished");
    assert.match(comparison.text, /Traktor Pro 4\.4\.0\+/, "the current Traktor Pro plug-and-play integration should be identified");
    assert.match(comparison.text, /RCA master/, "speaker connection needs should be explicit");
    const heroImage = await page.$eval(".hero-figure img", (image) => ({
      src: image.getAttribute("src"), alt: image.alt, caption: image.closest("figure").querySelector("figcaption").innerText
    }));
    if (heroImage.src.includes("assets/img/editorial/controller-macro.jpg")) {
      assert.match(heroImage.alt, /illustrative/i, "the local fallback image must be described as illustrative");
      assert.match(heroImage.caption, /Illustrative Offbeat image/, "the fallback caption must not imply a DDJ-400 product photo");
    }
    assert.doesNotMatch(comparison.text, /\b(?:4\.5|[0-9]+(?:\.[0-9]+)?\/10|[0-9]+(?:\.[0-9]+)? out of 10)\b/i,
      "unsupported numerical ratings must not return");
    assert.doesNotMatch(comparison.text, /4-channel support|DDJ-400 needed external|improved build quality/i,
      "known unsupported/contradictory claims must stay removed");
    assert.strictEqual(comparison.scoreRows, 0, "the old numerical score rows should be gone");
    assert.strictEqual(comparison.scores, 0, "the new facts cards should not reuse score-card semantics");
    assert.strictEqual(comparison.rig, "build-your-dj-setup.html?add=pioneer-ddj-flx4", "Rig Studio handoff should select the exact current controller");
    assert.strictEqual(comparison.documentWidth, comparison.viewport, "desktop comparison should fit its viewport");
    assert.strictEqual(comparison.schemas.filter((schema) => schema["@type"] === "Article").length, 1,
      "duplicate Article structured data should not be emitted");
    const faqSchema = comparison.schemas.find((schema) => schema["@type"] === "FAQPage");
    assert.ok(faqSchema.mainEntity.length >= 5, "the visible comparison FAQs should have matching structured entries");
    const traktorFaq = faqSchema.mainEntity.find((entry) => entry.name === "Does the DDJ-FLX4 support Traktor?");
    assert.ok(traktorFaq, "the Traktor support FAQ should have a structured-data entry");
    assert.match(traktorFaq.acceptedAnswer.text, /Traktor Pro 4\.4\.0 and later/);
    assert.match(traktorFaq.acceptedAnswer.text, /free Play copy/);

    await page.goto(`${BASE}/pioneer-ddj-flx4-review.html`, { waitUntil: "load" });
    const review = await page.evaluate(() => ({
      text: document.querySelector(".content-wrap").innerText,
      schemas: Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map((node) => JSON.parse(node.textContent))
    }));
    const productReview = review.schemas.find((schema) => schema["@type"] === "Review");
    assert.ok(productReview && !("reviewRating" in productReview), "the FLX4 review must not expose an unsupported JSON-LD rating");
    const reviewFaq = review.schemas.find((schema) => schema["@type"] === "FAQPage");
    const reviewTraktorFaq = reviewFaq.mainEntity.find((entry) => entry.name === "Does the Pioneer DDJ-FLX4 work with DJ software other than rekordbox?");
    assert.match(reviewTraktorFaq.acceptedAnswer.text, /Traktor Pro 4\.4\.0 and later/);
    assert.match(review.text, /Native Instruments separately documents plug-and-play support for the FLX4 in Traktor Pro 4\.4\.0 and later/);
    assert.doesNotMatch(review.text, /Best controller under \$400|DDJ-400 needed external|largest in this price band/i);

    const mobile = await browser.newPage();
    await mobile.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    collectErrors(mobile, errors);
    await mobile.goto(`${BASE}/pioneer-ddj-400-vs-flx4.html`, { waitUntil: "load" });
    const mobileLayout = await mobile.evaluate(() => ({
      widths: [document.documentElement.scrollWidth, document.documentElement.clientWidth],
      cards: document.querySelectorAll(".flx4-compare-model").length,
      note: document.querySelector(".flx4-compare-legend").innerText
    }));
    assert.deepStrictEqual(mobileLayout.widths, [390, 390], `mobile comparison overflow: ${JSON.stringify(mobileLayout)}`);
    assert.strictEqual(mobileLayout.cards, 2, "both models should remain visible in the mobile layout");
    assert.match(mobileLayout.note, /not measurements|not ratings/i);
    assert.deepStrictEqual(errors, [], `browser console errors: ${errors.join(" | ")}`);
    await mobile.close();
    console.log("DDJ-400 vs FLX4: verified shared/different facts, source conflict, no scores, exact Rig Studio handoff, mobile fit; 0 console errors");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error("FLX4 comparison test failed:", error.message);
  process.exit(1);
});
