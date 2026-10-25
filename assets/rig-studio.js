/* =============================================================================
   Offbeat — Rig Studio
   Equipment discovery → comparison → rig planning → shopping list, in one place.
   Vanilla JS, no dependencies, no network calls beyond the local gear catalog.

   Sections
     1. Icons & helpers
     2. Catalog + rig state
     3. Compatibility engine (cable plan, essentials, readiness)
     4. Renders: start screen, studio, signal map, gear list, shopping list
     5. Drawer (swap / compare / details)
     6. Modals (save, share, compare builds, guided setup)
     7. Events, persistence, boot
   ========================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------------ 1. Icons */
  var ICONS = {
    controller: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="7.5" width="19" height="11" rx="2.2"/><circle cx="7.6" cy="13" r="2.2"/><circle cx="16.4" cy="13" r="2.2"/><path d="M11 9.6h2M11.2 16.4h1.6"/><path d="M4.6 18.5v1.6M19.4 18.5v1.6"/></svg>',
    headphones: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14v-2a8 8 0 1 1 16 0v2"/><rect x="2.6" y="13.6" width="4.4" height="6.4" rx="1.6"/><rect x="17" y="13.6" width="4.4" height="6.4" rx="1.6"/></svg>',
    speaker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5.5" y="2.6" width="13" height="18.8" rx="2"/><circle cx="12" cy="8.6" r="2"/><circle cx="12" cy="16" r="3.1"/></svg>',
    laptop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="10.4" rx="1.6"/><path d="M2.4 18.4h19.2"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2.6" width="6" height="10.4" rx="3"/><path d="M5.6 11.4a6.4 6.4 0 0 0 12.8 0M12 18v3.4M8.6 21.4h6.8"/></svg>',
    stand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4.4h16M6.6 4.4 12 12l5.4-7.6M12 12v8.2M8 20.6h8"/></svg>',
    usb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="6.4" y="2.8" width="11.2" height="12.4" rx="2"/><path d="M10 18.4v2.8h4v-2.8M9.6 6.4h4.8"/></svg>',
    cable: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4.2h3.4v3.4H4zM16.6 16.4H20v3.4h-3.4z"/><path d="M7.4 5.9h4.2a3.2 3.2 0 0 1 3.2 3.2v3.4a3.2 3.2 0 0 0 3.2 3.2h1.6"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.6l4.6 4.6L19.5 6.8"/></svg>',
    spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.2L19 10l-5.1 1.8L12 17l-1.9-5.2L5 10l5.1-1.8z"/></svg>',
    wand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4.5l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1z"/><path d="M13.4 13.2 4 22.4"/><path d="M6.2 3.4l.7 1.7 1.7.7-1.7.7-.7 1.7-.7-1.7-1.7-.7 1.7-.7z"/></svg>',
    cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.6 3.4h2.6l2.4 11h10.2l2.2-7.6H6"/><circle cx="9.4" cy="19.4" r="1.6"/><circle cx="17.4" cy="19.4" r="1.6"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.4v11"/><path d="M7.8 7.4 12 3.2l4.2 4.2"/><path d="M5 13.6v5.2a1.8 1.8 0 0 0 1.8 1.8h10.4a1.8 1.8 0 0 0 1.8-1.8v-5.2"/></svg>',
    save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3.6h10.6L20.4 8.4V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4.6a1 1 0 0 1 1-1z"/><path d="M8 3.6v5.8h7.4M8 21v-6.4h8V21"/></svg>',
    compare: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M3.4 7.4h6M3.4 7.4 6 3.6l2.6 3.8"/><path d="M20.6 16.6h-6M20.6 16.6 18 12.8l-2.6 3.8"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4.4v14.2M6.6 13.2 12 18.6l5.4-5.4"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="8.4" y="8.4" width="12" height="12" rx="2"/><path d="M15.6 5.4H5.6a2 2 0 0 0-2 2v10"/></svg>',
    print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 8.4V3.4h10v5"/><rect x="4" y="8.4" width="16" height="7.6" rx="1.6"/><path d="M7 16h10v4.6H7z"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="6" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="18" cy="12" r="1.7"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.6 21.4 20H2.6z"/><path d="M12 9.6v4.6M12 17.2v.1"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 10.6v6M12 7.6v.1"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4.4 6.6h15.2M9.4 6.6V4.4h5.2v2.2M6.6 6.6l.9 13a1.6 1.6 0 0 0 1.6 1.4h5.8a1.6 1.6 0 0 0 1.6-1.4l.9-13"/></svg>',
    restart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 3.6v4.8h4.8"/></svg>',
    route: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4.4v9.2a3.4 3.4 0 0 0 3.4 3.4h5.2"/><path d="M11.8 13.4 15 16.6l-3.2 3.2"/><circle cx="6" cy="3.2" r="1.6"/></svg>',
    layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.4 3 8l9 4.6L21 8z"/><path d="M3 12.4 12 17l9-4.6M3 16.6 12 21.2l9-4.6"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="11" cy="11" r="6.4"/><path d="M15.8 15.8 20.4 20.4"/></svg>',
    external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4.4h5.6V10"/><path d="M19.6 4.4 11.4 12.6"/><path d="M18 14.6v4a1.8 1.8 0 0 1-1.8 1.8H5.4a1.8 1.8 0 0 1-1.8-1.8V7.8A1.8 1.8 0 0 1 5.4 6h4"/></svg>',
    volume: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.4h3.4L12 5v14l-4.6-4.4H4z"/><path d="M16 9.4a3.6 3.6 0 0 1 0 5.2"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4.4h6a2.6 2.6 0 0 1 2 2.6v12a2.2 2.2 0 0 0-2-1.6H4z"/><path d="M20 4.4h-6a2.6 2.6 0 0 0-2 2.6v12a2.2 2.2 0 0 1 2-1.6h6z"/></svg>'
  };

  var CAT_ICON = {
    controllers: "controller", laptops: "laptop", headphones: "headphones", speakers: "speaker",
    microphones: "mic", cables: "cable", stands: "stand", storage: "usb"
  };

  /* Role order follows a real signal chain, not the catalog's alphabetical order. */
  var ROLE_ORDER = ["controllers", "laptops", "headphones", "speakers", "cables", "microphones", "stands", "storage"];

  var ROLE_LABEL = {
    controllers: "Decks & mixer",
    laptops: "Host & software",
    headphones: "Cue / headphones",
    speakers: "Output / speakers",
    cables: "Cables & adapters",
    microphones: "Microphones",
    stands: "Stands & risers",
    storage: "Media & drives"
  };

  var ROLE_HINT = {
    controllers: "The deck everything plugs into",
    laptops: "Runs your software, or no laptop at all",
    headphones: "How you hear the next track privately",
    speakers: "What the room hears",
    cables: "The part nobody remembers to buy",
    microphones: "Weddings, parties and hosting",
    stands: "Laptop risers and booth height",
    storage: "USB drives for standalone decks and CDJs"
  };

  var EMPTY_HINT = {
    controllers: ["Choose a controller", "Start with the deck your software runs on"],
    laptops: ["Add a laptop — or go standalone", "Controllers need a host; standalone decks do not"],
    headphones: ["Add headphones", "Closed-back cans with a cue output"],
    speakers: ["Add speakers", "Monitors for a room, PA for a party"],
    cables: ["Add the connecting cable", "Matched to your outputs and inputs"],
    microphones: ["Add a microphone", "Only needed if you host or MC"],
    stands: ["Add a laptop stand", "Cheap ergonomics; saves your neck"],
    storage: ["Add a USB drive", "Required if you play on standalone gear"]
  };

  /* --------------------------------------------------------- 2. State */
  var CATALOG = null;
  var root = document.getElementById("rig-app-root");
  var drawerRoot = null;
  var modalRoot = null;
  var toastRoot = null;
  var soundOn = false;

  var state = {
    view: "start",
    name: "My setup",
    items: [],
    ribbon: null,
    drawer: null,
    modal: null,
    quiz: null,
    menuOpen: false
  };

  var STORAGE_KEY = "offbeat.rig.v2";
  var LEGACY_KEY = "offbeat.rig.active";
  var SAVED_KEY = "offbeat.rigs.saved";

  function money(n) {
    var v = Math.round(Number(n) || 0);
    return "$" + v.toLocaleString("en-US");
  }
  function extend(base, extra) {
    var out = {};
    Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    Object.keys(extra || {}).forEach(function (k) { out[k] = extra[k]; });
    return out;
  }
  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  function icon(name) {
    return '<span class="rs-icon" aria-hidden="true">' + (ICONS[name] || "") + "</span>";
  }
  function catIcon(cat) { return ICONS[CAT_ICON[cat]] || ICONS.layers; }
  function byId(id) {
    if (!CATALOG) return null;
    for (var i = 0; i < CATALOG.items.length; i++) if (CATALOG.items[i].id === id) return CATALOG.items[i];
    return null;
  }
  function catMeta(cat) {
    for (var i = 0; i < CATALOG.categories.length; i++) if (CATALOG.categories[i].id === cat) return CATALOG.categories[i];
    return null;
  }
  function presets() { return (CATALOG && CATALOG.presets) || []; }
  function slotsOf(cat) { return state.items.filter(function (s) { return s.category === cat; }); }
  function slotById(id) {
    for (var i = 0; i < state.items.length; i++) if (state.items[i].slotId === id) return state.items[i];
    return null;
  }
  function itemOf(slot) { return slot ? byId(slot.itemId) : null; }
  function newSlot(category, itemId, owned) {
    return {
      slotId: "s-" + category + "-" + Math.random().toString(36).slice(2, 8),
      category: category, itemId: itemId || null, qty: 1, owned: Boolean(owned)
    };
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        name: state.name,
        items: state.items,
        view: state.view
      }));
    } catch (e) { /* storage may be blocked; the rig still works in memory */ }
  }

  function loadSavedRigs() {
    try {
      var raw = JSON.parse(localStorage.getItem(SAVED_KEY));
      if (Array.isArray(raw)) return raw;
    } catch (e) { /* ignore */ }
    return [];
  }
  function writeSavedRigs(list) {
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(list.slice(0, 20))); } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------ 3. Compatibility engine */
  function outputsText(controller) {
    return ((controller && controller.master_outputs) || []).join(" ").toLowerCase();
  }
  function inputsText(speaker) {
    return ((speaker && speaker.inputs) || []).join(" ").toLowerCase();
  }

  /* Which cable does this controller → speaker pairing actually need? */
  function cableFor(controller, speaker) {
    if (!controller || !speaker) return { type: null, itemId: null, label: "—", name: "unknown pairing" };
    var out = outputsText(controller);
    var inp = inputsText(speaker);
    var outXLR = /xlr|booth/.test(out);
    var outRCA = /rca/.test(out);
    var outTRS = /trs|1\/4/.test(out);
    var outAux = /3\.5mm|aux/.test(out);
    var inXLR = /xlr/.test(inp);
    var inRCA = /rca/.test(inp);
    var inTRS = /trs|1\/4|combo/.test(inp);

    if (outXLR && inXLR) return { type: "xlr", itemId: "cable-xlr-xlr", label: "XLR", name: "balanced XLR pair" };
    if (outRCA && inRCA) return { type: "rca", itemId: "cable-rca-rca", label: "RCA", name: "dual RCA cable" };
    if (outRCA && inTRS) return { type: "rca-trs", itemId: "cable-rca-trs", label: "RCA → 1/4\"", name: "dual RCA to dual 1/4\" TS cable" };
    if (outTRS && inXLR) return { type: "trs-xlr", itemId: "cable-xlr-xlr", label: "1/4\" → XLR", name: "1/4\" TRS to XLR cable" };
    if (outTRS && inTRS) return { type: "trs", itemId: "cable-rca-trs", label: "1/4\" TS", name: "dual 1/4\" TS cable" };
    if (outAux && inRCA) return { type: "aux-rca", itemId: null, label: "3.5 mm → RCA", name: "3.5 mm to dual RCA cable" };
    if (outAux && inTRS) return { type: "aux-trs", itemId: null, label: "3.5 mm → 1/4\"", name: "3.5 mm to dual 1/4\" cable" };
    if (outRCA && inXLR) return { type: "rca-xlr", itemId: null, label: "RCA → XLR", name: "dual RCA to XLR cable" };
    return { type: "unknown", itemId: null, label: "check jacks", name: "cable you will need to confirm" };
  }

  /* One cable run covers one stereo pair, or one mono speaker. */
  function runsFor(slot) {
    return slot.qty || 1;
  }

  /* Base64 that survives a query string (+ and / would be mangled). */
  function encodePayload(obj) {
    var json = JSON.stringify(obj);
    var b64 = btoa(unescape(encodeURIComponent(json)));
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function decodePayload(str) {
    var b64 = str.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  }

  function cableRunsAvailable(itemId) {
    if (!itemId) return 0;
    return state.items.reduce(function (sum, slot) {
      return slot.category === "cables" && slot.itemId === itemId ? sum + (slot.qty || 1) : sum;
    }, 0);
  }

  function computeRig() {
    var groups = {};
    ROLE_ORDER.forEach(function (cat) { groups[cat] = []; });

    var value = 0, ownedValue = 0, buyTotal = 0, itemCount = 0, buyCount = 0, ownedCount = 0;
    state.items.forEach(function (slot) {
      var item = itemOf(slot);
      var line = { slot: slot, item: item, qty: slot.qty || 1, lineTotal: item ? item.price * (slot.qty || 1) : 0 };
      if (groups[slot.category]) groups[slot.category].push(line);
      if (!item) return;
      value += line.lineTotal;
      itemCount += line.qty;
      if (slot.owned) { ownedValue += line.lineTotal; ownedCount += line.qty; }
      else { buyTotal += line.lineTotal; buyCount += line.qty; }
    });

    var controllerSlots = slotsOf("controllers").filter(function (s) { return s.itemId; });
    var hostSlots = slotsOf("laptops").filter(function (s) { return s.itemId; });
    var speakerSlots = slotsOf("speakers").filter(function (s) { return s.itemId; });
    var hpSlots = slotsOf("headphones").filter(function (s) { return s.itemId; });
    var micSlots = slotsOf("microphones").filter(function (s) { return s.itemId; });
    var storeSlots = slotsOf("storage").filter(function (s) { return s.itemId; });

    var controller = itemOf(controllerSlots[0]);
    var host = itemOf(hostSlots[0]);
    var speakers = speakerSlots.map(function (s) { return { slot: s, item: itemOf(s) }; });
    var headphones = itemOf(hpSlots[0]);

    /* -- cable plan per speaker slot -- */
    var cablePlan = speakers.map(function (entry) {
      var plan = cableFor(controller, entry.item);
      var needed = runsFor(entry.slot, entry.item);
      return {
        slot: entry.slot, speaker: entry.item, plan: plan, needed: needed,
        available: cableRunsAvailable(plan.itemId)
      };
    });
    var totalRunsNeeded = cablePlan.reduce(function (n, p) { return n + p.needed; }, 0);
    var primaryPlan = cablePlan[0] ? cablePlan[0].plan : null;
    var sameCableId = primaryPlan && primaryPlan.itemId;

    var checks = [];
    var warnings = 0, blockers = 0;

    /* 1. Decks */
    if (controller) {
      checks.push({ key: "decks", level: "ok", weight: 3, title: "Decks: " + controller.brand + " " + controller.model,
        note: controller.channels + "-channel, unlocks " + (controller.software_unlocks || []).slice(0, 2).join(" and ") + "." });
    } else {
      blockers++;
      checks.push({ key: "decks", level: "bad", weight: 3, title: "No decks in the rig yet",
        note: "Every other choice depends on this one. Start with the controller or standalone system.",
        action: { kind: "pick-cat", cat: "controllers", label: "Choose a controller" } });
    }

    /* 2. Host */
    if (controller && controller.standalone) {
      checks.push({ key: "host", level: "ok", weight: 2, title: "No laptop needed",
        note: controller.model + " runs its own operating system straight from USB." });
    } else if (controller && !host) {
      blockers++;
      checks.push({ key: "host", level: "bad", weight: 2, title: "This controller needs a host",
        note: controller.model + " is a MIDI surface: it needs a laptop running " + ((controller.software_unlocks || [])[0] || "DJ software") + ".",
        action: { kind: "pick-cat", cat: "laptops", label: "Add a laptop" } });
    } else if (controller && host && host.id === "standalone-usb-only") {
      blockers++;
      checks.push({ key: "host", level: "bad", weight: 2, title: "Wrong host for this controller",
        note: controller.model + " has no internal computer, so \u201Cno laptop\u201D cannot work here.",
        action: { kind: "swap-cat", cat: "laptops", itemId: "windows-dj-laptop", label: "Swap in a laptop" } });
    } else if (host && controller) {
      checks.push({ key: "host", level: "ok", weight: 2, title: "Host: " + host.model,
        note: "USB into the controller; the deck handles audio output and cueing." });
    }

    /* 3. Headphones */
    if (headphones) {
      checks.push({ key: "cue", level: "ok", weight: 2, title: "Cue: " + headphones.model,
        note: "Closed-back monitoring for the next track." });
    } else if (controller) {
      blockers++;
      checks.push({ key: "cue", level: "bad", weight: 2, title: "No headphones",
        note: "You cannot cue the next record without them. This is the cheapest essential in the rig.",
        action: { kind: "swap-cat", cat: "headphones", itemId: "pioneer-hdj-cue1", label: "Add HDJ-CUE1 · $69" } });
    }

    /* 4. Output */
    if (speakers.length) {
      var outputNote = speakers.map(function (s) {
        var p = cablePlan.filter(function (c) { return c.slot.slotId === s.slot.slotId; })[0];
        return s.item.model + (p ? " via " + p.plan.label : "");
      }).join(" · ");
      checks.push({ key: "output", level: "ok", weight: 2, title: "Output: " + outputNote,
        note: speakers.length > 1 ? "Two outputs is a stereo rig — plan for one cable run each." : "Add a second speaker when you want true stereo in a bigger room." });
    } else if (controller) {
      warnings++;
      checks.push({ key: "output", level: "warn", weight: 1, title: "Headphones-only practice rig",
        note: "Fine for quiet practice. Add monitors when you want to hear how the mix behaves in a room.",
        action: { kind: "swap-cat", cat: "speakers", itemId: "pioneer-dm40d", label: "Add DM-40D pair · $149" } });
    }

    /* 5. Cables — aggregate the runs each speaker path needs, per cable type */
    if (controller && speakers.length) {
      var needsByCable = {};
      cablePlan.forEach(function (p) {
        if (!p.plan.itemId) return;
        needsByCable[p.plan.itemId] = (needsByCable[p.plan.itemId] || 0) + p.needed;
      });
      var cableIds = Object.keys(needsByCable);
      var unknownPlan = cablePlan.filter(function (p) { return !p.plan.itemId; })[0];
      var totalRuns = cableIds.reduce(function (n, id) { return n + needsByCable[id]; }, 0);
      var missingRuns = 0, missingMoney = 0, haveRuns = 0, firstMissing = null;
      cableIds.forEach(function (id) {
        var need = needsByCable[id];
        var have = cableRunsAvailable(id);
        haveRuns += Math.min(have, need);
        if (have < need) {
          missingRuns += need - have;
          missingMoney += ((byId(id) || {}).price || 0) * (need - have);
          if (!firstMissing) firstMissing = { id: id, need: need - have };
        }
      });

      if (unknownPlan) {
        warnings++;
        checks.push({ key: "cables", level: "warn", weight: 2, title: "Cable needs checking",
          note: controller.model + " and " + unknownPlan.speaker.model + " do not share a cable type in our catalog. You need " + unknownPlan.plan.name + " — confirm the jacks before ordering.",
          action: { kind: "pick-cat", cat: "cables", label: "Choose a cable" } });
      } else if (missingRuns === 0) {
        checks.push({ key: "cables", level: "ok", weight: 2, title: "Cables matched: " + totalRuns + " " + (totalRuns === 1 ? "run" : "runs"),
          note: "Every speaker path in the rig has the cable it needs, and the count is right." });
      } else if (haveRuns > 0) {
        warnings++;
        checks.push({ key: "cables", level: "warn", weight: 2, title: "Short on cable runs",
          note: "The rig needs " + totalRuns + " and has " + haveRuns + ". The missing runs cost about " + money(missingMoney) + ".",
          action: firstMissing ? { kind: "add-cable", itemId: firstMissing.id, qty: firstMissing.need, label: "Add " + firstMissing.need + " more · " + money(missingMoney) } : null });
      } else {
        blockers++;
        checks.push({ key: "cables", level: "bad", weight: 2, title: "Missing: " + totalRuns + " × " + cablePlan[0].plan.name,
          note: "Without this the speakers stay silent on the day the box arrives.",
          action: firstMissing ? { kind: "add-cable", itemId: firstMissing.id, qty: firstMissing.need, label: "Add the cable · " + money(missingMoney) } : null });
      }
    }

    /* 6. Media, mics, extras */
    if (controller && controller.standalone) {
      if (storeSlots.length) {
        checks.push({ key: "media", level: "ok", weight: 1, title: "Media: " + itemOf(storeSlots[0]).model,
          note: "Standalone decks read tracks straight off the drive." });
      } else {
        warnings++;
        checks.push({ key: "media", level: "warn", weight: 1, title: "Standalone gear needs a drive",
          note: "Export your library to a fast USB drive before the first gig.",
          action: { kind: "swap-cat", cat: "storage", itemId: "usb-sandisk-extreme", label: "Add SanDisk Extreme PRO · $28" } });
      }
    }

    if (micSlots.length) {
      var mic = itemOf(micSlots[0]);
      var hasComboPA = speakers.some(function (s) { return /eon|combo/i.test((s.item.inputs || []).join(" ") + s.item.model); });
      checks.push({ key: "mic", level: hasComboPA ? "ok" : "warn", weight: 1,
        title: "Mic: " + mic.brand + " " + mic.model,
        note: hasComboPA
          ? "Your PA has a spare combo input — run the mic straight into the speaker, no mixer needed."
          : "Check your controller has a mic input. If it does not, the mic goes into a mixer or a PA with a mic preamp." });
      if (!hasComboPA) warnings++;
    }

    /* Readiness: share of weighted essentials that are satisfied. */
    var totalWeight = checks.reduce(function (n, c) { return n + c.weight; }, 0);
    var earned = checks.reduce(function (n, c) { return n + (c.level === "ok" ? c.weight : c.level === "warn" ? c.weight * 0.5 : 0); }, 0);
    var readiness = totalWeight ? Math.round((earned / totalWeight) * 100) : 0;
    if (!controller) readiness = 0;

    var status = blockers > 0 ? "bad" : warnings > 0 ? "warn" : "ok";

    /* ------------------------------------------------------- wiring map */
    var wiring = [];
    if (!controller) {
      wiring.push({ from: "host", to: "controller", status: "idle", label: "add a controller" });
    } else if (controller.standalone) {
      wiring.push({ from: "host", to: "controller", status: "ok", label: "standalone · no laptop" });
    } else if (!host) {
      wiring.push({ from: "host", to: "controller", status: "bad", label: "no host" });
    } else if (host.id === "standalone-usb-only") {
      wiring.push({ from: "host", to: "controller", status: "bad", label: "needs a laptop" });
    } else {
      wiring.push({ from: "host", to: "controller", status: "ok", label: "USB" });
    }

    speakers.forEach(function (entry, i) {
      var plan = cablePlan[i];
      var status = "ok";
      if (!controller) status = "idle";
      else if (!plan.plan.itemId) status = "warn";
      else if (plan.available >= plan.needed) status = "ok";
      else status = plan.available > 0 ? "warn" : "bad";
      wiring.push({
        from: "controller", to: "speaker" + i, status: status,
        label: controller ? plan.plan.label + (plan.needed > 1 ? " × " + plan.needed : "") : "add a controller"
      });
    });

    if (headphones) {
      wiring.push({ from: "controller", to: "headphones", status: "ok", label: "cue · " + ((controller && controller.headphone_jack) || "output") });
    }
    if (micSlots.length) {
      wiring.push({ from: "controller", to: "mic", status: "ok", label: "mic input" });
    }

    var quote = pickQuote({ controller: controller, host: host, speakers: speakers, buyTotal: buyTotal });

    return {
      groups: groups, value: value, ownedValue: ownedValue, buyTotal: buyTotal,
      itemCount: itemCount, buyCount: buyCount, ownedCount: ownedCount,
      controller: controller, host: host, speakers: speakers, headphones: headphones,
      cablePlan: cablePlan, totalRunsNeeded: totalRunsNeeded,
      checks: checks, wiring: wiring, readiness: readiness, status: status,
      blockers: blockers, warnings: warnings, upgrade: recommendUpgrade(), quote: quote
    };
  }

  /* One honest line of advice, chosen from the rig's actual state. */
  function pickQuote(r) {
    if (!r.controller) return "Start with the deck. Everything else in the rig is chosen to fit it.";
    if (r.host && r.host.id === "standalone-usb-only" && !r.controller.standalone) {
      return "These two cannot work together — a MIDI controller still needs a computer.";
    }
    if (!r.speakers.length) return "Headphones-only is a valid practice rig. Add monitors when you want to hear the room.";
    if (r.buyTotal === 0) return "Everything here is already in your room. That is the best kind of rig.";
    if (r.buyTotal < 300) return "That is a small list — and the fastest way to start mixing this week.";
    if (r.buyTotal > 2500) return "Big build. Buy the deck first, run it for a month, then add the rest.";
    return "Buy the deck and cables first; the rest can wait until you know how you actually play.";
  }

  function recommendUpgrade() {
    var ctrlSlot = slotsOf("controllers").filter(function (s) { return s.itemId; })[0];
    var hpSlot = slotsOf("headphones").filter(function (s) { return s.itemId; })[0];
    var spkSlots = slotsOf("speakers").filter(function (s) { return s.itemId; });
    var controller = itemOf(ctrlSlot);
    var hp = itemOf(hpSlot);

    if (hp && hp.price < 100 && controller && controller.price >= 299 && !hpSlot.owned) {
      return {
        kicker: "Upgrade when you can",
        title: "Sennheiser HD 25 · $149",
        body: "Your controller is good enough for gigs; " + hp.model + " is the weak link. HD 25 isolation is what lets you cue in a loud room, and every part is replaceable.",
        itemId: "sennheiser-hd25", slotId: hpSlot.slotId, cta: "Swap headphones"
      };
    }
    if (spkSlots.length === 1) {
      var spk = itemOf(spkSlots[0]);
      if (spk && !/\(pair\)/i.test(spk.model) && (spkSlots[0].qty || 1) === 1) {
        return {
          kicker: "Next step",
          title: "Add a second " + spk.model,
          body: "One speaker is mono. A matched second unit gives you real stereo width, and every club and wedding rig you meet later will be stereo.",
          itemId: spk.id, slotId: null, cta: "Add a second speaker", addCategory: "speakers"
        };
      }
    }
    if (controller && !controller.standalone && !slotsOf("stands").length) {
      return {
        kicker: "Cheap ergonomics",
        title: "Pyle Pro laptop stand · $29",
        body: "Raising the laptop above the controller frees desk space and stops you hunching for three hours. The cheapest improvement on this list.",
        itemId: "laptop-stand-pyle", slotId: null, cta: "Add the stand", addCategory: "stands"
      };
    }
    if (controller && controller.standalone && !slotsOf("storage").length) {
      return {
        kicker: "Before the first gig",
        title: "SanDisk Extreme PRO 128GB · $28",
        body: "Standalone decks only work if your library is exported to a fast drive. Buy two and keep one as the backup nobody thinks about until it matters.",
        itemId: "usb-sandisk-extreme", slotId: null, cta: "Add a USB drive", addCategory: "storage"
      };
    }
    return null;
  }

  /* ------------------------------------------------------- 4. Renders */
  function render() {
    if (!root) return;
    var focused = document.activeElement && document.activeElement.getAttribute ? document.activeElement.getAttribute("data-fk") : null;
    var selectedStart = document.activeElement && document.activeElement.getAttribute ? {
      nameSel: document.activeElement.getAttribute("data-quiz-name"),
      val: document.activeElement.getAttribute("data-quiz-val")
    } : null;

    if (state.view === "start") {
      root.innerHTML = renderStart();
    } else {
      root.innerHTML = renderStudio();
    }
    renderDrawer();
    renderModal();
    renderPalette();

    if (focused) {
      var again = root.querySelector('[data-fk="' + focused + '"]');
      if (again) again.focus();
    }
    if (selectedStart && selectedStart.nameSel) {
      var btn = root.querySelector('[data-quiz-name="' + selectedStart.nameSel + '"][data-quiz-val="' + selectedStart.val + '"]');
      if (btn) btn.focus();
    }
    window.requestAnimationFrame(drawWires);
    window.setTimeout(drawWires, 90);
  }

  function renderStart() {
    var presetsHtml = presets().map(function (p) {
      var total = 0, count = 0, ownedCount = 0;
      var owned = p.owned || [];
      Object.keys(p.slots).forEach(function (cat) {
        var it = byId(p.slots[cat]);
        if (!it) return;
        count++;
        if (owned.indexOf(cat) !== -1) ownedCount++; else total += it.price;
      });
      return '<button type="button" class="rs-preset-card" data-rs="preset" data-preset="' + p.id + '">' +
        '<span class="rs-preset-tag">' + escapeHtml(p.badge || "Template") + "</span>" +
        "<h4>" + escapeHtml(p.name) + "</h4>" +
        "<p>" + escapeHtml(p.blurb || presetBlurb(p.id)) + "</p>" +
        '<p class="rs-preset-meta"><b>' + money(total) + "</b> · " + count + " pieces" +
          (ownedCount ? " · " + ownedCount + " assumed owned" : "") + "</p>" +
        "</button>";
    }).join("");

    return '' +
      '<section class="rs-start">' +
        '<div class="rs-start-head">' +
          '<span class="rs-eyebrow">' + icon("spark") + "Start a rig</span>" +
          "<h2>Three honest ways in.</h2>" +
          "<p>Nothing here is stored on a server. Your build stays in this browser until you share the link.</p>" +
        "</div>" +
        '<div class="rs-paths">' +
          '<button type="button" class="rs-path rs-path--primary" data-rs="quiz-open">' +
            '<span class="rs-path-top"><span class="rs-path-icon">' + icon("route") + "</span>" +
            '<span class="rs-preset-tag">Recommended</span></span>' +
            "<h3>Answer four questions</h3>" +
            "<p>Where you play, your budget, what you already own, which software you lean towards. Get a full rig with reasons — about 40 seconds.</p>" +
            '<span class="rs-path-cta">Start guided setup →</span>' +
          "</button>" +
          '<button type="button" class="rs-path" data-rs="start-scratch">' +
            '<span class="rs-path-top"><span class="rs-path-icon">' + icon("layers") + "</span></span>" +
            "<h3>Start from scratch</h3>" +
            "<p>An empty booth and the full catalog. Best if you already know the deck you want.</p>" +
            '<span class="rs-path-cta">Open an empty rig →</span>' +
          "</button>" +
          '<button type="button" class="rs-path" data-rs="start-owned">' +
            '<span class="rs-path-top"><span class="rs-path-icon">' + icon("check") + "</span></span>" +
            "<h3>I already own most of it</h3>" +
            "<p>Begin with headphones, laptop or speakers marked as owned so the shopping list only contains what is genuinely missing.</p>" +
            '<span class="rs-path-cta">Build around what I have →</span>' +
          "</button>" +
        "</div>" +
        '<div class="rs-start-presets">' +
          '<div class="rs-start-presets-head"><div>' +
            "<h3>Or start from a template</h3>" +
            "<p>Real rigs for real rooms. Everything stays editable.</p>" +
          "</div></div>" +
          '<div class="rs-preset-grid">' + presetsHtml + "</div>" +
        "</div>" +
      "</section>";
  }

  function presetBlurb(id) {
    var blurbs = {
      "bedroom-starter": "A two-channel controller, monitoring headphones and desk monitors — the shortest path to actually learning to mix.",
      "club-ready": "Four channels, balanced outputs and a booth-style layout, so the move to a club CDJ setup is not a shock.",
      "mobile-pro": "Standalone decks, a PA speaker and a vocal mic. No laptop on the table, nothing to fail mid-wedding.",
      "traktor-techno": "Traktor-native controller with tight loop controls and a clean two-monitor output path."
    };
    return blurbs[id] || "A complete, checked rig you can edit piece by piece.";
  }

  function renderStudio() {
    var rig = computeRig();
    return renderRibbon() + renderBar(rig) + renderMain(rig) + renderGearList(rig) + renderShop(rig) + renderSaved(rig) + renderRelated();
  }

  function renderRibbon() {
    if (!state.ribbon) return "";
    var r = state.ribbon;
    var html = "";
    if (r.kind === "added") {
      html = '<div class="rs-ribbon">' + icon("check") +
        '<div class="rs-ribbon-body"><strong>Added the ' + escapeHtml(r.label) + "</strong> from " + escapeHtml(r.from || "an Offbeat guide") + ". " +
        (r.gaps ? "It still needs " + r.gaps + (r.gaps === 1 ? " piece" : " pieces") + " before you can play. " : "This rig is complete. ") +
        (r.missingPrice ? "Filling the gaps costs about " + money(r.missingPrice) + "." : "") +
        '<div class="rs-ribbon-actions">' +
          (r.gaps ? '<button type="button" class="rs-btn rs-btn--sm" data-rs="autofix">Finish the rig for me</button>' : "") +
          '<a class="rs-btn rs-btn--ghost rs-btn--sm" href="' + escapeHtml(r.reviewUrl || "dj-controllers-hub.html") + '">Read the guide</a>' +
          '<button type="button" class="rs-btn rs-btn--quiet rs-btn--sm" data-rs="dismiss-ribbon">Dismiss</button>' +
        "</div></div>" +
        '<button type="button" class="rs-ribbon-close" data-rs="dismiss-ribbon" aria-label="Dismiss">' + "✕" + "</button></div>";
    } else if (r.kind === "shared") {
      html = '<div class="rs-ribbon rs-ribbon--violet">' + icon("share") +
        '<div class="rs-ribbon-body"><strong>You are viewing a shared build</strong> — “' + escapeHtml(state.name) + '”. ' +
        "Nothing is stored until you save a copy in this browser." +
        '<div class="rs-ribbon-actions">' +
          '<button type="button" class="rs-btn rs-btn--sm" data-rs="save">Save a copy</button>' +
          '<button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" data-rs="dismiss-ribbon">Keep browsing</button>' +
        "</div></div></div>";
    } else if (r.kind === "guide") {
      html = '<div class="rs-ribbon rs-ribbon--violet">' + icon("route") +
        '<div class="rs-ribbon-body"><strong>' + escapeHtml(r.title || "Guided setup") + "</strong> " + escapeHtml(r.body || "") +
        (r.actions || "") + "</div>" +
        '<button type="button" class="rs-ribbon-close" data-rs="dismiss-ribbon" aria-label="Dismiss">✕</button></div>';
    }
    return html;
  }

  function renderBar(rig) {
    var statusChip = rig.status === "ok"
      ? '<span class="rs-chip rs-chip--ok">' + icon("check") + "Rig checks out</span>"
      : rig.status === "warn"
        ? '<span class="rs-chip rs-chip--warn">' + icon("warn") + rig.warnings + (rig.warnings === 1 ? " note" : " notes") + " to check</span>"
        : '<span class="rs-chip rs-chip--stop">' + icon("warn") + rig.blockers + (rig.blockers === 1 ? " thing" : " things") + " missing</span>";

    return '<div class="rs-bar rs-print-hide">' +
      '<div class="rs-bar-id">' +
        '<span class="rs-bar-label">My DJ rig</span>' +
        '<div class="rs-name-wrap"><input class="rs-name-input" data-rs="name" value="' + escapeHtml(state.name) + '" aria-label="Rig name" maxlength="60" data-fk="name"></div>' +
      "</div>" +
      '<div class="rs-bar-stats">' +
        statusChip +
        '<span class="rs-chip">' + icon("layers") + "<b>" + rig.itemCount + "</b> pieces</span>" +
        '<span class="rs-chip rs-chip--money" data-cost-chip>' + icon("cart") + "To buy <b>" + money(rig.buyTotal) + "</b></span>" +
      "</div>" +
      '<div class="rs-bar-actions">' +
        '<button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" data-rs="save">' + icon("save") + "Save</button>" +
        '<button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" data-rs="share">' + icon("share") + "Share</button>" +
        '<button type="button" class="rs-btn rs-btn--sm" data-rs="scroll-shop">' + icon("cart") + "Shopping list</button>" +
        '<div class="rs-menu-wrap"><button type="button" class="rs-btn rs-btn--quiet rs-btn--sm" data-rs="menu" aria-expanded="' + (state.menuOpen ? "true" : "false") + '" aria-haspopup="true" aria-label="More rig actions">' + icon("more") + "</button>" +
          '<div class="rs-menu"' + (state.menuOpen ? "" : " hidden") + ">" +
            '<button type="button" data-rs="compare">' + icon("compare") + "Compare two builds</button>" +
            '<button type="button" data-rs="quiz-open">' + icon("route") + "Guided setup again</button>" +
            '<button type="button" data-rs="download-shopping">' + icon("down") + "Download shopping list</button>" +
            '<button type="button" data-rs="print">' + icon("print") + "Print the list</button>" +
            "<hr>" +
            '<button type="button" data-rs="toggle-sound">' + icon("volume") + (soundOn ? "Click sounds: on" : "Click sounds: off") + "</button>" +
            '<button type="button" data-rs="start-over">' + icon("restart") + "Start a different rig</button>" +
          "</div></div>" +
      "</div>" +
    "</div>";
  }

  function renderMain(rig) {
    return '<div class="rs-main">' +
      renderMap(rig) +
      '<aside class="rs-side">' +
        renderReadiness(rig) +
        renderBudget(rig) +
        renderUpgrade(rig) +
      "</aside>" +
    "</div>";
  }

  /* Node positions are percentages of the stage, shared with the wire layer. */
  var NODE_POS = {
    host: [50, 15],
    speaker0: [16, 47],
    speaker1: [84, 47],
    controller: [50, 50],
    mic: [22, 84],
    headphones: [78, 84]
  };

  function nodeStatusMap(rig) {
    var rank = { idle: 0, ok: 1, warn: 2, bad: 3 };
    var out = {};
    (rig.wiring || []).forEach(function (w) {
      [w.from, w.to].forEach(function (pos) {
        if (!(pos in out) || rank[w.status] > rank[out[pos]]) out[pos] = w.status;
      });
    });
    return out;
  }

  function renderMap(rig) {
    var status = nodeStatusMap(rig);
    var nodes = "";

    /* Host */
    if (rig.host) {
      nodes += nodeHtml("host", rig.host, { role: "Host", slot: slotsOf("laptops").filter(function (s) { return s.itemId; })[0], status: status.host, qty: rig.host.id === "standalone-usb-only" ? 0 : 1 });
    } else if (rig.controller) {
      nodes += rig.controller.standalone
        ? ghostNode("host", "No laptop needed", "Standalone decks", "laptops", false, true)
        : ghostNode("host", "Add a laptop", "Runs your DJ software", "laptops");
    } else {
      nodes += ghostNode("host", "Add a laptop", "or go standalone", "laptops");
    }

    /* Speakers: two positions on the map, extras handled in the list */
    var spk = slotsOf("speakers").filter(function (s) { return s.itemId; });
    for (var i = 0; i < 2; i++) {
      if (spk[i]) {
        nodes += nodeHtml("speaker" + i, itemOf(spk[i]), { role: i === 0 ? "Output L" : "Output R", slot: spk[i], qty: spk[i].qty, status: status["speaker" + i] });
      } else if (i === 0) {
        nodes += ghostNode("speaker0", "Add speakers", "Monitors or a PA", "speakers");
      } else if (spk.length === 1) {
        nodes += ghostNode("speaker1", "Add a second", "for true stereo", "speakers", false, true);
      }
    }

    /* Controller */
    var ctrlSlot = slotsOf("controllers").filter(function (s) { return s.itemId; })[0];
    if (rig.controller) nodes += nodeHtml("controller", rig.controller, { role: "Decks & mixer", slot: ctrlSlot, hero: true, qty: ctrlSlot.qty, status: status.controller });
    else nodes += ghostNode("controller", "Add a controller", "The heart of the rig", "controllers", true);

    /* Mic */
    var micSlot = slotsOf("microphones").filter(function (s) { return s.itemId; })[0];
    if (micSlot) nodes += nodeHtml("mic", itemOf(micSlot), { role: "Mic", slot: micSlot, qty: micSlot.qty, status: status.mic });

    /* Headphones */
    var hpSlot = slotsOf("headphones").filter(function (s) { return s.itemId; })[0];
    if (hpSlot) nodes += nodeHtml("headphones", itemOf(hpSlot), { role: "Cue", slot: hpSlot, qty: 1, status: status.headphones });
    else nodes += ghostNode("headphones", "Add headphones", "You cannot cue without them", "headphones");

    return '<section class="rs-panel rs-map-panel" aria-labelledby="rs-map-title">' +
      '<div class="rs-panel-head">' +
        "<div><h2 id=\"rs-map-title\">" + icon("route") + "Signal map</h2>" +
        '<p class="rs-panel-sub">Click any piece to swap, add or check it. The wires show what is actually connected.</p></div>' +
        '<button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" data-rs="add-palette">' + icon("plus") + "Add equipment</button>" +
      "</div>" +
      '<div class="rs-stage">' +
        '<svg class="rs-wires" aria-hidden="true"></svg>' +
        nodes +
      "</div>" +
      renderAccessories() +
      '<div class="rs-legend">' +
        '<span><i></i>matched connection</span>' +
        '<span><i class="warn"></i>worth checking</span>' +
        '<span><i class="bad"></i>cannot work yet</span>' +
        '<span><i class="idle"></i>not in the rig</span>' +
      "</div>" +
    "</section>";
  }

  /* Wires are measured from the rendered nodes so the diagram survives any width. */
  function drawWires() {
    if (!root) return;
    var stage = root.querySelector(".rs-stage");
    var svg = root.querySelector(".rs-wires");
    if (!stage || !svg) return;
    if (window.matchMedia("(max-width: 900px)").matches) { svg.innerHTML = ""; return; }
    var rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    var rig = computeRig();
    var nodes = {};
    Array.prototype.forEach.call(stage.querySelectorAll("[data-pos]"), function (el) {
      var r = el.getBoundingClientRect();
      nodes[el.getAttribute("data-pos")] = {
        x: r.left - rect.left, y: r.top - rect.top, w: r.width, h: r.height,
        cx: r.left - rect.left + r.width / 2, cy: r.top - rect.top + r.height / 2
      };
    });
    var defs = '<defs>' +
      '<linearGradient id="rsWireOk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#38bdf8"/></linearGradient>' +
      "</defs>";
    var out = "";
    (rig.wiring || []).forEach(function (w) {
      var a = nodes[w.from], b = nodes[w.to];
      if (!a || !b) return;
      var ax = a.cx, ay = a.cy, bx = b.cx, by = b.cy;
      var vertical = Math.abs(a.cx - b.cx) < Math.max(60, a.w * 0.4);
      var d, mx, my;
      if (vertical) {
        if (a.cy < b.cy) { ay = a.y + a.h; by = b.y; } else { ay = a.y; by = b.y + b.h; }
        mx = ax;
        my = (ay + by) / 2;
        d = "M" + ax + " " + ay + " C" + ax + " " + my + " " + bx + " " + my + " " + bx + " " + by;
      } else {
        ax = a.cx < b.cx ? a.x + a.w : a.x;
        bx = b.cx < a.cx ? b.x + b.w : b.x;
        my = (ay + by) / 2;
        mx = (ax + bx) / 2;
        d = "M" + ax + " " + ay + " C" + mx + " " + ay + " " + mx + " " + by + " " + bx + " " + by;
      }
      var cls = w.status === "ok" ? "ok" : w.status === "warn" ? "warn" : w.status === "bad" ? "bad" : "idle";
      out += '<path class="rs-wire rs-wire--' + cls + '" d="' + d + '"/>';

      /* Park the label where neither card is, so it stays legible. */
      var lx = vertical ? mx + 14 : mx;
      var ly = vertical ? my + 4 : my - 9;
      var anchor = vertical ? "start" : "middle";
      var boxes = Object.keys(nodes).map(function (k) { return nodes[k]; });
      var hits = function (x, y) {
        return boxes.some(function (n) { return x > n.x - 8 && x < n.x + n.w + 8 && y > n.y - 8 && y < n.y + n.h + 8; });
      };
      var tries = [[lx, ly], [lx, ly - 26], [lx, ly + 26], [mx - 54, my - 26], [mx + 54, my + 26]];
      for (var i = 0; i < tries.length; i++) {
        if (!hits(tries[i][0], tries[i][1])) { lx = tries[i][0]; ly = tries[i][1]; break; }
      }
      out += '<text class="rs-wire-label rs-wire-label--' + cls + '" x="' + lx + '" y="' + ly + '" text-anchor="' + anchor + '">' +
        escapeHtml(w.label) + "</text>";
    });
    svg.setAttribute("viewBox", "0 0 " + Math.round(rect.width) + " " + Math.round(rect.height));
    svg.innerHTML = defs + out;
  }

  function nodeHtml(pos, item, opts) {
    opts = opts || {};
    var p = NODE_POS[pos] || [50, 50];
    var owned = opts.slot && opts.slot.owned;
    var qty = opts.qty || 1;
    var status = opts.status || "ok";
    var priceLabel = owned ? "owned" : item.price === 0 ? "no cost" : money(item.price * (qty || 1));
    return '<button type="button" class="rs-node rs-node--pos-' + pos + (opts.hero ? " rs-node--hero" : "") + (owned ? " rs-node--owned" : "") + '"' +
      ' style="--x:' + p[0] + "%;--y:" + p[1] + '%"' +
      ' data-rs="pick" data-pos="' + pos + '" data-slot="' + opts.slot.slotId + '" data-cat="' + opts.slot.category + '"' +
      ' aria-label="' + escapeHtml(opts.role + ": " + item.brand + " " + item.model + ". Click to swap") + '">' +
      '<span class="rs-node-top"><span class="rs-node-role">' + icon(CAT_ICON[item.category] || "layers") + escapeHtml(opts.role) + "</span>" +
        '<span class="rs-node-status rs-node-status--' + status + '" aria-hidden="true"></span></span>' +
      '<span class="rs-node-body">' +
        '<img class="rs-node-thumb" src="' + escapeHtml(item.image) + '" alt="" loading="lazy">' +
        '<span class="rs-node-copy"><span class="rs-node-brand">' + escapeHtml(item.brand) + "</span>" +
        '<span class="rs-node-model">' + escapeHtml(item.model) + "</span></span>" +
      "</span>" +
      '<span class="rs-node-meta"><span class="rs-node-price">' + priceLabel + "</span>" +
        (qty > 1 ? '<span class="rs-node-flag rs-node-flag--qty">×' + qty + "</span>" : "") +
        (owned ? '<span class="rs-node-flag rs-node-flag--owned">owned</span>' : "") +
      "</span>" +
      '<span class="rs-node-swap">Swap gear <span aria-hidden="true">→</span></span>' +
    "</button>";
  }

  function ghostNode(pos, title, hint, cat, hero, subtle) {
    var p = NODE_POS[pos] || [50, 50];
    return '<button type="button" class="rs-node rs-node--empty rs-node--pos-' + pos + (hero ? " rs-node--hero" : "") + '"' +
      ' style="--x:' + p[0] + "%;--y:" + p[1] + "%" + (subtle ? ";opacity:.85" : "") + '"' +
      ' data-rs="add-slot" data-pos="' + pos + '" data-cat="' + cat + '" aria-label="' + escapeHtml(title) + '">' +
      '<span class="rs-node-top"><span class="rs-node-role">' + icon(CAT_ICON[cat] || "plus") + escapeHtml(ROLE_LABEL[cat] || "Add") + "</span></span>" +
      '<span class="rs-node-empty-body"><span class="rs-node-plus" aria-hidden="true">+</span>' +
        '<span class="rs-node-empty-copy"><strong>' + escapeHtml(title) + "</strong><span>" + escapeHtml(hint) + "</span></span></span>" +
    "</button>";
  }

  function renderAccessories() {
    var order = ["cables", "stands", "storage", "microphones"];
    var chips = order.map(function (cat) {
      var slots = slotsOf(cat).filter(function (s) { return s.itemId; });
      if (!slots.length) {
        return '<button type="button" class="rs-acc rs-acc--empty" data-rs="add-slot" data-cat="' + cat + '">' +
          icon("plus") + "Add " + (cat === "storage" ? "USB media" : cat === "microphones" ? "mic" : cat === "stands" ? "stand" : "cable") + "</button>";
      }
      var totalQty = slots.reduce(function (n, s) { return n + (s.qty || 1); }, 0);
      var anyOwned = slots.every(function (s) { return s.owned; });
      var price = slots.reduce(function (n, s) { var it = itemOf(s); return n + (it ? it.price * (s.qty || 1) : 0); }, 0);
      var label = slots.length > 1 ? slots.length + " lines" : itemOf(slots[0]).model;
      return '<button type="button" class="rs-acc' + (anyOwned ? " rs-acc--owned" : "") + '" data-rs="pick" data-slot="' + slots[0].slotId + '" data-cat="' + cat + '">' +
        icon(CAT_ICON[cat]) + escapeHtml(label) + (totalQty > 1 ? " ×" + totalQty : "") +
        " <b>" + (anyOwned ? "owned" : money(price)) + "</b></button>";
    }).join("");

    return '<div class="rs-acc-rail"><span class="rs-acc-label">Also in the rig</span>' + chips +
      '<button type="button" class="rs-acc rs-acc--empty" data-rs="add-palette">' + icon("plus") + "Something else</button></div>";
  }

  function renderReadiness(rig) {
    var circumference = 2 * Math.PI * 30;
    var offset = circumference * (1 - rig.readiness / 100);
    var headline = rig.blockers > 0
      ? rig.blockers + (rig.blockers === 1 ? " gap" : " gaps") + " before you can play"
      : rig.warnings > 0 ? "Playable, with " + rig.warnings + " to check" : "Ready to play";

    var checks = rig.checks.map(function (c) {
      var mark = c.level === "ok" ? "✓" : c.level === "warn" ? "!" : "×";
      return '<li class="rs-check rs-check--' + c.level + '">' +
        '<span class="rs-check-mark" aria-hidden="true">' + mark + "</span>" +
        '<span class="rs-check-body"><span class="rs-check-title">' + escapeHtml(c.title) + "</span>" +
          '<span class="rs-check-note">' + escapeHtml(c.note || "") + "</span>" +
          (c.action ? '<button type="button" class="rs-check-action" data-rs="check-action" ' +
            'data-kind="' + c.action.kind + '" data-cat="' + (c.action.cat || "") + '" data-item="' + (c.action.itemId || "") + '" ' +
            'data-qty="' + (c.action.qty || 1) + '">' + escapeHtml(c.action.label) + "</button>" : "") +
        "</span></li>";
    }).join("");

    return '<section class="rs-panel">' +
      '<div class="rs-panel-head"><div><h2>' + icon("check") + "Can you play yet?</h2>" +
        '<p class="rs-panel-sub">Six checks, in the order a rig actually fails.</p></div></div>' +
      '<div class="rs-ready">' +
        '<div class="rs-ready-gauge">' +
          '<div class="rs-ring" role="img" aria-label="Rig readiness ' + rig.readiness + '%">' +
            '<svg viewBox="0 0 72 72" width="72" height="72" aria-hidden="true">' +
              '<circle class="rs-ring-track" cx="36" cy="36" r="30" fill="none" stroke-width="6"/>' +
              '<circle class="rs-ring-fill" cx="36" cy="36" r="30" fill="none" stroke-width="6" ' +
                'stroke-dasharray="' + circumference.toFixed(1) + '" stroke-dashoffset="' + offset.toFixed(1) + '"/>' +
            "</svg>" +
            '<span class="rs-ring-num">' + rig.readiness + "%</span>" +
          "</div>" +
          '<div class="rs-ready-copy"><h3>' + escapeHtml(headline) + "</h3><p>" + escapeHtml(rig.quote) + "</p></div>" +
        "</div>" +
        '<ul class="rs-checks">' + checks + "</ul>" +
        '<div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.7rem">' +
          (rig.blockers > 0 ? '<button type="button" class="rs-btn rs-btn--sm" data-rs="autofix" style="flex:1 1 150px">' +
            icon("wand") + "Fix the gaps for me</button>" : "") +
          '<button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" data-rs="quiz-open" style="flex:1 1 140px">' +
            icon("route") + "Guided setup</button>" +
        "</div>"
      "</div></section>";
  }

  function renderBudget(rig) {
    var buyPct = rig.value ? (rig.buyTotal / rig.value) * 100 : 0;
    return '<section class="rs-panel">' +
      '<div class="rs-panel-head"><div><h2>' + icon("cart") + "What this costs</h2>" +
        '<p class="rs-panel-sub">Only the gear you have not marked as owned.</p></div></div>' +
      '<div class="rs-budget">' +
        '<div class="rs-budget-row"><span>Full rig value</span><b>' + money(rig.value) + "</b></div>" +
        '<div class="rs-budget-row"><span>Already owned (' + rig.ownedCount + ")</span><b style=\"color:#6ee7b7\">−" + money(rig.ownedValue) + "</b></div>" +
        '<div class="rs-budget-bar" aria-hidden="true"><i class="buy" style="width:' + buyPct.toFixed(1) + '%"></i><i class="own" style="width:' + (100 - buyPct).toFixed(1) + '%"></i></div>' +
        '<div class="rs-budget-row rs-budget-row--total"><span>To buy now (' + rig.buyCount + " pieces)</span><b data-total>" + money(rig.buyTotal) + "</b></div>" +
        '<p class="rs-budget-note">October 2026 US retail estimates. Prices move; confirm at checkout.</p>' +
      "</div></section>";
  }

  function renderUpgrade(rig) {
    if (!rig.upgrade) return "";
    var u = rig.upgrade;
    return '<section class="rs-panel rs-upgrade">' +
      '<span class="rs-upgrade-tag">' + icon("spark") + escapeHtml(u.kicker) + "</span>" +
      "<h4>" + escapeHtml(u.title) + "</h4>" +
      "<p>" + escapeHtml(u.body) + "</p>" +
      '<div class="rs-upgrade-actions">' +
        '<button type="button" class="rs-btn rs-btn--sm" data-rs="upgrade-apply" data-item="' + escapeHtml(u.itemId) + '" data-slot="' + escapeHtml(u.slotId || "") + '" data-cat="' + escapeHtml(u.addCategory || "") + '">' +
          escapeHtml(u.cta) + "</button>" +
        '<button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" data-rs="details" data-item="' + escapeHtml(u.itemId) + '">Specs</button>' +
      "</div></section>";
  }

  function renderGearList(rig) {
    var groupsHtml = ROLE_ORDER.map(function (cat) {
      var lines = rig.groups[cat] || [];
      var meta = catMeta(cat);
      if (!lines.length) return "";
      var groupTotal = lines.reduce(function (n, l) { return n + l.lineTotal; }, 0);
      var items = lines.map(function (line) {
        if (!line.item) {
          var hint = EMPTY_HINT[cat] || ["Add equipment", ""];
          return '<div class="rs-empty-slot">' +
            '<span class="rs-empty-icon">' + icon(CAT_ICON[cat] || "plus") + "</span>" +
            '<span class="rs-empty-copy"><strong>' + escapeHtml(hint[0]) + "</strong><span>" + escapeHtml(hint[1]) + "</span></span>" +
            '<span><button type="button" class="rs-btn rs-btn--sm" data-rs="pick" data-slot="' + line.slot.slotId + '" data-cat="' + cat + '">Choose</button></span>' +
          "</div>";
        }
        var item = line.item;
        var qty = line.qty;
        var owned = line.slot.owned;
        return '<div class="rs-item' + (owned ? " rs-item--owned" : "") + '">' +
          '<img class="rs-item-img" src="' + escapeHtml(item.image) + '" alt="" loading="lazy">' +
          '<div class="rs-item-copy">' +
            '<div class="rs-item-name">' + escapeHtml(item.brand) + " " + escapeHtml(item.model) +
              '<span class="rs-item-role">' + escapeHtml(ROLE_LABEL[cat] || cat) + "</span></div>" +
            '<p class="rs-item-why">' + escapeHtml(item.tagline || item.ideal_for || "") + "</p>" +
            '<div class="rs-item-links">' +
              '<button type="button" class="rs-item-link" data-rs="pick" data-slot="' + line.slot.slotId + '" data-cat="' + cat + '">Swap</button>' +
              '<button type="button" class="rs-item-link" data-rs="details" data-item="' + escapeHtml(item.id) + '">Specs</button>' +
              (item.slug ? '<a class="rs-item-link" href="' + escapeHtml(item.slug) + '">Offbeat guide ↗</a>' : "") +
              (lines.length > 1 || cat === "microphones" || cat === "stands" || cat === "storage" || cat === "cables"
                ? '<button type="button" class="rs-item-link" style="color:#fca5a5" data-rs="remove" data-slot="' + line.slot.slotId + '">Remove</button>' : "") +
            "</div>" +
          "</div>" +
          '<div class="rs-item-side">' +
            '<span class="rs-item-price' + (owned ? " rs-item-price--owned" : "") + '">' + (owned ? "Owned" : money(line.lineTotal)) +
              "<small>" + (qty > 1 ? money(item.price) + " each" : "est. retail") + "</small></span>" +
            '<div class="rs-item-controls">' +
              '<span class="rs-qty">' +
                '<button type="button" data-rs="qty" data-slot="' + line.slot.slotId + '" data-step="-1" data-fk="q-' + line.slot.slotId + '-1" aria-label="Decrease quantity"' + (qty <= 1 ? " disabled" : "") + ">−</button>" +
                '<span aria-label="Quantity ' + qty + '">' + qty + "</span>" +
                '<button type="button" data-rs="qty" data-slot="' + line.slot.slotId + '" data-step="1" data-fk="q-' + line.slot.slotId + '-2" aria-label="Increase quantity"' + (qty >= 4 ? " disabled" : "") + ">+</button>" +
              "</span>" +
              '<button type="button" class="rs-own-toggle' + (owned ? " is-on" : "") + '" data-rs="own" data-slot="' + line.slot.slotId + '" aria-pressed="' + (owned ? "true" : "false") + '" data-fk="own-' + line.slot.slotId + '">' +
                (owned ? "Owned" : "Need to buy") + "</button>" +
            "</div>" +
          "</div>" +
        "</div>";
      }).join("");

      return '<div class="rs-group">' +
        '<div class="rs-group-head">' + icon(CAT_ICON[cat] || "layers") + escapeHtml(ROLE_LABEL[cat] || (meta && meta.name) || cat) +
          '<span class="rs-group-total">' + money(groupTotal) + "</span></div>" + items + "</div>";
    }).join("");

    return '<section class="rs-panel rs-list-section" id="rs-gear">' +
      '<div class="rs-panel-head"><div><h2>' + icon("layers") + "The whole rig, piece by piece</h2>" +
        '<p class="rs-panel-sub">Quantities, ownership and the review behind each pick. Ordered the way the signal flows.</p></div>' +
        '<button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" data-rs="add-palette">' + icon("plus") + "Add a piece</button>" +
      "</div>" +
      '<div class="rs-groups">' + (groupsHtml || '<p class="rs-saved-empty">Nothing in the rig yet. Add a controller to start.</p>') + "</div>" +
      '<div class="rs-add-row"><span>Add</span>' +
        ["microphones", "stands", "storage", "cables", "speakers"].map(function (cat) {
          return '<button type="button" class="rs-add-chip" data-rs="add-slot" data-cat="' + cat + '">' + icon("plus") +
            (cat === "microphones" ? "Microphone" : cat === "stands" ? "Stand" : cat === "storage" ? "USB media" : cat === "cables" ? "Cable" : "Extra speaker") + "</button>";
        }).join("") +
      "</div></section>";
  }

  function retailerLinks(item) {
    var q = encodeURIComponent(item.amazon_search || (item.brand + " " + item.model));
    return '<span class="rs-shop-retailers">' +
      '<a class="rs-retail" href="https://www.amazon.com/s?k=' + q + '&tag=offbeatdj-20" rel="nofollow sponsored noopener" target="_blank">Amazon</a>' +
      '<a class="rs-retail" href="https://www.sweetwater.com/store/search?s=' + q + '" rel="nofollow noopener" target="_blank">Sweetwater</a>' +
      '<a class="rs-retail" href="https://reverb.com/marketplace?query=' + q + '" rel="nofollow noopener" target="_blank">Reverb</a>' +
    "</span>";
  }

  /* The list of things still to buy, as data. renderShop() draws it and the
     browser test (tests/test_rig_studio.js) checks the same source, so the
     panel cannot drift from the rule "owned gear never appears". */
  function shoppingList(rig) {
    var r = rig || computeRig();
    var out = [];
    ROLE_ORDER.forEach(function (cat) {
      (r.groups[cat] || []).forEach(function (line) {
        if (!line.item || line.slot.owned) return;
        out.push({ itemId: line.item.id, category: cat, qty: line.qty, lineTotal: line.lineTotal });
      });
    });
    return out;
  }

  function renderShop(rig) {
    var needLines = [];
    var ownedLines = [];
    ROLE_ORDER.forEach(function (cat) {
      (rig.groups[cat] || []).forEach(function (line) {
        if (!line.item) return;
        (line.slot.owned ? ownedLines : needLines).push({ line: line, cat: cat });
      });
    });

    var rows = needLines.map(function (entry) {
      var item = entry.line.item;
      return '<li class="rs-shop-line">' +
        '<span class="rs-shop-line-name"><strong>' + escapeHtml(item.brand + " " + item.model) +
          (entry.line.qty > 1 ? " ×" + entry.line.qty : "") + "</strong>" +
          "<span>" + escapeHtml(ROLE_LABEL[entry.cat] || entry.cat) + " · " + escapeHtml(item.tagline || "") + "</span></span>" +
        '<span class="rs-shop-line-price">' + money(entry.line.lineTotal) + "</span>" +
        retailerLinks(item) +
      "</li>";
    }).join("");

    var ownedList = ownedLines.length
      ? '<details class="rs-shop-owned rs-print-hide"><summary>' + ownedLines.length + " piece" + (ownedLines.length === 1 ? "" : "s") + " you already own · " + money(rig.ownedValue) + " not being bought</summary><ul>" +
        ownedLines.map(function (e) {
          return "<li>" + escapeHtml(e.line.item.brand + " " + e.line.item.model) + (e.line.qty > 1 ? " ×" + e.line.qty : "") + "</li>";
        }).join("") + "</ul></details>"
      : "";

    var body = needLines.length
      ? '<ul class="rs-shop-lines">' + rows + "</ul>"
      : '<p class="rs-shop-owned" style="padding:1.2rem 1rem">Nothing left to buy — every piece of this rig is marked as owned.</p>';

    return '<section class="rs-panel rs-shop" id="rs-shop">' +
      '<div class="rs-panel-head"><div><h2>' + icon("cart") + "Shopping list</h2>" +
        '<p class="rs-panel-sub">Only what is missing, with the cables and adapters that get forgotten.</p></div>' +
        '<div class="rs-shop-head-total"><small>To buy</small><b data-total>' + money(rig.buyTotal) + "</b></div></div>" +
      '<div class="rs-shop-body">' + body + ownedList +
        '<div class="rs-shop-foot">' +
          '<div class="rs-shop-total"><span>Estimated total</span><b>' + money(rig.buyTotal) + "</b></div>" +
          '<div class="rs-shop-actions rs-print-hide">' +
            '<button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" data-rs="copy-shop">' + icon("copy") + "Copy list</button>" +
            '<button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" data-rs="download-shopping">' + icon("down") + "Download</button>" +
            '<button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" data-rs="print">' + icon("print") + "Print</button>" +
            '<button type="button" class="rs-btn rs-btn--sm" data-rs="share">' + icon("share") + "Share rig</button>" +
          "</div>" +
        "</div>" +
        '<p class="rs-shop-note">Prices are Offbeat estimates from October 2026, not live quotes. Some retailer links are affiliate links — they never change the price you pay. Check stock and the exact model number before ordering, and confirm the cable connectors match what is in the box.</p>' +
      "</div></section>";
  }

  function renderSaved(rig) {
    var saved = loadSavedRigs();
    var cards = saved.length ? saved.map(function (r, i) {
      var total = (r.items || []).reduce(function (n, s) {
        var it = byId(s.itemId);
        return n + (it && !s.owned ? it.price * (s.qty || 1) : 0);
      }, 0);
      var count = (r.items || []).filter(function (s) { return s.itemId; }).length;
      return '<div class="rs-saved-card">' +
        "<h4>" + escapeHtml(r.name) + "</h4>" +
        '<span class="rs-saved-meta">' + count + " pieces · saved " + escapeHtml(r.date || "recently") + "</span>" +
        '<span class="rs-saved-cost">' + money(total) + "</span>" +
        '<div class="rs-saved-actions">' +
          '<button type="button" class="rs-btn rs-btn--sm" data-rs="load-saved" data-index="' + i + '">Open</button>' +
          '<button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" data-rs="compare-saved" data-index="' + i + '">Compare</button>' +
          '<button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" data-rs="share-saved" data-index="' + i + '">Share</button>' +
          '<button type="button" class="rs-btn rs-btn--ghost rs-btn--sm rs-saved-del" data-rs="del-saved" data-index="' + i + '">Delete</button>' +
        "</div></div>";
    }).join("")
      : '<p class="rs-saved-empty">No saved builds yet. Save this rig to keep it, compare it later, or send it to a friend.</p>';

    return '<section class="rs-panel rs-saved" id="rs-saved">' +
      '<div class="rs-panel-head"><div><h2>' + icon("save") + "Saved builds</h2>" +
        '<p class="rs-panel-sub">Stored in this browser. Share a link when you want someone else to see it.</p></div>' +
        '<div style="display:flex;gap:.4rem;flex-wrap:wrap">' +
          '<button type="button" class="rs-btn rs-btn--sm" data-rs="save">' + icon("save") + "Save this build</button>" +
          '<button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" data-rs="compare">' + icon("compare") + "Compare</button>" +
        "</div></div>" +
      '<div class="rs-saved-grid">' + cards + "</div></section>";
  }

  function renderRelated() {
    return '<section class="rs-panel rs-related rs-print-hide" style="margin-top:1rem">' +
      '<div class="rs-panel-head"><div><h2>' + icon("book") + "Where to go next</h2>" +
        '<p class="rs-panel-sub">The guides behind the picks in this rig.</p></div></div>' +
      '<div class="rs-saved-grid">' +
        relatedCard("controller-software-compatibility-matrix.html", "Compatibility matrix", "Confirm your controller and software pairing before you buy.") +
        relatedCard("how-to-connect-dj-controller-to-speakers.html", "Connecting decks to speakers", "RCA, XLR, TRS and the adapters that save a gig.") +
        relatedCard("best-dj-controllers-for-beginners.html", "First controllers", "What the money buys at each price, and what to skip.") +
        relatedCard("beatmatch-trainer.html", "Beatmatching trainer", "The rig is only half of it — practice matching by ear.") +
      "</div></section>";
  }

  function relatedCard(href, title, body) {
    return '<a class="rs-saved-card rs-related-card" href="' + href + '" style="text-decoration:none">' +
      '<h4 style="color:#fff">' + escapeHtml(title) + "</h4>" +
      '<span class="rs-saved-meta" style="line-height:1.5">' + escapeHtml(body) + "</span>" +
      '<span class="rs-path-cta" style="margin-top:.4rem">Open guide →</span></a>';
  }

  /* ------------------------------------------------------- 5. Drawer */
  function renderDrawer() {
    if (!drawerRoot) return;
    var d = state.drawer;
    if (!d) {
      if (drawerRoot.innerHTML) { drawerRoot.innerHTML = ""; restoreFocus(); }
      return;
    }

    if (d.mode === "detail") {
      drawerRoot.innerHTML = drawerShell(d, renderDetail(d));
      return;
    }

    var cat = d.category;
    var items = optionsFor(d);
    drawerRoot.innerHTML = drawerShell(d,
      '<div class="rs-drawer-tools">' +
        '<label class="rs-search">' + icon("search") +
          '<input type="search" data-drawer-search placeholder="Search ' + escapeHtml((catMeta(cat) || {}).name || "gear") + '…" value="' + escapeHtml(d.query || "") + '" aria-label="Search options">' +
        "</label>" +
        '<div class="rs-filter-row">' +
          ["all", "budget", "mid", "premium"].map(function (f) {
            var labels = { all: "All prices", budget: "Under $150", mid: "$150–500", premium: "$500+" };
            return '<button type="button" class="rs-filter' + (d.price === f ? " is-active" : "") + '" data-drawer-price="' + f + '">' + labels[f] + "</button>";
          }).join("") +
          '<select class="rs-sort" data-drawer-sort aria-label="Sort options">' +
            '<option value="pick"' + (d.sort === "pick" ? " selected" : "") + ">Offbeat pick</option>" +
            '<option value="asc"' + (d.sort === "asc" ? " selected" : "") + ">Price: low to high</option>" +
            '<option value="desc"' + (d.sort === "desc" ? " selected" : "") + ">Price: high to low</option>" +
            '<option value="name"' + (d.sort === "name" ? " selected" : "") + ">Name</option>" +
          "</select>" +
        "</div>" +
      "</div>" +
      '<div class="rs-drawer-body" data-drawer-body>' + renderOptionList(d, items) + "</div>" +
      '<div data-drawer-tray>' + renderTray(d, items) + "</div>");
    bindDrawer();
  }

  function drawerShell(d, inner) {
    var meta = catMeta(d.category);
    var isAdd = !slotById(d.slotId);
    return '<div class="rs-drawer-backdrop" data-rs="close-drawer"></div>' +
      '<aside class="rs-drawer" role="dialog" aria-modal="true" aria-labelledby="rs-drawer-title">' +
        '<div class="rs-drawer-head"><div>' +
          '<span class="rs-eyebrow">' + icon(CAT_ICON[d.category] || "layers") + (isAdd ? "Add to the rig" : "Swap") + "</span>" +
          '<h2 id="rs-drawer-title">' + escapeHtml((meta && meta.name) || ROLE_LABEL[d.category] || "Equipment") + "</h2>" +
          "<p>" + escapeHtml(ROLE_HINT[d.category] || "Pick the piece that fits this rig.") + "</p>" +
        "</div>" +
        '<button type="button" class="rs-close" data-rs="close-drawer" aria-label="Close">✕</button></div>' +
        inner +
      "</aside>";
  }

  function optionsFor(d) {
    var all = CATALOG.items.filter(function (i) { return i.category === d.category; });
    var q = (d.query || "").toLowerCase().trim();
    if (q) {
      var tokens = q.split(/\s+/);
      all = all.filter(function (i) {
        var hay = (i.brand + " " + i.model + " " + (i.tagline || "") + " " + (i.ideal_for || "") + " " +
          (i.software_unlocks || []).join(" ") + " " + (i.master_outputs || []).join(" ") + " " + (i.inputs || []).join(" ")).toLowerCase();
        return tokens.every(function (t) { return hay.indexOf(t) !== -1; });
      });
    }
    if (d.price === "budget") all = all.filter(function (i) { return i.price < 150; });
    if (d.price === "mid") all = all.filter(function (i) { return i.price >= 150 && i.price <= 500; });
    if (d.price === "premium") all = all.filter(function (i) { return i.price > 500; });

    if (d.sort === "asc") all.sort(function (a, b) { return a.price - b.price; });
    else if (d.sort === "desc") all.sort(function (a, b) { return b.price - a.price; });
    else if (d.sort === "name") all.sort(function (a, b) { return (a.brand + a.model).localeCompare(b.brand + b.model); });
    else all.sort(function (a, b) {
      /* Offbeat pick: current item first, then beginner-friendly value, then price */
      var cur = (slotById(d.slotId) || {}).itemId;
      if (a.id === cur) return -1;
      if (b.id === cur) return 1;
      return a.price - b.price;
    });
    return all;
  }

  function renderOptionList(d, items) {
    if (!items.length) return '<p class="rs-drawer-empty">Nothing matches that filter. Try clearing the search or the price band.</p>';
    var current = slotById(d.slotId) || {};
    return items.map(function (item) {
      var isCurrent = current.itemId === item.id;
      var picked = (d.picked || []).indexOf(item.id) !== -1;
      var compat = compatFor(item, d.category);
      return '<article class="rs-option' + (isCurrent ? " rs-option--current" : "") + (picked ? " rs-option--picked" : "") + '">' +
        '<img class="rs-option-img" src="' + escapeHtml(item.image) + '" alt="" loading="lazy">' +
        '<div class="rs-option-copy">' +
          '<div class="rs-option-top"><strong>' + escapeHtml(item.model) + "</strong>" +
            '<span class="rs-option-price">' + money(item.price) + "</span></div>" +
          (item.pick ? '<span class="rs-node-flag" style="margin-top:.25rem;display:inline-block">Offbeat pick</span>' : "") +
          '<span class="rs-option-brand">' + escapeHtml(item.brand) + "</span>" +
          '<p class="rs-option-why">' + escapeHtml(item.tagline || item.ideal_for || "") + "</p>" +
          '<div class="rs-specs">' + specChips(item) + "</div>" +
          (compat ? '<span class="rs-compat rs-compat--' + compat.tone + '">' + icon(compat.tone === "ok" ? "check" : compat.tone === "warn" ? "warn" : "info") + escapeHtml(compat.text) + "</span>" : "") +
          '<div class="rs-option-actions">' +
            (isCurrent
              ? '<button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" disabled>In this rig</button>'
              : '<button type="button" class="rs-btn rs-btn--sm" data-drawer-use="' + escapeHtml(item.id) + '">' + (current.itemId ? "Swap to this" : "Use this") + "</button>") +
            '<button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" data-drawer-detail="' + escapeHtml(item.id) + '">Details</button>' +
            (item.slug ? '<a class="rs-item-link" href="' + escapeHtml(item.slug) + '">Offbeat review ↗</a>' : "") +
            '<label class="rs-option-compare" style="margin-left:auto"><input type="checkbox" data-drawer-compare="' + escapeHtml(item.id) + '"' + (picked ? " checked" : "") + "> Compare</label>" +
          "</div>" +
        "</div></article>";
    }).join("");
  }

  function specChips(item) {
    var chips = [];
    if (item.channels) chips.push(item.channels + " channels");
    if (item.standalone) chips.push("Standalone");
    if (item.master_outputs) chips.push("Out: " + item.master_outputs.join(" / "));
    if (item.inputs) chips.push("In: " + item.inputs.join(" / "));
    if (item.software_unlocks) chips.push("Unlocks " + item.software_unlocks.slice(0, 2).join(", "));
    if (item.driver_size) chips.push(item.driver_size);
    if (item.driver_mm) chips.push(item.driver_mm + " mm drivers");
    if (item.impedance_ohm) chips.push(item.impedance_ohm + " Ω");
    if (item.headphone_jack) chips.push("Cue " + item.headphone_jack);
    return chips.slice(0, 4).map(function (c) { return '<span class="rs-spec">' + escapeHtml(c) + "</span>"; }).join("");
  }

  /* Would this item fit the rig as it stands right now? */
  function compatFor(item) {
    var ctrl = itemOf(slotsOf("controllers").filter(function (s) { return s.itemId; })[0]);
    var host = itemOf(slotsOf("laptops").filter(function (s) { return s.itemId; })[0]);
    var spkSlot = slotsOf("speakers").filter(function (s) { return s.itemId; })[0];
    var spk = itemOf(spkSlot);

    if (item.category === "controllers") {
      if (item.standalone && host && host.id !== "standalone-usb-only") {
        return { tone: "ok", text: "Standalone: swap the " + host.model + " out and the rig gets " + money(host.price) + " cheaper." };
      }
      if (!item.standalone && (!host || host.id === "standalone-usb-only")) {
        return { tone: "warn", text: "Needs a laptop running " + ((item.software_unlocks || [])[0] || "DJ software") + " — none in the rig yet." };
      }
      if (spk) {
        var plan = cableFor(item, spk);
        return plan.itemId
          ? { tone: "ok", text: "Connects to your " + spk.model + " over " + plan.name + "." }
          : { tone: "warn", text: "Your " + spk.model + " would need " + plan.name + " — not in our cable list." };
      }
      return { tone: "neutral", text: "Unlocks " + (item.software_unlocks || []).join(", ") + "." };
    }
    if (item.category === "speakers") {
      if (!ctrl) return { tone: "neutral", text: "Choose a controller first to check the cable." };
      var p = cableFor(ctrl, item);
      return p.itemId
        ? { tone: "ok", text: "Pairs with your " + ctrl.model + " over " + p.name + "." }
        : { tone: "warn", text: ctrl.model + " → " + item.model + " needs " + p.name + "." };
    }
    if (item.category === "laptops") {
      if (item.id === "standalone-usb-only" && ctrl && !ctrl.standalone) {
        return { tone: "warn", text: ctrl.model + " has no internal computer — this only works with a standalone deck." };
      }
      if (ctrl && ctrl.standalone) return { tone: "ok", text: "Not needed: " + ctrl.model + " runs standalone. Keeps the rig cheaper." };
      return { tone: "neutral", text: "USB into the controller; audio still comes out of the deck." };
    }
    if (item.category === "cables") {
      if (ctrl && spk) {
        var need = cableFor(ctrl, spk);
        return need.itemId === item.id
          ? { tone: "ok", text: "Exactly the run your " + ctrl.model + " → " + spk.model + " path needs." }
          : { tone: "neutral", text: "Your current path needs " + need.name + " instead." };
      }
      return { tone: "neutral", text: "Match the controller's output jack to the speaker's input." };
    }
    if (item.category === "microphones") {
      var pa = slotsOf("speakers").map(function (s) { return itemOf(s); }).filter(Boolean)
        .some(function (s) { return /eon|combo/i.test((s.inputs || []).join(" ") + s.model); });
      return pa
        ? { tone: "ok", text: "Your PA has a spare combo input — plug the mic straight in." }
        : { tone: "neutral", text: "Check your controller has a mic input before ordering." };
    }
    return null;
  }

  function renderTray(d, items) {
    var picked = items.filter(function (i) { return (d.picked || []).indexOf(i.id) !== -1; });
    if (picked.length < 2) return "";
    var rows = [
      ["Price", function (i) { return money(i.price); }],
      ["Category", function (i) { return (catMeta(i.category) || {}).name || ""; }],
      ["Channels", function (i) { return i.channels ? i.channels + " decks" : "—"; }],
      ["Outputs", function (i) { return (i.master_outputs || []).join(", ") || "—"; }],
      ["Inputs", function (i) { return (i.inputs || []).join(", ") || "—"; }],
      ["Software", function (i) { return (i.software_unlocks || []).join(", ") || "—"; }],
      ["Standalone", function (i) { return i.standalone ? "Yes" : "Needs a laptop"; }],
      ["Best for", function (i) { return i.ideal_for || "—"; }]
    ];
    return '<div class="rs-drawer-body" style="flex:0 0 auto;max-height:42vh;padding-bottom:.6rem">' +
        '<table class="rs-cmp"><thead><tr><th></th>' + picked.map(function (i) { return "<th>" + escapeHtml(i.model) + "</th>"; }).join("") + "</tr></thead><tbody>" +
          rows.map(function (row) {
            return "<tr><th>" + row[0] + "</th>" + picked.map(function (i) { return "<td>" + escapeHtml(row[1](i)) + "</td>"; }).join("") + "</tr>";
          }).join("") +
        "</tbody></table></div>" +
      '<div class="rs-tray"><span class="rs-tray-label"><b>' + picked.length + "</b> selected</span>" +
      '<button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" data-drawer-clear>Clear comparison</button></div>';
  }

  function renderDetail(d) {
    var item = byId(d.itemId);
    if (!item) return "";
    var compat = compatFor(item);
    var specs = [
      ["Price", money(item.price) + " est."],
      ["Category", (catMeta(item.category) || {}).name || item.category],
      item.channels ? ["Channels", item.channels + " decks"] : null,
      item.master_outputs ? ["Master outputs", item.master_outputs.join(" · ")] : null,
      item.inputs ? ["Inputs", item.inputs.join(" · ")] : null,
      item.headphone_jack ? ["Headphone jack", item.headphone_jack] : null,
      item.software_unlocks ? ["Software", item.software_unlocks.join(" · ")] : null,
      item.standalone != null ? ["Laptop needed", item.standalone ? "No" : "Yes"] : null,
      item.driver_size ? ["Drivers", item.driver_size] : null,
      item.driver_mm ? ["Driver size", item.driver_mm + " mm"] : null,
      item.impedance_ohm ? ["Impedance", item.impedance_ohm + " Ω"] : null,
      ["Ideal for", item.ideal_for || "—"]
    ].filter(Boolean);

    var alternatives = CATALOG.items.filter(function (i) { return i.category === item.category && i.id !== item.id; })
      .sort(function (a, b) { return Math.abs(a.price - item.price) - Math.abs(b.price - item.price); })
      .slice(0, 3).map(function (alt) {
        return '<button type="button" class="rs-acc" data-drawer-detail="' + escapeHtml(alt.id) + '">' +
          escapeHtml(alt.model) + " <b>" + money(alt.price) + "</b></button>";
      }).join("");

    return '<div class="rs-drawer-body"><div class="rs-detail">' +
      '<div class="rs-detail-hero">' +
        '<img src="' + escapeHtml(item.image) + '" alt="' + escapeHtml(item.brand + " " + item.model) + '">' +
        "<div><strong style=\"font-family:var(--display);font-size:1.08rem;color:#fff;display:block\">" + escapeHtml(item.model) + "</strong>" +
          '<span class="rs-option-brand">' + escapeHtml(item.brand) + "</span>" +
          '<div class="rs-detail-price">' + money(item.price) + "<span>est. US retail · Oct 2026</span></div></div>" +
      "</div>" +
      '<p class="rs-option-why" style="margin-top:.8rem">' + escapeHtml(item.tagline || "") + "</p>" +
      (compat ? '<span class="rs-compat rs-compat--' + compat.tone + '">' + icon(compat.tone === "ok" ? "check" : "warn") + escapeHtml(compat.text) + "</span>" : "") +
      '<div class="rs-detail-specs">' + specs.map(function (s) {
        return "<div><span>" + escapeHtml(s[0]) + "</span><strong>" + escapeHtml(s[1]) + "</strong></div>";
      }).join("") + "</div>" +
      '<div class="rs-option-actions">' +
        '<button type="button" class="rs-btn rs-btn--sm" data-drawer-use="' + escapeHtml(item.id) + '">Use in this rig</button>' +
        (item.slug ? '<a class="rs-btn rs-btn--ghost rs-btn--sm" href="' + escapeHtml(item.slug) + '">Read the Offbeat guide</a>' : "") +
        '<button type="button" class="rs-btn rs-btn--quiet rs-btn--sm" data-drawer-back>Back to options</button>' +
      "</div>" +
      (alternatives ? '<p class="rs-detail-note" style="margin-top:1rem">Close alternatives in price</p><div class="rs-option-actions">' + alternatives + "</div>" : "") +
      '<p class="rs-detail-note">Image is an Offbeat vector schematic, not a photograph of the product. ' +
        escapeHtml(item.provenance || "Specs compiled from manufacturer documentation.") + "</p>" +
    "</div></div>";
  }

  function bindDrawer() {
    if (!drawerRoot || !state.drawer) return;
    var search = drawerRoot.querySelector("[data-drawer-search]");
    if (search) {
      search.addEventListener("input", function (e) {
        state.drawer.query = e.target.value;
        var body = drawerRoot.querySelector("[data-drawer-body]");
        if (body) body.innerHTML = renderOptionList(state.drawer, optionsFor(state.drawer));
      });
      if (state.drawer.focusSearch) {
        search.focus();
        search.setSelectionRange(search.value.length, search.value.length);
        state.drawer.focusSearch = false;
      }
    }
    drawerRoot.querySelectorAll("[data-drawer-price]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.drawer.price = btn.getAttribute("data-drawer-price");
        renderDrawer();
      });
    });
    var sort = drawerRoot.querySelector("[data-drawer-sort]");
    if (sort) sort.addEventListener("change", function (e) {
      state.drawer.sort = e.target.value;
      renderDrawer();
    });
    drawerRoot.querySelectorAll("[data-drawer-use]").forEach(function (btn) {
      btn.addEventListener("click", function () { useItem(btn.getAttribute("data-drawer-use")); });
    });
    drawerRoot.querySelectorAll("[data-drawer-detail]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.drawer.mode = "detail";
        state.drawer.itemId = btn.getAttribute("data-drawer-detail");
        renderDrawer();
      });
    });
    var back = drawerRoot.querySelector("[data-drawer-back]");
    if (back) back.addEventListener("click", function () { state.drawer.mode = "pick"; renderDrawer(); });
    drawerRoot.querySelectorAll("[data-drawer-compare]").forEach(function (box) {
      box.addEventListener("change", function () {
        var id = box.getAttribute("data-drawer-compare");
        var picked = (state.drawer.picked || []).slice();
        if (box.checked) { if (picked.indexOf(id) === -1) picked.push(id); }
        else picked = picked.filter(function (p) { return p !== id; });
        state.drawer.picked = picked;
        /* Update in place so the list does not jump back to the top. */
        var card = box.closest(".rs-option");
        if (card) card.classList.toggle("rs-option--picked", box.checked);
        var tray = drawerRoot.querySelector("[data-drawer-tray]");
        if (tray) tray.innerHTML = renderTray(state.drawer, optionsFor(state.drawer));
      });
    });
    drawerRoot.querySelectorAll("[data-drawer-clear]").forEach(function (clear) {
      clear.addEventListener("click", function () { state.drawer.picked = []; renderDrawer(); });
    });
  }

  /* -------------------------------------------------------- 6. Modals */
  function renderModal() {
    if (!modalRoot) return;
    var m = state.modal;
    if (!m) {
      if (modalRoot.innerHTML) modalRoot.innerHTML = "";
      return;
    }
    var inner = m.kind === "save" ? saveModal()
      : m.kind === "share" ? shareModal(m.payload)
      : m.kind === "compare" ? compareModal()
      : m.kind === "quiz" ? quizModal()
      : "";
    modalRoot.innerHTML = inner;
    bindModal();
  }

  function modalShell(title, eyebrow, sub, body, foot, wide) {
    return '<div class="rs-modal-backdrop" data-rs="close-modal">' +
      '<div class="rs-modal' + (wide ? " rs-modal--wide" : "") + '" role="dialog" aria-modal="true" aria-labelledby="rs-modal-title">' +
        '<div class="rs-modal-head"><div>' +
          '<span class="rs-eyebrow">' + eyebrow + "</span>" +
          '<h2 id="rs-modal-title">' + escapeHtml(title) + "</h2>" +
          (sub ? "<p>" + escapeHtml(sub) + "</p>" : "") +
        "</div><button type=\"button\" class=\"rs-close\" data-rs=\"close-modal\" aria-label=\"Close\">✕</button></div>" +
        '<div class="rs-modal-body">' + body + "</div>" +
        (foot ? '<div class="rs-modal-foot">' + foot + "</div>" : "") +
      "</div></div>";
  }

  function saveModal() {
    return modalShell("Save this build", "Keep it", "Saved builds live in this browser. Share a link if you want to send it somewhere else.",
      '<div class="rs-field"><label for="rs-save-name">Name this rig</label>' +
        '<input class="rs-input" id="rs-save-name" data-save-name value="' + escapeHtml(state.name) + '" maxlength="60" placeholder="e.g. Bedroom FLX4 rig"></div>' +
      '<p class="rs-note">Everything is included: quantities, and which pieces you already own.</p>',
      '<button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" data-rs="close-modal">Cancel</button>' +
      '<button type="button" class="rs-btn rs-btn--sm" data-rs="do-save">Save build</button>');
  }

  function shareUrl(payload) {
    return location.origin + location.pathname + "?rig=" + encodePayload(payload);
  }

  function shareModal(payloadOverride) {
    var payload = payloadOverride || { n: state.name, i: state.items };
    var url = shareUrl(payload);
    return modalShell("Share this rig", "Share", "A link that opens this exact build — every piece, quantity and ownership flag.",
      '<div class="rs-field"><label for="rs-share-url">Shareable link</label>' +
        '<div class="rs-share-url"><input class="rs-input" id="rs-share-url" readonly value="' + escapeHtml(url) + '">' +
        '<button type="button" class="rs-btn rs-btn--sm" data-rs="copy-share">Copy</button></div></div>' +
      '<p class="rs-note">The link contains the rig itself, not your identity. Nothing is uploaded anywhere — the whole build travels in the URL.</p>' +
      '<p class="rs-note">Want a text version for Reddit or Discord? Use <b>Download shopping list</b> in the ⋯ menu.</p>',
      '<a class="rs-btn rs-btn--ghost rs-btn--sm" href="' + escapeHtml(url) + '" target="_blank" rel="noopener">Preview link</a>' +
      '<button type="button" class="rs-btn rs-btn--sm" data-rs="copy-share">Copy link</button>');
  }

  function compareModal() {
    var saved = loadSavedRigs();
    var options = [{ key: "current", name: state.name + " (this rig)", items: state.items }]
      .concat(presets().map(function (p) {
        return { key: "p:" + p.id, name: p.name + " (template)", items: presetItems(p) };
      }))
      .concat(saved.map(function (s, i) {
        return { key: "s:" + i, name: s.name + " (saved)", items: s.items || [] };
      }));

    var m = state.modal.compare || { a: 0, b: Math.min(1, options.length - 1) };
    var rigA = options[Math.min(m.a, options.length - 1)];
    var rigB = options[Math.min(m.b, options.length - 1)];

    function totalOf(items) {
      return items.reduce(function (n, s) {
        var it = byId(s.itemId);
        return n + (it && !s.owned ? it.price * (s.qty || 1) : 0);
      }, 0);
    }
    function valueOf(items) {
      return items.reduce(function (n, s) {
        var it = byId(s.itemId);
        return n + (it ? it.price * (s.qty || 1) : 0);
      }, 0);
    }
    function itemIn(items, cat) {
      var s = items.filter(function (x) { return x.category === cat && x.itemId; })[0];
      return s ? byId(s.itemId) : null;
    }

    var rows = ROLE_ORDER.map(function (cat) {
      var a = itemIn(rigA.items, cat), b = itemIn(rigB.items, cat);
      return '<div class="rs-cmp-row"><span>' + escapeHtml(ROLE_LABEL[cat]) + "</span>" +
        '<strong class="' + (a && b && a.id === b.id ? "" : a && b ? (a.price < b.price ? "diff-down" : "diff-up") : "") + '">' +
        escapeHtml(a ? a.model : "—") + '<br><span style="font-size:.72rem;color:var(--muted-2)">' + (a ? money(a.price) : "") + "</span></strong></div>";
    }).join("");

    var rowsB = ROLE_ORDER.map(function (cat) {
      var a = itemIn(rigA.items, cat), b = itemIn(rigB.items, cat);
      return '<div class="rs-cmp-row"><span>' + escapeHtml(ROLE_LABEL[cat]) + "</span>" +
        '<strong class="' + (a && b && a.id === b.id ? "" : a && b ? (b.price < a.price ? "diff-down" : "diff-up") : "") + '">' +
        escapeHtml(b ? b.model : "—") + '<br><span style="font-size:.72rem;color:var(--muted-2)">' + (b ? money(b.price) : "") + "</span></strong></div>";
    }).join("");

    var diff = totalOf(rigB.items) - totalOf(rigA.items);
    var diffText = diff === 0 ? "Same out-of-pocket cost" : diff > 0 ? "B costs " + money(diff) + " more to buy" : "B saves " + money(-diff);

    var body =
      '<div class="rs-cmp-selectors">' +
        '<div><label for="rs-cmp-a">Build A</label><select id="rs-cmp-a" data-cmp-a>' +
          options.map(function (o, i) { return '<option value="' + i + '"' + (i === m.a ? " selected" : "") + ">" + escapeHtml(o.name) + "</option>"; }).join("") +
        "</select></div>" +
        '<span class="rs-cmp-vs">VS</span>' +
        '<div><label for="rs-cmp-b">Build B</label><select id="rs-cmp-b" data-cmp-b>' +
          options.map(function (o, i) { return '<option value="' + i + '"' + (i === m.b ? " selected" : "") + ">" + escapeHtml(o.name) + "</option>"; }).join("") +
        "</select></div>" +
      "</div>" +
      '<div class="rs-cmp-grid">' +
        '<div class="rs-cmp-card"><header><strong>' + escapeHtml(rigA.name) + "</strong><span>" + money(totalOf(rigA.items)) + " to buy</span></header><div class=\"rs-cmp-rows\">" + rows +
          '<div class="rs-cmp-row" style="border-top:1px solid var(--line);margin-top:.3rem;padding-top:.45rem"><span>Full value</span><strong>' + money(valueOf(rigA.items)) + "</strong></div></div></div>" +
        '<div class="rs-cmp-card"><header><strong>' + escapeHtml(rigB.name) + "</strong><span>" + money(totalOf(rigB.items)) + " to buy</span></header><div class=\"rs-cmp-rows\">" + rowsB +
          '<div class="rs-cmp-row" style="border-top:1px solid var(--line);margin-top:.3rem;padding-top:.45rem"><span>Full value</span><strong>' + money(valueOf(rigB.items)) + "</strong></div></div></div>" +
      "</div>" +
      '<div class="rs-cmp-summary"><span><b>' + escapeHtml(diffText) + "</b></span>" +
        "<span>“—” means that build does not include the role at all.</span></div>";

    return modalShell("Compare two builds", "Compare", "Prices are estimates; the point is the shape of the two rigs.",
      body,
      '<button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" data-rs="close-modal">Close</button>', true);
  }

  /* ------------------------------------------------------- Guided setup */
  function startQuiz() {
    state.quiz = { step: 0, answers: { venue: null, budget: null, owns: [], software: null }, result: null };
    state.modal = { kind: "quiz" };
    render();
  }

  var QUIZ_STEPS = [
    {
      key: "venue", title: "Where will this rig actually live?",
      sub: "This decides how much I/O and volume you need — not how much you should spend.",
      options: [
        { val: "bedroom", label: "Bedroom / desk", note: "Quiet practice, headphones and small monitors." },
        { val: "house", label: "House parties", note: "Loud rooms, friends, the occasional birthday." },
        { val: "club", label: "Clubs & bars", note: "Booth layout, balanced outputs, four channels." },
        { val: "mobile", label: "Weddings & mobile", note: "You bring everything, including the mic." }
      ]
    },
    {
      key: "budget", title: "What is the all-in budget?",
      sub: "Everything on the list — deck, headphones, speakers, cables. Not just the controller.",
      options: [
        { val: 400, label: "Up to $400", note: "Tight but workable for a first rig." },
        { val: 700, label: "$400 – $700", note: "The sweet spot for learning properly." },
        { val: 1200, label: "$700 – $1,200", note: "Room for a four-channel deck or better monitors." },
        { val: 2600, label: "$1,200+", note: "Standalone gear and real PA speakers." }
      ]
    },
    {
      key: "owns", title: "What do you already own?",
      sub: "Anything you mark here is left out of the shopping list.",
      multi: true,
      options: [
        { val: "laptops", label: "A laptop", note: "Any modern Mac or Windows machine." },
        { val: "headphones", label: "Headphones", note: "Closed-back ideally." },
        { val: "speakers", label: "Speakers", note: "Monitors or a PA." },
        { val: "controllers", label: "A controller", note: "You are upgrading, not starting." }
      ]
    },
    {
      key: "software", title: "Any software pull?",
      sub: "Controller bundles decide this more often than brand loyalty does.",
      options: [
        { val: "any", label: "No preference", note: "Pick whatever the deck unlocks for free." },
        { val: "rekordbox", label: "rekordbox", note: "Pioneer/AlphaTheta ecosystem, club-standard exports." },
        { val: "serato", label: "Serato", note: "Widest hardware support, strong stems." },
        { val: "traktor", label: "Traktor", note: "Native Instruments hardware, tight looping." },
        { val: "engine", label: "Engine DJ", note: "Denon standalone, no laptop at all." }
      ]
    }
  ];

  function quizModal() {
    var q = state.quiz;
    var step = QUIZ_STEPS[q.step];
    var stepsHtml = QUIZ_STEPS.map(function (s, i) {
      var cls = i === q.step ? "is-active" : (q.answers[s.key] != null && q.answers[s.key].length !== 0) ? "is-done" : "";
      return '<li class="rs-quiz-step ' + cls + '"><i>' + (i < q.step ? "✓" : i + 1) + "</i>" + escapeHtml(s.title.split("?")[0]) + "</li>";
    }).join("");

    if (q.result) {
      var r = q.result;
      var parts = r.items.map(function (s) {
        var it = byId(s.itemId);
        return it ? '<span class="rs-result-part">' + escapeHtml(it.brand + " " + it.model) + (s.owned ? " <b>(owned)</b>" : " <b>" + money(it.price) + "</b>") + "</span>" : "";
      }).join("");
      return modalShell("Your rig, and why", icon("spark") + "Guided setup",
        "Four answers, one build. Everything below is editable in the studio.",
        '<div class="rs-quiz-result">' +
          '<h3>' + escapeHtml(r.title) + "</h3>" +
          '<p class="rs-note" style="margin-top:0">' + escapeHtml(r.summary) + "</p>" +
          '<div class="rs-result-price">' + money(r.buyTotal) + ' <span style="font-family:var(--font);font-size:.8rem;color:var(--muted)">to buy now' +
            (r.budget ? " · your ceiling was " + money(r.budget) : "") + "</span></div>" +
          '<ul class="rs-reasons">' + r.reasons.map(function (reason) {
            return "<li>" + icon("check") + escapeHtml(reason) + "</li>";
          }).join("") + "</ul>" +
          '<div class="rs-result-parts">' + parts + "</div>" +
        "</div>",
        '<button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" data-rs="quiz-restart">Change answers</button>' +
        '<button type="button" class="rs-btn rs-btn--sm" data-rs="quiz-apply">Open this rig in the studio</button>', true);
    }

    var opts = step.options.map(function (o) {
      var picked = step.multi
        ? (q.answers[step.key] || []).indexOf(o.val) !== -1
        : q.answers[step.key] === o.val;
      return '<button type="button" class="rs-option-btn' + (picked ? " is-picked" : "") + '" data-quiz-name="' + step.key + '" data-quiz-val="' + o.val + '">' +
        "<strong>" + escapeHtml(o.label) + "</strong><span>" + escapeHtml(o.note) + "</span></button>";
    }).join("");

    return modalShell("Guided setup", icon("route") + "Step " + (q.step + 1) + " of 4",
      "Answer four questions and the studio builds a rig you can edit piece by piece.",
      '<div class="rs-quiz">' +
        '<ol class="rs-quiz-steps">' + stepsHtml + "</ol>" +
        '<div class="rs-quiz-q"><h3>' + escapeHtml(step.title) + "</h3><p>" + escapeHtml(step.sub) + "</p>" +
          '<div class="rs-options">' + opts + "</div>" +
          '<div class="rs-quiz-nav">' +
            '<button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" data-rs="quiz-back"' + (q.step === 0 ? " disabled" : "") + ">Back</button>" +
            '<button type="button" class="rs-btn rs-btn--sm" data-rs="quiz-next">' + (q.step === QUIZ_STEPS.length - 1 ? "Build my rig" : "Next") + "</button>" +
          "</div>" +
        "</div>" +
      "</div>", null, true);
  }

  function bindModal() {
    if (!modalRoot) return;
    var nameInput = modalRoot.querySelector("[data-save-name]");
    if (nameInput) {
      nameInput.focus();
      nameInput.select();
      nameInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); doSave(nameInput.value); }
      });
    }
    modalRoot.querySelectorAll("[data-cmp-a]").forEach(function (sel) {
      sel.addEventListener("change", function () {
        state.modal.compare = state.modal.compare || {};
        state.modal.compare.a = parseInt(sel.value, 10);
        renderModal();
      });
    });
    modalRoot.querySelectorAll("[data-cmp-b]").forEach(function (sel) {
      sel.addEventListener("change", function () {
        state.modal.compare = state.modal.compare || {};
        state.modal.compare.b = parseInt(sel.value, 10);
        renderModal();
      });
    });
  }

  /* ------------------------------------------- Guided setup: recommendation */
  function answerQuiz(key, val) {
    var q = state.quiz;
    var step = QUIZ_STEPS[q.step];
    if (step.multi) {
      var list = q.answers[key] || [];
      var i = list.indexOf(val);
      if (i === -1) list.push(val); else list.splice(i, 1);
      q.answers[key] = list;
    } else {
      q.answers[key] = val;
    }
    render();
  }

  function buildRecommendation(answers) {
    var venue = answers.venue || "bedroom";
    var budget = answers.budget || 700;
    var owns = answers.owns || [];
    var software = answers.software || "any";
    var wantStandalone = (venue === "mobile" && budget >= 1600) || software === "engine";
    var wantClub = venue === "club";

    var controllers = CATALOG.items.filter(function (i) { return i.category === "controllers"; });
    var prefers = controllers.filter(function (c) {
      if (software === "engine") return c.standalone;
      if (software !== "any") {
        var unlocks = (c.software_unlocks || []).join(" ").toLowerCase();
        if (unlocks.indexOf(software) === -1) return false;
      }
      return true;
    });
    if (!prefers.length) prefers = controllers;

    var opts = { venue: venue, budget: budget, owns: owns, software: software };
    var fitFor = { venue: venue, budget: budget, standalone: wantStandalone, club: wantClub };
    var kits = prefers.map(function (c) {
      return { controller: c, full: kitFor(c, opts), core: kitFor(c, extend(opts, { tier: "core" })), fit: controllerScore(c, fitFor) };
    });

    var fittingFull = kits.filter(function (k) { return k.full.total <= budget; });
    var chosen, tier;
    if (fittingFull.length) {
      fittingFull.sort(function (a, b) { return b.fit - a.fit || b.full.total - a.full.total; });
      chosen = fittingFull[0]; tier = "full";
    } else {
      var fittingCore = kits.filter(function (k) { return k.core.total <= budget; });
      if (fittingCore.length) {
        fittingCore.sort(function (a, b) { return b.fit - a.fit || b.core.total - a.core.total; });
        chosen = fittingCore[0]; tier = "core";
      } else {
        kits.sort(function (a, b) { return a.core.total - b.core.total || b.fit - a.fit; });
        chosen = kits[0]; tier = "over";
      }
    }

    var best = chosen;
    var items = tier === "full" ? best.full.items : tier === "core" ? best.core.items : best.core.items;
    var reasons = (tier === "full" ? best.full.reasons : best.core.reasons).slice();

    if (tier === "core") {
      reasons.unshift("At " + money(budget) + " the honest build is the deck, the cue headphones and the cable — no speakers yet. Borrow or hire a PA for the first parties and add monitors when you can.");
    }
    if (tier === "over") {
      reasons.unshift("Even the leanest version of this rig lands around " + money(best.core.total) + ", which is over the " + money(budget) +
        " ceiling. The deck is still the right first purchase; the rest can arrive over the following months.");
    }

    /* Honest budget reality: what the next step up would cost. */
    var better = kits.filter(function (k) { return k.fit > best.fit && k.full.total > budget; })
      .sort(function (a, b) { return a.full.total - b.full.total; })[0];
    if (better) {
      reasons.push("The next real step up is the " + better.controller.model + " at " + money(better.controller.price) +
        " — it pushes this build to about " + money(better.full.total) + ", over the " + money(budget) +
        " ceiling. Worth saving for if clubs are the goal.");
    }
    [["laptops", "laptop"], ["headphones", "headphones"], ["speakers", "speakers"], ["controllers", "decks"]].forEach(function (pair) {
      if (owns.indexOf(pair[0]) !== -1) reasons.push("You marked your " + pair[1] + " as owned, so it is not in the buying list.");
    });

    var total = items.reduce(function (n, s) {
      var it = byId(s.itemId);
      return n + (it && !s.owned ? it.price * (s.qty || 1) : 0);
    }, 0);

    var headline = tier === "core" ? "The first half of a rig, bought in the right order"
      : tier === "over" ? "The cheapest honest start, and what it still costs"
      : venue === "mobile" ? "A rig you can carry into a venue and set up alone"
      : venue === "club" ? "The closest thing to a club booth at this budget"
      : venue === "house" ? "Loud enough for a party, small enough for a spare room"
      : "A bedroom rig that teaches you to mix properly";

    return {
      title: headline,
      summary: "Built around the " + best.controller.brand + " " + best.controller.model + " for a " +
        (venue === "bedroom" ? "bedroom" : venue === "house" ? "house-party" : venue === "club" ? "club-style" : "mobile") +
        " rig with a " + money(budget) + " ceiling.",
      items: items, reasons: reasons, buyTotal: total, budget: budget, tier: tier,
      controller: best.controller.id, answers: answers
    };
  }

  function controllerScore(c, opts) {
    var s = 0;
    if (c.pick) s += 2;
    if (opts.standalone && c.standalone) s += 6;
    if (opts.standalone && !c.standalone) s -= 4;
    if (!opts.standalone && c.standalone) s -= 1;
    if (opts.club && c.channels === 4) s += 3;
    if (!opts.club && c.channels === 4) s += 1;
    if (/xlr/i.test((c.master_outputs || []).join(" "))) s += opts.club ? 2 : 1;
    if (/serato dj pro|traktor pro|rekordbox/i.test((c.software_unlocks || []).join(" "))) s += 1;
    if (opts.venue === "bedroom" && c.price <= 350) s += 3;
    if (opts.venue === "house" && c.price > 250 && c.price <= 900) s += 2;
    if (opts.venue === "mobile" && c.price > 1500) s += 1;
    if (c.channels === 2 && opts.venue === "club") s -= 2;
    return s;
  }

  /* Build the supporting kit for a given controller and report whether it fits. */
  function kitFor(controller, opts) {
    var items = [];
    var reasons = [];
    var owns = opts.owns || [];
    var core = opts.tier === "core";   /* deck + cue + cable only */

    /* Controller */
    if (owns.indexOf("controllers") === -1) {
      items.push(newSlot("controllers", controller.id, false));
      reasons.push("The " + controller.brand + " " + controller.model + " at " + money(controller.price) + (controller.standalone
        ? " needs no laptop: it plays from USB, so the rig is one box fewer to carry."
        : " unlocks " + (controller.software_unlocks || []).slice(0, 2).join(" and ") + " — no paid software to start."));
    } else {
      items.push(newSlot("controllers", null, true));
      reasons.push("You already have decks, so the slot is left open for your exact model — swap it in and the cable check updates.");
    }

    /* Host */
    var host = null;
    if (!controller.standalone) {
      if (owns.indexOf("laptops") !== -1) {
        host = { id: "owned-laptop", price: 0, model: "your laptop" };
      } else {
        var laptopId = opts.venue === "club" ? "macbook-air-m2" : "windows-dj-laptop";
        host = byId(laptopId);
        items.push(newSlot("laptops", laptopId, false));
        reasons.push("A " + money(host.price) + " DJ-spec laptop is in the budget, because a controller is only a surface without one.");
      }
    } else {
      reasons.push("No laptop in the build — standalone hardware also means no software licence and no OS update the night before a gig.");
    }

    /* Headphones */
    if (owns.indexOf("headphones") === -1) {
      var hpId = opts.budget >= 900 ? "sennheiser-hd25" : opts.budget >= 500 ? "pioneer-hdj-cue1" : "ath-m20x";
      var hp = byId(hpId);
      items.push(newSlot("headphones", hpId, false));
      reasons.push(hp.model + " for cueing (" + money(hp.price) + ") — closed-back so the room does not bleed into your mix.");
    }

    /* Speakers */
    var speakers = [];
    if (core) {
      /* deliberately no output stage in a core build */
    } else if (owns.indexOf("speakers") === -1) {
      if (opts.venue === "mobile") {
        speakers.push({ slot: newSlot("speakers", "jbl-eon-715", false), item: byId("jbl-eon-715") });
        reasons.push("A 15-inch powered PA speaker is the honest choice for a wedding or a garden party: it fills a room without a separate amp.");
      } else if (opts.venue === "house") {
        var hspk = byId(opts.budget >= 700 ? "pioneer-dm50d" : "pioneer-dm40d");
        speakers.push({ slot: newSlot("speakers", hspk.id, false), item: hspk });
        reasons.push(hspk.model + " monitors are enough for a front room and still accurate enough to learn on.");
      } else if (opts.venue === "club") {
        speakers.push({ slot: newSlot("speakers", "yamaha-hs5", false), item: byId("yamaha-hs5") });
        reasons.push("HS5s with balanced inputs match the club-style outputs on the deck, so your practice chain mirrors the booth.");
      } else {
        speakers.push({ slot: newSlot("speakers", "pioneer-dm40d", false), item: byId("pioneer-dm40d") });
        reasons.push("DM-40D monitors are small enough for a desk and honest enough to mix on.");
      }
    }
    speakers.forEach(function (s) { if (s.item) items.push(s.slot); });

    /* Cables for each speaker that has a model */
    var cableCats = {};
    speakers.forEach(function (s) {
      if (!s.item) return;
      var plan = cableFor(controller, s.item);
      if (plan.itemId && !cableCats[plan.itemId]) {
        var runs = runsFor(s.slot, s.item);
        var slot = newSlot("cables", plan.itemId, false);
        slot.qty = runs;
        items.push(slot);
        cableCats[plan.itemId] = true;
        reasons.push(runs + " × " + plan.name + " (" + money((byId(plan.itemId) || {}).price * runs) + ") — the piece most first rigs forget until the speakers are silent.");
      }
    });

    /* Mic for mobile */
    if (opts.venue === "mobile" && !core) {
      items.push(newSlot("microphones", "mic-shure-sm58", false));
      reasons.push("An SM58 is the default vocal mic for weddings and announcements, and it survives being dropped.");
    }

    /* Storage for standalone */
    if (controller.standalone) {
      items.push(newSlot("storage", "usb-sandisk-extreme", false));
      reasons.push("A fast USB drive is how a standalone deck actually reads your library.");
    }

    var total = items.reduce(function (n, s) {
      var it = byId(s.itemId);
      return n + (it && !s.owned ? it.price * (s.qty || 1) : 0);
    }, 0);

    return { items: items, total: total, reasons: reasons };
  }

  /* ------------------------------------------------- 7. Actions & wiring */
  function presetItems(preset) {
    var out = [];
    var owned = preset.owned || [];
    Object.keys(preset.slots || {}).forEach(function (cat) {
      if (preset.slots[cat]) out.push(newSlot(cat, preset.slots[cat], owned.indexOf(cat) !== -1));
    });
    return out;
  }

  function useItem(itemId) {
    var d = state.drawer;
    if (!d) return;
    var item = byId(itemId);
    if (!item) return;
    var slot = slotById(d.slotId);
    if (!slot) {
      slot = newSlot(d.category || item.category, itemId, false);
      state.items.push(slot);
    } else {
      slot.itemId = itemId;
      slot.category = item.category;
    }
    state.drawer = null;
    saveAndRender();
    toast("Rig updated · " + item.model);
  }

  function openDrawer(slotId, category, opts) {
    opts = opts || {};
    rememberFocus();
    state.drawer = {
      slotId: slotId, category: category, mode: "pick",
      query: "", price: "all", sort: "pick", picked: [],
      focusSearch: Boolean(opts.focusSearch)
    };
    render();
  }

  function addSlotAndPick(category) {
    var slot = newSlot(category, null, false);
    state.items.push(slot);
    openDrawer(slot.slotId, category, { focusSearch: true });
  }

  function toggleOwned(slotId) {
    var slot = slotById(slotId);
    if (!slot) return;
    slot.owned = !slot.owned;
    saveAndRender();
    toast(slot.owned ? "Marked as owned — removed from the shopping list" : "Added back to the shopping list");
  }

  function changeQty(slotId, delta) {
    var slot = slotById(slotId);
    if (!slot) return;
    var next = (slot.qty || 1) + delta;
    if (next < 1 || next > 4) return;
    slot.qty = next;
    saveAndRender();
  }

  function removeSlot(slotId) {
    state.items = state.items.filter(function (s) { return s.slotId !== slotId; });
    saveAndRender();
    toast("Removed from the rig");
  }

  function saveAndRender() {
    save();
    render();
  }

  function autoFix() {
    var rig = computeRig();
    var added = [];
    var controller = rig.controller;

    if (!controller) {
      var c = byId("pioneer-ddj-flx4");
      state.items.push(newSlot("controllers", c.id, false));
      added.push(c.model);
      controller = c;
    }
    if (!controller.standalone && !slotsOf("laptops").filter(function (s) { return s.itemId && s.itemId !== "standalone-usb-only"; }).length) {
      var stray = slotsOf("laptops").filter(function (s) { return s.itemId === "standalone-usb-only"; })[0];
      if (stray) { stray.itemId = "windows-dj-laptop"; added.push("a laptop"); }
      else { state.items.push(newSlot("laptops", "windows-dj-laptop", false)); added.push("a laptop"); }
    }
    if (controller.standalone) {
      slotsOf("laptops").forEach(function (s) { s.itemId = "standalone-usb-only"; });
    }
    if (!slotsOf("headphones").filter(function (s) { return s.itemId; }).length) {
      var hpSlot = slotsOf("headphones")[0] || newSlot("headphones", null, false);
      if (!slotById(hpSlot.slotId)) state.items.push(hpSlot);
      hpSlot.itemId = "pioneer-hdj-cue1";
      added.push("headphones");
    }
    var speakers = slotsOf("speakers").filter(function (s) { return s.itemId; });
    if (!speakers.length) {
      var spkSlot = slotsOf("speakers")[0] || newSlot("speakers", null, false);
      if (!slotById(spkSlot.slotId)) state.items.push(spkSlot);
      spkSlot.itemId = "pioneer-dm40d";
      speakers = [spkSlot];
      added.push("speakers");
    }
    /* Cables for every speaker, quantity included */
    var totalNeeded = 0, cableId = null;
    speakers.forEach(function (slot) {
      var plan = cableFor(controller, itemOf(slot));
      if (plan.itemId) {
        totalNeeded += runsFor(slot, itemOf(slot));
        cableId = cableId || plan.itemId;
        if (plan.itemId !== cableId) {
          /* mixed cable types: add the run for this one separately */
          var extra = slotsOf("cables").filter(function (s) { return s.itemId === plan.itemId; })[0];
          if (extra) extra.qty = Math.max(extra.qty || 1, runsFor(slot, itemOf(slot)));
          else { var ns = newSlot("cables", plan.itemId, false); ns.qty = runsFor(slot, itemOf(slot)); state.items.push(ns); added.push("a cable"); }
        }
      }
    });
    if (cableId) {
      var existing = slotsOf("cables").filter(function (s) { return s.itemId === cableId; })[0];
      if (!existing) { var cslot = newSlot("cables", cableId, false); cslot.qty = totalNeeded; state.items.push(cslot); added.push("the cable"); }
      else if ((existing.qty || 1) < totalNeeded) { existing.qty = totalNeeded; }
    }
    if (controller.standalone && !slotsOf("storage").filter(function (s) { return s.itemId; }).length) {
      state.items.push(newSlot("storage", "usb-sandisk-extreme", false));
      added.push("a USB drive");
    }
    state.ribbon = null;
    saveAndRender();
    toast(added.length ? "Added " + added.join(", ") : "The rig already had everything");
  }

  function startScratch(keepOwned) {
    state.items = [];
    state.name = "My setup";
    state.view = "studio";
    if (keepOwned) {
      state.items.push(newSlot("controllers", null, false));
    }
    saveAndRender();
  }

  function loadPreset(presetId) {
    var preset = presets().filter(function (p) { return p.id === presetId; })[0];
    if (!preset) return;
    state.name = preset.name;
    state.items = presetItems(preset);
    state.view = "studio";
    state.ribbon = null;
    saveAndRender();
    toast(preset.name + " loaded");
  }

  function doSave(name) {
    var finalName = (name || state.name || "My rig").trim().slice(0, 60);
    state.name = finalName;
    var saved = loadSavedRigs();
    var existing = saved.findIndex(function (r) { return r.name === finalName; });
    var entry = {
      name: finalName,
      items: JSON.parse(JSON.stringify(state.items)),
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    };
    if (existing >= 0) saved[existing] = entry; else saved.unshift(entry);
    writeSavedRigs(saved);
    state.modal = null;
    if (state.ribbon && state.ribbon.kind === "shared") state.ribbon = null;
    saveAndRender();
    toast(existing >= 0 ? "Saved over “" + finalName + "”" : "Saved “" + finalName + "”");
  }

  function loadSaved(index) {
    var saved = loadSavedRigs();
    var r = saved[index];
    if (!r) return;
    state.name = r.name;
    state.items = (r.items || []).map(function (s) {
      return { slotId: s.slotId || ("s-" + (s.category || "x") + "-" + Math.random().toString(36).slice(2, 7)), category: s.category, itemId: s.itemId, qty: s.qty || 1, owned: Boolean(s.owned) };
    });
    state.view = "studio";
    saveAndRender();
    toast("Opened “" + r.name + "”");
    window.scrollTo({ top: root.offsetTop - 90, behavior: "smooth" });
  }

  function deleteSaved(index) {
    var saved = loadSavedRigs();
    var r = saved[index];
    if (!r) return;
    if (!window.confirm("Delete “" + r.name + "” from this browser? This cannot be undone.")) return;
    saved.splice(index, 1);
    writeSavedRigs(saved);
    render();
    toast("Deleted “" + r.name + "”");
  }

  function shoppingText() {
    var rig = computeRig();
    var lines = ["OFFBEAT — MY DJ RIG SHOPPING LIST", state.name, "Generated " + new Date().toLocaleDateString("en-US"), ""];
    var need = 0;
    ROLE_ORDER.forEach(function (cat) {
      var group = (rig.groups[cat] || []).filter(function (l) { return l.item && !l.slot.owned; });
      if (!group.length) return;
      lines.push(ROLE_LABEL[cat].toUpperCase());
      group.forEach(function (l) {
        need += l.lineTotal;
        lines.push("  " + (l.qty > 1 ? l.qty + " × " : "") + l.item.brand + " " + l.item.model + " — " + money(l.lineTotal));
      });
      lines.push("");
    });
    lines.push("ESTIMATED TOTAL: " + money(need));
    lines.push("");
    var owned = state.items.filter(function (s) { return s.owned && s.itemId; });
    if (owned.length) {
      lines.push("ALREADY OWNED (not in the total)");
      owned.forEach(function (s) { lines.push("  " + itemOf(s).brand + " " + itemOf(s).model); });
      lines.push("");
    }
    lines.push("Prices are Offbeat estimates from October 2026, not live quotes.");
    lines.push("Recreate or edit this rig: " + shareUrl({ n: state.name, i: state.items }));
    return lines.join("\n");
  }

  function copyText(text, okMessage) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast(okMessage || "Copied"); })
        .catch(function () { fallbackCopy(text, okMessage); });
    } else {
      fallbackCopy(text, okMessage);
    }
  }
  function fallbackCopy(text, okMessage) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); toast(okMessage || "Copied"); } catch (e) { toast("Copy failed — select the text manually"); }
    document.body.removeChild(ta);
  }

  function downloadShopping() {
    var blob = new Blob([shoppingText()], { type: "text/plain" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (state.name || "my-dj-rig").toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-shopping-list.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    toast("Shopping list downloaded");
  }

  var lastFocus = null;
  function rememberFocus() {
    if (document.activeElement && document.activeElement !== document.body) lastFocus = document.activeElement;
  }
  function restoreFocus() {
    if (lastFocus && document.body.contains(lastFocus)) {
      try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }
    lastFocus = null;
  }

  function toast(message) {
    if (!toastRoot) return;
    var el = document.createElement("div");
    el.className = "rs-toast";
    el.innerHTML = icon("check") + "<span>" + escapeHtml(message) + "</span>";
    toastRoot.appendChild(el);
    setTimeout(function () {
      el.style.transition = "opacity .3s ease, transform .3s ease";
      el.style.opacity = "0";
      el.style.transform = "translateY(6px)";
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
    }, 2600);
  }

  function scrollToShop() {
    var el = document.getElementById("rs-shop");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* Arrival handling: ?add=, ?preset=, ?rig=, ?start=guide */
  function handleArrival() {
    var params = new URLSearchParams(location.search);
    var add = params.get("add");
    var preset = params.get("preset");
    var rigParam = params.get("rig");
    var start = params.get("start");

    if (rigParam) {
      try {
        var parsed = decodePayload(rigParam);
        var items = (parsed.i || parsed.items || []).map(function (s) {
          return { slotId: s.slotId || ("s-" + (s.category || "x") + "-" + Math.random().toString(36).slice(2, 7)), category: s.category, itemId: s.itemId || s.id || null, qty: s.qty || 1, owned: Boolean(s.owned) };
        }).filter(function (s) { return s.category; });
        state.name = parsed.n || parsed.name || "Shared build";
        state.items = items;
        state.view = "studio";
        state.ribbon = { kind: "shared" };
        return true;
      } catch (e) { /* fall through to stored state */ }
    }

    if (add) {
      var item = byId(add);
      if (item) {
        var existing = slotsOf(item.category)[0];
        if (existing && existing.itemId) {
          existing.itemId = item.id;
        } else if (existing) {
          existing.itemId = item.id;
        } else {
          state.items.push(newSlot(item.category, item.id, false));
        }
        state.view = "studio";
        if (!state.items.length) state.view = "studio";
        var rig = computeRig();
        var gaps = rig.checks.filter(function (c) { return c.level === "bad"; }).length;
        var missingPrice = 0;
        rig.checks.forEach(function (c) {
          if (c.action && c.action.kind === "swap-cat" && c.action.itemId) {
            var it = byId(c.action.itemId);
            if (it) missingPrice += it.price;
          }
        });
        state.ribbon = {
          kind: "added", label: item.brand + " " + item.model, gaps: gaps,
          missingPrice: missingPrice, reviewUrl: item.slug || "dj-controllers-hub.html",
          from: item.slug ? "the Offbeat " + item.model + " guide" : "the Offbeat catalog"
        };
        return true;
      }
    }

    if (preset) {
      var p = presets().filter(function (x) { return x.id === preset; })[0];
      if (p) {
        state.name = p.name;
        state.items = presetItems(p);
        state.view = "studio";
        return true;
      }
    }

    if (start === "guide") {
      state.view = "start";
      startQuiz();
      return true;
    }

    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        var data = JSON.parse(stored);
        if (data && Array.isArray(data.items)) {
          state.items = data.items;
          state.name = data.name || "My setup";
          state.view = data.view === "studio" || data.items.length ? "studio" : "start";
          return true;
        }
      } catch (e) { /* ignore corrupt storage */ }
    }

    /* Migrate the old builder's saved rig if it exists */
    var legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      try {
        var old = JSON.parse(legacy);
        if (old && (old.items || old.slots)) {
          state.items = old.items ? old.items.map(function (s) {
            return { slotId: s.slotId || ("s-" + s.category + "-" + Math.random().toString(36).slice(2, 7)), category: s.category, itemId: s.itemId, qty: s.qty || 1, owned: Boolean(s.owned) };
          }) : [];
          state.name = old.name || "My setup";
          state.view = "studio";
          return true;
        }
      } catch (e) { /* ignore */ }
    }
    return false;
  }

  /* ------------------------------------------------------------- Events */
  var ACTIONS = {
    "quiz-open": function () { startQuiz(); },
    "start-scratch": function () { startScratch(false); },
    "start-owned": function () {
      state.items = [
        newSlot("controllers", null, false),
        newSlot("headphones", null, true),
        newSlot("laptops", null, true)
      ];
      state.name = "My rig";
      state.view = "studio";
      state.ribbon = {
        kind: "guide",
        title: "Built around what you own.",
        body: "Headphones and laptop are marked as owned, so they never appear in the shopping list. Add your real models when you are ready."
      };
      saveAndRender();
    },
    "start-over": function () {
      state.menuOpen = false;
      state.view = "start";
      state.drawer = null;
      state.ribbon = null;
      render();
      window.scrollTo({ top: root.offsetTop - 90, behavior: "smooth" });
    },
    "preset": function (el) { loadPreset(el.getAttribute("data-preset")); },
    "pick": function (el) { openDrawer(el.getAttribute("data-slot"), el.getAttribute("data-cat")); },
    "add-slot": function (el) { addSlotAndPick(el.getAttribute("data-cat")); },
    "add-palette": function () {
      state.modal = { kind: "palette" };
      render();
    },
    "qty": function (el) { changeQty(el.getAttribute("data-slot"), parseInt(el.getAttribute("data-step"), 10)); },
    "own": function (el) { toggleOwned(el.getAttribute("data-slot")); },
    "remove": function (el) { removeSlot(el.getAttribute("data-slot")); },
    "save": function () { state.modal = { kind: "save" }; render(); },
    "do-save": function () {
      var input = modalRoot.querySelector("[data-save-name]");
      doSave(input ? input.value : state.name);
    },
    "share": function () { state.modal = { kind: "share", payload: null }; render(); },
    "share-saved": function (el) {
      var saved = loadSavedRigs();
      var r = saved[parseInt(el.getAttribute("data-index"), 10)];
      if (r) { state.modal = { kind: "share", payload: { n: r.name, i: r.items } }; render(); }
    },
    "copy-share": function () {
      var input = modalRoot.querySelector("#rs-share-url");
      if (input) copyText(input.value, "Share link copied");
    },
    "compare": function () { state.modal = { kind: "compare", compare: { a: 0, b: 1 } }; state.menuOpen = false; render(); },
    "compare-saved": function (el) {
      /* option order in the compare modal is: this rig, templates…, saved… */
      var i = parseInt(el.getAttribute("data-index"), 10);
      var asA = 1 + presets().length + i;
      state.modal = { kind: "compare", compare: { a: asA, b: 0 } };
      state.menuOpen = false;
      render();
    },
    "close-modal": function () {
      state.modal = null;
      renderModal();
      if (paletteRoot) paletteRoot.innerHTML = "";
    },
    "menu": function () { state.menuOpen = !state.menuOpen; render(); },
    "toggle-sound": function () { soundOn = !soundOn; state.menuOpen = false; render(); toast(soundOn ? "Click sounds on" : "Click sounds off"); },
    "scroll-shop": function () { scrollToShop(); },
    "copy-shop": function () { copyText(shoppingText(), "Shopping list copied"); },
    "download-shopping": function () { downloadShopping(); state.menuOpen = false; },
    "print": function () { state.menuOpen = false; window.print(); },
    "autofix": function () { autoFix(); },
    "dismiss-ribbon": function () { state.ribbon = null; render(); },
    "load-saved": function (el) { loadSaved(parseInt(el.getAttribute("data-index"), 10)); },
    "del-saved": function (el) { deleteSaved(parseInt(el.getAttribute("data-index"), 10)); },
    "details": function (el) {
      var item = byId(el.getAttribute("data-item"));
      if (!item) return;
      state.drawer = {
        slotId: (slotsOf(item.category).filter(function (s) { return s.itemId === item.id; })[0] || {}).slotId || "",
        category: item.category, mode: "detail", itemId: item.id, query: "", price: "all", sort: "pick", picked: []
      };
      render();
    },
    "check-action": function (el) {
      var kind = el.getAttribute("data-kind");
      var cat = el.getAttribute("data-cat");
      var itemId = el.getAttribute("data-item");
      var qty = parseInt(el.getAttribute("data-qty"), 10) || 1;
      if (kind === "pick-cat") addSlotAndPick(cat);
      else if (kind === "swap-cat") {
        var slot = slotsOf(cat)[0];
        if (slot) { slot.itemId = itemId; saveAndRender(); toast("Added " + (byId(itemId) || {}).model); }
        else { state.items.push(newSlot(cat, itemId, false)); saveAndRender(); toast("Added to the rig"); }
      } else if (kind === "add-cable") {
        var existing = slotsOf("cables").filter(function (s) { return s.itemId === itemId; })[0];
        if (existing) existing.qty = (existing.qty || 1) + qty;
        else { var s2 = newSlot("cables", itemId, false); s2.qty = qty; state.items.push(s2); }
        saveAndRender();
        toast("Cable runs added");
      }
    },
    "upgrade-apply": function (el) {
      var itemId = el.getAttribute("data-item");
      var slotId = el.getAttribute("data-slot");
      var cat = el.getAttribute("data-cat");
      var slot = slotId ? slotById(slotId) : null;
      if (slot) { slot.itemId = itemId; saveAndRender(); toast("Swapped in " + (byId(itemId) || {}).model); return; }
      if (cat) { state.items.push(newSlot(cat, itemId, false)); saveAndRender(); toast("Added " + (byId(itemId) || {}).model); return; }
      state.items.push(newSlot((byId(itemId) || {}).category, itemId, false));
      saveAndRender();
      toast("Added to the rig");
    },
    "name": function () { /* handled by input listener */ },
    "quiz-back": function () { if (state.quiz.step > 0) { state.quiz.step--; render(); } },
    "quiz-next": function () {
      var q = state.quiz;
      var step = QUIZ_STEPS[q.step];
      var answer = q.answers[step.key];
      if (step.multi) {
        /* multi-step allows zero selections */
      } else if (answer == null) {
        toast("Pick one to continue");
        return;
      }
      if (q.step < QUIZ_STEPS.length - 1) {
        q.step++;
        render();
      } else {
        q.result = buildRecommendation(q.answers);
        render();
      }
    },
    "quiz-restart": function () { startQuiz(); },
    "quiz-apply": function () {
      var result = state.quiz.result;
      state.items = result.items.map(function (s) {
        return { slotId: s.slotId, category: s.category, itemId: s.itemId, qty: s.qty || 1, owned: Boolean(s.owned) };
      });
      state.name = "Guided rig";
      state.view = "studio";
      state.modal = null;
      state.quiz = null;
      saveAndRender();
      toast("Rig built — adjust anything you like");
      window.scrollTo({ top: root.offsetTop - 90, behavior: "smooth" });
    }
  };

  /* The "add equipment" palette: a compact modal listing every role. */
  var paletteRoot = null;
  function renderPalette() {
    if (!paletteRoot) return;
    if (!state.modal || state.modal.kind !== "palette") { paletteRoot.innerHTML = ""; return; }
    var roles = ROLE_ORDER.map(function (cat) {
      return '<button type="button" class="rs-path" data-rs="palette-pick" data-cat="' + cat + '" style="padding:.7rem .8rem">' +
        '<span class="rs-path-top"><span class="rs-path-icon">' + icon(CAT_ICON[cat]) + "</span>" +
        '<span class="rs-path-cta">Add →</span></span>' +
        "<h3 style=\"font-size:.92rem\">" + escapeHtml(ROLE_LABEL[cat]) + "</h3>" +
        '<p style="font-size:.78rem">' + escapeHtml(ROLE_HINT[cat]) + "</p></button>";
    }).join("");
    paletteRoot.innerHTML = '<div class="rs-modal-backdrop" data-rs="close-palette">' +
      '<div class="rs-modal" role="dialog" aria-modal="true" aria-labelledby="rs-palette-title">' +
        '<div class="rs-modal-head"><div><span class="rs-eyebrow">' + icon("plus") + "Add equipment</span>" +
          '<h2 id="rs-palette-title">What is going into the rig?</h2>' +
          "<p>Pick a role and the studio filters the catalog for it.</p></div>" +
          '<button type="button" class="rs-close" data-rs="close-palette" aria-label="Close">✕</button></div>' +
        '<div class="rs-modal-body"><div class="rs-paths" style="margin-top:0">' + roles + "</div></div>" +
      "</div></div>";
  }

  function closePalette() {
    state.modal = null;
    if (paletteRoot) paletteRoot.innerHTML = "";
    render();
  }

  document.addEventListener("click", function (e) {
    var closePaletteEl = e.target.closest("[data-rs='close-palette']");
    if (closePaletteEl) { closePalette(); return; }

    var palettePick = e.target.closest("[data-rs='palette-pick']");
    if (palettePick) {
      var cat = palettePick.getAttribute("data-cat");
      closePalette();
      addSlotAndPick(cat);
      return;
    }

    var quizOpt = e.target.closest("[data-quiz-name]");
    if (quizOpt && state.quiz) {
      answerQuiz(quizOpt.getAttribute("data-quiz-name"), quizOpt.getAttribute("data-quiz-val"));
      return;
    }

    var el = e.target.closest("[data-rs]");
    if (!el) {
      if (state.menuOpen && !e.target.closest(".rs-menu-wrap")) { state.menuOpen = false; render(); }
      return;
    }
    var action = el.getAttribute("data-rs");
    if (action === "close-drawer") {
      if (state.drawer) { state.drawer = null; render(); }
      return;
    }
    if (action === "menu" && el.tagName === "BUTTON") {
      state.menuOpen = !state.menuOpen;
      render();
      return;
    }
    if (ACTIONS[action]) {
      if (el.tagName === "BUTTON" || el.tagName === "A") {
        ACTIONS[action](el, e);
      }
    }
  });

  document.addEventListener("change", function (e) {
    if (e.target.matches("[data-rs='name']")) {
      state.name = e.target.value.trim().slice(0, 60) || "My setup";
      save();
      var chip = root.querySelector(".rs-bar-id .rs-name-input");
      if (chip) chip.value = state.name;
    }
  });

  document.addEventListener("input", function (e) {
    if (e.target.matches("[data-rs='name']")) {
      state.name = e.target.value.slice(0, 60);
      save();
    }
  });

  function trapFocus(e) {
    if (e.key !== "Tab") return;
    var layer = state.drawer ? drawerRoot.querySelector(".rs-drawer")
      : (modalRoot.querySelector(".rs-modal") || (paletteRoot && paletteRoot.querySelector(".rs-modal")));
    if (!layer) return;
    var focusables = layer.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    if (!layer.contains(document.activeElement)) { e.preventDefault(); first.focus(); return; }
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  document.addEventListener("keydown", trapFocus);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (state.drawer) { state.drawer = null; render(); return; }
      if (state.modal) { state.modal = null; render(); return; }
      if (state.menuOpen) { state.menuOpen = false; render(); }
    }
    if (e.key === "Enter" && e.target.matches("[data-quiz-name]")) {
      e.preventDefault();
      e.target.click();
    }
  });

  /* --------------------------------------------------------------- Boot */
  function boot() {
    drawerRoot = document.getElementById("rs-drawer-root");
    modalRoot = document.getElementById("rs-modal-root");
    toastRoot = document.getElementById("rs-toasts");
    paletteRoot = document.getElementById("rs-palette-root");
    if (!drawerRoot) { drawerRoot = document.createElement("div"); drawerRoot.id = "rs-drawer-root"; document.body.appendChild(drawerRoot); }
    if (!modalRoot) { modalRoot = document.createElement("div"); modalRoot.id = "rs-modal-root"; document.body.appendChild(modalRoot); }
    if (!paletteRoot) { paletteRoot = document.createElement("div"); paletteRoot.id = "rs-palette-root"; document.body.appendChild(paletteRoot); }
    if (!toastRoot) { toastRoot = document.createElement("div"); toastRoot.id = "rs-toasts"; toastRoot.className = "rs-toasts"; document.body.appendChild(toastRoot); }

    fetch("assets/dj-gear-catalog.json")
      .then(function (r) {
        if (!r.ok) throw new Error("catalog " + r.status);
        return r.json();
      })
      .then(function (data) {
        CATALOG = data;
        handleArrival();
        render();
      })
      .catch(function (err) {
        if (root) root.innerHTML = '<div class="rs-panel"><div class="rs-panel-body"><p><strong>The gear catalog did not load.</strong> ' +
          "This page needs <code>assets/dj-gear-catalog.json</code> to render the rig. Reload, or read the " +
          '<a href="dj-equipment-checklist.html">printable equipment checklist</a> instead.</p></div></div>';
        console.error("Rig Studio: catalog failed", err);
      });

    /* Test hooks. Read-only views of the same state the UI renders. */
    window.__rigStudio = {
      state: function () { return { name: state.name, items: state.items.slice(), budget: state.budget }; },
      cost: function () {
        var r = computeRig();
        return { fullTotal: r.value, ownedTotal: r.ownedValue, buyTotal: r.buyTotal, itemCount: r.itemCount };
      },
      shoppingList: function () {
        return shoppingList(computeRig()).map(function (l) { return { itemId: l.itemId, qty: l.qty, lineTotal: l.lineTotal }; });
      },
      shareUrl: function () { return shareUrl({ n: state.name, i: state.items }); },
      readiness: function () { return (computeRig().checks || []).map(function (c) { return { key: c.key, level: c.level }; }); }
    };

    window.addEventListener("resize", function () {
      window.clearTimeout(drawWires._t);
      drawWires._t = window.setTimeout(drawWires, 120);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
