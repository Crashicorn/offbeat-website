/* Offbeat Inc. — small progressive enhancements.
 * No tracking, no third-party requests. Everything degrades gracefully without JS.
 * 1. Mobile navigation drawer
 * 2. Current-section highlighting in the header
 * 3. Instant client-side search over a local JSON index (loaded on demand)
 */
(function () {
  "use strict";

  var navLinks = document.querySelector(".nav-links");
  var toggle = document.querySelector(".nav-toggle");

  /* ---------- 1. Mobile navigation ---------- */
  if (toggle && navLinks) {
    toggle.addEventListener("click", function () {
      var open = navLinks.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    navLinks.addEventListener("click", function (event) {
      if (event.target.closest("a") && navLinks.classList.contains("is-open")) {
        navLinks.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---------- 2. Current section highlight ---------- */
  (function highlightCurrent() {
    if (!navLinks) return;
    var here = location.pathname.split("/").pop() || "index.html";
    var groups = {
      "beginner-dj-hub.html": ["start", "beginner", "how-to-start", "learn-djing", "first", "setup"],
      "dj-controllers-hub.html": ["controller", "ddj", "flx", "xdj", "inpulse", "rane", "mixtrack"],
      "dj-software-hub.html": ["software", "serato", "rekordbox", "traktor", "djay", "virtual-dj", "daw", "ableton", "fl-studio", "logic"],
      "dj-gear-hub.html": ["gear", "headphone", "mixer", "turntable", "cdj", "laptop", "cartridge", "usb", "monitor", "speaker", "stand", "equipment", "budget"],
      "dj-skills-performance-hub.html": ["skill", "mix", "beatmatch", "gig", "wedding", "record", "promote", "festival"]
    };
    Object.keys(groups).forEach(function (target) {
      var link = navLinks.querySelector('a[href="' + target + '"]');
      if (!link) return;
      if (groups[target].some(function (key) { return here.indexOf(key) !== -1; })) {
        link.classList.add("is-current");
      }
    });
    var direct = navLinks.querySelector('a[href="' + here + '"]');
    if (direct) direct.classList.add("is-current");
  })();

  /* ---------- 3. Library filter (all-dj-guides.html) ---------- */
  (function library() {
    var input = document.querySelector("[data-library-input]");
    var chips = document.querySelectorAll(".chip-filter");
    var items = document.querySelectorAll(".library-item");
    var groups = document.querySelectorAll(".library-group");
    var empty = document.querySelector("[data-library-empty]");
    if (!input || !items.length) return;
    var group = "all";

    function apply() {
      var terms = input.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
      var shown = 0;
      items.forEach(function (item) {
        var text = item.getAttribute("data-terms") || "";
        var inGroup = group === "all" || item.getAttribute("data-group") === group;
        var matches = terms.every(function (t) { return text.indexOf(t) !== -1; });
        var visible = inGroup && matches;
        item.hidden = !visible;
        if (visible) shown++;
      });
      groups.forEach(function (section) {
        var has = section.querySelector(".library-item:not([hidden])");
        section.hidden = !has;
      });
      if (empty) empty.hidden = shown !== 0;
    }

    input.addEventListener("input", apply);
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        group = chip.getAttribute("data-filter");
        chips.forEach(function (other) {
          var on = other === chip;
          other.classList.toggle("is-active", on);
          other.setAttribute("aria-pressed", on ? "true" : "false");
        });
        apply();
      });
    });
    apply();
  })();


  /* ---------- 5. Long-guide navigation: contents card + progress bar ---------- */
  (function guideNavigation() {
    var main = document.querySelector("main");
    if (!main) return;
    var headings = [].slice.call(main.querySelectorAll(".content-wrap h2, .page-content h2"))
      .filter(function (h) { return h.textContent.trim().length > 3; });
    if (headings.length < 6) return;

    headings.forEach(function (heading, i) {
      if (!heading.id) {
        heading.id = "section-" + (i + 1) + "-" + heading.textContent.trim()
          .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
      }
    });

    var items = headings.slice(0, 14).map(function (heading) {
      return '<li><a href="#' + heading.id + '">' + heading.textContent.trim() + "</a></li>";
    }).join("");

    var toc = document.createElement("nav");
    toc.className = "toc";
    toc.setAttribute("aria-label", "On this page");
    toc.innerHTML =
      '<details><summary>In this guide <span class="toc-count">' + headings.length +
      ' sections</span></summary><ol class="toc-list">' + items + "</ol></details>";

    var anchor = main.querySelector(".content-wrap > .article-section, .page-content > .article-section");
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(toc, anchor.nextSibling);
    } else {
      main.appendChild(toc);
    }

    // Reading progress
    var bar = document.createElement("div");
    bar.className = "read-progress";
    bar.setAttribute("aria-hidden", "true");
    document.body.appendChild(bar);
    var ticking = false;
    function update() {
      var height = document.documentElement.scrollHeight - window.innerHeight;
      var ratio = height > 0 ? Math.min(1, Math.max(0, window.scrollY / height)) : 0;
      bar.style.transform = "scaleX(" + ratio + ")";
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }, { passive: true });
    update();
  })();

  /* ---------- 6. Search ---------- */
  var overlay = document.getElementById("site-search");
  var openers = document.querySelectorAll("[data-search-open]");
  if (!overlay || !openers.length) return;

  var input = overlay.querySelector("[data-search-input]");
  var results = overlay.querySelector("[data-search-results]");
  var status = overlay.querySelector("[data-search-status]");
  var index = null;
  var loading = false;
  var active = -1;

  function openSearch() {
    overlay.hidden = false;
    document.documentElement.style.overflow = "hidden";
    loadIndex();
    window.setTimeout(function () { input.focus(); }, 30);
  }
  function closeSearch() {
    overlay.hidden = true;
    document.documentElement.style.overflow = "";
    active = -1;
  }

  function loadIndex() {
    if (index || loading) return;
    loading = true;
    fetch("assets/search-index.json")
      .then(function (r) { return r.json(); })
      .then(function (data) { index = data; render(input.value); })
      .catch(function () {
        if (status) status.textContent = "Search index unavailable — browse All DJ Guides instead.";
      });
  }

  function score(item, terms) {
    var hay = (item.t + " " + item.d + " " + item.k).toLowerCase();
    var total = 0;
    for (var i = 0; i < terms.length; i++) {
      var pos = hay.indexOf(terms[i]);
      if (pos === -1) return 0;
      total += pos === 0 ? 6 : 3;
      if (item.t.toLowerCase().indexOf(terms[i]) !== -1) total += 8;
    }
    return total;
  }

  function render(query) {
    if (!index) return;
    var terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    active = -1;
    var list = terms.length
      ? index
          .map(function (item) { return { item: item, s: score(item, terms) }; })
          .filter(function (r) { return r.s > 0; })
          .sort(function (a, b) { return b.s - a.s; })
          .slice(0, 12)
          .map(function (r) { return r.item; })
      : index.filter(function (item) { return item.f; }).slice(0, 8);

    if (status) {
      status.textContent = terms.length
        ? (list.length ? list.length + " results" : "No guides matched that search")
        : "Popular guides";
    }
    results.innerHTML = list.map(function (item) {
      return '<li><a href="' + item.u + '"><span class="search-cat">' + item.c +
        '</span><strong>' + item.t + '</strong><span class="search-desc">' +
        item.d + '</span></a></li>';
    }).join("");
  }

  function move(delta) {
    var links = results.querySelectorAll("a");
    if (!links.length) return;
    active = (active + delta + links.length) % links.length;
    links[active].focus();
  }

  openers.forEach(function (button) {
    button.addEventListener("click", function (event) {
      event.preventDefault();
      openSearch();
    });
  });

  overlay.addEventListener("click", function (event) {
    if (event.target === overlay || event.target.hasAttribute("data-search-close")) closeSearch();
  });

  input.addEventListener("input", function () { render(input.value); });
  input.addEventListener("keydown", function (event) {
    if (event.key === "ArrowDown") { event.preventDefault(); move(1); }
    if (event.key === "ArrowUp") { event.preventDefault(); move(-1); }
    if (event.key === "Enter") {
      var first = results.querySelector("a");
      if (first) window.location.href = first.getAttribute("href");
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !overlay.hidden) closeSearch();
    if ((event.key === "/" || (event.key === "k" && (event.metaKey || event.ctrlKey))) &&
        overlay.hidden && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
      event.preventDefault();
      openSearch();
    }
  });
})();
