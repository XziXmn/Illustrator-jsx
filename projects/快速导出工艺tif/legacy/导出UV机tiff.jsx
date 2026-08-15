
/*
Code for Import https://scriptui.joonas.me — (Triple click to select): 
{"activeId":70,"items":{"item-0":{"id":0,"type":"Dialog","parentId":false,"style":{"text":"快速导出tiff","preferredSize":[0,0],"margins":10,"orientation":"column","spacing":10,"alignChildren":["left","top"],"varName":"","windowType":"Dialog","creationProps":{"su1PanelCoordinates":false,"maximizeButton":false,"minimizeButton":false,"independent":false,"closeButton":true,"borderless":false,"resizeable":false},"enabled":true}},"item-1":{"id":1,"type":"Panel","parentId":20,"style":{"text":"CMYK","preferredSize":[0,0],"margins":10,"orientation":"column","spacing":20,"alignChildren":["left","top"],"alignment":null,"varName":"cmykCustom","creationProps":{"borderStyle":"etched","su1PanelCoordinates":false},"enabled":true}},"item-20":{"id":20,"type":"Group","parentId":0,"style":{"preferredSize":[0,0],"margins":10,"orientation":"row","spacing":20,"alignChildren":["center","fill"],"alignment":null,"varName":null,"enabled":true}},"item-21":{"id":21,"type":"Panel","parentId":20,"style":{"text":"灰度","preferredSize":[0,0],"margins":10,"orientation":"column","spacing":20,"alignChildren":["left","top"],"alignment":null,"varName":"grayCustom","creationProps":{"borderStyle":"etched","su1PanelCoordinates":false},"enabled":true}},"item-22":{"id":22,"type":"StaticText","parentId":21,"style":{"text":"选择画板：","justify":"left","preferredSize":[0,0],"alignment":null,"varName":"grayStaticText","helpTip":null,"softWrap":false,"creationProps":{"truncate":"none","multiline":false,"scrolling":false},"enabled":true}},"item-36":{"id":36,"type":"Group","parentId":0,"style":{"preferredSize":[0,0],"margins":0,"orientation":"row","spacing":10,"alignChildren":["left","top"],"alignment":"center","varName":null,"enabled":true}},"item-37":{"id":37,"type":"Button","parentId":36,"style":{"text":"导出","justify":"center","preferredSize":[0,0],"alignment":null,"varName":"ok","helpTip":null,"enabled":true}},"item-38":{"id":38,"type":"Button","parentId":36,"style":{"text":"取消","justify":"center","preferredSize":[0,0],"alignment":null,"varName":"cancel","helpTip":null,"enabled":true}},"item-45":{"id":45,"type":"Group","parentId":0,"style":{"enabled":true,"varName":null,"preferredSize":[0,0],"margins":0,"orientation":"row","spacing":10,"alignChildren":["left","top"],"alignment":"center"}},"item-46":{"id":46,"type":"EditText","parentId":49,"style":{"enabled":true,"varName":"ljInput","creationProps":{"noecho":false,"readonly":false,"multiline":false,"scrollable":false,"borderless":false,"enterKeySignalsOnChange":false},"softWrap":false,"text":"","justify":"left","preferredSize":[150,0],"alignment":null,"helpTip":null}},"item-47":{"id":47,"type":"Button","parentId":49,"style":{"enabled":true,"varName":"llButton","text":"浏览","justify":"center","preferredSize":[0,0],"alignment":null,"helpTip":null}},"item-48":{"id":48,"type":"StaticText","parentId":49,"style":{"enabled":true,"varName":null,"creationProps":{"truncate":"none","multiline":false,"scrolling":false},"softWrap":false,"text":"导出路径：","justify":"left","preferredSize":[0,0],"alignment":null,"helpTip":null}},"item-49":{"id":49,"type":"Panel","parentId":45,"style":{"enabled":true,"varName":null,"creationProps":{"borderStyle":"etched","su1PanelCoordinates":false},"text":"","preferredSize":[0,0],"margins":10,"orientation":"row","spacing":10,"alignChildren":["left","center"],"alignment":null}},"item-54":{"id":54,"type":"Panel","parentId":1,"style":{"enabled":true,"varName":null,"creationProps":{"borderStyle":"etched","su1PanelCoordinates":false},"text":"参数","preferredSize":[0,0],"margins":10,"orientation":"row","spacing":10,"alignChildren":["left","center"],"alignment":null}},"item-55":{"id":55,"type":"Checkbox","parentId":54,"style":{"enabled":true,"varName":"cmykCompression","text":"LZW压缩","preferredSize":[0,0],"alignment":null,"helpTip":null,"checked":false}},"item-57":{"id":57,"type":"Panel","parentId":21,"style":{"enabled":true,"varName":null,"creationProps":{"borderStyle":"etched","su1PanelCoordinates":false},"text":"参数","preferredSize":[0,0],"margins":10,"orientation":"row","spacing":10,"alignChildren":["left","center"],"alignment":null}},"item-58":{"id":58,"type":"Checkbox","parentId":57,"style":{"enabled":true,"varName":"grayCompression","text":"LZW压缩","preferredSize":[0,0],"alignment":null,"helpTip":null}},"item-60":{"id":60,"type":"EditText","parentId":54,"style":{"enabled":true,"varName":"cmykPpi","creationProps":{"noecho":false,"readonly":false,"multiline":false,"scrollable":false,"borderless":false,"enterKeySignalsOnChange":false},"softWrap":false,"text":"360","justify":"left","preferredSize":[50,0],"alignment":null,"helpTip":""}},"item-61":{"id":61,"type":"StaticText","parentId":54,"style":{"enabled":true,"varName":"cmykPpiInput","creationProps":{"truncate":"none","multiline":false,"scrolling":false},"softWrap":false,"text":"PPI:","justify":"left","preferredSize":[0,0],"alignment":null,"helpTip":null}},"item-62":{"id":62,"type":"StaticText","parentId":57,"style":{"enabled":true,"varName":"grayPpiInput","creationProps":{"truncate":"none","multiline":false,"scrolling":false},"softWrap":false,"text":"PPI:","justify":"left","preferredSize":[0,0],"alignment":null,"helpTip":null}},"item-63":{"id":63,"type":"EditText","parentId":57,"style":{"enabled":true,"varName":"grayPpi","creationProps":{"noecho":false,"readonly":false,"multiline":false,"scrollable":false,"borderless":false,"enterKeySignalsOnChange":false},"softWrap":false,"text":"360","justify":"left","preferredSize":[50,0],"alignment":null,"helpTip":null}},"item-64":{"id":64,"type":"DropDownList","parentId":54,"style":{"enabled":true,"varName":"cmykAntiAliasing","text":"DropDownList","listItems":"无, -, 优化图稿,-,优化文字","preferredSize":[0,0],"alignment":null,"selection":0,"helpTip":null}},"item-65":{"id":65,"type":"StaticText","parentId":54,"style":{"enabled":true,"varName":"cmykAliasing","creationProps":{"truncate":"none","multiline":false,"scrolling":false},"softWrap":false,"text":"抗锯齿:","justify":"left","preferredSize":[0,0],"alignment":null,"helpTip":null}},"item-66":{"id":66,"type":"StaticText","parentId":57,"style":{"enabled":true,"varName":"grayAliasing","creationProps":{"truncate":"none","multiline":false,"scrolling":false},"softWrap":false,"text":"抗锯齿:","justify":"left","preferredSize":[0,0],"alignment":null,"helpTip":null}},"item-67":{"id":67,"type":"DropDownList","parentId":57,"style":{"enabled":true,"varName":"grayAntiAliasing","text":"DropDownList","listItems":"无, -, 优化图稿,-,优化文字","preferredSize":[0,0],"alignment":null,"selection":0,"helpTip":null}},"item-68":{"id":68,"type":"StaticText","parentId":1,"style":{"enabled":true,"varName":"cmykStaticText","creationProps":{"truncate":"none","multiline":false,"scrolling":false},"softWrap":false,"text":"选择画板：","justify":"left","preferredSize":[0,0],"alignment":null,"helpTip":null}},"item-69":{"id":69,"type":"Group","parentId":0,"style":{"enabled":true,"varName":null,"preferredSize":[0,0],"margins":0,"orientation":"row","spacing":10,"alignChildren":["left","center"],"alignment":"center"}},"item-70":{"id":70,"type":"Panel","parentId":69,"style":{"enabled":true,"varName":"artboardThumbnail","creationProps":{"borderStyle":"etched","su1PanelCoordinates":false},"text":"画板缩略图","preferredSize":[0,0],"margins":10,"orientation":"row","spacing":10,"alignChildren":["left","center"],"alignment":null}},"item-71":{"id":71,"type":"Image","parentId":70,"style":{"enabled":true,"varName":"","image":["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAYAAAA7MK6iAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAQdJREFUeNrslv0NgyAQxcV0AEZwBEdoN3AEu0E7iSN0hW6gG9gRuoFuQB8NtGg9QSL4R33JixcUf3zcEZiAkg2UJhvpYMRX+BGYl8PVOxJfHV164rsc5j5UydCwdEGnAu4QtnCH+OY7AOcZ410moeJXVegZFzAn2jfJah4afF/Yvg6YMfbE4wz3RnOjSjBcchnfcpUgWbRyUjPv4UatgDmYWtZ3tORSdVzDcrUWwVPLjyu4tEBzI8Pd4dQeq5NJq5zY61ZMq6Pg5h5PgkfQAdwCnYXPggmo1sUBSsJJsAXqowGcArcijD5wE8wiXX3kiXfSmR/z6jMuvYT93WVvB+/gHbyaXgIMAHWCmD3KjfSwAAAAAElFTkSuQmCC"],"alignment":null,"helpTip":null}}},"order":[0,45,49,48,46,47,69,70,71,20,1,54,55,65,64,61,60,68,21,57,58,66,67,62,63,22,36,37,38],"settings":{"importJSON":true,"indentSize":false,"cepExport":false,"includeCSSJS":true,"functionWrapper":false,"compactCode":false,"showDialog":true,"afterEffectsDockable":false,"itemReferenceList":"None"}}
*/ 

if (app.documents.length == 0) {
    alert("请先建立一个新文件", "错误");
    app.documents.add();
}

// DIALOG
// ======
var dialog = new Window("dialog"); 
    dialog.text = "快速导出tiff"; 
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

// GROUP2
// ======
var group2 = dialog.add("group", undefined, {name: "group2"}); 
    group2.orientation = "row"; 
    group2.alignChildren = ["left","center"]; 
    group2.spacing = 10; 
    group2.margins = 0; 
    group2.alignment = ["center","top"]; 

// ARTBOARDTHUMBNAIL
// =================
var artboardThumbnail = group2.add("panel", undefined, undefined, {name: "artboardThumbnail"}); 
    artboardThumbnail.text = "画板缩略图"; 
    artboardThumbnail.orientation = "row"; 
    artboardThumbnail.alignChildren = ["left","center"]; 
    artboardThumbnail.spacing = 10; 
    artboardThumbnail.margins = 10; 

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
    cmykCustom.text = "CMYK"; 
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

var cmykAliasing = panel2.add("statictext", undefined, undefined, {name: "cmykAliasing"}); 
    cmykAliasing.text = "抗锯齿:"; 

var cmykAntiAliasing_array = ["无","-","优化图稿","-","优化文字"]; 
var cmykAntiAliasing = panel2.add("dropdownlist", undefined, undefined, {name: "cmykAntiAliasing", items: cmykAntiAliasing_array}); 
    cmykAntiAliasing.selection = 0; 

var cmykPpiInput = panel2.add("statictext", undefined, undefined, {name: "cmykPpiInput"}); 
    cmykPpiInput.text = "PPI:"; 

var cmykPpi = panel2.add('edittext {properties: {name: "cmykPpi"}}'); 
    cmykPpi.text = "360"; 
    cmykPpi.preferredSize.width = 50; 

// CMYKCUSTOM
// ==========
var cmykStaticText = cmykCustom.add("statictext", undefined, undefined, {name: "cmykStaticText"}); 
    cmykStaticText.text = "选择画板："; 

// GRAYCUSTOM
// ==========
var grayCustom = group3.add("panel", undefined, undefined, {name: "grayCustom"}); 
    grayCustom.text = "灰度"; 
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

var grayAliasing = panel3.add("statictext", undefined, undefined, {name: "grayAliasing"}); 
    grayAliasing.text = "抗锯齿:"; 

var grayAntiAliasing_array = ["无","-","优化图稿","-","优化文字"]; 
var grayAntiAliasing = panel3.add("dropdownlist", undefined, undefined, {name: "grayAntiAliasing", items: grayAntiAliasing_array}); 
    grayAntiAliasing.selection = 0; 

var grayPpiInput = panel3.add("statictext", undefined, undefined, {name: "grayPpiInput"}); 
    grayPpiInput.text = "PPI:"; 

var grayPpi = panel3.add('edittext {properties: {name: "grayPpi"}}'); 
    grayPpi.text = "360"; 
    grayPpi.preferredSize.width = 50; 

// GRAYCUSTOM
// ==========
var grayStaticText = grayCustom.add("statictext", undefined, undefined, {name: "grayStaticText"}); 
    grayStaticText.text = "选择画板："; 

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

var grayArtboardName = [];
var cmykArtboardName = [];
var doc = activeDocument;
var artboards = doc.artboards;
var docName = doc.name.replace(/\.[^\.]+$/, "");
var exportFolder = Folder.myDocuments + "/YM_AI_Scripts/artboard_thumbnails/";
if (!Folder(exportFolder).exists) Folder(exportFolder).create();

// 遍历所有画板并导出缩略图
for (var i = 0; i < doc.artboards.length; i++) {
    // 设置当前画板为活动画板
    doc.artboards.setActiveArtboardIndex(i);
    var artboard = doc.artboards[i];

    // 获取画板的宽高
    var artboardRect = artboard.artboardRect;
    var artboardWidth = artboardRect[2] - artboardRect[0];
    var artboardHeight = artboardRect[1] - artboardRect[3];

    // 计算缩放比例以使导出符合目标尺寸
    var scaleX = (40 / artboardWidth) * 100; // 设置导出选项的缩放比例
    var scaleY = (40 / artboardHeight) * 100;

    // 设置图像导出路径
    var exportPath = exportFolder + doc.name + "_" + (i + 1) + ".png";

    // 导出画板为 PNG 文件
    var exportOptions = new ExportOptionsPNG8();
    exportOptions.colorCount = 8;
    exportOptions.transparency = false;
    exportOptions.artBoardClipping = true; 
    exportOptions.horizontalScale = scaleX;
    exportOptions.verticalScale = scaleY;
    doc.exportFile(new File(exportPath), ExportType.PNG8, exportOptions);

    // 为每个画板创建一个显示图像的控件
    var img = artboardThumbnail.add("image", undefined, File(exportPath), {name: artboard.name + i});
    img.text = artboard.name;
    img.addEventListener('click', function() {
        alert(this.text)
    });
}

for (var i = 0; i < artboards.length; i++) {
    // 获取画板
    var artboard = artboards[i];
    var newLabelGray = grayCustom.add("checkbox", undefined, undefined, {name: "grayCheckbox" + i});
    newLabelGray.text = artboard.name;
    newLabelGray.value = false;

    var newLabelCmyk = cmykCustom.add("checkbox", undefined, undefined, {name: "cmykCheckbox" + i});
    newLabelCmyk.text = artboard.name;
    newLabelCmyk.value = false;

    newLabelGray.onClick = function() {
        if(this.value) {
            grayArtboardName.push(this.text);
        } else {
            for(var d in grayArtboardName) {
                if(grayArtboardName[d] === this.text) {
                    grayArtboardName.splice(d, 1);
                }
            }
        }
    };
    newLabelCmyk.onClick = function() {
        if(this.value) {
            cmykArtboardName.push(this.text);
        } else {
            for(var o in cmykArtboardName) {
                if(cmykArtboardName[o] === this.text) {
                    cmykArtboardName.splice(o, 1);
                }
            }
        }
    };
    dialog.layout.layout(true);
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
    if(ljInput.text === "") {
        alert("未选择导出文件夹！", "错误");
    } else {
        if(grayArtboardName.length == 0 & cmykArtboardName.length == 0) {
            alert("未选择画板！", "错误");
        } else {
            dialog.close(true);
        }
    }
}

// 导出所有画板为 TIFF 格式
function exportArtboardsToTIFF(resolution, artboardRange, imageColorSpace, filePath, antiAliasing, IZWCompression) {

    var exportOptions = new ExportOptionsTIFF();
    exportOptions.resolution = resolution;
    exportOptions.artboardRange = artboardRange;
    exportOptions.saveMultipleArtboards = true;
    exportOptions.imageColorSpace = imageColorSpace;
    exportOptions.antiAliasing = antiAliasing;
    exportOptions.IZWCompression = IZWCompression;

    doc.exportFile(filePath, ExportType.TIFF, exportOptions);
}

function getAntiAliasing(value) {
    if("无" === value) {
        return AntiAliasingMethod.None;
    } else if("优化图稿" === value) {
        return AntiAliasingMethod.ARTOPTIMIZED;
    } else if("优化文字" === value) {
        return AntiAliasingMethod.TYPEOPTIMIZED;
    } else {
        return AntiAliasingMethod.None;
    }

}

myReturn = dialog.show();

if (myReturn == true) {
    if(grayArtboardName.length > 0) {
        for(var i in grayArtboardName) {
            var artboardName = grayArtboardName[i];
            for (var y = 0; y < artboards.length; y++) {
                if(artboards[y].name === artboardName) {
                    var filePath = new File(ljInput.text + "/" + docName + "_gray" + ".tif");
                    exportArtboardsToTIFF(eval(grayPpi.text), y + 1, ImageColorSpace.GrayScale, filePath, getAntiAliasing(grayAntiAliasing.selection.text), grayCompression.value);
                }
            }
        }
    }
    if(cmykArtboardName.length > 0) {
        for(var i in cmykArtboardName) {
            var artboardName = cmykArtboardName[i];
            for (var y = 0; y < artboards.length; y++) {
                if(artboards[y].name === artboardName) {
                    var filePath = new File(ljInput.text + "/" + docName + ".tif");
                    exportArtboardsToTIFF(eval(cmykPpi.text), y + 1, ImageColorSpace.CMYK, filePath, getAntiAliasing(cmykAntiAliasing.selection.text), cmykCompression.value);
                }
            }
        }
    }
}