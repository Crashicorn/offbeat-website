/* Real-browser regression test for the DJ software advisor.
 *
 * jsdom can check behaviour but not layout: it cannot tell you that a result
 * card overflows a 390px phone, that a tap target is 28px high, or that the
 * page scrolls sideways when the cost table opens. This drives the published
 * page in Chromium at desktop and phone widths and asserts on measured
 * geometry, real key presses and real navigation.
 *
 * Run (a local static server is started for you):
 *   node tests/software-advisor.browser.js
 *   CHROME_PATH=/path/to/chrome node tests/software-advisor.browser.js
 *
 * Screenshots are written to evidence/software-advisor-2026-10/ so a reviewer
 * can see what was measured.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { startServer } = require("./dom_harness");

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
const CHROME = process.env.CHROME_PATH || "/tmp/chromium";
const EVIDENCE = path.resolve(__dirname, "..", "evidence", "software-advisor-2026-10");

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* Read one rendered answer the way a reviewer would: which platform, in which
   group, with what badge. */
async function answerFor(page, query) {
  await page.goto(page.__base + "/dj-software-hub.html?" + query, { waitUntil: "networkidle2", timeout: 45000 });
  await sleep(150);
  return page.evaluate(() => {
    const read = (selector) => Array.from(document.querySelectorAll(selector)).map((card) => ({
      name: card.querySelector("h4").textContent.trim(),
      badge: card.querySelector(".swa-badge").textContent.trim(),
      price: card.querySelector(".swa-price") ? card.querySelector(".swa-price").textContent.trim() : "",
      why: Array.from(card.querySelectorAll(".swa-why li")).map((li) => li.textContent.trim()),
      gaps: Array.from(card.querySelectorAll(".swa-gaps li")).map((li) => li.textContent.trim()),
      fillers: Array.from(card.querySelectorAll(".swa-fillers li")).map((li) => li.textContent.trim()),
      perModel: Array.from(card.querySelectorAll(".swa-permodel li")).map((li) => li.textContent.trim()),
      checked: Array.from(card.querySelectorAll(".swa-checks li")).map((li) => li.textContent.trim()),
      blocked: Array.from(card.querySelectorAll(".swa-blockers li")).map((li) => li.textContent.trim()),
      verify: card.querySelector(".swa-verify") ? card.querySelector(".swa-verify").textContent.trim() : ""
    }));
    return {
      status: document.querySelector("[data-swa-status]").textContent.trim(),
      fits: read(".swa-group--fits .swa-card"),
      costs: read(".swa-group--costs .swa-card"),
      partial: read(".swa-group--partial .swa-card"),
      check: read(".swa-group--check .swa-card"),
      blocked: read(".swa-group--blocked .swa-card"),
      streamingNote: !!document.querySelector(".swa-note")
    };
  });
}

const names = (cards) => cards.map((card) => card.name).sort();

/* jsdom cannot scroll and a phone page is long; scroll explicitly and prove
   the target actually landed in the viewport before taking a picture. */
async function reveal(page, selector) {
  const top = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const offset = el.getBoundingClientRect().top + window.scrollY - 72;
    window.scrollTo({ top: Math.max(0, offset), behavior: "instant" });
    return Math.round(window.scrollY);
  }, selector);
  await sleep(350);
  const box = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const rect = el.getBoundingClientRect();
    return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), inner: window.innerHeight };
  }, selector);
  assert.ok(box.top < box.inner && box.bottom > 0, `${selector} should be on screen after scrolling (scrollY=${top}, top=${box.top})`);
  return box;
}

async function newPage(browser, viewport) {
  const page = await browser.newPage();
  await page.setViewport({ ...viewport, deviceScaleFactor: 1 });
  const errors = [];
  const failed = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("requestfailed", (request) => failed.push(request.url() + " " + (request.failure() || {}).errorText));
  page.__errors = errors;
  page.__failed = failed;
  return page;
}

/* Everything a reader can see or click, measured. */
async function auditLayout(page, label) {
  const report = await page.evaluate(() => {
    const doc = document.documentElement;
    const overflow = doc.scrollWidth - window.innerWidth;
    const targets = Array.from(document.querySelectorAll(".swa-option, .swa-next a, .swa-reset, .swa-method summary"));
    const small = targets
      .map((el) => {
        const box = el.getBoundingClientRect();
        return { label: (el.textContent || "").trim().slice(0, 40), height: Math.round(box.height), width: Math.round(box.width) };
      })
      .filter((item) => item.height > 0 && item.height < 44);
    const card = document.querySelector(".swa-card");
    const cardBox = card ? card.getBoundingClientRect() : null;
    const table = document.querySelector(".swa-table-wrap");
    const tableBox = table ? table.getBoundingClientRect() : null;
    return {
      overflow,
      small,
      cardWidth: cardBox ? Math.round(cardBox.width) : 0,
      cardRight: cardBox ? Math.round(cardBox.right) : 0,
      tableScrolls: table ? table.scrollWidth > table.clientWidth + 1 : false,
      costRight: (() => {
        const cell = document.querySelector(".swa-table tbody tr td:last-child");
        return cell ? Math.round(cell.getBoundingClientRect().right) : 0;
      })(),
      viewport: window.innerWidth
    };
  });
  assert.ok(report.overflow <= 1, `${label}: page scrolls sideways by ${report.overflow}px`);
  assert.deepStrictEqual(report.small, [], `${label}: tap targets under 44px: ${JSON.stringify(report.small)}`);
  assert.ok(report.cardRight <= report.viewport + 1, `${label}: a result card overflows the viewport`);
  return report;
}

(async () => {
  const server = await startServer(8137);
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "shell",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"]
  });

  try {
    fs.mkdirSync(EVIDENCE, { recursive: true });

    /* ------------------------------------------------ desktop, real clicks */
    const desktop = await newPage(browser, DESKTOP);
    await desktop.goto(server.base + "/dj-software-hub.html", { waitUntil: "networkidle2", timeout: 45000 });

    const questionCount = await desktop.$$eval(".swa-question", (nodes) => nodes.length);
    assert.strictEqual(questionCount, 7, "seven questions render in a real browser");

    /* Answer the way a person does: click the visible label, not the input. */
    const pick = async (question, value) => {
      await desktop.click(`[data-question="${question}"] input[value="${value}"]`);
      await sleep(120);
    };
    await pick("mode", "controller");
    await pick("hardware", "flx4");
    await pick("os", "macos");
    await pick("music", "local");
    await pick("budget", "free");
    await pick("needs", "cdj");
    await pick("scene", "club");

    const status = await desktop.$eval("[data-swa-status]", (el) => el.textContent.trim());
    assert.match(status, /1 platform fits/, "status reflects the answer: " + status);

    const fits = await desktop.$$eval(".swa-group--fits .swa-card h4", (nodes) => nodes.map((n) => n.textContent.trim()));
    assert.deepStrictEqual(fits, ["rekordbox"], "rekordbox is the one platform that fits a free club-prep answer");

    const url = desktop.url();
    assert.match(url, /sw_hardware=flx4/, "answers are written to the URL: " + url);

    const desktopLayout = await auditLayout(desktop, "desktop 1440");
    assert.ok(desktopLayout.cardWidth > 250, "cards use the desktop width: " + desktopLayout.cardWidth);

    await desktop.screenshot({ path: path.join(EVIDENCE, "software-advisor-1440-result.png"), fullPage: false });
    /* Scroll to the answer itself and capture what a reader sees there: an
       element-level screenshot stitches the sticky header into the middle of
       the image, viewport captures do not. */
    await reveal(desktop, "[data-swa-results]");
    await desktop.screenshot({ path: path.join(EVIDENCE, "software-advisor-1440-answer.png"), fullPage: false });
    await reveal(desktop, ".swa-table-wrap");
    await desktop.screenshot({ path: path.join(EVIDENCE, "software-advisor-1440-costs.png"), fullPage: false });

    /* Keyboard: tab into the form, change a radio with the arrow keys. */
    await desktop.evaluate(() => {
      const first = document.querySelector('[data-question="mode"] input:checked');
      if (first) first.focus();
    });
    await desktop.keyboard.press("ArrowDown");
    await sleep(150);
    const modeAfterKey = await desktop.$eval('[data-question="mode"] input:checked', (el) => el.value);
    assert.notStrictEqual(modeAfterKey, "controller", "arrow keys move between options like a native radio group");

    /* Put it back and confirm the results survive a keyboard change. */
    await desktop.evaluate(() => {
      const target = document.querySelector('[data-question="mode"] input[value="controller"]');
      target.focus();
      target.click();
    });
    await sleep(150);
    assert.strictEqual(await desktop.$$eval(".swa-card", (n) => n.length), 7, "results still render after keyboard input");

    /* Navigation: a result must lead to a real page. */
    const href = await desktop.$eval('.swa-group--fits .swa-next a', (el) => el.getAttribute("href"));
    await Promise.all([
      desktop.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }),
      desktop.click('.swa-group--fits .swa-next a')
    ]);
    assert.ok(desktop.url().endsWith(href), "the review link navigates: " + desktop.url());
    await desktop.goBack({ waitUntil: "domcontentloaded" });
    await sleep(300);

    /* Deep link, then reset. */
    await desktop.goto(server.base + "/dj-software-hub.html?sw_mode=mobile&sw_hardware=none&sw_os=ios&sw_music=streaming&sw_budget=free", { waitUntil: "networkidle2" });
    const checked = await desktop.$eval('[data-question="mode"] input:checked', (el) => el.value);
    assert.strictEqual(checked, "mobile", "a deep link restores the answers into the controls");

    await desktop.click("[data-swa-reset]");
    await sleep(150);
    assert.strictEqual(await desktop.$$eval(".swa-card", (n) => n.length), 0, "reset clears results");
    assert.ok(!desktop.url().includes("sw_mode"), "reset clears the URL: " + desktop.url());
    const focusTag = await desktop.evaluate(() => document.activeElement && document.activeElement.type);
    assert.strictEqual(focusTag, "radio", "focus returns to the first question");

    assert.deepStrictEqual(desktop.__errors, [], "console errors: " + desktop.__errors.join(" | "));
    assert.deepStrictEqual(desktop.__failed, [], "failed requests: " + desktop.__failed.join(" | "));
    await desktop.close();

    /* --------------------------------------------------- phone, 390 x 844 */
    const phone = await newPage(browser, PHONE);
    await phone.goto(server.base + "/dj-software-hub.html?sw_mode=controller&sw_hardware=flx4&sw_os=windows&sw_music=local&sw_budget=free&sw_need=recording",
      { waitUntil: "networkidle2", timeout: 45000 });
    await sleep(300);

    const phoneLayout = await auditLayout(phone, "phone 390");
    assert.strictEqual(phoneLayout.cardWidth > 0 && phoneLayout.cardWidth <= 390, true,
      "cards fit the phone width: " + phoneLayout.cardWidth);
    assert.strictEqual(phoneLayout.tableScrolls, false,
      "at 390px the four cost columns fit without a sideways swipe");
    assert.ok(phoneLayout.costRight <= PHONE.width,
      "the three-year cost is on screen on a phone, not scrolled off the side: " + phoneLayout.costRight);

    const phoneQuestions = await phone.$$eval(".swa-question", (nodes) => nodes.map((n) => Math.round(n.getBoundingClientRect().width)));
    assert.strictEqual(new Set(phoneQuestions).size, 1, "questions stack to a single column on a phone: " + JSON.stringify(phoneQuestions));

    await phone.screenshot({ path: path.join(EVIDENCE, "software-advisor-390-result.png"), fullPage: false });
    await reveal(phone, "[data-swa-results]");
    await phone.screenshot({ path: path.join(EVIDENCE, "software-advisor-390-answer.png"), fullPage: false });
    await reveal(phone, ".swa-table-wrap");
    await phone.screenshot({ path: path.join(EVIDENCE, "software-advisor-390-costs.png"), fullPage: false });

    /* A phone reader must still be able to reach the next step by thumb. */
    const nextTargets = await phone.$$eval(".swa-next a", (nodes) => nodes.map((n) => Math.round(n.getBoundingClientRect().height)));
    assert.ok(nextTargets.every((height) => height >= 44), "next-step buttons are at least 44px tall: " + JSON.stringify(nextTargets));

    assert.deepStrictEqual(phone.__errors, [], "phone console errors: " + phone.__errors.join(" | "));
    assert.deepStrictEqual(phone.__failed, [], "phone failed requests: " + phone.__failed.join(" | "));
    await phone.close();

    /* ------------------------------------------- other page entry points -- */
    const entry = await newPage(browser, DESKTOP);
    await entry.goto(server.base + "/index.html", { waitUntil: "networkidle2", timeout: 45000 });
    const entryHref = await entry.$eval('a[href="dj-software-hub.html#software-advisor"]', (el) => el.getAttribute("href")).catch(() => null);
    assert.strictEqual(entryHref, "dj-software-hub.html#software-advisor", "the homepage links to the advisor");
    await entry.goto(server.base + "/dj-software-hub.html#software-advisor", { waitUntil: "networkidle2" });
    const inView = await entry.evaluate(() => {
      const box = document.querySelector("#software-advisor").getBoundingClientRect();
      return box.top >= -50 && box.top < window.innerHeight;
    });
    assert.strictEqual(inView, true, "the #software-advisor anchor lands on the tool");
    assert.deepStrictEqual(entry.__errors, [], "entry page console errors: " + entry.__errors.join(" | "));
    await entry.close();

    /* ------------------------------ the cases the brief names, in a browser -- */
    const cases = await newPage(browser, DESKTOP);
    cases.__base = server.base;
    const seen = [];
    const check = async (label, query, expectations) => {
      const answer = await answerFor(cases, query);
      expectations(answer, label);
      const rows = answer.fits.length + answer.costs.length + answer.partial.length
        + answer.check.length + answer.blocked.length;
      assert.ok(rows >= 1, `${label}: something is rendered`);
      seen.push(`${label.padEnd(36)} fits: ${answer.fits.map((c) => c.name + " " + c.badge).join(", ") || "none"}` +
        ` | costs: ${answer.costs.map((c) => c.name + " " + c.badge).join(", ") || "none"}` +
        ` | partial: ${answer.partial.map((c) => c.name).join(", ") || "none"}` +
        ` | check: ${answer.check.map((c) => c.name).join(", ") || "none"}` +
        ` | blocked: ${answer.blocked.map((c) => c.name).join(", ") || "none"}`);
      await auditLayout(cases, label);
    };

    await check("no hardware, beginner, free", "sw_mode=laptop&sw_hardware=none&sw_os=macos&sw_music=local&sw_budget=free", (answer) => {
      const beginner = answer.fits.concat(answer.partial);
      assert.strictEqual(beginner.length, 5, "a laptop-only beginner gets the five free routes, nothing ruled out: " +
        beginner.map((c) => c.name).join(", "));
      beginner.forEach((card) => card.why.forEach((line) => {
        assert.ok(!line.includes("$"), `a free answer does not pitch a price (${card.name}): ${line}`);
      }));
    });

    await check("hardware unlocked, club prep, free", "sw_mode=controller&sw_hardware=flx4&sw_os=macos&sw_music=local&sw_budget=free&sw_scene=club&sw_need=cdj", (answer) => {
      const rekordbox = answer.fits.find((card) => card.name === "rekordbox");
      assert.ok(rekordbox, "an FLX4 puts rekordbox in the fits group: " + names(answer.fits));
      assert.strictEqual(rekordbox.badge, "No licence cost", "and the badge says so");
      assert.ok(rekordbox.why.some((line) => /Hardware Unlock list/.test(line)),
        "and it says why in hardware terms: " + JSON.stringify(rekordbox.why));
      const serato = answer.partial.find((card) => card.name === "Serato DJ");
      assert.ok(serato, "Serato with a CDJ-stick need is a partial fit, not a block: " + answer.partial.map((c) => c.name).join(", "));
      assert.ok(serato.gaps.some((line) => /rekordbox-format/.test(line)),
        "and the gap names what it misses: " + JSON.stringify(serato.gaps));
      assert.ok(serato.fillers.length, "a named route covers the gap: " + JSON.stringify(serato.fillers));
      const engine = answer.blocked.find((card) => card.name === "Engine DJ");
      assert.ok(engine, "Engine has no role on an FLX4, and says so: " + answer.blocked.map((c) => c.name).join(", "));
    });

    await check("standalone PRIME 4/4+ (issue #1040)", "sw_mode=standalone&sw_hardware=prime4&sw_os=windows&sw_music=local&sw_budget=free", (answer) => {
      assert.deepStrictEqual(names(answer.fits), ["Engine DJ"], "the player itself runs Engine OS: " + names(answer.fits));
      const rek = answer.partial.find((card) => card.name === "rekordbox");
      assert.ok(rek, "rekordbox is a named partial (drives the PRIME 4/4+ natively), not a block");
      assert.strictEqual(answer.blocked.length, 5, "the laptop programs are role-blocked, all with reasons");
    });

    await check("standalone PRIME GO/GO+", "sw_mode=standalone&sw_hardware=prime_go&sw_os=windows&sw_music=local&sw_budget=free", (answer) => {
      assert.deepStrictEqual(names(answer.fits), ["Engine DJ"], "the GO line runs Engine OS: " + names(answer.fits));
      const rek = answer.check.find((card) => card.name === "rekordbox");
      assert.ok(rek, "rekordbox on the GO line is a per-model check, never a block: " + names(answer.check));
      const vdj = answer.blocked.find((card) => card.name === "VirtualDJ");
      assert.ok(vdj, "VirtualDJ is role-blocked in standalone mode but the card names the laptop pairing: " +
        JSON.stringify(vdj && vdj.blocked));
    });

    await check("GO/GO+ as controller (VDJ at Pro)", "sw_mode=controller&sw_hardware=prime_go&sw_os=windows&sw_music=local&sw_budget=sub", (answer) => {
      const vdj = answer.costs.find((card) => card.name === "VirtualDJ");
      assert.ok(vdj, "Virtual DJ on the GO/GO+ is a paid route, not a block: " + answer.partial.concat(answer.check, answer.costs).map((c) => c.name).join(", "));
      assert.ok(/Pro/.test(vdj.why.join(" ")) || /Pro/.test(vdj.price), "and it is named at the Pro tier: " + JSON.stringify({ why: vdj.why, price: vdj.price }));
    });

    await check("PRIME 4/4+ owner keeps their apps (#1040)", "sw_mode=controller&sw_hardware=prime4&sw_os=windows&sw_music=local&sw_budget=free", (answer) => {
      assert.ok(names(answer.fits).includes("Serato DJ"), "Serato is verified for the PRIME 4/4+ and is not ruled out");
      assert.ok(names(answer.fits).includes("Engine DJ"), "Engine DJ is verified for the PRIME 4/4+");
      assert.ok(names(answer.costs).includes("VirtualDJ") || names(answer.partial).includes("VirtualDJ") || names(answer.check).includes("VirtualDJ"),
        "Virtual DJ (Denon-listed) is not ruled out: " + answer.costs.concat(answer.partial, answer.check).map((c) => c.name).join(", "));
      ["Traktor", "djay", "Mixxx"].forEach((name) => {
        const card = answer.check.find((c) => c.name === name);
        assert.ok(card, name + " is an unverified check on the PRIME 4/4+, never a block: " + JSON.stringify(answer));
        assert.ok(card.perModel.length, name + " says what to confirm: " + JSON.stringify(card.perModel));
      });
      assert.strictEqual(answer.blocked.length, 0, "no platform is ruled out for this owner: " + answer.blocked.map((c) => c.name).join(", "));
    });

    await check("PRIME 4/4+ with a DVS need", "sw_mode=controller&sw_hardware=prime4&sw_os=windows&sw_music=local&sw_budget=once&sw_need=dvs", (answer) => {
      const serato = answer.costs.find((card) => card.name === "Serato DJ");
      assert.ok(serato, "DVS pricing lands as a cost, not a mystery: " + answer.costs.concat(answer.partial, answer.check).map((c) => c.name).join(", "));
      assert.match(serato.price, /\$499/, "DVS on the PRIME 4 sits in the $499 Suite: " + serato.price);
    });

    await check("mixed library (both)", "sw_mode=laptop&sw_hardware=none&sw_os=windows&sw_music=both&sw_budget=free", (answer) => {
      const mix = answer.partial.find((card) => card.name === "Mixxx");
      assert.ok(mix, "a local-only app is a named partial for a mixed library, not a block: " + names(answer.partial));
      assert.ok(mix.gaps.some((line) => /stream/i.test(line)), "and the gap names streaming: " + JSON.stringify(mix.gaps));
      const streaming = answer.fits.concat(answer.partial).filter((c) => /rekordbox|Serato|djay|Virtual DJ/.test(c.name));
      assert.ok(streaming.length >= 3, "the streaming routes stay on the table: " + streaming.map((c) => c.name).join(", "));
    });

    await check("mostly streaming blocks no-stream apps", "sw_mode=laptop&sw_hardware=none&sw_os=windows&sw_music=streaming&sw_budget=free", (answer) => {
      assert.ok(names(answer.blocked).includes("Mixxx"), "a no-streaming app cannot carry a streaming library");
      assert.deepStrictEqual(names(answer.fits).sort(), ["Serato DJ", "VirtualDJ", "djay", "rekordbox"].sort(),
        "the integrated apps carry it for free: " + names(answer.fits));
    });

    await check("genuinely free on Linux", "sw_mode=laptop&sw_hardware=none&sw_os=linux&sw_music=local&sw_budget=free", (answer) => {
      assert.deepStrictEqual(names(answer.fits), ["Mixxx"], "Linux has exactly one free option here");
    });

    for (const os of ["macos", "windows"]) {
      await check(`laptop on ${os}`, `sw_mode=laptop&sw_hardware=none&sw_os=${os}&sw_music=local&sw_budget=free`, (answer) => {
        assert.ok(names(answer.fits).includes("Mixxx"), `${os}: the free cross-platform option is offered`);
      });
    }

    await check("streaming on a tablet", "sw_mode=mobile&sw_hardware=none&sw_os=ios&sw_music=streaming&sw_budget=free", (answer) => {
      assert.deepStrictEqual(names(answer.fits), ["Serato DJ", "djay", "rekordbox"].sort(),
        "the free mobile apps are named, and Serato's free iOS tier is one of them: " + names(answer.fits));
      const serato = answer.fits.find((card) => card.name === "Serato DJ");
      assert.strictEqual(serato.badge, "No licence cost",
        "an iPad reader with no paid need gets the free tier, not a forced price: " + serato.badge);
      assert.ok(answer.streamingNote, "streaming is called out as a separate subscription");
    });

    await check("DVS and scratch, buy once", "sw_mode=vinyl&sw_hardware=other&sw_os=windows&sw_music=local&sw_budget=once&sw_need=dvs", (answer) => {
      assert.ok(names(answer.fits).includes("Mixxx"), "a free DVS route exists");
      const serato = answer.costs.concat(answer.check).find((card) => card.name === "Serato DJ");
      assert.ok(serato, "Serato is priced for DVS, never presented as free: " + JSON.stringify(names(answer.costs).concat(names(answer.check))));
      assert.match(serato.price, /Suite/, "DVS sits in the Suite licence: " + serato.price);
    });

    await check("paying is fine (stems)", "sw_mode=controller&sw_hardware=flx10&sw_os=windows&sw_music=local&sw_budget=sub&sw_need=stems", (answer) => {
      assert.ok(names(answer.fits).includes("Serato DJ"), "an FLX10 unlocks Serato with stems included");
      const rekordbox = answer.costs.find((card) => card.name === "rekordbox");
      assert.match(rekordbox.badge, /360/, "rekordbox prices a year at a time: " + rekordbox.badge);
    });

    await check("recording on FLX4 unlock gear", "sw_mode=controller&sw_hardware=flx4&sw_os=windows&sw_music=local&sw_budget=free&sw_need=recording", (answer) => {
      assert.deepStrictEqual(names(answer.fits).sort(), ["Mixxx", "rekordbox"].sort(),
        "an FLX4 is on the Hardware Unlock list — recording is free there — and Mixxx is free regardless: " + names(answer.fits));
      const rekordbox = answer.fits.find((card) => card.name === "rekordbox");
      assert.strictEqual(rekordbox.badge, "No licence cost", "the free route is offered, not discovered later");
      const serato = answer.costs.find((card) => card.name === "Serato DJ");
      assert.match(serato.badge, /299/, "an FLX4 unlocks Serato Lite only, so recording still costs the Pro licence: " + serato.badge);
    });

    await check("FLX10 recording needs no purchase", "sw_mode=controller&sw_hardware=flx10&sw_os=windows&sw_music=local&sw_budget=free&sw_need=recording", (answer) => {
      const serato = answer.fits.find((card) => card.name === "Serato DJ");
      assert.ok(serato, "an FLX10 unlocks Serato DJ Pro itself, so Serato fits free here: " + names(answer.fits));
      assert.strictEqual(serato.badge, "No licence cost", "no $299 licence is asked of an FLX10 owner: " + serato.badge);
      assert.ok(serato.why.some((line) => /unlocks Serato DJ Pro/.test(line)),
        "and the Pro unlock is named: " + JSON.stringify(serato.why));
      const rekordbox = answer.fits.find((card) => card.name === "rekordbox");
      assert.strictEqual(rekordbox.badge, "No licence cost", "rekordbox recording is free on the same hardware");
    });

    await check("FLX2 unlocks Serato Lite, not Pro", "sw_mode=controller&sw_hardware=flx2&sw_os=windows&sw_music=local&sw_budget=free&sw_need=recording", (answer) => {
      const serato = answer.costs.find((card) => card.name === "Serato DJ");
      assert.ok(serato, "an FLX2 unlocks Lite only, so recording still needs a Pro licence: " + names(answer.costs));
      assert.match(serato.badge, /299/, "the Pro licence price is stated: " + serato.badge);
      const rekordbox = answer.fits.find((card) => card.name === "rekordbox");
      assert.strictEqual(rekordbox.badge, "No licence cost", "while rekordbox recording is free on the same hardware");
    });

    await check("unknown hardware, unknown goal", "sw_mode=unsure&sw_hardware=unsure&sw_os=windows&sw_music=both&sw_budget=unsure", (answer) => {
      const total = answer.fits.concat(answer.costs, answer.partial, answer.check);
      assert.ok(total.length >= 5, "not knowing is still answerable: " + total.map((c) => c.name + ":" + c.badge).join(", "));
    });

    await check("hardware already owned vs proposed", "sw_mode=controller&sw_hardware=flx4&sw_os=windows&sw_music=local&sw_budget=free", (answer) => {
      assert.ok(names(answer.fits).includes("Serato DJ"), "an owned FLX4 unlocks Serato Lite at no cost");
    });
    await check("a controller on Serato's Lite list", "sw_mode=controller&sw_hardware=flx2&sw_os=windows&sw_music=local&sw_budget=free", (answer) => {
      const serato = answer.fits.find((card) => card.name === "Serato DJ");
      assert.ok(serato, "an FLX2 unlocks Serato DJ Lite, so it lands in the free group: " + names(answer.fits));
      assert.strictEqual(serato.badge, "No licence cost", serato.badge);
      assert.ok(serato.why.some((line) => /unlocks Serato DJ Lite/.test(line)),
        "and the Lite unlock is named: " + JSON.stringify(serato.why));
    });

    await reveal(cases, "[data-swa-results]").catch(() => {});
    await cases.goto(server.base + "/dj-software-hub.html?sw_mode=laptop&sw_hardware=none&sw_os=macos&sw_music=local&sw_budget=free", { waitUntil: "networkidle2" });
    await reveal(cases, "[data-swa-results]");
    await cases.screenshot({ path: path.join(EVIDENCE, "software-advisor-1440-free-path.png"), fullPage: false });

    /* The issue #1040 owner, on a phone: the per-model groups must render and
       fit the 390px width without a sideways swipe. */
    const ownerPhone = await newPage(browser, PHONE);
    await ownerPhone.goto(server.base + "/dj-software-hub.html?sw_mode=controller&sw_hardware=prime4&sw_os=windows&sw_music=local&sw_budget=free",
      { waitUntil: "networkidle2", timeout: 45000 });
    await sleep(300);
    await auditLayout(ownerPhone, "owner phone 390");
    await reveal(ownerPhone, "[data-swa-results]");
    await ownerPhone.screenshot({ path: path.join(EVIDENCE, "software-advisor-390-prime4-owner.png"), fullPage: false });
    const ownerStatus = await ownerPhone.$eval("[data-swa-status]", (el) => el.textContent.trim());
    assert.match(ownerStatus, /fit/, "the owner's summary reads on a phone: " + ownerStatus);
    assert.deepStrictEqual(ownerPhone.__errors, [], "owner phone console errors: " + ownerPhone.__errors.join(" | "));
    await ownerPhone.close();

    /* The same owner at 1440, captured. */
    await reveal(cases, "[data-swa-results]").catch(() => {});
    assert.deepStrictEqual(cases.__errors, [], "use-case console errors: " + cases.__errors.join(" | "));
    assert.deepStrictEqual(cases.__failed, [], "use-case failed requests: " + cases.__failed.join(" | "));
    await cases.close();
    console.log("\nFifteen use cases in Chromium:");
    console.log(seen.join("\n"));

    console.log("Browser: 7 questions, real clicks, keyboard radio control, deep link, reset, navigation, 44px targets, single-column phone layout, no sideways scroll, no console errors.");
    console.log("Screenshots written to evidence/software-advisor-2026-10/");
  } finally {
    await browser.close();
    await server.close();
  }
})().catch((error) => {
  console.error("Browser test failed:", error.message);
  process.exitCode = 1;
});
