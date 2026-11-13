// YunLi工具箱：连接状态写在顶栏，不再占用主界面。
(function () {
  "use strict";
  var statusEl = document.getElementById("bridge-status");
  var versionEl = document.getElementById("version");
  var badgeEl = document.getElementById("mode-badge");

  function send(obj) {
    if (window.chrome && window.chrome.webview) {
      window.chrome.webview.postMessage(JSON.stringify(obj));
      return true;
    }
    return false;
  }

  function show(ok, text) {
    statusEl.textContent = text;
    statusEl.className = "conn" + (ok ? " ok" : " err");
  }

  window.yunli = window.yunli || {};
  window.yunli.send = send;

  document.addEventListener("DOMContentLoaded", function () {
    if (!send({ action: "hello" })) {
      show(false, "未连接");
    }
  });

  if (window.chrome && window.chrome.webview && window.chrome.webview.addEventListener) {
    window.chrome.webview.addEventListener("message", function (ev) {
      var data;
      try { data = JSON.parse(ev.data); } catch (e) { return; }
      if (data.action === "hello") {
        versionEl.textContent = "v" + data.version;
        if (data.standalone) badgeEl.hidden = false;
        show(true, "已连接");
      }
    });
  }
})();
