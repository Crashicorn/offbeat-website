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
    var unlock = hw.unlocks ? hw.unlocks[platform.id] : null;

    /* Hardware we know exists but whose Serato tier this page has not verified
       is "unknown", not "nothing": the price depends entirely on whether the
       unit unlocks Lite or Pro, so the reader gets a check rather than a guess. */
    if (platform.id === "serato" && !unlock && answers.hardware &&
        answers.hardware !== "none" && answers.hardware !== "unsure") {
      unlock = "unknown";
    }

    /* -- can it run on this machine at all? -- */
    if (answers.os && platform.os.indexOf(answers.os) === -1) {
      blockers.push("There is no " + OS_LABEL[answers.os] + " version.");
    }
    if (!blockers.length && answers.mode === "mobile" && platform.modes.indexOf("mobile") === -1) {
      blockers.push("It is a desktop program — there is no phone or tablet version.");
    }
    if (!blockers.length && answers.mode === "standalone" && platform.modes.indexOf("standalone") === -1) {
      blockers.push("Standalone players run their own software, so a laptop program cannot be installed on them.");
    }
    if (!blockers.length && answers.mode === "controller" && platform.modes.indexOf("controller") === -1) {
      blockers.push("It does not take a hardware controller.");
    }

    /* -- hardware from another ecosystem -- */
    if (answers.hardware === "denon" && platform.id !== "engine") {
      blockers.push("Denon Prime hardware runs Engine OS on the device itself; it is not a controller for " + platform.name + ".");
    }
    if (platform.id === "engine" && answers.hardware !== "denon" && answers.hardware !== "unsure") {
      blockers.push("Engine DJ prepares media for Engine OS players. Without Denon or Numark Engine hardware there is nothing for it to prepare.");
    }
    if (answers.hardware === "traktor" && platform.id === "serato") {
      checks.push("Serato support for Traktor Kontrol hardware is per model — confirm yours on Serato's hardware list.");
    }

    /* -- streaming: a dependency, never a licence -- */
    if (answers.music !== "local" && platform.streaming.length === 0) {
      blockers.push("It has no streaming integration at all — it plays only files you own.");
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
        blockers.push(cap.note);
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

    /* A phone or tablet has its own licensing answer: Serato's mobile app is a
       Suite entitlement, while djay and rekordbox ship free apps with limits. */
    if (!blockers.length && answers.mode === "mobile" && platform.mobile) {
      var mobilePlan = planOf(platform, platform.mobile.plan);
      if (mobilePlan && planRank(platform, mobilePlan.id) > planRank(platform, requiredId)) {
        requiredId = mobilePlan.id;
        if (platform.mobile.note) notes.unshift(platform.mobile.note);
      }
      if (platform.mobile.check) checks.push(platform.mobile.check);
    }

    if (decidingNote) notes.unshift(decidingNote);

    if (blockers.length) {
      return {
        platform: platform,
        verdict: "blocked",
        plan: null,
        cost: { total: 0, label: "", basis: "" },
        blockers: blockers,
        reasons: [],
        notes: notes,
        checks: checks,
        score: 0
      };
    }

    var plan = planOf(platform, requiredId) || platform.plans[0];

    /* A free download that needs a paid tier the moment hardware appears is not
       free. Saying so first is the point of this tool. */
    if (platform.id === "virtualdj" && plan.kind === "free" && answers.hardware && answers.hardware !== "none" && answers.hardware !== "unsure") {
      plan = planOf(platform, "home");
      reasons.push("The free edition stops being free the moment a controller is connected, so this is priced at Home, the cheapest licence that allows one.");
    }

    var cost = threeYearCost(plan);
    var verdict = cost.total === 0 ? "fits" : "costs";

    if (unlock === "hu" && platform.id === "rekordbox") {
      reasons.push(plan.kind === "free"
        ? "Your " + hw.label + " is on rekordbox's Hardware Unlock list, so Performance mode runs on the Free plan."
        : "Your " + hw.label + " unlocks Performance mode on the Free plan, but " + plan.label + " is still needed for what you asked for.");
    }
    if (unlock === "lite" && platform.id === "serato") {
      if (plan.id === "lite") {
        reasons.push("Your " + hw.label + " unlocks Serato DJ Lite at no cost, and Stems is included in Lite.");
      } else {
        notes.unshift("Your " + hw.label + " unlocks Serato DJ Lite, not " + plan.label + ". Reaching " + plan.label + " is the cost this choice hides: " + money(cost.total) + " over three years.");
      }
    }
    if (unlock === "unknown" && platform.id === "serato") {
      checks.push("Whether your controller unlocks Lite or Pro decides the price — check Serato's hardware list.");
    }
    if (unlock === "play" && platform.id === "traktor") {
      reasons.push("Your " + hw.label + " is plug-and-play with Traktor, and some retail bundles include a Traktor Play licence — check the box before paying.");
    }
    if (platform.id === "mixxx" && answers.hardware && answers.hardware !== "none" && answers.hardware !== "unsure") {
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
      blockers: [],
      reasons: reasons.slice(0, 3),
      notes: notes.slice(0, 4),
      checks: checks,
      score: score
    };
  }

  function evaluateAll() {
    var hw = DATA.hardware[answers.hardware] || { label: "", unlocks: {} };
    var order = { fits: 0, costs: 1, blocked: 2 };
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
    var badge = result.verdict === "blocked"
      ? "Ruled out"
      : (result.cost.total === 0 ? "No licence cost" : money(result.cost.total) + " / 3 yrs");

    var next = ['<a href="' + esc(platform.review) + '">Read the ' + esc(platform.name) + ' review</a>'];
    next.push('<a href="controller-software-compatibility-matrix.html">Check controller compatibility</a>');
    if (result.verdict !== "blocked") next.push('<a href="build-your-dj-setup.html">Price the whole rig in Rig Studio</a>');

    return '<article class="swa-card swa-card--' + VERDICT[result.verdict].tone + '">' +
      '<header class="swa-card-head"><h4>' + esc(platform.name) + "</h4>" +
      '<span class="swa-badge">' + esc(badge) + "</span></header>" +
      '<p class="swa-maker">' + esc(platform.maker) + "</p>" +
      (result.verdict !== "blocked" ? '<p class="swa-price">' + esc(priceLine(result)) + "</p>" : "") +
      (result.verdict !== "blocked" && !result.cost.total && platform.freeNote &&
        result.reasons.indexOf(platform.freeNote) === -1
        ? '<p class="swa-free"><b>What the free tier covers:</b> ' + esc(platform.freeNote) + "</p>"
        : "") +
      list(result.reasons, "swa-why", "Why it fits") +
      list(result.blockers, "swa-blockers", result.blockers.length ? "Why it does not fit" : "") +
      list(result.notes, "swa-notes", "Before you pay") +
      list(result.checks, "swa-checks", "Confirm on the vendor's site") +
      (result.checks.some(function (line) { return line.indexOf(platform.verify) === 0; })
        ? ""
        : '<p class="swa-verify"><b>Unverified here:</b> ' + esc(platform.verify) + "</p>") +
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
    var blocked = results.filter(function (r) { return r.verdict === "blocked"; });

    statusEl.textContent = fits.length + (fits.length === 1 ? " platform fits" : " platforms fit") +
      " what you described · " + costs.length + " would need paying · " + blocked.length +
      (blocked.length === 1 ? " does not fit" : " do not fit") +
      " · " + answeredCount() + " of " + DATA.questions.length + " questions answered.";

    var html = "";
    ["fits", "costs", "blocked"].forEach(function (key) {
      var group = results.filter(function (r) { return r.verdict === key; });
      if (!group.length) return;
      html += '<section class="swa-group swa-group--' + VERDICT[key].tone + '">' +
        "<h3>" + esc(VERDICT[key].title) + ' <span class="swa-count">' + group.length + "</span></h3>" +
        '<div class="swa-cards">' + group.map(renderCard).join("") + "</div></section>";
    });

    var comparable = results.filter(function (r) { return r.verdict !== "blocked"; });
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
    }

    if (answers.music !== "local") {
      html += '<div class="swa-note"><strong>Streaming is not a licence.</strong> Apple Music, Spotify, TIDAL and the rest bill you separately, ' +
        "are licensed for personal use, and cannot be recorded or stem-separated in any of these apps. Paid work needs files you own.</div>";
    }

    html += '<details class="swa-method"><summary>How these results were worked out</summary>' +
      "<p>Every platform is checked against your answers: whether it runs on your computer or device, whether it works with your hardware, " +
      "whether it can do what you asked for, and which licence tier that requires. Platforms are grouped by that outcome, then ordered by how well " +
      "they match your goal and — where they tie — by three-year cost.</p>" +
      "<p>Hardware Unlock is treated as what it is: a per-feature unlock. Listed gear runs Performance mode on the Free plan, but it never covers " +
      "recording, stems or video, which are paid-plan features. That distinction is where most unexpected software bills come from.</p>" +
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
