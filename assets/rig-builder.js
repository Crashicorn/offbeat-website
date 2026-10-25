/* =============================================================================
   Offbeat Inc. — My DJ Rig Architect & Gear Planner
   "The PCPartPicker of DJ Equipment" (2026 Relaunch Edition)
   ========================================================================== */

(function () {
  "use strict";

  var CATALOG = null;

  // Active Rig State (Supports modular items, quantities, and owned gear)
  var currentRig = {
    name: "My Custom DJ Rig",
    items: [
      { slotId: "core-ctrl", category: "controllers", itemId: "pioneer-ddj-flx4", qty: 1, owned: false },
      { slotId: "core-hp", category: "headphones", itemId: "sennheiser-hd25", qty: 1, owned: false },
      { slotId: "core-spk", category: "speakers", itemId: "pioneer-dm40d", qty: 1, owned: false },
      { slotId: "core-host", category: "laptops", itemId: "macbook-air-m2", qty: 1, owned: true },
      { slotId: "core-cable", category: "cables", itemId: "cable-rca-rca", qty: 1, owned: false },
      { slotId: "core-acc", category: "accessories", itemId: "laptop-stand-pyle", qty: 1, owned: false }
    ]
  };

  // Active slot being edited in modal
  var activeModalSlotId = null;
  var activeModalCategory = null;

  // DOM Mount Root
  var builderRoot = document.getElementById("rig-app-root");
  if (!builderRoot) return;

  /* ----------------------------------------------------------------- Init */
  function init() {
    loadCatalogAndState().then(function () {
      renderApp();
      setupGlobalListeners();
    }).catch(function (err) {
      console.error("Failed to load catalog:", err);
      builderRoot.innerHTML = '<div class="highlight-box"><p>Unable to load gear catalog. Please refresh the page.</p></div>';
    });
  }

  function loadCatalogAndState() {
    return fetch("assets/dj-gear-catalog.json")
      .then(function (res) { return res.json(); })
      .then(function (data) {
        CATALOG = data;
        parseUrlOrLocalState();
      });
  }

  function parseUrlOrLocalState() {
    var params = new URLSearchParams(window.location.search);

    // 1. Deep link to add a specific gear item (e.g. ?add=pioneer-ddj-flx4)
    var addParam = params.get("add");
    if (addParam) {
      var targetItem = getItem(addParam);
      if (targetItem) {
        var existingSlot = currentRig.items.find(function (s) { return s.category === targetItem.category; });
        if (existingSlot) {
          existingSlot.itemId = targetItem.id;
          existingSlot.owned = false;
        } else {
          currentRig.items.push({
            slotId: "extra-" + Date.now(),
            category: targetItem.category,
            itemId: targetItem.id,
            qty: 1,
            owned: false
          });
        }
        currentRig.name = "Custom Setup with " + targetItem.brand + " " + targetItem.model;
        saveActiveState();
        return;
      }
    }

    // 2. Preset query param (e.g. ?preset=club-ready)
    var presetParam = params.get("preset");
    if (presetParam && CATALOG.presets) {
      var pMatch = CATALOG.presets.find(function (p) { return p.id === presetParam; });
      if (pMatch) {
        loadPresetData(pMatch);
        return;
      }
    }

    // 3. Base64 encoded rig state param (e.g. ?rig=...)
    var rigParam = params.get("rig");
    if (rigParam) {
      try {
        var parsed = JSON.parse(decodeURIComponent(atob(rigParam)));
        if (parsed && (parsed.items || parsed.slots)) {
          normalizeRigState(parsed);
          return;
        }
      } catch (e) {
        console.warn("Invalid rig URL param:", e);
      }
    }

    // 4. LocalStorage active state
    var local = localStorage.getItem("offbeat.rig.active");
    if (local) {
      try {
        var saved = JSON.parse(local);
        if (saved && (saved.items || saved.slots)) {
          normalizeRigState(saved);
        }
      } catch (e) {
        console.warn("Invalid local rig state:", e);
      }
    }
  }

  function normalizeRigState(data) {
    if (data.items && Array.isArray(data.items)) {
      currentRig = data;
    } else if (data.slots) {
      // Migrate legacy 6-slot object into modular items array
      currentRig.name = data.name || "My Custom DJ Rig";
      currentRig.items = [];
      var cats = ["controllers", "headphones", "speakers", "laptops", "cables", "accessories"];
      cats.forEach(function (cat) {
        var id = data.slots[cat];
        if (id) {
          currentRig.items.push({
            slotId: "core-" + cat,
            category: cat,
            itemId: id,
            qty: 1,
            owned: Boolean(data.owned && data.owned[cat])
          });
        }
      });
    }
  }

  function saveActiveState() {
    try {
      localStorage.setItem("offbeat.rig.active", JSON.stringify(currentRig));
      var encoded = btoa(encodeURIComponent(JSON.stringify(currentRig)));
      var newUrl = window.location.pathname + "?rig=" + encoded;
      window.history.replaceState({ rig: currentRig }, "", newUrl);
    } catch (e) {
      console.warn("Could not save rig state:", e);
    }
  }

  function getItem(id) {
    if (!CATALOG || !id) return null;
    return CATALOG.items.find(function (item) { return item.id === id; }) || null;
  }

  function getSlotItem(slot) {
    return getItem(slot.itemId);
  }

  /* ----------------------------------------------------------- Calculations */
  function calculateRigStats() {
    var totalValue = 0;
    var ownedValue = 0;
    var purchaseCost = 0;
    var itemCount = 0;
    var ownedCount = 0;

    currentRig.items.forEach(function (slot) {
      var item = getSlotItem(slot);
      if (item) {
        var qty = slot.qty || 1;
        var lineTotal = item.price * qty;
        totalValue += lineTotal;
        itemCount += qty;
        if (slot.owned) {
          ownedValue += lineTotal;
          ownedCount += qty;
        } else {
          purchaseCost += lineTotal;
        }
      }
    });

    var compatibility = runDeepCompatibilityChecks();

    return {
      totalValue: totalValue,
      ownedValue: ownedValue,
      purchaseCost: purchaseCost,
      itemCount: itemCount,
      ownedCount: ownedCount,
      compatibility: compatibility
    };
  }

  /* ------------------------------------------- Real DJ Compatibility Engine */
  function runDeepCompatibilityChecks() {
    var controllerSlot = currentRig.items.find(function (s) { return s.category === "controllers"; });
    var headphonesSlot = currentRig.items.find(function (s) { return s.category === "headphones"; });
    var speakersSlot = currentRig.items.find(function (s) { return s.category === "speakers"; });
    var laptopSlot = currentRig.items.find(function (s) { return s.category === "laptops"; });
    var cableSlots = currentRig.items.filter(function (s) { return s.category === "cables"; });

    var controller = controllerSlot ? getSlotItem(controllerSlot) : null;
    var headphones = headphonesSlot ? getSlotItem(headphonesSlot) : null;
    var speakers = speakersSlot ? getSlotItem(speakersSlot) : null;
    var laptop = laptopSlot ? getSlotItem(laptopSlot) : null;

    var checks = [];
    var fatalErrors = 0;
    var warnings = 0;

    // 1. Audio Signal Cable Matching (3-Way Verification: Controller Out <-> Selected Cable <-> Speaker In)
    if (controller && speakers) {
      var ctrlOutputs = controller.master_outputs || [];
      var spkInputs = speakers.inputs || [];

      var hasRCAOut = ctrlOutputs.some(function (o) { return o.indexOf("RCA") !== -1; });
      var hasXLROut = ctrlOutputs.some(function (o) { return o.indexOf("XLR") !== -1; });
      var hasTRSOut = ctrlOutputs.some(function (o) { return o.indexOf("TRS") !== -1 || o.indexOf("1/4\"") !== -1; });

      var hasRCAIn = spkInputs.some(function (i) { return i.indexOf("RCA") !== -1; });
      var hasXLRIn = spkInputs.some(function (i) { return i.indexOf("XLR") !== -1; });
      var hasTRSIn = spkInputs.some(function (i) { return i.indexOf("TRS") !== -1 || i.indexOf("1/4\"") !== -1; });

      // Determine the ideal audio interconnect
      var idealCableId = "cable-rca-rca";
      var idealCableName = "Dual RCA to Dual RCA Cable";
      if (hasXLROut && hasXLRIn) {
        idealCableId = "cable-xlr-xlr";
        idealCableName = "Balanced XLR Cable Pair";
      } else if (hasRCAOut && !hasRCAIn && (hasTRSIn || hasXLRIn)) {
        idealCableId = "cable-rca-trs";
        idealCableName = "Dual RCA to Dual 1/4\" TS Cable";
      }

      // Check if user actually has the right cable in their rig
      var hasSelectedMatchingCable = cableSlots.some(function (cs) {
        return cs.itemId === idealCableId;
      });

      if (hasSelectedMatchingCable) {
        checks.push({
          type: "success",
          title: "Audio Signal Chain Fully Verified",
          desc: "Your selected " + idealCableName + " directly links " + controller.model + " outputs to " + speakers.model + " inputs with zero mismatch.",
          fixCableId: null
        });
      } else {
        checks.push({
          type: "warning",
          title: "Audio Cable Optimization Alert",
          desc: controller.model + " outputs and " + speakers.model + " inputs perform best with a " + idealCableName + ". Your setup currently has another cable selected.",
          fixCableId: idealCableId,
          fixActionText: "Auto-select " + idealCableName
        });
        warnings++;
      }
    } else if (controller && !speakers) {
      checks.push({
        type: "info",
        title: "No Monitor Speakers Selected",
        desc: "You can DJ with headphones only, but adding studio monitors (like Pioneer DM-40D) allows you to practice hearing room acoustics and beat transitions.",
        fixCableId: null
      });
    }

    // 2. Standalone vs Laptop Host Check
    if (controller && laptop) {
      if (laptop.id === "standalone-usb-only" && !controller.standalone) {
        checks.push({
          type: "error",
          title: "Host Computer Required for DJing",
          desc: controller.brand + " " + controller.model + " is a MIDI controller without an internal computer. It cannot play music from USB sticks without a laptop running DJ software.",
          fixActionText: "Switch to MacBook Air Laptop",
          fixSlotId: laptopSlot ? laptopSlot.slotId : null,
          fixItemId: "macbook-air-m2"
        });
        fatalErrors++;
      } else if (controller.standalone) {
        checks.push({
          type: "success",
          title: "Standalone USB Performance Ready",
          desc: controller.brand + " " + controller.model + " has internal processing and Wi-Fi streaming. You can perform laptop-free directly from USB drives.",
          fixCableId: null
        });
      } else {
        checks.push({
          type: "success",
          title: "Hardware Unlock & Driver Compatibility",
          desc: controller.model + " connects via USB to " + laptop.model + " with plug-and-play CoreAudio/ASIO driver support.",
          fixCableId: null
        });
      }
    }

    // 3. Headphone Cue Jack Check
    if (controller && headphones) {
      var ctrlJack = controller.headphone_jack || "";
      var hpJack = headphones.jack_type || "";
      var hasAdapter = cableSlots.some(function (cs) { return cs.itemId === "adapter-headphone-jack"; });

      if (ctrlJack.indexOf("3.5mm") !== -1 && hpJack.indexOf("1/4\"") !== -1 && !hasAdapter) {
        checks.push({
          type: "info",
          title: "Headphone Jack Adapter Advisory",
          desc: "Your controller uses a 3.5mm mini-jack. Make sure your headphones include a 3.5mm plug or add a gold 3.5mm-to-1/4\" adapter to your checklist.",
          fixCableId: "adapter-headphone-jack",
          fixActionText: "Add 1/4\" to 3.5mm Adapter ($8)"
        });
      }
    }

    // Calculate Dynamic Readiness Score
    var readiness = 100;
    if (!controller) readiness -= 35;
    if (!headphones) readiness -= 25;
    if (!speakers) readiness -= 15;
    if (!laptop && (!controller || !controller.standalone)) readiness -= 15;
    if (fatalErrors > 0) readiness = Math.min(readiness, 40);
    else if (warnings > 0) readiness = Math.max(readiness - warnings * 10, 60);

    return {
      readiness: Math.max(readiness, 10),
      checks: checks,
      fatalErrors: fatalErrors,
      warnings: warnings
    };
  }

  /* ---------------------------------------------------------------- Render */
  function renderApp() {
    var stats = calculateRigStats();

    var html = `
      <!-- Builder Top Dashboard -->
      <section class="rig-dashboard-shell">
        <div class="rig-dash-header">
          <div class="rig-title-block">
            <span class="hero-eyebrow">Interactive DJ Rig Architect</span>
            <h2 class="rig-main-title" contenteditable="true" data-rig-name title="Click to rename your setup">${escapeHtml(currentRig.name)}</h2>
            <p class="rig-subtitle">Assemble modular equipment, toggle gear you already own, verify audio signal connections, and generate an itemized shopping list.</p>
          </div>
          <div class="rig-dash-actions">
            <button type="button" class="btn btn-secondary btn-sm" data-action="copy-checklist">📋 Copy Checklist</button>
            <button type="button" class="btn btn-secondary btn-sm" data-action="share-rig">🔗 Share Build</button>
            <button type="button" class="btn btn-secondary btn-sm" data-action="save-rig">💾 Save Rig</button>
            <button type="button" class="btn btn-secondary btn-sm" data-action="open-compare">⚖️ Compare Builds</button>
            <button type="button" class="btn btn-sm" data-action="random-rig">🎲 Quick Preset</button>
          </div>
        </div>

        <!-- Presets Bar -->
        <div class="rig-preset-strip" role="group" aria-label="Preset starting points">
          <span class="preset-label">Quick Start Rigs:</span>
          ${CATALOG.presets.map(function (p) {
            return `<button type="button" class="rig-preset-pill" data-preset-id="${p.id}">
              <strong>${escapeHtml(p.name)}</strong> <span class="preset-badge">${escapeHtml(p.badge)}</span>
            </button>`;
          }).join("")}
        </div>

        <!-- Metric Cards -->
        <div class="rig-metrics-grid">
          <div class="rig-metric-card">
            <span class="metric-label">Total Rig Valuation</span>
            <strong class="metric-val">$${stats.totalValue.toLocaleString()}</strong>
            <span class="metric-sub">${stats.itemCount} items in setup</span>
          </div>
          <div class="rig-metric-card metric-card--owned">
            <span class="metric-label">Gear You Own (Saved)</span>
            <strong class="metric-val metric-val--owned">-$${stats.ownedValue.toLocaleString()}</strong>
            <span class="metric-sub">${stats.ownedCount} owned items deducted</span>
          </div>
          <div class="rig-metric-card metric-card--spend">
            <span class="metric-label">Actual Spend Needed</span>
            <strong class="metric-val metric-val--spend">$${stats.purchaseCost.toLocaleString()}</strong>
            <span class="metric-sub">${stats.itemCount - stats.ownedCount} items to purchase</span>
          </div>
          <div class="rig-metric-card metric-card--readiness">
            <span class="metric-label">Setup Readiness</span>
            <div class="readiness-gauge-wrap">
              <div class="readiness-bar"><div class="readiness-fill" style="width: ${stats.compatibility.readiness}%"></div></div>
              <strong class="readiness-num">${stats.compatibility.readiness}%</strong>
            </div>
            <span class="metric-sub">${stats.compatibility.fatalErrors === 0 && stats.compatibility.warnings === 0 ? "✓ 100% Fully Verified" : stats.compatibility.fatalErrors > 0 ? "❌ Incompatibility detected" : "⚠️ " + stats.compatibility.warnings + " cable optimization"}</span>
          </div>
        </div>
      </section>

      <!-- Visual DJ Booth Studio Layout -->
      <section class="rig-booth-section">
        <div class="section-head">
          <h3>DJ Studio Booth &amp; Signal Routing</h3>
          <p>Interactive 2D booth layout. Click any piece of gear to swap components, change quantities, or toggle ownership.</p>
        </div>
        <div class="rig-booth-stage">
          <!-- Top Row: Monitors, Host Platform, Extra Gear -->
          <div class="booth-top-row">
            ${renderBoothSlot(findSlot("speakers") || { slotId: "core-spk", category: "speakers", itemId: null }, "Monitors / Speakers", "🔊")}
            ${renderBoothSlot(findSlot("laptops") || { slotId: "core-host", category: "laptops", itemId: null }, "Host Platform / OS", "💻")}
            ${renderBoothSlot(findSlot("accessories") || { slotId: "core-acc", category: "accessories", itemId: null }, "Stands & Accessories", "📦")}
          </div>

          <!-- Signal Cables Hub Indicator -->
          <div class="booth-cables-row">
            <div class="cable-pulse-line cable-pulse--left"></div>
            <div class="cable-node-hub" data-action="pick" data-slot-id="${(findSlot('cables') || {}).slotId || 'core-cable'}" data-category="cables">
              <span class="cable-icon">🔌</span>
              <span class="cable-title">${getCableSummaryText()}</span>
              <span class="cable-change">Change Cables →</span>
            </div>
            <div class="cable-pulse-line cable-pulse--right"></div>
          </div>

          <!-- Bottom Row: Controller & Headphones -->
          <div class="booth-bottom-row">
            ${renderBoothSlot(findSlot("controllers") || { slotId: "core-ctrl", category: "controllers", itemId: null }, "DJ Controller / Decks & Mixer", "🎛️", true)}
            ${renderBoothSlot(findSlot("headphones") || { slotId: "core-hp", category: "headphones", itemId: null }, "DJ Headphones", "🎧")}
          </div>
        </div>
      </section>

      <!-- Compatibility Engine Alerts -->
      <section class="rig-compat-section">
        <div class="compat-box">
          <div class="compat-header">
            <h4>⚡ Hardware &amp; Signal Compatibility Assistant</h4>
            <span class="compat-status-tag ${stats.compatibility.fatalErrors === 0 && stats.compatibility.warnings === 0 ? 'tag--ok' : stats.compatibility.fatalErrors > 0 ? 'tag--err' : 'tag--warn'}">
              ${stats.compatibility.fatalErrors === 0 && stats.compatibility.warnings === 0 ? '✓ All Connections Verified' : stats.compatibility.fatalErrors > 0 ? '❌ Incompatible Configuration' : '⚠️ Cable Optimization Needed'}
            </span>
          </div>
          <div class="compat-items-grid">
            ${stats.compatibility.checks.map(function (c) {
              return `<div class="compat-item compat-item--${c.type}">
                <div class="compat-icon">${c.type === 'success' ? '✓' : c.type === 'error' ? '❌' : c.type === 'warning' ? '⚠️' : 'ℹ️'}</div>
                <div class="compat-body">
                  <strong>${escapeHtml(c.title)}</strong>
                  <p>${escapeHtml(c.desc)}</p>
                  ${c.fixCableId ? `<button type="button" class="btn-text-action" data-action="auto-fix-cable" data-cable-id="${c.fixCableId}">${escapeHtml(c.fixActionText || 'Auto-select recommended cable →')}</button>` : ''}
                  ${c.fixSlotId && c.fixItemId ? `<button type="button" class="btn-text-action" data-action="auto-fix-slot" data-slot-id="${c.fixSlotId}" data-item-id="${c.fixItemId}">${escapeHtml(c.fixActionText)}</button>` : ''}
                </div>
              </div>`;
            }).join("")}
          </div>
        </div>
      </section>

      <!-- Itemized PCPartPicker Table -->
      <section class="rig-table-section">
        <div class="section-head-split">
          <div>
            <h3>Component Breakdown &amp; Shopping List</h3>
            <p>Every piece in your setup with dated 2026 price estimates, quantities, and direct retailer links.</p>
          </div>
          <div class="add-slot-dropdown-wrap">
            <button type="button" class="btn btn-secondary btn-sm" data-action="open-add-slot">+ Add Component Slot ▾</button>
            <div class="add-slot-menu" id="add-slot-menu" hidden>
              <button type="button" data-action="add-new-slot" data-category="speakers">🔊 Add Extra Monitor / PA Speaker</button>
              <button type="button" data-action="add-new-slot" data-category="cables">🔌 Add Audio Cable / Adapter</button>
              <button type="button" data-action="add-new-slot" data-category="accessories">📦 Add Stand, Case or Microphone</button>
              <button type="button" data-action="add-new-slot" data-category="controllers">🎛️ Add Second Deck / Turntable</button>
            </div>
          </div>
        </div>

        <div class="table-wrap">
          <table class="drill-table rig-spec-table">
            <thead>
              <tr>
                <th scope="col">Slot &amp; Role</th>
                <th scope="col">Selected Equipment</th>
                <th scope="col">Qty</th>
                <th scope="col">Ownership</th>
                <th scope="col">Price Est.</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${currentRig.items.map(function (slot) {
                return renderModularTableRow(slot);
              }).join("")}
            </tbody>
            <tfoot>
              <tr class="rig-total-row">
                <td colspan="4"><strong>Total Out-of-Pocket Purchase Spend:</strong></td>
                <td colspan="2"><strong class="spend-total-num">$${stats.purchaseCost.toLocaleString()}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- Commercial Disclosure Notice -->
        <p class="table-note">
          ${CATALOG.meta.disclosure} <a href="disclosure.html">Read our full affiliate disclosure</a>.
        </p>
      </section>

      <!-- Saved Rigs & Comparison Section -->
      <section class="rig-saved-section" id="saved-rigs-drawer">
        ${renderSavedRigsList()}
      </section>

      <!-- Modal Container (Dynamically populated) -->
      <div id="rig-modal-container" hidden></div>
    `;

    builderRoot.innerHTML = html;
  }

  function findSlot(category) {
    return currentRig.items.find(function (s) { return s.category === category; }) || null;
  }

  function renderBoothSlot(slot, label, icon, isMain) {
    var item = getSlotItem(slot);
    var isOwned = Boolean(slot.owned);

    if (!item) {
      return `
        <div class="booth-card booth-card--empty ${isMain ? 'booth-card--main' : ''}" data-action="pick" data-slot-id="${slot.slotId}" data-category="${slot.category}">
          <span class="booth-card-role">${icon} ${escapeHtml(label)}</span>
          <div class="booth-empty-content">
            <span class="booth-plus">+</span>
            <strong>Select ${escapeHtml(label)}</strong>
          </div>
        </div>
      `;
    }

    var qtyStr = slot.qty > 1 ? ` <span class="booth-qty-badge">x${slot.qty}</span>` : '';

    return `
      <div class="booth-card ${isMain ? 'booth-card--main' : ''} ${isOwned ? 'booth-card--owned' : ''}">
        <div class="booth-card-top">
          <span class="booth-card-role">${icon} ${escapeHtml(label)}${qtyStr}</span>
          <button type="button" class="booth-owned-toggle ${isOwned ? 'is-active' : ''}" data-action="toggle-slot-owned" data-slot-id="${slot.slotId}" title="Toggle already owned">
            ${isOwned ? '✓ Owned' : '🛒 Need'}
          </button>
        </div>
        <div class="booth-card-body" data-action="pick" data-slot-id="${slot.slotId}" data-category="${slot.category}">
          <div class="booth-thumb-wrap">
            <img src="${item.image}" alt="${escapeHtml(item.brand + ' ' + item.model)}" loading="lazy" class="booth-thumb">
          </div>
          <div class="booth-info">
            <span class="booth-brand">${escapeHtml(item.brand)}</span>
            <strong class="booth-model">${escapeHtml(item.model)}</strong>
            <span class="booth-price ${isOwned ? 'price--owned' : ''}">
              ${isOwned ? '<s>$' + (item.price * (slot.qty || 1)) + '</s> (Owned)' : '$' + (item.price * (slot.qty || 1))}
            </span>
          </div>
        </div>
        <button type="button" class="booth-swap-btn" data-action="pick" data-slot-id="${slot.slotId}" data-category="${slot.category}">
          Swap / Customize →
        </button>
      </div>
    `;
  }

  function renderModularTableRow(slot) {
    var item = getSlotItem(slot);
    var isOwned = Boolean(slot.owned);
    var catMeta = CATALOG.categories.find(function (c) { return c.id === slot.category; });
    var qty = slot.qty || 1;

    if (!item) {
      return `
        <tr class="rig-row rig-row--empty">
          <td><span class="cat-pill">${catMeta ? catMeta.icon : ''} ${catMeta ? catMeta.name : slot.category}</span></td>
          <td colspan="4"><span class="empty-slot-msg">No item selected</span></td>
          <td><button type="button" class="btn btn-sm" data-action="pick" data-slot-id="${slot.slotId}" data-category="${slot.category}">Select Component</button></td>
        </tr>
      `;
    }

    var linePrice = item.price * qty;
    var amazonUrl = "https://www.amazon.com/s?k=" + encodeURIComponent(item.amazon_search || (item.brand + " " + item.model)) + "&tag=offbeatdj-20";
    var sweetwaterUrl = "https://www.sweetwater.com/store/search?s=" + encodeURIComponent(item.brand + " " + item.model);
    var reverbUrl = "https://reverb.com/marketplace?query=" + encodeURIComponent(item.brand + " " + item.model);

    return `
      <tr class="rig-row ${isOwned ? 'rig-row--owned' : ''}">
        <td class="cell-cat">
          <span class="cat-pill">${catMeta ? catMeta.icon : ''} ${catMeta ? catMeta.name : slot.category}</span>
        </td>
        <td class="cell-item">
          <div class="item-summary-box">
            <img src="${item.image}" alt="${escapeHtml(item.model)}" class="table-thumb" loading="lazy">
            <div class="item-summary-copy">
              <strong class="item-full-name">${escapeHtml(item.brand)} ${escapeHtml(item.model)}</strong>
              <p class="item-tagline">${escapeHtml(item.tagline || item.ideal_for || '')}</p>
              ${item.slug ? `<a href="${item.slug}" class="item-guide-link">Read Offbeat Guide →</a>` : ''}
            </div>
          </div>
        </td>
        <td class="cell-qty">
          <select class="qty-select" data-action="change-qty" data-slot-id="${slot.slotId}" aria-label="Quantity for ${escapeHtml(item.model)}">
            <option value="1" ${qty === 1 ? 'selected' : ''}>1</option>
            <option value="2" ${qty === 2 ? 'selected' : ''}>2</option>
            <option value="3" ${qty === 3 ? 'selected' : ''}>3</option>
            <option value="4" ${qty === 4 ? 'selected' : ''}>4</option>
          </select>
        </td>
        <td class="cell-status">
          <button type="button" class="status-btn ${isOwned ? 'status-btn--owned' : 'status-btn--needed'}" data-action="toggle-slot-owned" data-slot-id="${slot.slotId}">
            ${isOwned ? '🟢 I Own This' : '🔵 Need to Buy'}
          </button>
        </td>
        <td class="cell-price">
          <span class="price-figure ${isOwned ? 'price--owned' : ''}">
            ${isOwned ? '<s>$' + linePrice + '</s>' : '$' + linePrice}
          </span>
          ${isOwned ? '<span class="owned-sub">($0 out of pocket)</span>' : (qty > 1 ? '<span class="unit-sub">($' + item.price + ' ea)</span>' : '')}
        </td>
        <td class="cell-actions">
          <div class="retail-btn-stack">
            <button type="button" class="btn-swap-inline" data-action="pick" data-slot-id="${slot.slotId}" data-category="${slot.category}">Swap</button>
            <a href="${amazonUrl}" target="_blank" rel="nofollow noopener sponsored" class="btn-retail btn-retail--amz" title="Check price on Amazon">Amazon →</a>
            <a href="${sweetwaterUrl}" target="_blank" rel="nofollow noopener sponsored" class="btn-retail btn-retail--sw" title="Search Sweetwater">Sweetwater</a>
            <a href="${reverbUrl}" target="_blank" rel="nofollow noopener" class="btn-retail btn-retail--rev" title="Find used on Reverb">Reverb (Used)</a>
            <button type="button" class="btn-del-slot" data-action="remove-slot" data-slot-id="${slot.slotId}" title="Remove this component">✕</button>
          </div>
        </td>
      </tr>
    `;
  }

  function getCableSummaryText() {
    var cables = currentRig.items.filter(function (s) { return s.category === "cables"; });
    if (cables.length === 0) return "No Audio Cables Selected";
    return cables.map(function (c) {
      var item = getSlotItem(c);
      return item ? item.model : "Audio Cable";
    }).join(" + ");
  }

  function renderSavedRigsList() {
    var saved = getSavedRigs();
    if (!saved || saved.length === 0) return '';

    return `
      <div class="saved-rigs-card">
        <div class="saved-rigs-head">
          <h4>💾 My Saved Custom Rigs (${saved.length})</h4>
          <button type="button" class="btn btn-secondary btn-sm" data-action="open-compare">⚖️ Compare Builds Side-by-Side</button>
        </div>
        <div class="saved-pills-list">
          ${saved.map(function (r, index) {
            return `
              <div class="saved-rig-pill">
                <button type="button" class="btn-load-rig" data-action="load-saved-rig" data-index="${index}">
                  <strong>${escapeHtml(r.name)}</strong>
                  <span>$${r.totalCost || 0} (${r.date || 'Saved'})</span>
                </button>
                <button type="button" class="btn-del-rig" data-action="delete-saved-rig" data-index="${index}" title="Delete rig">✕</button>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  /* ------------------------------------------------------------- Modal */
  function openPickerModal(slotId, category) {
    activeModalSlotId = slotId;
    activeModalCategory = category;
    var catMeta = CATALOG.categories.find(function (c) { return c.id === category; });
    var items = CATALOG.items.filter(function (i) { return i.category === category; });

    var activeSlot = currentRig.items.find(function (s) { return s.slotId === slotId; });
    var currentItemId = activeSlot ? activeSlot.itemId : null;

    var modalHtml = `
      <div class="picker-backdrop" data-action="close-modal">
        <div class="picker-dialog" role="dialog" aria-modal="true" aria-labelledby="picker-modal-title">
          <div class="picker-header">
            <div>
              <span class="picker-eyebrow">${catMeta ? catMeta.icon : ''} Component Selector</span>
              <h3 id="picker-modal-title">Select ${catMeta ? catMeta.name : 'Component'}</h3>
            </div>
            <button type="button" class="picker-close" data-action="close-modal" aria-label="Close dialog">✕</button>
          </div>

          <div class="picker-search-bar">
            <input type="search" placeholder="Filter by brand, model, feature (e.g. FLX4, balanced XLR, Pioneer, Traktor)..." data-modal-search autocomplete="off">
          </div>

          <div class="picker-grid" id="modal-items-grid">
            ${renderModalGridItems(items, currentItemId)}
          </div>
        </div>
      </div>
    `;

    var container = document.getElementById("rig-modal-container");
    container.innerHTML = modalHtml;
    container.hidden = false;
    document.body.classList.add("modal-open");

    var searchInput = container.querySelector("[data-modal-search]");
    if (searchInput) {
      searchInput.focus();
      searchInput.addEventListener("input", function (e) {
        var query = e.target.value.toLowerCase().trim();
        var tokens = query ? query.split(/\s+/) : [];
        var filtered = items.filter(function (i) {
          if (tokens.length === 0) return true;
          var text = (i.brand + " " + i.model + " " + (i.tagline || "") + " " + (i.ideal_for || "") + " " + (i.software_unlocks ? i.software_unlocks.join(" ") : "")).toLowerCase();
          return tokens.every(function (t) { return text.indexOf(t) !== -1; });
        });
        document.getElementById("modal-items-grid").innerHTML = renderModalGridItems(filtered, currentItemId);
      });
    }
  }

  function renderModalGridItems(items, currentItemId) {
    if (items.length === 0) {
      return '<div class="picker-empty"><p>No components match your search filter.</p></div>';
    }

    return items.map(function (item) {
      var isCurrent = currentItemId === item.id;
      return `
        <article class="picker-card ${isCurrent ? 'is-selected' : ''}">
          <div class="picker-card-img-wrap">
            <img src="${item.image}" alt="${escapeHtml(item.model)}" class="picker-card-img" loading="lazy">
            <span class="picker-price-badge">$${item.price}</span>
          </div>
          <div class="picker-card-body">
            <span class="picker-card-brand">${escapeHtml(item.brand)}</span>
            <h4 class="picker-card-title">${escapeHtml(item.model)}</h4>
            <p class="picker-card-tagline">${escapeHtml(item.tagline || item.ideal_for || '')}</p>
            <div class="picker-specs-list">
              ${item.channels ? `<span>${item.channels} Channels</span>` : ''}
              ${item.master_outputs ? `<span>Outputs: ${item.master_outputs.join(", ")}</span>` : ''}
              ${item.inputs ? `<span>Inputs: ${item.inputs.join(", ")}</span>` : ''}
              ${item.software_unlocks ? `<span>Unlocks: ${item.software_unlocks.join(", ")}</span>` : ''}
            </div>
          </div>
          <div class="picker-card-footer">
            <button type="button" class="btn ${isCurrent ? 'btn-secondary' : ''} btn-sm btn-select-item" data-action="select-item" data-item-id="${item.id}">
              ${isCurrent ? '✓ In Your Rig' : 'Select for Rig'}
            </button>
            ${item.slug ? `<a href="${item.slug}" class="picker-review-link" target="_blank">Full Review ↗</a>` : ''}
          </div>
        </article>
      `;
    }).join("");
  }

  function closeModal() {
    var container = document.getElementById("rig-modal-container");
    container.hidden = true;
    container.innerHTML = "";
    document.body.classList.remove("modal-open");
    activeModalSlotId = null;
    activeModalCategory = null;
  }

  /* -------------------------------------------------- Compare Modal */
  function openCompareModal() {
    var saved = getSavedRigs();
    var allRigsToCompare = [];

    // Add current active rig
    allRigsToCompare.push({ name: currentRig.name + " (Current)", items: currentRig.items });

    // Add presets
    CATALOG.presets.forEach(function (p) {
      allRigsToCompare.push({ name: p.name + " (" + p.badge + ")", items: convertPresetToItems(p) });
    });

    // Add saved builds
    saved.forEach(function (s) {
      allRigsToCompare.push({ name: s.name, items: s.items || [] });
    });

    var rigA = allRigsToCompare[0];
    var rigB = allRigsToCompare[1] || allRigsToCompare[0];

    var modalHtml = `
      <div class="picker-backdrop" data-action="close-modal">
        <div class="picker-dialog picker-dialog--wide" role="dialog" aria-modal="true" aria-labelledby="compare-modal-title">
          <div class="picker-header">
            <div>
              <span class="picker-eyebrow">Gear Comparison Tool</span>
              <h3 id="compare-modal-title">Compare Two DJ Setups Side-by-Side</h3>
            </div>
            <button type="button" class="picker-close" data-action="close-modal" aria-label="Close dialog">✕</button>
          </div>

          <div class="compare-selectors-bar">
            <div class="compare-col-select">
              <label>Build A:</label>
              <select id="compare-select-a" class="compare-dropdown">
                ${allRigsToCompare.map(function (r, i) {
                  return `<option value="${i}" ${i === 0 ? 'selected' : ''}>${escapeHtml(r.name)}</option>`;
                }).join("")}
              </select>
            </div>
            <span class="compare-vs-badge">VS</span>
            <div class="compare-col-select">
              <label>Build B:</label>
              <select id="compare-select-b" class="compare-dropdown">
                ${allRigsToCompare.map(function (r, i) {
                  return `<option value="${i}" ${i === 1 ? 'selected' : ''}>${escapeHtml(r.name)}</option>`;
                }).join("")}
              </select>
            </div>
          </div>

          <div class="compare-grid" id="compare-content-grid">
            ${renderCompareGridContent(rigA, rigB)}
          </div>
        </div>
      </div>
    `;

    var container = document.getElementById("rig-modal-container");
    container.innerHTML = modalHtml;
    container.hidden = false;
    document.body.classList.add("modal-open");

    var selA = container.querySelector("#compare-select-a");
    var selB = container.querySelector("#compare-select-b");
    if (selA && selB) {
      var updateCompare = function () {
        var rA = allRigsToCompare[parseInt(selA.value, 10)];
        var rB = allRigsToCompare[parseInt(selB.value, 10)];
        document.getElementById("compare-content-grid").innerHTML = renderCompareGridContent(rA, rB);
      };
      selA.addEventListener("change", updateCompare);
      selB.addEventListener("change", updateCompare);
    }
  }

  function convertPresetToItems(preset) {
    var items = [];
    Object.keys(preset.slots).forEach(function (cat) {
      items.push({
        slotId: "p-" + cat,
        category: cat,
        itemId: preset.slots[cat],
        qty: 1,
        owned: false
      });
    });
    return items;
  }

  function renderCompareGridContent(rigA, rigB) {
    var valA = calculateCustomRigValuation(rigA.items);
    var valB = calculateCustomRigValuation(rigB.items);

    return `
      <div class="compare-rig-card">
        <h4>${escapeHtml(rigA.name)}</h4>
        <div class="compare-price-tag">$${valA.toLocaleString()}</div>
        <div class="compare-specs-table">
          ${CATALOG.categories.map(function (cat) {
            var item = findItemInItems(rigA.items, cat.id);
            return `<div class="compare-spec-row">
              <span class="spec-cat-label">${cat.name}:</span>
              <strong>${item ? (item.brand + ' ' + item.model + ' ($' + item.price + ')') : 'None'}</strong>
            </div>`;
          }).join("")}
        </div>
      </div>

      <div class="compare-rig-card">
        <h4>${escapeHtml(rigB.name)}</h4>
        <div class="compare-price-tag">$${valB.toLocaleString()}</div>
        <div class="compare-specs-table">
          ${CATALOG.categories.map(function (cat) {
            var item = findItemInItems(rigB.items, cat.id);
            return `<div class="compare-spec-row">
              <span class="spec-cat-label">${cat.name}:</span>
              <strong>${item ? (item.brand + ' ' + item.model + ' ($' + item.price + ')') : 'None'}</strong>
            </div>`;
          }).join("")}
        </div>
      </div>
    `;
  }

  function findItemInItems(items, category) {
    var s = items.find(function (slot) { return slot.category === category; });
    return s ? getItem(s.itemId) : null;
  }

  function calculateCustomRigValuation(items) {
    var total = 0;
    items.forEach(function (s) {
      var it = getItem(s.itemId);
      if (it) total += it.price * (s.qty || 1);
    });
    return total;
  }

  /* ------------------------------------------------------------- Actions */
  function setupGlobalListeners() {
    document.addEventListener("click", function (e) {
      // 1. Modal backdrop close
      if (e.target.classList.contains("picker-backdrop")) {
        closeModal();
        return;
      }

      // 2. Button actions
      var btn = e.target.closest("[data-action]") || e.target.closest(".btn-select-item") || e.target.closest(".picker-close");
      if (!btn) return;

      var action = btn.getAttribute("data-action");

      if (action === "select-item" || btn.classList.contains("btn-select-item")) {
        var itemId = btn.getAttribute("data-item-id");
        if (activeModalSlotId && itemId) {
          var targetSlot = currentRig.items.find(function (s) { return s.slotId === activeModalSlotId; });
          if (targetSlot) {
            targetSlot.itemId = itemId;
          } else {
            currentRig.items.push({
              slotId: activeModalSlotId,
              category: activeModalCategory,
              itemId: itemId,
              qty: 1,
              owned: false
            });
          }
          closeModal();
          saveActiveState();
          renderApp();
        }
        return;
      }

      if (action === "pick") {
        var slotId = btn.getAttribute("data-slot-id");
        var category = btn.getAttribute("data-category");
        if (slotId && category) openPickerModal(slotId, category);
      } else if (action === "close-modal" || btn.classList.contains("picker-close")) {
        closeModal();
      } else if (action === "toggle-slot-owned") {
        var tSlotId = btn.getAttribute("data-slot-id");
        var slotToToggle = currentRig.items.find(function (s) { return s.slotId === tSlotId; });
        if (slotToToggle) {
          slotToToggle.owned = !slotToToggle.owned;
          saveActiveState();
          renderApp();
        }
      } else if (action === "auto-fix-cable") {
        var cableId = btn.getAttribute("data-cable-id");
        if (cableId) {
          var existingCableSlot = currentRig.items.find(function (s) { return s.category === "cables"; });
          if (existingCableSlot) {
            existingCableSlot.itemId = cableId;
          } else {
            currentRig.items.push({
              slotId: "core-cable",
              category: "cables",
              itemId: cableId,
              qty: 1,
              owned: false
            });
          }
          saveActiveState();
          renderApp();
        }
      } else if (action === "auto-fix-slot") {
        var fixSlotId = btn.getAttribute("data-slot-id");
        var fixItemId = btn.getAttribute("data-item-id");
        var targetFixSlot = currentRig.items.find(function (s) { return s.slotId === fixSlotId; });
        if (targetFixSlot) {
          targetFixSlot.itemId = fixItemId;
          saveActiveState();
          renderApp();
        }
      } else if (action === "remove-slot") {
        var rSlotId = btn.getAttribute("data-slot-id");
        currentRig.items = currentRig.items.filter(function (s) { return s.slotId !== rSlotId; });
        saveActiveState();
        renderApp();
      } else if (action === "open-add-slot") {
        var menu = document.getElementById("add-slot-menu");
        if (menu) menu.hidden = !menu.hidden;
      } else if (action === "add-new-slot") {
        var addCat = btn.getAttribute("data-category");
        var menuElem = document.getElementById("add-slot-menu");
        if (menuElem) menuElem.hidden = true;
        var newSlotId = "extra-" + addCat + "-" + Date.now();
        openPickerModal(newSlotId, addCat);
      } else if (action === "copy-checklist") {
        copyChecklistToClipboard();
      } else if (action === "share-rig") {
        copyShareUrlToClipboard();
      } else if (action === "save-rig") {
        promptSaveRig();
      } else if (action === "open-compare") {
        openCompareModal();
      } else if (action === "random-rig") {
        loadRandomPreset();
      } else if (action === "load-saved-rig") {
        var idx = parseInt(btn.getAttribute("data-index"), 10);
        loadSavedRig(idx);
      } else if (action === "delete-saved-rig") {
        var delIdx = parseInt(btn.getAttribute("data-index"), 10);
        deleteSavedRig(delIdx);
      }
    });

    // Quantity dropdown change
    document.addEventListener("change", function (e) {
      if (e.target.matches("[data-action='change-qty']")) {
        var slotId = e.target.getAttribute("data-slot-id");
        var slot = currentRig.items.find(function (s) { return s.slotId === slotId; });
        if (slot) {
          slot.qty = parseInt(e.target.value, 10) || 1;
          saveActiveState();
          renderApp();
        }
      }
    });

    // Preset pills click
    document.addEventListener("click", function (e) {
      var presetBtn = e.target.closest("[data-preset-id]");
      if (!presetBtn) return;
      var pId = presetBtn.getAttribute("data-preset-id");
      var preset = CATALOG.presets.find(function (p) { return p.id === pId; });
      if (preset) loadPresetData(preset);
    });

    // Title edit
    document.addEventListener("blur", function (e) {
      if (e.target.matches("[data-rig-name]")) {
        currentRig.name = e.target.textContent.trim() || "My Custom DJ Rig";
        saveActiveState();
      }
    }, true);

    // Escape key closes modal
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeModal();
    });
  }

  function loadPresetData(preset) {
    currentRig.name = preset.name;
    currentRig.items = convertPresetToItems(preset);
    saveActiveState();
    renderApp();
  }

  function loadRandomPreset() {
    if (!CATALOG || !CATALOG.presets) return;
    var randomIdx = Math.floor(Math.random() * CATALOG.presets.length);
    loadPresetData(CATALOG.presets[randomIdx]);
  }

  function copyChecklistToClipboard() {
    var stats = calculateRigStats();
    var lines = [
      "=========================================",
      "  OFFBEAT DJ RIG SHOPPING CHECKLIST",
      "  " + currentRig.name,
      "=========================================",
      ""
    ];

    currentRig.items.forEach(function (slot) {
      var item = getSlotItem(slot);
      if (item) {
        var qty = slot.qty || 1;
        var statusStr = slot.owned ? "[ALREADY OWNED]" : "[NEED TO BUY]";
        lines.push(statusStr + " (" + qty + "x) " + item.brand + " " + item.model + " - $" + (item.price * qty));
      }
    });

    lines.push("");
    lines.push("Total Setup Valuation: $" + stats.totalValue.toLocaleString());
    lines.push("Owned Gear Savings: -$" + stats.ownedValue.toLocaleString());
    lines.push("Total Out-of-Pocket Spend: $" + stats.purchaseCost.toLocaleString());
    lines.push("");
    lines.push("Plan and customize your DJ rig on Offbeat: " + window.location.href);

    var text = lines.join("\n");
    navigator.clipboard.writeText(text).then(function () {
      alert("✓ Shopping checklist copied to clipboard!");
    }).catch(function () {
      prompt("Copy your shopping checklist below:", text);
    });
  }

  function copyShareUrlToClipboard() {
    var url = window.location.href;
    navigator.clipboard.writeText(url).then(function () {
      alert("✓ Shareable rig link copied to clipboard!");
    }).catch(function () {
      prompt("Copy your shareable rig link below:", url);
    });
  }

  function getSavedRigs() {
    try {
      return JSON.parse(localStorage.getItem("offbeat.rigs.saved")) || [];
    } catch (e) {
      return [];
    }
  }

  function promptSaveRig() {
    var name = prompt("Name your setup:", currentRig.name);
    if (!name) return;
    currentRig.name = name;

    var stats = calculateRigStats();
    var saved = getSavedRigs();
    saved.unshift({
      name: name,
      items: JSON.parse(JSON.stringify(currentRig.items)),
      totalCost: stats.purchaseCost,
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    });

    if (saved.length > 15) saved = saved.slice(0, 15);
    localStorage.setItem("offbeat.rigs.saved", JSON.stringify(saved));
    saveActiveState();
    renderApp();
  }

  function loadSavedRig(index) {
    var saved = getSavedRigs();
    if (!saved[index]) return;
    var r = saved[index];
    currentRig.name = r.name;
    currentRig.items = r.items ? JSON.parse(JSON.stringify(r.items)) : convertPresetToItems(r);
    saveActiveState();
    renderApp();
  }

  function deleteSavedRig(index) {
    var saved = getSavedRigs();
    saved.splice(index, 1);
    localStorage.setItem("offbeat.rigs.saved", JSON.stringify(saved));
    renderApp();
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /* ---------------------------------------------------------------- Start */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
