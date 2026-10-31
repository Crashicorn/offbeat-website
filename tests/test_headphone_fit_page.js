/* Browser check for the headphone fit finder on the 2026 headphone guide.
 *
 * tests/test_headphone_fit.js exercises assets/headphone-fit.js against a fake
 * DOM, so it keeps passing even when the panel is missing from the page — which
 * is exactly what happened: four deep links from two guides pointed at
 * best-dj-headphones-2026.html#headphone-fit and nothing was there.
 *
 * This test drives the real page: the section must exist, each choice must
 * swap the visible verdict, and every verdict link must resolve to a real
 * heading on the same page.
 *
 * Run:  node tests/test_headphone_fit_page.js        (static server on :8099)
 *       PORT=8080 node tests/test_headphone_fit_page.js
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
    try { return require(c); } catch (e) { /* next */ }
  }
  throw new Error("puppeteer-core not found; set PUPPETEER_CORE to its install path");
}

const PORT = process.env.PORT || 8099;
const BASE = `http://127.0.0.1:${PORT}/`;

(async () => {
  const puppeteer = loadPuppeteer();
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE || "/tmp/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(BASE + "best-dj-headphones-2026.html", { waitUntil: "networkidle2", timeout: 45000 });

  const panel = await page.evaluate(() => {
    const el = document.getElementById("headphone-fit");
    if (!el) return null;
    return {
      title: (el.querySelector("h2") || {}).textContent || "",
      choices: [...el.querySelectorAll('input[name="headphone-use"]')].map((i) => i.value),
      results: [...el.querySelectorAll("[data-headphone-fit-result]")].map((r) => r.dataset.headphoneFitResult),
    };
  });
  assert.ok(panel, "best-dj-headphones-2026.html must contain #headphone-fit (two guides link to it)");
  assert.deepStrictEqual(panel.choices.sort(), ["booth", "home", "premium"], "three use-case choices");
  assert.deepStrictEqual(panel.results.sort(), ["booth", "home", "premium"], "three matching verdicts");

  const visible = () =>
    page.evaluate(() => [...document.querySelectorAll(".headphone-fit-result")]
      .filter((r) => !r.hidden)
      .map((r) => r.dataset.headphoneFitResult));

  assert.deepStrictEqual(await visible(), ["booth"], "the first choice is selected on load");

  for (const value of ["home", "premium", "booth"]) {
    await page.click(`.headphone-fit-choice input[value="${value}"]`);
    await new Promise((r) => setTimeout(r, 120));
    assert.deepStrictEqual(await visible(), [value], `choosing "${value}" shows exactly that verdict`);
  }

  // Every verdict link must resolve inside the page.
  const links = await page.evaluate(() =>
    [...document.querySelectorAll("#headphone-fit .headphone-fit-result a[href^='#']")]
      .map((a) => ({ href: a.getAttribute("href"), target: !!document.querySelector(a.getAttribute("href")) })));
  assert.ok(links.length >= 3, "each verdict links to its full review below");
  for (const link of links) {
    assert.ok(link.target, `verdict link ${link.href} must resolve to an element on the page`);
  }

  // The guides that promise a fit finder must land on it.
  for (const source of ["best-dj-monitor-speakers.html", "best-dj-turntables-2026.html"]) {
    await page.goto(BASE + source, { waitUntil: "domcontentloaded", timeout: 45000 });
    const href = await page.evaluate(() =>
      [...document.querySelectorAll("a[href*='best-dj-headphones-2026.html#headphone-fit']")]
        .map((a) => a.getAttribute("href"))[0] || null);
    assert.ok(href, `${source} should still offer the headphone fit finder`);
  }

  assert.deepStrictEqual(errors, [], "no page errors");
  await browser.close();
  console.log("Headphone fit finder: section present, choices switch verdicts, verdict anchors resolve.");
})().catch((err) => {
  console.error("headphone fit page test failed:", err.message);
  process.exit(1);
});
