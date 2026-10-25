/* Offbeat guide discovery: curated routes above a searchable, browsable index. */
(function () {
  "use strict";
  var root = document.querySelector(".guide-library-page");
  if (!root) return;
  var results = root.querySelector("[data-library-results]");
  var input = root.querySelector("[data-library-input]");
  var count = root.querySelector("[data-library-result-count]");
  var total = root.querySelector("[data-library-total]");
  var empty = root.querySelector("[data-library-empty]");
  var clear = root.querySelector("[data-library-clear]");
  var sort = root.querySelector("[data-library-sort]");
  var filterHost = root.querySelector("[data-library-filters]");
  if (!results || !input || !filterHost) return;

  var excluded = /^(index|404|all-dj-guides|about|contact|disclosure|privacy)\.html$/;
  var filter = "all";
  var entries = [];

  function topic(item) {
    var url = item.u.toLowerCase().split("?")[0];
    var group = (item.g || "").toLowerCase();
    if (group === "tools" || /^(dj-glossary|controller-software-compatibility-matrix)\.html$/.test(url)) return "tools";
    if (group === "controllers" || group === "gear" || /^(best-dj-|best-standalone|best-motorized|best-turntable|best-studio|ddj-|denon-|numark-|pioneer-|rane-|xdj-|audio-interface|festival-dj-gear|dj-equipment|dj-laptop-setup|how-to-connect-dj-controller|controller-buying)/.test(url)) return "gear";
    if (group === "software" || /^(music-production|best-daw|best-music-production|ableton|fl-studio|landr|amuse|distrokid|splice|soundcloud|beatport|dj-music-stores|dj-software)/.test(url)) return "software";
    if (/^(dj-skills-performance-hub|how-to-(beatmatch|mix|record|promote|become|get-dj|dj-at|create-dj)|best-online-dj-courses)/.test(url)) return "skills";
    return "learning";
  }

  function labelFor(key) {
    return ({ learning: "Learn to DJ", gear: "Gear & buying", software: "Software & production", skills: "Skills & work", tools: "Tools & reference" })[key] || "Guide";
  }

  function searchable(item) {
    return (item.t + " " + item.d + " " + item.k + " " + item.c).toLocaleLowerCase();
  }

  function makeCard(item) {
    var a = document.createElement("a");
    a.className = "library-guide-card";
    a.href = item.u;
    a.setAttribute("data-topic", item.topic);
    var top = document.createElement("span");
    top.className = "guide-card-topline";
    var tag = document.createElement("span");
    tag.className = "guide-topic-tag topic-" + item.topic;
    tag.textContent = labelFor(item.topic);
    top.appendChild(tag);
    if (item.f) {
      var featured = document.createElement("span");
      featured.className = "guide-featured-mark";
      featured.textContent = "Reader favourite";
      top.appendChild(featured);
    }
    var title = document.createElement("strong");
    title.className = "guide-card-title";
    title.textContent = item.t.replace(/&amp;/g, "&");
    var desc = document.createElement("span");
    desc.className = "guide-card-desc";
    desc.textContent = item.d || "A practical Offbeat guide. Open for the full walkthrough, comparisons and useful next steps.";
    var action = document.createElement("span");
    action.className = "guide-card-action";
    action.innerHTML = "Explore guide <span aria-hidden=\"true\">↗</span>";
    a.appendChild(top);
    a.appendChild(title);
    a.appendChild(desc);
    a.appendChild(action);
    return a;
  }

  function render() {
    var terms = input.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    var mode = sort ? sort.value : "recommended";
    var visible = entries.filter(function (item) {
      if (filter !== "all" && item.topic !== filter) return false;
      var corpus = item.search;
      return terms.every(function (term) { return corpus.indexOf(term) !== -1; });
    });
    if (mode === "az") {
      visible.sort(function (a, b) { return a.t.localeCompare(b.t); });
    } else {
      visible.sort(function (a, b) { return Number(b.f) - Number(a.f) || a.t.localeCompare(b.t); });
    }
    results.replaceChildren();
    var fragment = document.createDocumentFragment();
    visible.forEach(function (item) { fragment.appendChild(makeCard(item)); });
    results.appendChild(fragment);
    count.textContent = visible.length + (visible.length === 1 ? " guide" : " guides");
    total.textContent = entries.length + " guides, reviews & tools — made to help you move forward.";
    empty.hidden = visible.length !== 0;
    clear.hidden = !input.value && filter === "all";
  }

  fetch("assets/search-index.json")
    .then(function (response) {
      if (!response.ok) throw new Error("Could not load guide index");
      return response.json();
    })
    .then(function (data) {
      var seen = Object.create(null);
      entries = data.filter(function (item) {
        var url = (item.u || "").split("?")[0];
        if (!url || url.indexOf("/") !== -1 || excluded.test(url) || seen[url]) return false;
        seen[url] = true;
        return true;
      }).map(function (item) {
        var copy = Object.assign({}, item);
        copy.topic = topic(copy);
        copy.search = searchable(copy);
        return copy;
      });
      render();
    })
    .catch(function () {
      results.innerHTML = '<p class="library-load-error">The guide index could not load. The topic paths above are still here to get you started.</p>';
      count.textContent = "Library unavailable";
      total.textContent = "Start with a topic path above.";
    });

  input.addEventListener("input", render);
  if (sort) sort.addEventListener("change", render);
  filterHost.addEventListener("click", function (event) {
    var button = event.target.closest("[data-library-filter]");
    if (!button) return;
    filter = button.getAttribute("data-library-filter");
    filterHost.querySelectorAll("[data-library-filter]").forEach(function (chip) {
      var active = chip === button;
      chip.classList.toggle("is-active", active);
      chip.setAttribute("aria-pressed", active ? "true" : "false");
    });
    render();
  });
  clear.addEventListener("click", function () {
    input.value = "";
    filter = "all";
    filterHost.querySelectorAll("[data-library-filter]").forEach(function (chip) {
      var active = chip.getAttribute("data-library-filter") === "all";
      chip.classList.toggle("is-active", active);
      chip.setAttribute("aria-pressed", active ? "true" : "false");
    });
    render();
    input.focus();
  });
})();
