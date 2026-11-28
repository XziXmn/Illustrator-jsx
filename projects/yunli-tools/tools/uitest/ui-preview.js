// 本地 UI 回归专用模拟桥，禁止复制到 panel 或发布产物。
(function () {
  "use strict";
  var listeners = [];
  var pixel = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
  var fonts = [
    { name: "MicrosoftYaHei", family: "微软雅黑", style: "Regular" },
    { name: "SimHei", family: "黑体", style: "Regular" }
  ];
  function reply(message, data, error) {
    var encoded = btoa(unescape(encodeURIComponent(JSON.stringify({ id: message.id, ok: !error, data: data, error: error }))));
    window.__yunliDeliver(encoded);
  }
  function host(payload) {
    switch (payload.action) {
      case "ping": return { version: "30.0", name: "Illustrator UI 预览" };
      case "fonts": return fonts;
      case "capture": return { token: "ui-preview", bounds: [0, 200, 400, 0], count: 1, artboards: 1 };
      case "rebuild": return { count: payload.payload.lines.length, overlay: true };
      case "mergeText": return { count: 3 };
      case "splitText": return { count: 1, lines: 3 };
      default: throw Error("UI 模拟桥不支持 host 操作：" + payload.action);
    }
  }
  function handle(message) {
    if (typeof message === "string") {
      var parsed = JSON.parse(message);
      if (parsed.action === "hello") listeners.slice().forEach(function (fn) {
        fn({ data: JSON.stringify({ action: "hello", version: "0.2.0", standalone: true }) });
      });
      return;
    }
    if (message.method === "tool") {
      var action = message.payload.action;
      if (action === "inspect") return reply(message, {
        name: "包装印刷项目-多画板与专色-UI验证示例.ai",
        artboards: ["正面包装", "背面包装", "侧面包装", "长名称画板-工艺分色与白墨输出验证-04"],
        spots: ["烫金", "白墨", "PANTONE 1205 C"], selection: 0, desktop: "C:\\UI-preview"
      });
      if (action === "pickFolder") return reply(message, { path: "C:\\UI-preview\\TIFF" });
      if (action === "preview") {
        if (new URLSearchParams(location.search).has("preview-error")) return reply(message, null, "模拟取图失败，请刷新后重试。");
        var index = message.payload.payload.index;
        var limit = message.payload.payload.mode === "full" ? 600 : 64;
        var canvas = document.createElement("canvas");
        canvas.width = index % 2 ? limit : Math.round(limit * 2 / 3);
        canvas.height = index % 2 ? Math.round(limit * 2 / 3) : limit;
        var drawing = canvas.getContext("2d");
        drawing.fillStyle = "#ffffff";
        drawing.fillRect(0, 0, canvas.width, canvas.height);
        drawing.fillStyle = ["#4d6bfe", "#27846e", "#b46a37", "#8c5d9a"][index % 4];
        drawing.fillRect(canvas.width * .12, canvas.height * .12, canvas.width * .76, canvas.height * .45);
        drawing.fillStyle = "#242b37";
        drawing.font = Math.max(4, Math.round(limit * .07)) + 'px "Microsoft YaHei", sans-serif';
        drawing.fillText("UI 预览示例 " + (index + 1), canvas.width * .08, canvas.height * .73);
        return reply(message, { image: canvas.toDataURL("image/png"), index: index });
      }
      if (action === "export") document.documentElement.setAttribute("data-ui-export", JSON.stringify(message.payload.payload));
      if (action === "marks" || action === "export") return reply(message, { done: true });
      if (action === "splitInspect") return reply(message, {
        rasterCount: 1, rectCount: 50, placedCount: 0, overlapCount: 50,
        width: 4800, height: 3600, bitsPerPixel: 16, hasAlpha: true, dpiX: 600, dpiY: 600,
        colorSpace: "灰度(带透明)", spot: "烫金", tint: 100
      });
      if (action === "splitRun") return reply(message, {
        count: 50, skipped: 0, width: 4800, height: 3600, dpi: 600,
        applyMask: !!(message.payload.payload && message.payload.payload.applyMask),
        elapsedMs: 120, layer: "图片分切_烫金", spot: "烫金", colorSpace: "灰度(带透明)"
      });
      if (action === "batchMaskInspect") return reply(message, {
        dieCutCount: 12, contentCount: 14, matchedDieCuts: 12, sharedContents: 2, usedMode: "nofill"
      });
      if (action === "batchMaskRun") return reply(message, {
        count: 12, skipped: 0, duplicated: 2, maskedItems: 16, dieCutCount: 12, elapsedMs: 85, usedMode: "nofill"
      });
      if (action === "spotSelectInspect") return reply(message, {
        spots: ["烫金", "白墨", "PANTONE 1205 C"], selection: 1,
        sample: { spot: "烫金", percent: 50, where: "fill" }
      });
      if (action === "spotSelectRun") {
        var p = message.payload.payload || {};
        return reply(message, { matched: 12, spot: p.spot || "烫金", mode: p.mode || "eq", percent: p.percent });
      }
      throw Error("UI 模拟桥不支持 tool 操作：" + action);
    }
    if (message.method === "host") return reply(message, host(message.payload));
    if (message.method === "cleanup") return reply(message, {});
    if (message.method === "ocr") return reply(message, {
      native: true, width: 400, height: 200,
      lines: ["云漫文字校对示例", "包装印刷与字体恢复", "长名称与多行内容布局验证"].map(function (text, index) {
        return { text: text, stable: false, confidence: .8, x: .1, y: .8 - index * .2, width: .7, height: .1, angle: 0, preview: pixel };
      })
    });
    if (message.method === "match") return reply(message, {
      rows: message.payload.lines.map(function (line, index) {
        return { index: index, original: pixel, candidates: [
          { name: "MicrosoftYaHei", similarity: .88, preview: pixel },
          { name: "SimHei", similarity: .82, preview: pixel }
        ] };
      })
    });
    throw Error("UI 模拟桥不支持方法：" + message.method);
  }
  window.chrome = window.chrome || {};
  window.chrome.webview = {
    addEventListener: function (type, fn) { if (type === "message") listeners.push(fn); },
    removeEventListener: function (type, fn) { listeners = listeners.filter(function (item) { return item !== fn; }); },
    postMessage: function (message) { setTimeout(function () { handle(message); }, 20); }
  };
  // 首帧采样仅用于本地检查，记录共享框架是否一开始就已存在及是否发生位移。
  if (new URLSearchParams(location.search).has("frame-audit")) {
    var samples = [], layoutShift = 0, startedAt = null, readyFrames = 0;
    if (typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes.indexOf("layout-shift") >= 0) {
      new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (entry) { if (startedAt !== null && entry.startTime >= startedAt && !entry.hadRecentInput) layoutShift += entry.value; });
      }).observe({ type: "layout-shift", buffered: true });
    }
    requestAnimationFrame(function sample() {
      var main = document.querySelector(".font-page");
      if (main && !main.hidden) {
        if (startedAt === null) startedAt = performance.now();
        var header = document.querySelector(".app-header"), foot = main.querySelector(".page-foot"), scroll = main.querySelector(".page-scroll"), tabs = main.querySelector(".modes");
        samples.push({ header: !!header, foot: !!foot, scroll: !!scroll,
          footerTop: foot ? foot.getBoundingClientRect().top : null,
          tabsTop: tabs ? tabs.getBoundingClientRect().top : null });
        readyFrames = main.getAttribute("aria-busy") === "true" ? 0 : readyFrames + 1;
      }
      if (samples.length < 20 || readyFrames < 5) requestAnimationFrame(sample);
      else {
        var output = document.createElement("output");
        output.id = "font-frame-audit";
        output.hidden = true;
        output.textContent = JSON.stringify({ samples: samples, layoutShift: layoutShift });
        document.body.appendChild(output);
      }
    });
  }
})();
