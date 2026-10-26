/* Shared product-media renderer.
 * Prefer a verified, licensed model photograph where available; otherwise use the
 * catalog's explicitly labelled technical drawing. Never synthesize a photo.
 */
(function () {
  "use strict";

  var catalogUrl = "assets/dj-gear-catalog.json";
  var productItems = [];
  var customDiagrams = [
    { id: "", brand: "QSC", model: "K10.2", image: "assets/img/products/qsc-k10-2-outline.svg", image_type: "Offbeat line illustration" },
    { id: "", brand: "Hercules", model: "Inpulse 200", image: "assets/img/products/hercules-inpulse-200-outline.svg", image_type: "Offbeat feature schematic" },
    { id: "", brand: "Numark", model: "Mixtrack Pro FX", image: "assets/img/products/numark-mixtrack-pro-fx-outline.svg", image_type: "Offbeat feature schematic" },
    { id: "", brand: "Numark", model: "Party Mix II", image: "assets/img/products/numark-party-mix-ii-outline.svg", image_type: "Offbeat feature schematic" },
    { id: "", brand: "Pioneer DJ", model: "HDJ-X10", image: "assets/img/products/pioneer-hdj-x10-outline.svg", image_type: "Offbeat feature schematic" }
  ];

  function clean(text) { return String(text || "").trim().toLocaleLowerCase(); }

  function findProduct(id, headingText) {
    if (id) {
      var exact = productItems.find(function (item) { return item.id === id; });
      if (exact) return exact;
    }
    var title = clean(headingText);
    return productItems.concat(customDiagrams).map(function (item) {
      var variants = clean(item.model).split("/").map(function (part) { return part.replace(/\s*\([^)]*\)/g, "").trim(); });
      return { item: item, variants: variants };
    }).sort(function (a, b) {
      return Math.max.apply(null, b.variants.map(function (v) { return v.length; })) - Math.max.apply(null, a.variants.map(function (v) { return v.length; }));
    }).find(function (entry) {
      return entry.variants.some(function (model) { return model.length >= 3 && title.indexOf(model) !== -1; });
    })?.item || null;
  }

  function makeFigure(item) {
    var photo = item.product_photo || null;
    var src = photo && photo.src ? photo.src : item.image;
    if (!src) return null;

    var figure = document.createElement("figure");
    figure.className = "ob-product-visual " + (photo ? "ob-product-visual--photo" : "ob-product-visual--schematic");
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
      caption.appendChild(source);
      caption.appendChild(license);
      if (photo.modification) {
        var editNote = document.createElement("span");
        editNote.className = "ob-image-edit-note";
        editNote.textContent = "Edited: " + photo.modification;
        caption.appendChild(editNote);
      }
    } else {
      caption.textContent = "Offbeat technical drawing · not a product photo";
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

    if (item.id) {
      var rigLink = document.createElement("a");
      rigLink.className = "gear-rig-link";
      rigLink.href = "build-your-dj-setup.html?add=" + encodeURIComponent(item.id);
      rigLink.textContent = "Add to Rig Studio";
      rigLink.setAttribute("aria-label", "Add " + item.brand + " " + item.model + " to Rig Studio");
      details.appendChild(rigLink);
    }
  }

  function enhance(root) {
    if (!productItems.length) return;
    root = root || document;
    var headings = Array.prototype.slice.call(root.querySelectorAll(".pick-title"));
    var cards = Array.prototype.slice.call(root.querySelectorAll("[data-product-id]"));

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
