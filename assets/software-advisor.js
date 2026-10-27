/* Offbeat — DJ software advisor.
 *
 * Reads the visitor's answers, then explains, per platform, whether it fits
 * their gear and their goals, what it would cost, and what still needs checking
 * on the vendor's own page. No scores, no star ratings: every line in a result
 * is either a stated fact from software-advisor-data.js or a consequence of an
 * answer the visitor gave.
 *
 * Markup contract (dj-software-hub.html):
 *   [data-swa-root]     wrapper, enhanced in place
 *   [data-swa-form]     empty div, question fieldsets rendered into it
 *   [data-swa-results]  empty div, results rendered into it
 *   [data-swa-status]   summary line
 *   [data-swa-reset]    button
 */
(function () {
  "use strict";

  var DATA = window.OffbeatSoftwareData;
  var root = document.querySelector("[data-swa-root]");
  if (!DATA || !root) return;

  var form = root.querySelector("[data-swa-form]");
  var resultsEl = root.querySelector("[data-swa-results]");
  var statusEl = root.querySelector("[data-swa-status]");
  var resetBtn = root.querySelector("[data-swa-reset]");

  var answers = { mode: "", hardware: "", os: "", music: "", budget: "", needs: [], scene: "" };

  var PARAMS = {
    mode: "sw_mode",
    hardware: "sw_hardware",
    os: "sw_os",
    music: "sw_music",
    budget: "sw_budget",
    needs: "sw_need",
    scene: "sw_scene"
  };

  var OS_LABEL = { macos: "macOS", windows: "Windows", ios: "iPad or iPhone", android: "Android", linux: "Linux" };

  /* ------------------------------------------------------------ url state --
   * Keeps a result shareable, and lets the hub deep-link a preset such as
   * "I own a DDJ-FLX4 and want to play at home".
   */
  function readUrl() {
    var query = new URLSearchParams(window.location.search);
    Object.keys(PARAMS).forEach(function (key) {
      var raw = query.get(PARAMS[key]);
      if (!raw) return;
      if (key === "needs") {
        answers.needs = raw.split(",").filter(function (value) {
          return question("needs").options.some(function (option) { return option.value === value; });
        });
      } else if (question(key).options.some(function (option) { return option.value === raw; })) {
        answers[key] = raw;
      }
    });
  }

  function writeUrl() {
    if (!window.history || !window.history.replaceState) return;
    var query = new URLSearchParams(window.location.search);
    Object.keys(PARAMS).forEach(function (key) {
      var value = key === "needs" ? answers.needs.join(",") : answers[key];
      if (value) query.set(PARAMS[key], value);
      else query.delete(PARAMS[key]);
    });
    var search = query.toString();
    window.history.replaceState(null, "", window.location.pathname + (search ? "?" + search : "") + "#software-advisor");
  }

  /* --------------------------------------------------------------- helpers -- */
  function question(id) {
    for (var i = 0; i < DATA.questions.length; i++) {
      if (DATA.questions[i].id === id) return DATA.questions[i];
    }
    return { options: [] };
  }

  function esc(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function planOf(platform, id) {
    for (var i = 0; i < platform.plans.length; i++) {
      if (platform.plans[i].id === id) return platform.plans[i];
    }
    return null;
  }

  function planRank(platform, id) {
    for (var i = 0; i < platform.plans.length; i++) {
      if (platform.plans[i].id === id) return i;
    }
    return -1;
  }

  function money(value) {
    var rounded = Math.round(value * 100) / 100;
    var text = rounded % 1 === 0 ? String(rounded) : rounded.toFixed(2);
    return "$" + text.replace(/\.00$/, "");
  }

  /* Three years, because that is the horizon over which a $149 licence and a
     $120/yr subscription stop looking similar. Only the vendor's own USD list
     prices are used: nothing is converted, discounted or averaged. */
  function threeYearCost(plan) {
    if (!plan || plan.kind === "free" || plan.kind === "lite") {
      return { total: 0, label: "no licence", basis: "free" };
    }
    var options = [];
    if (plan.buyOnce) options.push({ total: plan.buyOnce, label: money(plan.buyOnce) + " once", basis: "perpetual" });
    if (plan.yearly) options.push({ total: Math.round(plan.yearly * 3 * 100) / 100, label: money(plan.yearly) + "/yr", basis: "yearly" });
    if (plan.monthly) options.push({ total: Math.round(plan.monthly * 36 * 100) / 100, label: money(plan.monthly) + "/mo", basis: "monthly" });
    options.sort(function (a, b) { return a.total - b.total; });
    return options[0] || { total: 0, label: "no licence", basis: "free" };
  }

  /* Only worth repeating on cards whose streaming note does not already say it. */
  function needsStreamingCaveat(platform) {
    return !/cannot be recorded/i.test(platform.streamingNote || "");
  }

  function hasPaidPerpetual(platform) {
    return platform.plans.some(function (plan) { return Boolean(plan.buyOnce); });
  }

  /* -------------------------------------------------------------- evidence --
   * Affinity only decides the order inside a group where several platforms
   * genuinely fit. It never promotes a platform past a hard blocker. */
  var SCENE_AFFINITY = {
    club: { rekordbox: 3, engine: 1 },
    scratch: { serato: 3 },
    events: { virtualdj: 3, djay: 2, serato: 1 },
    home: { mixxx: 1, djay: 1, rekordbox: 1 },
    produce: { traktor: 3, rekordbox: 1 },
    unsure: {}
  };

  function evaluate(platform, hw) {
    var blockers = [];
    var reasons = [];
    var notes = [];
    var checks = [];
    var gaps = [];
    var fillers = [];
    var perModel = [];
    var unlock = hw.unlocks ? hw.unlocks[platform.id] : null;

    /* Hardware we know exists but whose Serato tier this page has not verified
       is "unknown", not "nothing": the price depends entirely on whether the
       unit unlocks Lite or Pro, so the reader gets a check rather than a guess. */
    if (platform.id === "serato" && !unlock && answers.hardware &&
        answers.hardware !== "none" && answers.hardware !== "unsure") {
      unlock = "unknown";
    }

    /* -- can it run on this machine at all? (a genuine incompatibility) -- */
    if (answers.os && platform.os.indexOf(answers.os) === -1) {
      blockers.push("There is no " + OS_LABEL[answers.os] + " version.");
    }
    if (!blockers.length && answers.mode === "mobile" && platform.modes.indexOf("mobile") === -1) {
      blockers.push("It is a desktop program — there is no phone or tablet version.");
    }
    if (!blockers.length && answers.mode === "controller" && platform.modes.indexOf("controller") === -1) {
      blockers.push("It does not take a hardware controller.");
    }

    /* -- how it sits in standalone mode: the player runs its own system -- */
    if (!blockers.length && answers.mode === "standalone") {
      if (platform.id === "engine") {
        if (hw.engineFamily) {
          reasons.push("Your " + hw.label + " runs Engine OS itself, and Engine DJ is the free preparation tool built for exactly that: it organises, analyses and exports the music the player plays.");
        } else if (hw.pioneer || answers.hardware === "traktor") {
          blockers.push("Your " + hw.label + " is prepared by its own platform — Engine DJ prepares Engine OS players, so there would be nothing for it to do here.");
        } else {
          perModel.push("It depends which player it is: Engine OS players (Denon DJ, Numark Mixstream) are prepared by the free Engine DJ app; Pioneer CDJ/XDJ players take rekordbox-format media.");
        }
      } else if (platform.id === "rekordbox" && hw.pioneer) {
        reasons.push("rekordbox is the prep side of the Pioneer standalones and club CDJs — the sticks it exports are what they read.");
      } else if (platform.id === "rekordbox" && !hw.engineFamily && !hw.rekImport) {
        perModel.push("Which player it is decides: Pioneer CDJ/XDJ players take rekordbox-format sticks; Engine OS players take Engine format, and the PRIME 4/4+ additionally reads rekordbox drives natively.");
      } else if (platform.id !== "rekordbox") {
        var playerLine = hw.engineFamily ? " — your " + hw.label + " runs Engine OS itself" : "";
        var pairing = "";
        if (platform.id === "virtualdj" && hw.engineFamily && hw.unlocks && hw.unlocks.virtualdj) {
          pairing = " With a computer it also works as a controller with Virtual DJ (licence required) — that is the laptop route, not this one.";
        }
        blockers.push("It is a laptop program and cannot be installed on a standalone player" + playerLine + "." + pairing);
      }
    }

    /* -- Engine DJ's role whenever it is not the standalone itself -- */
    if (!blockers.length && platform.id === "engine" && answers.mode !== "standalone") {
      if (hw.engineFamily) {
        reasons.push("Engine DJ is the free prep side of your " + hw.label + ": the player runs Engine OS, and the app organises, analyses and exports the music it plays.");
      } else if (hw.pioneer || answers.hardware === "traktor") {
        blockers.push("Your " + hw.label + " is prepared by its own platform (Pioneer gear by rekordbox, Traktor gear by Traktor) — Engine DJ prepares Engine OS players, so it has no role here.");
      } else if (answers.hardware === "none" || answers.hardware === "unsure" || answers.hardware === "other") {
        perModel.push("Engine DJ only matters if you go Denon DJ or Numark Mixstream — both Engine OS: it is then the free prep tool. On any other route it has no role.");
      }
    }

    /* -- rekordbox against Engine OS players: import, prep or per-model -- */
    if (!blockers.length && platform.id === "rekordbox" && hw.engineFamily) {
      if (hw.rekImport) {
        gaps.push("rekordbox prepares its own USB format, and the " + hw.label + " reads those drives natively (music, playlists and hot cues) — so it can prepare the library; the player itself runs Engine OS, and the performance side is Serato DJ Pro or Virtual DJ.");
        fillers.push("For the player's native format, the free Engine DJ app is what the " + hw.label + " is built around.");
      } else {
        perModel.push("rekordbox's Hardware Unlock list is Pioneer DJ gear, and Engine format is this player's native media — whether the two meet at all is per-model; the PRIME 4/4+ reads rekordbox drives, the GO line is not documented as doing so.");
      }
    }

    /* -- Engine OS players as controllers: the verified facts, per the model --
     * The false verdict this page used to give was "Denon is not a controller
     * for X". The truth is per model: the PRIME 4/4+ is verified (Serato
     * unlocks DJ Pro; Denon lists Virtual DJ), and the GO/GO+ is verified for
     * Virtual DJ Pro; everything else is a check — never an automatic
     * "incompatible", never an unverified "supported". */
    if (!blockers.length && hw.engineFamily &&
        platform.id !== "engine" && platform.id !== "rekordbox" &&
        !(platform.id === "virtualdj" && hw.unlocks && hw.unlocks.virtualdj) &&
        !(platform.id === "serato" && hw.unlocks && hw.unlocks.serato && hw.unlocks.serato !== "unknown")) {
      if (platform.id === "traktor") {
        perModel.push("Traktor's compatibility list is per model and does not verify this Engine OS unit here — check Traktor's controller list before expecting support.");
      } else if (platform.id === "djay") {
        perModel.push("djay's hardware support is per model — confirm your exact unit on djay's list before relying on it.");
      } else if (platform.id === "virtualdj") {
        perModel.push("Virtual DJ's support is listed per model: the PRIME 4/4+ and the GO/GO+ are verified here, other Engine OS players are not — check Virtual DJ's compatibility list.");
      } else {
        perModel.push("Mixxx depends on community mappings, so whether your exact unit works — and how complete the mapping is — has to be checked first.");
      }
    }

    /* -- Serato tiers that depend on the exact model -- */
    if (!blockers.length && platform.id === "serato" && unlock === "unknown") {
      if (hw.engineFamily) {
        perModel.push("This Engine OS player is not on this page's verified Serato list — the PRIME 4/4+ is, and it unlocks DJ Pro while connected. If yours is, Serato's list names Lite or Pro, which decides $0 or $299.");
      } else {
        perModel.push("Serato's controller list decides the tier per model — Lite ($0), Pro ($299), or nothing at all.");
      }
    }

    /* -- Traktor on its own hardware: bundled terms are per model -- */
    if (!blockers.length && platform.id === "traktor" && unlock === "unknown") {
      perModel.push("Traktor's licence and bundle terms are per model on the Kontrol line — check the box or the retailer listing before paying.");
    }

    /* -- streaming: a capability with two honest outcomes, never a licence -- */
    if (!blockers.length && answers.mode !== "standalone" &&
        answers.music !== "local" && platform.streaming.length === 0) {
      if (answers.music === "both") {
        gaps.push("It plays only files you own — no streaming integration — so it covers your local music but not the streamed half.");
        fillers.push(DATA.streamingGapFill);
      } else {
        blockers.push("It has no streaming integration at all — it plays only files you own, and most of your music is streamed, so it cannot carry your sessions.");
      }
    }

    /* -- capabilities the visitor asked for -- */
    var requiredId = platform.plans[0].id;
    var decidingNote = "";
    var recordingRequested = false;

    (answers.needs || []).forEach(function (need) {
      var cap = platform.caps[need];
      if (!cap) return;
      if (need === "recording") recordingRequested = true;
      if (cap.plan === null) {
        /* A gap, not a verdict: the platform can still be the right app, with
           a companion covering the missing job. */
        gaps.push(cap.note);
        if (DATA.gapFill && DATA.gapFill[need]) fillers.push(DATA.gapFill[need]);
        return;
      }
      if (cap.plan === "none") {
        notes.push(cap.note);
        return;
      }
      var needId = cap.plan;
      var note = cap.note || "";
      if (cap.hardwareDependent && unlock !== "hu") {
        /* The free plan only performs while unlock gear is attached; without
           that gear the same capability is a paid one. */
        var core = planOf(platform, "core");
        if (core && planRank(platform, core.id) > planRank(platform, needId)) {
          needId = core.id;
          note = note + " Without unlock hardware, that means " + core.label + ".";
        }
      }
      if (planRank(platform, needId) > planRank(platform, requiredId)) {
        requiredId = needId;
        decidingNote = note;
      }
      if (cap.check) checks.push(cap.check);
    });

    /* A phone or tablet has its own licensing answer: djay and rekordbox ship
       free apps with limits, and Serato's iOS app has a separate ladder. */
    if (!blockers.length && answers.mode === "mobile" && platform.mobile) {
      var mobilePlan = planOf(platform, platform.mobile.plan);
      if (mobilePlan && planRank(platform, mobilePlan.id) > planRank(platform, requiredId)) {
        requiredId = mobilePlan.id;
        if (platform.mobile.note) notes.unshift(platform.mobile.note);
      }
      if (platform.mobile.check) checks.push(platform.mobile.check);
    }

    /* Serato on iPhone or iPad prices itself from Serato's iOS table, not from
       the desktop tiers: a free feature-limited tier, a $149 iOS-only licence,
       or a DJ Suite. The $149 licence adds recording and DVS on the device but
       does not unlock desktop DJ Pro. */
    if (!blockers.length && platform.id === "serato" && answers.os === "ios") {
      decidingNote = "";
      var iosNeeds = answers.needs || [];
      var paidIOS = iosNeeds.indexOf("recording") !== -1 ||
        iosNeeds.indexOf("dvs") !== -1 ||
        iosNeeds.indexOf("fourdecks") !== -1;
      requiredId = paidIOS ? "ios" : "lite";
      if (reasons.length === 0) {
        reasons.push(paidIOS
          ? "Serato DJ for iOS keeps recording and DVS as paid features, so the $149 licence is the tier that gives you what you asked for."
          : "Serato DJ for iOS has a free tier on iPhone and iPad, so the app works on the tablet before anything is paid for.");
      }
      if (paidIOS) {
        notes.push("On iPhone and iPad the $149 Serato DJ for iOS licence adds the paid features — recording and DVS are among them.");
      } else {
        notes.push("Serato DJ for iOS runs free with basic stems, FX and sync; recording, DVS and advanced stems are the paid step.");
      }
      notes.push("The $149 iOS licence is for iPhone and iPad only — it does not unlock desktop DJ Pro. A DJ Suite ($14.99/mo or $499) is what adds the desktop app.");
      if (hw.unlocks && hw.unlocks.serato) {
        checks.push("How your " + hw.label + " works with Serato DJ for iOS — Serato's per-model pages list the hardware behaviour and can point to DJ Suite for full functionality.");
      }
      if (iosNeeds.indexOf("fourdecks") !== -1) {
        checks.push("How many decks the current Serato DJ for iOS offers — Serato lists two decks on its free tier.");
      }
      if (iosNeeds.indexOf("video") !== -1) {
        notes.push("Video output is not on Serato's iOS feature list — it is a desktop expansion available through DJ Suite.");
      }
    }

    if (decidingNote) notes.unshift(decidingNote);

    var plan = planOf(platform, requiredId) || platform.plans[0];

    /* A free download that needs a paid tier the moment hardware appears is
       not free. Saying so first is the point of this tool. The GO/GO+ line is
       documented at Pro specifically; the PRIME 4/4+ at Home. */
    var cost;
    if (platform.id === "virtualdj" && answers.hardware && answers.hardware !== "none" && answers.hardware !== "unsure") {
      var vTier = hw.unlocks ? hw.unlocks.virtualdj : null;
      var vTarget = vTier === "pro" ? "pro" : "home";
      if (planRank(platform, vTarget) > planRank(platform, plan.id)) {
        plan = planOf(platform, vTarget);
      }
      if (vTier === "pro") {
        reasons.push("Denon documents Virtual DJ support for the PRIME GO and GO+ with a Pro licence, so Pro — not Home — is the tier for this unit.");
      } else if (vTier === "home") {
        reasons.push("Denon lists the PRIME 4/4+ as compatible with Virtual DJ; with a controller attached the free edition stops applying, so Home is the entry tier that allows it.");
      } else {
        reasons.push("The free edition stops being free the moment a controller is connected, so this is priced at Home, the cheapest licence that allows one.");
      }
    }
    cost = threeYearCost(plan);

    /* FLX10/FLX6-class hardware unlocks the Pro licence itself while it is
       connected (Serato's own hardware page), so Pro-tier needs carry no
       licence cost. DVS and video remain separate Suite additions. */
    if (unlock === "pro" && platform.id === "serato") {
      if (plan.id === "pro" && cost.total > 0) {
        cost = { total: 0, label: "no licence", basis: "free" };
        reasons.push("Your " + hw.label + " unlocks Serato DJ Pro while it is connected, so Pro features such as recording and four decks come with it — no licence to buy.");
      } else if (plan.id === "lite") {
        reasons.push("Your " + hw.label + " unlocks Serato DJ Pro while it is connected, so the Pro tier is already covered at no cost.");
      } else if (plan.id === "suite") {
        notes.unshift("Your " + hw.label + " unlocks Serato DJ Pro, but DVS and video are separate additions: " + plan.label + " is still the price for those.");
      }
    }

    /* ------------------------------- verdict: five outcomes, one order --
     * blocked — cannot genuinely run or serve a role here.
     * check   — depends on the exact model or tier, not verified on this page.
     * partial — fits, but leaves a named gap a companion tool covers.
     * costs   — fits, with a licence fee.
     * fits    — fits, no licence fee.
     * A blocked platform always loses; an unverified "check" must never be
     * shown as a fit, and an unverified clash must never be shown as
     * "incompatible".
     */
    var verdict;
    if (blockers.length) {
      verdict = "blocked";
    } else if (perModel.length) {
      verdict = "check";
    } else if (gaps.length) {
      verdict = "partial";
    } else if (cost.total > 0) {
      verdict = "costs";
    } else {
      verdict = "fits";
    }

    if (unlock === "hu" && platform.id === "rekordbox") {
      reasons.push(plan.kind === "free"
        ? "Your " + hw.label + " is on rekordbox's Hardware Unlock list, so "
          + (recordingRequested ? "Performance mode, recording and mix sharing run" : "Performance mode runs")
          + " on the Free plan."
        : "Your " + hw.label + " unlocks Performance mode on the Free plan, but " + plan.label + " is still needed for what you asked for.");
    }
    if (unlock === "lite" && platform.id === "serato") {
      if (plan.id === "lite") {
        reasons.push("Your " + hw.label + " unlocks Serato DJ Lite at no cost, and Stems is included in Lite.");
      } else {
        notes.unshift("Your " + hw.label + " unlocks Serato DJ Lite, not " + plan.label + ". Reaching " + plan.label + " is the cost this choice hides: " + money(cost.total) + " over three years.");
      }
    }
    if (unlock === "play" && platform.id === "traktor") {
      reasons.push("Your " + hw.label + " is plug-and-play with Traktor, and some retail bundles include a Traktor Play licence — check the box before paying.");
    }
    /* On the Engine OS lines the per-model line already says it, so this
       check lands only where no platform has verified the mapping yet. */
    if (platform.id === "mixxx" && answers.hardware && answers.hardware !== "none" && answers.hardware !== "unsure" && !perModel.length) {
      checks.push("Whether a community mapping exists for your controller, and how complete it is.");
    }
    if (unlock === "os" && platform.id === "engine") {
      reasons.push("Engine DJ desktop is free and is the preparation tool your hardware is built around.");
    }

    if (answers.budget === "free" && cost.total > 0) {
      notes.push("Not free for your answers: the cheapest tier that does what you asked for is " + plan.label + " at " + cost.label + ".");
    }
    if (answers.budget === "once" && cost.total > 0 && !hasPaidPerpetual(platform)) {
      notes.push(platform.buyOnceNote || "There is no buy-once licence, so this is a subscription: " + cost.label + " over three years.");
    }
    if (answers.budget === "once" && cost.basis === "perpetual") {
      reasons.push("It can be owned outright rather than rented.");
    }
    if (answers.budget === "sub" && cost.basis === "perpetual") {
      notes.push("A perpetual licence exists here and is the cheaper three-year route: " + cost.label + ".");
    }

    if (answers.music !== "local" && platform.streaming.length) {
      notes.push("Streaming: " + platform.streamingNote);
    }
    if (answers.music !== "local" && recordingRequested && needsStreamingCaveat(platform)) {
      notes.push("No platform can record streamed audio — recording needs files you own.");
    }

    if (answers.scene === "club" && platform.id === "rekordbox") {
      reasons.push("Club CDJs read rekordbox-format USB sticks, so what you prepare at home plays in the booth.");
    }
    if (answers.scene === "club" && platform.id === "engine") {
      reasons.push("Engine DJ is the preparation side of the Engine OS ecosystem.");
    }
    if (answers.scene === "home" && platform.id === "mixxx" && cost.total === 0) {
      reasons.push("Nothing to buy and nothing to subscribe to while you find out whether DJing sticks.");
    }

    /* Every non-blocked card must say something in its own favour; falling
       back to the strongest fact about the platform is better than a blank. */
    if (!reasons.length) reasons.push(platform.strengths[0]);

    /* A free result that opens with a paid price is not an answer to "free if
       possible" — that is how a buyer ends up reading a pitch for the thing
       they just said they did not want to buy. Drop the money and let the
       curated free-tier line carry the case instead. */
    if (cost.total === 0 && answers.budget === "free") {
      var moneyless = reasons.filter(function (line) { return line.indexOf("$") === -1; });
      if (moneyless.length !== reasons.length) {
        reasons = moneyless.length ? moneyless : [platform.freeNote || platform.strengths[0]];
      }
    }

    /* Affinity only ranks inside a group — it never crosses verdicts. */
    var affinity = (SCENE_AFFINITY[answers.scene] || {})[platform.id] || 0;
    var score = affinity + (unlock && unlock !== "unknown" ? 2 : 0);

    /* Notes can repeat across capabilities; the reader only needs each once. */
    var seen = {};
    notes = notes.filter(function (line) {
      if (!line || seen[line]) return false;
      seen[line] = true;
      return true;
    });

    return {
      platform: platform,
      verdict: verdict,
      plan: plan,
      cost: cost,
      unlock: unlock,
      blockers: blockers,
      reasons: reasons.slice(0, 3),
      notes: notes.slice(0, 4),
      checks: checks,
      perModel: perModel,
      gaps: gaps,
      fillers: fillers,
      score: score
    };
  }

  function evaluateAll() {
    var hw = DATA.hardware[answers.hardware] || { label: "", unlocks: {} };
    var order = { fits: 0, costs: 1, partial: 2, check: 3, blocked: 4 };
    return DATA.platforms.map(function (platform) {
      return evaluate(platform, hw);
    }).sort(function (a, b) {
      if (order[a.verdict] !== order[b.verdict]) return order[a.verdict] - order[b.verdict];
      if (a.score !== b.score) return b.score - a.score;
      if (a.cost.total !== b.cost.total) return a.cost.total - b.cost.total;
      return a.platform.name.localeCompare(b.platform.name);
    });
  }

  var VERDICT = {
    fits: { title: "Fits what you described", tone: "fits" },
    costs: { title: "Works, but you would be paying", tone: "costs" },
    partial: { title: "Fits, with a named gap", tone: "partial" },
    check: { title: "Depends on the exact model or tier", tone: "check" },
    blocked: { title: "Does not fit", tone: "blocked" }
  };

  /* ---------------------------------------------------------------- render -- */
  function answeredCount() {
    var count = 0;
    ["mode", "hardware", "os", "music", "budget", "scene"].forEach(function (key) {
      if (answers[key]) count += 1;
    });
    if (answers.needs.length) count += 1;
    return count;
  }

  function renderQuestions() {
    form.innerHTML = DATA.questions.map(function (item) {
      var current = answers[item.id];
      var options = item.options.map(function (option) {
        var checked = item.multi ? current.indexOf(option.value) !== -1 : current === option.value;
        return '<label class="swa-option">' +
          '<input type="' + (item.multi ? "checkbox" : "radio") + '" name="sw_' + item.id + '" value="' + esc(option.value) + '"' +
          (checked ? " checked" : "") + ">" +
          "<span>" + esc(option.label) + "</span></label>";
      }).join("");
      return '<fieldset class="swa-question" data-question="' + item.id + '">' +
        "<legend>" + esc(item.label) + "</legend>" +
        '<p class="swa-help">' + esc(item.help) + "</p>" +
        '<div class="swa-options">' + options + "</div></fieldset>";
    }).join("");
  }

  function priceLine(result) {
    var plan = result.plan;
    if (result.platform.id === "serato" && plan.id === "lite" && answers.os === "ios") {
      return "Serato DJ for iOS — free (feature limited)";
    }
    if (plan.kind === "free" || plan.kind === "lite") return plan.label + " — no licence fee";
    var parts = [];
    if (plan.buyOnce) parts.push(money(plan.buyOnce) + " once");
    if (plan.yearly) parts.push(money(plan.yearly) + "/yr");
    if (plan.monthly) parts.push(money(plan.monthly) + "/mo");
    return plan.label + " — " + parts.join(" or ");
  }

  function list(items, className, label) {
    if (!items || !items.length) return "";
    return (label ? '<p class="swa-label">' + esc(label) + "</p>" : "") +
      '<ul class="' + className + '">' + items.map(function (item) {
        return "<li>" + esc(item) + "</li>";
      }).join("") + "</ul>";
  }

  function renderCard(result) {
    var platform = result.platform;
    var badge;
    if (result.verdict === "blocked") badge = "Doesn't fit";
    else if (result.verdict === "check") badge = "Depends on your model";
    else badge = result.cost.total === 0 ? "No licence cost" : money(result.cost.total) + " / 3 yrs";

    var next = ['<a href="' + esc(platform.review) + '">Read the ' + esc(platform.name) + ' review</a>'];
    next.push('<a href="controller-software-compatibility-matrix.html">Check controller compatibility</a>');
    if (result.verdict !== "blocked" && result.verdict !== "check") next.push('<a href="build-your-dj-setup.html">Price the whole rig in Rig Studio</a>');

    return '<article class="swa-card swa-card--' + VERDICT[result.verdict].tone + '">' +
      '<header class="swa-card-head"><h4>' + esc(platform.name) + "</h4>" +
      '<span class="swa-badge">' + esc(badge) + "</span></header>" +
      '<p class="swa-maker">' + esc(platform.maker) + "</p>" +
      (result.verdict !== "blocked" ? '<p class="swa-price">' + esc(priceLine(result)) + "</p>" : "") +
      (result.verdict !== "blocked" && result.verdict !== "check" && !result.cost.total && platform.freeNote &&
        result.reasons.indexOf(platform.freeNote) === -1
        ? '<p class="swa-free"><b>What the free tier covers:</b> ' + esc(platform.freeNote) + "</p>"
        : "") +
      list(result.reasons, "swa-why", "Why it fits") +
      list(result.blockers, "swa-blockers", result.blockers.length ? "Why it does not fit" : "") +
      list(result.notes, "swa-notes", "Before you pay") +
      list(result.perModel, "swa-permodel", result.perModel.length ? "It depends on the exact model" : "") +
      list(result.gaps, "swa-gaps", result.gaps.length ? "Where it doesn't fit" : "") +
      list(result.fillers, "swa-fillers", result.fillers.length ? "What fills the gap" : "") +
      list(result.checks, "swa-checks", "Confirm on the vendor's site") +
      (!result.perModel.length &&
        !result.checks.some(function (line) { return line.indexOf(platform.verify) === 0; }) &&
        !["hu", "lite", "pro", "play"].indexOf(result.unlock || "") !== -1
        ? '<p class="swa-verify"><b>Unverified here:</b> ' + esc(platform.verify) + "</p>"
        : "") +
      '<nav class="swa-next" aria-label="Next steps for ' + esc(platform.name) + '">' + next.join("") + "</nav>" +
      "</article>";
  }

  function render() {
    var missing = ["mode", "hardware", "os"].filter(function (key) { return !answers[key]; });
    if (missing.length) {
      statusEl.textContent = "Answer the first three questions to see which software fits.";
      resultsEl.innerHTML = '<p class="swa-empty">Nothing is recommended until we know what you are playing on. ' +
        "The first three questions are enough to start; the rest sharpen the answer.</p>";
      return;
    }

    var results = evaluateAll();
    var fits = results.filter(function (r) { return r.verdict === "fits"; });
    var costs = results.filter(function (r) { return r.verdict === "costs"; });
    var partial = results.filter(function (r) { return r.verdict === "partial"; });
    var check = results.filter(function (r) { return r.verdict === "check"; });
    var blocked = results.filter(function (r) { return r.verdict === "blocked"; });

    var summary = [
      fits.length + (fits.length === 1 ? " platform fits" : " platforms fit") + " what you described"
    ];
    if (partial.length) summary.push(partial.length + (partial.length === 1 ? " fits with a named gap" : " fit with named gaps"));
    if (check.length) summary.push(check.length + (check.length === 1 ? " depends on the exact model" : " depend on the exact model"));
    if (costs.length) summary.push(costs.length + (costs.length === 1 ? " would need paying" : " would need paying"));
    if (blocked.length) summary.push(blocked.length + (blocked.length === 1 ? " does not fit" : " do not fit"));
    statusEl.textContent = summary.join(" · ") +
      " · " + answeredCount() + " of " + DATA.questions.length + " questions answered.";

    var html = "";
    ["fits", "costs", "partial", "check", "blocked"].forEach(function (key) {
      var group = results.filter(function (r) { return r.verdict === key; });
      if (!group.length) return;
      html += '<section class="swa-group swa-group--' + VERDICT[key].tone + '">' +
        "<h3>" + esc(VERDICT[key].title) + ' <span class="swa-count">' + group.length + "</span></h3>" +
        '<div class="swa-cards">' + group.map(renderCard).join("") + "</div></section>";
    });

    var comparable = results.filter(function (r) {
      return r.verdict === "fits" || r.verdict === "costs" || r.verdict === "partial";
    });
    if (comparable.length) {
      html += '<div class="swa-table-wrap" tabindex="0" role="region" aria-label="Three-year licence cost, scrolls sideways on narrow screens">' +
        '<table class="swa-table"><caption>Three years of the licence your answers need</caption>' +
        '<thead><tr><th scope="col">Platform</th><th scope="col">Tier needed</th><th scope="col">Cost basis</th><th scope="col">3 years</th></tr></thead><tbody>' +
        comparable.map(function (r) {
          return '<tr><th scope="row">' + esc(r.platform.name) + "</th><td>" + esc(r.plan.label) + "</td><td>" +
            esc(r.cost.label) + "</td><td>" + (r.cost.total === 0 ? "No licence fee" : money(r.cost.total)) + "</td></tr>";
        }).join("") + "</tbody></table></div>" +
        '<p class="swa-foot">List prices in USD, read from the vendors on ' + esc(DATA.verified) +
        ". Streaming subscriptions, hardware and tax are excluded. Buy-once licences are compared against the same 36 months.</p>";
      if (check.length) {
        html += '<p class="swa-foot">The ' + check.length + (check.length === 1 ? " platform" : " platforms") +
          ' in "Depends on the exact model" are left out of the table: their tier is decided by the vendor\'s list for your unit, not by the question above.</p>';
      }
    }

    if (answers.music !== "local") {
      html += '<div class="swa-note"><strong>Streaming is not a licence.</strong> Apple Music, Spotify, TIDAL and the rest bill you separately, ' +
        "are licensed for personal use, and cannot be recorded or stem-separated in any of these apps. Paid work needs files you own.</div>";
    }

    html += '<details class="swa-method"><summary>How these results were worked out</summary>' +
      "<p>Every platform is checked against your answers: whether it runs on your computer or device, whether it works with your hardware, " +
      "whether it can do what you asked for, and which licence tier that requires. The outcome is one of five: " +
      "<b>fits</b> (no licence fee), <b>works but you would be paying</b> (a licence fee applies), " +
      "<b>fits with a named gap</b> (it covers most of what you asked, and the page names what a companion tool does about the rest), " +
      "<b>depends on the exact model or tier</b> (this page has verified the platform but not your unit, so the card says what to confirm instead of guessing), " +
      "and <b>does not fit</b> (no version for your system, no role for your setup). Platform names, tiers and prices come from the vendors' own pages; a platform this page has not verified for your hardware is never shown as a fit and is never shown as incompatible.</p>" +
      "<p>Hardware Unlock is treated as what it is: a per-feature unlock. On the controllers rekordbox lists, it runs Performance mode " +
      "— and, on the FLX2, FLX4, FLX6 and FLX10, recording and mix sharing — but it does not cover stems, DVS or video, which stay paid-plan features. " +
      "Serato works the other way: the FLX10 and FLX6 unlock DJ Pro itself, while the FLX2 and FLX4 unlock Lite. That distinction is where most unexpected software bills come from.</p>" +
      "<p>Prices come from the vendors' own pages on " + esc(DATA.verified) + ". Offbeat earns from some retailer links, but no ranking or verdict here " +
      "depends on that, and the most useful answer is often the one that stops a purchase.</p></details>";

    resultsEl.innerHTML = html;
  }

  /* ---------------------------------------------------------------- events -- */
  function syncFromDom() {
    DATA.questions.forEach(function (item) {
      var inputs = form.querySelectorAll('input[name="sw_' + item.id + '"]');
      if (item.multi) {
        answers[item.id] = Array.prototype.filter.call(inputs, function (input) { return input.checked; })
          .map(function (input) { return input.value; });
      } else {
        for (var i = 0; i < inputs.length; i++) {
          if (inputs[i].checked) answers[item.id] = inputs[i].value;
        }
      }
    });
  }

  form.addEventListener("change", function () {
    syncFromDom();
    writeUrl();
    render();
  });

  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      answers = { mode: "", hardware: "", os: "", music: "", budget: "", needs: [], scene: "" };
      var query = new URLSearchParams(window.location.search);
      Object.keys(PARAMS).forEach(function (key) { query.delete(PARAMS[key]); });
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, "", window.location.pathname + (query.toString() ? "?" + query.toString() : "") + "#software-advisor");
      }
      renderQuestions();
      render();
      var first = form.querySelector("input");
      if (first) first.focus();
    });
  }

  readUrl();
  renderQuestions();
  render();

  /* Exposed for the regression test and the console. Not part of the interface. */
  window.__softwareAdvisor = {
    answers: answers,
    evaluateAll: evaluateAll,
    render: render
  };
})();
