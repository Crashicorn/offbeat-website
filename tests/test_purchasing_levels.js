// Test suite: Level 1–4 Purchasing Validation
// Covers:
// Level 1: Syntax & Link Hygiene (noopener, https, approved affiliate tags)
// Level 2: Search Fallbacks & Clean Terms (prodsearch endpoint, URI encoding)
// Level 3: Exact SKU Product Destinations (verified item-- pages, data attributes)
// Level 4: Packaging, Stock Status, Availability & Merchant Compliance

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
let puppeteer;
try {
  puppeteer = require(process.env.PUPPETEER_CORE || "puppeteer-core");
} catch (e) {
  puppeteer = require("/tmp/browser/node_modules/puppeteer-core");
}

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:8080";
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || "/usr/local/bin/chromium";
const EVIDENCE_DIR = path.resolve(__dirname, "../evidence/purchasing-levels-20261028");

(async () => {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

  console.log("================================================================");
  console.log("STARTING PURCHASING INTEGRATION VALIDATION (LEVELS 1 - 4)");
  console.log("================================================================");

  // -------------------------------------------------------------------------
  // Part 1: Catalog Structure and Integrity (Levels 1 - 4 in data layer)
  // -------------------------------------------------------------------------
  console.log("\n--- Validating Data Layer (assets/dj-gear-catalog.json) ---");
  const catalogPath = path.resolve(__dirname, "../assets/dj-gear-catalog.json");
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf-8"));

  assert.ok(catalog.meta, "Catalog has meta section");
  assert.ok(catalog.meta.disclosure, "Catalog has meta disclosure statement");
  assert.ok(/planning estimates.*not real-time merchant quotes/i.test(catalog.meta.disclosure),
    "Catalog pricing disclosure separates estimates from merchant quotes");

  const catalogItems = catalog.items || [];
  assert.ok(catalogItems.length >= 35, `Catalog has ${catalogItems.length} items`);

  let exactDestinationsCount = 0;
  let packagingGuidanceCount = 0;
  let unavailableAlertsCount = 0;

  catalogItems.forEach(item => {
    const dests = item.retailer_destinations;
    if (dests && dests.zzounds) {
      const zz = dests.zzounds;
      assert.ok(zz.url.startsWith("https://www.zzounds.com/"), `zZounds URL is HTTPS: ${zz.url}`);
      assert.ok(!zz.url.includes("itemsearch"), `No deprecated itemsearch links: ${zz.url}`);

      if (zz.type === "exact") {
        exactDestinationsCount++;
        assert.ok(zz.sku, `Exact destination item ${item.id} has sku`);
        assert.ok(zz.url.includes(`item--${zz.sku}`), `Exact URL contains item--${zz.sku}`);
        assert.ok(["verified_in_stock", "verified_unavailable"].includes(zz.status),
          `Status is verified: ${zz.status}`);
        if (zz.status === "verified_unavailable") {
          unavailableAlertsCount++;
          assert.ok(zz.availability_note || zz.note, `Unavailable item ${item.id} has note`);
        }
      } else if (zz.type === "search") {
        assert.ok(zz.url.includes("prodsearch?q="), `Search fallback uses prodsearch endpoint: ${zz.url}`);
      }

      if (zz.sold_as) {
        packagingGuidanceCount++;
        assert.ok(["unit", "pair", "single"].includes(zz.sold_as), `sold_as is unit, pair, or single`);
      }
    }
  });

  console.log(`✓ Data layer verified: ${exactDestinationsCount} exact destinations, ${unavailableAlertsCount} unavailable stock alerts, ${packagingGuidanceCount} packaging specifications.`);

  console.log(`✓ Data layer verified: ${exactDestinationsCount} exact destinations, ${unavailableAlertsCount} unavailable stock alerts, ${packagingGuidanceCount} speaker packaging specifications.`);

  // -------------------------------------------------------------------------
  // Launch Chromium Browser
  // -------------------------------------------------------------------------
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("pageerror", err => consoleErrors.push(err.message));
  page.on("console", msg => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  try {
    // -----------------------------------------------------------------------
    // Part 2: Rig Studio - Club Ready Preset (Levels 1, 3, 4)
    // -----------------------------------------------------------------------
    console.log("\n--- Testing Rig Studio Club-Ready Preset ---");
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto(`${BASE_URL}/build-your-dj-setup.html?preset=club-ready`, { waitUntil: "networkidle0" });

    // Scroll to shopping list
    await page.evaluate(() => {
      const el = document.getElementById("rs-shop");
      if (el) el.scrollIntoView();
    });

    const clubReadyData = await page.evaluate(() => {
      const lines = [...document.querySelectorAll(".rs-shop-line")].map(line => {
        const name = line.querySelector(".rs-shop-line-name strong")?.textContent.trim();
        const price = line.querySelector(".rs-shop-line-price")?.textContent.trim();
        const packaging = line.querySelector(".rs-shop-line-packaging")?.textContent.trim();
        const retailers = [...line.querySelectorAll(".btn-retail, .rs-retail")].map(r => ({
          text: r.textContent.trim(),
          href: r.getAttribute("href"),
          rel: r.getAttribute("rel"),
          destType: r.getAttribute("data-destination-type"),
          status: r.getAttribute("data-status"),
          sku: r.getAttribute("data-sku")
        }));
        return { name, price, packaging, retailers };
      });
      const note = document.querySelector(".rs-shop-note")?.textContent.trim();
      const headTotal = document.querySelector(".rs-shop-head-total")?.textContent.trim();
      return { lines, note, headTotal };
    });

    assert.ok(clubReadyData.lines.length >= 4, "Club-ready shopping lines present");

    // Level 1: Link hygiene & Affiliate Compliance
    clubReadyData.lines.forEach(line => {
      line.retailers.forEach(r => {
        assert.ok(r.href.startsWith("https://"), `Link is HTTPS: ${r.href}`);
        assert.ok(r.rel.includes("noopener"), `Link contains noopener: ${r.rel}`);
        if (r.text.includes("Amazon")) {
          assert.ok(r.href.includes("tag=offbeatdj-20"), "Amazon has approved tag");
          assert.ok(r.rel.includes("sponsored"), "Amazon has sponsored rel");
        }
        if (r.text.startsWith("zZounds")) {
          assert.ok(!r.href.includes("itemsearch"), "zZounds does not use broken itemsearch");
          assert.ok(r.rel.includes("sponsored"), "zZounds has sponsored rel");
        }
        if (r.text.includes("Sweetwater")) {
          assert.ok(!r.href.includes("tag=") && !r.href.includes("partner="), "Sweetwater has no invented affiliate tag");
        }
      });
    });

    // Level 3: Exact SKU check for DDJ-FLX10 and HD 25
    const flx10 = clubReadyData.lines.find(l => /FLX10/i.test(l.name));
    assert.ok(flx10, "FLX10 line exists");
    const flx10Zz = flx10.retailers.find(r => r.text === "zZounds");
    assert.strictEqual(flx10Zz.destType, "exact");
    assert.strictEqual(flx10Zz.sku, "PIODDJFLX10");
    assert.strictEqual(flx10Zz.href, "https://www.zzounds.com/item--PIODDJFLX10");

    const hd25 = clubReadyData.lines.find(l => /HD 25/i.test(l.name));
    assert.ok(hd25, "HD 25 line exists");
    const hd25Zz = hd25.retailers.find(r => r.text === "zZounds");
    assert.strictEqual(hd25Zz.destType, "exact");
    assert.strictEqual(hd25Zz.sku, "SENHD25");

    // Level 4: Monitor packaging notice for Yamaha HS5
    const hs5 = clubReadyData.lines.find(l => /HS5/i.test(l.name));
    assert.ok(hs5, "HS5 line exists");
    assert.ok(hs5.packaging, "HS5 line has packaging notice");
    assert.ok(/Sold individually.*need 2.*stereo pair/i.test(hs5.packaging),
      "HS5 warns about individual sale and stereo pair requirement");

    // Affiliate truth-in-pricing disclosure
    assert.ok(/planning estimates.*not real-time merchant quotes/i.test(clubReadyData.note),
      "Shopping note includes truth-in-pricing disclosure");
    assert.ok(/To buy \(est\.\)/i.test(clubReadyData.headTotal),
      "Header total labels budget as estimate");

    const footTotal = await page.evaluate(() => document.querySelector(".rs-shop-foot")?.textContent.trim());
    assert.ok(/Offbeat benchmark total/i.test(footTotal), "Foot total labels benchmark");

    await page.screenshot({ path: path.join(EVIDENCE_DIR, "01-club-ready-purchasing.png"), fullPage: false });
    console.log("✓ Club-Ready preset Level 1, 3, 4 purchasing checks verified.");

    // -----------------------------------------------------------------------
    // Part 3: Rig Studio - Mobile Pro Preset (Level 4 Stock & Alternatives)
    // -----------------------------------------------------------------------
    console.log("\n--- Testing Rig Studio Mobile-Pro Preset (Discontinued & Packaging) ---");
    await page.goto(`${BASE_URL}/build-your-dj-setup.html?preset=mobile-pro`, { waitUntil: "networkidle0" });

    await page.evaluate(() => {
      const el = document.getElementById("rs-shop");
      if (el) el.scrollIntoView();
    });

    const mobileData = await page.evaluate(() => {
      const lines = [...document.querySelectorAll(".rs-shop-line")].map(line => {
        const name = line.querySelector(".rs-shop-line-name strong")?.textContent.trim();
        const stockAlert = line.querySelector(".rs-shop-line-stock")?.textContent.trim();
        const packaging = line.querySelector(".rs-shop-line-packaging")?.textContent.trim();
        const retailers = [...line.querySelectorAll(".btn-retail, .rs-retail")].map(r => ({
          text: r.textContent.trim(),
          href: r.getAttribute("href"),
          status: r.getAttribute("data-status"),
          sku: r.getAttribute("data-sku")
        }));
        return { name, stockAlert, packaging, retailers };
      });
      return lines;
    });

    // Level 4: Discontinued notice and alternative link for PRIME 4+
    const prime4Line = mobileData.find(l => /Prime 4\+/i.test(l.name));
    assert.ok(prime4Line, "Prime 4+ line found in Mobile Pro preset");
    assert.ok(/Discontinued \/ Out of stock at zZounds/i.test(prime4Line.stockAlert),
      "Prime 4+ has discontinued notice");
    assert.ok(/In-stock alternative: Denon DJ PRIME 4 G2/i.test(prime4Line.stockAlert),
      "Prime 4+ recommends PRIME 4 G2 alternative");

    const prime4pZz = prime4Line.retailers.find(r => r.status === "verified_unavailable");
    assert.ok(prime4pZz, "Discontinued link present");
    assert.strictEqual(prime4pZz.href, "https://www.zzounds.com/item--DENPRIME4PLUS");

    const prime4g2Alt = prime4Line.retailers.find(r => r.text.includes("PRIME 4 G2"));
    assert.ok(prime4g2Alt, "PRIME 4 G2 alternative button present");
    assert.strictEqual(prime4g2Alt.href, "https://www.zzounds.com/item--DENPRIME4G2");
    assert.strictEqual(prime4g2Alt.status, "verified_in_stock");
    assert.strictEqual(prime4g2Alt.sku, "DENPRIME4G2");

    // Level 4: Single PA speaker packaging for JBL EON715
    const eonLine = mobileData.find(l => /EON715/i.test(l.name));
    assert.ok(eonLine, "JBL EON715 line found");
    assert.ok(/Sold as single powered PA cabinet/i.test(eonLine.packaging),
      "JBL EON715 has single unit PA speaker packaging badge");

    // Level 3: Shure SM58 exact listing
    const sm58Line = mobileData.find(l => /SM58/i.test(l.name));
    assert.ok(sm58Line, "Shure SM58 line found");
    const sm58Zz = sm58Line.retailers.find(r => r.text === "zZounds");
    assert.strictEqual(sm58Zz.sku, "SHUSM58");
    assert.strictEqual(sm58Zz.href, "https://www.zzounds.com/item--SHUSM58");

    await page.screenshot({ path: path.join(EVIDENCE_DIR, "02-mobile-pro-stock-alert.png"), fullPage: false });
    console.log("✓ Mobile-Pro preset stock alert, alternative routing, and single PA packaging verified.");

    // -----------------------------------------------------------------------
    // Part 4: Rig Studio - Bedroom Starter (Pair Packaging)
    // -----------------------------------------------------------------------
    console.log("\n--- Testing Rig Studio Bedroom-Starter Preset (Stereo Pair Packaging) ---");
    await page.goto(`${BASE_URL}/build-your-dj-setup.html?preset=bedroom-starter`, { waitUntil: "networkidle0" });

    const starterDm40d = await page.evaluate(() => {
      const line = [...document.querySelectorAll(".rs-shop-line")].find(l => /DM-40D/i.test(l.textContent));
      if (!line) return null;
      const packaging = line.querySelector(".rs-shop-line-packaging")?.textContent.trim();
      const zZounds = line.querySelector(".btn-retail[data-sku='PIODM40D'], .rs-retail[data-sku='PIODM40D']")?.getAttribute("href");
      return { packaging, zZounds };
    });

    assert.ok(starterDm40d, "DM-40D line found");
    assert.ok(/Sold as complete pair in one retail box/i.test(starterDm40d.packaging),
      "DM-40D explicitly states sold as complete pair in one retail box");
    assert.strictEqual(starterDm40d.zZounds, "https://www.zzounds.com/item--PIODM40D");

    console.log("✓ Bedroom-Starter preset stereo pair packaging verified.");

    // -----------------------------------------------------------------------
    // Part 5: Buying Guides Links & Disclosures
    // -----------------------------------------------------------------------
    console.log("\n--- Testing Standalone Hardware Buying Guides ---");
    const guidePages = [
      {
        url: "xdj-az-vs-denon-prime-4-plus.html",
        expectedLinks: [
          "https://www.zzounds.com/item--APTXDJAZ",
          "https://www.zzounds.com/item--DENPRIME4G2",
          "https://www.zzounds.com/item--DENPRIME4PLUS"
        ]
      },
      {
        url: "best-standalone-dj-systems.html",
        expectedLinks: [
          "https://www.zzounds.com/item--APTXDJAZ",
          "https://www.zzounds.com/item--DENPRIME4G2",
          "https://www.zzounds.com/item--RNESYSTEMONE"
        ]
      },
      {
        url: "denon-sc6000-review.html",
        expectedLinks: [
          "https://www.zzounds.com/item--DENSC6000PRIME"
        ]
      }
    ];

    for (const guide of guidePages) {
      await page.goto(`${BASE_URL}/${guide.url}`, { waitUntil: "networkidle0" });
      const links = await page.evaluate(() => {
        return [...document.querySelectorAll("a[href]")].map(a => a.getAttribute("href"));
      });

      // No deprecated itemsearch links anywhere
      const brokenSearch = links.filter(l => l.includes("zzounds.com/itemsearch"));
      assert.strictEqual(brokenSearch.length, 0, `No broken zzounds itemsearch links in ${guide.url}`);

      // All expected exact links present
      guide.expectedLinks.forEach(expected => {
        assert.ok(links.some(l => l.includes(expected)),
          `Guide ${guide.url} contains verified link ${expected}`);
      });
      await page.screenshot({ path: path.join(EVIDENCE_DIR, `03-guide-${guide.url.replace('.html', '')}.png`), fullPage: false });
      console.log(`  ✓ ${guide.url} verified with exact links and 0 broken searches.`);
    }

    // -----------------------------------------------------------------------
    // Part 6: Rig Builder Render Engine Unit Check
    // -----------------------------------------------------------------------
    console.log("\n--- Testing Rig Builder Markup Generator ---");
    const vm = require("node:vm");
    const rigBuilderSrc = fs.readFileSync(path.resolve(__dirname, "../assets/rig-builder.js"), "utf8");
    const gearConnectionsSrc = fs.readFileSync(path.resolve(__dirname, "../assets/gear-connections.js"), "utf8");

    const mockWindow = {
      localStorage: { getItem() { return null; }, setItem() {} },
      location: { pathname: "/build-your-dj-setup.html", search: "" },
      history: { replaceState() {} },
      document: { getElementById() { return {}; }, readyState: "loading", addEventListener() {} }
    };
    const mockContext = {
      window: mockWindow,
      document: mockWindow.document,
      URLSearchParams,
      console,
      atob,
      btoa
    };
    vm.runInNewContext(gearConnectionsSrc, mockContext);

    // Test renderSlotRow via regex inspection or injected evaluation
    const slotRowMatch = rigBuilderSrc.match(/<a href="\$\{zzoundsUrl\}" target="_blank" rel="nofollow noopener sponsored" class="btn-retail btn-retail--zz"/);
    assert.ok(slotRowMatch, "Rig builder template contains verified zZounds button with sponsored rel");

    const swRowMatch = rigBuilderSrc.match(/<a href="\$\{sweetwaterUrl\}" target="_blank" rel="nofollow noopener" class="btn-retail btn-retail--sw"/);
    assert.ok(swRowMatch, "Sweetwater link omits invalid sponsored tag");

    const destCallMatch = rigBuilderSrc.match(/OffbeatGear\.itemRetailerDestinations/);
    assert.ok(destCallMatch, "Rig builder queries OffbeatGear.itemRetailerDestinations for exact SKUs");

    console.log("✓ Rig Builder markup generation verified for zZounds destinations and clean Sweetwater rel attributes.");

    assert.strictEqual(consoleErrors.length, 0, `No console errors: ${consoleErrors.join("; ")}`);
    console.log("\n================================================================");
    console.log("ALL PURCHASING LEVEL 1-4 VERIFICATION CHECKS PASSED (100%)!");
    console.log("================================================================");

  } finally {
    await page.close();
    await browser.close();
  }
})().catch(err => {
  console.error("Purchasing verification failed:", err);
  process.exit(1);
});
