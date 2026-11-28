// 图片分切（原生像素无损裁切）与专色选择（按专色百分比选择相同/以下/以上对象）。
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function setStatus(id, text, kind) {
    var el = $(id);
    if (!el) return;
    el.textContent = text;
    el.title = text;
    el.className = "status" + (kind ? " " + kind : "");
  }
  function fmtPct(v) {
    var n = Math.round(Number(v) * 10) / 10;
    return isFinite(n) ? String(n) : "100";
  }

  $("split-refresh").appendChild(YunLiUI.icon("refresh"));
  $("bm-refresh").appendChild(YunLiUI.icon("refresh"));
  $("ss-refresh").appendChild(YunLiUI.icon("refresh"));

  // ---- 1. 图片分切 ----
  function syncSplitControls() {
    $("sp-pad").disabled = !$("sp-mask").checked;
  }
  $("sp-mask").addEventListener("change", syncSplitControls);
  syncSplitControls();

  function refreshSplit() {
    setStatus("split-status", "正在读取选区…", "");
    $("split-run").disabled = true;
    return YunLiTool.request("splitInspect").then(function (data) {
      var rc = data.rasterCount || 0;
      var pc = data.rectCount || 0;
      var pl = data.placedCount || 0;
      if (rc === 1 && pc > 0) {
        var spotInfo = data.spot ? (" · 专色：" + data.spot) : "";
        var dpi = data.dpiX ? Math.round(data.dpiX) : 72;
        $("split-meta").textContent = data.width + "×" + data.height + " px · 约 " + dpi + " DPI · " + (data.colorSpace || "位图") + spotInfo;
        setStatus("split-status", "已识别 1 张位图与 " + pc + " 个矩形（相交 " + (data.overlapCount || 0) + " 个）。", "ok");
        $("split-run").disabled = false;
      } else if (rc === 0 && pl > 0) {
        $("split-meta").textContent = "检测到 " + pl + " 个外部链接图，请先在「链接」面板中嵌入。";
        setStatus("split-status", "外部链接图需先嵌入后再无损分切。", "err");
      } else if (rc > 1) {
        $("split-meta").textContent = "当前选中了 " + rc + " 张位图与 " + pc + " 个矩形。";
        setStatus("split-status", "请只选中 1 张嵌入位图和对应矩形刀线框。", "err");
      } else {
        $("split-meta").textContent = "当前选区：位图 " + rc + " 张，闭合矩形 " + pc + " 个。";
        setStatus("split-status", "请同时选中 1 张嵌入位图与矩形刀线框（选中后自动识别）。", "");
      }
    }).catch(function (e) {
      $("split-meta").textContent = "无法读取选区。";
      setStatus("split-status", e.message, "err");
    });
  }

  var splitBusy = false;
  var batchMaskBusy = false;
  var spotSelectBusy = false;
  var selTimer = null;
  var bmTolTimer = null;
  var ignoreSelUntil = 0;

  $("split-refresh").addEventListener("click", refreshSplit);
  $("split-run").addEventListener("click", function () {
    if (this.disabled) return;
    var pad = Number(String($("sp-pad").value).replace(/^\s+|\s+$/g, ""));
    if (!isFinite(pad) || pad < 0 || pad !== Math.floor(pad)) {
      setStatus("split-status", "像素余量必须是大于等于 0 的整数。", "err");
      return;
    }
    var btn = this;
    btn.disabled = true;
    splitBusy = true;
    setStatus("split-status", "正在无损分切…", "");
    YunLiTool.request("splitRun", {
      padPx: pad,
      applyMask: $("sp-mask").checked,
      skipEmpty: $("sp-skip").checked,
      hideSource: $("sp-hide").checked
    }).then(function (data) {
      ignoreSelUntil = Date.now() + 800;
      var skipText = data.skipped > 0 ? ("，跳过 " + data.skipped + " 个无重叠框") : "";
      var sec = data.elapsedMs ? ("（" + (data.elapsedMs / 1000).toFixed(2) + "s）") : "";
      setStatus("split-status", "已完成：生成 " + data.count + " 个" + (data.applyMask ? "独立蒙版" : "独立位图") + skipText + sec, "ok");
      $("split-meta").textContent = "图层：" + (data.layer || "图片分切") + " · 原图 " + data.width + "×" + data.height + " px · " + (data.colorSpace || "位图");
    }).catch(function (e) {
      setStatus("split-status", e.message, "err");
    }).then(function () { splitBusy = false; btn.disabled = false; });
  });

  // ---- 1.5 批量蒙版 ----
  function readBmTol() {
    var raw = String($("bm-tol").value).replace(/^\s+|\s+$/g, "");
    if (raw === "" || raw === "-") return 0;
    var n = Number(raw);
    return isFinite(n) ? n : NaN;
  }

  function refreshBatchMask() {
    var tol = readBmTol();
    if (!isFinite(tol) || tol < -50 || tol > 50) {
      $("bm-run").disabled = true;
      setStatus("bm-status", "容差必须在 -50 到 50 mm 之间。", "err");
      return Promise.resolve();
    }
    setStatus("bm-status", "正在读取选区…", "");
    $("bm-run").disabled = true;
    return YunLiTool.request("batchMaskInspect", {
      detectMode: $("bm-detect").value,
      toleranceMm: tol
    }).then(function (data) {
      var dc = data.dieCutCount || 0;
      var cc = data.contentCount || 0;
      var mc = data.matchedDieCuts || 0;
      var sc = data.sharedContents || 0;
      var modeLabel = data.usedMode === "top" ? "顶层对象" : "无填充路径";
      if (dc > 0 && cc > 0) {
        var extra = sc > 0 ? (" · 跨刀线自动复制 " + sc + " 个") : "";
        $("bm-meta").textContent = "刀线 " + dc + " 条（" + modeLabel + "） · 内容 " + cc + " 个" + extra;
        if (mc > 0) {
          setStatus("bm-status", "已匹配 " + mc + " / " + dc + " 条刀线，可直接原位建蒙版。", "ok");
          $("bm-run").disabled = false;
        } else {
          setStatus("bm-status", "刀线与内容边界无重叠，可调整容差或检查选区。", "err");
        }
      } else if (dc === 0 && cc === 0) {
        $("bm-meta").textContent = "当前选区：刀线 0 条，内容对象 0 个。";
        setStatus("bm-status", "请同时选中刀线和要蒙版的对象（选中后自动识别）。", "");
      } else if (dc === 0) {
        $("bm-meta").textContent = "已选 " + cc + " 个对象，未识别到闭合刀线。";
        setStatus("bm-status", "未找到闭合刀线，请一并选中刀线或切换「刀线」识别方式。", "err");
      } else {
        $("bm-meta").textContent = "已选 " + dc + " 条刀线，缺少被蒙版的内容对象。";
        setStatus("bm-status", "请同时选中刀线和下方需要被蒙版的内容对象。", "err");
      }
    }).catch(function (e) {
      $("bm-meta").textContent = "无法读取选区。";
      setStatus("bm-status", e.message, "err");
    });
  }

  $("bm-refresh").addEventListener("click", refreshBatchMask);
  $("bm-detect").addEventListener("change", refreshBatchMask);
  $("bm-tol").addEventListener("input", function () {
    if (bmTolTimer) clearTimeout(bmTolTimer);
    bmTolTimer = setTimeout(function () {
      bmTolTimer = null;
      if (YunLiUI.route() === "batchmask" && !batchMaskBusy) refreshBatchMask();
    }, 260);
  });

  $("bm-run").addEventListener("click", function () {
    if (this.disabled) return;
    var tol = readBmTol();
    if (!isFinite(tol) || tol < -50 || tol > 50) {
      setStatus("bm-status", "容差必须在 -50 到 50 mm 之间。", "err");
      return;
    }
    var btn = this;
    btn.disabled = true;
    batchMaskBusy = true;
    setStatus("bm-status", "正在批量建立剪切蒙版…", "");
    YunLiTool.request("batchMaskRun", {
      detectMode: $("bm-detect").value,
      toleranceMm: tol,
      skipEmpty: $("bm-skip").checked
    }).then(function (data) {
      ignoreSelUntil = Date.now() + 900;
      var skipText = data.skipped > 0 ? ("，跳过 " + data.skipped + " 条空刀线") : "";
      var dupText = data.duplicated > 0 ? ("，跨刀线复制 " + data.duplicated + " 个") : "";
      var sec = data.elapsedMs ? ("（" + (data.elapsedMs / 1000).toFixed(2) + "s）") : "";
      setStatus("bm-status", "已完成：建立 " + data.count + " 个剪切蒙版" + skipText + dupText + sec, "ok");
      $("bm-meta").textContent = "共处理刀线 " + data.dieCutCount + " 条 · 归入对象 " + (data.maskedItems || 0) + " 次（支持 Ctrl+Z 撤销）";
    }).catch(function (e) {
      setStatus("bm-status", e.message, "err");
    }).then(function () { batchMaskBusy = false; btn.disabled = false; });
  });

  // ---- 2. 专色选择 ----
  var lastSpotSample = null;
  function fillSpotOptions(names, preferred) {
    var sel = $("ss-spot");
    var keep = preferred || sel.value;
    sel.textContent = "";
    if (!names || !names.length) {
      var opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "当前文档没有专色";
      sel.appendChild(opt);
      sel.disabled = true;
      $("ss-run").disabled = true;
      return;
    }
    sel.disabled = false;
    for (var i = 0; i < names.length; i++) {
      var item = document.createElement("option");
      item.value = names[i];
      item.textContent = names[i];
      sel.appendChild(item);
    }
    if (keep && names.indexOf(keep) !== -1) sel.value = keep;
    else sel.selectedIndex = 0;
    $("ss-run").disabled = false;
  }

  function applySample(sample) {
    if (!sample || !sample.spot) return false;
    var sel = $("ss-spot");
    var found = false;
    for (var i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === sample.spot) {
        sel.value = sample.spot;
        found = true;
        break;
      }
    }
    if (!found && sample.spot) {
      var opt = document.createElement("option");
      opt.value = sample.spot;
      opt.textContent = sample.spot;
      sel.appendChild(opt);
      sel.value = sample.spot;
      sel.disabled = false;
      $("ss-run").disabled = false;
    }
    var rawPct = Number(sample.percent);
    if (isFinite(rawPct)) {
      $("ss-percent").value = fmtPct(rawPct);
    }
    return true;
  }

  function refreshSpotSelect(autoPick) {
    setStatus("ss-status", "正在读取文档专色…", "");
    return YunLiTool.request("spotSelectInspect").then(function (data) {
      var spots = data.spots || [];
      lastSpotSample = data.sample || null;
      var preferred = (autoPick && lastSpotSample) ? lastSpotSample.spot : "";
      fillSpotOptions(spots, preferred);
      if (autoPick && lastSpotSample) applySample(lastSpotSample);
      if (!spots.length) {
        setStatus("ss-status", "当前文档没有专色。", "");
      } else if (lastSpotSample) {
        var where = lastSpotSample.where === "stroke" ? "描边" : "填充";
        setStatus("ss-status", "已识别：" + lastSpotSample.spot + " " + fmtPct(lastSpotSample.percent) + "%（" + where + "）", "ok");
      } else {
        setStatus("ss-status", "共 " + spots.length + " 个专色（选中专色对象后自动识别）。", "");
      }
    }).catch(function (e) {
      fillSpotOptions([], "");
      setStatus("ss-status", e.message, "err");
    });
  }

  $("ss-refresh").addEventListener("click", function () { refreshSpotSelect(true); });
  $("ss-pick").addEventListener("click", function () {
    refreshSpotSelect(true).then(function () {
      if (!lastSpotSample) {
        setStatus("ss-status", "当前选中对象未包含专色，请先点选一个带专色的对象。", "err");
      }
    });
  });

  $("ss-run").addEventListener("click", function () {
    if (this.disabled) return;
    var spot = $("ss-spot").value;
    var pct = Number(String($("ss-percent").value).replace(/^\s+|\s+$/g, ""));
    var matchFill = $("ss-fill").checked;
    var matchStroke = $("ss-stroke").checked;
    if (!spot) { setStatus("ss-status", "请选择目标专色。", "err"); return; }
    if (!isFinite(pct) || pct < 0 || pct > 100) { setStatus("ss-status", "专色百分比必须在 0 到 100 之间。", "err"); return; }
    if (!matchFill && !matchStroke) { setStatus("ss-status", "请至少勾选「匹配填充」或「匹配描边」。", "err"); return; }

    var mode = $("ss-mode").value;
    var modeMap = { eq: "=", gt: ">", gte: "≥", lt: "<", lte: "≤" };
    var modeText = modeMap[mode] || "=";
    var btn = this;
    btn.disabled = true;
    spotSelectBusy = true;
    setStatus("ss-status", "正在匹配对象…", "");
    YunLiTool.request("spotSelectRun", {
      spot: spot,
      mode: mode,
      percent: pct,
      tolerance: 0.5,
      matchFill: matchFill,
      matchStroke: matchStroke
    }).then(function (data) {
      ignoreSelUntil = Date.now() + 800;
      var n = data.matched || 0;
      setStatus("ss-status", n > 0
        ? ("已选中 " + n + " 个对象（" + spot + " " + modeText + " " + fmtPct(pct) + "%）。")
        : ("未找到符合条件的对象（" + spot + " " + modeText + " " + fmtPct(pct) + "%）。"), n > 0 ? "ok" : "");
    }).catch(function (e) {
      setStatus("ss-status", e.message, "err");
    }).then(function () { spotSelectBusy = false; btn.disabled = false; });
  });

  // 监听 Illustrator 选区实时变化：切换选中对象时自动识别，无需手动点刷新
  window.addEventListener("yunli:selectionChanged", function () {
    if (splitBusy || batchMaskBusy || spotSelectBusy || Date.now() < ignoreSelUntil) return;
    var current = YunLiUI.route();
    if (current !== "split" && current !== "batchmask" && current !== "spotselect") return;
    if (selTimer) clearTimeout(selTimer);
    selTimer = setTimeout(function () {
      selTimer = null;
      if (splitBusy || batchMaskBusy || spotSelectBusy || Date.now() < ignoreSelUntil) return;
      var now = YunLiUI.route();
      if (now === "split") refreshSplit();
      else if (now === "batchmask") refreshBatchMask();
      else if (now === "spotselect") refreshSpotSelect(true);
    }, 180);
  });

  window.YunLiSpotTools = {
    enter: function (name) {
      if (name === "split") refreshSplit();
      else if (name === "batchmask") refreshBatchMask();
      else if (name === "spotselect") refreshSpotSelect(true);
    }
  };

  window.YunLiSpotTools.enter(YunLiUI.route());
})();
