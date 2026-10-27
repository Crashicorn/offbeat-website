/*
 * Regenerate evidence/software-advisor-<date>.txt: the text a reader actually
 * sees, after real DOM interaction, for the six scenarios the advisor has to
 * get right. This is the readable companion to the screenshots in
 * evidence/software-advisor-2026-10/ and to tests/software-advisor.browser.js.
 *
 * Run: JSDOM_PATH=/tmp/browser/node_modules/jsdom node tests/capture_software_evidence.js
 */
const fs = require("fs");
const path = require("path");
const { startServer, openPage } = require("./dom_harness");

const PAGE = "/dj-software-hub.html";
const OUT = path.resolve(__dirname, "..", "evidence", "software-advisor-2026-10-27.txt");
const STAMP = "27 October 2026";

const CASES = [
  {
    title: "DDJ-FLX4 owner preparing club USB sticks, free budget",
    query: "sw_mode=controller&sw_hardware=flx4&sw_os=macos&sw_music=local&sw_budget=free&sw_need=cdj&sw_scene=club"
  },
  {
    title: "DDJ-FLX4 owner who wants to record mixes but would rather not pay",
    query: "sw_mode=controller&sw_hardware=flx4&sw_os=macos&sw_music=local&sw_budget=free&sw_need=recording"
  },
  {
    title: "DDJ-FLX10 owner who wants to record mixes",
    query: "sw_mode=controller&sw_hardware=flx10&sw_os=windows&sw_music=local&sw_budget=free&sw_need=recording"
  },
  {
    title: "DDJ-FLX2 owner who wants to record mixes",
    query: "sw_mode=controller&sw_hardware=flx2&sw_os=windows&sw_music=local&sw_budget=free&sw_need=recording"
  },
  {
    title: "DDJ-FLX10 owner who wants the DVS expansion",
    query: "sw_mode=controller&sw_hardware=flx10&sw_os=windows&sw_music=local&sw_budget=once&sw_need=dvs"
  },
  {
    title: "No hardware, laptop only, wants something genuinely free",
    query: "sw_mode=laptop&sw_hardware=none&sw_os=macos&sw_music=local&sw_budget=free"
  },
  {
    title: "Linux user, files owned, free budget",
    query: "sw_mode=laptop&sw_hardware=none&sw_os=linux&sw_music=local&sw_budget=free"
  },
  {
    title: "iPad and a streaming subscription",
    query: "sw_mode=mobile&sw_hardware=none&sw_os=ios&sw_music=streaming&sw_budget=free"
  },
  {
    title: "iPad owner who wants to record the mix on the tablet",
    query: "sw_mode=mobile&sw_hardware=none&sw_os=ios&sw_music=local&sw_budget=free&sw_need=recording"
  },
  {
    title: "PRIME 4 / 4+ standalone player, no laptop in the booth",
    query: "sw_mode=standalone&sw_hardware=prime4&sw_os=windows&sw_music=local&sw_budget=free"
  },
  {
    title: "PRIME GO / GO+ standalone player, no laptop in the booth",
    query: "sw_mode=standalone&sw_hardware=prime_go&sw_os=windows&sw_music=local&sw_budget=free"
  },
  {
    title: "PRIME 4 / 4+ owner with a Windows laptop (the issue #1040 case)",
    query: "sw_mode=controller&sw_hardware=prime4&sw_os=windows&sw_music=local&sw_budget=free"
  },
  {
    title: "PRIME 4 / 4+ owner who also wants DVS",
    query: "sw_mode=controller&sw_hardware=prime4&sw_os=windows&sw_music=local&sw_budget=once&sw_need=dvs"
  },
  {
    title: "PRIME GO / GO+ used as a laptop controller",
    query: "sw_mode=controller&sw_hardware=prime_go&sw_os=windows&sw_music=local&sw_budget=sub"
  },
  {
    title: "Turntables, timecode, prefers to buy once",
    query: "sw_mode=vinyl&sw_hardware=other&sw_os=windows&sw_music=local&sw_budget=once&sw_need=dvs"
  }
];

function dump(cards, page) {
  const lines = [];
  ["fits", "costs", "partial", "check", "blocked"].forEach((group) => {
    const nodes = page.queryAll(".swa-group--" + group + " .swa-card");
    if (!nodes.length) return;
    const heading = page.text(".swa-group--" + group + " h3").replace(/\s+/g, " ").trim();
    lines.push("");
    lines.push(" [" + heading + "]");
    nodes.forEach((card) => {
      const name = card.querySelector("h4").textContent.trim();
      const badge = card.querySelector(".swa-badge").textContent.trim();
      lines.push("   " + name + " — " + badge);
      const price = card.querySelector(".swa-price");
      if (price) lines.push("     price: " + price.textContent.trim());
      const free = card.querySelector(".swa-free");
      if (free) lines.push("     free tier: " + free.textContent.trim());
      ["swa-why|why", "swa-blockers|no", "swa-notes|note", "swa-permodel|model", "swa-gaps|gap", "swa-fillers|fills", "swa-checks|check"].forEach((pair) => {
        const [className, label] = pair.split("|");
        Array.from(card.querySelectorAll("." + className + " li")).forEach((li) => {
          lines.push("     " + label + ": " + li.textContent.trim());
        });
      });
      const verify = card.querySelector(".swa-verify");
      if (verify) lines.push("     unverified: " + verify.textContent.replace(/^Unverified here:\s*/, "").trim());
      const links = Array.from(card.querySelectorAll(".swa-next a")).map((a) => a.getAttribute("href"));
      if (links.length) lines.push("     next: " + links.join(" · "));
    });
  });
  return lines;
}

(async () => {
  const server = await startServer();
  const out = [
    "Offbeat software advisor — what a reader actually sees, " + STAMP + ".",
    "Captured from the published page in jsdom after DOM interaction: text, prices, verdicts and links.",
    "Screenshots of the same states at 1440px and 390px are in evidence/software-advisor-2026-10/, and",
    "tests/software-advisor.browser.js re-runs the whole flow in Chromium.",
    ""
  ];
  try {
    for (const item of CASES) {
      const page = await openPage(server.base + PAGE + "?" + item.query, { expectRig: false });
      out.push("=".repeat(78));
      out.push("CASE: " + item.title);
      out.push("URL: " + PAGE + "?" + item.query);
      out.push("");
      out.push("STATUS: " + page.text("[data-swa-status]").replace(/\s+/g, " ").trim());
      out.push(...dump(null, page));
      const note = page.query(".swa-note");
      if (note) {
        out.push("");
        out.push("NOTE: " + note.textContent.replace(/\s+/g, " ").trim());
      }
      const table = page.queryAll(".swa-table tbody tr")
        .map((row) => Array.from(row.children).map((cell) => cell.textContent.trim()).join(" | "));
      if (table.length) {
        out.push("");
        out.push("THREE-YEAR LICENCE TABLE:");
        table.forEach((row) => out.push("   " + row));
      }
      out.push("");
      out.push("console errors: " + (page.consoleErrors.length ? page.consoleErrors.join(" | ") : "none"));
      page.close();
    }
    out.push("=".repeat(78));
    out.push("Scores, star ratings and rankings are deliberately absent: the page groups by the five outcomes,");
    out.push("from fit, through cost and named gaps, to per-model checks and genuine incompatibilities.");
    fs.writeFileSync(OUT, out.join("\n") + "\n");
    console.log("wrote " + path.relative(process.cwd(), OUT) + " (" + out.length + " lines)");
  } finally {
    await server.close();
  }
})().catch((error) => {
  console.error("evidence capture failed:", error.message);
  process.exitCode = 1;
});
