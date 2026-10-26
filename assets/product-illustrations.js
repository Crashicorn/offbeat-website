/* Shared product-media renderer.
 * Prefer a verified, licensed model photograph where available; otherwise use the
 * catalog's explicitly labelled technical drawing. Never synthesize a photo.
 *
 * Opt-in hooks in page markup:
 * - .pick-title headings        -> full product card (figure + copy regrouped)
 * - [data-product-id] cards     -> figure into .matrix-media-slot / .gear-shortlist-media
 * - [data-product="<id>"]       -> explicit placement:
 *     on an <h2>/<h3>           card mode (or float with data-product-mode="float")
 *     on any other element      figure is appended into the element (media slot)
 *
 * Media-only library entries (legacy, discontinued or non-Rig-Studio models) carry
 * media_only: true and never generate an "Add to Rig Studio" link.
 */
(function () {
  "use strict";

  var catalogUrl = "assets/dj-gear-catalog.json";
  var productItems = [];
  var customDiagrams = [
    { id: "qsc-k102", brand: "QSC", model: "K10.2", image: "assets/img/products/qsc-k10-2-outline.svg", image_type: "Offbeat line illustration", media_only: true },
    { id: "hercules-inpulse-200", brand: "Hercules", model: "Inpulse 200", image: "assets/img/products/hercules-inpulse-200-outline.svg", image_type: "Offbeat feature schematic", media_only: true },
    { id: "numark-mixtrack-pro-fx", brand: "Numark", model: "Mixtrack Pro FX", image: "assets/img/products/numark-mixtrack-pro-fx-outline.svg", image_type: "Offbeat feature schematic", media_only: true },
    { id: "numark-party-mix-ii", brand: "Numark", model: "Party Mix II", image: "assets/img/products/numark-party-mix-ii-outline.svg", image_type: "Offbeat feature schematic", media_only: true },
    { id: "pioneer-hdj-x10", brand: "Pioneer DJ", model: "HDJ-X10", image: "assets/img/products/pioneer-hdj-x10-outline.svg", image_type: "Offbeat feature schematic", media_only: true },
    { id: "pioneer-cdj-3000", brand: "Pioneer DJ", model: "CDJ-3000", image: "assets/img/products/pioneer-cdj-3000.svg", image_type: "Offbeat technical illustration", media_only: true },
    { id: "denon-sc6000", brand: "Denon DJ", model: "SC6000", image: "assets/img/products/denon-sc6000.svg", image_type: "Offbeat technical illustration", media_only: true },
    { id: "rane-one", brand: "RANE", model: "ONE", match: "RANE ONE", image: "assets/img/products/rane-one.svg", image_type: "Offbeat technical illustration", media_only: true },
    { id: "numark-scratch", brand: "Numark", model: "Scratch", match: "Numark Scratch", image: "assets/img/products/numark-scratch.svg", image_type: "Offbeat technical illustration", media_only: true, tall: true },
    { id: "roland-dj-707m", brand: "Roland", model: "DJ-707M", image: "assets/img/products/roland-dj-707m.svg", image_type: "Offbeat technical illustration", media_only: true },
    { id: "alphatheta-xdj-az", brand: "AlphaTheta", model: "XDJ-AZ", image: "assets/img/products/alphatheta-xdj-az.svg", image_type: "Offbeat technical illustration", media_only: true },
    { id: "pioneer-ddj-flx6", brand: "Pioneer DJ", model: "DDJ-FLX6", image: "assets/img/products/pioneer-ddj-flx6.svg", image_type: "Offbeat technical illustration", media_only: true },
    { id: "pioneer-ddj-400", brand: "Pioneer DJ", model: "DDJ-400", image: "assets/img/products/pioneer-ddj-400.svg", image_type: "Offbeat technical illustration", media_only: true },
    { id: "pioneer-ddj-200", brand: "Pioneer DJ", model: "DDJ-200", image: "assets/img/products/pioneer-ddj-200.svg", image_type: "Offbeat technical illustration", media_only: true },
    { id: "technics-sl-1200mk7", brand: "Technics", model: "SL-1200MK7", image: "assets/img/products/technics-sl-1200mk7.svg", image_type: "Offbeat technical illustration", media_only: true },
    { id: "pioneer-plx-500", brand: "Pioneer DJ", model: "PLX-500", image: "assets/img/products/pioneer-plx-500.svg", image_type: "Offbeat technical illustration", media_only: true },
    { id: "audiotechnica-at-lp120x", brand: "Audio-Technica", model: "AT-LP120X", match: "AT-LP120XBT-USB / AT-LP120XUSB / AT-LP120X", image: "assets/img/products/audiotechnica-at-lp120x.svg", image_type: "Offbeat technical illustration", media_only: true },
    { id: "pioneer-djm-900nxs2", brand: "Pioneer DJ", model: "DJM-900NXS2", image: "assets/img/products/pioneer-djm-900nxs2.svg", image_type: "Offbeat technical illustration", media_only: true, tall: true },
    { id: "allen-heath-xone96", brand: "Allen & Heath", model: "Xone:96", image: "assets/img/products/allen-heath-xone96.svg", image_type: "Offbeat technical illustration", media_only: true },
    { id: "rane-seventy-two-mkii", brand: "RANE", model: "Seventy-Two MKII", image: "assets/img/products/rane-seventy-two-mkii.svg", image_type: "Offbeat technical illustration", media_only: true, tall: true },
    { id: "pioneer-djm-250mk2", brand: "Pioneer DJ", model: "DJM-250MK2", image: "assets/img/products/pioneer-djm-250mk2.svg", image_type: "Offbeat technical illustration", media_only: true, tall: true },
    { id: "allen-heath-xone23", brand: "Allen & Heath", model: "Xone:23", image: "assets/img/products/allen-heath-xone23.svg", image_type: "Offbeat technical illustration", media_only: true, tall: true },
    { id: "ableton-push-3", brand: "Ableton", model: "Push 3", image: "assets/img/products/ableton-push-3.svg", image_type: "Offbeat technical illustration", media_only: true },
    { id: "akai-mpk-mini-mk3", brand: "Akai Professional", model: "MPK Mini MK3", image: "assets/img/products/akai-mpk-mini-mk3.svg", image_type: "Offbeat technical illustration", media_only: true },
    { id: "presonus-eris", brand: "PreSonus", model: "Eris", match: "PreSonus Eris", image: "assets/img/products/presonus-eris.svg", image_type: "Offbeat technical illustration", media_only: true },
    { id: "rane-performer", brand: "RANE", model: "Performer", match: "RANE Performer", image: "assets/img/products/rane-performer.svg", image_type: "Offbeat technical illustration", media_only: true }
  ];

  function clean(text) { return String(text || "").trim().toLocaleLowerCase(); }

  function allItems() { return productItems.concat(customDiagrams); }

  /* Word-boundary-aware contains: prevents "one" matching inside "Pioneer". */
  function containsModel(title, model) {
    if (model.length < 3) return false;
    var from = 0;
    while (true) {
      var idx = title.indexOf(model, from);
      if (idx === -1) return false;
      var before = idx === 0 ? "" : title.charAt(idx - 1);
      var after = title.charAt(idx + model.length);
      if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) return true;
      from = idx + 1;
    }
  }

  function findProduct(id, headingText) {
    if (id) {
      var exact = allItems().find(function (item) { return item.id === id; });
      if (exact) return exact;
    }
    var title = clean(headingText);
    return allItems().map(function (item) {
      var source = item.match || item.model || "";
      var variants = clean(source).split("/").map(function (part) { return part.replace(/\s*\([^)]*\)/g, "").trim(); });
      return { item: item, variants: variants };
    }).sort(function (a, b) {
      return Math.max.apply(null, b.variants.map(function (v) { return v.length; })) - Math.max.apply(null, a.variants.map(function (v) { return v.length; }));
    }).find(function (entry) {
      return entry.variants.some(function (model) { return containsModel(title, model); });
    })?.item || null;
  }

  function rigHref(item) {
    return item && item.id && !item.media_only
      ? "build-your-dj-setup.html?add=" + encodeURIComponent(item.id)
      : null;
  }

  function makeFigure(item, opts) {
    opts = opts || {};
    var photo = opts.preferDrawing ? null : (item.product_photo || null);
    var src = photo && photo.src ? photo.src : item.image;
    if (!src) return null;

    var figure = document.createElement("figure");
    figure.className = "ob-product-visual " + (photo ? "ob-product-visual--photo" : "ob-product-visual--schematic")
      + (item.tall ? " ob-product-visual--tall" : "")
      + (opts.banner ? " ob-product-visual--banner" : "");
    var image = document.createElement("img");
    image.src = src;
    image.alt = photo && photo.alt
      ? photo.alt
      : "Offbeat technical illustration of " + item.brand + " " + item.model + "; not a product photograph";
    image.width = 720;
    image.height = 540;
    image.loading = "lazy";
    image.decoding = "async";
    figure.appendChild(image);

    var caption = document.createElement("figcaption");
    if (photo) {
      var credit = document.createElement("span");
      credit.textContent = "Photo: " + photo.credit + " · " + photo.license;
      var source = document.createElement("a");
      source.href = photo.source;
      source.target = "_blank";
      source.rel = "noopener";
      source.textContent = "Image source";
      var license = document.createElement("a");
      license.href = photo.license_url;
      license.target = "_blank";
      license.rel = "noopener";
      license.textContent = photo.license;
      license.setAttribute("aria-label", photo.license + " license terms for this image");
      caption.appendChild(credit);
      caption.appendChild(document.createTextNode(" · "));
      caption.appendChild(source);
      caption.appendChild(document.createTextNode(" · "));
      caption.appendChild(license);
      if (photo.modification) {
        var editNote = document.createElement("span");
        editNote.className = "ob-image-edit-note";
        editNote.textContent = "Edited: " + photo.modification;
        caption.appendChild(document.createTextNode(" · "));
        caption.appendChild(editNote);
      }
    } else {
      caption.textContent = "Offbeat technical drawing · not a product photo";
    }
    if (opts.captionRigLink && rigHref(item)) {
      var rigLink = document.createElement("a");
      rigLink.className = "ob-figure-rig-link";
      rigLink.href = rigHref(item);
      rigLink.textContent = "Add to Rig Studio →";
      rigLink.setAttribute("aria-label", "Add " + item.brand + " " + item.model + " to Rig Studio");
      caption.appendChild(rigLink);
    }
    figure.appendChild(caption);
    return figure;
  }

  function shouldStopProductGroup(node) {
    if (!node || node.nodeType !== 1) return false;
    return node.matches("h2, h3.pick-title, .faq-section, .related-articles, .author-box");
  }

  function enhanceHeading(heading, item) {
    if (!item || heading.dataset.productMediaReady === "true") return;
    var section = heading.closest(".product-section-card, .article-section, section");
    if (!section) return;
    if (section.querySelector(".ob-product-visual, .speaker-product-figure")) return;
    var figure = makeFigure(item);
    if (!figure) return;

    var wrapper;
    var details = document.createElement("div");
    details.className = "gear-product-copy";

    if (heading.tagName.toLowerCase() === "h3") {
      wrapper = document.createElement("article");
      wrapper.className = "gear-product-card";
      wrapper.dataset.productId = item.id;
      section.insertBefore(wrapper, heading);
      wrapper.appendChild(heading);
      wrapper.appendChild(figure);
      wrapper.appendChild(details);

      var sibling = wrapper.nextSibling;
      while (sibling && !shouldStopProductGroup(sibling)) {
        var next = sibling.nextSibling;
        details.appendChild(sibling);
        sibling = next;
      }
    } else {
      wrapper = section;
      wrapper.classList.add("gear-product-card");
      wrapper.dataset.productId = item.id;
      var groupedNodes = [];
      var content = heading.nextSibling;
      while (content && !shouldStopProductGroup(content)) {
        groupedNodes.push(content);
        content = content.nextSibling;
      }
      heading.insertAdjacentElement("afterend", figure);
      heading.insertAdjacentElement("afterend", details);
      wrapper.insertBefore(figure, details);
      groupedNodes.forEach(function (node) { details.appendChild(node); });
    }

    heading.classList.add("gear-product-heading");
    heading.dataset.productMediaReady = "true";

    if (rigHref(item)) {
      var rigLink = document.createElement("a");
      rigLink.className = "gear-rig-link";
      rigLink.href = rigHref(item);
      rigLink.textContent = "Add to Rig Studio";
      rigLink.setAttribute("aria-label", "Add " + item.brand + " " + item.model + " to Rig Studio");
      details.appendChild(rigLink);
    }
  }

  /* Explicit placement: [data-product="<id>"] authored in the page.
   * - on h2/h3: card mode by default; float mode with data-product-mode="float"
   *   (figure only, inserted after the heading; no content regrouping)
   * - on other elements: treated as an empty media slot (figure appended inside)
   */
  function enhanceExplicit(el) {
    if (el.dataset.productMediaReady === "true") return;
    var item = findProduct(el.dataset.product, el.textContent);
    if (!item) return;
    var tag = el.tagName.toLowerCase();
    var preferDrawing = el.dataset.media === "drawing";
    if (tag === "h2" || tag === "h3") {
      if (el.dataset.productMode === "float" || el.dataset.productMode === "banner") {
        var host = el.parentElement;
        if (host && host.querySelector(".ob-product-visual")) return;
        var figure = makeFigure(item, {
          captionRigLink: true,
          preferDrawing: preferDrawing,
          banner: el.dataset.productMode === "banner"
        });
        if (!figure) return;
        el.insertAdjacentElement("afterend", figure);
        el.dataset.productMediaReady = "true";
      } else {
        enhanceHeading(el, item);
      }
      return;
    }
    if (el.querySelector(".ob-product-visual")) return;
    var slotFigure = makeFigure(item, { captionRigLink: true, preferDrawing: preferDrawing });
    if (!slotFigure) return;
    el.appendChild(slotFigure);
    el.dataset.productMediaReady = "true";
  }

  function enhance(root) {
    if (!productItems.length && !customDiagrams.length) return;
    root = root || document;
    var headings = Array.prototype.slice.call(root.querySelectorAll(".pick-title"));
    var cards = Array.prototype.slice.call(root.querySelectorAll("[data-product-id]"));
    var explicit = Array.prototype.slice.call(root.querySelectorAll("[data-product]"));

    headings.forEach(function (heading) {
      var label = heading.querySelector(".pick-name") || heading;
      enhanceHeading(heading, findProduct("", label.textContent));
    });

    cards.forEach(function (card) {
      var slot = card.querySelector(".matrix-media-slot, .gear-shortlist-media");
      if (!slot || slot.querySelector(".ob-product-visual")) return;
      var item = findProduct(card.dataset.productId, "");
      if (!item) return;
      var figure = makeFigure(item);
      if (figure) slot.appendChild(figure);
    });

    explicit.forEach(enhanceExplicit);
  }

  window.OffbeatProductMedia = {
    refresh: function (root) { enhance(root || document); }
  };

  fetch(catalogUrl)
    .then(function (response) {
      if (!response.ok) throw new Error("Product catalog unavailable");
      return response.json();
    })
    .then(function (catalog) {
      productItems = catalog.items || [];
      enhance(document);
    })
    .catch(function () { /* Text, comparison data and official links remain usable. */ });
})();
