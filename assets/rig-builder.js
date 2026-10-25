/* =============================================================================
   Offbeat Inc. — My DJ Rig Builder & Gear Planner
   "The PCPartPicker of DJ Equipment"
   ========================================================================== */

(function () {
  "use strict";

  var CATALOG = null;

  // Active Rig State
  var currentRig = {
    name: "My Custom DJ Rig",
    slots: {
      controllers: "pioneer-ddj-flx4",
      headphones: "sennheiser-hd25",
      speakers: "pioneer-dm40d",
      laptops: "macbook-air-m2",
      cables: "cable-rca-rca",
      accessories: "laptop-stand-pyle"
    },
    owned: {
      controllers: false,
      headphones: false,
      speakers: false,
      laptops: true, // Default: most people already own a laptop
      cables: false,
      accessories: false
    }
  };

  // Active category being picked in modal
  var activeModalCategory = null;

  // DOM Elements
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
    var rigParam = params.get("rig");
    if (rigParam) {
      try {
        var parsed = JSON.parse(decodeURIComponent(atob(rigParam)));
        if (parsed && parsed.slots) {
          currentRig = parsed;
          return;
        }
      } catch (e) {
        console.warn("Invalid rig URL param:", e);
      }
    }

    var local = localStorage.getItem("offbeat.rig.active");
    if (local) {
      try {
        var saved = JSON.parse(local);
        if (saved && saved.slots) {
          currentRig = saved;
        }
      } catch (e) {
        console.warn("Invalid local rig state:", e);
      }
    }
  }

  function saveActiveState() {
    try {
      localStorage.setItem("offbeat.rig.active", JSON.stringify(currentRig));
      // Update shareable URL without reloading page
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

  /* ----------------------------------------------------------- Calculations */
  function calculateRigStats() {
    var totalValue = 0;
    var ownedValue = 0;
    var purchaseCost = 0;
    var itemCount = 0;
    var ownedCount = 0;

    Object.keys(currentRig.slots).forEach(function (cat) {
      var id = currentRig.slots[cat];
      var item = getItem(id);
      if (item) {
        totalValue += item.price;
        itemCount++;
        if (currentRig.owned[cat]) {
          ownedValue += item.price;
          ownedCount++;
        } else {
          purchaseCost += item.price;
        }
      }
    });

    var compatibility = runCompatibilityChecks();

    return {
      totalValue: totalValue,
      ownedValue: ownedValue,
      purchaseCost: purchaseCost,
      itemCount: itemCount,
      ownedCount: ownedCount,
      compatibility: compatibility
    };
  }

  function runCompatibilityChecks() {
    var controller = getItem(currentRig.slots.controllers);
    var headphones = getItem(currentRig.slots.headphones);
    var speakers = getItem(currentRig.slots.speakers);
    var laptop = getItem(currentRig.slots.laptops);
    var cable = getItem(currentRig.slots.cables);

    var checks = [];
    var issues = 0;

    // 1. Audio Signal Cable Matching
    if (controller && speakers) {
      var ctrlOutputs = controller.master_outputs || [];
      var spkInputs = speakers.inputs || [];

      var hasRCAOut = ctrlOutputs.some(function (o) { return o.indexOf("RCA") !== -1; });
      var hasXLROut = ctrlOutputs.some(function (o) { return o.indexOf("XLR") !== -1; });
      var hasTRSOut = ctrlOutputs.some(function (o) { return o.indexOf("TRS") !== -1 || o.indexOf("1/4\"") !== -1; });

      var hasRCAIn = spkInputs.some(function (i) { return i.indexOf("RCA") !== -1; });
      var hasXLRIn = spkInputs.some(function (i) { return i.indexOf("XLR") !== -1; });
      var hasTRSIn = spkInputs.some(function (i) { return i.indexOf("TRS") !== -1 || i.indexOf("1/4\"") !== -1; });

      if (hasXLROut && hasXLRIn) {
        checks.push({
          type: "success",
          title: "Balanced Pro XLR Signal Link",
          desc: "Controller features balanced XLR Master outputs matching your speakers for zero-noise, high-voltage audio transmission.",
          recommendedCable: "cable-xlr-xlr"
        });
      } else if (hasRCAOut && hasRCAIn) {
        checks.push({
          type: "success",
          title: "Direct Dual RCA Connection",
          desc: "Controller RCA Master Out connects directly to speaker RCA inputs. Optimal for home desks under 10 feet.",
          recommendedCable: "cable-rca-rca"
        });
      } else if (hasRCAOut && (hasTRSIn || hasXLRIn) && !hasRCAIn) {
        checks.push({
          type: "warning",
          title: "Cable Adapter Required (RCA to 1/4\" TS)",
          desc: "Your controller has RCA outputs but your speakers only accept 1/4\" TRS/XLR inputs (e.g. Yamaha HS5). Use a Dual RCA to Dual 1/4\" TS cable.",
          recommendedCable: "cable-rca-trs"
        });
        issues++;
      } else {
        checks.push({
          type: "info",
          title: "Standard Audio Connection",
          desc: "Check your physical cable connections between controller outputs and speaker inputs.",
          recommendedCable: "cable-rca-rca"
        });
      }
    }

    // 2. Standalone vs Laptop Check
    if (controller && laptop) {
      if (laptop.id === "standalone-usb-only" && !controller.standalone) {
        checks.push({
          type: "error",
          title: "Missing Required Host Computer",
          desc: controller.brand + " " + controller.model + " is not a standalone console — it requires a host laptop or tablet running DJ software to function.",
          actionText: "Choose a Laptop",
          actionSlot: "laptops"
        });
        issues++;
      } else if (controller.standalone) {
        checks.push({
          type: "success",
          title: "Standalone USB Performance Ready",
          desc: controller.brand + " " + controller.model + " contains its own onboard processor. Mix straight from USB flash drives with zero laptop required.",
          recommendedCable: null
        });
      } else {
        checks.push({
          type: "success",
          title: "Software & Hardware Synergy",
          desc: controller.model + " seamlessly connects to " + laptop.model + " via USB with low-latency audio driver support.",
          recommendedCable: null
        });
      }
    }

    // 3. Headphone Jack Check
    if (controller && headphones) {
      var ctrlJack = controller.headphone_jack || "";
      var hpJack = headphones.jack_type || "";
      if (ctrlJack.indexOf("3.5mm") !== -1 && hpJack.indexOf("1/4\"") !== -1 && hpJack.indexOf("adapter") === -1) {
        checks.push({
          type: "info",
          title: "Headphone Jack Adapter",
          desc: "Ensure your headphones include a 3.5mm mini-jack plug or screw-on 1/4\" adapter to match the controller cue jack.",
          recommendedCable: "adapter-headphone-jack"
        });
      }
    }

    // Readiness score calculation
    var readiness = 100;
    if (!currentRig.slots.controllers) readiness -= 35;
    if (!currentRig.slots.headphones) readiness -= 25;
    if (!currentRig.slots.speakers) readiness -= 20;
    if (!currentRig.slots.laptops) readiness -= 10;
    if (!currentRig.slots.cables) readiness -= 10;
    if (issues > 0) readiness = Math.max( readiness - issues * 15, 30);

    return {
      readiness: readiness,
      checks: checks,
      issues: issues
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
            <span class="hero-eyebrow">Interactive Gear Architect</span>
            <h2 class="rig-main-title" contenteditable="true" data-rig-name title="Click to rename your setup">${escapeHtml(currentRig.name)}</h2>
            <p class="rig-subtitle">Assemble your setup, mark gear you already own, verify audio signal compatibility, and generate an itemized shopping list.</p>
          </div>
          <div class="rig-dash-actions">
            <button type="button" class="btn btn-secondary btn-sm" data-action="copy-checklist">📋 Copy Checklist</button>
            <button type="button" class="btn btn-secondary btn-sm" data-action="share-rig">🔗 Share Build</button>
            <button type="button" class="btn btn-secondary btn-sm" data-action="save-rig">💾 Save Rig</button>
            <button type="button" class="btn btn-sm" data-action="random-rig">🎲 Quick Preset</button>
          </div>
        </div>

        <!-- Presets Bar -->
        <div class="rig-preset-strip" role="group" aria-label="Preset starting points">
          <span class="preset-label">Quick Start Rigs:</span>
          ${CATALOG.presets.map(function (p) {
            return `<button type="button" class="rig-preset-pill" data-preset-id="${p.id}">
              <strong>${p.name}</strong> <span class="preset-badge">${p.badge}</span>
            </button>`;
          }).join("")}
        </div>

        <!-- Metric Cards -->
        <div class="rig-metrics-grid">
          <div class="rig-metric-card">
            <span class="metric-label">Total Rig Value</span>
            <strong class="metric-val">$${stats.totalValue.toLocaleString()}</strong>
            <span class="metric-sub">${stats.itemCount} items assembled</span>
          </div>
          <div class="rig-metric-card metric-card--owned">
            <span class="metric-label">Gear You Own (Saved)</span>
            <strong class="metric-val metric-val--owned">-$${stats.ownedValue.toLocaleString()}</strong>
            <span class="metric-sub">${stats.ownedCount} owned items deducted</span>
          </div>
          <div class="rig-metric-card metric-card--spend">
            <span class="metric-label">Needed Purchase Total</span>
            <strong class="metric-val metric-val--spend">$${stats.purchaseCost.toLocaleString()}</strong>
            <span class="metric-sub">${stats.itemCount - stats.ownedCount} items to buy</span>
          </div>
          <div class="rig-metric-card metric-card--readiness">
            <span class="metric-label">Setup Readiness</span>
            <div class="readiness-gauge-wrap">
              <div class="readiness-bar"><div class="readiness-fill" style="width: ${stats.compatibility.readiness}%"></div></div>
              <strong class="readiness-num">${stats.compatibility.readiness}%</strong>
            </div>
            <span class="metric-sub">${stats.compatibility.issues === 0 ? "✓ 100% Compatible & Complete" : "⚠️ " + stats.compatibility.issues + " issue to check"}</span>
          </div>
        </div>
      </section>

      <!-- Visual DJ Booth Studio Layout -->
      <section class="rig-booth-section">
        <div class="section-head">
          <h3>DJ Studio Booth &amp; Signal Routing</h3>
          <p>Interactive 2D booth layout. Click any piece of gear to swap components or toggle ownership.</p>
        </div>
        <div class="rig-booth-stage">
          <!-- Top Row: Monitors & Laptop -->
          <div class="booth-top-row">
            ${renderBoothNode("speakers", "Left Monitor (Pair)", "🔊")}
            ${renderBoothNode("laptops", "Host Platform / OS", "💻")}
            ${renderBoothNode("accessories", "Desk Stand / Mic", "📦")}
          </div>

          <!-- Signal Cables Indicator -->
          <div class="booth-cables-row">
            <div class="cable-pulse-line cable-pulse--left"></div>
            <div class="cable-node-hub" data-action="pick" data-slot="cables">
              <span class="cable-icon">🔌</span>
              <span class="cable-title">${getSlotDisplayName("cables")}</span>
              <span class="cable-change">Change Cables →</span>
            </div>
            <div class="cable-pulse-line cable-pulse--right"></div>
          </div>

          <!-- Bottom Row: Controller & Headphones -->
          <div class="booth-bottom-row">
            ${renderBoothNode("controllers", "DJ Controller / Decks & Mixer", "🎛️", true)}
            ${renderBoothNode("headphones", "DJ Headphones", "🎧")}
          </div>
        </div>
      </section>

      <!-- Compatibility Engine Alerts -->
      <section class="rig-compat-section">
        <div class="compat-box">
          <div class="compat-header">
            <h4>⚡ Real-Time Hardware &amp; Signal Compatibility Engine</h4>
            <span class="compat-status-tag ${stats.compatibility.issues === 0 ? 'tag--ok' : 'tag--warn'}">
              ${stats.compatibility.issues === 0 ? '✓ All Connections Verified' : '⚠️ Attention Required'}
            </span>
          </div>
          <div class="compat-items-grid">
            ${stats.compatibility.checks.map(function (c) {
              return `<div class="compat-item compat-item--${c.type}">
                <div class="compat-icon">${c.type === 'success' ? '✓' : c.type === 'warning' ? '⚠️' : 'ℹ️'}</div>
                <div class="compat-body">
                  <strong>${escapeHtml(c.title)}</strong>
                  <p>${escapeHtml(c.desc)}</p>
                  ${c.recommendedCable ? `<button type="button" class="btn-text-action" data-action="set-cable" data-cable-id="${c.recommendedCable}">Set recommended cable →</button>` : ''}
                </div>
              </div>`;
            }).join("")}
          </div>
        </div>
      </section>

      <!-- Itemized PCPartPicker Table -->
      <section class="rig-table-section">
        <div class="section-head">
          <h3>Component Breakdown &amp; Shopping List</h3>
          <p>Every piece in your setup with dated 2026 price estimates and direct retailer destinations.</p>
        </div>

        <div class="table-wrap">
          <table class="drill-table rig-spec-table">
            <thead>
              <tr>
                <th scope="col">Component Slot</th>
                <th scope="col">Selected Equipment</th>
                <th scope="col">Status</th>
                <th scope="col">Price Est.</th>
                <th scope="col">Retailer Actions</th>
              </tr>
            </thead>
            <tbody>
              ${CATALOG.categories.map(function (cat) {
                return renderTableRow(cat.id);
              }).join("")}
            </tbody>
            <tfoot>
              <tr class="rig-total-row">
                <td colspan="3"><strong>Total Shopping Expenditure Needed:</strong></td>
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

      <!-- Saved Rigs Drawer -->
      <section class="rig-saved-section" id="saved-rigs-drawer">
        ${renderSavedRigsList()}
      </section>

      <!-- Modal Container (Dynamically populated) -->
      <div id="rig-modal-container" hidden></div>
    `;

    builderRoot.innerHTML = html;
  }

  function renderBoothNode(category, label, icon, isMain) {
    var id = currentRig.slots[category];
    var item = getItem(id);
    var isOwned = currentRig.owned[category];

    if (!item) {
      return `
        <div class="booth-card booth-card--empty ${isMain ? 'booth-card--main' : ''}" data-action="pick" data-slot="${category}">
          <span class="booth-card-role">${icon} ${label}</span>
          <div class="booth-empty-content">
            <span class="booth-plus">+</span>
            <strong>Select ${label}</strong>
          </div>
        </div>
      `;
    }

    return `
      <div class="booth-card ${isMain ? 'booth-card--main' : ''} ${isOwned ? 'booth-card--owned' : ''}">
        <div class="booth-card-top">
          <span class="booth-card-role">${icon} ${label}</span>
          <button type="button" class="booth-owned-toggle ${isOwned ? 'is-active' : ''}" data-action="toggle-owned" data-slot="${category}" title="Toggle already owned">
            ${isOwned ? '✓ Owned' : '🛒 Need'}
          </button>
        </div>
        <div class="booth-card-body" data-action="pick" data-slot="${category}">
          <div class="booth-thumb-wrap">
            <img src="${item.image}" alt="${escapeHtml(item.brand + ' ' + item.model)}" loading="lazy" class="booth-thumb">
          </div>
          <div class="booth-info">
            <span class="booth-brand">${escapeHtml(item.brand)}</span>
            <strong class="booth-model">${escapeHtml(item.model)}</strong>
            <span class="booth-price ${isOwned ? 'price--owned' : ''}">
              ${isOwned ? '<s>$' + item.price + '</s> (Owned)' : '$' + item.price}
            </span>
          </div>
        </div>
        <button type="button" class="booth-swap-btn" data-action="pick" data-slot="${category}">
          Swap / Customize →
        </button>
      </div>
    `;
  }

  function renderTableRow(category) {
    var id = currentRig.slots[category];
    var item = getItem(id);
    var isOwned = currentRig.owned[category];
    var catMeta = CATALOG.categories.find(function (c) { return c.id === category; });

    if (!item) {
      return `
        <tr class="rig-row rig-row--empty">
          <td><strong>${catMeta ? catMeta.icon + ' ' + catMeta.name : category}</strong></td>
          <td colspan="3"><span class="empty-slot-msg">No component selected for this slot</span></td>
          <td><button type="button" class="btn btn-sm" data-action="pick" data-slot="${category}">Select Component</button></td>
        </tr>
      `;
    }

    var amazonUrl = "https://www.amazon.com/s?k=" + encodeURIComponent(item.amazon_search || (item.brand + " " + item.model)) + "&tag=offbeatdj-20";
    var sweetwaterUrl = "https://www.sweetwater.com/store/search?s=" + encodeURIComponent(item.brand + " " + item.model);
    var reverbUrl = "https://reverb.com/marketplace?query=" + encodeURIComponent(item.brand + " " + item.model);

    return `
      <tr class="rig-row ${isOwned ? 'rig-row--owned' : ''}">
        <td class="cell-cat">
          <span class="cat-pill">${catMeta ? catMeta.icon : ''} ${catMeta ? catMeta.name : category}</span>
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
        <td class="cell-status">
          <button type="button" class="status-btn ${isOwned ? 'status-btn--owned' : 'status-btn--needed'}" data-action="toggle-owned" data-slot="${category}">
            ${isOwned ? '🟢 I Own This' : '🔵 Need to Buy'}
          </button>
        </td>
        <td class="cell-price">
          <span class="price-figure ${isOwned ? 'price--owned' : ''}">
            ${isOwned ? '<s>$' + item.price + '</s>' : '$' + item.price}
          </span>
          ${isOwned ? '<span class="owned-sub">($0 out of pocket)</span>' : ''}
        </td>
        <td class="cell-actions">
          <div class="retail-btn-stack">
            <button type="button" class="btn-swap-inline" data-action="pick" data-slot="${category}">Swap</button>
            <a href="${amazonUrl}" target="_blank" rel="nofollow noopener sponsored" class="btn-retail btn-retail--amz" title="Check price on Amazon">Amazon →</a>
            <a href="${sweetwaterUrl}" target="_blank" rel="nofollow noopener sponsored" class="btn-retail btn-retail--sw" title="Search Sweetwater">Sweetwater</a>
            <a href="${reverbUrl}" target="_blank" rel="nofollow noopener" class="btn-retail btn-retail--rev" title="Find used on Reverb">Reverb (Used)</a>
          </div>
        </td>
      </tr>
    `;
  }

  function renderSavedRigsList() {
    var saved = getSavedRigs();
    if (!saved || saved.length === 0) return '';

    return `
      <div class="saved-rigs-card">
        <h4>💾 My Saved Custom Rigs (${saved.length})</h4>
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

  function getSlotDisplayName(category) {
    var id = currentRig.slots[category];
    var item = getItem(id);
    return item ? (item.brand + " " + item.model) : "None Selected";
  }

  /* ------------------------------------------------------------- Modal */
  function openPickerModal(category) {
    activeModalCategory = category;
    var catMeta = CATALOG.categories.find(function (c) { return c.id === category; });
    var items = CATALOG.items.filter(function (i) { return i.category === category; });

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
            ${renderModalGridItems(items)}
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
        document.getElementById("modal-items-grid").innerHTML = renderModalGridItems(filtered);
      });
    }
  }

  function renderModalGridItems(items) {
    if (items.length === 0) {
      return '<div class="picker-empty"><p>No components match your search filter.</p></div>';
    }

    return items.map(function (item) {
      var isCurrent = currentRig.slots[activeModalCategory] === item.id;
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
              ${isCurrent ? '✓ Currently in Rig' : 'Select for Rig'}
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
    activeModalCategory = null;
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
        if (activeModalCategory && itemId) {
          currentRig.slots[activeModalCategory] = itemId;
          closeModal();
          saveActiveState();
          renderApp();
        }
        return;
      }

      if (action === "pick") {
        var slot = btn.getAttribute("data-slot");
        if (slot) openPickerModal(slot);
      } else if (action === "close-modal" || btn.classList.contains("picker-close")) {
        closeModal();
      } else if (action === "toggle-owned") {
        var ownedSlot = btn.getAttribute("data-slot");
        if (ownedSlot) {
          currentRig.owned[ownedSlot] = !currentRig.owned[ownedSlot];
          saveActiveState();
          renderApp();
        }
      } else if (action === "set-cable") {
        var cableId = btn.getAttribute("data-cable-id");
        if (cableId) {
          currentRig.slots.cables = cableId;
          saveActiveState();
          renderApp();
        }
      } else if (action === "copy-checklist") {
        copyChecklistToClipboard();
      } else if (action === "share-rig") {
        copyShareUrlToClipboard();
      } else if (action === "save-rig") {
        promptSaveRig();
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

    // Preset pills click
    document.addEventListener("click", function (e) {
      var presetBtn = e.target.closest("[data-preset-id]");
      if (!presetBtn) return;
      var pId = presetBtn.getAttribute("data-preset-id");
      loadPreset(pId);
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

  function loadPreset(presetId) {
    if (!CATALOG) return;
    var preset = CATALOG.presets.find(function (p) { return p.id === presetId; });
    if (!preset) return;

    currentRig.name = preset.name;
    currentRig.slots = Object.assign({}, preset.slots);
    // Keep user's owned laptop flag intact
    currentRig.owned = {
      controllers: false,
      headphones: false,
      speakers: false,
      laptops: true,
      cables: false,
      accessories: false
    };

    saveActiveState();
    renderApp();
  }

  function loadRandomPreset() {
    if (!CATALOG || !CATALOG.presets) return;
    var randomIdx = Math.floor(Math.random() * CATALOG.presets.length);
    loadPreset(CATALOG.presets[randomIdx].id);
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

    Object.keys(currentRig.slots).forEach(function (cat) {
      var id = currentRig.slots[cat];
      var item = getItem(id);
      var isOwned = currentRig.owned[cat];
      if (item) {
        var statusStr = isOwned ? "[OWNED]" : "[NEED TO BUY]";
        lines.push(statusStr + " " + item.brand + " " + item.model + " - $" + item.price);
      }
    });

    lines.push("");
    lines.push("Total Rig Value: $" + stats.totalValue.toLocaleString());
    lines.push("Already Owned Value: -$" + stats.ownedValue.toLocaleString());
    lines.push("Total Out-of-Pocket Needed: $" + stats.purchaseCost.toLocaleString());
    lines.push("");
    lines.push("Assembled via Offbeat Rig Architect: " + window.location.href);

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
      slots: Object.assign({}, currentRig.slots),
      owned: Object.assign({}, currentRig.owned),
      totalCost: stats.purchaseCost,
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    });

    // Cap at 15 saved setups
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
    currentRig.slots = Object.assign({}, r.slots);
    currentRig.owned = Object.assign({}, r.owned);
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
