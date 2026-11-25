#target illustrator

/*
 * 按刀线分割专色位图.jsx
 * 用法：同时选中「1 张嵌入灰度位图」与「若干独立闭合矩形刀线框」，运行本脚本。
 * 流程：
 *   1. 复制临时底图并用原生 colorize(CMYK/RGB纯黑) 去色还原；
 *   2. 逐个矩形 600 DPI 裁切（保留透明背景）并套用各自独立矩形剪切蒙版（不整体编组）；
 *   3. 清理临时图层后，最后一次性选中全部切好的子位图通过 defaultFillColor 绑定原版专色。
 */
(function () {
    if (app.documents.length === 0) {
        alert("请先打开一个 Illustrator 文档。", "按刀线分割专色位图");
        return;
    }

    var doc = app.activeDocument;
    if (!doc.selection || doc.selection.length === 0) {
        alert("请先同时选中「嵌入位图」和「矩形刀线框」，再运行脚本。", "按刀线分割专色位图");
        return;
    }

    // ---- 工具函数（ES3 兼容） ----
    function trimStr(s) {
        return String(s || "").replace(/^\s+|\s+$/g, "");
    }

    function boundsWidth(b) {
        return b[2] - b[0];
    }

    function boundsHeight(b) {
        return b[1] - b[3];
    }

    function boundsIntersect(a, b) {
        // Illustrator 坐标：left=0, top=1, right=2, bottom=3（Y 轴向上）
        return !(a[2] <= b[0] || a[0] >= b[2] || a[1] <= b[3] || a[3] >= b[1]);
    }

    function collectSelection(items, outRasters, outRects, outPlacedCount) {
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            if (!it) continue;
            var t = it.typename;
            if (t === "RasterItem") {
                outRasters.push(it);
            } else if (t === "PlacedItem") {
                outPlacedCount.count++;
            } else if (t === "PathItem") {
                if (it.guides || it.clipping) continue;
                if (!it.closed) continue;
                var gb = it.geometricBounds;
                if (boundsWidth(gb) > 0.5 && boundsHeight(gb) > 0.5) {
                    outRects.push(it);
                }
            } else if (t === "GroupItem") {
                collectSelection(it.pageItems, outRasters, outRects, outPlacedCount);
            }
        }
    }

    // 提取纯数值坐标并按「从上到下、从左到右」排序
    function extractSortedBounds(rectItems) {
        var list = [];
        for (var i = 0; i < rectItems.length; i++) {
            var gb = rectItems[i].geometricBounds;
            list.push([gb[0], gb[1], gb[2], gb[3]]);
        }
        list.sort(function (a, b) {
            if (Math.abs(a[1] - b[1]) > 5) {
                return b[1] - a[1]; // Y 越大越靠上
            }
            return a[0] - b[0]; // X 越小越靠左
        });
        return list;
    }

    // 弹窗前只读分析选区（不动 doc.selection）
    var rasters = [];
    var rects = [];
    var placedInfo = { count: 0 };
    collectSelection(doc.selection, rasters, rects, placedInfo);

    if (rasters.length === 0) {
        var msg = "未在选中对象中找到嵌入位图（RasterItem）。";
        if (placedInfo.count > 0) {
            msg += "\n检测到选中了 " + placedInfo.count + " 个外部链接图（PlacedItem），请先在「链接」面板中嵌入后再试。";
        } else {
            msg += "\n请确认已同时选中「嵌入位图」和「矩形框」。";
        }
        alert(msg, "按刀线分割专色位图");
        return;
    }

    if (rasters.length > 1) {
        alert("检测到选中了 " + rasters.length + " 张嵌入位图。\n请只选中 1 张嵌入位图和对应的矩形刀线框。", "按刀线分割专色位图");
        return;
    }

    if (rects.length === 0) {
        alert("未在选中对象中找到闭合的矩形刀线路径。\n请确认已同时选中刀线框，且刀线为闭合路径（非参考线）。", "按刀线分割专色位图");
        return;
    }

    var preRaster = rasters[0];
    var preSrcBounds = [
        preRaster.geometricBounds[0],
        preRaster.geometricBounds[1],
        preRaster.geometricBounds[2],
        preRaster.geometricBounds[3]
    ];
    var preRectBounds = extractSortedBounds(rects);

    // 收集文档中的所有专色名称（排除套版色 Registration）
    var spotNames = [];
    for (var s = 0; s < doc.spots.length; s++) {
        var sp = doc.spots[s];
        try {
            if (sp.colorType === ColorModel.REGISTRATION) continue;
        } catch (eReg) {}
        spotNames.push(String(sp.name));
    }

    // 只读读取原位图 colorants 自动匹配专色
    var detectedSpotIndex = -1;
    var detectedColorants = [];
    try {
        if (preRaster.colorants && preRaster.colorants.length > 0) {
            for (var c = 0; c < preRaster.colorants.length; c++) {
                var cname = trimStr(preRaster.colorants[c]);
                detectedColorants.push(cname);
                if (detectedSpotIndex === -1) {
                    for (var k = 0; k < spotNames.length; k++) {
                        if (trimStr(spotNames[k]) === cname) {
                            detectedSpotIndex = k;
                            break;
                        }
                    }
                }
            }
        }
    } catch (eCol) {}

    var overlapCount = 0;
    for (var r = 0; r < preRectBounds.length; r++) {
        if (boundsIntersect(preRectBounds[r], preSrcBounds)) {
            overlapCount++;
        }
    }

    // ---- 参数弹窗 ----
    var dlg = new Window("dialog", "按刀线分割专色位图");
    dlg.orientation = "column";
    dlg.alignChildren = ["fill", "top"];
    dlg.spacing = 10;
    dlg.margins = 14;

    var infoPanel = dlg.add("panel", undefined, "已识别选中对象");
    infoPanel.orientation = "column";
    infoPanel.alignChildren = ["left", "top"];
    infoPanel.margins = [12, 14, 12, 10];
    infoPanel.spacing = 4;

    var colorSpaceLabel = "未知";
    var srcTransparent = false;
    try {
        colorSpaceLabel = String(preRaster.imageColorSpace).replace("ImageColorSpace.", "");
    } catch (eCs) {}
    try {
        srcTransparent = !!preRaster.transparent;
    } catch (eTr) {}
    infoPanel.add("statictext", undefined, "嵌入位图：1 张（色彩：" + colorSpaceLabel
        + (srcTransparent ? "，带透明" : "")
        + (detectedColorants.length ? "，通道：" + detectedColorants.join(", ") : "") + "）");
    infoPanel.add("statictext", undefined, "闭合矩形：" + preRectBounds.length + " 个（与位图相交 " + overlapCount + " 个）");

    var optPanel = dlg.add("panel", undefined, "裁切与填充设置");
    optPanel.orientation = "column";
    optPanel.alignChildren = ["fill", "top"];
    optPanel.margins = [12, 14, 12, 10];
    optPanel.spacing = 8;

    // 专色选择
    var rowSpot = optPanel.add("group");
    rowSpot.orientation = "row";
    rowSpot.alignChildren = ["left", "center"];
    var lblSpot = rowSpot.add("statictext", undefined, "填充专色：");
    lblSpot.preferredSize.width = 76;

    var spotListItems = ["（不填专色，保持灰度）"];
    for (var si = 0; si < spotNames.length; si++) {
        var label = spotNames[si];
        if (si === detectedSpotIndex) label += "  [原图]";
        spotListItems.push(label);
    }
    var ddSpot = rowSpot.add("dropdownlist", undefined, spotListItems);
    ddSpot.preferredSize.width = 216;
    ddSpot.selection = detectedSpotIndex >= 0 ? (detectedSpotIndex + 1) : (spotNames.length > 0 ? 1 : 0);

    // 色彩模式
    var rowMode = optPanel.add("group");
    rowMode.orientation = "row";
    rowMode.alignChildren = ["left", "center"];
    var lblMode = rowMode.add("statictext", undefined, "裁切模式：");
    lblMode.preferredSize.width = 76;
    var ddMode = rowMode.add("dropdownlist", undefined, [
        "灰度（保留灰阶与透明）",
        "1-bit 位图（纯实地 100% / 透明底）"
    ]);
    ddMode.preferredSize.width = 216;
    ddMode.selection = (colorSpaceLabel === "Monochrome") ? 1 : 0;

    // 分辨率与蒙版余量
    var rowRes = optPanel.add("group");
    rowRes.orientation = "row";
    rowRes.alignChildren = ["left", "center"];
    var lblRes = rowRes.add("statictext", undefined, "分辨率(DPI)：");
    lblRes.preferredSize.width = 76;
    var ddRes = rowRes.add("dropdownlist", undefined, ["300", "360", "600", "1200"]);
    ddRes.preferredSize.width = 76;
    ddRes.selection = 2; // 默认 600 DPI

    rowRes.add("statictext", undefined, " 蒙版余量(pt)：");
    var edPad = rowRes.add("edittext", undefined, "1");
    edPad.preferredSize.width = 42;
    edPad.helpTip = "栅格化时向矩形外略微多裁一点，再由精确矩形蒙版切齐，避免边缘出现 1px 白缝。";

    // 抗锯齿
    var rowAA = optPanel.add("group");
    rowAA.orientation = "row";
    rowAA.alignChildren = ["left", "center"];
    var lblAA = rowAA.add("statictext", undefined, "抗锯齿：");
    lblAA.preferredSize.width = 76;
    var ddAA = rowAA.add("dropdownlist", undefined, ["无（边缘锐利，推荐）", "优化图稿"]);
    ddAA.preferredSize.width = 216;
    ddAA.selection = 0;

    // 复选框选项
    var chkKeepTrans = optPanel.add("checkbox", undefined, "保留透明背景");
    chkKeepTrans.value = true;

    var chkRichBlack = optPanel.add("checkbox", undefined, "CMYK 文档防实地掉网（四色黑底栅格化）");
    chkRichBlack.value = true;
    chkRichBlack.helpTip = "仅灰度模式有效：用四色纯黑作为栅格化底图，确保 100% 实地不掉网。";

    var chkSkipEmpty = optPanel.add("checkbox", undefined, "跳过与位图无重叠的矩形框");
    chkSkipEmpty.value = true;

    var chkHideSrc = optPanel.add("checkbox", undefined, "完成后隐藏原位图（不删除原图）");
    chkHideSrc.value = true;

    function syncUI() {
        var isBitmap = (ddMode.selection && ddMode.selection.index === 1);
        ddAA.enabled = !isBitmap;
        chkRichBlack.enabled = !isBitmap;
        if (isBitmap) ddAA.selection = 0;
    }
    ddMode.onChange = syncUI;
    syncUI();

    var btnRow = dlg.add("group");
    btnRow.alignment = ["right", "top"];
    var btnCancel = btnRow.add("button", undefined, "取消", { name: "cancel" });
    var btnOk = btnRow.add("button", undefined, "开始分割", { name: "ok" });
    btnCancel.onClick = function () { dlg.close(0); };
    btnOk.onClick = function () { dlg.close(1); };

    dlg.center();
    if (dlg.show() !== 1) return;

    // ---- 读取参数 ----
    var dpi = Number(ddRes.selection ? ddRes.selection.text : "600");
    if (isNaN(dpi) || dpi < 72) dpi = 600;
    var padPt = Number(trimStr(edPad.text));
    if (isNaN(padPt) || padPt < 0) padPt = 0;

    var useBitmap = (ddMode.selection && ddMode.selection.index === 1);
    var useArtAA = (!useBitmap && ddAA.selection && ddAA.selection.index === 1);
    var keepTrans = chkKeepTrans.value;
    var useRichBlack = (!useBitmap && chkRichBlack.value);
    var skipEmpty = chkSkipEmpty.value;
    var hideSrc = chkHideSrc.value;

    var targetSpotName = null;
    if (ddSpot.selection && ddSpot.selection.index > 0) {
        targetSpotName = spotNames[ddSpot.selection.index - 1];
    }

    // 弹窗关闭后重新获取当前文档与选区
    if (app.documents.length === 0) {
        alert("未检测到打开的文档，请确认文档仍处于打开状态后重试。", "按刀线分割专色位图");
        return;
    }
    try {
        doc = app.activeDocument;
        try { doc.activate(); } catch (eActDoc) {}
    } catch (eGetDoc) {
        alert("弹窗关闭后无法获取当前活动文档：" + (eGetDoc.message || eGetDoc), "按刀线分割专色位图");
        return;
    }

    var freshRasters = [];
    var freshRects = [];
    var freshPlaced = { count: 0 };
    try {
        if (doc.selection && doc.selection.length > 0) {
            collectSelection(doc.selection, freshRasters, freshRects, freshPlaced);
        }
    } catch (eReSel) {}

    var srcRaster = freshRasters.length === 1 ? freshRasters[0] : preRaster;
    var srcBounds = preSrcBounds;
    try {
        var sgb = srcRaster.geometricBounds;
        srcBounds = [sgb[0], sgb[1], sgb[2], sgb[3]];
    } catch (eSb) {}

    var rectBoundsList = freshRects.length > 0 ? extractSortedBounds(freshRects) : preRectBounds;

    var targetSpot = null;
    if (targetSpotName !== null) {
        for (var ts = 0; ts < doc.spots.length; ts++) {
            if (String(doc.spots[ts].name) === targetSpotName) {
                targetSpot = doc.spots[ts];
                break;
            }
        }
    }

    // 记录原位图属性（此时绝不修改 doc.defaultFillColor）
    var srcOpacity = 100;
    var srcBlend = BlendModes.NORMAL;
    var srcOverprint = false;
    var hasOverprintProp = false;
    try { srcOpacity = srcRaster.opacity; } catch (e1) {}
    try { srcBlend = srcRaster.blendingMode; } catch (e2) {}
    try {
        if (typeof srcRaster.overprint === "boolean") {
            srcOverprint = srcRaster.overprint;
            hasOverprintProp = true;
        }
    } catch (e3) {}

    var targetSpotColor = null;
    if (targetSpot) {
        try {
            var sw = doc.swatches.getByName(targetSpot.name);
            if (sw && sw.color && sw.color.typename === "SpotColor") {
                targetSpotColor = sw.color;
            }
        } catch (eSw) {}
        if (!targetSpotColor) {
            targetSpotColor = new SpotColor();
            targetSpotColor.spot = targetSpot;
            targetSpotColor.tint = 100;
        }
    }

    // 使用 RasterItem.colorize() 原生支持的 CMYKColor / RGBColor 还原纯黑底图（完全不碰 defaultFillColor）
    var docColorSpace = null;
    try { docColorSpace = doc.documentColorSpace; } catch (eDcs) {}
    var neutralBlack;
    if (docColorSpace === DocumentColorSpace.CMYK) {
        neutralBlack = new CMYKColor();
        if (useRichBlack) {
            neutralBlack.cyan = 100;
            neutralBlack.magenta = 100;
            neutralBlack.yellow = 100;
            neutralBlack.black = 100;
        } else {
            neutralBlack.cyan = 0;
            neutralBlack.magenta = 0;
            neutralBlack.yellow = 0;
            neutralBlack.black = 100;
        }
    } else {
        neutralBlack = new RGBColor();
        neutralBlack.red = 0;
        neutralBlack.green = 0;
        neutralBlack.blue = 0;
    }

    var rasterOpts = new RasterizeOptions();
    rasterOpts.resolution = dpi;
    rasterOpts.clippingMask = false;
    rasterOpts.convertSpotColors = false;
    rasterOpts.includeLayers = false;
    rasterOpts.padding = 0;
    rasterOpts.transparency = keepTrans;
    rasterOpts.backgroundBlack = false;
    if (useBitmap) {
        rasterOpts.colorModel = RasterizationColorModel.BITMAP;
        rasterOpts.antiAliasingMethod = AntiAliasingMethod.None;
    } else {
        rasterOpts.colorModel = RasterizationColorModel.GRAYSCALE;
        rasterOpts.antiAliasingMethod = useArtAA ? AntiAliasingMethod.ARTOPTIMIZED : AntiAliasingMethod.None;
    }

    var origActiveLayer = null;
    try { origActiveLayer = doc.activeLayer; } catch (eOrigLyr) {}
    var tempLayer = null;
    var outLayer = null;
    var createdPieces = [];
    var createdMasks = [];
    var skippedCount = 0;
    var spotApplyMsg = "";
    var startTime = new Date().getTime();

    try {
        outLayer = doc.layers.add();
        outLayer.name = "专色分割_" + (targetSpot ? targetSpot.name : "灰度");

        tempLayer = doc.layers.add();
        tempLayer.name = "__TEMP_SPLIT_WORK__";
        tempLayer.visible = true;
        tempLayer.locked = false;

        // 1. 复制临时底图并用原生 colorize(CMYK/RGB) 还原纯黑（不碰 defaultFillColor，不触发 8702）
        var baseCopy = srcRaster.duplicate(tempLayer, ElementPlacement.PLACEATEND);
        baseCopy.hidden = false;
        baseCopy.locked = false;
        try { baseCopy.opacity = 100; } catch (eOp) {}
        try { baseCopy.blendingMode = BlendModes.NORMAL; } catch (eBm) {}
        try {
            if (hasOverprintProp) baseCopy.overprint = false;
        } catch (eOv) {}
        try {
            baseCopy.colorize(neutralBlack);
        } catch (eNeutral) {
            // 某些带透明通道的位图若拒绝 colorize，保留原色直接栅格化
        }

        // 2. 逐个矩形：裁切 → 套独立精确矩形蒙版（全程不改 defaultFillColor）
        for (var idx = 0; idx < rectBoundsList.length; idx++) {
            var rb = rectBoundsList[idx];

            if (skipEmpty && !boundsIntersect(rb, srcBounds)) {
                skippedCount++;
                continue;
            }

            var clipRect = [
                rb[0] - padPt,
                rb[1] + padPt,
                rb[2] + padPt,
                rb[3] - padPt
            ];

            var workCopy = baseCopy.duplicate(tempLayer, ElementPlacement.PLACEATEND);
            var piece = doc.rasterize(workCopy, clipRect, rasterOpts);

            try { piece.opacity = srcOpacity; } catch (eP1) {}
            try { piece.blendingMode = srcBlend; } catch (eP2) {}
            try {
                if (hasOverprintProp) piece.overprint = srcOverprint;
            } catch (eP3) {}

            var grp = outLayer.groupItems.add();
            var numStr = (idx + 1 < 10 ? "0" : "") + (idx + 1);
            grp.name = "卡位_" + numStr;

            piece.move(grp, ElementPlacement.PLACEATEND);

            var maskPath = grp.pathItems.rectangle(rb[1], rb[0], rb[2] - rb[0], rb[1] - rb[3]);
            maskPath.move(grp, ElementPlacement.PLACEATBEGINNING);
            maskPath.filled = false;
            maskPath.stroked = false;
            maskPath.clipping = true;
            grp.clipped = true;

            createdPieces.push(piece);
            createdMasks.push(maskPath);
        }

        // 3. 在改动 defaultFillColor 之前，先把临时层、隐藏原图、活动层全部收尾完成
        if (tempLayer) {
            try {
                tempLayer.locked = false;
                tempLayer.remove();
            } catch (eTmpClean) {}
            tempLayer = null;
        }

        if (hideSrc && createdPieces.length > 0) {
            try { srcRaster.hidden = true; } catch (eHide) {}
        }

        try {
            if (outLayer && createdPieces.length > 0) {
                doc.activeLayer = outLayer;
            } else if (origActiveLayer) {
                doc.activeLayer = origActiveLayer;
            }
        } catch (eAct) {}

        // 4. 最后一步：仅选中 50 张子位图（不选蒙版路径），一次性通过 defaultFillColor 绑定真实专色
        if (targetSpotColor && createdPieces.length > 0) {
            try {
                doc.selection = null;
                for (var p = 0; p < createdPieces.length; p++) {
                    createdPieces[p].selected = true;
                }
                for (var m = 0; m < createdMasks.length; m++) {
                    createdMasks[m].selected = false;
                }
                doc.defaultFillColor = targetSpotColor;
                spotApplyMsg = targetSpot.name + "（已批量回填）";
            } catch (eSpotFinal) {
                spotApplyMsg = targetSpot.name + "（自动回填失败：" + (eSpotFinal.message || eSpotFinal) + "，可手动全选图层位图点专色色板）";
            }
        }

        // 尝试清空选区，避免全部选中
        try { doc.selection = null; } catch (eEndSel) {}
    } catch (err) {
        alert("分割过程中发生错误：\n" + (err.message || err) + (err.line ? "\n（第 " + err.line + " 行）" : ""), "按刀线分割专色位图");
        return;
    } finally {
        if (tempLayer) {
            try {
                tempLayer.locked = false;
                tempLayer.remove();
            } catch (eTmpFinally) {}
        }
    }

    var sec = ((new Date().getTime() - startTime) / 1000).toFixed(1);
    var summary = "分割完成！\n"
        + "• 已生成：" + createdPieces.length + " 个独立专色蒙版（未整体编组）\n"
        + (skippedCount > 0 ? "• 已跳过（无重叠）：" + skippedCount + " 个\n" : "")
        + "• 输出图层：" + outLayer.name + "\n"
        + "• 填充专色：" + (targetSpot ? spotApplyMsg : "保持灰度") + "\n"
        + "• 模式/分辨率：" + (useBitmap ? "1-bit 位图" : "灰度") + " / " + dpi + " DPI"
        + (keepTrans ? " / 透明背景" : " / 白色背景") + "\n"
        + "• 用时：" + sec + " 秒";
    alert(summary, "按刀线分割专色位图");
})();
