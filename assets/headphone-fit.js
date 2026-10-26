/* Small, progressive fit picker for the 2026 DJ-headphone guide. */
(function () {
  "use strict";

  document.querySelectorAll(".headphone-fit-panel").forEach(function (panel) {
    var choices = Array.from(panel.querySelectorAll('input[name="headphone-use"]'));
    var results = Array.from(panel.querySelectorAll("[data-headphone-fit-result]"));
    if (!choices.length || !results.length) return;

    function update() {
      var selected = choices.find(function (choice) { return choice.checked; });
      if (!selected) return;
      results.forEach(function (result) {
        var active = result.dataset.headphoneFitResult === selected.value;
        result.hidden = !active;
      });
      choices.forEach(function (choice) {
        var label = choice.closest(".headphone-fit-choice");
        if (label) label.classList.toggle("is-selected", choice.checked);
      });
    }

    panel.addEventListener("change", function (event) {
      if (event.target && event.target.matches('input[name="headphone-use"]')) update();
    });
    update();
  });
})();
