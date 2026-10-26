/* Decision-led first-controller guide. Product names, current catalog estimates,
   and schematic paths come from the same local gear catalog as Rig Studio. */
(function () {
  "use strict";
  var mount = document.getElementById("beginner-controller-decision");
  if (!mount) return;

  var choices = [
    {
      id: "pioneer-ddj-flx2", fit: "The smallest-price entry", fitTag: "Spend less, stay portable",
      good: "Compact 2-channel practice; selected phone, tablet and computer app routes exist.",
      tradeoff: "Its 3.5 mm master output and compact controls call for more careful matching with speakers and future gig setups.",
      reasons: ["Lowest controller spend", "Compact", "Selected mobile routes"],
      profiles: ["budget", "portable"]
    },
    {
      id: "pioneer-ddj-flx4", fit: "The balanced first desk rig", fitTag: "A broad starting point",
      good: "A current 2-channel layout with RCA master output and several supported software paths; a sensible home-practice base.",
      tradeoff: "Costs more than the compact FLX2; check the exact software edition, operating system and mobile connection before choosing an app.",
      reasons: ["RCA speaker output", "Multiple software paths", "Room to grow"],
      profiles: ["balanced"]
    },
    {
      id: "hercules-inpulse-500", fit: "The hands-on learning path", fitTag: "Visual beatmatch guidance",
      good: "A more substantial two-channel deck with beatmatch guide lights, dual 1/4-inch outputs and RCA; useful if visible cues sound motivating.",
      tradeoff: "Its learning aids and layout are a different route from a Pioneer-style club workflow; compare the software you intend to learn.",
      reasons: ["Beatmatch guide lights", "RCA + dual 1/4-inch outputs", "More substantial controls"],
      profiles: ["guided"]
    }
  ];
  var profiles = [
    { id: "balanced", title: "A bit of everything", desc: "Room to learn without overspending." },
    { id: "budget", title: "Keep the first spend low", desc: "A compact entry for home practice." },
    { id: "guided", title: "Show me the beat", desc: "Visible cues while learning to match." },
    { id: "portable", title: "Practice on the go", desc: "Phone/tablet-friendly workflows matter." }
  ];
  var current = { profile: "balanced", item: "pioneer-ddj-flx4", controllerOwned: false, headphonesOwned: false, speakersOwned: false, cableOwned: false, catalog: null };

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }
  function money(value) { return "$" + Math.round(Number(value) || 0).toLocaleString("en-US"); }
  function find(id) { return current.catalog.items.find(function (item) { return item.id === id; }); }
  function activeChoice() { return choices.find(function (choice) { return choice.id === current.item; }) || choices[1]; }
  function recommend(profile) {
    var matching = choices.find(function (choice) { return choice.profiles.indexOf(profile) !== -1; });
    if (matching) current.item = matching.id;
    current.profile = profile;
    render();
  }
  function hrefForRig() {
    var choice = activeChoice();
    var controller = find(choice.id), headphones = find("ath-m20x"), speakers = find("pioneer-dm40d"), cable = find("cable-rca-rca");
    if (!controller || !headphones || !speakers) return "build-your-dj-setup.html";
    var cableId = controller.id === "pioneer-ddj-flx2" ? null : (cable && cable.id);
    var slots = [
      { slotId: "guide-controller", category: "controllers", itemId: controller.id, qty: 1, owned: current.controllerOwned },
      { slotId: "guide-headphones", category: "headphones", itemId: headphones.id, qty: 1, owned: current.headphonesOwned },
      { slotId: "guide-speakers", category: "speakers", itemId: speakers.id, qty: 1, owned: current.speakersOwned },
      { slotId: "guide-cable", category: "cables", itemId: cableId, qty: 1, owned: current.cableOwned }
    ];
    var payload = { n: "First setup · " + controller.model, i: slots };
    var encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    // Encode the complete UTF-8 JSON first, then make base64 URL-safe.
    encoded = encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return "build-your-dj-setup.html?rig=" + encodeURIComponent(encoded);
  }
  function costModel() {
    var choice = activeChoice(), controller = find(choice.id), headphones = find("ath-m20x"), speakers = find("pioneer-dm40d"), rca = find("cable-rca-rca");
    var cablePrice = choice.id === "pioneer-ddj-flx2" ? 15 : (rca ? Number(rca.price) : 12);
    var cableLabel = choice.id === "pioneer-ddj-flx2" ? "3.5 mm → RCA cable allowance" : "Dual RCA cable";
    var rows = [
      { label: (controller && controller.model) || "Controller", value: controller ? Number(controller.price) : 0, included: !current.controllerOwned },
      { label: "Closed-back headphones · ATH-M20x", value: headphones ? Number(headphones.price) : 49, included: !current.headphonesOwned },
      { label: "Powered desktop monitors · pair", value: speakers ? Number(speakers.price) : 149, included: !current.speakersOwned },
      { label: cableLabel, value: current.cableOwned ? 0 : cablePrice, included: !current.cableOwned }
    ];
    return { rows: rows, total: rows.reduce(function (sum, row) { return sum + (row.included ? row.value : 0); }, 0) };
  }
  function render() {
    if (!current.catalog) return;
    var choice = activeChoice(), item = find(choice.id);
    if (!item) return;
    var costs = costModel();
    var profilesHtml = profiles.map(function (profile) {
      return '<button type="button" class="beginner-lab-profile" data-bl-profile="' + esc(profile.id) + '" aria-pressed="' + (profile.id === current.profile ? "true" : "false") + '"><strong>' + esc(profile.title) + '</strong><span>' + esc(profile.desc) + "</span></button>";
    }).join("");
    var alternatives = choices.map(function (option) {
      var product = find(option.id);
      if (!product) return "";
      var selected = option.id === current.item;
      return '<article class="beginner-lab-option' + (selected ? " is-selected" : "") + '" data-bl-option="' + esc(option.id) + '">' +
        '<div class="beginner-lab-option-top"><h4>' + esc(product.brand + " " + product.model) + '</h4><span class="beginner-lab-option-price">' + money(product.price) + '</span></div>' +
        '<span class="beginner-lab-fit">' + esc(option.fitTag) + '</span>' +
        '<p>' + esc(option.good) + '</p><p class="beginner-lab-tradeoff"><b>Trade-off:</b> ' + esc(option.tradeoff) + '</p>' +
        '<button type="button" data-bl-choose="' + esc(option.id) + '" aria-pressed="' + (selected ? "true" : "false") + '">' + (selected ? "Selected for your setup" : "Compare this one →") + '</button></article>';
    }).join("");
    var rowHtml = costs.rows.map(function (row) {
      return '<div class="beginner-lab-line"><span>' + esc(row.label) + '</span><b>' + (row.included ? money(row.value) : "Already have it") + '</b></div>';
    }).join("");
    var productImage = item.image ? '<img src="' + esc(item.image) + '" alt="Illustrated equipment schematic for ' + esc(item.brand + " " + item.model) + '" loading="lazy" decoding="async">' : "";
    var profileCopy = {
      balanced: "A practical balance of price, familiar mixer layout and output flexibility for a first home setup.",
      budget: "A lower-cost way to find out whether regular mixing is for you. Its smaller output and control set are the compromise, not a hidden defect.",
      guided: "Pick this if visible beatmatch feedback will help you stay curious. It is a distinct learning style, not a claim that the lights replace practice.",
      portable: "Choose a compact controller if portability matters; confirm the specific app, device, OS and connection support before ordering."
    };
    mount.innerHTML = '<section class="beginner-lab" aria-labelledby="beginner-lab-title">' +
      '<div class="beginner-lab-head"><div><span class="beginner-lab-kicker">Choose by how you want to learn</span><h2 id="beginner-lab-title">Your first controller should fit your real first month.</h2><p>Pick the kind of start that sounds like you. We’ll surface the trade-off, then estimate the rest of a bedroom setup—not just the controller price.</p></div><span class="beginner-lab-edition">Catalog estimate · 25 Oct 2026</span></div>' +
      '<p class="beginner-lab-profile-label">What matters most right now?</p><div class="beginner-lab-profiles" role="group" aria-label="Choose your first-controller priority">' + profilesHtml + '</div>' +
      '<div class="beginner-lab-grid"><section class="beginner-lab-match" aria-live="polite"><figure class="beginner-lab-product-art">' + productImage + '<figcaption>Offbeat equipment schematic · not a product photo</figcaption></figure>' +
      '<div class="beginner-lab-match-copy"><span class="beginner-lab-badge">A sensible match</span><h3>' + esc(item.brand + " " + item.model) + '</h3><span class="beginner-lab-price">Controller estimate: ' + money(item.price) + '</span><p>' + esc(profileCopy[current.profile]) + '</p><ul class="beginner-lab-reasons">' + choice.reasons.map(function (reason) { return "<li>" + esc(reason) + "</li>"; }).join("") + '</ul><p class="beginner-lab-smallprint">' + esc(item.master_outputs ? "Master output: " + item.master_outputs.join(" / ") + ". " : "") + 'Software, device and OS support varies by route—check the official compatibility details before buying.</p><a class="beginner-lab-link" href="' + esc(item.slug || "build-your-dj-setup.html") + '">Read the product guide <span aria-hidden="true">↗</span></a></div></section>' +
      '<aside class="beginner-lab-cost" aria-label="Estimated first bedroom setup cost"><div class="beginner-lab-cost-head"><h3>What the first desk setup costs</h3><span>Example, not a quote</span></div><div class="beginner-lab-line-items">' + rowHtml + '</div>' +
      '<fieldset class="beginner-lab-owned"><legend>Already have any of this?</legend>' +
      '<label class="beginner-lab-check"><input type="checkbox" data-bl-owned="controller" ' + (current.controllerOwned ? "checked" : "") + '> This controller</label>' +
      '<label class="beginner-lab-check"><input type="checkbox" data-bl-owned="headphones" ' + (current.headphonesOwned ? "checked" : "") + '> Headphones</label>' +
      '<label class="beginner-lab-check"><input type="checkbox" data-bl-owned="speakers" ' + (current.speakersOwned ? "checked" : "") + '> Monitor pair</label>' +
      '<label class="beginner-lab-check"><input type="checkbox" data-bl-owned="cable" ' + (current.cableOwned ? "checked" : "") + '> A suitable speaker cable</label></fieldset>' +
      '<div class="beginner-lab-total"><span>Estimated new spend</span><strong data-bl-total aria-live="polite">' + money(costs.total) + '</strong></div><p class="beginner-lab-disclaimer">Includes controller, ATH-M20x headphones, DM-40D monitor pair and a speaker cable allowance. Assumes you have a compatible host device; excludes tax, software upgrades and a PA. The FLX2 uses a 3.5 mm cable allowance—confirm the exact cable and inputs. Catalog prices are estimates, not live retailer quotes.</p>' +
      '<a class="beginner-lab-build" data-bl-build href="' + esc(hrefForRig()) + '">Open this setup in Rig Studio →</a></aside></div>' +
      '<section class="beginner-lab-alternatives" aria-labelledby="beginner-lab-alt-title"><div class="beginner-lab-alternatives-head"><h3 id="beginner-lab-alt-title">Compare the other ways in</h3><p>Each one is a good fit for a different reason—and has a real trade-off.</p></div><div class="beginner-lab-cards">' + alternatives + '</div></section>' +
      '<div class="beginner-lab-note"><b>Before you buy</b><p>Confirm the exact software edition and device/OS pairing, speaker input, and cable ends. The controller’s headphone cue is separate from its speaker output. <a href="controller-software-compatibility-matrix.html">Check software support</a> or <a href="how-to-connect-dj-controller-to-speakers.html">follow the speaker connection guide</a>.</p></div>' +
      '</section>';
    bind();
  }
  function bind() {
    mount.querySelectorAll("[data-bl-profile]").forEach(function (button) {
      button.addEventListener("click", function () { recommend(button.getAttribute("data-bl-profile")); });
    });
    mount.querySelectorAll("[data-bl-choose]").forEach(function (button) {
      button.addEventListener("click", function () {
        current.item = button.getAttribute("data-bl-choose");
        var picked = choices.find(function (choice) { return choice.id === current.item; });
        if (picked && picked.profiles.length) current.profile = picked.profiles[0];
        render();
      });
    });
    mount.querySelectorAll("[data-bl-owned]").forEach(function (input) {
      input.addEventListener("change", function () {
        var key = input.getAttribute("data-bl-owned") + "Owned";
        current[key] = input.checked;
        render();
        var fresh = mount.querySelector('[data-bl-owned="' + input.getAttribute("data-bl-owned") + '"]');
        if (fresh) fresh.focus();
      });
    });
  }
  fetch("assets/dj-gear-catalog.json").then(function (response) {
    if (!response.ok) throw new Error("Catalog unavailable");
    return response.json();
  }).then(function (catalog) {
    if (!catalog || !Array.isArray(catalog.items)) throw new Error("Catalog shape is invalid");
    current.catalog = catalog;
    render();
  }).catch(function () {
    mount.innerHTML = '<section class="beginner-lab" aria-live="polite"><span class="beginner-lab-kicker">First-controller decision</span><h2>Compare the full setup—not just the deck price.</h2><p>The interactive catalog estimate could not load. The recommendations below still work; you can open <a href="build-your-dj-setup.html">Rig Studio</a> to price a complete setup.</p></section>';
  });
})();
