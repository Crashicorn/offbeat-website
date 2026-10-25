/* Add clearly-labelled, local product schematics to the buying guides that name them. */
(function () {
  "use strict";
  var headings = Array.from(document.querySelectorAll(".pick-title"));
  if (!headings.length) return;
  fetch("assets/dj-gear-catalog.json")
    .then(function (response) { if (!response.ok) throw new Error("Catalog unavailable"); return response.json(); })
    .then(function (catalog) {
      var products = (catalog.items || []).filter(function (item) {
        return item.image && item.image_type === "schematic_vector";
      });
      headings.forEach(function (heading) {
        var titleNode = heading.querySelector(".pick-name") || heading;
        var title = (titleNode.textContent || "").toLocaleLowerCase();
        var item = products.slice().sort(function (a, b) { return b.model.length - a.model.length; }).find(function (product) {
          return title.indexOf(product.model.toLocaleLowerCase()) !== -1;
        });
        if (!item) return;
        var section = heading.closest(".product-section-card, .article-section, section") || heading.parentElement;
        if (!section || section.querySelector(".ob-product-visual")) return;
        var figure = document.createElement("figure");
        figure.className = "ob-product-visual";
        var image = document.createElement("img");
        image.src = item.image;
        image.alt = "Offbeat schematic illustration of " + item.brand + " " + item.model + "; not a product photograph";
        image.width = 600;
        image.height = 360;
        image.loading = "lazy";
        image.decoding = "async";
        var caption = document.createElement("figcaption");
        caption.textContent = "Offbeat schematic · illustration, not a product photo";
        figure.appendChild(image);
        figure.appendChild(caption);
        heading.insertAdjacentElement("afterend", figure);
      });
    })
    .catch(function () { /* Editorial text and verified photo credits remain available. */ });
})();
