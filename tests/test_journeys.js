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
      page.evaluate(() => [...document.querySelectorAll(".matrix-card")].filter((el) => el.offsetParent !== null).length);
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
  await journey(browser, "D beatmatch trainer drill", async (page) => {
    const trail = ["how-to-mix-music-beginners.html"];
    await goto(page, "how-to-mix-music-beginners.html");
    trail.push(await follow(page, "beatmatch-trainer.html"));
    await page.waitForSelector("[data-start]", { timeout: 8000 });
    const statusOf = () =>
      page.evaluate(() => (document.querySelector("[data-lock-status]") || {}).textContent || "");
    const idle = (await statusOf()).trim();
    await page.click("[data-start]");
    await sleep(1400);
    const running = (await statusOf()).trim();
    trail.push(`drill status: ${idle.slice(0, 24)} → ${running.slice(0, 34)}`);
    assert.ok(/ready/i.test(idle), "the drill should start in a ready state");
    assert.ok(running && !/ready/i.test(running), "pressing Start Training should hand over to live coaching");
    /* The drill must actually measure the two decks, not just run a timer. */
    const measurable = await page.evaluate(() => {
      const pitch = document.querySelector("[data-pitch]");
      const score = document.querySelector("[data-score-val]");
      return !!(pitch && score);
    });
    assert.ok(measurable, "pitch control and score output should both be present");
    await page.evaluate(() => {
      const pitch = document.querySelector("[data-pitch]");
      if (pitch) { pitch.value = String(Number(pitch.value) + 1); pitch.dispatchEvent(new Event("input", { bubbles: true })); }
    });
    await sleep(600);
    const moved = await page.evaluate(() => (document.querySelector("[data-score-val]") || {}).textContent || "");
    trail.push(`score after pitch nudge: ${moved.trim().slice(0, 24)}`);
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
      const el = document.querySelector("#quick-search-input");
      return !!el && el.offsetParent !== null;
    });
    assert.ok(open, "search should open with /");
    await page.keyboard.type("flx4 review", { delay: 40 });
    await sleep(900);
    const hit = await page.evaluate(() => {
      const items = [...document.querySelectorAll("#quick-search-backdrop a, .quick-search-dialog a")];
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

  /* G — mobile consent remains in flow, including when preferences reopen. */
  await journey(browser, "G mobile consent in flow", async (page) => {
    await page.setViewport({ width: 390, height: 900, isMobile: true, hasTouch: true });
    for (const slug of ["index.html", "pioneer-ddj-flx4-review.html"]) {
      await goto(page, slug);
      await page.evaluate(() => { localStorage.removeItem("offbeat.ga-consent.v1"); });
      await page.reload({ waitUntil: "networkidle2" });
      await page.waitForSelector(".ob-consent");
      await page.evaluate(() => window.scrollTo(0, 0));
      const placement = await page.evaluate(() => {
        const notice = document.querySelector(".ob-consent");
        const nav = document.querySelector('nav[aria-label="Primary navigation"]');
        const a = notice.getBoundingClientRect(), b = nav.getBoundingClientRect();
        return { position: getComputedStyle(notice).position, top: a.top, bottom: a.bottom,
          navTop: b.top, width: document.documentElement.scrollWidth, viewport: innerWidth };
      });
      assert.equal(placement.position, "static", slug + " notice should be in flow");
      assert.ok(placement.top >= 0 && placement.bottom <= placement.navTop + 1,
        slug + " notice should be visible above, not cover, navigation and content: " + JSON.stringify(placement));
      assert.ok(placement.width <= placement.viewport, slug + " must not overflow");
      await page.evaluate(() => [...document.querySelectorAll(".ob-consent button")]
        .find(button => button.textContent.trim() === "Necessary only").click());
      assert.equal(await page.$(".ob-consent"), null, "choice dismisses the notice");
      assert.equal(await page.evaluate(() => window.offbeatConsentState()), "denied");
      await page.click("[data-reopen-consent]");
      await page.waitForSelector(".ob-consent");
      const reopened = await page.$eval(".ob-consent", e => ({
        position: getComputedStyle(e).position, top: e.getBoundingClientRect().top,
        bottom: e.getBoundingClientRect().bottom, focused: e.contains(document.activeElement)
      }));
      assert.equal(reopened.position, "static", "reopened preferences should remain in flow");
      assert.ok(reopened.top >= 0 && reopened.bottom <= 900 && reopened.focused,
        "reopened preferences should be visible and focused: " + JSON.stringify(reopened));
    }
    return ["390×900", "home + review: visible in-flow notice", "deny + reopen preferences"];
  });

  /* H — issue #1043 claims in the rendered pages, not just search snippets. */
  await journey(browser, "H buyer facts on the page", async (page) => {
    await goto(page, "pioneer-ddj-flx4-review.html");
    let body = await page.$eval("main", e => e.innerText);
    assert.match(body, /2\.1 kg \/ 4\.6 lb/);
    assert.match(body, /111\.6 mm/);
    assert.match(body, /microphone input/i);
    assert.match(body, /Serato DJ Lite already includes basic Stems/i);
    assert.doesNotMatch(body, /(?:tighten|adjust).{0,35}jog.{0,35}screw/i);
    await goto(page, "pioneer-ddj-flx4-vs-flx6.html");
    const inputRow = await page.evaluate(() => [...document.querySelectorAll("tr")]
      .find(row => /External AUX \/ line \/ CDJ input/.test(row.innerText))?.innerText || "");
    assert.match(inputRow, /No\s+No/);
    await goto(page, "best-dj-headphones-2026.html");
    const headphoneRow = await page.evaluate(() => [...document.querySelectorAll("tr")]
      .find(row => /ATH-M50x/.test(row.innerText))?.innerText || "");
    assert.match(headphoneRow, /99 dB\/mW sensitivity is not max SPL/i);
    await goto(page, "beginner-dj-setup-guide-2026.html");
    const card = await page.$eval(".top-pick-section", e => ({
      text: e.innerText, links: [...e.querySelectorAll("a")].map(a => a.href)
    }));
    assert.match(card.text, /speakers/i);
    assert.ok(!card.links.some(href => /amazon\.com\/s\?.*(speaker|monitor)/i.test(href)),
      "starter card must not imply a generic speaker search is a specific product");
    await goto(page, "index.html");
    body = await page.$eval("body", e => e.innerText);
    assert.doesNotMatch(body, /independent since 2015/i);
    const org = await page.evaluate(() => [...document.querySelectorAll('script[type="application/ld+json"]')]
      .flatMap(e => { try { const data = JSON.parse(e.textContent); return data['@graph'] || [data]; } catch { return []; } })
      .find(e => e && e['@type'] === 'Organization'));
    assert.ok(org && !Object.hasOwn(org, "foundingDate"));
    return ["FLX4: inputs, Stems, weight + jogs", "FLX6 inputs", "ATH-M50x sensitivity", "starter card", "organization metadata"];
  });

  await browser.close();
  console.log(results.join("\n"));
  const passed = results.filter((r) => r.startsWith("[PASS]")).length;
  console.log(`\nVisitor journeys: ${passed}/${results.length} passed, 0 expected page errors`);
})().catch((e) => {
  console.error("HARNESS FAIL", e);
  process.exit(2);
});
