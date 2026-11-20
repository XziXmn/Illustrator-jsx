// PDF 转曲不经过 Illustrator：选一个 PDF，在它所在目录写出「原名-转曲.pdf」。
(function () {
  "use strict";
  var file = "";

  function $(id) { return document.getElementById(id); }
  function setStatus(text, kind) {
    var el = $("pdf-status");
    el.textContent = text;
    el.className = "status" + (kind ? " " + kind : "");
  }

  $("pdf-browse").addEventListener("click", function () {
    YunLiTool.request("pickFiles", { single: true }).then(function (data) {
      var picked = data && data.files && data.files[0];
      if (!picked) return;
      file = picked;
      $("pdf-file").value = picked;
      $("pdf-results").textContent = "";
      setStatus("结果将写在这个文件旁边，不修改原文件。", "");
    }).catch(function (e) { setStatus(e.message, "err"); });
  });

  $("pdf-run").addEventListener("click", function () {
    if (!file) { setStatus("请先选择 PDF。", "err"); return; }
    var button = this;
    button.disabled = true;
    setStatus("正在转曲…", "");
    $("pdf-results").textContent = "";
    YunLiTool.requestNative("tool", { action: "pdfOutline", payload: { files: [file] } }, function (progress) {
      if (progress && progress.file) setStatus("正在转曲…", "");
    }).then(function (data) {
      var list = data && data.files || [];
      var box = $("pdf-results");
      box.textContent = "";
      var failed = false;
      list.forEach(function (item) {
        var row = document.createElement("p");
        row.className = "hint";
        if (item.ok === false) {
          failed = true;
          row.textContent = item.error;
        } else {
          row.textContent = item.note + " " + (item.output || "").replace(/^.*[\\/]/, "");
        }
        box.appendChild(row);
      });
      setStatus(failed ? "转曲失败。" : "转曲完成。", failed ? "err" : "ok");
    }).catch(function (e) {
      setStatus(e.message, "err");
    }).then(function () { button.disabled = false; });
  });
})();
