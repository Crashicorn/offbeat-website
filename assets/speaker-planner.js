/* Speaker connection planner — the step the speaker guide used to skip.
 *
 * The finder above answers "what kind of speaker do I need". This answers the
 * question that actually decides whether the purchase works: what has to plug
 * into what, and which part of that is already in the box.
 *
 * It is not a second tool with its own opinions. It loads the same catalogue
 * (assets/dj-gear-catalog.json) and the same rules (assets/gear-connections.js)
 * that Rig Studio uses, shows the exact plan, and hands the whole thing to Rig
 * Studio through the same encoded payload the guides already use.
 */
(function () {
  "use strict";

  var root = document.querySelector("[data-speaker-planner]");
  if (!root) return;

  var planTarget = root.querySelector("[data-speaker-plan]");
  var catalog = null;

  /* One route per job. The price shown is the catalogue price for one box. */
  var ROUTES = {
    desk: { primary: "pioneer-dm40d", alternative: "pioneer-dm50d" },
    production: { primary: "yamaha-hs5", alternative: "krk-classic-5-pair" },
    room: { primary: "jbl-eon-715", alternative: null },
    quiet: { primary: null, alternative: null }
  };

  /* A deck choice either names a catalogue controller or stands in for "some
     other deck with this output", so the plan can still be honest about the
     lead without pretending to know the model. */
  var DECKS = {
    "pioneer-ddj-flx2": { itemId: "pioneer-ddj-flx2", label: "Pioneer DDJ-FLX2", output: "jack35" },
    "pioneer-ddj-flx4": { itemId: "pioneer-ddj-flx4", label: "Pioneer DDJ-FLX4", output: "rca" },
    "pioneer-ddj-flx10": { itemId: "pioneer-ddj-flx10", label: "Pioneer DDJ-FLX10", output: "xlr" },
    "output-rca": { itemId: null, label: "your controller's RCA output", output: "rca" },
    "output-xlr": { itemId: null, label: "your controller's XLR output", output: "xlr" }
  };

  var CONNECTOR_STUB = {
    rca: { connector: "rca", channels: 2, balanced: false, role: "master", label: "RCA master" },
    jack35: { connector: "jack35", channels: 2, balanced: false, role: "master", label: "3.5 mm master" },
    xlr: { connector: "xlr", channels: 2, balanced: true, role: "master", label: "XLR master" }
  };

  function byId(id) {
    return catalog.items.filter(function (item) { return item.id === id; })[0] || null;
  }
  function money(value) { return "$" + Math.round(Number(value) || 0).toLocaleString("en-US"); }
  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }
  function selectedValue(name) {
    var input = root.querySelector('input[name="' + name + '"]:checked') || document.querySelector('input[name="' + name + '"]:checked');
    return input ? input.value : null;
  }
  function speakersOwned() {
    var input = root.querySelector('input[name="speaker-owned"]');
    return Boolean(input && input.checked);
  }
  function selectedDeck() {
    var value = selectedValue("speaker-deck") || "pioneer-ddj-flx4";
    var deck = DECKS[value] || DECKS["pioneer-ddj-flx4"];
    var controller = deck.itemId ? byId(deck.itemId) : { id: null, model: deck.label, outputs: [CONNECTOR_STUB[deck.output]] };
    return { key: value, deck: deck, controller: controller };
  }

  function planFor(speakerItem, deck) {
    return window.OffbeatGear.connectionPlan(catalog, deck.controller, speakerItem, 1);
  }

  function cableCost(plan, units) {
    if (!plan.itemId || !units) return 0;
    var item = byId(plan.itemId);
    return item ? Number(item.price) * units : 0;
  }

  function encode(payload) {
    var encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function rigHref(deck, speakerItem, plan, speakersOwned) {
    var slots = [];
    if (deck.deck.itemId) {
      slots.push({ slotId: "plan-deck", category: "controllers", itemId: deck.deck.itemId, qty: 1, owned: false });
    }
    slots.push({ slotId: "plan-speakers", category: "speakers", itemId: speakerItem.id, qty: 1, owned: Boolean(speakersOwned) });
    if (plan.kind !== "included" && plan.itemId && plan.units > 0) {
      /* When the visitor's deck is not a catalogue model, Rig Studio has no
         output to reconcile against, so the lead they were just told to buy is
         carried as a manual line: deleting it would silently change the total
         they were shown. */
      slots.push({
        slotId: "plan-cable", category: "cables", itemId: plan.itemId,
        qty: plan.units, owned: false, manual: !deck.deck.itemId
      });
    }
    return "build-your-dj-setup.html?rig=" + encodeURIComponent(encode({ n: "Speaker plan", i: slots, g: "guide" }));
  }

  function kindLabel(plan, units) {
    if (plan.kind === "included") return { tone: "inbox", text: "In the box — nothing to buy" };
    if (plan.kind === "allowance") return { tone: "allowance", text: "Planning allowance · " + money(cableCost(plan, units)) };
    if (plan.kind === "product") return { tone: "buy", text: "Verified lead · " + money(cableCost(plan, units)) };
    return { tone: "unknown", text: "Confirm the jacks" };
  }

  function planRows(speakerItem, deck) {
    var plan = planFor(speakerItem, deck);
    var boxes = 1;
    var cabinets = window.OffbeatGear.speakerUnitsOf(speakerItem) * boxes;
    var lead = plan.kind === "included" ? plan.name : (plan.name || plan.label);
    var cost = kindLabel(plan, plan.units);
    var total = Number(speakerItem.price) + cableCost(plan, plan.units);
    return { plan: plan, cabinets: cabinets, lead: lead, cost: cost, total: total, leadCost: total - Number(speakerItem.price) };
  }

  function renderOption(speakerItem, deck, name, isPrimary, speakersOwned) {
    if (!speakerItem) return "";
    var data = planRows(speakerItem, deck);
    var socketUsed = data.plan.socket ? window.OffbeatGear.endpointLabel(data.plan.socket.connector) : "input";
    var allSockets = (speakerItem.connection.inputs || []).map(function (socket) {
      return window.OffbeatGear.endpointLabel(socket.connector);
    }).join(" / ");
    var outputLabel = data.plan.output ? (data.plan.output.label || window.OffbeatGear.endpointLabel(data.plan.output.connector)) : deck.deck.label;
    var feedText = data.plan.feeds === 1
      ? "1 powered destination"
      : data.plan.feeds + " independently powered cabinets";
    return '<article class="speaker-plan-option' + (isPrimary ? " is-primary" : "") + '">' +
      '<div class="speaker-plan-option-head"><div><span class="speaker-plan-tag">' + (isPrimary ? "Your room match" : "Or this") + "</span>" +
        "<h4>" + esc(speakerItem.brand + " " + speakerItem.model) + "</h4></div>" +
        '<span class="speaker-plan-price">' + (speakersOwned ? "Owned" : money(speakerItem.price)) + "</span></div>" +
      '<ul class="speaker-plan-facts">' +
        '<li><span>Signal path</span><b title="Inputs on this cabinet: ' + esc(allSockets) + '">' +
          esc(outputLabel) + " \u2192 " + esc(socketUsed) + "</b></li>" +
        "<li><span>What it feeds</span><b>" + esc(feedText) + "</b></li>" +
        "<li><span>Lead required</span><b>" + esc(data.lead) + "</b></li>" +
        '<li class="speaker-plan-cost speaker-plan-cost--' + data.cost.tone + '"><span>That lead</span><b>' + esc(data.cost.text) + "</b></li>" +
      "</ul>" +
      '<p class="speaker-plan-note">' + esc(data.plan.note || "") + "</p>" +
      '<div class="speaker-plan-actions">' +
        '<a class="speaker-plan-cta" href="' + rigHref(deck, speakerItem, data.plan, speakersOwned) + '">Open this in Rig Studio <span aria-hidden="true">\u2192</span></a>' +
        '<span class="speaker-plan-total">' + (speakersOwned ? "Lead only" : "Speakers + lead") + " <b>" +
          money(speakersOwned ? data.leadCost : data.total) + "</b></span>" +
      "</div></article>";
  }

  function render() {
    if (!catalog || !planTarget) return;
    var use = selectedValue("speaker-use") || "desk";
    var route = ROUTES[use] || ROUTES.desk;
    var deck = selectedDeck();
    var owned = speakersOwned();

    root.querySelectorAll(".speaker-deck").forEach(function (label) {
      var input = label.querySelector("input");
      label.classList.toggle("is-selected", Boolean(input && input.checked));
    });

    if (!route.primary) {
      planTarget.innerHTML = '<div class="speaker-plan-empty"><h4>No speaker purchase in this plan</h4>' +
        '<p>Headphones-first is a real way to start: cue in closed-back headphones and buy speakers when you have a room or a gig to solve. ' +
        'Rig Studio still tracks the controller, the host and what you already own.</p>' +
        '<a class="speaker-plan-cta" href="build-your-dj-setup.html?start=guide">Plan the rest of the setup <span aria-hidden="true">\u2192</span></a></div>';
      return;
    }

    var primary = byId(route.primary);
    var alternative = route.alternative ? byId(route.alternative) : null;
    var summary = planRows(primary, deck);
    var headline;
    if (summary.plan.kind === "included") {
      headline = "No cable purchase: the " + primary.model + " box already contains " + summary.plan.includedLabel + ".";
    } else if (summary.plan.kind === "allowance") {
      headline = "No verified lead matches this socket pair, so the plan budgets " + money(cableCost(summary.plan, summary.plan.units)) + " for a " + summary.plan.label + " lead.";
    } else if (summary.plan.kind === "product") {
      headline = "This path needs " + summary.lead + " (" + money(cableCost(summary.plan, summary.plan.units)) + ").";
    } else {
      headline = "Confirm the sockets before ordering: our catalogue has no verified lead for this path.";
    }
    if (owned) {
      headline = "You already own these speakers, so this plan only prices the lead. " + headline;
    }

    planTarget.innerHTML = '<div class="speaker-plan-body">' +
      '<p class="speaker-plan-headline">' + esc(headline) + "</p>" +
      '<div class="speaker-plan-grid">' + renderOption(primary, deck, "primary", true, owned) + renderOption(alternative, deck, "alt", false, owned) + "</div>" +
      '<p class="speaker-plan-footnote">Prices are Offbeat\u2019s October 2026 US estimates for one retail box, not live quotes. ' +
      'Cable prices marked as an allowance are planning figures with no recommended SKU. Rig Studio carries the same lines, so the bill you see there matches this total.</p>' +
    "</div>";
  }

  function bind() {
    root.addEventListener("change", function (event) {
      if (event.target && /speaker-deck|speaker-owned/.test(event.target.name || "")) render();
    });
    var finder = document.querySelector(".speaker-finder");
    if (finder) {
      finder.addEventListener("change", function (event) {
        if (event.target && /speaker-use/.test(event.target.name || "")) render();
      });
    }
  }

  fetch("assets/dj-gear-catalog.json")
    .then(function (response) {
      if (!response.ok) throw new Error("catalogue request failed");
      return response.json();
    })
    .then(function (data) {
      catalog = data;
      bind();
      render();
    })
    .catch(function () {
      planTarget.innerHTML = '<div class="speaker-plan-empty"><h4>The connection plan did not load</h4>' +
        '<p>The speaker notes above still stand. You can also check the whole rig in ' +
        '<a href="build-your-dj-setup.html">Rig Studio</a>.</p></div>';
    });
})();
