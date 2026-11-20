// 标记保持左右分区；导出通道共用模板，窄窗口上下排列。
(function () {
  "use strict";
  var channelTemplate = document.getElementById("export-channel");
  [{ id: "cmyk", title: "四色" }, { id: "gray", title: "工艺" }].forEach(function (channel) {
    var content = channelTemplate.content.cloneNode(true);
    content.querySelector("h2").textContent = channel.title;
    content.querySelectorAll("[data-id]").forEach(function (node) {
      var key = node.getAttribute("data-id");
      node.id = "ex-" + channel.id + "-" + key;
      if (key === "aa" || key === "ppi") node.setAttribute("aria-label", channel.title + (key === "aa" ? "抗锯齿" : " PPI"));
    });
    document.getElementById("export-channels").appendChild(content);
  });
  var doc = null;
  var signature = "";
  var processes = ["无", "烫金", "烫银", "UV1", "UV2", "UV3", "UV4", "UV5"];

  function $(id) { return document.getElementById(id); }
  function setStatus(id, text, kind) {
    var el = $(id);
    el.textContent = text;
    el.title = text;
    el.className = "status" + (kind ? " " + kind : "");
  }
  function num(id) {
    var value = Number(String($(id).value).replace(/^\s+|\s+$/g, ""));
    return isFinite(value) ? value : null;
  }

  function syncMarkLocks() {
    var selection = doc && doc.selection > 0;
    var inside = $("mk-side").value === "in";
    var hot = $("mk-hot").checked && !selection;
    $("mk-hot").disabled = selection;
    if (selection) $("mk-hot").checked = false;
    $("mk-white").disabled = !hot;
    if (!hot) $("mk-white").checked = false;
    $("mk-adapt").disabled = selection || inside;
    if (selection || inside) $("mk-adapt").checked = false;
    $("mk-corner").disabled = inside;
    if (inside) $("mk-corner").checked = false;
    var bisectOn = $("mk-bisect").checked;
    var infoOn = $("mk-info").checked;
    var sepOn = $("mk-sep").checked;
    $("mk-bisect-box").classList.toggle("is-off", !bisectOn);
    $("mk-note-box").classList.toggle("is-off", !infoOn);
    $("mk-spot-box").classList.toggle("is-off", !sepOn);
    $("mk-comment").disabled = !infoOn;
    var fields = $("mk-bisect-box").querySelectorAll("input");
    var spots = $("mk-spots").querySelectorAll("input");
    var n;
    for (n = 0; n < fields.length; n++) fields[n].disabled = !bisectOn;
    for (n = 0; n < spots.length; n++) spots[n].disabled = !sepOn;
  }

  function fillSpots(names) {
    var box = $("mk-spots");
    box.textContent = "";
    if (!names || !names.length) {
      var empty = document.createElement("span");
      empty.className = "hint";
      empty.textContent = "当前文档没有专色。";
      box.appendChild(empty);
      return;
    }
    var i;
    for (i = 0; i < names.length; i++) {
      var label = document.createElement("label");
      label.className = "check";
      var input = document.createElement("input");
      input.type = "checkbox";
      input.setAttribute("data-name", names[i]);
      label.appendChild(input);
      label.appendChild(document.createTextNode(names[i]));
      box.appendChild(label);
    }
  }

  function fillBoards(containerId, names) {
    var box = $(containerId);
    box.textContent = "";
    if (!names.length) {
      var empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "当前文档没有可导出的画板。";
      box.appendChild(empty);
    }
    var i, n;
    for (i = 0; i < names.length; i++) {
      var row = document.createElement("div");
      row.className = "board";
      var label = document.createElement("label");
      label.className = "check";
      var input = document.createElement("input");
      input.type = "checkbox";
      input.setAttribute("data-name", names[i]);
      label.appendChild(input);
      var name = document.createElement("span");
      name.className = "board-name";
      name.textContent = names[i];
      name.title = names[i];
      label.appendChild(name);
      var select = document.createElement("select");
      select.disabled = true;
      select.setAttribute("aria-label", names[i] + " 工艺");
      for (n = 0; n < processes.length; n++) {
        var option = document.createElement("option");
        option.textContent = processes[n];
        select.appendChild(option);
      }
      input.addEventListener("change", function () {
        this.parentNode.parentNode.querySelector("select").disabled = !this.checked;
      });
      row.appendChild(YunLiExportPreview.button(i, names[i]));
      row.appendChild(label);
      row.appendChild(select);
      box.appendChild(row);
    }
  }

  function chosenSpots() {
    var boxes = $("mk-spots").querySelectorAll("input");
    var names = [];
    var i;
    for (i = 0; i < boxes.length; i++) if (boxes[i].checked) names.push(boxes[i].getAttribute("data-name"));
    return names;
  }

  function chosenBoards(containerId) {
    var rows = $(containerId).querySelectorAll(".board");
    var list = [];
    var i;
    for (i = 0; i < rows.length; i++) {
      var box = rows[i].querySelector("input");
      if (!box.checked) continue;
      list.push({ name: box.getAttribute("data-name"), process: rows[i].querySelector("select").value });
    }
    return list;
  }

  function loadDoc() {
    return YunLiTool.request("inspect").then(function (data) {
      doc = data;
      var file = document.getElementById("doc-name");
      if (file) file.textContent = data.name;
      if (!$("ex-folder").value && data.desktop) $("ex-folder").value = data.desktop;
      var next = JSON.stringify([data.name, data.artboards, data.spots, data.selection]);
      if (next !== signature) {
        signature = next;
        fillSpots(data.spots || []);
        fillBoards("ex-cmyk-boards", data.artboards || []);
        fillBoards("ex-gray-boards", data.artboards || []);
      }
      syncMarkLocks();
      var where = data.selection > 0 ? "已选中对象，按选区生成。" : "按画板生成。";
      setStatus("marks-status", data.name + " · " + where, "");
      setStatus("export-status", data.name + " · " + (data.artboards || []).length + " 个画板", "");
      $("marks-run").disabled = false;
      $("export-run").disabled = false;
      return data;
    });
  }

  window.YunLiPages = {
    enter: function (name) {
      if (name !== "export") YunLiExportPreview.pause();
      if (name !== "marks" && name !== "export" && name !== "home") return;
      loadDoc().then(function (data) {
        if (name === "export") YunLiExportPreview.refresh(data);
      }).catch(function (e) {
        YunLiExportPreview.pause();
        doc = null;
        $("marks-run").disabled = true;
        $("export-run").disabled = true;
        setStatus("marks-status", e.message, "err");
        setStatus("export-status", e.message, "err");
      });
    }
  };

  $("ex-refresh").addEventListener("click", function () { window.YunLiPages.enter("export"); });

  ["mk-side", "mk-hot", "mk-bisect", "mk-info", "mk-sep"].forEach(function (id) {
    $(id).addEventListener("change", syncMarkLocks);
  });
  $("mk-align").addEventListener("change", function () {
    // 原版行为:勾选对位线时强制线宽 0.04mm(细线才能与切割线区分)
    if (this.checked) $("mk-stroke").value = "0.04";
  });

  $("ex-browse").addEventListener("click", function () {
    YunLiTool.request("pickFolder").then(function (data) {
      if (data && data.path) $("ex-folder").value = data.path;
    }).catch(function (e) { setStatus("export-status", e.message, "err"); });
  });

  $("marks-run").addEventListener("click", function () {
    if (this.disabled) return;
    var size = num("mk-size");
    var offset = num("mk-offset");
    var stroke = num("mk-stroke");
    if (size === null || offset === null || size < 4 || offset < 0) {
      setStatus("marks-status", "标记大小必须大于等于 4mm，偏移大于等于 0。", "err");
      return;
    }
    if (stroke === null || stroke <= 0) {
      setStatus("marks-status", "线宽必须是大于 0 的数字。", "err");
      return;
    }
    var hCount = num("mk-hcount");
    var vCount = num("mk-vcount");
    var hSpace = num("mk-hspace");
    var vSpace = num("mk-vspace");
    if (hCount === null || vCount === null || hCount < 1 || vCount < 1 || hCount !== Math.floor(hCount) || vCount !== Math.floor(vCount)) {
      setStatus("marks-status", "等分线的水平数和垂直数必须是大于等于 1 的整数。", "err");
      return;
    }
    if (hSpace === null || vSpace === null || hSpace < 0 || vSpace < 0) {
      setStatus("marks-status", "等分线间距必须大于等于 0。", "err");
      return;
    }
    var button = this;
    button.disabled = true;
    setStatus("marks-status", "正在生成标记…", "");
    YunLiTool.request("marks", {
      size: size,
      offset: offset,
      stroke: stroke,
      inside: $("mk-side").value === "in",
      cornerLine: $("mk-corner").checked,
      hotStamp: $("mk-hot").checked,
      cutMark: $("mk-cut").checked,
      bisector: $("mk-bisect").checked,
      grating: $("mk-align").checked,
      adaptArtboard: $("mk-adapt").checked,
      whiteInk: $("mk-white").checked,
      separation: $("mk-sep").checked,
      fileInfo: $("mk-info").checked,
      comment: $("mk-comment").value,
      hCount: hCount,
      vCount: vCount,
      hSpace: hSpace,
      vSpace: vSpace,
      spots: $("mk-sep").checked ? chosenSpots() : []
    }).then(function () {
      setStatus("marks-status", "标记已生成。", "ok");
    }).catch(function (e) {
      setStatus("marks-status", e.message, "err");
    }).then(function () { button.disabled = false; });
  });

  $("export-run").addEventListener("click", function () {
    if (this.disabled) return;
    var folder = $("ex-folder").value.replace(/^\s+|\s+$/g, "");
    var cmyk = chosenBoards("ex-cmyk-boards");
    var gray = chosenBoards("ex-gray-boards");
    if (!folder) { setStatus("export-status", "请选择导出文件夹。", "err"); return; }
    if (!cmyk.length && !gray.length) { setStatus("export-status", "请至少选择一个画板。", "err"); return; }
    var button = this;
    button.disabled = true;
    setStatus("export-status", "正在导出 TIFF…", "");
    YunLiTool.request("export", {
      folder: folder,
      log: $("ex-log").checked,
      cmyk: { lzw: true, ppi: $("ex-cmyk-ppi").value, antialias: $("ex-cmyk-aa").value, boards: cmyk },
      gray: { lzw: true, ppi: $("ex-gray-ppi").value, antialias: $("ex-gray-aa").value, boards: gray }
    }).then(function () {
      setStatus("export-status", "TIFF 已导出。", "ok");
    }).catch(function (e) {
      setStatus("export-status", e.message, "err");
    }).then(function () { button.disabled = false; });
  });

  syncMarkLocks();
  window.YunLiPages.enter(YunLiUI.route());
})();
