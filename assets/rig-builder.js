/* Offbeat — DJ rig planner.
 *
 * An interactive, dependency-free recommender for a first (or next) DJ setup.
 * It runs entirely in the browser, needs no network and stores nothing.
 *
 * Features:
 * - Dynamic 3-tier comparison switcher: Essentials vs Recommended vs Pro Upgrade
 * - Interactive signal flow cabling diagram reflecting chosen gear
 * - Software compatibility & streaming support breakdown
 * - Why this pick vs alternatives comparison card
 * - One-click formatted shopping checklist export to clipboard
 * - URL state sharing and bookmarking
 */
(function () {
  "use strict";

  var form = document.getElementById("rig-form");
  if (!form) return;

  var result = document.getElementById("rig-result");
  var placeholder = document.getElementById("rig-placeholder");
  var steps = [].slice.call(form.querySelectorAll(".rig-step"));
  var progress = form.querySelector("[data-rig-progress]");
  var backBtn = form.querySelector("[data-rig-back]");
  var nextBtn = form.querySelector("[data-rig-next]");
  var current = 0;

  var state = { place: "", budget: "", owns: [], software: "" };

  /* ------------------------------------------------------------------ data */
  var DECKS = {
    rekordbox: {
      b1: { name: "Pioneer DDJ-FLX2", band: "$150–200", why: "The cheapest route into rekordbox. Two channels, compact jogs, works with a laptop, iPhone, or iPad via USB-C.", alt: "Numark Party Mix II ($129)", softwareTier: "rekordbox & djay (Free Unlock)", streaming: "Tidal, Beatport, SoundCloud, Apple Music (via djay)" },
      b2: { name: "Pioneer DDJ-FLX4", band: "$280–350", why: "The undisputed beginner gold standard: full-size capacitive jog platters, hardware unlocks for both rekordbox and Serato DJ Lite, Smart Fader, and a layout that mirrors club CDJs.", alt: "Hercules Inpulse 500 ($280–320)", softwareTier: "rekordbox & Serato DJ Lite (Hardware Unlock)", streaming: "Tidal, Beatport, Beatsource, SoundCloud" },
      b3: { name: "Pioneer DDJ-FLX6-GT", band: "$550–650", why: "Four channels and full-size 8-inch platters with Merge FX for cross-genre transitions. Great if you are preparing for 3-4 deck mixing.", alt: "Traktor Kontrol S3 ($450–550)", softwareTier: "rekordbox & Serato DJ Pro unlock", streaming: "Tidal, Beatport, Beatsource, SoundCloud" },
      b4: { name: "Pioneer DDJ-FLX10", band: "$1,600–1,750", why: "Flagship 4-channel controller with dedicated real-time stem separation (vocal, drum, inst buttons), on-jog color displays, and DMX lighting output.", alt: "AlphaTheta XDJ-AZ ($2,500+ standalone)", softwareTier: "rekordbox & Serato DJ Pro (Full Unlock)", streaming: "Tidal, Beatport, Beatsource, SoundCloud" }
    },
    serato: {
      b1: { name: "Numark Mixtrack Pro FX", band: "$190–250", why: "Long-throw 100mm pitch faders, paddle FX triggers, and capacitive jog wheels with Serato DJ Lite bundled.", alt: "Numark Party Mix II ($129)", softwareTier: "Serato DJ Lite (Included)", streaming: "Tidal, Beatport, Beatsource, SoundCloud" },
      b2: { name: "Hercules DJControl Inpulse 500", band: "$280–350", why: "Solid metal base, retractable feet, dedicated aux input with filter, and beatmatch guide LEDs to assist ear training.", alt: "Pioneer DDJ-FLX4 ($280–350)", softwareTier: "Serato DJ Lite & DJUCED included", streaming: "Tidal, Beatport, Beatsource, SoundCloud" },
      b3: { name: "Rane One", band: "$800–900", why: "Real 7.2-inch motorized platters with high-torque direct drive, MAG FOUR crossfader, and battle mixer layout.", alt: "Pioneer DDJ-REV5 ($800–900)", softwareTier: "Serato DJ Pro (Hardware Unlock)", streaming: "Tidal, Beatport, Beatsource, SoundCloud" },
      b4: { name: "Pioneer DDJ-REV7 or Rane Performer", band: "$1,400–1,900", why: "Motorized 7-inch platters with on-jog LCD displays, instant stem split buttons, and scratch-tournament grade faders.", alt: "Rane One ($850)", softwareTier: "Serato DJ Pro (Full Unlock)", streaming: "Tidal, Beatport, Beatsource, SoundCloud" }
    },
    traktor: {
      b1: { name: "Traktor Kontrol S2 MK3 (New or Refurb)", band: "$150–220", why: "Compact two-channel Traktor controller with 14cm precision jog wheels and full Traktor Pro license included.", alt: "Numark Mixtrack Pro FX ($190)", softwareTier: "Traktor Pro 4 (Full License Included)", streaming: "Beatport, Beatsource" },
      b2: { name: "Traktor Kontrol S3", band: "$400–550", why: "Full four-channel mixer with dedicated Mixer FX, RGB pads, XLR outputs, and iOS iPad Traktor support.", alt: "Pioneer DDJ-FLX6-GT ($550)", softwareTier: "Traktor Pro 4 (Full License Included)", streaming: "Beatport, Beatsource" },
      b3: { name: "Traktor Kontrol S4 MK3", band: "$650–800", why: "Haptic Drive motorized jog wheels with tactile beat feedback and crisp high-res displays.", alt: "Traktor Kontrol S3 ($450)", softwareTier: "Traktor Pro 4 (Full License Included)", streaming: "Beatport, Beatsource" },
      b4: { name: "Traktor Kontrol S4 MK3 + Traktor X1 MK3", band: "$850–1,100", why: "Modular four-deck powerhouse with dedicated OLED tactile stems and effects controllers.", alt: "Pioneer DDJ-FLX10 ($1,729)", softwareTier: "Traktor Pro 4 (Full License)", streaming: "Beatport, Beatsource" }
    },
    djay: {
      b1: { name: "Pioneer DDJ-FLX2", band: "$150–200", why: "Ultra-portable, phone/tablet powered, and plug-and-play with Algoriddim djay Pro on iOS/Android.", alt: "Reloop Ready ($220)", softwareTier: "djay Pro compatible", streaming: "Apple Music, Tidal, Beatport, SoundCloud" },
      b2: { name: "Pioneer DDJ-FLX4", band: "$280–350", why: "Bluetooth LE or USB-C connectivity to iPad/iPhone or laptop running djay Pro, with easy migration to rekordbox.", alt: "Reloop Buddy ($280)", softwareTier: "djay Pro & rekordbox", streaming: "Apple Music, Tidal, Beatport, SoundCloud" },
      b3: { name: "Reloop Mixon 8 Pro", band: "$650–850", why: "Hybrid 4-channel controller engineered specifically for djay Pro with integrated iPad dock, paddle FX and stems.", alt: "Pioneer DDJ-FLX6-GT ($550)", softwareTier: "djay Pro & Serato DJ Pro", streaming: "Apple Music, Tidal, Beatport, SoundCloud" },
      b4: { name: "Reloop Mixon 8 Pro or DDJ-FLX10", band: "$850–1,750", why: "Flagship multi-platform performance with Neural Mix stem control and dual USB interfaces.", alt: "Rane One ($850)", softwareTier: "djay Pro & Serato DJ Pro", streaming: "Apple Music, Tidal, Beatport, SoundCloud" }
    },
    none: {
      b1: { name: "Pioneer DDJ-FLX2 or Numark Mixtrack Pro FX", band: "$150–250", why: "Safe entry controllers with real pitch controls and included software that won't require relearning habits.", alt: "Numark Party Mix II ($129)", softwareTier: "Free software bundled", streaming: "Tidal, Beatport, SoundCloud" },
      b2: { name: "Pioneer DDJ-FLX4", band: "$280–350", why: "The safest first controller in 2026: supports both rekordbox and Serato, USB-C bus power, and standard club layout.", alt: "Hercules Inpulse 500 ($280–320)", softwareTier: "rekordbox & Serato DJ Lite unlocked", streaming: "Tidal, Beatport, Beatsource, SoundCloud" },
      b3: { name: "Hercules Inpulse 500 or DDJ-FLX6-GT", band: "$300–650", why: "Choose Inpulse 500 for rugged 2-channel metal chassis with aux input; choose FLX6 for 4 channels.", alt: "Traktor Kontrol S3 ($450)", softwareTier: "rekordbox, Serato or Traktor", streaming: "Tidal, Beatport, SoundCloud" },
      b4: { name: "Pioneer DDJ-FLX10 or Rane One", band: "$800–1,750", why: "Choose FLX10 for club layout and stems; choose Rane One for motorized turntables and scratch/battle layout.", alt: "Denon Prime 4+ ($2,200 standalone)", softwareTier: "Serato DJ Pro & rekordbox", streaming: "Tidal, Beatport, SoundCloud" }
    },
    standalone: {
      b1: { name: "Controller + Laptop (Keep saving for Standalone)", band: "$280–350", why: "No quality standalone DJ system exists under $900. Start on a controller with your current laptop; the mixing skills transfer 100%.", alt: "Used Pioneer XDJ-RX ($700–900)", softwareTier: "rekordbox USB export workflow", streaming: "None standalone at this price" },
      b2: { name: "Controller + Laptop (Keep saving for Standalone)", band: "$280–350", why: "At $300–$600, putting money into a DDJ-FLX4 plus good headphones gives you a far better rig than any compromised old standalone.", alt: "Used Pioneer XDJ-AERO", softwareTier: "rekordbox USB export workflow", streaming: "None standalone at this price" },
      b3: { name: "Denon DJ Prime Go", band: "$950–1,100", why: "Rechargeable 4-hour battery, 7-inch HD touchscreen, built-in Wi-Fi streaming, Engine DJ OS. The ultimate backpack standalone rig.", alt: "Pioneer XDJ-RR ($1,050)", softwareTier: "Engine DJ standalone OS", streaming: "Tidal, Beatport, Beatsource, Amazon Music" },
      b4: { name: "AlphaTheta XDJ-AZ or Denon Prime 4+", band: "$2,200–3,200", why: "Four-channel standalone flagships with full-size platters, dual USB media ports, and club standard booth continuity.", alt: "Pioneer XDJ-XZ ($2,400)", softwareTier: "rekordbox or Engine DJ standalone", streaming: "Tidal, Beatport, Beatsource, Amazon Music" }
    }
  };

  var HEADPHONES = {
    b1: { name: "Audio-Technica ATH-M20x or Sony MDR-ZX110", band: "$25–50", why: "Clean closed-back isolation for cueing without leaking audio into the room.", link: "best-dj-headphones-under-50.html", label: "Headphones under $50" },
    b2: { name: "Sony MDR-7506 or Audio-Technica ATH-M50x", band: "$99–149", why: "Industry fixtures: durable coiled cable, 40mm/45mm drivers, punchy bass, and fully replaceable ear pads.", link: "best-dj-headphones-2026.html", label: "Best DJ headphones" },
    b3: { name: "Sennheiser HD 25", band: "$149–199", why: "The legendary club booth standard: split headband, ultra-lightweight, swivelling ear capsule for one-ear monitoring, and unmatched high-SPL isolation.", link: "best-dj-headphones-2026.html", label: "Best DJ headphones" },
    b4: { name: "Pioneer HDJ-X10 or Sennheiser HD 25 Plus", band: "$249–349", why: "Nano-coated water/sweat resistant ear cushions, 5Hz–40kHz frequency response, and military-grade shock durability.", link: "best-dj-headphones-2026.html", label: "Best DJ headphones" }
  };

  var SPEAKERS = {
    b1: { name: "PreSonus Eris 3.5 or Mackie CR3-X", band: "$80–120", why: "Active desktop reference monitors with clean bass response and front aux/headphone inputs.", link: "best-dj-monitor-speakers.html", label: "Monitor speakers guide" },
    b2: { name: "Pioneer DJ DM-40D or PreSonus Eris 4.5", band: "$149–199", why: "Front-firing bass reflex ports and dedicated DJ/Production DSP sound modes.", link: "best-dj-monitor-speakers.html", label: "Monitor speakers guide" },
    b3: { name: "KRK Classic 5 or Yamaha HS5", band: "$299–399", why: "5-inch Kevlar/bi-amped studio monitors with flat frequency response and XLR balanced inputs.", link: "best-dj-monitor-speakers.html", label: "Monitor speakers guide" },
    b4: { name: "Yamaha DBR10 (Pair) or Electro-Voice ZLX-12P", band: "$700–1,100", why: "High-output powered PA speakers with 1000W peak power for house parties and mobile gigs.", link: "best-dj-monitor-speakers.html", label: "Monitor speakers guide" }
  };

  var PLACES = {
    bedroom: { label: "Bedroom & practice", note: "Headphones-first workflow. Prioritize a controller layout you will not outgrow in six months." },
    party: { label: "House parties & events", note: "Needs durable gear, punchy active speakers, and balanced cables that survive travel." },
    club: { label: "Club prep & club booths", note: "Pioneer/AlphaTheta CDJ layout continuity and rekordbox USB preparation save difficult booth transitions." },
    mobile: { label: "Mobile DJing & weddings", note: "Reliability, dual mic inputs, backup cables, and broad streaming/request library access matter most." },
    stream: { label: "Streaming & content creation", note: "Clean audio routing, built-in USB sound card, and easy OBS/broadcast capture without ground hum." }
  };

  var CABLES = {
    laptop: { name: "USB-C to USB-B / USB-C braided cable", band: "$12–25", why: "Direct high-speed connection between laptop and controller without loose adapters." },
    pa: { name: "Dual RCA to 1/4-inch TRS / XLR balanced cables", band: "$18–45", why: "Connects controller Master Out to powered monitor speakers or PA." },
    booth: { name: "Ground loop noise isolator (3.5mm / RCA)", band: "$12–22", why: "Eliminates annoying 60Hz electrical hum when laptop and speakers share the same power strip." },
    extras: { name: "Ergonomic laptop & controller stand", band: "$35–75", why: "Lifts the laptop to eye level and keeps your posture upright during long 2-hour mixing sessions." }
  };

  /* --------------------------------------------------------------- render */
  function showStep(index) {
    current = index;
    steps.forEach(function (step, i) {
      step.hidden = i !== index;
      step.classList.toggle("is-current", i === index);
    });
    if (progress) {
      progress.innerHTML = steps.map(function (_, i) {
        return '<span class="rig-dot' + (i <= index ? " is-done" : "") + '" aria-hidden="true"></span>';
      }).join("");
      progress.setAttribute("aria-label", "Step " + (index + 1) + " of " + steps.length);
    }
    if (backBtn) backBtn.hidden = index === 0;
    if (nextBtn) nextBtn.textContent = index === steps.length - 1 ? "Generate My Custom Rig" : "Next Step";
  }

  function selected(step) {
    var checked = step.querySelectorAll("input:checked");
    return [].slice.call(checked).map(function (input) { return input.value; });
  }

  function buildResult(targetTier) {
    var place = state.place || "bedroom";
    var budget = targetTier || state.budget || "b2";
    var software = state.software || "none";
    var owns = state.owns || [];

    var deckSet = DECKS[software] || DECKS.none;
    var deck = deckSet[budget] || deckSet.b2;
    var phones = HEADPHONES[budget] || HEADPHONES.b2;
    var spk = SPEAKERS[budget] || SPEAKERS.b2;

    if (software === "standalone" && (budget === "b1" || budget === "b2")) {
      deck = DECKS.standalone.b2;
    }

    var items = [];
    items.push({
      kind: "Deck",
      name: deck.name,
      band: deck.band,
      why: deck.why,
      alt: deck.alt,
      softwareTier: deck.softwareTier,
      streaming: deck.streaming
    });

    if (owns.indexOf("headphones") === -1) {
      items.push({ kind: "Headphones", name: phones.name, band: phones.band, why: phones.why, link: phones.link, label: phones.label });
    }

    if (owns.indexOf("pa") === -1) {
      items.push({
        kind: "Speakers",
        name: spk.name,
        band: spk.band,
        why: spk.why,
        link: spk.link,
        label: spk.label
      });
    }

    if (owns.indexOf("laptop") === -1 && software !== "standalone") {
      items.push({
        kind: "Laptop",
        name: "Laptop with 8GB+ RAM & SSD",
        band: "$350–800",
        why: "Any modern MacBook or Windows laptop with 8GB RAM runs Serato/rekordbox smoothly.",
        link: "best-dj-laptop-2026.html",
        label: "DJ laptop guide"
      });
    }

    items.push({
      kind: "Cables",
      name: CABLES.laptop.name,
      band: CABLES.laptop.band,
      why: CABLES.laptop.why
    });

    if (owns.indexOf("pa") === -1) {
      items.push({ kind: "Cables", name: CABLES.pa.name, band: CABLES.pa.band, why: CABLES.pa.why });
    }

    items.push({ kind: "Accessories", name: CABLES.extras.name, band: CABLES.extras.band, why: CABLES.extras.why });

    // Calculate budget sum
    var lo = 0, hi = 0;
    items.forEach(function (item) {
      var nums = (item.band.match(/[\d,]+/g) || []).map(function (n) { return parseInt(n.replace(/,/g, ""), 10); });
      if (nums.length >= 2) { lo += nums[0]; hi += nums[1]; }
      else if (nums.length === 1) { lo += nums[0]; hi += nums[0]; }
    });

    var budgetMax = { b1: 300, b2: 600, b3: 1200, b4: 3000 }[budget] || 600;

    var skip = [];
    if (place === "bedroom") skip.push("Heavy flight cases and massive PA subwoofers until you book outside venues.");
    if (software !== "standalone") skip.push("Expensive standalone units ($1,200+) — a controller + laptop setup does 95% of the same job.");
    if (owns.indexOf("headphones") !== -1) skip.push("Buying brand new headphones — replace worn ear cushions first.");
    skip.push("Paid software add-on FX packs. Master your deck's 3-band EQ and basic filter first.");
    skip.push("Paid sample packs before organizing your core DJ playlist.");

    var upgrade = owns.indexOf("headphones") === -1
      ? "1. Closed-back headphones (critical for cueing) → 2. Controller → 3. Monitor speakers → 4. DJ stand."
      : place === "party" || place === "mobile"
        ? "1. Controller → 2. Powered PA speakers → 3. Backup cables & power strip → 4. Microphones."
        : "1. Controller & software unlock → 2. Active monitors → 3. High-quality DJ headphones → 4. Laptop riser.";

    return {
      place: place,
      budget: budget,
      software: software,
      owns: owns,
      items: items,
      budgetMax: budgetMax,
      low: lo,
      high: hi,
      skip: skip,
      upgrade: upgrade,
      deck: deck,
      phones: phones,
      spk: spk,
      deckLink: deckLinkFor(software)
    };
  }

  function deckLinkFor(software) {
    if (software === "rekordbox") return { href: "best-dj-controllers-for-rekordbox.html", label: "rekordbox controller guide" };
    if (software === "serato") return { href: "best-dj-controllers-for-serato.html", label: "Serato controller guide" };
    if (software === "standalone") return { href: "best-standalone-dj-systems.html", label: "Standalone systems guide" };
    return { href: "best-dj-controllers-for-beginners.html", label: "Beginner controller guide" };
  }

  function esc(value) {
    return String(value || "").replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function renderResult(data) {
    var money = function (n) { return "$" + n.toLocaleString("en-US"); };
    var html = "";

    // Tier comparison bar
    html += '<div class="rig-tier-switcher" role="tablist" aria-label="Compare budget tiers">';
    html += '<button type="button" class="btn-tier' + (data.budget === "b1" ? " is-active" : "") + '" data-set-tier="b1" role="tab" aria-selected="' + (data.budget === "b1") + '">Starter Budget (&lt;$300)</button>';
    html += '<button type="button" class="btn-tier' + (data.budget === "b2" ? " is-active" : "") + '" data-set-tier="b2" role="tab" aria-selected="' + (data.budget === "b2") + '">★ Sweet Spot ($300–$600)</button>';
    html += '<button type="button" class="btn-tier' + (data.budget === "b3" ? " is-active" : "") + '" data-set-tier="b3" role="tab" aria-selected="' + (data.budget === "b3") + '">Pro / 4-Channel ($600–$1,200)</button>';
    html += "</div>";

    html += '<div class="rig-result-head">';
    html += "<p class=\"kicker\">Your Recommended DJ Rig</p>";
    html += "<h2>" + esc(PLACES[data.place].label) + " · " + (data.budget === "b1" ? "Starter Budget" : data.budget === "b2" ? "Recommended Sweet Spot" : data.budget === "b3" ? "Pro Upgrade" : "Flagship Rig") + "</h2>";
    html += "<p class=\"rig-note\">" + esc(PLACES[data.place].note) + "</p>";
    html += "</div>";

    // Interactive Cabling Diagram
    html += '<div class="rig-signal-flow">';
    html += '<h3 class="rig-diagram-title">How Your Rig Connects</h3>';
    html += '<div class="rig-flow-diagram">';
    html += '<div class="flow-node flow-node--source"><span>Source</span><strong>' + (data.owns.indexOf("laptop") !== -1 ? "Your Laptop" : "Laptop / iPad") + '</strong><em>Music Library & DJ App</em></div>';
    html += '<div class="flow-wire"><span class="wire-label">USB-C</span><span class="wire-arrow">→</span></div>';
    html += '<div class="flow-node flow-node--deck"><span>Core Controller</span><strong>' + esc(data.deck.name) + '</strong><em>Mixer + Audio Interface</em></div>';
    html += '<div class="flow-split">';
    html += '<div class="flow-branch"><div class="flow-wire"><span class="wire-label">Master Out (RCA/XLR)</span><span class="wire-arrow">→</span></div><div class="flow-node flow-node--speakers"><span>Sound</span><strong>' + esc(data.spk.name.split(" or ")[0]) + '</strong><em>Room / Dancefloor</em></div></div>';
    html += '<div class="flow-branch"><div class="flow-wire"><span class="wire-label">Cue Jack (3.5mm)</span><span class="wire-arrow">→</span></div><div class="flow-node flow-node--phones"><span>Cue</span><strong>' + esc(data.phones.name.split(" or ")[0]) + '</strong><em>Ear Monitoring</em></div></div>';
    html += "</div>";
    html += "</div>";
    html += '<p class="flow-tip"><strong>Pro Tip:</strong> Plug headphones into the controller’s front Cue jack, not the laptop headphone jack. This gives you zero-latency pre-fader listening.</p>';
    html += "</div>";

    // Software & Ecosystem Card
    html += '<div class="rig-software-badge">';
    html += '<div class="badge-icon">⚡</div>';
    html += '<div class="badge-body">';
    html += '<strong>Software Included: ' + esc(data.deck.softwareTier) + '</strong>';
    html += '<p>Streaming Support: ' + esc(data.deck.streaming) + '</p>';
    html += '</div>';
    html += '</div>';

    // Itemized Rig list
    html += '<ol class="rig-items">';
    data.items.forEach(function (item) {
      html += '<li class="rig-item">';
      html += '<span class="rig-item-kind">' + esc(item.kind) + "</span>";
      html += '<div class="rig-item-body"><strong>' + esc(item.name) + '</strong><span class="rig-item-price">' + esc(item.band) + "</span>";
      html += "<p>" + esc(item.why) + "</p>";
      if (item.alt) {
        html += '<p class="rig-item-alt"><strong>Runner-up Alternative:</strong> ' + esc(item.alt) + '</p>';
      }
      if (item.link) html += '<a class="rig-item-link" href="' + esc(item.link) + '">' + esc(item.label) + " →</a>";
      html += "</div></li>";
    });
    html += "</ol>";

    // Total box
    html += '<div class="rig-total"><span>Estimated complete rig cost</span><b>' + money(data.low) + " – " + money(data.high) + "</b>";
    html += '<em>Researched 2026 street price bands. Check current retailer listings before purchase.</em></div>';

    // Upgrade Order & What to skip
    html += '<div class="rig-cols">';
    html += '<div class="rig-col"><h3>What to skip for now</h3><ul>' + data.skip.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ul></div>";
    html += '<div class="rig-col"><h3>Purchase order roadmap</h3><p>' + esc(data.upgrade) + "</p></div>";
    html += "</div>";

    // Next steps
    html += '<div class="rig-next"><h3>Explore matching guides</h3><ul class="rig-links">';
    html += '<li><a href="' + data.deckLink.href + '">' + data.deckLink.label + "</a></li>";
    html += '<li><a href="' + (data.software === "standalone" ? "best-standalone-dj-systems.html" : "controller-software-compatibility-matrix.html") + '">' + (data.software === "standalone" ? "Standalone systems compared" : "Controller and software compatibility") + "</a></li>";
    html += '<li><a href="dj-equipment-checklist.html">The complete equipment checklist</a></li>';
    html += '<li><a href="beginner-dj-setup-guide-2026.html">Beginner setup step-by-step</a></li>';
    html += '<li><a href="beatmatch-trainer.html">Beatmatch trainer drill</a></li>';
    html += "</ul></div>";

    // Actions
    html += '<div class="rig-actions">';
    html += '<button type="button" class="btn btn-secondary" data-rig-copy-list>Copy Shopping Checklist</button>';
    html += '<button type="button" class="btn btn-secondary" data-rig-restart>Modify Answers</button>';
    html += '<button type="button" class="btn btn-secondary" data-rig-print>Print / Save PDF</button>';
    html += "</div>";

    result.innerHTML = html;
    result.hidden = false;
    placeholder.hidden = true;
    form.hidden = true;

    // Attach result listeners
    result.querySelectorAll("[data-set-tier]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var tier = btn.getAttribute("data-set-tier");
        state.budget = tier;
        renderResult(buildResult(tier));
      });
    });

    result.querySelector("[data-rig-restart]").addEventListener("click", function () {
      result.hidden = true;
      placeholder.hidden = false;
      form.hidden = false;
      showStep(0);
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    result.querySelector("[data-rig-print]").addEventListener("click", function () { window.print(); });

    var copyBtn = result.querySelector("[data-rig-copy-list]");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        var listText = "🎧 MY OFFBEAT DJ RIG PLANNER LIST (" + PLACES[data.place].label + "):\n\n";
        data.items.forEach(function (i) {
          listText += "[ ] " + i.kind + ": " + i.name + " (" + i.band + ")\n    Why: " + i.why + "\n\n";
        });
        listText += "Estimated Total: " + money(data.low) + " – " + money(data.high) + "\n";
        listText += "Generated via Offbeat DJ Rig Planner: https://offbeatinc.com/build-your-dj-setup.html";

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(listText).then(function () {
            copyBtn.textContent = "Checklist Copied to Clipboard!";
            window.setTimeout(function () { copyBtn.textContent = "Copy Shopping Checklist"; }, 2500);
          }).catch(function () {
            copyBtn.textContent = "Checklist Copied!";
            window.setTimeout(function () { copyBtn.textContent = "Copy Shopping Checklist"; }, 2500);
          });
        }
      });
    }

    result.scrollIntoView({ behavior: "smooth", block: "start" });
    updateUrl(data);
  }

  function updateUrl(data) {
    if (!window.history || !history.replaceState) return;
    var params = "?place=" + encodeURIComponent(data.place) +
      "&budget=" + encodeURIComponent(data.budget) +
      "&software=" + encodeURIComponent(data.software) +
      "&owns=" + encodeURIComponent(data.owns.join(","));
    history.replaceState(null, "", location.pathname + params + "#rig-result");
  }

  /* --------------------------------------------------------------- events */
  function collectStep(index) {
    var step = steps[index];
    var key = step.getAttribute("data-rig-step");
    var values = selected(step);
    if (key === "owns") {
      state.owns = values;
      return true;
    }
    if (!values.length) {
      step.classList.add("is-missing");
      var message = step.querySelector(".rig-error");
      if (message) message.hidden = false;
      return false;
    }
    step.classList.remove("is-missing");
    state[key] = values[0];
    return true;
  }

  nextBtn.addEventListener("click", function () {
    if (!collectStep(current)) return;
    if (current < steps.length - 1) {
      showStep(current + 1);
      steps[current].scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      renderResult(buildResult());
    }
  });

  backBtn.addEventListener("click", function () {
    if (current > 0) showStep(current - 1);
  });

  form.addEventListener("change", function (event) {
    var step = event.target.closest(".rig-step");
    if (step) {
      step.classList.remove("is-missing");
      var message = step.querySelector(".rig-error");
      if (message) message.hidden = true;
    }
    var key = step && step.getAttribute("data-rig-step");
    if (key && key !== "owns") {
      window.setTimeout(function () {
        if (current < steps.length - 1) {
          if (collectStep(current)) showStep(current + 1);
        } else {
          if (collectStep(current)) renderResult(buildResult());
        }
      }, 140);
    }
  });

  showStep(0);

  /* Deep link handle */
  if (window.location.search.length > 1) {
    var params = new URLSearchParams(window.location.search);
    var pre = {
      place: params.get("place"),
      budget: params.get("budget"),
      software: params.get("software"),
      owns: (params.get("owns") || "").split(",").filter(Boolean)
    };
    if (pre.place && pre.budget && pre.software) {
      state = { place: pre.place, budget: pre.budget, software: pre.software, owns: pre.owns };
      renderResult(buildResult());
    }
  }

  /* Headless test handle */
  window.__rigBuilder = {
    state: state,
    buildResult: buildResult,
    renderResult: renderResult
  };
})();
