/**
 * test_integrated_release.js
 *
 * Integrated end-to-end browser test for the unified Offbeat release:
 * - PR #12 (interactive software advisor)
 * - PR #13 (corrected standalone hardware guides)
 * - PR #14 (restored licensed editorial photography)
 *
 * Runs real headless Chromium at Desktop (1440px) and Mobile (390px).
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const ROOT = path.resolve(__dirname, "..");
const EVIDENCE_DIR = path.join(ROOT, "evidence", "integrated-testing-20261028");
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

function loadPuppeteer() {
  const candidates = [
    process.env.PUPPETEER_CORE,
    "/tmp/browser/node_modules/puppeteer-core",
    "/tmp/node_modules/puppeteer-core",
    "puppeteer-core"
  ].filter(Boolean);
  for (const candidate of candidates) {
    try { return require(candidate); } catch (e) {}
  }
  throw new Error("puppeteer-core not found");
}

const puppeteer = loadPuppeteer();
const CHROME_PATH = process.env.CHROME_PATH || "/usr/local/bin/chromium";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2"
};

function startServer(port = 8990) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let parsed = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
      let reqPath = decodeURIComponent(parsed.pathname);
      if (reqPath === "/") reqPath = "/index.html";
      const filePath = path.join(ROOT, reqPath);

      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("404 Not Found");
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      fs.createReadStream(filePath).pipe(res);
    });

    server.listen(port, "127.0.0.1", () => {
      resolve({
        port,
        base: `http://127.0.0.1:${port}`,
        close: () => new Promise(r => server.close(r))
      });
    });
    server.on("error", reject);
  });
}

const PAGES_TO_TEST = [
  // Standalone Hardware Guides (PR #13)
  {
    file: "denon-sc6000-review.html",
    title: "Denon SC6000 Prime Review",
    type: "hardware",
    asserts: (facts, text) => {
      assert.match(text, /separate mixer/i, "SC6000 must state it requires a separate mixer");
      assert.match(text, /does not itself unlock Serato DJ Pro/i, "SC6000 must state it is an accessory, not a standalone unlock");
      assert.match(text, /three USB-A drive ports/i, "SC6000 must specify 3 USB-A ports");
      assert.doesNotMatch(text, /12\.1|Engine DJ Pro|0% skipping|~\$1,799|7\.2 lbs/, "Erronous specs must not appear");
    }
  },
  {
    file: "denon-prime-go-review.html",
    title: "Denon Prime GO Review",
    type: "hardware",
    asserts: (facts, text) => {
      assert.match(text, /Apple Music and Amazon Music Unlimited are listed for GO\+, not original GO/i, "GO vs GO+ streaming difference must be stated");
    }
  },
  {
    file: "xdj-az-vs-denon-prime-4-plus.html",
    title: "XDJ-AZ vs Denon PRIME 4+",
    type: "hardware",
    asserts: (facts, text) => {
      assert.match(text, /PRIME 4\+ has XLR booth outputs/i, "PRIME 4+ XLR booth vs AZ TRS must be noted");
      assert.match(text, /Spotify StreamingDirectPlay/i, "XDJ-AZ must explicitly mention confirmed Spotify StreamingDirectPlay");
      assert.match(text, /Spotify Premium/i, "Must specify Spotify Premium requirement");
      assert.doesNotMatch(text, /Spotify availability and its minimum firmware remain uncertain here/i, "Uncertainty claim must be removed");
    }
  },
  {
    file: "best-standalone-dj-systems.html",
    title: "Best Standalone DJ Systems",
    type: "hardware",
    asserts: (facts, text) => {
      assert.match(text, /Engine DJ/i, "Engine DJ standalone ecosystem must be covered");
      assert.match(text, /Spotify StreamingDirectPlay/i, "Best Standalone must explicitly mention confirmed Spotify StreamingDirectPlay");
      assert.doesNotMatch(text, /confirm Spotify availability and firmware with AlphaTheta/i, "Uncertainty claim must be removed");
    }
  },
  // Editorial Photography Restoration (PR #14)
  {
    file: "dj-laptop-setup-guide.html",
    title: "How to Set Up a DJ Laptop",
    type: "photography",
    heroImage: "pexels-dj-laptop-mixing-17858169.jpg",
    attribution: "Oliver Morgan Media"
  },
  {
    file: "midi-controllers-for-music-production.html",
    title: "Best MIDI Controllers for Music Production",
    type: "photography",
    heroImage: "pexels-music-production-workstation-27495246.jpg",
    attribution: "Giuseppe Di Maria"
  },
  // Combined Software Hub (PR #12 Advisor + PR #14 Photo)
  {
    file: "dj-software-hub.html",
    title: "DJ Software Hub 2026",
    type: "advisor-and-photo",
    heroImage: "pexels-dj-nightclub-booth-4062561.jpg",
    attribution: "Erik Mclean"
  }
];

async function run() {
  console.log("Starting integrated local test server...");
  const server = await startServer(8992);
  console.log(`Server listening on ${server.base}`);

  console.log(`Launching Chromium at ${CHROME_PATH}...`);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"]
  });

  const summary = {
    testedAt: new Date().toISOString(),
    browser: await browser.version(),
    pages: []
  };

  try {
    for (const item of PAGES_TO_TEST) {
      console.log(`\n================ Testing ${item.file} ================`);
      const pageResult = { file: item.file, desktop: {}, mobile: {} };

      for (const vp of [
        { name: "desktop", width: 1440, height: 900, dpr: 1 },
        { name: "mobile", width: 390, height: 844, dpr: 2 }
      ]) {
        console.log(`- Testing ${item.file} at ${vp.name} (${vp.width}x${vp.height})...`);
        const page = await browser.newPage();
        const errors = [];
        const failedRequests = [];

        page.on("pageerror", err => errors.push(err.message));
        page.on("console", msg => {
          if (msg.type() === "error") errors.push(msg.text());
        });
        page.on("response", res => {
          if (res.status() >= 400) failedRequests.push(`${res.status()} ${res.url()}`);
        });

        await page.setViewport({
          width: vp.width,
          height: vp.height,
          deviceScaleFactor: vp.dpr
        });

        const url = `${server.base}/${item.file}`;
        const response = await page.goto(url, { waitUntil: "networkidle0" });
        assert.equal(response.status(), 200, `Expected 200 for ${url}`);

        // Trigger decode on all images
        await page.evaluate(async () => {
          for (const img of document.images) {
            img.loading = "eager";
            try { await img.decode(); } catch (e) {}
          }
        });

        const facts = await page.evaluate(() => {
          const scrollWidth = document.documentElement.scrollWidth;
          const innerWidth = window.innerWidth;
          const overflow = scrollWidth > innerWidth;

          const images = Array.from(document.images).map(img => ({
            src: img.src,
            alt: img.alt,
            width: img.width,
            height: img.height,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            complete: img.complete
          }));

          const brokenImages = images.filter(i => !i.complete || i.naturalWidth === 0);

          const heroImg = document.querySelector(".hero-figure img");
          const heroFigcaption = document.querySelector(".hero-figure figcaption");

          const schemas = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
            .map(s => {
              try { return JSON.parse(s.textContent); } catch (e) { return null; }
            }).filter(Boolean);

          const mainText = document.querySelector("main") ? document.querySelector("main").textContent : "";

          // Links
          const localLinks = Array.from(document.querySelectorAll("main a[href]"))
            .map(a => a.getAttribute("href"))
            .filter(h => h && !h.startsWith("http://") && !h.startsWith("https://") && !h.startsWith("mailto:") && !h.startsWith("#"));

          return {
            overflow,
            scrollWidth,
            innerWidth,
            brokenImages,
            hero: heroImg ? {
              src: heroImg.src,
              alt: heroImg.alt,
              naturalWidth: heroImg.naturalWidth,
              naturalHeight: heroImg.naturalHeight
            } : null,
            caption: heroFigcaption ? heroFigcaption.textContent : null,
            captionHtml: heroFigcaption ? heroFigcaption.innerHTML : null,
            schemas,
            mainText,
            localLinks
          };
        });

        // Basic assertions
        assert.equal(facts.overflow, false, `Horizontal overflow on ${item.file} at ${vp.name} (${facts.scrollWidth} > ${facts.innerWidth})`);
        assert.deepEqual(facts.brokenImages, [], `Broken images found on ${item.file}`);
        assert.deepEqual(errors, [], `Console errors found on ${item.file}: ${errors.join(", ")}`);
        assert.deepEqual(failedRequests, [], `Failed network requests on ${item.file}: ${failedRequests.join(", ")}`);

        // Check local links exist
        for (const link of facts.localLinks) {
          const clean = link.split(/[?#]/)[0];
          const localTarget = path.join(ROOT, clean);
          assert.ok(fs.existsSync(localTarget), `Dead local link target: ${link} from ${item.file}`);
        }

        // Check photography expectations if applicable
        if (item.heroImage) {
          assert.ok(facts.hero, `Hero image missing on ${item.file}`);
          assert.ok(facts.hero.src.includes(item.heroImage), `Hero image src mismatch on ${item.file}: expected ${item.heroImage}, got ${facts.hero.src}`);
          assert.equal(facts.hero.naturalWidth, 1200, `Hero image naturalWidth should be 1200 on ${item.file}`);
          assert.equal(facts.hero.naturalHeight, 750, `Hero image naturalHeight should be 750 on ${item.file}`);
          assert.ok(facts.hero.alt && facts.hero.alt.length > 10, `Alt text missing or too short on ${item.file}`);
          assert.ok(facts.caption && facts.caption.includes(item.attribution), `Figcaption must credit ${item.attribution} on ${item.file}`);
        }

        // Custom assertions for specific pages
        if (item.asserts) {
          item.asserts(facts, facts.mainText);
        }

        // Standalone FAQ interaction check
        const faqSummaries = await page.$$(".faq-section summary");
        for (const summary of faqSummaries) {
          await summary.evaluate(el => el.scrollIntoView({ block: "center" }));
          const wasOpen = await summary.evaluate(el => el.parentElement.open);
          await summary.focus();
          await page.keyboard.press("Enter");
          const isOpen = await summary.evaluate(el => el.parentElement.open);
          assert.equal(isOpen, !wasOpen, "FAQ summary did not toggle open/close with keyboard on Enter");
        }

        // Exercise the Software Advisor if on dj-software-hub.html
        if (item.file === "dj-software-hub.html") {
          console.log(`  * Exercising software advisor on ${vp.name}...`);
          const advisorExists = await page.evaluate(() => !!document.querySelector("[data-swa-root]"));
          assert.ok(advisorExists, "Software advisor root [data-swa-root] missing on dj-software-hub.html");

          // Initial state check
          const initialStatus = await page.evaluate(() => document.querySelector("[data-swa-status]").textContent);
          assert.equal(initialStatus.trim(), "Answer the first three questions to see which software fits.", "Initial advisor status must prompt for first three questions");

          // Scenario A: FLX4 controller owner, club scene, local files
          const pickOption = async (q, val) => {
            const selector = `[data-question="${q}"] input[value="${val}"]`;
            await page.waitForSelector(selector, { timeout: 4000 });
            await page.$eval(selector, el => {
              el.scrollIntoView({ block: "center" });
              el.click();
              el.dispatchEvent(new Event("change", { bubbles: true }));
            });
            await new Promise(r => setTimeout(r, 100));
          };

          await pickOption("mode", "controller");
          await pickOption("hardware", "flx4");
          await pickOption("os", "macos");
          await pickOption("music", "local");
          await pickOption("budget", "free");
          await pickOption("needs", "cdj");
          await pickOption("scene", "club");

          await new Promise(r => setTimeout(r, 150));

          const flx4Verdict = await page.evaluate(() => {
            const fits = Array.from(document.querySelectorAll(".swa-group--fits .swa-card h4")).map(h => h.textContent.trim());
            const partial = Array.from(document.querySelectorAll(".swa-group--partial .swa-card h4")).map(h => h.textContent.trim());
            const status = document.querySelector("[data-swa-status]") ? document.querySelector("[data-swa-status]").textContent.trim() : "";
            return { fits, partial, status };
          });
          console.log(`    [${vp.name}] flx4Verdict:`, JSON.stringify(flx4Verdict));

          assert.ok(flx4Verdict.fits.includes("rekordbox"), "rekordbox must be a fit for FLX4 club preparation");
          assert.ok(flx4Verdict.partial.length > 0, "Partial verdicts should be populated for FLX4");

          // Scenario B: Test Reset button
          await page.click("[data-swa-reset]");
          await new Promise(r => setTimeout(r, 150));
          const resetStatus = await page.evaluate(() => document.querySelector("[data-swa-status]").textContent);
          assert.equal(resetStatus.trim(), "Answer the first three questions to see which software fits.", "Reset button must restore initial prompt");

          // Scenario C: Test standalone PRIME 4+ owner scenario via URL params
          await page.goto(`${server.base}/dj-software-hub.html?sw_mode=controller&sw_hardware=prime4&sw_os=windows&sw_music=local&sw_budget=free`, { waitUntil: "networkidle0" });
          const prime4Verdict = await page.evaluate(() => {
            const fits = Array.from(document.querySelectorAll(".swa-group--fits .swa-card h4")).map(h => h.textContent.trim());
            return fits;
          });
          assert.ok(prime4Verdict.includes("Engine DJ"), "Engine DJ must fit PRIME 4+ owner");
          assert.ok(prime4Verdict.includes("Serato DJ"), "Serato DJ unlocks on PRIME 4+ hardware");
        }

        // Screenshot capture for evidence
        const screenshotPath = path.join(EVIDENCE_DIR, `${item.file.replace(".html", "")}-${vp.name}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false });

        pageResult[vp.name] = {
          status: response.status(),
          overflow: facts.overflow,
          brokenImages: facts.brokenImages.length,
          errors: errors.length,
          screenshot: path.relative(ROOT, screenshotPath)
        };

        await page.close();
      }

      summary.pages.push(pageResult);
    }

    const summaryPath = path.join(EVIDENCE_DIR, "integration-results.json");
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`\nAll integrated tests passed cleanly! Results saved to ${summaryPath}`);

  } finally {
    await browser.close();
    await server.close();
  }
}

run().catch(err => {
  console.error("Test failure:", err);
  process.exit(1);
});
