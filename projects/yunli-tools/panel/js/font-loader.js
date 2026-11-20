// 字体视图留在同一文档中；首次进入才加载 OCR 资源，之后保留模块和校对状态。
(function () {
  "use strict";
  var base = new URL("../", document.currentScript.src);
  var loaded = {}, loading = null;
  var files = ["font/js/core.js", "font/ocr/paddle/ort.wasm.min.js", "font/js/paddle-ocr.js",
    "font/ocr/tesseract.min.js", "font/js/native-runtime.js", "font/theme.js", "font/font-suggest.js", "font/js/panel.js"];
  function script(file) {
    if (loaded[file]) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var node = document.createElement("script");
      node.src = new URL(file + "?v=25", base).href;
      node.onload = function () { loaded[file] = true; resolve(); };
      node.onerror = function () { node.remove(); reject(Error("字体资源加载失败，请重试或重新构建项目。")); };
      document.head.appendChild(node);
    });
  }
  function enter() {
    if (loading) return loading;
    var main = document.getElementById("view-fonts");
    var status = document.getElementById("restore-status");
    var retry = document.getElementById("font-retry");
    if (!status || !retry) return Promise.resolve();
    main.inert = true;
    main.setAttribute("aria-busy", "true");
    status.textContent = "正在加载字体工具…";
    retry.hidden = true;
    loading = files.reduce(function (chain, file) { return chain.then(function () { return script(file); }); }, Promise.resolve()).then(function () {
      main.inert = false;
      main.setAttribute("aria-busy", "false");
    }).catch(function (error) {
      main.inert = false;
      main.setAttribute("aria-busy", "false");
      status.textContent = error.message;
      status.className = "error";
      retry.hidden = false;
      loading = null;
    });
    return loading;
  }
  var retry = document.getElementById("font-retry");
  if (retry) retry.addEventListener("click", enter);
  window.YunLiFonts = { enter: enter };
})();
