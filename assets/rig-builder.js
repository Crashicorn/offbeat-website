/* Offbeat — DJ rig planner.
 *
 * A small, dependency-free recommender for a first (or next) DJ setup.
 * It runs entirely in the browser, needs no network and stores nothing.
 *
 * The rules below are deliberately conservative: they recommend a shape for a
 * rig and the class of gear that fits it, with one or two named models where
 * the site already reviews them. Prices are shown as bands, not quotes, because
 * street prices move — every result links to the dated guide that carries the
 * researched figures.
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
    // key: software|budget tier
    rekordbox: {
      b1: { name: "Pioneer DDJ-FLX2", band: "$150–200", why: "The cheapest route into rekordbox that still has a usable layout. Two channels, small jogs, works with a laptop or a phone." },
      b2: { name: "Pioneer DDJ-FLX4", band: "$280–350", why: "The default answer for a reason: full-size jogs, rekordbox and Serato in one unit, and a layout that maps to club gear." },
      b3: { name: "Pioneer DDJ-FLX6-GT", band: "$550–650", why: "Four channels and bigger platters if you are already playing parties and want room to grow." },
      b4: { name: "Pioneer DDJ-FLX10", band: "$1,600–1,750", why: "Club-format layout with stem control. Worth it only when you are playing regularly and want the booth to feel familiar." }
    },
    serato: {
      b1: { name: "Numark Mixtrack Pro FX", band: "$190–250", why: "Two channels, Serato DJ Lite included, and the cheapest way to get a real pitch fader and jog wheels." },
      b2: { name: "Hercules DJControl Inpulse 500", band: "$280–350", why: "Serato-ready with a built-in audio interface, aux input and a solid feel for the money." },
      b3: { name: "Rane One", band: "$800–900", why: "Motorised platters and a battle layout. The pick if scratching is the point rather than a side skill." },
      b4: { name: "Pioneer DDJ-REV7 or Rane One", band: "$1,000–1,900", why: "Battle-style, motorised or full-size moving platters. Buy this when open-format scratching is the act." }
    },
    traktor: {
      b1: { name: "Second-hand Traktor Kontrol S2", band: "$120–220", why: "Native Instruments' own two-channel controller is the cleanest Traktor experience at entry money. Buy used from a shop with a warranty." },
      b2: { name: "Traktor Kontrol S3", band: "$400–550", why: "Four channels, Traktor Pro included, and the software-hardware integration that makes Traktor worth choosing." },
      b3: { name: "Traktor Kontrol S4 MK3", band: "$650–800", why: "Motorised jog wheels and haptic feedback — still the most tactile Traktor controller made." },
      b4: { name: "Traktor Kontrol S4 MK3 + X1", band: "$850–1,100", why: "Add a modular controller for effects and stems rather than buying a bigger deck you cannot use." }
    },
    djay: {
      b1: { name: "Pioneer DDJ-FLX2", band: "$150–200", why: "Small, phone-powered and happy with djay Pro on iOS or Android — the cheapest streaming-first setup." },
      b2: { name: "Pioneer DDJ-FLX4", band: "$280–350", why: "The best-value two-channel deck for djay Pro on a laptop, with room to move to rekordbox later." },
      b3: { name: "Reloop Buddy or DDJ-FLX6-GT", band: "$300–650", why: "Either a compact controller that matches iPad workflows, or four channels if you are moving to laptop-first sets." },
      b4: { name: "Pioneer DDJ-FLX10", band: "$1,600–1,750", why: "Only worth it if you are also using rekordbox; djay on a flagship deck is a lot of hardware for the software." }
    },
    none: {
      b1: { name: "Pioneer DDJ-FLX2 or Numark Mixtrack Pro FX", band: "$150–250", why: "Both come with a usable software licence and a layout you can learn on without relearning later." },
      b2: { name: "Pioneer DDJ-FLX4", band: "$280–350", why: "The safest first controller in 2026: two software ecosystems in one box, and the layout most guides assume." },
      b3: { name: "Hercules Inpulse 500 or DDJ-FLX6-GT", band: "$300–650", why: "Take the Inpulse if you want a built-in interface and aux input; take the FLX6 if you want four channels." },
      b4: { name: "Pioneer DDJ-FLX10 or Rane One", band: "$800–1,750", why: "At this budget the question is format, not quality: club layout or battle layout." }
    },
    standalone: {
      b1: { name: "Nothing new — keep saving", band: "—", why: "There is no standalone system worth buying under about $900. A controller and a laptop will serve you better until then." },
      b2: { name: "Nothing new — keep saving", band: "—", why: "Standalone gear starts around $900. At this budget, put the money into a controller and headphones you will keep." },
      b3: { name: "Denon DJ Prime Go", band: "$950–1,100", why: "Battery-powered, built-in screen, no laptop. The smallest genuinely standalone rig that still feels like DJ gear." },
      b4: { name: "AlphaTheta XDJ-AZ or Denon Prime 4+", band: "$2,500–3,300", why: "Four decks, no laptop, and a format close enough to a club booth that the transition is mostly muscle memory." }
    }
  };

  var HEADPHONES = {
    b1: { name: "Closed-back under $50–100", band: "$40–100", why: "Isolation matters more than frequency response at this stage. See our under-$100 shortlist." , link: "best-dj-headphones-under-100-2026.html", label: "Headphones under $100" },
    b2: { name: "Sony MDR-7506 or Sennheiser HD 25", band: "$90–180", why: "Both are industry fixtures: loud enough, replaceable parts, and comfortable for long cue sessions." , link: "best-dj-headphones-2026.html", label: "Best DJ headphones" },
    b3: { name: "Sennheiser HD 25 or Pioneer HDJ-X7", band: "$150–250", why: "At this level you are buying isolation and durability, not sound quality alone." , link: "best-dj-headphones-2026.html", label: "Best DJ headphones" },
    b4: { name: "Pioneer HDJ-X10 or HD 25 Plus", band: "$250–350", why: "Spare parts, swivelling cups and enough isolation for a loud booth." , link: "best-dj-headphones-2026.html", label: "Best DJ headphones" }
  };

  var PLACES = {
    bedroom: { label: "Bedroom / practice", note: "You can practise quietly and upgrade slowly. Prioritise a controller you will not outgrow in six months." },
    party: { label: "House parties and small events", note: "You need to be loud and reliable more than you need four decks. Speakers and cables matter as much as the controller." },
    club: { label: "Club prep", note: "Match the booth you want to play in. rekordbox plus a club-format layout saves you a difficult transition later." },
    mobile: { label: "Mobile and weddings", note: "Reliability, requests and backup matter more than tricks. Budget for a second pair of cables and a spare laptop." },
    stream: { label: "Streaming and content", note: "You need clean audio routing and a way to capture it. A controller with a built-in interface keeps the chain simple." }
  };

  var CABLES = {
    laptop: { name: "USB cable + adapter for your laptop", band: "$10–35", why: "USB-C to USB-B, or a hub if your laptop only has USB-C ports. Controllers ship with a cable, but it is rarely the one you need." },
    pa: { name: "Balanced cables to your speakers", band: "$25–60", why: "RCA to XLR or 1/4-inch TRS, depending on the speaker inputs. Two metres is usually enough at home." },
    booth: { name: "Ground-loop isolator", band: "$15–30", why: "Cheap insurance against the hum you get when a laptop and a PA share power from different circuits." },
    extras: { name: "Stand or riser", band: "$40–120", why: "A deck at desk height is a back injury waiting to happen. A simple folding stand fixes the worst ergonomics in DJing." }
  };

  function tierFor(budget) {
    return budget; // b1..b4
  }

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
    if (nextBtn) nextBtn.textContent = index === steps.length - 1 ? "Show my rig" : "Next";
    var legend = steps[index].querySelector("legend, .rig-q");
    if (legend) legend.setAttribute("tabindex", "-1");
  }

  function selected(step) {
    var checked = step.querySelectorAll("input:checked");
    return [].slice.call(checked).map(function (input) { return input.value; });
  }

  function answerFor(stepKey) {
    var step = form.querySelector('[data-rig-step="' + stepKey + '"]');
    return step ? selected(step) : [];
  }

  function buildResult() {
    var place = state.place || "bedroom";
    var budget = state.budget || "b2";
    var software = state.software || "none";
    var owns = state.owns;

    var deckSet = DECKS[software] || DECKS.none;
    var deck = deckSet[budget] || deckSet.b2;
    var phones = HEADPHONES[budget] || HEADPHONES.b2;

    if (software === "standalone" && (budget === "b1" || budget === "b2")) {
      deck = DECKS.standalone.b2;
    }

    var items = [];
    items.push({
      kind: "Deck",
      name: deck.name,
      band: deck.band,
      why: deck.why
    });

    if (owns.indexOf("headphones") === -1) {
      items.push({ kind: "Headphones", name: phones.name, band: phones.band, why: phones.why, link: phones.link, label: phones.label });
    }
    if (owns.indexOf("pa") === -1) {
      items.push({
        optional: true,
        kind: "Sound",
        name: place === "bedroom" ? "Desktop speakers or a small monitor" : "Powered PA speakers or a small amp",
        band: place === "bedroom" ? "$80–200" : "$250–600",
        why: place === "bedroom"
          ? "Practising on speakers is how you learn to hear a mix rather than just two tracks in headphones."
          : "Two powered speakers are more reliable than one big one, and give you a backup if a channel dies.",
        link: "best-dj-monitor-speakers.html",
        label: "Speaker guide"
      });
    }
    if (owns.indexOf("laptop") === -1 && software !== "standalone") {
      items.push({
        kind: "Computer",
        name: "A laptop that meets your software's minimum spec",
        band: "$400–900",
        why: "DJ software is not demanding by modern standards, but it is unforgiving of slow storage and too little RAM. Check the software's own spec page before buying.",
        link: "best-dj-laptop-2026.html",
        label: "Laptop guide"
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
    if (place === "party" || place === "mobile" || place === "club") {
      items.push({ optional: true, kind: "Extras", name: CABLES.extras.name, band: CABLES.extras.band, why: CABLES.extras.why });
    }
    items.push({ optional: true, kind: "Extras", name: CABLES.booth.name, band: CABLES.booth.band, why: CABLES.booth.why });

    /* Budget check: if the honest total overshoots, say so and show what to defer. */
    var budgetMax = { b1: 300, b2: 600, b3: 1200, b4: 9000 }[budget] || 600;
    var sum = function (list) {
      var lo = 0, hi = 0;
      list.forEach(function (item) {
        var numbers = (item.band.match(/[\d,]+/g) || []).map(function (n) { return parseInt(n.replace(/,/g, ""), 10); });
        if (numbers.length >= 2) { lo += numbers[0]; hi += numbers[1]; }
        else if (numbers.length === 1) { lo += numbers[0]; hi += numbers[0]; }
      });
      return { low: lo, high: hi };
    };
    var full = sum(items);
    var deferred = [];
    var trimmed = items.slice();
    if (full.low > budgetMax) {
      var deferOrder = ["Stand or riser", "Ground-loop isolator"].concat(
        items.filter(function (i) { return i.optional; }).map(function (i) { return i.name; })
      );
      deferOrder.forEach(function (name) {
        if (sum(trimmed).low <= budgetMax) return;
        var idx = trimmed.findIndex(function (i) { return i.name === name && i.optional; });
        if (idx > -1) { deferred.push(trimmed[idx]); trimmed.splice(idx, 1); }
      });
    }
    var finalSum = sum(trimmed);

    /* Honest arithmetic: sum the low and high ends of the bands where we can. */
    var low = 0;
    var high = 0;
    items.forEach(function (item) {
      var numbers = (item.band.match(/[\d,]+/g) || []).map(function (n) { return parseInt(n.replace(/,/g, ""), 10); });
      if (numbers.length >= 2) { low += numbers[0]; high += numbers[1]; }
      else if (numbers.length === 1) { low += numbers[0]; high += numbers[0]; }
    });

    var skip = [];
    if (place === "bedroom") skip.push("Stands, flight cases and PA speakers until you actually play out.");
    if (software !== "standalone") skip.push("A standalone system — a laptop and a controller covers the same ground for a third of the money.");
    if (owns.indexOf("headphones") !== -1) skip.push("New headphones — replace the pads before you replace the headphones.");
    skip.push("Effects units and add-on controllers. Learn the one you have first.");
    skip.push("Subscription software at the start. Every controller here includes a usable licence.");

    var upgrade = owns.indexOf("headphones") === -1
      ? "Headphones first. They are the cheapest part of the rig and the one you will notice every session. Then the controller, then speakers."
      : place === "party" || place === "mobile"
        ? "Speakers and a backup cable set. Nothing ends a party faster than a rig that cannot be made loud or that loses a channel to a bad lead."
        : "Controller, then software, then headphones. The deck determines which software you can run, and that decision is the hardest to reverse.";

    return {
      place: place,
      budget: budget,
      software: software,
      owns: owns,
      items: trimmed,
      deferred: deferred,
      fits: finalSum.low <= budgetMax,
      headroom: budgetMax - finalSum.high,
      overBy: Math.max(0, finalSum.low - budgetMax),
      budgetMax: budgetMax,
      low: finalSum.low,
      high: finalSum.high,
      skip: skip,
      upgrade: upgrade,
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
    return String(value).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function renderResult(data) {
    var money = function (n) { return "$" + n.toLocaleString("en-US"); };
    var html = "";
    html += '<div class="rig-result-head">';
    html += "<p class=\"kicker\">Your rig</p>";
    html += "<h2>" + esc(PLACES[data.place].label) + " · " + esc(document.querySelector('input[name="rig-budget"][value="' + data.budget + '"]').closest("label").querySelector(".rig-opt-title").textContent) + "</h2>";
    html += "<p class=\"rig-note\">" + esc(PLACES[data.place].note) + "</p>";
    html += "</div>";

    html += '<ol class="rig-items">';
    data.items.forEach(function (item) {
      html += '<li class="rig-item">';
      html += '<span class="rig-item-kind">' + esc(item.kind) + "</span>";
      html += '<div class="rig-item-body"><strong>' + esc(item.name) + '</strong><span class="rig-item-price">' + esc(item.band) + "</span>";
      html += "<p>" + esc(item.why) + "</p>";
      if (item.link) html += '<a class="rig-item-link" href="' + esc(item.link) + '">' + esc(item.label) + " →</a>";
      html += "</div></li>";
    });
    html += "</ol>";

    html += '<div class="rig-total"><span>Estimated total</span><b>' + money(data.low) + " – " + money(data.high) + "</b>";
    html += '<em>Bands, not quotes. Every figure is a date-stamped research range — check the retailer before you buy.</em></div>';

    if (!data.fits) {
      html += '<div class="rig-fit rig-fit--over"><strong>That is still over your ' + money(data.budgetMax) + ' budget.</strong>';
      html += "<p>The honest answer is that this rig costs more than the budget allows, even after deferring everything optional. Either raise the budget, buy the deck second-hand, or start with the essentials and add the rest next season.</p></div>";
    } else if (data.deferred.length) {
      html += '<div class="rig-fit rig-fit--trimmed"><strong>Adjusted to fit your ' + money(data.budgetMax) + ' budget.</strong>';
      html += "<p>Deferred for now: " + data.deferred.map(function (d) { return "<em>" + esc(d.name) + "</em>"; }).join(", ") + ". Add them back when the budget allows — they are wants, not the foundation.</p></div>";
    } else if (data.high > data.budgetMax) {
      html += '<div class="rig-fit rig-fit--trimmed"><strong>Fits your ' + money(data.budgetMax) + ' budget at the lower end.</strong>';
      html += "<p>The top of the range runs about " + money(data.high - data.budgetMax) + " over. Buy at the cheaper end of each line, or wait for a seasonal sale rather than dropping the headphones.</p></div>";
    } else {
      html += '<div class="rig-fit"><strong>This fits inside your ' + money(data.budgetMax) + ' budget.</strong>';
      html += "<p>With roughly " + money(Math.max(0, data.headroom)) + " of headroom at the top end. Put it towards music, not more hardware.</p></div>";
    }

    html += '<div class="rig-cols">';
    html += '<div class="rig-col"><h3>Skip for now</h3><ul>' + data.skip.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ul></div>";
    html += '<div class="rig-col"><h3>Upgrade in this order</h3><p>' + esc(data.upgrade) + "</p></div>";
    html += "</div>";

    html += '<div class="rig-next"><h3>Read next</h3><ul class="rig-links">';
    html += '<li><a href="' + data.deckLink.href + '">' + data.deckLink.label + "</a></li>";
    html += '<li><a href="' + (data.software === "standalone" ? "best-standalone-dj-systems.html" : "controller-software-compatibility-matrix.html") + '">' + (data.software === "standalone" ? "Standalone systems compared" : "Controller and software compatibility") + "</a></li>";
    html += '<li><a href="dj-equipment-checklist.html">The full equipment checklist</a></li>';
    html += '<li><a href="beginner-dj-setup-guide-2026.html">Build the setup step by step</a></li>';
    html += "</ul></div>";

    html += '<div class="rig-actions"><button type="button" class="btn btn-secondary" data-rig-restart>Change my answers</button>';
    html += '<button type="button" class="btn btn-secondary" data-rig-print>Print this</button></div>';

    result.innerHTML = html;
    result.hidden = false;
    placeholder.hidden = true;
    form.hidden = true;

    result.querySelector("[data-rig-restart]").addEventListener("click", function () {
      result.hidden = true;
      placeholder.hidden = false;
      form.hidden = false;
      showStep(0);
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    result.querySelector("[data-rig-print]").addEventListener("click", function () { window.print(); });

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
    /* Single-choice questions advance on their own. */
    var key = step && step.getAttribute("data-rig-step");
    if (key && key !== "owns") {
      window.setTimeout(function () {
        if (current < steps.length - 1) {
          if (collectStep(current)) showStep(current + 1);
        }
      }, 140);
    }
  });

  /* Deep link: /build-your-dj-setup.html?place=party&budget=b2&software=serato&owns=laptop */
  // (filled in below once the form exists)

  showStep(0);

  /* Return the deep-linked result without the questions. */
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
})();
