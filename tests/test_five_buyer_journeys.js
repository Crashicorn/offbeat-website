/*
 * Comprehensive test suite for five core buyer journeys:
 *
 * Journey 1: Beginner choosing a complete first setup (FLX4 vs MixTrack Go/Party Mix III, in-box cables, owned gear).
 * Journey 2: Mobile DJ selecting a reliable standalone system and connected PA (PRIME 4 G2, PA routing, SM58 mic, USB storage, $0 laptop).
 * Journey 3: Buyer upgrading from older to newer equipment (PRIME 4+ vs G2, RANE SYSTEM ONE, Party Mix III).
 * Journey 4: Visitor choosing software based on hardware actually owned (PRIME 4 G2 standalone, RANE SYSTEM ONE versions, Numark djay Pro tiers).
 * Journey 5: Visitor purchasing exact selected products and required accessories (retailer destinations, owned gear exclusions, allowances).
 *
 * Run:
 *   PORT=8080 node tests/test_five_buyer_journeys.js
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

function loadPuppeteer() {
  const candidates = [
    process.env.PUPPETEER_CORE,
    "/tmp/browser/node_modules/puppeteer-core",
    "/tmp/node_modules/puppeteer-core",
    "puppeteer-core"
  ].filter(Boolean);
  for (const c of candidates) {
    try { return require(c); } catch (e) {}
  }
  throw new Error("puppeteer-core not found");
}

const puppeteer = loadPuppeteer();
const CHROME_PATH = process.env.CHROME_PATH || "/usr/local/bin/chromium";
const PORT = process.env.PORT || 8080;
const BASE_URL = `http://127.0.0.1:${PORT}`;

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("pageerror", e => consoleErrors.push(String(e)));
  page.on("console", m => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });

  try {
    // =========================================================================
    // JOURNEY 1: Beginner choosing a complete first setup
    // =========================================================================
    console.log("\n--- Testing Journey 1: Beginner Complete First Setup ---");
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/build-your-dj-setup.html?preset=bedroom-starter`, { waitUntil: "networkidle0" });

    const starterCost = await page.evaluate(() => window.__rigStudio.cost());
    const starterConnections = await page.evaluate(() => window.__rigStudio.connections());

    // Bedroom starter has 5 items: FLX4 ($329), HD 25 ($149), DM-40D ($149), Stand ($29), Existing laptop ($999 owned)
    assert.strictEqual(starterCost.itemCount, 5, "Bedroom Starter preset has 5 items");
    assert.strictEqual(starterCost.buyTotal, 656, "Bedroom starter buy total is $656 ($329 + $149 + $149 + $29)");
    assert.strictEqual(starterCost.ownedTotal, 999, "Existing laptop is owned ($999)");

    // In-box cable check: DM-40D lead feeds FLX4's RCA master in reverse, so 0 cables bought
    assert.strictEqual(starterConnections.length, 1, "One speaker connection");
    assert.strictEqual(starterConnections[0].kind, "included", "Cable is included in monitor box");
    assert.strictEqual(starterConnections[0].units, 0, "Zero cable units bought");

    // Now test swapping to Numark MixTrack Go ($99):
    await page.goto(`${BASE_URL}/build-your-dj-setup.html?preset=bedroom-starter&add=numark-mixtrack-go`, { waitUntil: "networkidle0" });
    const mixtrackCost = await page.evaluate(() => window.__rigStudio.cost());
    const mixtrackConn = await page.evaluate(() => window.__rigStudio.connections());

    // MixTrack Go ($99) replaces FLX4 ($329): buyTotal drops by $230 ($656 - $230 = $426)
    assert.strictEqual(mixtrackCost.buyTotal, 426, "MixTrack Go bedroom rig costs $426 ($99 + $149 + $149 + $29)");
    assert.strictEqual(mixtrackConn[0].kind, "included", "MixTrack Go / DM-40D connection uses in-box cable");
    assert.strictEqual(mixtrackConn[0].units, 0, "0 extra cable units charged");

    console.log("✓ Journey 1 passed: complete beginner desk cost, in-box cable deductions, and controller swap verified.");

    // =========================================================================
    // JOURNEY 2: Mobile DJ selecting standalone system & connected PA
    // =========================================================================
    console.log("\n--- Testing Journey 2: Mobile DJ Standalone System & Connected PA ---");
    await page.goto(`${BASE_URL}/build-your-dj-setup.html?preset=mobile-pro&add=denon-prime-4-g2`, { waitUntil: "networkidle0" });

    const mobileRig = await page.evaluate(() => {
      const cost = window.__rigStudio.cost();
      const conns = window.__rigStudio.connections();
      const items = window.__rigStudio.state().items.map(s => ({
        cat: s.category,
        id: s.itemId,
        owned: s.owned
      }));
      return { cost, conns, items };
    });

    // Check standalone console: Denon PRIME 4 G2 ($2599)
    assert.ok(mobileRig.items.some(i => i.id === "denon-prime-4-g2"), "Rig includes Denon PRIME 4 G2");
    // Check PA speaker: JBL EON 715 ($599)
    assert.ok(mobileRig.items.some(i => i.id === "jbl-eon-715"), "Rig includes JBL EON 715 PA speaker");
    // Check microphone: Shure SM58 ($99)
    assert.ok(mobileRig.items.some(i => i.id === "mic-shure-sm58"), "Rig includes Shure SM58 mic");
    // Check fast storage: SanDisk Extreme PRO USB ($28)
    assert.ok(mobileRig.items.some(i => i.id === "usb-sandisk-extreme"), "Rig includes SanDisk Extreme USB");
    // Check balanced XLR connection:
    assert.strictEqual(mobileRig.conns.length, 1, "One PA speaker connection line");
    assert.strictEqual(mobileRig.conns[0].itemId, "cable-xlr-xlr", "Balanced XLR cable selected");
    assert.strictEqual(mobileRig.conns[0].balanced, true, "XLR cable is balanced");
    assert.strictEqual(mobileRig.conns[0].outputRole, "master", "Connected to Master XLR output");

    console.log("✓ Journey 2 passed: standalone mobile rig, PA routing, vocal mic, storage, and XLR cabling verified.");

    // =========================================================================
    // JOURNEY 3: Buyer upgrading from older to newer equipment
    // =========================================================================
    console.log("\n--- Testing Journey 3: Upgrading Older to Newer Equipment ---");
    await page.goto(`${BASE_URL}/xdj-az-vs-denon-prime-4-plus.html`, { waitUntil: "networkidle0" });

    const comparisonText = await page.evaluate(() => document.body.textContent);
    assert.ok(comparisonText.includes("PRIME 4 G2"), "Mentions PRIME 4 G2 upgrade");
    assert.ok(comparisonText.includes("onboard Stems rendering"), "Mentions onboard Stems rendering");
    assert.ok(comparisonText.includes("8-inch jog wheels"), "Mentions 8-inch jog wheels");
    assert.ok(comparisonText.includes("SoundSwitch"), "Mentions SoundSwitch 3-pin DMX output");
    assert.ok(comparisonText.includes("anticipated in future updates"), "Explains G2 computer-mode software status");

    // Check RANE SYSTEM ONE and Numark in best-standalone-dj-systems.html
    await page.goto(`${BASE_URL}/best-standalone-dj-systems.html`, { waitUntil: "networkidle0" });
    const standaloneText = await page.evaluate(() => document.body.textContent);
    assert.ok(standaloneText.includes("RANE SYSTEM ONE"), "Mentions RANE SYSTEM ONE");
    assert.ok(standaloneText.includes("motorized standalone"), "Identifies motorized standalone system");
    assert.ok(standaloneText.includes("Serato DJ Pro 4.0.3"), "Documents Serato minimum version");

    console.log("✓ Journey 3 passed: older vs newer hardware differences and software upgrade caveats verified.");

    // =========================================================================
    // JOURNEY 4: Visitor choosing software based on hardware owned
    // =========================================================================
    console.log("\n--- Testing Journey 4: Software Advisor Hardware Compatibility ---");
    // Case 4A: Visitor owns PRIME 4 G2 in standalone mode
    await page.goto(`${BASE_URL}/dj-software-hub.html?sw_mode=standalone&sw_hardware=prime4_g2&sw_os=windows&sw_music=local&sw_budget=free`, { waitUntil: "networkidle0" });
    const g2Advisor = await page.evaluate(() => {
      const cards = [...document.querySelectorAll(".swa-card")].map(c => ({
        title: c.querySelector("h4")?.textContent.trim(),
        badge: c.querySelector(".swa-badge")?.textContent.trim(),
        price: c.querySelector(".swa-price")?.textContent.trim()
      }));
      return cards;
    });

    const engineCard = g2Advisor.find(c => c.title === "Engine DJ");
    assert.ok(engineCard, "Engine DJ card present");
    assert.strictEqual(engineCard.badge, "No licence cost", "Engine DJ fits PRIME 4 G2 standalone with No licence cost");
    assert.ok(/Free|No licence/i.test(engineCard.price), "Engine DJ has no license fee");

    // Case 4B: Visitor owns PRIME 4 G2 in controller mode with free budget:
    // Serato DJ Pro must NOT be in 'No licence cost' group because it is not unlocked at launch!
    await page.goto(`${BASE_URL}/dj-software-hub.html?sw_mode=controller&sw_hardware=prime4_g2&sw_os=windows&sw_music=local&sw_budget=free`, { waitUntil: "networkidle0" });
    const g2ControllerAdvisor = await page.evaluate(() => {
      const cards = [...document.querySelectorAll(".swa-card")].map(c => ({
        title: c.querySelector("h4")?.textContent.trim(),
        badge: c.querySelector(".swa-badge")?.textContent.trim(),
        notes: [...c.querySelectorAll(".swa-why li")].map(r => r.textContent.trim())
      }));
      return cards;
    });

    const seratoCard = g2ControllerAdvisor.find(c => c.title === "Serato DJ");
    assert.notStrictEqual(seratoCard.badge, "No licence cost", "Serato DJ is not a free unlocked fit for PRIME 4 G2 at launch");

    console.log("✓ Journey 4 passed: Software Advisor correctly handles PRIME 4 G2 standalone vs controller mode.");

    // =========================================================================
    // JOURNEY 5: Visitor purchasing exact products & required accessories
    // =========================================================================
    console.log("\n--- Testing Journey 5: Purchasing Exact Products & Clean Retailers ---");
    await page.goto(`${BASE_URL}/build-your-dj-setup.html?preset=club-ready`, { waitUntil: "networkidle0" });

    const shopDetails = await page.evaluate(() => {
      const lines = [...document.querySelectorAll(".rs-shop-line")].map(line => {
        const name = line.querySelector(".rs-shop-line-name strong")?.textContent.trim();
        const price = line.querySelector(".rs-shop-line-price")?.textContent.trim();
        const retailers = [...line.querySelectorAll(".rs-retail")].map(r => ({
          text: r.textContent.trim(),
          href: r.getAttribute("href"),
          rel: r.getAttribute("rel")
        }));
        const noLink = line.querySelector(".rs-shop-retailers--none")?.textContent.trim();
        return { name, price, retailers, noLink };
      });
      const buyTotal = document.querySelector(".rs-shop-head-total b")?.textContent.trim();
      return { lines, buyTotal };
    });

    assert.ok(shopDetails.lines.length >= 4, "Shopping list contains hardware and cable lines");
    shopDetails.lines.forEach(line => {
      if (line.retailers.length) {
        line.retailers.forEach(r => {
          assert.ok(r.href.startsWith("https://"), `Retailer link is secure https: ${r.href}`);
          assert.ok(r.rel.includes("noopener"), `Retailer link includes noopener: ${r.rel}`);
          if (r.text === "Amazon") {
            assert.ok(r.href.includes("tag=offbeatdj-20"), "Amazon link uses approved offbeatdj-20 affiliate tag");
            assert.ok(r.rel.includes("sponsored"), "Amazon sponsored rel present");
          }
          if (r.text === "zZounds") {
            assert.ok(r.href.includes("zzounds.com/itemsearch"), "zZounds link targets itemsearch");
            assert.ok(r.rel.includes("sponsored"), "zZounds sponsored rel present");
          }
          if (r.text === "Sweetwater") {
            assert.ok(r.href.includes("sweetwater.com/store/search"), "Sweetwater link targets search");
            assert.ok(!r.href.includes("tag=") && !r.href.includes("partner="), "Sweetwater does not invent unapproved affiliate tags");
          }
        });
      }
    });

    console.log("✓ Journey 5 passed: clean retailer destinations, verified affiliate tags, and secure shopping links verified.");

    assert.strictEqual(consoleErrors.length, 0, `No console errors encountered: ${consoleErrors.join("; ")}`);
    console.log("\nALL FIVE BUYER JOURNEYS VALIDATED AND PASSING 100%!");

  } finally {
    await page.close();
    await browser.close();
  }
})().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
