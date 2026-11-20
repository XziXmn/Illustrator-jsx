(function () {
  "use strict";
  // 页面框架和按钮已在构建时生成，此处只同步业务状态，不再重排 DOM。
  var foot = document.querySelector(".font-foot");
  var modes = ["restore", "overlay", "merge"];
  function syncActions() {
    modes.forEach(function (mode) {
      foot.querySelector('[data-mode="' + mode + '"]').hidden = document.getElementById("tab-" + mode).getAttribute("aria-selected") !== "true";
    });
  }
  new MutationObserver(syncActions).observe(document.querySelector(".modes"), {
    subtree: true, attributes: true, attributeFilter: ["aria-selected"]
  });
  syncActions();

  // 导航和主题统一由 nav.js 负责，此处仅补充字体校对交互。
  document.addEventListener("click", function (event) {
    var head = event.target.closest("#view-fonts .row-head, #view-fonts .row-meta");
    if (!head || event.target.closest("input, button, select, a")) return;
    var row = head.closest(".row");
    var details = row && row.querySelector("details");
    if (!details) return;
    var list = row.parentNode;
    var opened = list.querySelectorAll("details[open]");
    var willOpen = !details.open;
    var n;
    for (n = 0; n < opened.length; n++) opened[n].open = false;
    details.open = willOpen;
  });
})();
