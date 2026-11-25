// 各视图共用消息桥与请求编号，字体模块不再覆盖全局响应处理器。
(function () {
  "use strict";
  var channel = window.chrome && window.chrome.webview;
  var next = 0;
  var pending = {};
  window.__yunliDeliver = function (encoded) {
    var bytes = Uint8Array.from(atob(encoded), function (c) { return c.charCodeAt(0); });
    var message = JSON.parse(new TextDecoder().decode(bytes));
    if (!message.id && message.eventType) {
      window.dispatchEvent(new CustomEvent("yunli:" + message.eventType, { detail: message.data || {} }));
      return;
    }
    var entry = pending[message.id];
    if (!entry) return;
    if (message.eventType === "progress") {
      if (entry.progress) entry.progress(message.data);
      return;
    }
    delete pending[message.id];
    if (message.ok) entry.resolve(message.data);
    else entry.reject(Error(message.error || "文档操作未完成。"));
  };
  function requestNative(method, payload, progress) {
      return new Promise(function (resolve, reject) {
        if (!channel) {
          reject(Error("请从 Illustrator 的「窗口 → YunLi工具箱」打开。"));
          return;
        }
        var id = "t" + (++next);
        pending[id] = { resolve: resolve, reject: reject, progress: progress };
        try {
          channel.postMessage({ id: id, method: method, payload: payload || {} });
        } catch (e) {
          delete pending[id];
          reject(e);
        }
      });
  }
  window.YunLiTool = {
    requestNative: requestNative,
    request: function (action, payload) { return requestNative("tool", { action: action, payload: payload || {} }); }
  };
})();
