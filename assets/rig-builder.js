/* =============================================================================
   Offbeat Inc. — My DJ Rig Architect & Gear Planner
   "The PCPartPicker of DJ Equipment" (2026 Relaunch Edition)
   ========================================================================== */

(function () {
  "use strict";

  var CATALOG = null;
  // Only the untouched first-visit example gets an informational assumption.
  // Any restored, shared, preset-selected or edited rig keeps full warnings.
  var authoredStarterIntro = false;
  var audioCtx = null;
  var soundEnabled = safeStorageGet("offbeat.rig.sfx") !== "muted";

  // Browsers may deny storage access; the planner must still work in memory.
  function safeStorageGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeStorageSet(key, value) {
    try { window.localStorage.setItem(key, value); return true; }
    catch (e) { return false; }
  }

  // Active Rig State (Supports modular items, quantities, and owned gear)
  var currentRig = {
    name: "My Custom DJ Rig",
    items: [
      { slotId: "core-ctrl", category: "controllers", itemId: "pioneer-ddj-flx4", qty: 1, owned: false },
      { slotId: "core-hp", category: "headphones", itemId: "sennheiser-hd25", qty: 1, owned: false },
      { slotId: "core-spk", category: "speakers", itemId: "pioneer-dm40d", qty: 1, owned: false },
      { slotId: "core-host", category: "laptops", itemId: "existing-mobile-device", qty: 1, owned: true }
    ]
  };

  // Active slot being edited in modal
  var activeModalSlotId = null;
  var activeModalCategory = null;
  var activeModalSpeakerRole = null;

  // DOM Mount Root
  var builderRoot = document.getElementById("rig-app-root");
  if (!builderRoot) return;

  /* ------------------------------------------------------------- Web Audio Feedback */
  function playClickSfx(type) {
    if (!soundEnabled) return;
    try {
      if (!audioCtx) {
        var AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) audioCtx = new AudioContext();
      }
      if (!audioCtx || audioCtx.state === "suspended") {
        if (audioCtx && audioCtx.resume) audioCtx.resume();
      }
      if (!audioCtx) return;

      var now = audioCtx.currentTime;
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === "toggle") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.04);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.start(now);
        osc.stop(now + 0.04);
      } else if (type === "select") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.06); // A5
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc.start(now);
        osc.stop(now + 0.06);
      } else if (type === "preset") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(261.63, now); // C4
        osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.08); // C5
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      }
    } catch (e) {
      // Silent fallback
    }
  }

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
        var initialParams = new URLSearchParams(window.location.search);
        authoredStarterIntro = !initialParams.has("rig") && !initialParams.has("preset") &&
          !initialParams.has("add") && !safeStorageGet("offbeat.rig.active");
        var starter = CATALOG.presets && CATALOG.presets.find(function (p) { return p.id === "bedroom-starter"; });
        if (starter) {
          currentRig.name = starter.name;
          currentRig.items = convertPresetToItems(starter);
        }
        parseUrlOrLocalState();
      });
  }

  // A guide ?add= link must apply to an explicitly shared rig before any
  // unrelated localStorage state from this browser.
  function restoreSharedRigParam(value) {
    if (!value || value.length > 8192) return false;
    var b64 = value.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    try { return normalizeRigState(JSON.parse(decodeURIComponent(atob(b64)))); }
    catch (e) {
      try { return normalizeRigState(JSON.parse(atob(b64))); }
      catch (e2) {
        console.warn("Invalid rig URL param:", e2);
        return false;
      }
    }
  }

  function parseUrlOrLocalState() {
    var params = new URLSearchParams(window.location.search);

    // 1. Guide-to-planner deep links must preserve the visitor's current rig.
    // Previously ?add= silently started from the default preset, discarding
    // saved equipment, quantities, and ownership selections.
    var addParam = params.get("add");
    if (addParam) {
      var targetItem = getItem(addParam);
      if (targetItem) {
        if (!restoreSharedRigParam(params.get("rig"))) {
          var presetParam = params.get("preset");
          var pMatch = presetParam && CATALOG.presets ? CATALOG.presets.find(function (p) { return p.id === presetParam; }) : null;
          if (pMatch) {
            currentRig.name = pMatch.name;
            currentRig.items = convertPresetToItems(pMatch);
          } else {
            var savedRig = safeStorageGet("offbeat.rig.active");
            if (savedRig && savedRig.length <= 16384) {
              try { normalizeRigState(JSON.parse(savedRig)); }
              catch (e) { console.warn("Invalid local rig state:", e); }
            }
          }
        }

        // Additional accessories are additive. A guide's cable/USB/mic link
        // must not replace an unrelated accessory already in the shopping list.
        var additive = ["cables", "storage", "microphones", "stands"].indexOf(targetItem.category) !== -1;
        var alreadySelected = currentRig.items.some(function (s) { return s.itemId === targetItem.id; });
        var targetRole = targetItem.category === "speakers" ? (isSpeakerEligibleForRole(targetItem, "crowd_pa") ? "crowd_pa" : "dj_monitor") : undefined;
        var existingSlot = additive ? null : currentRig.items.find(function (s) {
          if (targetItem.category === "speakers") {
            return s.category === "speakers" && (s.role === targetRole || (!s.role && isSpeakerEligibleForRole(getItem(s.itemId), targetRole)));
          }
          return s.category === targetItem.category;
        });
        if (alreadySelected) {
          // An Add-to-Rig link is idempotent even when the item lives in a
          // second core slot. Never overwrite another selected/owned device.
        } else if (existingSlot) {
          // A genuinely new core product replaces the primary slot, while
          // accessories remain additive. Replacement resets ownership.
          replaceSlotItem(existingSlot, targetItem.id);
          if (targetRole) existingSlot.role = targetRole;
          existingSlot.qty = 1;
        } else {
          var newSlot = {
            slotId: "guide-" + targetItem.category + "-" + Date.now(),
            category: targetItem.category,
            itemId: targetItem.id,
            qty: 1,
            owned: false
          };
          if (targetRole) newSlot.role = targetRole;
          currentRig.items.push(newSlot);
        }
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
    if (restoreSharedRigParam(params.get("rig"))) return;

    // 4. Local state is optional and untrusted, just like shared URLs.
    var local = safeStorageGet("offbeat.rig.active");
    if (local && local.length <= 16384) {
      try { normalizeRigState(JSON.parse(local)); }
      catch (e) { console.warn("Invalid local rig state:", e); }
    }
  }

  // Shared URLs and saved rigs are untrusted. Never render raw slot identifiers.
  function sanitizeRigState(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    var raw;
    if (Array.isArray(data.items)) {
      raw = data.items;
    } else if (Array.isArray(data.i)) {
      raw = data.i;
    } else if (data.slots && typeof data.slots === "object" && !Array.isArray(data.slots)) {
      var cats = Object.keys(data.slots);
      if (cats.length > 24) return null;
      raw = cats.map(function (cat) {
        return { slotId: "core-" + cat, category: cat, itemId: data.slots[cat],
          qty: 1, owned: Boolean(data.owned && data.owned[cat]) };
      });
    } else return null;
    if (!raw.length || raw.length > 24) return null;

    var used = Object.create(null), items = [];
    raw.forEach(function (slot, index) {
      if (!slot || typeof slot !== "object" || Array.isArray(slot)) return;
      if (typeof slot.itemId !== "string" || typeof slot.category !== "string") return;
      var item = getItem(slot.itemId);
      if (!item || item.category !== slot.category) return;
      var id = typeof slot.slotId === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(slot.slotId)
        ? slot.slotId : "imported-" + index;
      var suffix = 0;
      while (used[id]) id = "imported-" + index + "-" + (++suffix);
      used[id] = true;
      var role = slot.role;
      if (item.category === "speakers") {
        if (role === "crowd_pa" && isSpeakerEligibleForRole(item, "crowd_pa")) {
          // valid crowd_pa
        } else if (role === "dj_monitor" && isSpeakerEligibleForRole(item, "dj_monitor")) {
          // valid dj_monitor
        } else {
          role = isSpeakerEligibleForRole(item, "crowd_pa") ? "crowd_pa" : "dj_monitor";
        }
      }
      var cleanSlot = {
        slotId: id, category: item.category, itemId: item.id,
        qty: item.no_purchase === true ? 1 : (Number.isInteger(slot.qty) && slot.qty >= 1 && slot.qty <= 4 ? slot.qty : 1),
        owned: item.no_purchase === true || slot.owned === true
      };
      if (role) cleanSlot.role = role;
      items.push(cleanSlot);
    });
    if (!items.length) return null;
    return {
      name: typeof data.name === "string" ? data.name.slice(0, 80) : (typeof data.n === "string" ? data.n.slice(0, 80) : "My Custom DJ Rig"),
      items: items
    };
  }

  function normalizeRigState(data) {
    var clean = sanitizeRigState(data);
    if (!clean) return false;
    currentRig = clean;
    return true;
  }

  function saveActiveState() {
    authoredStarterIntro = false;
    var serialized = JSON.stringify(currentRig);
    safeStorageSet("offbeat.rig.active", serialized);
    try {
      var encoded = btoa(encodeURIComponent(serialized));
      if (encoded.length > 8192) return;
      window.history.replaceState({ rig: currentRig }, "", window.location.pathname + "?rig=" + encodeURIComponent(encoded));
    } catch (e) {
      console.warn("Could not update rig share URL:", e);
    }
  }

  function getItem(id) {
    if (!CATALOG || !id) return null;
    return CATALOG.items.find(function (item) { return item.id === id; }) || null;
  }

  function getSlotItem(slot) {
    return getItem(slot.itemId);
  }

  // Owning the old product does not mean owning its replacement.
  function replaceSlotItem(slot, itemId) {
    var item = getItem(itemId);
    if (!slot || !item) return false;
    if (slot.category === "speakers" && slot.role) {
      if (!isSpeakerEligibleForRole(item, slot.role)) {
        console.warn("Cannot replace speaker slot with ineligible role item:", item.id, slot.role);
        return false;
      }
    }
    if (slot.itemId !== item.id) slot.owned = false;
    slot.itemId = item.id;
    slot.category = item.category;
    return true;
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
    var nextUpgrade = recommendNextUpgrade(compatibility);

    return {
      totalValue: totalValue,
      ownedValue: ownedValue,
      purchaseCost: purchaseCost,
      itemCount: itemCount,
      ownedCount: ownedCount,
      compatibility: compatibility,
      nextUpgrade: nextUpgrade
    };
  }

  // A speaker package can supply a passive 3.5mm-stereo-to-dual-RCA lead.
  // Verify the two connector types and the explicit manufacturer bundle.
  function includedSpeakerCableMatches(controller, speakers) {
    if (!controller || !speakers || speakers.included_audio_cable_3_5mm_to_rca !== true) return false;
    var outputs = controller.master_outputs || [];
    var inputs = speakers.inputs || [];
    var has = function (ports, connector) {
      var norm = connector.toLowerCase().replace(/\s+/g, "");
      return ports.some(function (port) { return port.toLowerCase().replace(/\s+/g, "").indexOf(norm) !== -1; });
    };
    return (has(outputs, "3.5mm") && has(inputs, "RCA")) ||
           (has(outputs, "RCA") && has(inputs, "3.5mm"));
  }

  /* ------------------------------------------- Real DJ Compatibility Engine */
  function runDeepCompatibilityChecks() {
    var controllerSlot = currentRig.items.find(function (s) { return s.category === "controllers"; });
    var headphonesSlot = currentRig.items.find(function (s) { return s.category === "headphones"; });
    var speakersSlot = currentRig.items.find(function (s) { return s.category === "speakers"; });
    var laptopSlot = currentRig.items.find(function (s) { return s.category === "laptops"; });
    var cableSlots = currentRig.items.filter(function (s) { return s.category === "cables"; });
    var microphoneSlots = currentRig.items.filter(function (s) { return s.category === "microphones"; });

    var controller = controllerSlot ? getSlotItem(controllerSlot) : null;
    var headphones = headphonesSlot ? getSlotItem(headphonesSlot) : null;
    var speakers = speakersSlot ? getSlotItem(speakersSlot) : null;
    var laptop = laptopSlot ? getSlotItem(laptopSlot) : null;

    var checks = [];
    var fatalErrors = 0;
    var warnings = 0;
    var requiresManualReview = false;

    // The shopping list supports multiple controllers, speakers and other core
    // devices, but the connection engine evaluates only the first of each.
    // Never mark a multi-device rig green based on a single-device check.
    ["controllers", "speakers", "laptops", "headphones"].forEach(function (category) {
      // Quantity steppers can represent multiple physical devices in ONE slot.
      // Count units, not just distinct slots, or two identical controllers/
      // speaker sets can incorrectly inherit a green single-device verdict.
      var count = currentRig.items.reduce(function (total, slot) {
        return total + (slot.category === category ? slot.qty || 1 : 0);
      }, 0);
      if (count < 2) return;
      requiresManualReview = true;
      warnings++;
      checks.push({
        type: "warning", statusLevel: "workable",
        title: "Multiple " + category + " Need Manual Verification",
        desc: "This rig contains " + count + " " + category + ". The shopping total includes all selected gear, " +
          "but automated connector, host and cue checks cover only the first item in each category. " +
          "Verify every additional device's signal path, software and power requirements before purchasing.",
        fixCableId: null
      });
    });

    // The catalog lists vocal microphones but has no verified microphone-input
    // specifications for controllers or mixers. An XLR master OUTPUT and an
    // XLR speaker cable do not establish a usable microphone INPUT path.
    // Never present a wedding/MC rig as ready on that unsupported inference.
    if (microphoneSlots.length) {
      var microphoneCount = microphoneSlots.reduce(function (count, slot) {
        return count + (slot.qty || 1);
      }, 0);
      requiresManualReview = true;
      warnings++;
      checks.push({
        type: "warning", statusLevel: "workable",
        title: "Microphone Input and Cable Need Verification",
        desc: "This rig includes " + microphoneCount + " vocal microphone(s), but the catalog does not verify " +
          "microphone inputs, mic preamp gain, or required microphone cables for the selected controller/mixer. " +
          "An XLR speaker output or cable does not prove that a microphone can be connected. " +
          "Confirm each mic input, cable, gain and any power requirements before purchasing.",
        fixCableId: null
      });
    }

    // A rig with no controller/decks/mixer is not a playable DJ setup.
    // Accessories alone must never produce a green preliminary match.
    if (!controller) {
      checks.push({
        type: "error", statusLevel: "incompatible",
        title: "DJ Controller or Mixer Required",
        desc: "No DJ controller, decks, or mixer are selected. Add a compatible DJ playback and mixing system before treating this as a complete setup.",
        fixCableId: null
      });
      fatalErrors++;
    }

    // A controller without headphones or speakers has no selected listening
    // path. A high readiness score would encourage an incomplete purchase.
    if (controller && !headphones && !speakers) {
      checks.push({
        type: "error", statusLevel: "incompatible",
        title: "Headphones or Speakers Required",
        desc: "This rig has no selected listening or cue output device. Add DJ headphones or speakers " +
          "before treating it as a playable setup; confirm the controller's audio outputs.",
        fixCableId: null
      });
      fatalErrors++;
    }

    // 1. Audio Signal Cable Matching (3-Way Verification)
    if (controller && speakers) {
      var ctrlOutputs = controller.master_outputs || [];
      var spkInputs = speakers.inputs || [];

      var hasRCAOut = ctrlOutputs.some(function (o) { return o.indexOf("RCA") !== -1; });
      var hasXLROut = ctrlOutputs.some(function (o) { return o.indexOf("XLR") !== -1; });
      var hasTRSOut = ctrlOutputs.some(function (o) { return o.indexOf("TRS") !== -1 || o.indexOf("1/4\"") !== -1; });

      var hasRCAIn = spkInputs.some(function (i) { return i.indexOf("RCA") !== -1; });
      var hasXLRIn = spkInputs.some(function (i) { return i.indexOf("XLR") !== -1; });
      var hasTRSIn = spkInputs.some(function (i) { return i.indexOf("TRS") !== -1 || i.indexOf("1/4\"") !== -1; });

      // Only suggest cables whose physical endpoints match listed connectors.
      // The catalog does not contain every real-world cable type.
      var options = [];
      if (hasXLROut && hasXLRIn) options.push({ id: "cable-xlr-xlr", name: "Balanced XLR Cable Pair" });
      if (hasRCAOut && hasRCAIn) options.push({ id: "cable-rca-rca", name: "Dual RCA to Dual RCA Cable" });
      if (hasRCAOut && hasTRSIn) options.push({ id: "cable-rca-trs", name: "Dual RCA to Dual 1/4\" TS Cable" });
      var selected = options.find(function (c) {
        return cableSlots.some(function (slot) { return slot.itemId === c.id; });
      });
      if (includedSpeakerCableMatches(controller, speakers)) {
        checks.push({
          type: "success", statusLevel: "verified",
          title: "Included Speaker Cable Matches",
          desc: speakers.model + " includes a 3.5mm stereo-to-dual-RCA cable that matches " +
            controller.model + "'s master output and the speaker input. " +
            "No separate cable purchase is needed for this connection; verify package contents and length.",
          fixCableId: null
        });
        if (selected) {
          checks.push({
            type: "warning", statusLevel: "workable",
            title: "Separate Cable May Be Unnecessary",
            desc: selected.name + " is also selected. The speaker package already includes a matching cable; " +
              "keep the extra only if another connection needs it.",
            fixCableId: null
          });
          warnings++;
        }
      } else if (selected) {
        // A matching connector does not prove enough cable packs exist for
        // every PA/monitor route. Keep this verdict aligned with the booth.
        if (areAllSpeakerRoutesConfirmed()) {
          checks.push({
            type: "success", statusLevel: "workable",
            title: "Listed Audio Connection Match",
            desc: "Selected cable quantities cover the planned speaker routes. Verify wiring, levels, and manufacturer requirements.",
            fixCableId: null
          });
        } else {
          checks.push({
            type: "warning", statusLevel: "workable",
            title: "Speaker Cable Quantity or Routing Needs Review",
            desc: "A connector type matches, but the selected cable packs do not yet establish every speaker route. " +
              "Check the booth's per-route cable requirements, quantities and hardware output limits before buying.",
            fixCableId: null
          });
          warnings++;
        }
      } else if (options.length) {
        var suggestion = options[0];
        checks.push({
          type: "warning", statusLevel: "workable",
          title: "Audio Cable Needed",
          desc: "The catalog lists " + suggestion.name + " as a possible connection between " +
            controller.model + " and " + speakers.model +
            ". Confirm exact wiring and levels before purchasing.",
          fixCableId: suggestion.id, fixActionText: "Select " + suggestion.name
        });
        warnings++;
      } else {
        var miniOut = ctrlOutputs.some(function (o) { return o.indexOf("3.5mm") !== -1; });
        var miniIn = spkInputs.some(function (i) { return i.indexOf("3.5mm") !== -1; });
        var advice = miniOut && miniIn
          ? "A compatible 3.5mm stereo cable may work, but none is in this planner's catalog."
          : hasTRSOut && hasTRSIn
            ? "A matching TRS cable pair may work, but none is in this planner's catalog."
            : "No suitable cable is listed in this planner's catalog for these connectors.";
        checks.push({
          type: "warning", statusLevel: "workable",
          title: "Connection Requires Separate Verification",
          desc: advice + " Check the manufacturers' output and input specifications before buying.",
          fixCableId: null
        });
        warnings++;
      }
    } else if (controller && !speakers) {
      checks.push({
        type: "info",
        statusLevel: "workable",
        title: "Headphones-Only Practice Rig",
        desc: "You can practice transitions in headphones without speakers. Add studio monitors (like Pioneer DM-40D) when you want to hear room acoustics.",
        fixCableId: null
      });
    }

    // Check for hardware routing limitations on multi-line speaker setups
    var spkGroup = getRigSpeakerSlots();
    if (spkGroup.paSlot && spkGroup.monitorSlot && controller) {
      var paItem = getSlotItem(spkGroup.paSlot);
      var monItem = getSlotItem(spkGroup.monitorSlot);
      if (paItem && monItem && typeof OffbeatGear !== "undefined" && OffbeatGear.connectionPlan) {
        var usedOuts = {};
        var pPlan = OffbeatGear.connectionPlan(CATALOG, controller, paItem, spkGroup.paSlot.qty || 1, { usedOutputs: usedOuts });
        if (pPlan && pPlan.output) {
          usedOuts[pPlan.output.connector] = (usedOuts[pPlan.output.connector] || 0) + 1;
          usedOuts.claimed = [pPlan.output];
        }
        var mPlan = OffbeatGear.connectionPlan(CATALOG, controller, monItem, spkGroup.monitorSlot.qty || 1, { usedOutputs: usedOuts });
        if (mPlan && mPlan.conflict) {
          fatalErrors++;
          checks.unshift({
            type: "warning",
            statusLevel: "incompatible",
            title: "Hardware Limitation: Secondary Speaker Route Cannot Be Fed",
            desc: controller.model + " only provides one stereo master output and lacks an independent booth output. " +
              "It cannot simultaneously drive crowd PA and DJ monitors without an external DJ mixer or powered distribution box.",
            fixCableId: null
          });
        }
      }
    }

    // Check for acoustic role suitability
    var allSpeakers = currentRig.items.filter(function (s) { return s.category === "speakers"; });
    allSpeakers.forEach(function (slot) {
      var item = getItem(slot.itemId);
      if (!item) return;
      var role = slot.role || (isSpeakerEligibleForRole(item, "crowd_pa") ? "crowd_pa" : "dj_monitor");
      if (role === "crowd_pa" && !isSpeakerEligibleForRole(item, "crowd_pa")) {
        fatalErrors++;
        checks.unshift({
          type: "error",
          statusLevel: "incompatible",
          title: "Ineligible Crowd PA: " + item.model,
          desc: item.brand + " " + item.model + " is a nearfield reference monitor and cannot be used as a crowd-facing PA system. Live sound reinforcement requires horn dispersion and high acoustic output.",
          fixSlotId: slot.slotId,
          fixItemId: "jbl-eon-715",
          fixActionText: "Swap to JBL EON715 PA →"
        });
      }
    });

    // 2. Standalone vs Laptop Host Check
    if (controller && laptop) {
      if (laptop.id === "existing-mobile-device" && !controller.standalone) {
        if (controller.id === "pioneer-ddj-flx4") {
          checks.push({
            type: "warning", statusLevel: "workable",
            title: "Mobile Host, USB Audio and Power Need Verification",
            desc: "The $0 host assumes you ALREADY own a compatible iOS/Android phone or tablet. " +
              "Verify current rekordbox mobile support, a suitable USB cable and separate 9V/3A " +
              "power for DDJ-FLX4. USB can route master/headphone audio through the controller; " +
              "Bluetooth control leaves audio on the mobile device. Power is not priced here.",
            fixCableId: null
          });
          warnings++;
        } else if (controller.id === "pioneer-ddj-flx2") {
          // AlphaTheta explicitly supports rekordbox/djay mobile on FLX2.
          // Unlike FLX4, compatible USB-C hosts can bus-power FLX2; some
          // Android devices cannot. Bluetooth MIDI needs separate USB power.
          checks.push({
            type: "warning", statusLevel: "workable",
            title: "FLX2 Mobile Host, USB Audio and Power Need Verification",
            desc: "The $0 host assumes you ALREADY own a compatible phone or tablet. " +
              "DDJ-FLX2 supports rekordbox/djay mobile with the included USB-C cable on supported devices. " +
              "Compatible USB-C devices may supply bus power, but some Android devices cannot; " +
              "the rekordbox built-in-phone-speaker route is iOS-only. Bluetooth MIDI control " +
              "requires separate USB-C power and does not itself route audio through the controller. " +
              "Verify your exact phone, app, USB audio, headphone/master routing and power before purchasing. " +
              "Any external power accessory is not priced here.",
            fixCableId: null
          });
          warnings++;
        } else if (controller.id === "alphatheta-ddj-grv6") {
          // AlphaTheta confirms mobile rekordbox support, but only decks 1
          // and 2 work on iOS/Android. No Bluetooth; USB-C and sufficient
          // power are required. Do not reject a real two-deck mobile route
          // or imply the desktop four-deck workflow transfers to a phone.
          checks.push({
            type: "warning", statusLevel: "workable",
            title: "GRV6 Mobile: Two Decks Only, USB-C and Power Required",
            desc: "DDJ-GRV6 supports rekordbox for iOS/Android, but mobile playback " +
              "is limited to channels 1 and 2, not all four hardware channels. " +
              "The controller has no Bluetooth connection. Confirm a compatible " +
              "phone/tablet, USB-C data/audio routing and adequate power " +
              "(9V/3A adapter or a suitable 5V/1.5A USB host). " +
              "External power accessories are not included in this estimate. " +
              "Use a compatible computer for the full four-deck workflow.",
            fixCableId: null
          });
          warnings++;
        } else {
          checks.push({
            type: "error", statusLevel: "incompatible",
            title: "Mobile Host Not Verified for This Controller",
            desc: "This existing-phone option is qualified only for conditional DDJ-FLX4, DDJ-FLX2, or DDJ-GRV6 routes. " +
              "Choose a compatible computer or verify this controller's mobile software, power and audio path.",
            fixSlotId: laptopSlot ? laptopSlot.slotId : null,
            fixItemId: "macbook-air-m2",
            fixActionText: "Compare with a computer host"
          });
          fatalErrors++;
        }
      } else if (laptop.id === "standalone-usb-only" && !controller.standalone) {
        checks.push({
          type: "error",
          statusLevel: "incompatible",
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
          statusLevel: "verified",
          title: "Standalone Capability Listed",
          desc: controller.brand + " " + controller.model + " is listed as standalone-capable. Confirm supported media, firmware, and streaming services for your intended use.",
          fixCableId: null
        });
      } else {
        checks.push({
          type: "success",
          statusLevel: "verified",
          title: "Host Driver Compatibility Needs Verification",
          desc: controller.model + " is listed for USB use with " + laptop.model + ". Confirm current OS, DJ software licensing, and manufacturer driver requirements.",
          fixCableId: null
        });
      }
    } else if (controller && !laptop && !controller.standalone) {
      // A laptop-dependent controller without any host cannot play a set.
      // Do not present a green "preliminary match" to someone buying this rig.
      checks.push({
        type: "error",
        statusLevel: "incompatible",
        title: "Host Computer Required",
        desc: controller.brand + " " + controller.model +
          " is not listed as standalone. Add a compatible computer and DJ software " +
          "before treating this as a playable setup; verify current OS and driver support.",
        fixCableId: null
      });
      fatalErrors++;
    }

    // 3. Headphone Cue Jack Check
    if (controller && headphones) {
      var ctrlJack = controller.headphone_jack || "";
      var hpJack = headphones.jack_type || "";
      var ctrlMini = ctrlJack.indexOf("3.5mm") !== -1;
      var ctrlQuarter = ctrlJack.indexOf('1/4"') !== -1;
      var hpMini = hpJack.indexOf("3.5mm") !== -1;
      var hpQuarter = hpJack.indexOf('1/4"') !== -1;

      // Most catalog headphones have a native 3.5mm plug AND an included
      // 1/4-inch adapter. Never suggest purchasing an unnecessary extra.
      // The generic adapter catalog entry does not specify connector direction.
      if ((ctrlMini && !ctrlQuarter && hpQuarter && !hpMini) ||
          (ctrlQuarter && !ctrlMini && hpMini && !hpQuarter)) {
        var requiredAdapter = ctrlMini
          ? "1/4-inch female to 3.5mm male"
          : "3.5mm female to 1/4-inch male";
        checks.push({
          type: "warning", statusLevel: "workable",
          title: "Headphone Connector Adapter Needed",
          desc: "The listed headphone plug does not fit the controller cue socket directly. Check for an included " +
            requiredAdapter + " adapter or purchase the correct direction separately.",
          fixCableId: null
        });
        warnings++;
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
    if (requiresManualReview) readiness = Math.min(readiness, 50);

    return {
      readiness: Math.max(readiness, 10),
      checks: checks,
      fatalErrors: fatalErrors,
      warnings: warnings,
      requiresManualReview: requiresManualReview
    };
  }

  /* ------------------------------------------- Smart Upgrade Path Advisor */
  function recommendNextUpgrade(compatibility) {
    // An upsell must never distract from an incomplete or manually unverified
    // rig. Compatibility checks are authoritative for the current selection.
    var verdict = compatibility || runDeepCompatibilityChecks();
    if (verdict.fatalErrors > 0 || verdict.requiresManualReview) return null;

    var controllerSlot = currentRig.items.find(function (s) { return s.category === "controllers"; });
    var headphonesSlot = currentRig.items.find(function (s) { return s.category === "headphones"; });
    var speakersSlot = currentRig.items.find(function (s) { return s.category === "speakers"; });
    var laptopSlot = currentRig.items.find(function (s) { return s.category === "laptops"; });
    var standSlot = currentRig.items.find(function (s) { return s.category === "stands"; });
    var storageSlot = currentRig.items.find(function (s) { return s.category === "storage"; });

    var controller = controllerSlot ? getSlotItem(controllerSlot) : null;
    var headphones = headphonesSlot ? getSlotItem(headphonesSlot) : null;
    var speakers = speakersSlot ? getSlotItem(speakersSlot) : null;
    if (!controller) return null;

    function offer(itemId, role, description, targetSlotId) {
      var target = getItem(itemId);
      if (!target || currentRig.items.some(function (slot) { return slot.itemId === itemId; })) return null;
      return {
        role: role,
        targetName: target.brand + " " + target.model + " (Est. $" + target.price.toLocaleString("en-US") + ")",
        desc: description,
        targetId: itemId,
        targetSlotId: targetSlotId
      };
    }

    if (headphones && headphones.price < 100 && controller.price >= 299) {
      var headphonesUpgrade = offer("sennheiser-hd25", "Headphones Upgrade",
        "Consider closed-back DJ headphones with replaceable parts and isolation suited to your venue. Check fit and current price before buying.",
        headphonesSlot.slotId);
      if (headphonesUpgrade) return headphonesUpgrade;
    }

    if (controller.channels === 4 && speakers && speakers.price < 200) {
      // Four mixer channels do NOT imply balanced master outputs. In
      // particular, RCA-only controllers must not be upsold an XLR monitor
      // pair on the unsupported claim that their outputs are balanced.
      var outputs = controller.master_outputs || [];
      var balanced = outputs.some(function (output) {
        return /\bXLR\b/i.test(output) ||
          (/\bTRS\b/i.test(output) && /balanced/i.test(output));
      });
      if (balanced) {
        var monitorsUpgrade = offer("yamaha-hs5", "Studio Monitor Upgrade",
          "This controller lists a balanced output. Compare the monitor inputs, required pair quantity, cabling, room size and live prices before upgrading.",
          speakersSlot.slotId);
        if (monitorsUpgrade) return monitorsUpgrade;
      }
    }

    if (!standSlot && laptopSlot && getSlotItem(laptopSlot).id !== "existing-mobile-device" && !controller.standalone) {
      var standUpgrade = offer("laptop-stand-pyle", "Optional Laptop Stand",
        "A laptop stand may improve visibility and desk space. Check your laptop size and booth clearance before purchasing.",
        "core-stand");
      if (standUpgrade) return standUpgrade;
    }

    // USB media is only a relevant optional purchase for a standalone player.
    // Never claim that a laptop-dependent controller can load DJ sets from USB,
    // or that a particular flash drive guarantees zero-lag playback.
    if (controller.standalone && !storageSlot) {
      return offer("usb-sandisk-extreme", "Optional Performance Media",
        "Check your standalone player's supported USB formats, library export requirements and current drive compatibility before purchasing.",
        "core-storage");
    }

    return null;
  }

  /* ---------------------------------------------------------------- Render */
  function renderApp() {
    var stats = calculateRigStats();
    var viewIds = ["rig-connections", "rig-shopping", "rig-manage"];
    var previousViews = {};
    var hadViews = false;
    viewIds.forEach(function (id) {
      var view = builderRoot.querySelector("#" + id);
      if (view) { hadViews = true; previousViews[id] = view.open; }
    });

    var html = `
      <!-- Builder Top Dashboard -->
      <section class="rig-dashboard-shell">
        <div class="rig-dash-header">
          <div class="rig-dash-left">
            <div class="rig-title-block">
              <span class="hero-eyebrow">DJ Studio Workspace</span>
              <h2 class="rig-main-title" contenteditable="true" data-rig-name title="Click to rename your setup">${escapeHtml(currentRig.name)}</h2>
            </div>
            <!-- Presets Bar -->
            <div class="rig-preset-strip" role="group" aria-label="Preset starting points">
              <span class="preset-label">Presets:</span>
              ${CATALOG.presets.map(function (p) {
                return `<button type="button" class="rig-preset-pill" data-preset-id="${p.id}">
                  <strong>${escapeHtml(p.name)}</strong> <span class="preset-badge">${escapeHtml(presetPriceBadge(p))}</span>
                </button>`;
              }).join("")}
            </div>
          </div>

          <details class="mobile-presets"><summary>Choose preset</summary><div>${CATALOG.presets.map(function(p) { return `<button type="button" class="mobile-preset" data-preset-id="${p.id}">${escapeHtml(p.name)} <span class="preset-badge">${escapeHtml(presetPriceBadge(p))}</span></button>`; }).join('')}</div></details>
          <!-- Immediate Above-The-Fold Spend & Readiness -->
          <div class="rig-quick-spend-strip">
            <div class="quick-spend-card">
              <span class="qsc-label">Estimated to buy</span>
              <strong class="qsc-val metric-val--spend">$${stats.purchaseCost.toLocaleString()}</strong>
              <span class="qsc-sub">${stats.ownedCount > 0 ? "Saved $" + stats.ownedValue.toLocaleString() + " owned" : stats.itemCount + " items in setup"}</span>
            </div>
          </div>
        </div>

        <!-- CENTERPIECE: Visual DJ Booth Studio Layout (Appears FIRST!) -->
        ${renderBooth(stats)}

      </section>

      <!-- Itemized shopping and saved builds share the same rig state. -->
      <details id="rig-shopping" class="rig-secondary"><summary>Shopping list &amp; quantities</summary>
      <section class="rig-table-section" id="rs-shop" aria-labelledby="checklist-title">
        <div class="section-head-split">
          <div>
            <h3 id="checklist-title">Component Breakdown &amp; Shopping List</h3>
            <p>Every piece in your setup with dated 2026 price estimates, quantities, and direct retailer links.</p>
          </div>
          <div class="add-slot-dropdown-wrap">
            <button type="button" class="btn btn-secondary btn-sm" data-action="open-add-slot">+ Add Equipment Slot ▾</button>
            <div class="add-slot-menu" id="add-slot-menu" hidden>
              <button type="button" class="rs-add-chip" data-cat="microphones" data-action="add-new-slot" data-category="microphones">🎤 Add Vocal / Host Microphone</button>
              <button type="button" class="rs-add-chip" data-cat="stands" data-action="add-new-slot" data-category="stands">🏗️ Add DJ Laptop Stand / Riser</button>
              <button type="button" class="rs-add-chip" data-cat="storage" data-action="add-new-slot" data-category="storage">💾 Add USB Media / Flash Drive</button>
              <button type="button" class="rs-add-chip" data-cat="speakers" data-action="add-new-slot" data-category="speakers">🔊 Add Extra Monitor / PA Speaker</button>
              <button type="button" class="rs-add-chip" data-cat="cables" data-action="add-new-slot" data-category="cables">🔌 Add Audio Cable / Adapter</button>
              <button type="button" class="rs-add-chip" data-cat="controllers" data-action="add-new-slot" data-category="controllers">🎛️ Add Second Controller / Deck</button>
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
                <th scope="col">Retailer Actions</th>
              </tr>
            </thead>
            <tbody>
              ${currentRig.items.map(function (slot) {
                return renderModularTableRow(slot);
              }).join("")}

            </tbody>
          </table>
        </div>

        <div class="rs-shop-foot" style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--muted, #94a3b8);">Planning estimates only; check current prices, quantities and availability at the retailer.</div>

        <!-- Commercial Disclosure Notice -->
        <p class="table-note rs-shop-note">
          All figures are planning estimates based on benchmark retail prices, not real-time merchant quotes. Retailer pricing, shipping fees, sales taxes, and inventory change dynamically. Retailer links are handoffs, not confirmations of stock or compatibility. Some links may earn Offbeat a commission at no extra cost to you. <a href="disclosure.html">Read our full affiliate disclosure</a>.
        </p>
      </section>

      </details>
      <details id="rig-manage" class="rig-secondary"><summary>Save, share &amp; compare</summary>
      <section class="rig-manage-dock" id="rig-actions-dock">
        <div class="manage-dock-inner">
          <div class="manage-dock-info">
            <span class="manage-dock-eyebrow">Rig Management &amp; Export</span>
            <h3 class="manage-dock-title">Save, Share &amp; Export Your Setup</h3>
            <p class="manage-dock-desc">Generate shareable links, export markdown checklists for Reddit and Discord communities, or compare this build side-by-side with club benchmarks.</p>
          </div>
          <div class="manage-dock-actions">
            <button type="button" class="btn btn-primary btn-sm" data-action="open-export-modal">📤 Share &amp; Export</button>
            <button type="button" class="btn btn-secondary btn-sm" data-action="copy-checklist">📋 Checklist</button>
            <button type="button" class="btn btn-secondary btn-sm" data-action="save-rig">💾 Save</button>
            <button type="button" class="btn btn-secondary btn-sm" data-action="open-compare">⚖️ Compare</button>
            <button type="button" class="btn btn-sm" data-action="random-rig">🎲 Preset</button>
            <button type="button" class="btn-sfx-toggle ${soundEnabled ? 'is-on' : 'is-muted'}" data-action="toggle-sound" title="Toggle audio feedback sounds">
              ${soundEnabled ? '🔊 Sound: ON' : '🔇 Sound: OFF'}
            </button>
          </div>
        </div>
        ${renderSavedRigsList()}
      </section>

      </details>
      <!-- Modal Container (Dynamically populated) -->
      <div id="rig-modal-container" hidden></div>
    `;

    builderRoot.innerHTML = html;
    viewIds.forEach(function (id) {
      var view = document.getElementById(id);
      if (view) view.open = hadViews ? Boolean(previousViews[id]) :
        (id === "rig-shopping" || (id === "rig-connections" && window.innerWidth > 700));
    });
  }

  function renderCompatibility(stats) {
    // The authored example is an assumption, not a verified physical rig.
    // Only its presentation is neutral; underlying readiness remains strict.
    var introHost = authoredStarterIntro && stats.compatibility.checks.find(function (c) {
      return c.type === "warning" && c.title === "Mobile Host, USB Audio and Power Need Verification";
    });
    var visibleWarnings = stats.compatibility.warnings - (introHost ? 1 : 0);
    return `
      <section class="rig-compat-section" id="rs-compatibility">
        <div class="compat-box">
          <div class="compat-header">
            <h4>⚡ Hardware &amp; Signal Compatibility Assistant</h4>
            <span class="compat-status-tag ${stats.compatibility.fatalErrors === 0 && visibleWarnings === 0 ? (introHost ? 'tag--neutral' : 'tag--ok') : stats.compatibility.fatalErrors > 0 ? 'tag--err' : 'tag--warn'}">
              ${stats.compatibility.fatalErrors === 0 && visibleWarnings === 0 ? (introHost ? 'Planning assumptions — verify host' : 'Preliminary Match') : stats.compatibility.fatalErrors > 0 ? '❌ Incompatible Configuration' : stats.compatibility.requiresManualReview ? '⚠️ Manual Routing Review Required' : '⚠️ Connection Verification Needed'}
            </span>
          </div>
          <div class="compat-items-grid">
            ${stats.compatibility.checks.map(function (c) {
              var shownType = c === introHost ? "info" : c.type;
              return `<div class="compat-item compat-item--${shownType}">
                <div class="compat-icon">${shownType === 'success' ? '✓' : shownType === 'error' ? '❌' : shownType === 'warning' ? '⚠️' : 'ℹ️'}</div>
                <div class="compat-body">
                  <div class="compat-title-row">
                    <strong>${escapeHtml(c.title)}</strong>
                    <span class="compat-level-badge level--${c.statusLevel}">${c.statusLevel === 'verified' ? 'Listed Match' : c.statusLevel === 'incompatible' ? 'Hardware Block' : 'Workable with Note'}</span>
                  </div>
                  <p>${escapeHtml(c.desc)}</p>
                  ${c.fixCableId ? `<button type="button" class="btn-text-action" data-action="auto-fix-cable" data-cable-id="${c.fixCableId}">${escapeHtml(c.fixActionText || 'Auto-select recommended cable →')}</button>` : ''}
                  ${c.fixSlotId && c.fixItemId ? `<button type="button" class="btn-text-action" data-action="auto-fix-slot" data-slot-id="${c.fixSlotId}" data-item-id="${c.fixItemId}">${escapeHtml(c.fixActionText)}</button>` : ''}
                </div>
              </div>`;
            }).join("")}
          </div>
        </div>
      </section>
    `;
  }

  function isSpeakerEligibleForRole(item, role) {
    if (!item || item.category !== "speakers") return false;
    var supported = item.roles_supported;
    if (Array.isArray(supported) && supported.length > 0) {
      return supported.indexOf(role) !== -1;
    }
    if (role === "crowd_pa") {
      return item.id === "jbl-eon-715" || item.is_pa === true;
    }
    if (role === "dj_monitor") {
      return item.id !== "jbl-eon-715" && !item.is_pa;
    }
    return false;
  }

  function isPAItem(item) {
    return isSpeakerEligibleForRole(item, "crowd_pa");
  }

  function getSpeakerRole(slot) {
    if (!slot) return "dj_monitor";
    var item = getItem(slot.itemId);
    if (slot.role === "crowd_pa" && isSpeakerEligibleForRole(item, "crowd_pa")) {
      return "crowd_pa";
    }
    if (slot.role === "dj_monitor" && isSpeakerEligibleForRole(item, "dj_monitor")) {
      return "dj_monitor";
    }
    if (isSpeakerEligibleForRole(item, "crowd_pa")) return "crowd_pa";
    return "dj_monitor";
  }

  function getRigSpeakerSlots() {
    var speakerSlots = currentRig.items.filter(function (s) { return s.category === "speakers"; });
    var paSlot = null;
    var monitorSlot = null;
    var extra = [];

    speakerSlots.forEach(function (slot) {
      var item = getItem(slot.itemId);
      if (!item) return;
      var role = getSpeakerRole(slot);
      if (role === "crowd_pa") {
        if (!paSlot) {
          paSlot = slot;
          paSlot.role = "crowd_pa";
        } else {
          extra.push(slot);
        }
      } else {
        if (!monitorSlot) {
          monitorSlot = slot;
          monitorSlot.role = "dj_monitor";
        } else {
          extra.push(slot);
        }
      }
    });

    return {
      paSlot: paSlot,
      monitorSlot: monitorSlot,
      all: speakerSlots,
      extra: extra
    };
  }

  function isMasterSlavePair(item) {
    if (!item) return false;
    if (item.connection && item.connection.topology === "master_slave") return true;
    return item.id === "pioneer-dm40d" || item.id === "pioneer-dm50d";
  }

  function isRouteCableConfirmed(plan, alreadyAllocated) {
    if (!plan) return false;
    if (plan.conflict || plan.kind === "unresolved") return false;
    if (plan.kind === "included") return true;
    if (plan.kind === "product" && plan.itemId) {
      var matchingCables = currentRig.items.filter(function (s) {
        return s.category === "cables" && s.itemId === plan.itemId;
      });
      var totalUnits = matchingCables.reduce(function (sum, s) {
        return sum + (s.qty || 1);
      }, 0);
      return totalUnits >= (Number(plan.units) || 1) + alreadyAllocated;
    }
    return false;
  }

  // All speaker routes must be independently feasible and supplied. A single
  // cable pack cannot be counted twice when PA and monitors use the same SKU.
  function areAllSpeakerRoutesConfirmed() {
    var speakers = currentRig.items.filter(function (s) { return s.category === "speakers"; });
    if (!speakers.length) return false;
    var routes = computeAllRigConnections();
    if (routes.length !== speakers.length) return false;
    var allocated = Object.create(null);
    return routes.every(function (route) {
      if (!route || route.conflict) return false;
      var used = route.itemId ? (allocated[route.itemId] || 0) : 0;
      if (!isRouteCableConfirmed(route, used)) return false;
      if (route.kind === "product" && route.itemId) {
        allocated[route.itemId] = used + (Number(route.units) || 1);
      }
      return true;
    });
  }

  function findSlot(category) {
    return currentRig.items.find(function (s) { return s.category === category; }) || null;
  }

  function usableProductPhoto(item) {
    var photo = item && item.product_photo;
    return photo && photo.src && photo.source && photo.license && photo.license_url && (photo.attribution || photo.credit) ? photo : null;
  }

  function productPhotoCredit(item) {
    var photo = usableProductPhoto(item);
    if (!photo) return "";
    return `<span class="rig-photo-credit">Photo: <a href="${escapeHtml(photo.source)}" target="_blank" rel="noopener noreferrer">${escapeHtml(photo.attribution || photo.credit)}</a> · <a href="${escapeHtml(photo.license_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(photo.license)}</a>${photo.modification ? ' · modified' : ''}</span>`;
  }

  /* ------------------------------------------------- Interactive DJ Booth (Purpose-Based) */
  // The stage uses the same slots and actions as the detailed editor below.
  function renderVisualEquipment(slot, category, role, label, defaultId, extraClass, routeLabel) {
    var item = slot && getSlotItem(slot);
    var id = slot ? slot.slotId : defaultId;
    var roleAttr = role ? ` data-speaker-role="${role}"` : '';
    var pick = item || !role
      ? `data-action="pick" data-slot-id="${id}" data-category="${category}"${roleAttr}`
      : `data-action="add-speaker-role" data-speaker-role="${role}"`;
    var photo = usableProductPhoto(item);
    var owned = item && (slot.owned || item.no_purchase);
    var count = item && role ? (item.speaker_units || 1) * (slot.qty || 1) : 0;
    return `<div class="visual-equipment ${extraClass || ''}">
      <span class="visual-role">${label}</span>
      ${routeLabel ? `<span class="visual-port-status">${escapeHtml(routeLabel)}</span>` : ''}
      <button type="button" class="visual-pick" ${pick} aria-label="${item ? 'Change ' : 'Add '}${label}">
        ${item ? `<span class="visual-images">${Array.from({length: role && (item.speaker_units || 1) === 1 ? Math.min(count, 8) : 1}, function() { return `<img src="${escapeHtml(photo ? photo.src : item.image)}" ${photo ? `data-photo-fallback="${escapeHtml(item.image)}"` : ''} alt="">`; }).join('')}</span><strong>${escapeHtml(item.model)}</strong><span>${role ? count + (count === 1 ? ' cabinet' : ' cabinets') + ' · ' : ''}Change ↗</span>` : `<span class="visual-add-icon">+</span><strong>Add ${label}</strong><span>Choose equipment ↗</span>`}
      </button>
      ${item && photo ? productPhotoCredit(item) : ''}
      ${item ? `<button type="button" class="visual-own ${owned ? 'is-owned' : ''}" data-action="toggle-slot-owned" data-slot-id="${id}" ${item.no_purchase ? 'disabled' : ''}>${owned ? '✓ Owned' : 'Mark owned'}</button>` : ''}
    </div>`;
  }

  function renderBooth(stats) {
    var controllerSlot = findSlot("controllers") || { slotId: "core-ctrl", category: "controllers", itemId: null };
    var headphonesSlot = findSlot("headphones") || { slotId: "core-hp", category: "headphones", itemId: null };
    var hostSlot = findSlot("laptops") || { slotId: "core-host", category: "laptops", itemId: null };

    var spkGroup = getRigSpeakerSlots();
    var paSlot = spkGroup.paSlot;
    var monitorSlot = spkGroup.monitorSlot;

    var ctrlItem = getSlotItem(controllerSlot);
    var paItem = paSlot ? getSlotItem(paSlot) : null;
    var monItem = monitorSlot ? getSlotItem(monitorSlot) : null;

    var paQty = paSlot ? (paSlot.qty || 1) : 0;
    var monQty = monitorSlot ? (monitorSlot.qty || 1) : 0;

    // Use OffbeatGear for real connection calculations
    var usedOutputs = {};
    var paPlan = null;
    var monitorPlan = null;

    if (ctrlItem && typeof OffbeatGear !== "undefined" && OffbeatGear.connectionPlan) {
      // 1. Crowd PA takes priority for Master Output
      if (paSlot && paItem) {
        paPlan = OffbeatGear.connectionPlan(CATALOG, ctrlItem, paItem, paQty, { usedOutputs: usedOutputs });
        if (paPlan && paPlan.output) {
          usedOutputs[paPlan.output.connector] = (usedOutputs[paPlan.output.connector] || 0) + 1;
          if (!usedOutputs.claimed) usedOutputs.claimed = [];
          usedOutputs.claimed.push(paPlan.output);
        }
      }

      // 2. DJ Monitors take Booth output (or Master output if PA is absent)
      if (monitorSlot && monItem) {
        monitorPlan = OffbeatGear.connectionPlan(CATALOG, ctrlItem, monItem, monQty, { usedOutputs: usedOutputs });
        if (monitorPlan && monitorPlan.output) {
          usedOutputs[monitorPlan.output.connector] = (usedOutputs[monitorPlan.output.connector] || 0) + 1;
          if (!usedOutputs.claimed) usedOutputs.claimed = [];
          usedOutputs.claimed.push(monitorPlan.output);
        }
      }
    }

    var cableSlots = currentRig.items.filter(function (s) { return s.category === "cables"; });
    var primaryCableSlot = cableSlots[0] || { slotId: "core-cable", category: "cables", itemId: null };

    var paCableConfirmed = isRouteCableConfirmed(paPlan, 0);
    var monRouteIndex = (paPlan && paPlan.kind === 'product' && paPlan.itemId && monitorPlan && paPlan.itemId === monitorPlan.itemId) ? (Number(paPlan.units) || 1) : 0;
    var monCableConfirmed = isRouteCableConfirmed(monitorPlan, monRouteIndex);

    function routeLabel(slot, plan, confirmed) {
      if (!slot) return 'Not added';
      if (!plan || plan.conflict || plan.kind === 'unknown' || plan.kind === 'unresolved') return 'Route needs review';
      if (plan.kind === 'allowance') return 'Cable type to confirm';
      if (plan.kind === 'included') return 'Cable included';
      return confirmed ? 'Cable in plan' : 'Cable needed';
    }

    var hasConflict = (monitorPlan && monitorPlan.conflict) || (paPlan && paPlan.conflict);
    var anyCableMissing = (paSlot && paPlan && !paCableConfirmed) || (monitorSlot && monitorPlan && !monCableConfirmed && !monitorPlan.conflict);

    return `
      <section class="rig-booth-section" id="interactive-booth-stage">
        <div class="visual-heading"><div><span class="visual-eyebrow">YOUR SETUP</span><h3>Build your booth</h3></div><p>Choose any piece to change it.</p></div>
        <div class="visual-next"><span class="visual-route ${stats.compatibility.fatalErrors || hasConflict || anyCableMissing ? 'needs-review' : ''}">${hasConflict ? '⚠ Routing limitation' : stats.compatibility.fatalErrors ? '⚠ Incompatible setup — review connections' : anyCableMissing ? '◦ Connections need review' : (paCableConfirmed && monCableConfirmed ? '✓ Two audio routes planned' : (paCableConfirmed || monCableConfirmed ? '✓ One audio route planned' : '◦ Check audio connections'))}</span><button type="button" class="visual-route-link" data-action="inspect-routes">Inspect connections ↓</button></div>
        ${stats.compatibility.fatalErrors ? `<p class="visual-critical" role="alert">${stats.compatibility.checks.filter(function(c) { return c.type === 'error' || c.statusLevel === 'incompatible'; }).map(function(c) { return escapeHtml(c.title); }).join(' · ')}</p>` : ''}
        <div class="visual-stage">
          <svg class="visual-wiring visual-wiring--desktop" viewBox="0 0 1000 300" preserveAspectRatio="none" aria-hidden="true">
            <path class="visual-wire ${monCableConfirmed ? 'is-planned' : ''}" d="M 430 165 C 350 220 270 220 190 165" />
            <path class="visual-wire ${paCableConfirmed ? 'is-planned' : ''}" d="M 570 165 C 650 220 730 220 810 165" />
          </svg>
          ${renderVisualEquipment(monitorSlot, 'speakers', 'dj_monitor', 'DJ monitors', 'core-monitor', 'visual-monitor', routeLabel(monitorSlot, monitorPlan, monCableConfirmed))}
          ${renderVisualEquipment(controllerSlot, 'controllers', '', 'Controller / decks', 'core-ctrl', 'visual-controller')}
          ${renderVisualEquipment(paSlot, 'speakers', 'crowd_pa', 'Crowd PA', 'core-pa', 'visual-pa', routeLabel(paSlot, paPlan, paCableConfirmed))}
          <div class="visual-secondary">
            ${renderVisualEquipment(headphonesSlot, 'headphones', '', 'Headphones', 'core-hp', 'visual-headphones')}
            ${renderVisualEquipment(hostSlot, 'laptops', '', 'Music source', 'core-host', 'visual-host')}
          </div>
        </div>
        <details id="rig-connections" class="rig-secondary booth-details"><summary>Connection details &amp; compatibility</summary>
          ${renderSignalHighwaySection(ctrlItem, paSlot, paPlan, monitorSlot, monitorPlan, primaryCableSlot, paCableConfirmed, monCableConfirmed)}
          ${renderCompatibility(stats)}
        </details>
      </section>
    `;
  }

  function renderSignalHighwaySection(ctrlItem, paSlot, paPlan, monitorSlot, monitorPlan, primaryCableSlot, paCableConfirmed, monCableConfirmed) {
    var paItem = paSlot ? getSlotItem(paSlot) : null;
    var monItem = monitorSlot ? getSlotItem(monitorSlot) : null;

    var activePlan = paPlan || monitorPlan;
    var summaryText = getCableSummaryText(activePlan);

    return `
      <div class="booth-cables-hub" id="signal-highway">
        <div class="cables-hub-header">
          <div class="hub-header-left">
            <span class="hub-tag">Audio Signal Highway</span>
            <h4 class="hub-title">Audio routing diagram</h4>
          </div>
          <div class="hub-header-right">
            <span class="cable-title">${escapeHtml(summaryText)}</span>
          </div>
        </div>

        <div class="cables-routes-grid">
          ${paSlot ? `
            <!-- Crowd PA Route -->
            <div class="cable-route-card cable-route-card--pa ${paPlan ? (paPlan.balanced ? 'route--balanced' : 'route--unbalanced') : ''}">
              <div class="route-role-badge">📢 Crowd PA Route (Dancefloor Audio)</div>
              <div class="route-flow-line">
                <div class="route-node route-node--source">
                  <span class="node-sub">Source Output:</span>
                  <strong class="node-name">${escapeHtml(ctrlItem ? ctrlItem.model : 'Controller')}</strong>
                  <span class="node-port">[${escapeHtml(paPlan && paPlan.output ? paPlan.output.label : 'Output not determined')}]</span>
                </div>

                <div class="route-pipe ${paCableConfirmed ? 'pipe--active' : 'pipe--standby'}">
                  <div class="pipe-track">
                    ${paCableConfirmed ? `<span class="signal-dot signal-dot--forward"></span>` : ''}
                  </div>
                  <div class="pipe-cable-pill ${paCableConfirmed ? 'pipe-cable-pill--verified' : 'pipe-cable-pill--needed'}" ${!paCableConfirmed && paPlan && paPlan.kind === 'product' && paPlan.itemId ? `data-action="auto-fix-cable" data-cable-id="${paPlan.itemId}" title="Click to add required cable to your shopping list"` : `data-action="pick" data-slot-id="core-cable" data-category="cables"`}>
                    <span class="pill-icon">${paCableConfirmed ? '🔌' : '🛒'}</span>
                    <span class="pill-name">${escapeHtml(paPlan ? paPlan.name : 'Audio Cable')}</span>
                    <span class="pill-badge">${paCableConfirmed ? (paPlan && paPlan.kind === 'included' ? '📦 In-Box ($0)' : (paPlan && paPlan.balanced ? 'Balanced Line' : 'Analog Line')) : (paPlan && paPlan.kind === 'product' ? '+ Add cable' : 'Confirm route')}</span>
                  </div>
                </div>

                <div class="route-node route-node--dest">
                  <span class="node-sub">Destination:</span>
                  <strong class="node-name">${escapeHtml(paItem ? paItem.model : 'Crowd PA')}</strong>
                  <span class="node-port">[${escapeHtml(paPlan && paPlan.socket ? OffbeatGear.endpointLabel(paPlan.socket.connector || paPlan.socket) : 'Input not determined')}]</span>
                </div>
              </div>
            </div>
          ` : ''}

          ${monitorSlot ? `
            <!-- DJ Monitors Route -->
            ${monitorPlan && monitorPlan.conflict ? `
              <div class="cable-route-card cable-route-card--conflict">
                <div class="route-role-badge route-role-badge--conflict">⚠️ Hardware routing limitation</div>
                <div class="conflict-content">
                  <div class="conflict-head">
                    <span class="conflict-icon">⚠️</span>
                    <strong>${escapeHtml(ctrlItem ? ctrlItem.model : 'Controller')} cannot feed both Crowd PA and DJ Monitors independently in this plan</strong>
                  </div>
                  <p class="conflict-desc">
                    ${escapeHtml(monitorPlan.note || "This route needs a separate output. Confirm the hardware before buying cables.")}
                  </p>
                  <div class="conflict-solutions">
                    <strong>Ways to explore (check connections first):</strong>
                    <ul>
                      <li>Practice using <strong>Cue Headphones</strong> only when crowd PA is active.</li>
                      <li>Upgrade to a 4-channel controller with dedicated <strong>Booth outputs</strong> (e.g. DDJ-FLX10 or XDJ-AZ).</li>
                      <li>Route master output through an <strong>external DJ mixer</strong> or active audio distribution splitter box (do NOT use passive Y-cables).</li>
                    </ul>
                  </div>
                </div>
              </div>
            ` : `
              <div class="cable-route-card cable-route-card--monitors ${monitorPlan ? (monitorPlan.kind === 'included' ? 'route--included' : (monitorPlan.balanced ? 'route--balanced' : 'route--unbalanced')) : ''}">
                <div class="route-role-badge">🔊 DJ Monitor Route (Personal Booth Sound)</div>
                <div class="route-flow-line">
                  <div class="route-node route-node--source">
                    <span class="node-sub">Source Output:</span>
                    <strong class="node-name">${escapeHtml(ctrlItem ? ctrlItem.model : 'Controller')}</strong>
                    <span class="node-port">[${escapeHtml(monitorPlan && monitorPlan.output ? monitorPlan.output.label : 'Output not determined')}]</span>
                  </div>

                  <div class="route-pipe ${monCableConfirmed ? 'pipe--active' : 'pipe--blocked'}">
                    <div class="pipe-track">
                      ${monCableConfirmed ? `<span class="signal-dot signal-dot--forward"></span>` : ''}
                    </div>
                    <div class="pipe-cable-pill ${monCableConfirmed ? 'pipe-cable-pill--verified' : 'pipe-cable-pill--needed'}" ${!monCableConfirmed && monitorPlan && monitorPlan.kind === 'product' && monitorPlan.itemId ? `data-action="auto-fix-cable" data-cable-id="${monitorPlan.itemId}"` : `data-action="pick" data-slot-id="core-cable" data-category="cables"`}>
                      <span class="pill-icon">🔌</span>
                      <span class="pill-name">${escapeHtml(monitorPlan ? monitorPlan.name : 'Audio Cable')}</span>
                      <span class="pill-badge">${monCableConfirmed ? (monitorPlan && monitorPlan.kind === 'included' ? '📦 In-Box ($0)' : (monitorPlan && monitorPlan.balanced ? 'Balanced Line' : 'Analog Line')) : (monitorPlan && monitorPlan.kind === 'product' ? 'Cable needed' : 'Confirm route')}</span>
                    </div>
                  </div>

                  <div class="route-node route-node--dest">
                    <span class="node-sub">Destination:</span>
                    <strong class="node-name">${escapeHtml(monItem ? monItem.model : 'DJ Monitors')}</strong>
                    <span class="node-port">[${escapeHtml(monitorPlan && monitorPlan.socket ? OffbeatGear.endpointLabel(monitorPlan.socket.connector || monitorPlan.socket) : 'Input not determined')}]</span>
                  </div>
                </div>
              </div>
            `}
          ` : ''}

          ${!paSlot && !monitorSlot ? `
            <div class="cable-route-card cable-route-card--empty">
              <span class="route-empty-text">No speakers currently selected. Add Crowd PA or DJ Monitors to plan required audio cables.</span>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  function renderModularTableRow(slot) {
    var item = getSlotItem(slot);
    var isOwned = Boolean(slot.owned) || Boolean(item && item.no_purchase === true);
    var catMeta = CATALOG.categories.find(function (c) { return c.id === slot.category; });
    var qty = slot.qty || 1;

    if (!item) {
      return `
        <tr class="rig-row rig-row--empty rs-shop-line">
          <td><span class="cat-pill">${slot.category === "speakers" ? (getSpeakerRole(slot) === "crowd_pa" ? "📢 Crowd-Facing PA" : "🔊 DJ-Facing Monitors") : ((catMeta ? catMeta.icon : "") + " " + (catMeta ? catMeta.name : slot.category))}</span></td>
          <td colspan="4"><span class="empty-slot-msg">No item selected</span></td>
          <td><button type="button" class="btn btn-sm" data-action="pick" data-slot-id="${slot.slotId}" data-category="${slot.category}">Select Component</button></td>
        </tr>
      `;
    }

    var linePrice = item.price * qty;
    var isPlatformPlaceholder = item.no_purchase === true || item.id === "standalone-usb-only";
    var dests = (typeof OffbeatGear !== "undefined" && OffbeatGear.itemRetailerDestinations)
      ? OffbeatGear.itemRetailerDestinations(item)
      : null;
    var zzoundsUrl = (dests && dests.zzounds && dests.zzounds.url)
      ? dests.zzounds.url
      : "https://www.zzounds.com/prodsearch?q=" + encodeURIComponent(item.brand + " " + item.model);
    var zzSku = (dests && dests.zzounds && dests.zzounds.sku) ? dests.zzounds.sku : "";
    var zzStatus = "unknown";
    var zzType = (dests && dests.zzounds && dests.zzounds.type) ? dests.zzounds.type : (zzSku ? "exact" : "search_fallback");

    var amazonUrl = "https://www.amazon.com/s?k=" + encodeURIComponent(item.amazon_search || (item.brand + " " + item.model));
    var sweetwaterUrl = "https://www.sweetwater.com/store/search?s=" + encodeURIComponent(item.brand + " " + item.model);
    var reverbUrl = "https://reverb.com/marketplace?query=" + encodeURIComponent(item.brand + " " + item.model);

    var isCore = ["controllers", "headphones", "speakers", "laptops"].indexOf(slot.category) !== -1 && slot.slotId.indexOf("core-") === 0;

    var cableProvenanceTag = "";
    if (slot.category === "cables") {
      var ctrl = findSlot("controllers"), spk = findSlot("speakers");
      var cItem = ctrl ? getSlotItem(ctrl) : null;
      var sItem = spk ? getSlotItem(spk) : null;
      var pPlan = (cItem && sItem && typeof OffbeatGear !== "undefined" && OffbeatGear.connectionPlan)
        ? OffbeatGear.connectionPlan(CATALOG, cItem, sItem, (spk ? spk.qty : 1) || 1)
        : null;

      var isBoxCovered = pPlan && pPlan.kind === "included";
      var isExactRequired = pPlan && pPlan.kind === "product" && pPlan.itemId === slot.itemId;
      var isAllowance = pPlan && pPlan.kind === "allowance" && pPlan.itemId === slot.itemId;

      if (isExactRequired) {
        if (pPlan.balanced) {
          cableProvenanceTag = '<span class="cable-provenance-tag prov--matched">⚡ Required Balanced Cable (' + (pPlan.units || 1) + ' units)</span>';
        } else {
          cableProvenanceTag = '<span class="cable-provenance-tag prov--unbalanced">🔌 Required Analog Audio Lead</span>';
        }
      } else if (isAllowance) {
        cableProvenanceTag = '<span class="cable-provenance-tag prov--unbalanced">⚠️ Route Allowance (Adapter Required)</span>';
      } else if (isBoxCovered) {
        cableProvenanceTag = '<span class="cable-provenance-tag prov--unbalanced">🛒 Extra Audio Cable (Speaker Box Already Supplies Lead)</span>';
      } else if (item.balanced || /xlr|trs/i.test(item.model)) {
        cableProvenanceTag = '<span class="cable-provenance-tag prov--matched">⚡ Balanced Audio Lead</span>';
      } else {
        cableProvenanceTag = '<span class="cable-provenance-tag prov--unbalanced">🔌 Analog Audio Lead</span>';
      }
    }

    var packagingHtml = "";
    if (item.id === "pioneer-dm40d") {
      packagingHtml = '<span class="unit-pack-note rs-shop-line-packaging">Sold as complete pair in one retail box · Includes speaker audio cable</span>';
    } else if (item.id === "yamaha-hs5") {
      packagingHtml = '<span class="unit-pack-note rs-shop-line-packaging">Sold individually · Need 2 units for stereo pair</span>';
    } else if (item.id === "jbl-eon-715") {
      packagingHtml = '<span class="unit-pack-note rs-shop-line-packaging">Sold as single powered PA cabinet</span>';
    } else if (item.category === "speakers" && item.speaker_units === 1) {
      packagingHtml = '<span class="unit-pack-note rs-shop-line-packaging">Sold individually (1 cabinet) · Order 2 units for stereo pair</span>';
    } else if (item.pack_note) {
      packagingHtml = '<span class="unit-pack-note rs-shop-line-packaging">' + escapeHtml(item.pack_note) + '</span>';
    }

    var stockAlertHtml = "";
    if (item.id === "denon-prime-4-plus" || (dests && dests.zzounds && dests.zzounds.status === "verified_unavailable")) {
      stockAlertHtml = '<span class="stock-alert rs-shop-line-stock" style="display:block; color:#f87171; font-size:0.8rem; margin-top:0.25rem;">Availability may have changed. Check the retailer before ordering.</span>';
    }

    return `
      <tr class="rig-row rs-shop-line rs-item ${isOwned ? 'rig-row--owned' : ''}">
        <td class="cell-cat">
          <span class="cat-pill">${catMeta ? catMeta.icon : ''} ${catMeta ? catMeta.name : slot.category}</span>
        </td>
        <td class="cell-item">
          <div class="item-summary-box">
            <img src="${item.image}" alt="${escapeHtml(item.model)}" class="table-thumb" loading="lazy">
            <div class="item-summary-copy">
              <div class="item-title-row rs-shop-line-name">
                <strong class="item-full-name">${escapeHtml(item.brand)} ${escapeHtml(item.model)}</strong>
                <button type="button" class="btn-item-info" data-action="inspect-item" data-item-id="${item.id}">Specs</button>
              </div>
              <p class="item-tagline">${escapeHtml(item.tagline || item.ideal_for || '')}</p>
              ${cableProvenanceTag}
              ${packagingHtml}
              ${stockAlertHtml}
              ${item.slug ? `<a href="${item.slug}" class="item-guide-link">Read Offbeat Guide →</a>` : ''}
            </div>
          </div>
        </td>
        <td class="cell-qty">
          <div class="qty-stepper-wrap">
            <button type="button" class="qty-step-btn" data-action="step-qty" data-slot-id="${slot.slotId}" data-step="-1" aria-label="Decrease quantity" ${qty <= 1 || isPlatformPlaceholder ? 'disabled' : ''}>-</button>
            <span class="qty-display">${qty}</span>
            <button type="button" class="qty-step-btn" data-action="step-qty" data-slot-id="${slot.slotId}" data-step="1" aria-label="Increase quantity" ${qty >= 4 || isPlatformPlaceholder ? 'disabled' : ''}>+</button>
          </div>
        </td>
        <td class="cell-status">
          <button type="button" class="status-btn rs-own-toggle ${isOwned ? 'status-btn--owned' : 'status-btn--needed'}" data-action="toggle-slot-owned" data-slot-id="${slot.slotId}" ${isPlatformPlaceholder ? 'disabled aria-disabled="true"' : ''}>
            ${item.id === "existing-mobile-device" ? "Existing phone/tablet (verify)" : isPlatformPlaceholder ? "No laptop purchase" : (isOwned ? "✓ Already Owned" : "🛒 Need to Buy")}
          </button>
        </td>
        <td class="cell-price">
          <span class="price-figure rs-shop-line-price ${isOwned ? 'price--owned' : ''}">
            ${isOwned ? '<s>$' + linePrice + '</s>' : '$' + linePrice}
          </span>
          ${isOwned ? '<span class="owned-sub">($0 out of pocket)</span>' : (qty > 1 ? '<span class="unit-sub">($' + item.price + ' ea)</span>' : '')}
        </td>
        <td class="cell-actions">
          <div class="retail-btn-stack">
            <button type="button" class="btn-swap-inline" data-action="pick" data-slot-id="${slot.slotId}" data-category="${slot.category}" ${slot.category === 'speakers' ? `data-speaker-role="${getSpeakerRole(slot)}"` : ''}>Swap</button>
            ${isPlatformPlaceholder ? '<span class="owned-sub">' + (item.id === "existing-mobile-device" ? 'Existing phone/tablet — verify compatibility and power' : 'Setup mode — no hardware purchase') + '</span>' : `
            <a href="${zzoundsUrl}" target="_blank" rel="nofollow noopener sponsored" class="btn-retail btn-retail--zz" data-destination-type="${zzType}" data-status="${zzStatus}" data-sku="${zzSku}" title="Check on zZounds">zZounds</a>
            ${item.id === "denon-prime-4-plus" ? `
            <a href="https://www.zzounds.com/item--DENPRIME4G2" target="_blank" rel="nofollow noopener sponsored" class="btn-retail btn-retail--alt" data-destination-type="exact" data-status="unknown" data-sku="DENPRIME4G2" title="Check PRIME 4 G2 at zZounds">Check alternative: PRIME 4 G2</a>
            ` : ''}
            <a href="${amazonUrl}" target="_blank" rel="nofollow noopener sponsored" class="btn-retail btn-retail--amz" title="Search model on Amazon">Amazon</a>
            <a href="${sweetwaterUrl}" target="_blank" rel="nofollow noopener" class="btn-retail btn-retail--sw" title="Search Sweetwater">Sweetwater</a>
            <a href="${reverbUrl}" target="_blank" rel="nofollow noopener" class="btn-retail btn-retail--rev" title="Find used offers on Reverb">Reverb</a>
            `}
            ${!isCore ? `<button type="button" class="btn-del-slot" data-action="remove-slot" data-slot-id="${slot.slotId}" title="Remove this component">✕</button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }

  function getCableSummaryText(primaryPlan) {
    var cables = currentRig.items.filter(function (s) { return s.category === "cables"; });
    if (cables.length === 0) {
      if (primaryPlan && primaryPlan.kind === "included") {
        return "Speaker Package Includes Audio Cable";
      }
      var controllerSlot = findSlot("controllers"), speakerSlot = findSlot("speakers");
            return "No Audio Cables Selected";
    }
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
                  <span>$${r.totalCost || 0} (${escapeHtml(r.date || 'Saved')})</span>
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
  function openPickerModal(slotId, category, speakerRole) {
    activeModalSlotId = slotId;
    activeModalCategory = category;

    var targetSlot = currentRig.items.find(function (s) { return s.slotId === slotId; });
    var inferredRole = speakerRole || (targetSlot ? targetSlot.role : null);
    if (!inferredRole && category === "speakers") {
      inferredRole = (slotId && slotId.indexOf("crowd") !== -1) ? "crowd_pa" : "dj_monitor";
    }
    activeModalSpeakerRole = inferredRole;

    var catMeta = CATALOG.categories.find(function (c) { return c.id === category; });
    var items = CATALOG.items.filter(function (i) { return i.category === category; });

    // Strict eligibility gating: filter out ineligible components per role
    if (category === "speakers" && activeModalSpeakerRole) {
      items = items.filter(function (i) {
        return isSpeakerEligibleForRole(i, activeModalSpeakerRole);
      });
    }

    var currentItemId = targetSlot ? targetSlot.itemId : null;

    var modalTitle = catMeta ? catMeta.name : 'Component';
    var modalEyebrow = (catMeta ? catMeta.icon : '') + ' Component Selector';
    if (category === "speakers") {
      if (activeModalSpeakerRole === "crowd_pa") {
        modalTitle = "Crowd-Facing PA Speakers";
        modalEyebrow = "📢 Audience & Front-of-House Sound";
      } else if (activeModalSpeakerRole === "dj_monitor") {
        modalTitle = "DJ-Facing Booth Monitors";
        modalEyebrow = "🔊 Nearfield Mix Reference";
      }
    }

    var modalHtml = `
      <div class="picker-backdrop" data-action="close-modal">
        <div class="picker-dialog" role="dialog" aria-modal="true" aria-labelledby="picker-modal-title">
          <div class="picker-header">
            <div>
              <span class="picker-eyebrow">${modalEyebrow}</span>
              <h3 id="picker-modal-title">Select ${modalTitle}</h3>
            </div>
            <button type="button" class="picker-close" data-action="close-modal" aria-label="Close dialog">✕</button>
          </div>

          <div class="picker-search-bar">
            <input type="search" aria-label="Search equipment" placeholder="Search by brand, model or feature" data-modal-search autocomplete="off">
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
      var photo = usableProductPhoto(item);
      return `
        <article class="picker-card ${isCurrent ? 'is-selected' : ''}" data-action="select-item" data-item-id="${item.id}" data-drawer-use="${item.id}">
          <div class="picker-card-img-wrap">
            <img src="${escapeHtml(photo ? photo.src : item.image)}" ${photo ? `data-photo-fallback="${escapeHtml(item.image)}"` : ''} alt="${escapeHtml(item.model)}" class="picker-card-img" loading="lazy">
            <span class="picker-price-badge">$${item.price}</span>
            <span class="picker-provenance-tag">${photo ? 'Photo' : 'Vector Schematic'}</span>
          </div>
          <div class="picker-card-body">
            <span class="picker-card-brand">${escapeHtml(item.brand)}</span>
            <h4 class="picker-card-title">${escapeHtml(item.model)}</h4>
            <p class="picker-card-tagline">${escapeHtml(item.tagline || item.ideal_for || '')}</p>
            ${photo ? productPhotoCredit(item) : ''}
            <div class="picker-specs-list">
              ${item.channels ? `<span>${item.channels} Channels</span>` : ''}
              ${item.master_outputs ? `<span>Outputs: ${item.master_outputs.join(", ")}</span>` : ''}
              ${item.inputs ? `<span>Inputs: ${item.inputs.join(", ")}</span>` : ''}
              ${item.software_unlocks ? `<span>Unlocks: ${item.software_unlocks.join(", ")}</span>` : ''}
            </div>
          </div>
          <div class="picker-card-footer">
            <button type="button" class="btn ${isCurrent ? 'btn-secondary' : ''} btn-sm btn-select-item" data-action="select-item" data-item-id="${item.id}" data-drawer-use="${item.id}">
              ${isCurrent ? '✓ In Your Rig' : 'Select for Rig'}
            </button>
            <button type="button" class="picker-inspect-btn" data-action="inspect-item" data-item-id="${item.id}">Specs ℹ️</button>
          </div>
        </article>
      `;
    }).join("");
  }

  function openInspectorModal(itemId) {
    var item = getItem(itemId);
    if (!item) return;

    var modalHtml = `
      <div class="picker-backdrop" data-action="close-modal">
        <div class="picker-dialog picker-dialog--inspector" role="dialog" aria-modal="true" aria-labelledby="inspector-title">
          <div class="picker-header">
            <div>
              <span class="picker-eyebrow">${escapeHtml(item.brand)} Detailed Specifications</span>
              <h3 id="inspector-title">${escapeHtml(item.model)}</h3>
            </div>
            <button type="button" class="picker-close" data-action="close-modal" aria-label="Close dialog">✕</button>
          </div>

          <div class="inspector-content">
            <div class="inspector-visual-col">
              <img src="${item.image}" alt="${escapeHtml(item.model)}" class="inspector-hero-img">
              <p class="inspector-provenance-note">${escapeHtml(item.provenance || 'Offbeat Illustrated Spec Guide (2026)')}</p>
            </div>
            <div class="inspector-info-col">
              <div class="inspector-price-row">
                <span class="inspector-price">$${item.price}</span>
                <span class="inspector-price-sub">Est. US Retail (Late 2026)</span>
              </div>
              <p class="inspector-summary">${escapeHtml(item.tagline || '')}</p>
              
              <div class="inspector-specs-table">
                ${item.channels ? `<div class="insp-row"><span>Audio Channels:</span><strong>${item.channels} Decks</strong></div>` : ''}
                ${item.master_outputs ? `<div class="insp-row"><span>Master Outputs:</span><strong>${item.master_outputs.join(", ")}</strong></div>` : ''}
                ${item.inputs ? `<div class="insp-row"><span>Audio Inputs:</span><strong>${item.inputs.join(", ")}</strong></div>` : ''}
                ${item.headphone_jack ? `<div class="insp-row"><span>Headphone Jack:</span><strong>${item.headphone_jack}</strong></div>` : ''}
                ${item.software_unlocks ? `<div class="insp-row"><span>Software Unlocks:</span><strong>${item.software_unlocks.join(", ")}</strong></div>` : ''}
                ${item.driver_mm ? `<div class="insp-row"><span>Driver Size:</span><strong>${item.driver_mm} mm</strong></div>` : ''}
                ${item.impedance_ohm ? `<div class="insp-row"><span>Impedance:</span><strong>${item.impedance_ohm} Ω</strong></div>` : ''}
                ${item.driver_size ? `<div class="insp-row"><span>Woofer / Driver:</span><strong>${item.driver_size}</strong></div>` : ''}
                <div class="insp-row"><span>Ideal For:</span><strong>${escapeHtml(item.ideal_for || 'DJ Practice')}</strong></div>
              </div>

              ${item.slug ? `<div class="inspector-actions"><a href="${item.slug}" class="btn btn-secondary btn-sm" target="_blank">Read Full In-Depth Review ↗</a></div>` : ''}
            </div>
          </div>
        </div>
      </div>
    `;

    var container = document.getElementById("rig-modal-container");
    container.innerHTML = modalHtml;
    container.hidden = false;
    document.body.classList.add("modal-open");
  }

  function openExportModal() {
    var stats = calculateRigStats();
    var shareUrl = window.location.href;

    var redditMarkdown = `**[${currentRig.name}](${shareUrl})**\n\n` +
      `| Category | Equipment | Price |\n` +
      `| :--- | :--- | :--- |\n` +
      currentRig.items.map(function (s) {
        var it = getSlotItem(s);
        if (!it) return "";
        var status = s.owned ? "*(Already Owned)*" : "";
        return `| **${s.category.toUpperCase()}** | ${it.brand} ${it.model} ${status} | $${it.price * (s.qty || 1)} |`;
      }).filter(Boolean).join("\n") +
      `\n\n* **Total Rig Valuation:** $${stats.totalValue.toLocaleString()}\n` +
      `* **Owned Gear Savings:** -$${stats.ownedValue.toLocaleString()}\n` +
      `* **Actual Out-of-Pocket Spend:** **$${stats.purchaseCost.toLocaleString()}**\n\n` +
      `*Generated with [Offbeat DJ Rig Architect](${shareUrl})*`;

    var modalHtml = `
      <div class="picker-backdrop" data-action="close-modal">
        <div class="picker-dialog picker-dialog--export" role="dialog" aria-modal="true" aria-labelledby="export-modal-title">
          <div class="picker-header">
            <div>
              <span class="picker-eyebrow">Export &amp; Share DJ Setup</span>
              <h3 id="export-modal-title">Share Your Custom Build</h3>
            </div>
            <button type="button" class="picker-close" data-action="close-modal" aria-label="Close dialog">✕</button>
          </div>

          <div class="export-modal-tabs">
            <button type="button" class="export-tab is-active" data-export-tab="reddit">Reddit / Discord Markdown</button>
            <button type="button" class="export-tab" data-export-tab="link">Shareable URL Link</button>
            <button type="button" class="export-tab" data-export-tab="image">Download Summary Card</button>
          </div>

          <div class="export-tab-pane is-active" id="pane-reddit">
            <p class="export-help">Copy this formatted markdown table to post on r/DJs, r/Beatmatch, or Discord asking for setup feedback:</p>
            <textarea class="export-textarea" id="reddit-export-box" readonly>${escapeHtml(redditMarkdown)}</textarea>
            <div class="export-pane-footer">
              <button type="button" class="btn btn-secondary btn-sm" data-action="copy-reddit-md">📋 Copy Reddit Markdown</button>
            </div>
          </div>

          <div class="export-tab-pane" id="pane-link" hidden>
            <p class="export-help">Direct link to load your exact equipment and ownership selections:</p>
            <input type="text" class="export-input-url" id="link-export-box" value="${escapeHtml(shareUrl)}" readonly>
            <div class="export-pane-footer">
              <button type="button" class="btn btn-secondary btn-sm" data-action="copy-share-url">🔗 Copy Link to Clipboard</button>
            </div>
          </div>

          <div class="export-tab-pane" id="pane-image" hidden>
            <p class="export-help">Generate a graphic summary card to save or post to Instagram / Discord:</p>
            <div class="canvas-preview-wrap">
              <canvas id="rig-export-canvas" width="800" height="480" class="rig-card-canvas"></canvas>
            </div>
            <div class="export-pane-footer">
              <button type="button" class="btn btn-sm" data-action="download-canvas-image">🖼️ Download Rig Image (.PNG)</button>
            </div>
          </div>
        </div>
      </div>
    `;

    var container = document.getElementById("rig-modal-container");
    container.innerHTML = modalHtml;
    container.hidden = false;
    document.body.classList.add("modal-open");

    var tabs = container.querySelectorAll(".export-tab");
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        tabs.forEach(function (t) { t.classList.remove("is-active"); });
        tab.classList.add("is-active");
        var target = tab.getAttribute("data-export-tab");
        container.querySelectorAll(".export-tab-pane").forEach(function (p) { p.hidden = true; });
        var targetPane = container.querySelector("#pane-" + target);
        if (targetPane) targetPane.hidden = false;
        if (target === "image") drawRigCanvas();
      });
    });
  }

  function drawRigCanvas() {
    var canvas = document.getElementById("rig-export-canvas");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    var stats = calculateRigStats();

    // Background Gradient
    var bgGrad = ctx.createLinearGradient(0, 0, 800, 480);
    bgGrad.addColorStop(0, "#0c0b14");
    bgGrad.addColorStop(0.6, "#141224");
    bgGrad.addColorStop(1, "#07070c");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 800, 480);

    // Accent Border
    ctx.strokeStyle = "rgba(139, 92, 246, 0.4)";
    ctx.lineWidth = 4;
    ctx.strokeRect(12, 12, 776, 456);

    // Header Glow
    ctx.fillStyle = "#a78bfa";
    ctx.font = "bold 14px 'Syne', system-ui, sans-serif";
    ctx.fillText("OFFBEAT. MY DJ RIG ARCHITECT (2026)", 36, 50);

    // Title
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px 'Syne', system-ui, sans-serif";
    ctx.fillText(currentRig.name, 36, 88);

    // Price Badges
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 18px system-ui, sans-serif";
    ctx.fillText("Spend: $" + stats.purchaseCost.toLocaleString(), 36, 122);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillText("(Valuation: $" + stats.totalValue.toLocaleString() + " · Saved: -$" + stats.ownedValue.toLocaleString() + ")", 210, 122);

    // Separator line
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(36, 142);
    ctx.lineTo(764, 142);
    ctx.stroke();

    // Gear List Grid
    var yPos = 176;
    currentRig.items.forEach(function (slot, idx) {
      var it = getSlotItem(slot);
      if (!it || idx > 5) return;

      var col = idx < 3 ? 36 : 410;
      var rowY = yPos + (idx % 3) * 80;

      // Role tag
      ctx.fillStyle = "#a78bfa";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.fillText(slot.category.toUpperCase(), col, rowY);

      // Model name
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px system-ui, sans-serif";
      ctx.fillText(it.brand + " " + it.model, col, rowY + 22);

      // Price & status
      ctx.fillStyle = slot.owned ? "#4ade80" : "#cbd5e1";
      ctx.font = "13px system-ui, sans-serif";
      ctx.fillText((slot.owned ? "✓ Owned ($0 out of pocket)" : "$" + (it.price * (slot.qty || 1))), col, rowY + 42);
    });

    // Watermark Footer
    ctx.fillStyle = "#64748b";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText("offbeatinc.com/build-your-dj-setup.html", 36, 442);
  }

  function downloadCanvasImage() {
    var canvas = document.getElementById("rig-export-canvas");
    if (!canvas) return;
    var link = document.createElement("a");
    link.download = currentRig.name.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-rig.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
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

    allRigsToCompare.push({ name: currentRig.name + " (Current)", items: currentRig.items });

    CATALOG.presets.forEach(function (p) {
      allRigsToCompare.push({ name: p.name + " (" + p.badge + ")", items: convertPresetToItems(p) });
    });

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

  // Price each preset from its actual catalog slots. Static marketing badges
  // previously understated complete shopping totals by hundreds of dollars.
  function presetPriceBadge(preset) {
    return "Est. $" + calculateCustomRigValuation(convertPresetToItems(preset)).toLocaleString("en-US") + " total";
  }

  function convertPresetToItems(preset) {
    var items = [];
    Object.keys(preset.slots).forEach(function (cat) {
      var itId = preset.slots[cat];
      var it = getItem(itId);
      var role = cat === "speakers" ? (isPAItem(it) ? "crowd_pa" : "dj_monitor") : undefined;
      items.push({
        slotId: "p-" + cat,
        category: cat,
        role: role,
        itemId: itId,
        qty: 1,
        owned: itId === "existing-mobile-device"
      });
    });
    return items;
  }

  function renderCompareGridContent(rigA, rigB) {
    var valA = calculateCustomRigValuation(rigA.items);
    var valB = calculateCustomRigValuation(rigB.items);
    var ownedA = calculateCustomRigValuation(rigA.items.filter(function (s) { return s.owned; }));
    var ownedB = calculateCustomRigValuation(rigB.items.filter(function (s) { return s.owned; }));

    return `
      <div class="compare-rig-card">
        <h4>${escapeHtml(rigA.name)}</h4>
        <div class="compare-price-tag">To buy: $${(valA - ownedA).toLocaleString()}</div>
        <div class="metric-sub">Full value: $${valA.toLocaleString()} · Already owned: $${ownedA.toLocaleString()}</div>
        <div class="compare-specs-table">
          ${CATALOG.categories.map(function (cat) {
            var summary = getCategorySummary(rigA.items, cat.id);
            return `<div class="compare-spec-row">
              <span class="spec-cat-label">${cat.name}:</span>
              <strong>${summary}</strong>
            </div>`;
          }).join("")}
        </div>
      </div>

      <div class="compare-rig-card">
        <h4>${escapeHtml(rigB.name)}</h4>
        <div class="compare-price-tag">To buy: $${(valB - ownedB).toLocaleString()}</div>
        <div class="metric-sub">Full value: $${valB.toLocaleString()} · Already owned: $${ownedB.toLocaleString()}</div>
        <div class="compare-specs-table">
          ${CATALOG.categories.map(function (cat) {
            var summary = getCategorySummary(rigB.items, cat.id);
            return `<div class="compare-spec-row">
              <span class="spec-cat-label">${cat.name}:</span>
              <strong>${summary}</strong>
            </div>`;
          }).join("")}
        </div>
      </div>
    `;
  }

  // Compare every selected device, quantity and ownership flag. Showing only
  // the first device per category and a single-unit price misleads buyers.
  function getCategorySummary(items, category) {
    var selected = items.filter(function (slot) { return slot.category === category; });
    if (!selected.length) return "None";
    return selected.map(function (slot) {
      var item = getItem(slot.itemId);
      if (!item) return "";
      var qty = slot.qty || 1;
      return escapeHtml(item.brand + " " + item.model) +
        " (×" + qty + ", " + (slot.owned ? "Owned" : "Buy") +
        ", $" + (item.price * qty).toLocaleString("en-US") + ")";
    }).filter(Boolean).join("<br>");
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
    document.addEventListener("error", function (e) {
      var image = e.target;
      if (image && image.dataset && image.dataset.photoFallback) {
        image.src = image.dataset.photoFallback;
        delete image.dataset.photoFallback;
      }
    }, true);
    document.addEventListener("click", function (e) {
      if (e.target.closest(".rig-photo-credit a")) return;
      // 1. Modal backdrop close
      if (e.target.classList.contains("picker-backdrop")) {
        closeModal();
        return;
      }

      // 2. Button / Card actions
      var btn = e.target.closest("[data-action]") || e.target.closest(".btn-select-item") || e.target.closest(".picker-close");
      if (!btn) return;
      // Dialog contents without their own action (such as export tabs and inputs)
      // must not inherit the backdrop's close action.
      if (btn.classList.contains("picker-backdrop") && e.target !== btn) return;

      var action = btn.getAttribute("data-action");

      // Handle item selection from modal (both button click and card click)
      if (action === "select-item" || btn.classList.contains("btn-select-item") || btn.classList.contains("picker-card")) {
        var itemId = btn.getAttribute("data-item-id");
        if (activeModalSlotId && itemId) {
          var targetSlot = currentRig.items.find(function (s) { return s.slotId === activeModalSlotId; });
          var pickedItem = getItem(itemId);
          var role = activeModalSpeakerRole || (activeModalCategory === "speakers" ? (targetSlot && targetSlot.role ? targetSlot.role : (isPAItem(pickedItem) ? "crowd_pa" : "dj_monitor")) : undefined);

          // Hard role safety guard: refuse ineligible speaker selection
          if (activeModalCategory === "speakers" && role) {
            if (!isSpeakerEligibleForRole(pickedItem, role)) {
              alert("⚠️ Incompatible Component: " + (pickedItem ? pickedItem.model : "Selected speaker") + " cannot be used as " + (role === "crowd_pa" ? "a crowd-facing PA speaker" : "a DJ booth monitor") + ".\n\nNearfield studio reference monitors lack the acoustic dispersion and headroom required for live sound reinforcement, while PA loudspeakers are too large and directional for nearfield booth reference.");
              return;
            }
          }

          if (targetSlot) {
            if (!replaceSlotItem(targetSlot, itemId)) return;
            if (role) targetSlot.role = role;
          } else {
            currentRig.items.push({
              slotId: activeModalSlotId,
              category: activeModalCategory,
              role: role,
              itemId: itemId,
              qty: (pickedItem && pickedItem.id === "yamaha-hs5") ? 1 : 1,
              owned: false
            });
          }
          activeModalSpeakerRole = null;
          playClickSfx("select");
          closeModal();
          saveActiveState();
          renderApp();
        }
        return;
      }

      if (action === "inspect-routes") {
        var stage = btn.closest(".rig-booth-section");
        stage.querySelector("#rig-connections").open = true;
        stage.querySelector("#rig-connections").scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      if (action === "add-speaker-role") {
        var speakerRole = btn.getAttribute("data-speaker-role") || "dj_monitor";
        var menuElem = document.getElementById("add-slot-menu");
        if (menuElem) menuElem.hidden = true;
        var newSlotId = speakerRole === "crowd_pa" ? "slot-crowd-pa" : "slot-dj-monitors";
        openPickerModal(newSlotId, "speakers", speakerRole);
        return;
      }

      if (action === "adjust-qty") {
        var qtySlotId = btn.getAttribute("data-slot-id");
        var delta = parseInt(btn.getAttribute("data-delta"), 10) || 0;
        var targetQtySlot = currentRig.items.find(function (s) { return s.slotId === qtySlotId; });
        if (targetQtySlot) {
          var currentQty = targetQtySlot.qty || 1;
          var newQty = Math.max(1, Math.min(8, currentQty + delta));
          targetQtySlot.qty = newQty;
          playClickSfx("toggle");
          saveActiveState();
          renderApp();
        }
        return;
      }

      if (action === "step-qty") {
        var stepSlotId = btn.getAttribute("data-slot-id");
        var stepVal = parseInt(btn.getAttribute("data-step"), 10) || 1;
        var sToStep = currentRig.items.find(function (s) { return s.slotId === stepSlotId; });
        if (sToStep) {
          var newQ = (sToStep.qty || 1) + stepVal;
          if (newQ >= 1 && newQ <= 4) {
            sToStep.qty = newQ;
            playClickSfx("toggle");
            saveActiveState();
            renderApp();
          }
        }
      } else if (action === "toggle-sound") {
        soundEnabled = !soundEnabled;
        safeStorageSet("offbeat.rig.sfx", soundEnabled ? "on" : "muted");
        if (soundEnabled) playClickSfx("toggle");
        renderApp();
      } else if (action === "open-export-modal") {
        openExportModal();
      } else if (action === "copy-reddit-md") {
        var redBox = document.getElementById("reddit-export-box");
        if (redBox) {
          navigator.clipboard.writeText(redBox.value).then(function () {
            alert("✓ Reddit Markdown copied to clipboard!");
          });
        }
      } else if (action === "copy-share-url") {
        var linkBox = document.getElementById("link-export-box");
        if (linkBox) {
          navigator.clipboard.writeText(linkBox.value).then(function () {
            alert("✓ Shareable link copied to clipboard!");
          });
        }
      } else if (action === "download-canvas-image") {
        downloadCanvasImage();
      } else if (action === "pick") {
        var slotId = btn.getAttribute("data-slot-id");
        var category = btn.getAttribute("data-category");
        var speakerRole = btn.getAttribute("data-speaker-role") || (category === "speakers" ? (slotId === "slot-crowd-pa" ? "crowd_pa" : "dj_monitor") : null);
        if (slotId && category) openPickerModal(slotId, category, speakerRole);
      } else if (action === "inspect-item") {
        var inspId = btn.getAttribute("data-item-id");
        if (inspId) openInspectorModal(inspId);
      } else if (action === "close-modal" || btn.classList.contains("picker-close")) {
        closeModal();
      } else if (action === "toggle-slot-owned") {
        var tSlotId = btn.getAttribute("data-slot-id");
        var slotToToggle = currentRig.items.find(function (s) { return s.slotId === tSlotId; });
        if (slotToToggle) {
          slotToToggle.owned = !slotToToggle.owned;
          playClickSfx("toggle");
          saveActiveState();
          renderApp();
        }
      } else if (action === "auto-fix-cable") {
        var cableId = btn.getAttribute("data-cable-id");
        var cableItem = getItem(cableId);
        if (cableItem && cableItem.category === "cables") {
          // If this cable is already in the rig, but a secondary line needs an additional lead, increment qty
          var existingCableSlot = currentRig.items.find(function (s) { return s.itemId === cableId; });
          if (existingCableSlot) {
            existingCableSlot.qty = (existingCableSlot.qty || 1) + 1;
          } else {
            var newSlotId = "auto-cable-" + Date.now();
            var suffix = 0;
            while (currentRig.items.some(function (s) { return s.slotId === newSlotId; })) {
              newSlotId = "auto-cable-" + Date.now() + "-" + (++suffix);
            }
            currentRig.items.push({
              slotId: newSlotId,
              category: "cables",
              itemId: cableId,
              qty: 1,
              owned: false
            });
          }
          playClickSfx("select");
          saveActiveState();
          renderApp();
        }
      } else if (action === "auto-fix-slot") {
        var fixSlotId = btn.getAttribute("data-slot-id");
        var fixItemId = btn.getAttribute("data-item-id");
        var targetFixSlot = currentRig.items.find(function (s) { return s.slotId === fixSlotId; });
        if (targetFixSlot) {
          if (!replaceSlotItem(targetFixSlot, fixItemId)) return;
        } else {
          var fixItem = getItem(fixItemId);
          if (fixItem) {
            currentRig.items.push({
              slotId: fixSlotId,
              category: fixItem.category,
              itemId: fixItemId,
              qty: 1,
              owned: false
            });
          }
        }
        playClickSfx("select");
        saveActiveState();
        renderApp();
      } else if (action === "remove-slot") {
        var rSlotId = btn.getAttribute("data-slot-id");
        currentRig.items = currentRig.items.filter(function (s) { return s.slotId !== rSlotId; });
        playClickSfx("toggle");
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

    // Preset pills click
    document.addEventListener("click", function (e) {
      var presetBtn = e.target.closest("[data-preset-id]");
      if (!presetBtn) return;
      var pId = presetBtn.getAttribute("data-preset-id");
      var preset = CATALOG.presets.find(function (p) { return p.id === pId; });
      if (preset) {
        playClickSfx("preset");
        loadPresetData(preset);
      }
    });

    // Educational tier preset buttons click
    document.addEventListener("click", function (e) {
      var tierBtn = e.target.closest("[data-tier-preset]");
      if (!tierBtn) return;
      var pId = tierBtn.getAttribute("data-tier-preset");
      var preset = CATALOG.presets.find(function (p) { return p.id === pId; });
      if (preset) {
        playClickSfx("preset");
        loadPresetData(preset);
        var boothStage = document.getElementById("interactive-booth-stage");
        if (boothStage && typeof boothStage.scrollIntoView === "function") {
          boothStage.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    });

    // Title edit
    document.addEventListener("blur", function (e) {
      if (e.target.matches("[data-rig-name]")) {
        var editedName = e.target.textContent.trim() || "My Custom DJ Rig";
        if (editedName !== currentRig.name) {
          currentRig.name = editedName;
          saveActiveState();
          renderApp();
        }
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
    playClickSfx("preset");
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
        var statusStr = item.no_purchase === true ? "[EXISTING DEVICE / MODE — VERIFY]" : slot.owned ? "[ALREADY OWNED]" : "[NEED TO BUY]";
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

  function getSavedRigs() {
    try {
      var raw = safeStorageGet("offbeat.rigs.saved");
      if (!raw || raw.length > 100000) return [];
      var saved = JSON.parse(raw);
      if (!Array.isArray(saved)) return [];
      return saved.slice(0, 15).map(function (entry) {
        var clean = sanitizeRigState(entry);
        if (!clean) return null;
        return {
          name: clean.name, items: clean.items,
          totalCost: calculateCustomRigValuation(clean.items.filter(function (slot) { return !slot.owned; })),
          date: typeof entry.date === "string" ? entry.date.slice(0, 32) : "Saved"
        };
      }).filter(Boolean);
    } catch (e) { return []; }
  }

  function promptSaveRig() {
    var name = prompt("Name your setup:", currentRig.name);
    if (!name) return;
    currentRig.name = name.slice(0, 80);

    var stats = calculateRigStats();
    var saved = getSavedRigs();
    saved.unshift({
      name: currentRig.name,
      items: JSON.parse(JSON.stringify(currentRig.items)),
      totalCost: stats.purchaseCost,
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    });

    if (saved.length > 15) saved = saved.slice(0, 15);
    safeStorageSet("offbeat.rigs.saved", JSON.stringify(saved));
    saveActiveState();
    renderApp();
  }

  function loadSavedRig(index) {
    var saved = getSavedRigs();
    if (!saved[index]) return;
    var r = saved[index];
    if (!normalizeRigState(r)) return;
    playClickSfx("preset");
    saveActiveState();
    renderApp();
  }

  function deleteSavedRig(index) {
    var saved = getSavedRigs();
    saved.splice(index, 1);
    safeStorageSet("offbeat.rigs.saved", JSON.stringify(saved));
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

  function computeAllRigConnections() {
    var ctrlSlot = currentRig.items.find(function (s) { return s.category === "controllers"; });
    var ctrlItem = ctrlSlot ? getSlotItem(ctrlSlot) : null;
    var spkSlots = currentRig.items.filter(function (s) { return s.category === "speakers"; });
    if (!ctrlItem || !spkSlots.length || typeof OffbeatGear === "undefined" || !OffbeatGear.connectionPlan) {
      return [];
    }
    // Prioritize Crowd PA to claim Master Out first, then DJ Monitors claim Booth Out
    var sortedSlots = spkSlots.slice().sort(function (a, b) {
      var roleA = getSpeakerRole(a);
      var roleB = getSpeakerRole(b);
      if (roleA === "crowd_pa" && roleB !== "crowd_pa") return -1;
      if (roleB === "crowd_pa" && roleA !== "crowd_pa") return 1;
      return 0;
    });

    var usedOutputs = {};
    return sortedSlots.map(function (s) {
      var item = getSlotItem(s);
      if (!item) return null;
      var plan = OffbeatGear.connectionPlan(CATALOG, ctrlItem, item, s.qty || 1, { usedOutputs: usedOutputs });
      if (plan && plan.output) {
        usedOutputs[plan.output.connector] = (usedOutputs[plan.output.connector] || 0) + 1;
        if (!usedOutputs.claimed) usedOutputs.claimed = [];
        usedOutputs.claimed.push(plan.output);
      }
      return {
        speakerId: item.id,
        slotId: s.slotId,
        units: plan.units,
        feeds: plan.feeds,
        cabinets: plan.cabinets,
        kind: plan.kind,
        itemId: plan.itemId,
        label: plan.label,
        name: plan.name,
        balanced: plan.balanced,
        reversedLead: Boolean(plan.reversedLead),
        conflict: Boolean(plan.conflict),
        outputsNeeded: plan.outputsNeeded || 1,
        output: plan.output ? plan.output.connector : null,
        outputRole: plan.output ? plan.output.role : null,
        outputLabel: plan.output ? plan.output.label : null,
        socket: plan.socket ? plan.socket.connector : null
      };
    }).filter(Boolean);
  }

  window.__rigStudio = {
    item: function (id) { return getItem(id); },
    compatibility: function () { return calculateRigStats().compatibility; },
    state: function () { return JSON.parse(JSON.stringify(currentRig)); },
    cost: function () {
      var stats = calculateRigStats();
      return {
        total: stats.totalValue,
        fullTotal: stats.totalValue,
        purchase: stats.purchaseCost,
        buyTotal: stats.purchaseCost,
        ownedSavings: stats.ownedValue,
        ownedTotal: stats.ownedValue,
        itemCount: currentRig.items.length
      };
    },
    shareUrl: function () {
      var serialized = JSON.stringify(currentRig);
      var encoded = btoa(encodeURIComponent(serialized));
      return window.location.origin + window.location.pathname + "?rig=" + encodeURIComponent(encoded);
    },
    checks: function () {
      var checks = [];
      var ctrl = findSlot("controllers");
      var ctrlItem = ctrl ? getSlotItem(ctrl) : null;
      var host = findSlot("laptops");
      var hostItem = host ? getSlotItem(host) : null;
      if (!ctrlItem) {
        checks.push({ key: "host", level: "warn", title: "Controller Required", note: "No DJ playback or mixing system is selected." });
      } else if (ctrlItem.standalone) {
        checks.push({ key: "host", level: "ok", title: "Standalone Capability Listed", note: "Confirm media, firmware and supported playback before performing." });
      } else if (!hostItem || hostItem.id === "standalone-usb-only") {
        checks.push({ key: "host", level: "warn", title: "Host Computer Required", note: "This controller cannot play tracks without a compatible host and DJ software." });
      } else {
        checks.push({ key: "host", level: "warn", title: "Host Compatibility Needs Verification", note: "A host is listed, not physically connected or software-verified. Confirm device, licensing, USB audio and power." });
      }
      var speakers = currentRig.items.filter(function (s) { return s.category === "speakers"; });
      if (!speakers.length) {
        checks.push({ key: "cables", level: "warn", title: "No Speaker Route Selected", note: "Headphone-only practice is possible; no speaker cabling has been established." });
      } else if (areAllSpeakerRoutesConfirmed()) {
        checks.push({ key: "cables", level: "ok", title: "Speaker Cable Routes Planned", note: "Included or selected cable quantities cover the modeled routes; verify physical connections before use." });
      } else {
        checks.push({ key: "cables", level: "warn", title: "Speaker Cable Routes Need Review", note: "At least one route has missing cable packs, unsupported connectors or conflicting hardware outputs." });
      }
      return checks;
    },
    shoppingList: function () {
      return currentRig.items.map(function (s) {
        var it = getSlotItem(s);
        if (!it || s.owned || it.no_purchase) return null;
        return { itemId: it.id, name: it.brand + " " + it.model, price: it.price, qty: s.qty || 1, lineTotal: it.price * (s.qty || 1) };
      }).filter(Boolean);
    },
    connections: computeAllRigConnections,
    speakers: function () {
      var spk = findSlot("speakers");
      var it = spk ? getSlotItem(spk) : null;
      var q = spk ? (spk.qty || 1) : 1;
      return {
        item: it,
        qty: q,
        cabinets: it ? (it.speaker_units || 1) * q : 0,
        boxLabel: it ? it.box_label : null
      };
    },
    cableLines: function () {
      return currentRig.items.filter(function (s) { return s.category === "cables"; }).map(function (s) {
        var it = getSlotItem(s);
        return it ? { itemId: it.id, name: it.model, price: it.price, qty: s.qty || 1 } : null;
      }).filter(Boolean);
    },
    shoppingText: function () {
      var stats = calculateRigStats();
      return "ESTIMATED TOTAL: $" + stats.purchaseCost;
    }
  };

  /* ---------------------------------------------------------------- Start */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
