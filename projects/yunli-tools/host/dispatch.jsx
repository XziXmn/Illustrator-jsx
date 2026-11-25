// YunLi 工具调度。由核心注入，#targetengine "yunli-tools"。
// YUNLI_HOST_DIR 在注入时赋值，指向 assets/host。
var YunLiTools = {
    dispatch: function (action, encoded) {
        var payload = {};
        try {
            payload = JSON.parse(decodeURIComponent(encoded || "%7B%7D"));
        } catch (e) {
            payload = {};
        }
        var result;
        if (action === "inspect") result = YunLiTools.inspect();
        else if (action === "preview") result = YunLiTools.preview(payload);
        else if (action === "marks") result = YunLiTools.marks(payload);
        else if (action === "export") result = YunLiTools.exportTiff(payload);
        else if (action === "spotSelectInspect") result = YunLiTools.spotSelectInspect();
        else if (action === "spotSelectRun") result = YunLiTools.spotSelectRun(payload);
        else throw new Error("不支持的操作。");
        return JSON.stringify({ ok: true, data: result });
    },

    inspect: function () {
        if (!app.documents.length) throw new Error("请先打开文档。");
        var doc = app.activeDocument;
        var boards = [];
        var i;
        for (i = 0; i < doc.artboards.length; i++) boards.push(doc.artboards[i].name);
        var spots = [];
        var seen = {};
        function take(spot) {
            if (!spot || spot.colorType === ColorModel.REGISTRATION) return;
            var name = String(spot.name);
            if (name.replace(/^\s+|\s+$/g, "").toLowerCase() === "autocad color 4") return;
            if (seen[name]) return;
            seen[name] = true;
            spots.push(name);
        }
        for (i = 0; i < doc.swatches.length; i++) {
            var swatch = doc.swatches[i];
            if (!swatch.color || swatch.color.typename !== "SpotColor" || !swatch.color.spot) continue;
            take(swatch.color.spot);
        }
        for (i = 0; i < doc.spots.length; i++) take(doc.spots[i]);
        var selection = 0;
        try { selection = doc.selection ? doc.selection.length : 0; } catch (e0) {}
        var desktop = "";
        try { desktop = Folder.desktop.fsName; } catch (e1) {}
        return {
            name: doc.name,
            artboards: boards,
            spots: spots,
            selection: selection,
            desktop: desktop
        };
    },

    // 与原导出脚本一致，预览当前画板内容；不切换工艺图层或修改稿件。
    preview: function (payload) {
        if (!app.documents.length) throw new Error("请先打开文档。");
        var doc = app.activeDocument;
        if (doc.name !== payload.document) throw new Error("当前文档已切换，请刷新画板列表。");
        var index = Number(payload.index);
        if (typeof payload.index !== "number" || !isFinite(index) || index !== Math.floor(index) || index < 0 || index >= doc.artboards.length) {
            throw new Error("画板编号无效，请刷新画板列表。");
        }
        if (!payload.file) throw new Error("未提供预览临时文件。");
        var rect = doc.artboards[index].artboardRect;
        var width = rect[2] - rect[0], height = rect[1] - rect[3];
        if (width <= 0 || height <= 0) throw new Error("画板尺寸无效。");
        var limit = payload.mode === "full" ? 600 : 64;
        var scale = Math.min(limit / width, limit / height) * 100;
        var previous = doc.artboards.getActiveArtboardIndex();
        try {
            doc.artboards.setActiveArtboardIndex(index);
            var options = new ExportOptionsPNG24();
            options.transparency = false;
            options.artBoardClipping = true;
            options.horizontalScale = scale;
            options.verticalScale = scale;
            doc.exportFile(new File(payload.file), ExportType.PNG24, options);
        } finally {
            doc.artboards.setActiveArtboardIndex(previous);
        }
        return { name: doc.artboards[index].name, index: index };
    },

    marks: function (payload) {
        var file = new File(YUNLI_HOST_DIR + "/marks.jsx");
        if (!file.exists) throw new Error("找不到标记脚本。");
        $.global.YUNLI_MARKS = payload || {};
        $.evalFile(file);
        return { done: true };
    },

    exportTiff: function (payload) {
        var file = new File(YUNLI_HOST_DIR + "/export.jsx");
        if (!file.exists) throw new Error("找不到导出脚本。");
        $.global.YUNLI_EXPORT = payload || {};
        $.evalFile(file);
        return { done: true };
    },

    // 专色百分比选择兜底(原生 IPC 不可用时使用)
    spotSelectInspect: function () {
        if (!app.documents.length) throw new Error("请先打开文档。");
        var doc = app.activeDocument;
        var spots = [];
        var seen = {};
        var i;
        for (i = 0; i < doc.spots.length; i++) {
            var sp = doc.spots[i];
            if (!sp || sp.colorType === ColorModel.REGISTRATION) continue;
            var sname = String(sp.name);
            if (!seen[sname]) { seen[sname] = true; spots.push(sname); }
        }
        function pickSample(item) {
            if (!item) return null;
            var t = item.typename;
            if (t === "PathItem") {
                if (item.filled && item.fillColor && item.fillColor.typename === "SpotColor" && item.fillColor.spot) {
                    return { spot: String(item.fillColor.spot.name), percent: Number(item.fillColor.tint), where: "fill" };
                }
                if (item.stroked && item.strokeColor && item.strokeColor.typename === "SpotColor" && item.strokeColor.spot) {
                    return { spot: String(item.strokeColor.spot.name), percent: Number(item.strokeColor.tint), where: "stroke" };
                }
                return null;
            }
            if (t === "CompoundPathItem" && item.pathItems.length > 0) return pickSample(item.pathItems[0]);
            if (t === "GroupItem") {
                for (var g = 0; g < item.pageItems.length; g++) {
                    var got = pickSample(item.pageItems[g]);
                    if (got) return got;
                }
            }
            if (t === "TextFrame") {
                try {
                    var attr = item.textRange.characterAttributes;
                    if (attr.fillColor && attr.fillColor.typename === "SpotColor" && attr.fillColor.spot) {
                        return { spot: String(attr.fillColor.spot.name), percent: Number(attr.fillColor.tint), where: "fill" };
                    }
                    if (attr.strokeColor && attr.strokeColor.typename === "SpotColor" && attr.strokeColor.spot) {
                        return { spot: String(attr.strokeColor.spot.name), percent: Number(attr.strokeColor.tint), where: "stroke" };
                    }
                } catch (eTf) {}
            }
            return null;
        }
        var sample = null;
        var selLen = 0;
        try {
            if (doc.selection && doc.selection.length) {
                selLen = doc.selection.length;
                for (i = 0; i < selLen && !sample; i++) sample = pickSample(doc.selection[i]);
            }
        } catch (eSel) {}
        return { spots: spots, selection: selLen, sample: sample };
    },

    spotSelectRun: function (payload) {
        if (!app.documents.length) throw new Error("请先打开文档。");
        var doc = app.activeDocument;
        var spotName = String((payload && payload.spot) || "");
        var mode = String((payload && payload.mode) || "eq");
        var target = Number(payload && payload.percent);
        var tol = (payload && typeof payload.tolerance === "number") ? payload.tolerance : 0.5;
        var matchFill = !(payload && payload.matchFill === false);
        var matchStroke = !(payload && payload.matchStroke === false);
        if (!spotName) throw new Error("请选择目标专色。");
        if (!matchFill && !matchStroke) throw new Error("请至少勾选「填充」或「描边」。");
        if (!isFinite(target) || target < 0 || target > 100) throw new Error("专色百分比必须在 0 到 100 之间。");

        function okPct(v) {
            var eps = 0.05;
            if (mode === "gt")  return v > target + eps;
            if (mode === "gte") return v >= target - eps;
            if (mode === "lt")  return v < target - eps;
            if (mode === "lte") return v <= target + eps;
            return Math.abs(v - target) <= (tol > eps ? tol : eps);
        }
        function okColor(col) {
            return col && col.typename === "SpotColor" && col.spot && String(col.spot.name) === spotName && okPct(Number(col.tint));
        }
        function editable(it) {
            try {
                if (it.hidden || it.locked) return false;
                var lyr = it.layer;
                while (lyr) {
                    if (lyr.typename === "Layer" && (!lyr.visible || lyr.locked)) return false;
                    lyr = lyr.parent;
                    if (!lyr || lyr.typename === "Document") break;
                }
                var p = it.parent;
                while (p && p.typename !== "Layer" && p.typename !== "Document") {
                    if (p.hidden || p.locked) return false;
                    p = p.parent;
                }
            } catch (eEd) { return false; }
            return true;
        }

        var matched = [];
        function walk(items) {
            for (var i = 0; i < items.length; i++) {
                var it = items[i];
                if (!it || it.hidden || it.locked) continue;
                var t = it.typename;
                if (t === "GroupItem") {
                    walk(it.pageItems);
                } else if (t === "CompoundPathItem") {
                    if (it.pathItems.length > 0 && editable(it)) {
                        var p0 = it.pathItems[0];
                        if ((matchFill && p0.filled && okColor(p0.fillColor)) || (matchStroke && p0.stroked && okColor(p0.strokeColor))) {
                            matched.push(it);
                        }
                    }
                } else if (t === "PathItem") {
                    if (it.guides || it.clipping || !editable(it)) continue;
                    if ((matchFill && it.filled && okColor(it.fillColor)) || (matchStroke && it.stroked && okColor(it.strokeColor))) {
                        matched.push(it);
                    }
                } else if (t === "TextFrame") {
                    if (!editable(it)) continue;
                    try {
                        var attr = it.textRange.characterAttributes;
                        if ((matchFill && okColor(attr.fillColor)) || (matchStroke && okColor(attr.strokeColor))) {
                            matched.push(it);
                        }
                    } catch (eTxt) {}
                }
            }
        }
        for (var li = 0; li < doc.layers.length; li++) {
            var layer = doc.layers[li];
            if (!layer.visible || layer.locked) continue;
            walk(layer.pageItems);
        }
        doc.selection = null;
        for (var m = 0; m < matched.length; m++) {
            try { matched[m].selected = true; } catch (eMs) {}
        }
        return { matched: matched.length, spot: spotName, mode: mode, percent: target };
    }
};
