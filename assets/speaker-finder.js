/* Room-first speaker finder for the Offbeat monitor / PA guide. */
(function () {
  "use strict";

  document.querySelectorAll(".speaker-finder").forEach(function (finder) {
    var choices = Array.prototype.slice.call(finder.querySelectorAll('input[name="speaker-use"]'));
    var results = Array.prototype.slice.call(finder.querySelectorAll("[data-speaker-result]"));
    var products = Array.prototype.slice.call(document.querySelectorAll("[data-speaker-pick]"));
    if (!choices.length || !results.length) return;

    function update() {
      var selected = choices.find(function (choice) { return choice.checked; });
      if (!selected) return;

      results.forEach(function (result) {
        result.hidden = result.dataset.speakerResult !== selected.value;
      });

      choices.forEach(function (choice) {
        var label = choice.closest(".speaker-choice");
        if (label) label.classList.toggle("is-selected", choice.checked);
      });

      products.forEach(function (product) {
        var match = product.dataset.speakerPick === selected.value;
        product.classList.toggle("is-recommended", match);
        var badge = product.querySelector(".speaker-recommended");
        if (badge) badge.hidden = !match;
      });
    }

    finder.addEventListener("change", function (event) {
      if (event.target && event.target.matches('input[name="speaker-use"]')) update();
    });
    update();
  });
})();
