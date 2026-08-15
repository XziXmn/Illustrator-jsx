/*
Code for Import https://scriptui.joonas.me 请(Triple click to select):
{"activeId":70,"items":{"item-0":{"id":0,"type":"Dialog","parentId":false,"style":{"text":"快速导出tiff","preferredSize":[0,0],"margins":10,"orientation":"column","spacing":10,"alignChildren":["left","top"],"varName":"","windowType":"Dialog","creationProps":{"su1PanelCoordinates":false,"maximizeButton":false,"minimizeButton":false,"independent":false,"closeButton":true,"borderless":false,"resizeable":false},"enabled":true}},"item-1":{"id":1,"type":"Panel","parentId":20,"style":{"text":"CMYK","preferredSize":[0,0],"margins":10,"orientation":"column","spacing":20,"alignChildren":["left","top"],"alignment":null,"varName":"cmykCustom","creationProps":{"borderStyle":"etched","su1PanelCoordinates":false},"enabled":true}},"item-20":{"id":20,"type":"Group","parentId":0,"style":{"preferredSize":[0,0],"margins":10,"orientation":"row","spacing":20,"alignChildren":["center","fill"],"alignment":null,"varName":null,"enabled":true}},"item-21":{"id":21,"type":"Panel","parentId":20,"style":{"text":"灰度","preferredSize":[0,0],"margins":10,"orientation":"column","spacing":20,"alignChildren":["left","top"],"alignment":null,"varName":"grayCustom","creationProps":{"borderStyle":"etched","su1PanelCoordinates":false},"enabled":true}},"item-22":{"id":22,"type":"StaticText","parentId":21,"style":{"text":"画板列表","justify":"left","preferredSize":[0,0],"alignment":null,"varName":"grayStaticText","helpTip":null,"softWrap":false,"creationProps":{"truncate":"none","multiline":false,"scrolling":false},"enabled":true}},"item-36":{"id":36,"type":"Group","parentId":0,"style":{"preferredSize":[0,0],"margins":0,"orientation":"row","spacing":10,"alignChildren":["left","top"],"alignment":"center","varName":null,"enabled":true}},"item-37":{"id":37,"type":"Button","parentId":36,"style":{"text":"确定","justify":"center","preferredSize":[0,0],"alignment":null,"varName":"ok","helpTip":null,"enabled":true}},"item-38":{"id":38,"type":"Button","parentId":36,"style":{"text":"取消","justify":"center","preferredSize":[0,0],"alignment":null,"varName":"cancel","helpTip":null,"enabled":true}},"item-39":{"id":39,"type":"Checkbox","parentId":20,"style":{"checked":false,"text":"生成日志","enabled":true,"varName":"logCheckbox"}},"item-40":{"id":40,"type":"Checkbox","parentId":21,"style":{"checked":false,"text":"全选","enabled":true,"varName":"graySelectAllCheck"}}}}
*/

if (app.documents.length == 0) {
    alert("请先建立一个新文件", "错误");
    app.documents.add();
}

// DIALOG
// ======
var dialog = new Window("dialog");
    dialog.text = "快速导出工艺tiff";
    dialog.orientation = "column";
    dialog.alignChildren = ["left","top"];
    dialog.spacing = 10;
    dialog.margins = 10;

// GROUP1
// ======
var group1 = dialog.add("group", undefined, {name: "group1"});
    group1.orientation = "row";
    group1.alignChildren = ["left","top"];
    group1.spacing = 10;
    group1.margins = 0;
    group1.alignment = ["center","top"];

// PANEL1
// ======
var panel1 = group1.add("panel", undefined, undefined, {name: "panel1"});
    panel1.orientation = "row";
    panel1.alignChildren = ["left","center"];
    panel1.spacing = 10;
    panel1.margins = 10;

var statictext1 = panel1.add("statictext", undefined, undefined, {name: "statictext1"});
    statictext1.text = "导出路径：";

var ljInput = panel1.add('edittext {properties: {name: "ljInput"}}');
    ljInput.preferredSize.width = 150;
    ljInput.text = Folder.desktop;

var llButton = panel1.add("button", undefined, undefined, {name: "llButton"});
    llButton.text = "浏览";

var logCheckbox = panel1.add("checkbox", undefined, "生成日志");
    logCheckbox.value = false;

// GROUP3
// ======
var group3 = dialog.add("group", undefined, {name: "group3"});
    group3.orientation = "row";
    group3.alignChildren = ["center","fill"];
    group3.spacing = 20;
    group3.margins = 10;

// CMYKCUSTOM
// ==========
var cmykCustom = group3.add("panel", undefined, undefined, {name: "cmykCustom"});
    cmykCustom.text = "四色";
    cmykCustom.orientation = "column";
    cmykCustom.alignChildren = ["left","top"];
    cmykCustom.spacing = 20;
    cmykCustom.margins = 10;

// PANEL2
// ======
var panel2 = cmykCustom.add("panel", undefined, undefined, {name: "panel2"});
    panel2.text = "参数";
    panel2.orientation = "row";
    panel2.alignChildren = ["left","center"];
    panel2.spacing = 10;
    panel2.margins = 10;

var cmykCompression = panel2.add("checkbox", undefined, undefined, {name: "cmykCompression"});
    cmykCompression.text = "LZW压缩";
    cmykCompression.value = true;

var cmykAliasing = panel2.add("statictext", undefined, undefined, {name: "cmykAliasing"});
    cmykAliasing.text = "抗锯齿:";

var cmykAntiAliasing_array = ["无","-","优化图稿","-","优化文字"];
var cmykAntiAliasing = panel2.add("dropdownlist", undefined, undefined, {name: "cmykAntiAliasing", items: cmykAntiAliasing_array});
    cmykAntiAliasing.selection = 0;

var cmykPpiInput = panel2.add("statictext", undefined, undefined, {name: "cmykPpiInput"});
    cmykPpiInput.text = "PPI:";

var cmykPpi_array = ["72", "150", "300", "360", "600"];
var cmykPpi = panel2.add("dropdownlist", undefined, undefined, {name: "cmykPpi", items: cmykPpi_array});
    cmykPpi.selection = 3;
    cmykPpi.preferredSize.width = 70;

// CMYKCUSTOM
// ==========
var cmykStaticText = cmykCustom.add("statictext", undefined, undefined, {name: "cmykStaticText"});
    cmykStaticText.text = "选择画板：";

var cmykSelectGroup = cmykCustom.add("group");
    cmykSelectGroup.spacing = 5;
var cmykSelectAllCheck = cmykSelectGroup.add("checkbox", undefined, "全选");
cmykSelectAllCheck.value = false;

// GRAYCUSTOM
// ==========
var grayCustom = group3.add("panel", undefined, undefined, {name: "grayCustom"});
    grayCustom.text = "工艺";
    grayCustom.orientation = "column";
    grayCustom.alignChildren = ["left","top"];
    grayCustom.spacing = 20;
    grayCustom.margins = 10;

// PANEL3
// ======
var panel3 = grayCustom.add("panel", undefined, undefined, {name: "panel3"});
    panel3.text = "参数";
    panel3.orientation = "row";
    panel3.alignChildren = ["left","center"];
    panel3.spacing = 10;
    panel3.margins = 10;

var grayCompression = panel3.add("checkbox", undefined, undefined, {name: "grayCompression"});
    grayCompression.text = "LZW压缩";
    grayCompression.value = true;

var grayAliasing = panel3.add("statictext", undefined, undefined, {name: "grayAliasing"});
    grayAliasing.text = "抗锯齿:";

var grayAntiAliasing_array = ["无","-","优化图稿","-","优化文字"];
var grayAntiAliasing = panel3.add("dropdownlist", undefined, undefined, {name: "grayAntiAliasing", items: grayAntiAliasing_array});
    grayAntiAliasing.selection = 0;

var grayPpiInput = panel3.add("statictext", undefined, undefined, {name: "grayPpiInput"});
    grayPpiInput.text = "PPI:";

var grayPpi_array = ["72", "150", "300", "360", "600"];
var grayPpi = panel3.add("dropdownlist", undefined, undefined, {name: "grayPpi", items: grayPpi_array});
    grayPpi.selection = 3;
    grayPpi.preferredSize.width = 70;

// GRAYCUSTOM
// ==========
var grayStaticText = grayCustom.add("statictext", undefined, undefined, {name: "grayStaticText"});
    grayStaticText.text = "选择画板：";

var graySelectGroup = grayCustom.add("group");
    graySelectGroup.spacing = 5;
var graySelectAllCheck = graySelectGroup.add("checkbox", undefined, "全选");
graySelectAllCheck.value = false;

// GROUP4
// ======
var group4 = dialog.add("group", undefined, {name: "group4"});
    group4.orientation = "row";
    group4.alignChildren = ["left","top"];
    group4.spacing = 10;
    group4.margins = 0;
    group4.alignment = ["center","top"];

var ok = group4.add("button", undefined, undefined, {name: "ok"});
    ok.text = "导出";

var cancel = group4.add("button", undefined, undefined, {name: "cancel"});
    cancel.text = "取消";
cancel.onClick = function() {
    dialog.close(false);
}

var grayArtboardSet = {};
var cmykArtboardSet = {};
var grayProcessMap = {};
var cmykProcessMap = {};
var grayCheckboxArray = [];
var cmykCheckboxArray = [];
var thumbnailFileMap = {};
var doc = activeDocument;
var artboards = doc.artboards;
var docName = doc.name.replace(/\.[^\.]+$/, "");

var scriptFile = new File($.fileName);
var scriptFolder = scriptFile.parent;

var logStream = false;
var logFile = null;

function log(msg) {
    if (logStream && logFile) logFile.writeln(msg);
}

var myDocs = new Folder(Folder.myDocuments.fsName);
var exportFolder = myDocs.fsName;
if (!exportFolder || exportFolder === "" || !myDocs.exists) {
    myDocs = new Folder("C:\\Users\\" + $.userName + "\\Documents");
    exportFolder = myDocs.fsName;
}
if (!exportFolder || exportFolder === "") {
    exportFolder = "C:\\Users\\" + $.userName + "\\Documents";
}
exportFolder = exportFolder.replace(/[\/\\]+/, "\\");
if (!exportFolder.match(/\\$/)) exportFolder += "\\";
exportFolder += "YM_AI_Scripts\\artboard_thumbnails\\";
log("缩略图目录: " + exportFolder);
if (!Folder(exportFolder).exists) Folder(exportFolder).create();

try {
    var oldFiles = Folder(exportFolder).getFiles("*.png");
    for (var f = 0; f < oldFiles.length; f++) {
        oldFiles[f].remove();
    }
    log("旧缩略图已清理");
} catch(e) {}

function showPreview(artboardName, highPath) {
    var thumbInfo = thumbnailFileMap[artboardName];
    var previewPath = highPath || (thumbInfo ? thumbInfo.high : null);

    var previewDialog = new Window("dialog", "预览: " + artboardName);
    previewDialog.orientation = "column";
    previewDialog.alignChildren = "center";

    var imgFile = new File(previewPath);
    if (imgFile.exists) {
        var img = previewDialog.add("image", undefined, imgFile);
        var maxSize = 600;
        img.maximumSize = [maxSize, maxSize];
    } else {
        previewDialog.add("statictext", undefined, "预览图片不存在: " + previewPath);
    }

    var btnRow = previewDialog.add("group");
    btnRow.orientation = "row";
    var closeBtn = btnRow.add("button", undefined, "关闭");
    closeBtn.onClick = function() {
        previewDialog.close();
    };

    previewDialog.layout.layout(true);
    previewDialog.show();
}

function loadSettings() {
    var configFile = new File(exportFolder + "..\\settings.txt");
    if (configFile.exists) {
        try {
            configFile.open("r");
            var content = configFile.read();
            configFile.close();
            if (content.indexOf("log=true") >= 0) {
                return true;
            }
        } catch(e) {}
    }
    return false;
}

logCheckbox.value = loadSettings();

function saveSettings(enableLog) {
    var configFile = new File(exportFolder + "..\\settings.txt");
    try {
        configFile.open("w");
        configFile.writeln("log=" + enableLog);
        configFile.close();
    } catch(e) {}
}

function initLog() {
    if (logCheckbox.value) {
        logFile = new File(scriptFolder.fsName + "\\export_log.txt");
        logStream = logFile.open("a");
        if (logStream) {
            logFile.writeln("=== 导出开始: " + new Date().toLocaleString() + " ===");
            logFile.writeln("文档: " + doc.name);
        }
    }
}

log("========== 导出UV机TIFF ==========");
log("文档: " + doc.name);
log("画板数量: " + doc.artboards.length);
log("日志启用: " + (logCheckbox.value ? "是" : "否"));

initLog();



function preloadThumbnailsSync() {
    var previewItems = [];
    var maxThumbSize = 36;
    var maxPreviewSize = 600;

    for (var i = 0; i < doc.artboards.length; i++) {
        doc.artboards.setActiveArtboardIndex(i);
        var artboard = doc.artboards[i];
        var previewPath = null;
        var previewHighPath = null;
        var randomNum = new Date().getTime();

        var artboardRect = artboard.artboardRect;
        var artboardWidth = artboardRect[2] - artboardRect[0];
        var artboardHeight = Math.abs(artboardRect[3] - artboardRect[1]);

        var thumbScale = Math.min(maxThumbSize / artboardWidth, maxThumbSize / artboardHeight) * 100;
        var previewScale = Math.min(maxPreviewSize / artboardWidth, maxPreviewSize / artboardHeight) * 100;

        try {
            previewPath = exportFolder + "preview_" + i + "_" + randomNum + ".png";
            var previewOptions = new ExportOptionsPNG24();
            previewOptions.transparency = false;
            previewOptions.artBoardClipping = true;
            previewOptions.horizontalScale = thumbScale;
            previewOptions.verticalScale = thumbScale;
            doc.exportFile(new File(previewPath), ExportType.PNG24, previewOptions);
            log("缩略图已导出: " + previewPath + " (缩放: " + thumbScale + "%)");

            previewHighPath = exportFolder + "preview_high_" + i + "_" + randomNum + ".png";
            var previewHighOptions = new ExportOptionsPNG24();
            previewHighOptions.transparency = false;
            previewHighOptions.artBoardClipping = true;
            previewHighOptions.horizontalScale = previewScale;
            previewHighOptions.verticalScale = previewScale;
            doc.exportFile(new File(previewHighPath), ExportType.PNG24, previewHighOptions);
            log("高清预览图已导出: " + previewHighPath + " (缩放: " + previewScale + "%)");
        } catch (e) {
            log("缩略图导出失败: " + artboard.name + " - " + e.message);
            previewPath = null;
            previewHighPath = null;
        }

        thumbnailFileMap[artboard.name] = { thumb: previewPath, high: previewHighPath };
        previewItems.push({ artboard: artboard, imgPath: previewPath, highPath: previewHighPath });
    }
    return previewItems;
}

function buildArtboardOptions(previewItems) {
    for (var i = 0; i < previewItems.length; i++) {
        addThumbnailToUI(previewItems[i].artboard, previewItems[i].imgPath, previewItems[i].highPath);
    }
    dialog.layout.layout(true);
}
function addThumbnailToUI(artboard, imgPath, highPath) {
    var artboardName = artboard.name;

    var grayRow = grayCustom.add("group");
    grayRow.orientation = "row";
    grayRow.alignChildren = ["left", "center"];
    grayRow.spacing = 5;

    var grayCheckbox = grayRow.add("checkbox", undefined, artboardName);
    grayCheckbox.value = false;
    grayCheckbox.onClick = function() {
        if(this.value) {
            grayArtboardSet[this.text] = true;
        } else {
            delete grayArtboardSet[this.text];
            delete grayProcessMap[this.text];
        }
    };
    grayCheckboxArray.push(grayCheckbox);

    var grayProcessArray = ["无", "烫金", "烫银", "UV1", "UV2", "UV3", "UV4", "UV5"];
    var grayProcessDropdown = grayRow.add("dropdownlist", undefined, undefined, {items: grayProcessArray});
    grayProcessDropdown.selection = 0;
    grayProcessDropdown.preferredSize.width = 60;
    grayProcessDropdown.onChange = function() {
        if(grayCheckbox.value) {
            grayProcessMap[artboardName] = this.selection.text;
        }
    };

    var cmykRow = cmykCustom.add("group");
    cmykRow.orientation = "row";
    cmykRow.alignChildren = ["left", "center"];
    cmykRow.spacing = 5;

    var cmykCheckbox = cmykRow.add("checkbox", undefined, artboardName);
    cmykCheckbox.value = false;
    cmykCheckbox.onClick = function() {
        if(this.value) {
            cmykArtboardSet[this.text] = true;
        } else {
            delete cmykArtboardSet[this.text];
            delete cmykProcessMap[this.text];
        }
    };
    cmykCheckboxArray.push(cmykCheckbox);

    var cmykProcessArray = ["无", "烫金", "烫银", "UV1", "UV2", "UV3", "UV4", "UV5"];
    var cmykProcessDropdown = cmykRow.add("dropdownlist", undefined, undefined, {items: cmykProcessArray});
    cmykProcessDropdown.selection = 0;
    cmykProcessDropdown.preferredSize.width = 60;
    cmykProcessDropdown.onChange = function() {
        if(cmykCheckbox.value) {
            cmykProcessMap[artboardName] = this.selection.text;
        }
    };



    if (imgPath) {
        log("检查缩略图: " + imgPath);
        var imgFile = new File(imgPath);
        log("图片文件存在: " + imgFile.exists);
        if (imgFile.exists) {
            try {
                var uiImage = ScriptUI.newImage(imgFile);
                log("UI图片创建: " + (uiImage ? "成功" : "失败"));
                if (uiImage) {
                    (function(name, img, highImgPath) {
                        var thumbImage = grayRow.add("image", undefined, img);
                        thumbImage.size = [40, 40];
                        thumbImage.helpTip = "点击放大预览: " + name;
                        thumbImage.addEventListener("click", function() {
                            showPreview(name, highImgPath);
                        });
                    })(artboardName, uiImage, highPath);

                    (function(name, img, highImgPath) {
                        var thumbImage = cmykRow.add("image", undefined, img);
                        thumbImage.size = [40, 40];
                        thumbImage.helpTip = "点击放大预览: " + name;
                        thumbImage.addEventListener("click", function() {
                            showPreview(name, highImgPath);
                        });
                    })(artboardName, uiImage, highPath);
                }
            } catch(e) {
                log("缩略图加载错误: " + e.message);
            }
        }
    }
}

cmykSelectAllCheck.onClick = function() {
    if(this.value) {
        for (var i = 0; i < cmykCheckboxArray.length; i++) {
            cmykCheckboxArray[i].value = true;
            cmykArtboardSet[artboards[i].name] = true;
        }
    } else {
        for (var i = 0; i < cmykCheckboxArray.length; i++) {
            cmykCheckboxArray[i].value = false;
        }
        cmykArtboardSet = {};
    }
};

graySelectAllCheck.onClick = function() {
    if(this.value) {
        for (var i = 0; i < grayCheckboxArray.length; i++) {
            grayCheckboxArray[i].value = true;
            grayArtboardSet[artboards[i].name] = true;
        }
    } else {
        for (var i = 0; i < grayCheckboxArray.length; i++) {
            grayCheckboxArray[i].value = false;
        }
        grayArtboardSet = {};
    }
};

function cleanupTempFiles() {
    try {
        var thumbnailFolder = new Folder(exportFolder);
        if (thumbnailFolder.exists) {
            var files = thumbnailFolder.getFiles("*.png");
            for (var i = 0; i < files.length; i++) {
                files[i].remove();
            }
        }
    } catch(e) {}
}

llButton.onClick = function() {
    var folder = Folder.selectDialog("选择导出文件夹");
    if (!folder) {
        return;
    }
    ljInput.text = folder.fsName;
    ljInput.enabled = true;
}

ok.onClick = function() {
    function countKeys(obj) {
        var count = 0;
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) count++;
        }
        return count;
    }
    var grayCount = countKeys(grayArtboardSet);
    var cmykCount = countKeys(cmykArtboardSet);
    if(ljInput.text === "") {
        alert("未选择导出文件夹！", "错误");
    } else {
        if(grayCount == 0 && cmykCount == 0) {
            alert("未选择画板！", "错误");
        } else {
            dialog.close(true);
        }
    }
}

// 快速导出 多个画板到单个TIFF 文件
function exportArtboardsToTIFF(resolution, artboardRange, imageColorSpace, filePath, antiAliasing, IZWCompression) {
    try {
        var exportOptions = new ExportOptionsTIFF();
        exportOptions.resolution = resolution;
        exportOptions.artboardRange = artboardRange;
        exportOptions.saveMultipleArtboards = true;
        exportOptions.imageColorSpace = imageColorSpace;
        exportOptions.antiAliasing = antiAliasing;
        exportOptions.LZWCompression = IZWCompression;

        doc.exportFile(filePath, ExportType.TIFF, exportOptions);
        return true;
    } catch(e) {
        alert("导出TIFF 失败: " + e.message, "错误");
        return false;
    }
}

function getAntiAliasing(value) {
    if(!value || value === "无") {
        return AntiAliasingMethod.None;
    } else if(value === "优化图稿") {
        return AntiAliasingMethod.ARTOPTIMIZED;
    } else if(value === "优化文字") {
        return AntiAliasingMethod.TYPEOPTIMIZED;
    } else {
        return AntiAliasingMethod.None;
    }
}

var previewItems = preloadThumbnailsSync();
buildArtboardOptions(previewItems);
myReturn = dialog.show();

if (myReturn == true) {

    var artboardIndexMap = {};
    for (var y = 0; y < artboards.length; y++) {
        artboardIndexMap[artboards[y].name] = y + 1;
    }

    function getObjectKeys(obj) {
        var keys = [];
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                keys.push(key);
            }
        }
        return keys;
    }

    var grayArtboardNames = getObjectKeys(grayArtboardSet);
    var cmykArtboardNames = getObjectKeys(cmykArtboardSet);

    var grayProcessGroups = {};
    for(var i = 0; i < grayArtboardNames.length; i++) {
        var artboardName = grayArtboardNames[i];
        var process = grayProcessMap[artboardName] || "无";
        if(!grayProcessGroups[process]) {
            grayProcessGroups[process] = [];
        }
        grayProcessGroups[process].push(artboardName);
    }

    var cmykProcessGroups = {};
    for(var i = 0; i < cmykArtboardNames.length; i++) {
        var artboardName = cmykArtboardNames[i];
        var process = cmykProcessMap[artboardName] || "无";
        if(!cmykProcessGroups[process]) {
            cmykProcessGroups[process] = [];
        }
        cmykProcessGroups[process].push(artboardName);
    }

    if(grayArtboardNames.length > 0) {
        var grayPpiValue = parseInt(grayPpi.selection ? grayPpi.selection.text : "360", 10) || 360;
        var grayAntiAliasValue = getAntiAliasing(grayAntiAliasing.selection ? grayAntiAliasing.selection.text : "无");

        for (var process in grayProcessGroups) {
            var processArtboards = grayProcessGroups[process];
            var processSuffix = process === "无" ? "_gray" : "_" + process;
            var grayFilePath = new File(ljInput.text + "/" + docName + processSuffix + ".tif");
            log("正在导出灰度TIFF: " + grayFilePath.fullName + " (PPI: " + grayPpiValue + ")");

            for(var i = 0; i < processArtboards.length; i++) {
                var artboardName = processArtboards[i];
                if(artboardIndexMap[artboardName]) {
                    exportArtboardsToTIFF(grayPpiValue, artboardIndexMap[artboardName], ImageColorSpace.GrayScale, grayFilePath, grayAntiAliasValue, grayCompression.value);
                    log("  - 导出画板: " + artboardName + " (工艺: " + process + ")");
                }
            }
        }
    }
    if(cmykArtboardNames.length > 0) {
        var cmykPpiValue = parseInt(cmykPpi.selection ? cmykPpi.selection.text : "360", 10) || 360;
        var cmykAntiAliasValue = getAntiAliasing(cmykAntiAliasing.selection ? cmykAntiAliasing.selection.text : "无");

        for (var process in cmykProcessGroups) {
            var processArtboards = cmykProcessGroups[process];
            var processSuffix = process === "无" ? "" : "_" + process;
            var cmykFilePath = new File(ljInput.text + "/" + docName + processSuffix + ".tif");
            log("正在导出CMYK TIFF: " + cmykFilePath.fullName + " (PPI: " + cmykPpiValue + ")");

            for(var i = 0; i < processArtboards.length; i++) {
                var artboardName = processArtboards[i];
                if(artboardIndexMap[artboardName]) {
                    exportArtboardsToTIFF(cmykPpiValue, artboardIndexMap[artboardName], ImageColorSpace.CMYK, cmykFilePath, cmykAntiAliasValue, cmykCompression.value);
                    log("  - 导出画板: " + artboardName + " (工艺: " + process + ")");
                }
            }
        }
    }
    cleanupTempFiles();
    saveSettings(logCheckbox.value);
    log("========== 导出完成 ==========");
    log("CMYK画板: " + cmykArtboardNames.join(", "));
    log("灰度画板: " + grayArtboardNames.join(", "));
    if (logFile) logFile.close();
}
