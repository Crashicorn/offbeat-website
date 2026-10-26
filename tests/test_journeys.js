/* End-to-end visitor journeys across the guide library and tools.
 *
 * Each journey starts where a real reader starts (usually the homepage)
 * and follows rendered links/controls — no deep-linked shortcuts — to a
 * working outcome: an item inside Rig Studio, a filtered matrix, a
 * running Mix Lab deck, an onward planning link, or a search result.
 * Assertions use visible DOM and public test hooks only, so a failure
 * means a reader would have hit a dead end.
 *
 * Run:  node tests/test_journeys.js          (expects a static server on :8099)
 *       PORT=8080 node tests/test_journeys.js
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
const BASE = `http://127.0.0.1:${PORT}/`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function goto(page, slug) {
  await page.goto(BASE + slug, { waitUntil: "networkidle2", timeout: 30000 });
  await sleep(400);
}

/* Click the first visible link whose href ends with `target` (string)
 * or matches it (RegExp — passed as source so it survives evaluate()). */
async function follow(page, target) {
  const arg = target instanceof RegExp ? { re: target.source } : { str: target };
  const ok = await page.evaluate((t) => {
    const rx = t.re ? new RegExp(t.re) : null;
    const el = [...document.querySelectorAll("a[href]")].find((a) => {
      const href = a.getAttribute("href") || "";
      const hit = rx ? rx.test(href) : href.endsWith(t.str);
      return hit && a.offsetParent !== null;
    });
    if (!el) return false;
    el.scrollIntoView();
    el.click();
    return true;
  }, arg);
  assert.ok(ok, `no visible link to ${target} on ${page.url()}`);
  await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 }).catch(() => {});
  await sleep(500);
  return page.url().replace(BASE, "");
}

const results = [];
async function journey(browser, name, fn) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 140)));
  try {
    const trail = await fn(page);
    assert.strictEqual(errors.length, 0, `page errors: ${errors.join("; ")}`);
    results.push(`[PASS] ${name}\n       ${trail.join("  →  ")}`);
  } catch (e) {
    results.push(`[FAIL] ${name}: ${e.message.slice(0, 200)}`);
    process.exitCode = 1;
  } finally {
    await page.close();
  }
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: "/tmp/chromium",
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--autoplay-policy=no-user-gesture-required"
    ]
  });

  /* A — beginner buying a first controller, ending inside Rig Studio. */
  await journey(browser, "A beginner first controller", async (page) => {
    const trail = ["index.html"];
    await goto(page, "index.html");
    trail.push(await follow(page, "beginner-dj-hub.html"));
    trail.push(await follow(page, "best-dj-controllers-for-beginners.html"));
    trail.push(await follow(page, "pioneer-ddj-flx4-review.html"));
    trail.push(await follow(page, /build-your-dj-setup\.html\?add=/));
    const inRig = await page.evaluate(() => /FLX4/.test(document.body.innerText));
    assert.ok(inRig, "FLX4 should be inside Rig Studio after the handoff");
    return trail;
  });

  /* B — upgrader browsing the under-$1,000 guide into Rig Studio. */
  await journey(browser, "B upgrader under $1000", async (page) => {
    const trail = ["index.html"];
    await goto(page, "index.html");
    trail.push(await follow(page, "dj-controllers-hub.html"));
    trail.push(await follow(page, "best-dj-controllers-under-1000.html"));
    const hasRig = await page.evaluate(() => !!document.querySelector('a[href*="build-your-dj-setup"]'));
    assert.ok(hasRig, "under-$1,000 guide should hand off to Rig Studio");
    trail.push(await follow(page, /build-your-dj-setup\.html/));
    return trail;
  });

  /* C — software comparer: hub → versus guide → matrix, then filter. */
  await journey(browser, "C software comparer + matrix", async (page) => {
    const trail = ["index.html"];
    await goto(page, "index.html");
    trail.push(await follow(page, "dj-software-hub.html"));
    trail.push(await follow(page, "rekordbox-vs-serato.html"));
    trail.push(await follow(page, "controller-software-compatibility-matrix.html"));
    const visibleCards = () =>
      page.evaluate(() => [...document.querySelectorAll(".mat-compare-toggle")].filter((el) => el.offsetParent !== null).length);
    const before = await visibleCards();
    const chosen = await page.evaluate(() => {
      const sel = document.querySelector("select[data-mat-soft]");
      if (!sel) return null;
      const opt = [...sel.options].find((o) => /rekordbox/i.test(o.textContent) && o.value);
      if (!opt) return null;
      sel.value = opt.value;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      return opt.textContent.trim().slice(0, 24);
    });
    await sleep(700);
    const after = await visibleCards();
    trail.push(`cards ${before} → ${after} (software: ${chosen})`);
    assert.ok(chosen && before > 0 && after > 0 && after !== before, "software filter must change the visible card set");
    return trail;
  });

  /* D — learner: mixing guide → Mix Lab, start decks, switch lesson. */
  await journey(browser, "D mix lab learner", async (page) => {
    const trail = ["how-to-mix-music-beginners.html"];
    await goto(page, "how-to-mix-music-beginners.html");
    trail.push(await follow(page, "beatmatch-trainer.html"));
    await page.waitForSelector("[data-ml-play]", { timeout: 8000 });
    const idle = await page.evaluate(() => window.__mixlab.metrics().running);
    await page.click("[data-ml-play]");
    await sleep(900);
    const m = await page.evaluate(() => window.__mixlab.metrics());
    trail.push(`decks running: ${idle} → ${m.running}`);
    assert.strictEqual(m.running, true, "decks should be running after play");
    await page.click('[data-ml-lesson="2"]');
    await sleep(500);
    const sel = await page.evaluate(() => document.querySelector('[data-ml-lesson="2"]').getAttribute("aria-selected"));
    trail.push(`lesson 2 selected: ${sel}`);
    assert.strictEqual(sel, "true", "lesson 2 tab should activate");
    return trail;
  });

  /* E — gig advice: homepage → wedding guide → onward planning link. */
  await journey(browser, "E wedding gig advice", async (page) => {
    const trail = ["index.html"];
    await goto(page, "index.html");
    let linked = await page.evaluate(() => !!document.querySelector('a[href$="how-to-dj-at-a-wedding.html"]'));
    if (!linked) {
      trail.push(await follow(page, "dj-skills-performance-hub.html"));
      linked = await page.evaluate(() => !!document.querySelector('a[href$="how-to-dj-at-a-wedding.html"]'));
    }
    assert.ok(linked, "wedding guide should be reachable from the homepage or skills hub");
    trail.push(await follow(page, "how-to-dj-at-a-wedding.html"));
    const onward = await page.evaluate(() =>
      !!document.querySelector('a[href$="festival-dj-gear-checklist.html"], a[href$="dj-equipment-checklist.html"], a[href*="speaker"], a[href*="build-your-dj-setup"]'));
    trail.push(`onward planning link: ${onward}`);
    assert.ok(onward, "wedding guide should lead onward to a checklist or planner");
    return trail;
  });

  /* F — Spotlight Search finds the FLX4 review and navigates to it. */
  await journey(browser, 'F spotlight search "flx4"', async (page) => {
    const trail = ["index.html"];
    await goto(page, "index.html");
    await page.keyboard.press("/");
    await sleep(500);
    const open = await page.evaluate(() => {
      const el = document.querySelector('[role="dialog"] input, .spotlight input, input[type="search"]');
      return !!el && el.offsetParent !== null;
    });
    assert.ok(open, "search should open with /");
    await page.keyboard.type("flx4 review", { delay: 40 });
    await sleep(900);
    const hit = await page.evaluate(() => {
      const items = [...document.querySelectorAll('[role="dialog"] a, .spotlight a, [class*="search"] a')];
      const el = items.find((a) => /flx4/i.test(a.textContent));
      if (!el) return null;
      const t = el.textContent.trim().slice(0, 40);
      el.click();
      return t;
    });
    assert.ok(hit, "search should offer an FLX4 result");
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {});
    trail.push(`hit: ${hit}`, page.url().replace(BASE, ""));
    assert.ok(page.url().endsWith("pioneer-ddj-flx4-review.html"), "search result should land on the FLX4 review");
    return trail;
  });

  await browser.close();
  console.log(results.join("\n"));
  const passed = results.filter((r) => r.startsWith("[PASS]")).length;
  console.log(`\nVisitor journeys: ${passed}/${results.length} passed, 0 expected page errors`);
})().catch((e) => {
  console.error("HARNESS FAIL", e);
  process.exit(2);
});
