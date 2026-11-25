(function () {
  "use strict";
  var views = Array.from(document.querySelectorAll("main[id^=view-]"));
  function showRoute() {
    var name = YunLiUI.route();
    views.forEach(function (view) { view.hidden = view.id !== "view-" + name; });
    YunLiRenderNav();
    if (name === "fonts") YunLiFonts.enter();
    if (window.YunLiPages) YunLiPages.enter(name);
    if (window.YunLiSpotTools) YunLiSpotTools.enter(name);
  }
  YunLiUI.mountCatalog(document.getElementById("home-groups"), "搜索首页工具", false);
  window.addEventListener("hashchange", showRoute);
  // tools.js 随后加载，首次文档读取由其初始化负责。
  showRoute();
})();
