/*
 * Offbeat DOM harness — a real-DOM test runner that needs no desktop browser.
 *
 * Why this exists: the older browser tests in this folder drive Chromium through
 * puppeteer-core, which is not available on every machine (and is not available
 * in every sandbox). This harness loads a published page from a local static
 * server into jsdom, executes the real site JavaScript, and exposes the same
 * read-only `window.__rigStudio` hooks the UI renders from. That makes it
 * possible to assert on behaviour (prices, cable lines, ownership, DOM clicks)
 * rather than on source strings, on a machine with nothing but Node.
 *
 * What it cannot do: layout. jsdom has no layout engine, so there is no pixel
 * geometry here — tap targets and wrapping still need a real browser pass.
 * Anything that depends on measured height is checked in
 * tests/test_flx4_comparison.js (Chromium) instead.
 *
 * Usage:
 *   const { startServer, openPage } = require("./dom_harness");
 *   const server = await startServer();
 *   const page = await openPage(server.base + "/build-your-dj-setup.html?preset=bedroom-starter");
 *
 * jsdom is loaded from JSDOM_PATH when set, then from a few common install
 * locations; it is the only dependency.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function loadJsdom() {
  const candidates = [
    process.env.JSDOM_PATH,
    path.join(ROOT, "node_modules/jsdom"),
    "/tmp/browser/node_modules/jsdom",
    "/tmp/node_modules/jsdom",
    "jsdom"
  ].filter(Boolean);
  for (const candidate of candidates) {
    try { return require(candidate); } catch (error) { /* try next */ }
  }
  throw new Error("jsdom not found; install it (npm i jsdom) or set JSDOM_PATH");
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8"
};

function startServer(port) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || "/").split("?")[0]);
    const filePath = path.join(ROOT, url === "/" ? "/index.html" : url);
    if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end("forbidden"); return; }
    fs.readFile(filePath, (error, data) => {
      if (error) { res.writeHead(404); res.end("not found"); return; }
      res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
      res.end(data);
    });
  });
  return new Promise((resolve) => {
    server.listen(port || 0, "127.0.0.1", () => {
      const actual = server.address().port;
      resolve({
        base: `http://127.0.0.1:${actual}`,
        close: () => new Promise((done) => server.close(done))
      });
    });
  });
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function openPage(url, options) {
  const { JSDOM, VirtualConsole } = loadJsdom();
  const consoleErrors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => consoleErrors.push(error.message));
  virtualConsole.on("error", (...args) => consoleErrors.push(args.join(" ")));

  const dom = await JSDOM.fromURL(url, {
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      // jsdom ships no fetch; the site loads its catalogue with it.
      window.fetch = (input, init) => fetch(new URL(String(input), window.location.href).href, init);
      window.matchMedia = window.matchMedia || ((query) => ({
        matches: false, media: query,
        addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}
      }));
      window.HTMLElement.prototype.scrollIntoView = function () {};
    }
  });

  const window = dom.window;
  const document = window.document;

  const expectRig = !options || options.expectRig !== false;
  if (expectRig) {
    await waitFor(() => window.__rigStudio, 8000);
  } else {
    await waitFor(() => document.readyState === "complete", 8000);
  }
  await wait(150);

  /* The page runs in its own realm: arrays and objects it returns have foreign
     prototypes, which assert.deepStrictEqual() rejects. Copy them out. */
  const plain = (value) => JSON.parse(JSON.stringify(value));
  const helpers = {
    window,
    document,
    consoleErrors,
    rig: window.__rigStudio,
    cost: () => plain(window.__rigStudio.cost()),
    query: (selector) => document.querySelector(selector),
    queryAll: (selector) => Array.prototype.slice.call(document.querySelectorAll(selector)),
    checks: () => plain(window.__rigStudio.checks()),
    shopping: () => plain(window.__rigStudio.shoppingList()),
    speakers: () => plain(window.__rigStudio.speakers()),
    connections: () => plain(window.__rigStudio.connections()),
    cableLines: () => plain(window.__rigStudio.cableLines()),
    state: () => plain(window.__rigStudio.state()),
    text: (selector) => {
      const el = document.querySelector(selector);
      return el ? el.textContent.replace(/\s+/g, " ").trim() : null;
    },
    /* Real clicks on the rendered DOM, the way a visitor drives it. */
    click(selector) {
      const el = document.querySelector(selector);
      if (!el) throw new Error("nothing to click: " + selector);
      el.click();
      return wait(160);
    },
    async pickInDrawer(itemId) {
      const button = document.querySelector(`[data-drawer-use="${itemId}"]`);
      if (!button) throw new Error("drawer has no option for " + itemId);
      button.click();
      return wait(220);
    },
    async openSlotDrawer(slotId, category) {
      await helpers.click(`[data-rs="pick"][data-slot="${slotId}"][data-cat="${category}"]`);
      if (!document.querySelector(".rs-drawer")) throw new Error("drawer did not open for " + category);
    },
    close() { window.close(); }
  };
  return helpers;
}

async function waitFor(predicate, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 5000);
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await wait(50);
  }
  throw new Error("timed out waiting for the page to be ready");
}

module.exports = { startServer, openPage, wait, loadJsdom };
