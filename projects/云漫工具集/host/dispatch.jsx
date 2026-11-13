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
    }
};
