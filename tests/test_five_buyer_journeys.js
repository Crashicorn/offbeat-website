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

    // Bedroom starter has 4 items: FLX4 ($299), HD 25 ($149), DM-40D ($149), Existing phone ($0 owned)
    assert.strictEqual(starterCost.itemCount, 4, "Bedroom Starter preset has 4 items");
    assert.strictEqual(starterCost.buyTotal, 597, "Bedroom starter buy total is $597 ($299 + $149 + $149 + $0)");
    assert.strictEqual(starterCost.ownedTotal, 0, "Existing phone is zero purchase ($0)");

    // In-box cable check: DM-40D lead feeds FLX4's RCA master in reverse, so 0 cables bought
    assert.strictEqual(starterConnections.length, 1, "One speaker connection");
    assert.strictEqual(starterConnections[0].kind, "included", "Cable is included in monitor box");
    assert.strictEqual(starterConnections[0].units, 0, "Zero cable units bought");

    // Now test swapping to Numark MixTrack Go ($99):
    await page.goto(`${BASE_URL}/build-your-dj-setup.html?preset=bedroom-starter&add=numark-mixtrack-go`, { waitUntil: "networkidle0" });
    const mixtrackCost = await page.evaluate(() => window.__rigStudio.cost());
    const mixtrackConn = await page.evaluate(() => window.__rigStudio.connections());

    // MixTrack Go ($99) replaces FLX4 ($299): buyTotal drops by $200 ($597 - $200 = $397)
    assert.strictEqual(mixtrackCost.buyTotal, 397, "MixTrack Go bedroom rig costs $397 ($99 + $149 + $149 + $0)");
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
    // Level 3 (exact product destinations) & Level 4 (packaging, availability & compliance)
    // =========================================================================
    console.log("\n--- Testing Journey 5: Purchasing Exact Products, Packaging & Clean Retailers ---");
    await page.goto(`${BASE_URL}/build-your-dj-setup.html?preset=club-ready`, { waitUntil: "networkidle0" });

    const shopDetails = await page.evaluate(() => {
      const lines = [...document.querySelectorAll(".rs-shop-line")].map(line => {
        const name = line.querySelector(".rs-shop-line-name strong")?.textContent.trim();
        const price = line.querySelector(".rs-shop-line-price")?.textContent.trim();
        const packaging = line.querySelector(".rs-shop-line-packaging")?.textContent.trim();
        const stockAlert = line.querySelector(".rs-shop-line-stock")?.textContent.trim();
        const retailers = [...line.querySelectorAll(".btn-retail, .rs-retail")].map(r => ({
          text: r.textContent.trim(),
          href: r.getAttribute("href"),
          rel: r.getAttribute("rel"),
          destType: r.getAttribute("data-destination-type"),
          status: r.getAttribute("data-status"),
          sku: r.getAttribute("data-sku")
        }));
        const noLink = line.querySelector(".rs-shop-retailers--none")?.textContent.trim();
        return { name, price, packaging, stockAlert, retailers, noLink };
      });
      const buyTotal = document.querySelector(".rs-shop-head-total b")?.textContent.trim();
      const shopNote = document.querySelector(".rs-shop-note")?.textContent.trim();
      return { lines, buyTotal, shopNote };
    });

    assert.ok(shopDetails.lines.length >= 4, "Shopping list contains hardware and cable lines");

    // Level 3 proof: Exact SKU destinations for club-ready gear
    const flx10Line = shopDetails.lines.find(l => /DDJ-FLX10/i.test(l.name));
    assert.ok(flx10Line, "DDJ-FLX10 line present in club-ready shopping list");
    const flx10Zzounds = flx10Line.retailers.find(r => r.text === "zZounds");
    assert.ok(flx10Zzounds, "zZounds link present for DDJ-FLX10");
    assert.strictEqual(flx10Zzounds.href, "https://www.zzounds.com/item--PIODDJFLX10", "DDJ-FLX10 links to exact verified SKU page PIODDJFLX10");
    assert.strictEqual(flx10Zzounds.destType, "exact", "DDJ-FLX10 flagged with exact destination type");

    const hd25Line = shopDetails.lines.find(l => /HD 25/i.test(l.name));
    assert.ok(hd25Line, "HD 25 line present in shopping list");
    const hd25Zzounds = hd25Line.retailers.find(r => r.text === "zZounds");
    assert.ok(hd25Zzounds, "zZounds link present for HD 25");
    assert.strictEqual(hd25Zzounds.href, "https://www.zzounds.com/item--SENHD25", "HD 25 links to exact verified SKU page SENHD25");

    // Level 4 proof: Packaging requirements on monitors sold individually (Yamaha HS5)
    const hs5Line = shopDetails.lines.find(l => /HS5/i.test(l.name));
    assert.ok(hs5Line, "HS5 line present in shopping list");
    const hs5Zzounds = hs5Line.retailers.find(r => r.text === "zZounds");
    assert.ok(hs5Zzounds, "zZounds link present for HS5");
    assert.strictEqual(hs5Zzounds.href, "https://www.zzounds.com/item--YAMHS5", "HS5 links to exact verified SKU page YAMHS5");
    assert.ok(hs5Line.packaging, "HS5 line contains packaging notice");
    assert.ok(/Sold individually/i.test(hs5Line.packaging) && /Need 2 units for stereo pair/i.test(hs5Line.packaging),
      "HS5 packaging notice clarifies single unit pricing and stereo pair requirement");

    // Level 2 & affiliate compliance checks across all retailer buttons
    shopDetails.lines.forEach(line => {
      if (line.retailers.length) {
        line.retailers.forEach(r => {
          assert.ok(r.href.startsWith("https://"), `Retailer link is secure https: ${r.href}`);
          assert.ok(r.rel.includes("noopener"), `Retailer link includes noopener: ${r.rel}`);
          if (r.text.includes("Amazon")) {
            assert.ok(r.href.includes("tag=offbeatdj-20"), "Amazon link uses approved offbeatdj-20 affiliate tag");
            assert.ok(r.rel.includes("sponsored"), "Amazon sponsored rel present");
          }
          if (r.text.startsWith("zZounds")) {
            assert.ok(r.href.includes("zzounds.com/item--") || r.href.includes("zzounds.com/prodsearch"),
              `zZounds link targets exact product page or working prodsearch: ${r.href}`);
            assert.ok(r.rel.includes("sponsored"), "zZounds sponsored rel present");
          }
          if (r.text.includes("Sweetwater")) {
            assert.ok(r.href.includes("sweetwater.com/store/search"), "Sweetwater link targets search");
            assert.ok(!r.href.includes("tag=") && !r.href.includes("partner="), "Sweetwater does not invent unapproved affiliate tags");
          }
        });
      }
    });

    // Affiliate disclosure compliance: no stale prices labeled as live merchant quotes
    assert.ok(/planning estimates.*not real-time merchant quotes/i.test(shopDetails.shopNote),
      "Shopping note clearly separates Offbeat benchmark estimates from live merchant quotes");

    // Level 4 proof: Unavailable hardware listing & alternative routing (PRIME 4+)
    console.log("  * Testing Level 4 availability proof on discontinued PRIME 4+...");
    await page.goto(`${BASE_URL}/build-your-dj-setup.html?preset=mobile-pro`, { waitUntil: "networkidle0" });
    const prime4pShop = await page.evaluate(() => {
      const line = [...document.querySelectorAll(".rs-shop-line")].find(l => /Prime 4\+/i.test(l.textContent));
      if (!line) return null;
      const stockAlert = line.querySelector(".rs-shop-line-stock")?.textContent.trim();
      const retailers = [...line.querySelectorAll(".btn-retail, .rs-retail")].map(r => ({
        text: r.textContent.trim(),
        href: r.getAttribute("href"),
        status: r.getAttribute("data-status"),
        sku: r.getAttribute("data-sku")
      }));
      return { stockAlert, retailers };
    });

    assert.ok(prime4pShop, "PRIME 4+ line found in shopping list");
    assert.ok(/Discontinued \/ Out of stock at zZounds/i.test(prime4pShop.stockAlert),
      "Discontinued notice displayed on PRIME 4+ shopping line");
    assert.ok(/In-stock alternative: Denon DJ PRIME 4 G2/i.test(prime4pShop.stockAlert),
      "Alternative recommendation displayed on PRIME 4+ shopping line");

    const prime4pZzounds = prime4pShop.retailers.find(r => r.status === "verified_unavailable");
    assert.ok(prime4pZzounds, "Unavailable zZounds link present for PRIME 4+");
    assert.strictEqual(prime4pZzounds.href, "https://www.zzounds.com/item--DENPRIME4PLUS", "Discontinued page targeted");

    const prime4pAlt = prime4pShop.retailers.find(r => r.text.includes("PRIME 4 G2"));
    assert.ok(prime4pAlt, "Alternative link for PRIME 4 G2 present on shopping line");
    assert.strictEqual(prime4pAlt.href, "https://www.zzounds.com/item--DENPRIME4G2", "Alternative links directly to PRIME 4 G2 (DENPRIME4G2)");
    assert.strictEqual(prime4pAlt.status, "verified_in_stock", "Alternative flagged as in stock");

    // Level 3 verified SKUs proof across all major 2026 hardware models
    console.log("  * Verifying Level 3 exact catalog destinations for 2026 core hardware...");
    const verifiedHardwareSKUs = await page.evaluate(() => {
      const items = ["pioneer-ddj-flx4", "denon-prime-4-g2", "rane-system-one", "numark-mixtrack-go", "numark-party-mix-3", "alphatheta-xdj-az"];
      return items.map(id => {
        const item = window.__rigStudio.item(id);
        const dests = window.OffbeatGear.itemRetailerDestinations(item);
        return { id, sku: dests?.zzounds?.sku, url: dests?.zzounds?.url, status: dests?.zzounds?.status };
      });
    });

    const expectedSKUs = {
      "pioneer-ddj-flx4": "PIODDJFLX4",
      "denon-prime-4-g2": "DENPRIME4G2",
      "rane-system-one": "RNESYSTEMONE",
      "numark-mixtrack-go": "NUMMIXTRACKGO",
      "numark-party-mix-3": "NUMPARTYMIXIII",
      "alphatheta-xdj-az": "APTXDJAZ"
    };

    verifiedHardwareSKUs.forEach(hw => {
      assert.strictEqual(hw.sku, expectedSKUs[hw.id], `Hardware ${hw.id} has exact SKU ${expectedSKUs[hw.id]}`);
      assert.strictEqual(hw.url, `https://www.zzounds.com/item--${expectedSKUs[hw.id]}`, `Hardware ${hw.id} URL is exact`);
      assert.strictEqual(hw.status, "verified_in_stock", `Hardware ${hw.id} status is verified_in_stock`);
    });

    console.log("✓ Journey 5 passed: Level 3 exact destinations, Level 4 packaging & availability routing, and clean retailer disclosures verified.");

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
