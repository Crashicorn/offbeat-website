/* Price-your-own-system subtotal for the turntable guide; no live price claims. */
(function () {
  "use strict";
  document.querySelectorAll("[data-turntable-budget]").forEach(function (form) {
    var total = form.querySelector("[data-tt-total]");
    var count = form.querySelector("[data-tt-count]");
    var unit = form.querySelector("[data-tt-unit]");
    var quantity = form.querySelector("[data-tt-quantity]");
    var prices = Array.from(form.querySelectorAll("[data-tt-price]"));
    if (!total || !count || !unit || !quantity) return;
    function amount(input) {
      if (input.value.trim() === "") return null;
      var value = Number(input.value);
      return Number.isFinite(value) && value >= 0 ? value : null;
    }
    function refresh() {
      var entered = 0;
      var sum = 0;
      var deck = amount(unit);
      if (deck !== null) { sum += deck * Number(quantity.value); entered += 1; }
      prices.forEach(function (input) {
        var value = amount(input);
        if (value !== null) { sum += value; entered += 1; }
      });
      total.textContent = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(sum);
      count.textContent = entered + " of 7 cost lines entered";
      total.dataset.partial = entered > 0 && entered < 7 ? "true" : "false";
    }
    form.addEventListener("input", refresh);
    form.addEventListener("change", refresh);
    refresh();
  });
})();
