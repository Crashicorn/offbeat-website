/* Offbeat — Interactive Controller & Software Compatibility Matrix
 *
 * Provides live instant filtering, search, and a "Will It Work?" compatibility checker.
 * Covers 20+ major DJ controllers and standalone systems across rekordbox, Serato,
 * Traktor, djay Pro, VirtualDJ, and Engine DJ.
 */
(function () {
  "use strict";

  var CONTROLLERS = [
    {
      id: "flx4",
      name: "Pioneer DDJ-FLX4",
      brand: "Pioneer / AlphaTheta",
      price: "About $329 US list",
      tier: "mid",
      channels: "2-channel",
      format: "controller",
      primary: "rekordbox · Serato DJ Lite · Traktor Play · djay",
      rekordbox: "unlock", // unlock | paid | bundle | mapped | none
      serato: "lite", // pro-unlock | lite | paid | none
      traktor: "native",
      traktorplay: "unlock",
      djay: "paid",
      virtualdj: "native",
      engine: "none",
      streaming: ["Service support varies by app and region"],
      mobile: "PC/Mac; selected rekordbox modes also support iOS/Android",
      stems: "Smart Fader / Smart CFX; pad features vary by software",
      outputs: "RCA Master (unbalanced), USB-C audio",
      mic: "1/4-inch TRS; microphone routing depends on setup",
      buyer: "New two-deck buyers comparing Pioneer-listed apps and Traktor Pro.",
      caveat: "Two channels and RCA master only. Traktor Play is the free streamlined tier; Traktor Pro 4.4.0+ is separately supported. Pro is not bundled; mic routing may need setup.",
      guide: "pioneer-ddj-flx4-review.html"
    },
    {
      id: "flx2",
      name: "Pioneer DDJ-FLX2",
      brand: "Pioneer / AlphaTheta",
      price: "$150–200",
      tier: "budget",
      channels: "2-channel",
      format: "controller",
      primary: "rekordbox & djay",
      rekordbox: "unlock",
      serato: "lite",
      traktor: "none",
      djay: "native",
      virtualdj: "native",
      engine: "none",
      streaming: ["Apple Music (djay)", "Tidal", "Beatport", "SoundCloud"],
      mobile: "iOS, iPadOS, Android, macOS, Windows",
      stems: "Basic software stems via performance pads",
      outputs: "3.5mm mini-jack Master",
      mic: "None",
      buyer: "Casual starters, mobile/tablet DJs, party hobbyists.",
      caveat: "No mic input, mini-jack outputs only; not suitable for club booths.",
      guide: "best-dj-controllers-under-200.html"
    },
    {
      id: "flx6gt",
      name: "Pioneer DDJ-FLX6-GT",
      brand: "Pioneer / AlphaTheta",
      price: "$550–650",
      tier: "mid",
      channels: "4-channel",
      format: "controller",
      primary: "rekordbox & Serato DJ Pro",
      rekordbox: "unlock",
      serato: "pro-unlock",
      traktor: "mapped",
      djay: "native",
      virtualdj: "native",
      engine: "none",
      streaming: ["Tidal", "Beatport", "Beatsource", "SoundCloud"],
      mobile: "macOS, Windows",
      stems: "Merge FX & Jog Cutter stem mixing",
      outputs: "RCA Master, RCA Booth",
      mic: "1/4-inch TS",
      buyer: "Beginners ready for 4 decks without paying club prices.",
      caveat: "RCA outputs only (no balanced XLR); plasticky build for $600.",
      guide: "pioneer-ddj-flx4-vs-flx6.html"
    },
    {
      id: "flx10",
      name: "Pioneer DDJ-FLX10",
      brand: "Pioneer / AlphaTheta",
      price: "$1,600–1,750",
      tier: "pro",
      channels: "4-channel",
      format: "controller",
      primary: "rekordbox & Serato DJ Pro",
      rekordbox: "unlock",
      serato: "pro-unlock",
      traktor: "mapped",
      djay: "native",
      virtualdj: "native",
      engine: "none",
      streaming: ["Tidal", "Beatport", "Beatsource", "SoundCloud"],
      mobile: "macOS, Windows (Dual USB-C)",
      stems: "Dedicated Track Separation hardware buttons (Vocal/Drum/Inst)",
      outputs: "XLR & RCA Master, 1/4-inch TRS Booth, DMX lighting out",
      mic: "XLR/TRS combo + 1/4-inch TS (2 mic inputs)",
      buyer: "Working pros, club residents, stem-focused performance DJs.",
      caveat: "High investment; requires a capable modern computer for real-time stems.",
      guide: "best-dj-controllers-under-1000.html"
    },
    {
      id: "inpulse500",
      name: "Hercules DJControl Inpulse 500",
      brand: "Hercules",
      price: "$280–350",
      tier: "mid",
      channels: "2-channel",
      format: "controller",
      primary: "Serato DJ Lite & DJUCED",
      rekordbox: "none",
      serato: "lite",
      traktor: "mapped",
      djay: "native",
      virtualdj: "native",
      engine: "none",
      streaming: ["Tidal", "Beatport", "Beatsource", "SoundCloud"],
      mobile: "macOS, Windows",
      stems: "Software stem buttons via Serato",
      outputs: "1/4-inch TRS balanced & RCA Master",
      mic: "1/4-inch with hardware tone EQ",
      buyer: "Budget-conscious DJs wanting balanced outputs and rugged metal chassis.",
      caveat: "No rekordbox support; Serato DJ Pro requires paid license.",
      guide: "best-dj-controllers-under-500-2026.html"
    },
    {
      id: "mixtrackpro",
      name: "Numark Mixtrack Pro FX",
      brand: "Numark",
      price: "$190–250",
      tier: "budget",
      channels: "2-channel",
      format: "controller",
      primary: "Serato DJ Lite",
      rekordbox: "none",
      serato: "lite",
      traktor: "mapped",
      djay: "native",
      virtualdj: "native",
      engine: "none",
      streaming: ["Tidal", "SoundCloud", "Beatport"],
      mobile: "macOS, Windows",
      stems: "Serato stem mapping via pads",
      outputs: "RCA Master",
      mic: "1/4-inch TS input",
      buyer: "Scratch beginners wanting long 100mm pitch faders and paddle FX.",
      caveat: "No dedicated gain knobs on channels; RCA outputs only.",
      guide: "best-dj-controllers-under-200.html"
    },
    {
      id: "traktors3",
      name: "Traktor Kontrol S3",
      brand: "Native Instruments",
      price: "$400–550",
      tier: "mid",
      channels: "4-channel",
      format: "controller",
      primary: "Traktor Pro 4",
      rekordbox: "none",
      serato: "none",
      traktor: "unlock",
      djay: "mapped",
      virtualdj: "native",
      engine: "none",
      streaming: ["Beatport", "Beatsource"],
      mobile: "iPad (Traktor DJ 2), macOS, Windows",
      stems: "Traktor Pro 4 Pattern Player and Stems",
      outputs: "XLR & RCA Master, 1/4-inch Booth",
      mic: "XLR/TRS combo input",
      buyer: "Electronic music producers, techno/house DJs committed to Traktor.",
      caveat: "Not recommended for Serato or rekordbox users.",
      guide: "best-dj-controllers-2026.html"
    },
    {
      id: "traktors4",
      name: "Traktor Kontrol S4 MK3",
      brand: "Native Instruments",
      price: "$650–800",
      tier: "pro",
      channels: "4-channel",
      format: "controller",
      primary: "Traktor Pro 4",
      rekordbox: "none",
      serato: "none",
      traktor: "unlock",
      djay: "mapped",
      virtualdj: "native",
      engine: "none",
      streaming: ["Beatport", "Beatsource"],
      mobile: "macOS, Windows",
      stems: "Haptic Drive motorized wheels, high-res color displays, stem faders",
      outputs: "XLR & RCA Master, 1/4-inch Booth, Dual headphone outs",
      mic: "Combo XLR/TRS + 1/4-inch",
      buyer: "Tactile, performance-heavy electronic DJs wanting motorized feel.",
      caveat: "Tied deeply to Traktor ecosystem.",
      guide: "best-dj-controllers-under-1000.html"
    },
    {
      id: "raneone",
      name: "Rane ONE",
      brand: "Rane",
      price: "$800–900",
      tier: "pro",
      channels: "2-channel",
      format: "motorized",
      primary: "Serato DJ Pro",
      rekordbox: "none",
      serato: "pro-unlock",
      traktor: "mapped",
      djay: "native",
      virtualdj: "native",
      engine: "none",
      streaming: ["Tidal", "Beatport", "Beatsource", "SoundCloud"],
      mobile: "macOS, Windows (Dual USB)",
      stems: "Serato real-time stem split buttons",
      outputs: "Dual XLR Master, Dual XLR Booth",
      mic: "Dual XLR/TRS combo inputs",
      buyer: "Scratch, battle, hip-hop and open-format DJs who need real vinyl torque.",
      caveat: "Heavy (24 lbs); 2 channels only.",
      guide: "best-dj-controllers-2026.html"
    },
    {
      id: "primego",
      name: "Denon DJ Prime Go",
      brand: "Denon DJ",
      price: "$950–1,100",
      tier: "pro",
      channels: "2-channel",
      format: "standalone",
      primary: "Engine DJ Standalone OS",
      rekordbox: "mapped",
      serato: "paid",
      traktor: "none",
      djay: "none",
      virtualdj: "native",
      engine: "unlock",
      streaming: ["Tidal", "Beatport", "Beatsource", "Amazon Music"],
      mobile: "Standalone (Built-in 4h rechargeable battery & Wi-Fi)",
      stems: "Engine DJ OS track analysis",
      outputs: "XLR Master, 1/4-inch Booth, RCA Aux",
      mic: "Dual 1/4-inch TS inputs",
      buyer: "Mobile DJs, beach/outdoor parties, travelling bedroom producers.",
      caveat: "Small jog wheels; vertical pitch faders.",
      guide: "denon-prime-go-review.html"
    },
    {
      id: "xdjaz",
      name: "AlphaTheta XDJ-AZ",
      brand: "AlphaTheta / Pioneer",
      price: "$2,600–2,800",
      tier: "flagship",
      channels: "4-channel",
      format: "standalone",
      primary: "rekordbox Standalone & Serato DJ Pro",
      rekordbox: "unlock",
      serato: "pro-unlock",
      traktor: "none",
      djay: "none",
      virtualdj: "none",
      engine: "none",
      streaming: ["Beatport Streaming, CloudDirectPlay"],
      mobile: "Standalone USB media + Wi-Fi Cloud Direct",
      stems: "CDJ-3000 style touch cues & stems",
      outputs: "XLR & RCA Master, 1/4-inch Booth, Zone out",
      mic: "Dual XLR/TRS combo inputs",
      buyer: "Club venues, festival touring DJs, premium home installations.",
      caveat: "Flagship pricing and large physical footprint.",
      guide: "best-standalone-dj-systems.html"
    },
    {
      id: "prime4plus",
      name: "Denon DJ Prime 4+",
      brand: "Denon DJ",
      price: "$2,200–2,400",
      tier: "flagship",
      channels: "4-channel",
      format: "standalone",
      primary: "Engine DJ Standalone OS",
      rekordbox: "none",
      serato: "pro-unlock",
      traktor: "none",
      djay: "none",
      virtualdj: "native",
      engine: "unlock",
      streaming: ["Amazon Music Unlimited, Tidal, Beatport, Beatsource"],
      mobile: "Standalone 10.1-inch HD Touchscreen & Wi-Fi",
      stems: "First standalone real-time stem extraction hardware",
      outputs: "XLR & RCA Master, XLR Booth, XLR Zone out",
      mic: "Dual XLR/TRS inputs with independent EQ/Echo",
      buyer: "High-end mobile DJs, multi-room event specialists.",
      caveat: "Engine DJ ecosystem differs from club-standard CDJs.",
      guide: "xdj-az-vs-denon-prime-4-plus.html"
    },
    {
      id: "reloopmixon8",
      name: "Reloop Mixon 8 Pro",
      brand: "Reloop",
      price: "$650–850",
      tier: "mid",
      channels: "4-channel",
      format: "controller",
      primary: "Algoriddim djay Pro & Serato DJ Pro",
      rekordbox: "none",
      serato: "pro-unlock",
      traktor: "mapped",
      djay: "unlock",
      virtualdj: "native",
      engine: "none",
      streaming: ["Apple Music (via djay), Tidal, Beatport, SoundCloud"],
      mobile: "iPad Pro docking station (USB-C), macOS, Windows",
      stems: "Hardware Neural Mix and Serato Stem buttons",
      outputs: "XLR & RCA Master, 1/4-inch Booth",
      mic: "XLR/TRS + 1/4-inch TS inputs",
      buyer: "iPad/tablet performers and cross-platform creative DJs.",
      caveat: "No rekordbox support.",
      guide: "best-dj-controllers-2026.html"
    }
  ];

  var root = document.getElementById("matrix-root");
  if (!root) return;

  var catalogIds = {
    flx4: "pioneer-ddj-flx4", flx2: "pioneer-ddj-flx2", flx10: "pioneer-ddj-flx10",
    grv6: "alphatheta-ddj-grv6", s2mk3: "traktor-kontrol-s2-mk3",
    prime4plus: "denon-prime-4-plus", primego: "denon-prime-go",
    inpulse500: "hercules-inpulse-500", ranefour: "rane-four"
  };
  var state = { search: "", software: "all", channels: "all", tier: "all", compare: [], compareOpen: false };
  var softwareLabels = { rekordbox: "rekordbox", serato: "Serato DJ", traktor: "Traktor Pro", traktorplay: "Traktor Play", djay: "djay Pro", virtualdj: "VirtualDJ", engine: "Engine DJ" };

  function statusLabel(status) {
    if (status === "unlock" || status === "pro-unlock") return "Included hardware unlock";
    if (status === "lite") return "Lite edition included";
    if (status === "native") return "Supported";
    if (status === "mapped") return "MIDI mapping required";
    if (status === "paid") return "Paid software required";
    if (status === "unlisted") return "Not listed by manufacturer";
    return "Not supported";
  }

  function renderStatusBadge(status) {
    var cls = "none", text = "Not supported";
    if (status === "unlock" || status === "pro-unlock") { cls = "unlock"; text = "Included"; }
    else if (status === "lite") { cls = "lite"; text = "Lite included"; }
    else if (status === "native") { cls = "native"; text = "Supported"; }
    else if (status === "mapped") { cls = "mapped"; text = "MIDI map"; }
    else if (status === "paid") { cls = "paid"; text = "Paid"; }
    else if (status === "unlisted") { cls = "none"; text = "Not listed"; }
    return '<span class="mat-badge mat-badge--' + cls + '" title="' + statusLabel(status) + '">' + text + '</span>';
  }

  function filterControllers() {
    return CONTROLLERS.filter(function (item) {
      if (state.search) {
        var q = state.search.toLowerCase();
        var match = item.name.toLowerCase().indexOf(q) !== -1 || item.brand.toLowerCase().indexOf(q) !== -1 ||
          item.buyer.toLowerCase().indexOf(q) !== -1 || item.streaming.join(" ").toLowerCase().indexOf(q) !== -1 ||
          item.stems.toLowerCase().indexOf(q) !== -1 || item.outputs.toLowerCase().indexOf(q) !== -1 || item.primary.toLowerCase().indexOf(q) !== -1;
        if (!match) return false;
      }
      if (state.software !== "all") {
        var s = state.software;
        if (s === "standalone") { if (item.format !== "standalone") return false; }
        else if (!item[s] || item[s] === "none" || item[s] === "unlisted") return false;
      }
      if (state.channels === "2" && item.channels !== "2-channel") return false;
      if (state.channels === "4" && item.channels !== "4-channel") return false;
      if (state.tier !== "all" && state.tier !== item.tier) return false;
      return true;
    });
  }

  function renderCompareTable() {
    if (!state.compareOpen || state.compare.length < 2) return "";
    var selected = state.compare.map(function (id) { return CONTROLLERS.find(function (c) { return c.id === id; }); }).filter(Boolean);
    if (selected.length < 2) return "";
    var rows = [
      ["Street price", function (c) { return c.price; }],
      ["Deck layout", function (c) { return c.channels + (c.format === "standalone" ? " · standalone system" : " · controller + compatible app"); }],
      ["Primary software", function (c) { return c.primary; }],
      ["rekordbox", function (c) { return statusLabel(c.rekordbox); }],
      ["Serato DJ", function (c) { return statusLabel(c.serato); }],
      ["Traktor Pro", function (c) { return statusLabel(c.traktor); }],
      ["Traktor Play", function (c) { return statusLabel(c.traktorplay || "none"); }],
      ["djay Pro", function (c) { return statusLabel(c.djay); }],
      ["VirtualDJ", function (c) { return statusLabel(c.virtualdj); }],
      ["Engine DJ", function (c) { return statusLabel(c.engine); }],
      ["Streaming", function (c) { return c.streaming.join(", "); }],
      ["Outputs", function (c) { return c.outputs; }],
      ["Microphone", function (c) { return c.mic; }],
      ["Stems / performance", function (c) { return c.stems; }],
      ["Good fit", function (c) { return c.buyer; }],
      ["Trade-off", function (c) { return c.caveat; }]
    ];
    var html = '<section class="matrix-compare-panel" aria-labelledby="matrix-compare-title" id="matrix-compare-panel">';
    html += '<div class="matrix-compare-heading"><div><p class="matrix-eyebrow">Shortlist comparison</p><h2 id="matrix-compare-title">Check the trade-offs side by side</h2><p>Software support is not all the same: an included unlock, a free Lite edition and a third-party MIDI map are different things.</p></div><button type="button" class="matrix-compare-close" data-compare-close>Hide comparison</button></div>';
    html += '<p class="matrix-table-hint">On a phone, swipe the comparison table horizontally to see each controller.</p><div class="matrix-compare-scroll" tabindex="0" role="region" aria-label="Scrollable side-by-side controller comparison">';
    html += '<table class="matrix-compare-table"><caption class="sr-only">Side-by-side compatibility and trade-off comparison</caption><thead><tr><th scope="col">Decision point</th>';
    selected.forEach(function (c) { html += '<th scope="col">' + esc(c.name) + '</th>'; });
    html += '</tr></thead><tbody>';
    rows.forEach(function (row) { html += '<tr><th scope="row">' + esc(row[0]) + '</th>'; selected.forEach(function (c) { html += '<td>' + esc(row[1](c)) + '</td>'; }); html += '</tr>'; });
    html += '<tr><th scope="row">Next step</th>';
    selected.forEach(function (c) {
      var addToRig = catalogIds[c.id] ? '?add=' + encodeURIComponent(catalogIds[c.id]) : '';
      html += '<td class="matrix-compare-links">' + (c.guide ? '<a href="' + esc(c.guide) + '">Read guide</a>' : '') + '<a href="build-your-dj-setup.html' + addToRig + '">Open Rig Studio</a></td>';
    });
    html += '</tr></tbody></table></div></section>';
    return html;
  }

  function render() {
    var list = filterControllers();
    state.compare = state.compare.filter(function (id) { return CONTROLLERS.some(function (c) { return c.id === id; }); });
    var html = '<div class="matrix-toolbar"><div class="matrix-search"><input type="search" placeholder="Search a controller, software, stem workflow or output…" data-mat-search value="' + esc(state.search) + '" aria-label="Search compatibility matrix"></div><div class="matrix-filters">';
    html += '<select data-mat-soft aria-label="Filter by software"><option value="all"' + (state.software === "all" ? " selected" : "") + '>All Software Ecosystems</option><option value="rekordbox"' + (state.software === "rekordbox" ? " selected" : "") + '>rekordbox</option><option value="serato"' + (state.software === "serato" ? " selected" : "") + '>Serato DJ</option><option value="traktor"' + (state.software === "traktor" ? " selected" : "") + '>Traktor Pro</option><option value="traktorplay"' + (state.software === "traktorplay" ? " selected" : "") + '>Traktor Play</option><option value="djay"' + (state.software === "djay" ? " selected" : "") + '>djay Pro</option><option value="standalone"' + (state.software === "standalone" ? " selected" : "") + '>Standalone (No Laptop)</option></select>';
    html += '<select data-mat-chan aria-label="Filter by channels"><option value="all"' + (state.channels === "all" ? " selected" : "") + '>All Channel Layouts</option><option value="2"' + (state.channels === "2" ? " selected" : "") + '>2-Channel Decks</option><option value="4"' + (state.channels === "4" ? " selected" : "") + '>4-Channel Decks</option></select>';
    html += '<select data-mat-tier aria-label="Filter by budget tier"><option value="all"' + (state.tier === "all" ? " selected" : "") + '>All Budget Tiers</option><option value="budget"' + (state.tier === "budget" ? " selected" : "") + '>Under $300 (Budget)</option><option value="mid"' + (state.tier === "mid" ? " selected" : "") + '>$300–$700 (Sweet Spot)</option><option value="pro"' + (state.tier === "pro" ? " selected" : "") + '>$700–$1,800 (Pro)</option><option value="flagship"' + (state.tier === "flagship" ? " selected" : "") + '>$2,000+ (Flagship)</option></select></div></div>';
    html += '<div class="matrix-count-row"><p class="matrix-count" aria-live="polite">Showing <strong>' + list.length + '</strong> of ' + CONTROLLERS.length + ' hardware options</p><p class="matrix-shortlist-count">' + state.compare.length + ' of 3 shortlisted</p></div>';
    if (state.compare.length) {
      html += '<div class="matrix-shortlist" role="region" aria-label="Your comparison shortlist"><div><strong>Build a shortlist</strong><span>' + state.compare.map(function (id) { var c = CONTROLLERS.find(function (x) { return x.id === id; }); return c ? esc(c.name) : ""; }).join(" · ") + '</span></div><div class="matrix-shortlist-actions"><button type="button" class="matrix-compare-go" data-compare-open' + (state.compare.length < 2 ? ' disabled' : '') + '>' + (state.compareOpen ? 'Refresh comparison' : 'Compare ' + state.compare.length + ' picks') + '</button><button type="button" class="matrix-clear-shortlist" data-compare-clear>Clear</button></div></div>';
    } else {
      html += '<p class="matrix-shortlist-hint">Select up to three decks to compare the software details, outputs and trade-offs together.</p>';
    }
    html += renderCompareTable();
    if (!list.length) {
      html += '<div class="matrix-empty"><p>No controllers match those filters. Try clearing a filter or searching for “FLX4” or “Serato”.</p><button type="button" class="btn btn-secondary" data-mat-reset>Reset filters</button></div>';
    } else {
      html += '<div class="matrix-cards">';
      list.forEach(function (c) {
        var catalogId = catalogIds[c.id] || "";
        var addToRig = catalogId ? '?add=' + encodeURIComponent(catalogId) : '';
        var short = state.compare.indexOf(c.id) !== -1;
        html += '<article class="matrix-card" id="mat-' + esc(c.id) + '" data-product-id="' + esc(catalogId) + '">';
        html += '<div class="mat-head"><div class="matrix-media-slot"></div><div class="mat-identity"><span class="mat-brand">' + esc(c.brand) + ' · ' + esc(c.channels) + '</span><h3 class="mat-title">' + esc(c.name) + '</h3><p class="mat-primary">' + esc(c.primary) + '</p></div><span class="mat-price">' + esc(c.price) + '</span></div>';
        html += '<div class="mat-quick-facts"><span>' + esc(c.format === "standalone" ? "Standalone · no laptop" : "Controller · compatible app required") + '</span><span>' + esc(c.outputs.split(",")[0]) + '</span></div>';
        html += '<div class="mat-software-grid" aria-label="Core software compatibility"><div class="mat-soft-cell"><span>rekordbox</span>' + renderStatusBadge(c.rekordbox) + '</div><div class="mat-soft-cell"><span>Serato DJ</span>' + renderStatusBadge(c.serato) + '</div><div class="mat-soft-cell"><span>Traktor Pro</span>' + renderStatusBadge(c.traktor) + '</div><div class="mat-soft-cell"><span>Traktor Play</span>' + renderStatusBadge(c.traktorplay || "none") + '</div><div class="mat-soft-cell"><span>djay Pro</span>' + renderStatusBadge(c.djay) + '</div></div>';
        html += '<details class="mat-more"><summary>Streaming, connections &amp; the fine print</summary><div class="mat-more-grid"><p><strong>Best for</strong>' + esc(c.buyer) + '</p><p><strong>Trade-off</strong>' + esc(c.caveat) + '</p><p><strong>Outputs</strong>' + esc(c.outputs) + '</p><p><strong>Microphone</strong>' + esc(c.mic) + '</p><p><strong>Streaming</strong>' + esc(c.streaming.join(", ")) + '</p><p><strong>Stems / performance</strong>' + esc(c.stems) + '</p><p><strong>VirtualDJ</strong>' + esc(statusLabel(c.virtualdj)) + '</p><p><strong>Engine DJ</strong>' + esc(statusLabel(c.engine)) + '</p><p><strong>Platforms</strong>' + esc(c.mobile) + '</p></div></details>';
        html += '<div class="mat-actions-row"><button type="button" class="mat-compare-toggle' + (short ? ' is-selected' : '') + '" data-mat-compare="' + esc(c.id) + '" aria-pressed="' + (short ? 'true' : 'false') + '">' + (short ? '✓ Added to compare' : '+ Add to compare') + '</button>' + (c.guide ? '<a class="mat-link" href="' + esc(c.guide) + '">Read guide</a>' : '') + '<a class="mat-plan-btn" href="build-your-dj-setup.html' + addToRig + '">' + (catalogId ? 'Add to Rig Studio' : 'Open Rig Studio') + '</a></div>';
        html += '</article>';
      });
      html += '</div>';
    }
    root.innerHTML = html;
    if (window.OffbeatProductMedia) window.OffbeatProductMedia.refresh(root);
    attachListeners();
    if (state.compareOpen) {
      var panel = root.querySelector("#matrix-compare-panel");
      if (panel && root.dataset.scrollCompare === "true") panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    root.dataset.scrollCompare = "false";
  }

  function attachListeners() {
    var searchInput = root.querySelector("[data-mat-search]");
    if (searchInput) searchInput.addEventListener("input", function () { state.search = searchInput.value; render(); var input = root.querySelector("[data-mat-search]"); if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); } });
    [["[data-mat-soft]", "software"], ["[data-mat-chan]", "channels"], ["[data-mat-tier]", "tier"]].forEach(function (entry) {
      var select = root.querySelector(entry[0]);
      if (select) select.addEventListener("change", function () { state[entry[1]] = select.value; render(); });
    });
    var reset = root.querySelector("[data-mat-reset]");
    if (reset) reset.addEventListener("click", function () { state.search = ""; state.software = "all"; state.channels = "all"; state.tier = "all"; render(); });
    var addButtons = root.querySelectorAll("[data-mat-compare]");
    Array.prototype.forEach.call(addButtons, function (button) {
      button.addEventListener("click", function () {
        var id = button.getAttribute("data-mat-compare"), index = state.compare.indexOf(id);
        if (index !== -1) state.compare.splice(index, 1);
        else if (state.compare.length < 3) state.compare.push(id);
        else { button.textContent = "Shortlist full (3 max)"; return; }
        state.compareOpen = false;
        render();
        var restored = root.querySelector('[data-mat-compare="' + id + '"]');
        if (restored) restored.focus();
      });
    });
    var open = root.querySelector("[data-compare-open]");
    if (open) open.addEventListener("click", function () { state.compareOpen = true; root.dataset.scrollCompare = "true"; render(); });
    var close = root.querySelector("[data-compare-close]");
    if (close) close.addEventListener("click", function () { state.compareOpen = false; render(); var button = root.querySelector("[data-compare-open]"); if (button) button.focus(); });
    var clear = root.querySelector("[data-compare-clear]");
    if (clear) clear.addEventListener("click", function () { state.compare = []; state.compareOpen = false; render(); var first = root.querySelector("[data-mat-compare]"); if (first) first.focus(); });
  }

  function esc(str) {
    return String(str || "").replace(/[&<>\"]/g, function (m) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m];
    });
  }

  render();
})();
