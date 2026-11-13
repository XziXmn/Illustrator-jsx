// 两个输出通道共用缩略图请求与大图查看器。只生成进入可见区域的缩略图。
(function () {
  "use strict";
  var context = null, generation = 0, viewerSerial = 0;
  var observer = null, chain = Promise.resolve();
  var dialog = document.getElementById("artboard-preview");
  var image = document.getElementById("preview-image");
  var stage = document.getElementById("preview-stage");
  var status = document.getElementById("preview-status");
  var scale = document.getElementById("preview-scale");
  document.getElementById("preview-close").appendChild(YunLiUI.icon("close"));
  document.getElementById("ex-refresh").appendChild(YunLiUI.icon("refresh"));
  document.getElementById("preview-close").addEventListener("click", function () { dialog.close(); });
  dialog.addEventListener("close", function () {
    viewerSerial++;
    image.hidden = true;
    image.removeAttribute("src");
  });
  scale.addEventListener("click", function () {
    var actual = stage.classList.toggle("actual-size");
    scale.textContent = actual ? "适合窗口" : "原尺寸";
    stage.scrollTop = stage.scrollLeft = 0;
  });
  function validImage(data) {
    if (!data || typeof data.image !== "string" || data.image.indexOf("data:image/png;base64,") !== 0) {
      throw Error("未收到画板预览，请刷新后重试。");
    }
    return data.image;
  }
  function open(index, name) {
    var serial = ++viewerSerial;
    document.getElementById("preview-title").textContent = name;
    image.alt = name + " · 画板内容";
    image.hidden = true;
    scale.disabled = true;
    scale.textContent = "原尺寸";
    stage.classList.remove("actual-size");
    status.textContent = "正在读取预览…";
    dialog.showModal();
    if (!context) { status.textContent = "请先刷新画板列表。"; return; }
    YunLiTool.request("preview", { document: context.name, index: index, mode: "full" }).then(function (data) {
      if (serial !== viewerSerial || !dialog.open) return;
      image.src = validImage(data);
    }).catch(function (error) {
      if (serial === viewerSerial && dialog.open) status.textContent = error.message;
    });
  }
  image.addEventListener("load", function () {
    if (!dialog.open) return;
    image.hidden = false;
    scale.disabled = false;
    status.textContent = "点击原尺寸可滚动查看细节。";
  });
  image.addEventListener("error", function () {
    if (dialog.open) status.textContent = "预览图片无法显示，请关闭后重试。";
  });
  function button(index, name) {
    var node = document.createElement("button");
    node.type = "button";
    node.className = "board-preview";
    node.setAttribute("data-board-index", String(index));
    node.setAttribute("aria-label", "查看画板：" + name);
    node.title = "点击放大预览：" + name;
    node.appendChild(YunLiUI.icon("image"));
    node.addEventListener("click", function () { open(index, name); });
    return node;
  }
  function pause() {
    generation++;
    if (observer) observer.disconnect();
  }
  function refresh(data) {
    pause();
    context = { name: data.name };
    var token = generation, seen = {};
    var nodes = Array.from(document.querySelectorAll(".board-preview"));
    nodes.forEach(function (node) {
      node.replaceChildren(YunLiUI.icon("image"));
      node.removeAttribute("data-preview-error");
    });
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var index = Number(entry.target.getAttribute("data-board-index"));
        if (!entry.isIntersecting || seen[index]) return;
        seen[index] = true;
        chain = chain.then(function () {
          if (token !== generation) return;
          return YunLiTool.request("preview", { document: data.name, index: index, mode: "thumb" }).then(function (result) {
            if (token !== generation) return;
            var src = validImage(result);
            nodes.filter(function (node) { return Number(node.getAttribute("data-board-index")) === index; }).forEach(function (node) {
              var img = document.createElement("img");
              img.alt = "";
              img.src = src;
              node.replaceChildren(img);
              node.title = "点击放大预览：" + data.artboards[index];
            });
          });
        }).catch(function (error) {
          if (token !== generation) return;
          nodes.filter(function (node) { return Number(node.getAttribute("data-board-index")) === index; }).forEach(function (node) {
            node.setAttribute("data-preview-error", "true");
            node.title = "缩略图未生成，点击查看或重试：" + error.message;
          });
        });
      });
    });
    nodes.forEach(function (node) { observer.observe(node); });
  }
  window.YunLiExportPreview = { button: button, refresh: refresh, pause: pause };
})();
