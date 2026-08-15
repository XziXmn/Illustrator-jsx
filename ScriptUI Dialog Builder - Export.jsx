
/*
Code for Import https://scriptui.joonas.me — (Triple click to select): 
{"activeId":58,"items":{"item-0":{"id":0,"type":"Dialog","parentId":false,"style":{"enabled":true,"varName":"","windowType":"Dialog","creationProps":{"su1PanelCoordinates":false,"maximizeButton":false,"minimizeButton":false,"independent":false,"closeButton":true,"borderless":false,"resizeable":false},"text":"云漫标记集","preferredSize":[0,0],"margins":23,"orientation":"column","spacing":10,"alignChildren":["center","center"]}},"item-1":{"id":1,"type":"Panel","parentId":50,"style":{"enabled":true,"varName":"Panel_1","creationProps":{"borderStyle":"etched","su1PanelCoordinates":false},"text":"标记参数","preferredSize":[148,0],"margins":23,"orientation":"column","spacing":10,"alignChildren":["left","center"],"alignment":"left"}},"item-2":{"id":2,"type":"Panel","parentId":31,"style":{"enabled":true,"varName":"Panel_2","creationProps":{"borderStyle":"etched","su1PanelCoordinates":false},"text":"选项","preferredSize":[148,0],"margins":23,"orientation":"column","spacing":10,"alignChildren":["left","center"],"alignment":"left"}},"item-3":{"id":3,"type":"StaticText","parentId":9,"style":{"enabled":true,"varName":"","creationProps":{"truncate":"none","multiline":false,"scrolling":false},"softWrap":false,"text":"大小：","justify":"left","preferredSize":[0,0],"alignment":null,"helpTip":"标记半径大小。"}},"item-5":{"id":5,"type":"StaticText","parentId":11,"style":{"enabled":true,"varName":null,"creationProps":{"truncate":"none","multiline":false,"scrolling":false},"softWrap":false,"text":"偏移：","justify":"left","preferredSize":[0,0],"alignment":null,"helpTip":"标记与文档之间的出血偏移间隔。"}},"item-6":{"id":6,"type":"EditText","parentId":9,"style":{"enabled":true,"varName":"markRadiusMMInput","creationProps":{"noecho":false,"readonly":false,"multiline":false,"scrollable":false,"borderless":false,"enterKeySignalsOnChange":false},"softWrap":false,"text":"3","justify":"left","preferredSize":[40,0],"alignment":null,"helpTip":"单位毫米"}},"item-8":{"id":8,"type":"EditText","parentId":11,"style":{"enabled":true,"varName":"offsetMMInput","creationProps":{"noecho":false,"readonly":false,"multiline":false,"scrollable":false,"borderless":false,"enterKeySignalsOnChange":false},"softWrap":false,"text":"2","justify":"left","preferredSize":[40,0],"alignment":null,"helpTip":"单位毫米"}},"item-9":{"id":9,"type":"Group","parentId":1,"style":{"enabled":true,"varName":"Markgroup_1","preferredSize":[0,0],"margins":0,"orientation":"row","spacing":4,"alignChildren":["left","center"],"alignment":null}},"item-11":{"id":11,"type":"Group","parentId":1,"style":{"enabled":true,"varName":"Markgroup_2","preferredSize":[0,0],"margins":0,"orientation":"row","spacing":4,"alignChildren":["left","center"],"alignment":null}},"item-12":{"id":12,"type":"Button","parentId":14,"style":{"enabled":true,"varName":"ok","text":"确定","justify":"center","preferredSize":[0,0],"alignment":null,"helpTip":null}},"item-13":{"id":13,"type":"Button","parentId":14,"style":{"enabled":true,"varName":"cancel","text":"取消","justify":"center","preferredSize":[0,0],"alignment":null,"helpTip":null}},"item-14":{"id":14,"type":"Group","parentId":0,"style":{"enabled":true,"varName":"buttongroup1","preferredSize":[0,0],"margins":0,"orientation":"row","spacing":25,"alignChildren":["left","center"],"alignment":null}},"item-15":{"id":15,"type":"Checkbox","parentId":2,"style":{"enabled":true,"varName":"whiteInkLayer","text":"添加白墨图层","preferredSize":[0,0],"alignment":null,"helpTip":"是否添加白墨层，默认为添加。","checked":false}},"item-16":{"id":16,"type":"StaticText","parentId":9,"style":{"enabled":true,"varName":null,"creationProps":{"truncate":"none","multiline":false,"scrolling":false},"softWrap":false,"text":"mm","justify":"left","preferredSize":[0,0],"alignment":null,"helpTip":null}},"item-18":{"id":18,"type":"StaticText","parentId":11,"style":{"enabled":true,"varName":null,"creationProps":{"truncate":"none","multiline":false,"scrolling":false},"softWrap":false,"text":"mm","justify":"left","preferredSize":[0,0],"alignment":null,"helpTip":null}},"item-19":{"id":19,"type":"Group","parentId":1,"style":{"enabled":true,"varName":"Markgroup_3","preferredSize":[0,0],"margins":0,"orientation":"row","spacing":4,"alignChildren":["left","center"],"alignment":null}},"item-20":{"id":20,"type":"StaticText","parentId":19,"style":{"enabled":true,"varName":null,"creationProps":{"truncate":"none","multiline":false,"scrolling":false},"softWrap":false,"text":"线宽：","justify":"left","preferredSize":[0,0],"alignment":null,"helpTip":"标记线宽粗细"}},"item-22":{"id":22,"type":"Checkbox","parentId":2,"style":{"enabled":true,"varName":"AdaptiveArtboard","text":"自适应画板","preferredSize":[0,0],"alignment":null,"helpTip":"是否扩展画板到标记大小。默认扩展。","checked":true}},"item-23":{"id":23,"type":"Checkbox","parentId":1,"style":{"enabled":true,"varName":"PrintingCornerLine","text":"印刷角线","preferredSize":[0,0],"alignment":null,"helpTip":"","checked":true}},"item-24":{"id":24,"type":"Checkbox","parentId":1,"style":{"enabled":true,"varName":"hotStampingMark","text":"冷烫标记","preferredSize":[0,0],"alignment":null,"helpTip":null,"checked":true}},"item-25":{"id":25,"type":"Checkbox","parentId":1,"style":{"enabled":true,"varName":"cuttingMark","text":"马克点","preferredSize":[0,0],"alignment":null,"helpTip":null,"checked":true}},"item-26":{"id":26,"type":"Divider","parentId":1,"style":{"enabled":true,"varName":""}},"item-27":{"id":27,"type":"Group","parentId":0,"style":{"enabled":true,"varName":"GeneralGroup1","preferredSize":[0,0],"margins":0,"orientation":"row","spacing":10,"alignChildren":["left","top"],"alignment":null}},"item-28":{"id":28,"type":"Checkbox","parentId":2,"style":{"enabled":true,"varName":"PrintingColorSeparation","text":"添加印刷分色","preferredSize":[0,0],"alignment":null,"helpTip":null,"checked":true}},"item-29":{"id":29,"type":"Checkbox","parentId":2,"style":{"enabled":true,"varName":"FileInformation","text":"添加文档信息","preferredSize":[0,0],"alignment":null,"helpTip":null,"checked":true}},"item-30":{"id":30,"type":"Panel","parentId":31,"style":{"enabled":false,"varName":"Panel_3","creationProps":{"borderStyle":"etched","su1PanelCoordinates":false},"text":"等分线","preferredSize":[148,0],"margins":23,"orientation":"column","spacing":10,"alignChildren":["right","top"],"alignment":null}},"item-31":{"id":31,"type":"Group","parentId":27,"style":{"enabled":true,"varName":"GeneralGroup1_2","preferredSize":[0,0],"margins":0,"orientation":"column","spacing":10,"alignChildren":["left","center"],"alignment":null}},"item-33":{"id":33,"type":"Group","parentId":30,"style":{"enabled":true,"varName":"Bisectorgroup_1","preferredSize":[0,0],"margins":0,"orientation":"row","spacing":4,"alignChildren":["left","center"],"alignment":null}},"item-34":{"id":34,"type":"StaticText","parentId":33,"style":{"enabled":true,"varName":"","creationProps":{"truncate":"none","multiline":false,"scrolling":false},"softWrap":false,"text":"水平数：","justify":"left","preferredSize":[0,0],"alignment":null,"helpTip":"切割线水平数量"}},"item-35":{"id":35,"type":"EditText","parentId":33,"style":{"enabled":true,"varName":"horizontalDirection","creationProps":{"noecho":false,"readonly":false,"multiline":false,"scrollable":false,"borderless":false,"enterKeySignalsOnChange":false},"softWrap":false,"text":"2","justify":"left","preferredSize":[40,0],"alignment":null,"helpTip":"单位毫米"}},"item-37":{"id":37,"type":"Group","parentId":30,"style":{"enabled":true,"varName":"Bisectorgroup_2","preferredSize":[0,0],"margins":0,"orientation":"row","spacing":4,"alignChildren":["left","center"],"alignment":null}},"item-38":{"id":38,"type":"StaticText","parentId":37,"style":{"enabled":true,"varName":"","creationProps":{"truncate":"none","multiline":false,"scrolling":false},"softWrap":false,"text":"间距：","justify":"left","preferredSize":[0,0],"alignment":null,"helpTip":"水平切割线之间间距"}},"item-39":{"id":39,"type":"EditText","parentId":37,"style":{"enabled":true,"varName":"spacing_1","creationProps":{"noecho":false,"readonly":false,"multiline":false,"scrollable":false,"borderless":false,"enterKeySignalsOnChange":false},"softWrap":false,"text":"6","justify":"left","preferredSize":[40,0],"alignment":null,"helpTip":"单位毫米"}},"item-41":{"id":41,"type":"Group","parentId":30,"style":{"enabled":true,"varName":"Bisectorgroup_3","preferredSize":[0,0],"margins":0,"orientation":"row","spacing":4,"alignChildren":["left","center"],"alignment":null}},"item-42":{"id":42,"type":"StaticText","parentId":41,"style":{"enabled":true,"varName":"","creationProps":{"truncate":"none","multiline":false,"scrolling":false},"softWrap":false,"text":"垂直数：","justify":"left","preferredSize":[0,0],"alignment":null,"helpTip":"切割线垂直数量"}},"item-43":{"id":43,"type":"EditText","parentId":41,"style":{"enabled":true,"varName":"verticalDirection","creationProps":{"noecho":false,"readonly":false,"multiline":false,"scrollable":false,"borderless":false,"enterKeySignalsOnChange":false},"softWrap":false,"text":"4","justify":"left","preferredSize":[40,0],"alignment":null,"helpTip":"单位毫米"}},"item-45":{"id":45,"type":"Group","parentId":30,"style":{"enabled":true,"varName":"Bisectorgroup_4","preferredSize":[0,0],"margins":0,"orientation":"row","spacing":4,"alignChildren":["left","center"],"alignment":null}},"item-46":{"id":46,"type":"StaticText","parentId":45,"style":{"enabled":true,"varName":"","creationProps":{"truncate":"none","multiline":false,"scrolling":false},"softWrap":false,"text":"间距：","justify":"left","preferredSize":[0,0],"alignment":null,"helpTip":"垂直切割线之间间距"}},"item-47":{"id":47,"type":"EditText","parentId":45,"style":{"enabled":true,"varName":"spacing_2","creationProps":{"noecho":false,"readonly":false,"multiline":false,"scrollable":false,"borderless":false,"enterKeySignalsOnChange":false},"softWrap":false,"text":"6","justify":"left","preferredSize":[40,0],"alignment":null,"helpTip":"单位毫米"}},"item-49":{"id":49,"type":"Checkbox","parentId":1,"style":{"enabled":true,"varName":"Bisector","text":"等分线","preferredSize":[0,0],"alignment":null,"helpTip":null,"checked":false}},"item-50":{"id":50,"type":"Group","parentId":27,"style":{"enabled":true,"varName":null,"preferredSize":[0,0],"margins":0,"orientation":"column","spacing":10,"alignChildren":["left","center"],"alignment":null}},"item-51":{"id":51,"type":"Panel","parentId":50,"style":{"enabled":true,"varName":"Commentpanel","creationProps":{"borderStyle":"etched","su1PanelCoordinates":false},"text":"文档备注","preferredSize":[148,0],"margins":10,"orientation":"column","spacing":10,"alignChildren":["left","top"],"alignment":null}},"item-52":{"id":52,"type":"EditText","parentId":51,"style":{"enabled":true,"varName":"Comment_text","creationProps":{"noecho":false,"readonly":false,"multiline":false,"scrollable":false,"borderless":false,"enterKeySignalsOnChange":false},"softWrap":false,"text":"","justify":"left","preferredSize":[120,0],"alignment":null,"helpTip":null}},"item-53":{"id":53,"type":"EditText","parentId":19,"style":{"enabled":true,"varName":"lineWidthInput","creationProps":{"noecho":false,"readonly":false,"multiline":false,"scrollable":false,"borderless":false,"enterKeySignalsOnChange":false},"softWrap":false,"text":"0.07","justify":"left","preferredSize":[40,0],"alignment":null,"helpTip":null}},"item-54":{"id":54,"type":"StaticText","parentId":19,"style":{"enabled":true,"varName":null,"creationProps":{"truncate":"none","multiline":false,"scrolling":false},"softWrap":false,"text":"mm","justify":"left","preferredSize":[0,0],"alignment":null,"helpTip":null}},"item-55":{"id":55,"type":"Group","parentId":1,"style":{"enabled":true,"varName":"Markgroup_3","preferredSize":[0,0],"margins":0,"orientation":"row","spacing":4,"alignChildren":["left","center"],"alignment":null}},"item-56":{"id":56,"type":"StaticText","parentId":55,"style":{"enabled":true,"varName":null,"creationProps":{"truncate":"none","multiline":false,"scrolling":false},"softWrap":false,"text":"位置：","justify":"left","preferredSize":[0,0],"alignment":null,"helpTip":"标记线宽粗细"}},"item-57":{"id":57,"type":"DropDownList","parentId":55,"style":{"enabled":true,"varName":"positionDropdown","text":"DropDownList","listItems":"外侧, -, 内侧","preferredSize":[0,0],"alignment":null,"selection":0,"helpTip":null}},"item-58":{"id":58,"type":"Checkbox","parentId":1,"style":{"enabled":true,"varName":"Grating","text":"对位线","preferredSize":[0,0],"alignment":null,"helpTip":null,"checked":false}}},"order":[0,27,50,1,9,3,6,16,11,5,8,18,19,20,53,54,55,56,57,26,23,24,25,58,49,51,52,31,2,22,15,28,29,30,33,34,35,37,38,39,41,42,43,45,46,47,14,12,13],"settings":{"importJSON":true,"indentSize":false,"cepExport":false,"includeCSSJS":true,"showDialog":true,"functionWrapper":false,"afterEffectsDockable":false,"itemReferenceList":"None"}}
*/ 

// DIALOG
// ======
var dialog = new Window("dialog"); 
    dialog.text = "云漫标记集"; 
    dialog.orientation = "column"; 
    dialog.alignChildren = ["center","center"]; 
    dialog.spacing = 10; 
    dialog.margins = 23; 

// GENERALGROUP1
// =============
var GeneralGroup1 = dialog.add("group", undefined, {name: "GeneralGroup1"}); 
    GeneralGroup1.orientation = "row"; 
    GeneralGroup1.alignChildren = ["left","top"]; 
    GeneralGroup1.spacing = 10; 
    GeneralGroup1.margins = 0; 

// GROUP1
// ======
var group1 = GeneralGroup1.add("group", undefined, {name: "group1"}); 
    group1.orientation = "column"; 
    group1.alignChildren = ["left","center"]; 
    group1.spacing = 10; 
    group1.margins = 0; 

// PANEL_1
// =======
var Panel_1 = group1.add("panel", undefined, undefined, {name: "Panel_1"}); 
    Panel_1.text = "标记参数"; 
    Panel_1.preferredSize.width = 148; 
    Panel_1.orientation = "column"; 
    Panel_1.alignChildren = ["left","center"]; 
    Panel_1.spacing = 10; 
    Panel_1.margins = 23; 
    Panel_1.alignment = ["left","center"]; 

// MARKGROUP_1
// ===========
var Markgroup_1 = Panel_1.add("group", undefined, {name: "Markgroup_1"}); 
    Markgroup_1.orientation = "row"; 
    Markgroup_1.alignChildren = ["left","center"]; 
    Markgroup_1.spacing = 4; 
    Markgroup_1.margins = 0; 

var statictext1 = Markgroup_1.add("statictext", undefined, undefined, {name: "statictext1"}); 
    statictext1.helpTip = "标记半径大小。"; 
    statictext1.text = "大小："; 

var markRadiusMMInput = Markgroup_1.add('edittext {properties: {name: "markRadiusMMInput"}}'); 
    markRadiusMMInput.helpTip = "单位毫米"; 
    markRadiusMMInput.text = "3"; 
    markRadiusMMInput.preferredSize.width = 40; 

var statictext2 = Markgroup_1.add("statictext", undefined, undefined, {name: "statictext2"}); 
    statictext2.text = "mm"; 

// MARKGROUP_2
// ===========
var Markgroup_2 = Panel_1.add("group", undefined, {name: "Markgroup_2"}); 
    Markgroup_2.orientation = "row"; 
    Markgroup_2.alignChildren = ["left","center"]; 
    Markgroup_2.spacing = 4; 
    Markgroup_2.margins = 0; 

var statictext3 = Markgroup_2.add("statictext", undefined, undefined, {name: "statictext3"}); 
    statictext3.helpTip = "标记与文档之间的出血偏移间隔。"; 
    statictext3.text = "偏移："; 

var offsetMMInput = Markgroup_2.add('edittext {properties: {name: "offsetMMInput"}}'); 
    offsetMMInput.helpTip = "单位毫米"; 
    offsetMMInput.text = "2"; 
    offsetMMInput.preferredSize.width = 40; 

var statictext4 = Markgroup_2.add("statictext", undefined, undefined, {name: "statictext4"}); 
    statictext4.text = "mm"; 

// MARKGROUP_3
// ===========
var Markgroup_3 = Panel_1.add("group", undefined, {name: "Markgroup_3"}); 
    Markgroup_3.orientation = "row"; 
    Markgroup_3.alignChildren = ["left","center"]; 
    Markgroup_3.spacing = 4; 
    Markgroup_3.margins = 0; 

var statictext5 = Markgroup_3.add("statictext", undefined, undefined, {name: "statictext5"}); 
    statictext5.helpTip = "标记线宽粗细"; 
    statictext5.text = "线宽："; 

var lineWidthInput = Markgroup_3.add('edittext {properties: {name: "lineWidthInput"}}'); 
    lineWidthInput.text = "0.07"; 
    lineWidthInput.preferredSize.width = 40; 

var statictext6 = Markgroup_3.add("statictext", undefined, undefined, {name: "statictext6"}); 
    statictext6.text = "mm"; 

// MARKGROUP_4
// ===========
var Markgroup_4 = Panel_1.add("group", undefined, {name: "Markgroup_4"}); 
    Markgroup_4.orientation = "row"; 
    Markgroup_4.alignChildren = ["left","center"]; 
    Markgroup_4.spacing = 4; 
    Markgroup_4.margins = 0; 

var statictext7 = Markgroup_4.add("statictext", undefined, undefined, {name: "statictext7"}); 
    statictext7.helpTip = "标记线宽粗细"; 
    statictext7.text = "位置："; 

var positionDropdown_array = ["外侧","-","内侧"]; 
var positionDropdown = Markgroup_4.add("dropdownlist", undefined, undefined, {name: "positionDropdown", items: positionDropdown_array}); 
    positionDropdown.selection = 0; 

// PANEL_1
// =======
var divider1 = Panel_1.add("panel", undefined, undefined, {name: "divider1"}); 
    divider1.alignment = "fill"; 

var PrintingCornerLine = Panel_1.add("checkbox", undefined, undefined, {name: "PrintingCornerLine"}); 
    PrintingCornerLine.text = "印刷角线"; 
    PrintingCornerLine.value = true; 

var hotStampingMark = Panel_1.add("checkbox", undefined, undefined, {name: "hotStampingMark"}); 
    hotStampingMark.text = "冷烫标记"; 
    hotStampingMark.value = true; 

var cuttingMark = Panel_1.add("checkbox", undefined, undefined, {name: "cuttingMark"}); 
    cuttingMark.text = "马克点"; 
    cuttingMark.value = true; 

var Grating = Panel_1.add("checkbox", undefined, undefined, {name: "Grating"}); 
    Grating.text = "对位线"; 

var Bisector = Panel_1.add("checkbox", undefined, undefined, {name: "Bisector"}); 
    Bisector.text = "等分线"; 

// COMMENTPANEL
// ============
var Commentpanel = group1.add("panel", undefined, undefined, {name: "Commentpanel"}); 
    Commentpanel.text = "文档备注"; 
    Commentpanel.preferredSize.width = 148; 
    Commentpanel.orientation = "column"; 
    Commentpanel.alignChildren = ["left","top"]; 
    Commentpanel.spacing = 10; 
    Commentpanel.margins = 10; 

var Comment_text = Commentpanel.add('edittext {properties: {name: "Comment_text"}}'); 
    Comment_text.preferredSize.width = 120; 

// GENERALGROUP1_2
// ===============
var GeneralGroup1_2 = GeneralGroup1.add("group", undefined, {name: "GeneralGroup1_2"}); 
    GeneralGroup1_2.orientation = "column"; 
    GeneralGroup1_2.alignChildren = ["left","center"]; 
    GeneralGroup1_2.spacing = 10; 
    GeneralGroup1_2.margins = 0; 

// PANEL_2
// =======
var Panel_2 = GeneralGroup1_2.add("panel", undefined, undefined, {name: "Panel_2"}); 
    Panel_2.text = "选项"; 
    Panel_2.preferredSize.width = 148; 
    Panel_2.orientation = "column"; 
    Panel_2.alignChildren = ["left","center"]; 
    Panel_2.spacing = 10; 
    Panel_2.margins = 23; 
    Panel_2.alignment = ["left","center"]; 

var AdaptiveArtboard = Panel_2.add("checkbox", undefined, undefined, {name: "AdaptiveArtboard"}); 
    AdaptiveArtboard.helpTip = "是否扩展画板到标记大小。默认扩展。"; 
    AdaptiveArtboard.text = "自适应画板"; 
    AdaptiveArtboard.value = true; 

var whiteInkLayer = Panel_2.add("checkbox", undefined, undefined, {name: "whiteInkLayer"}); 
    whiteInkLayer.helpTip = "是否添加白墨层，默认为添加。"; 
    whiteInkLayer.text = "添加白墨图层"; 

var PrintingColorSeparation = Panel_2.add("checkbox", undefined, undefined, {name: "PrintingColorSeparation"}); 
    PrintingColorSeparation.text = "添加印刷分色"; 
    PrintingColorSeparation.value = true; 

var FileInformation = Panel_2.add("checkbox", undefined, undefined, {name: "FileInformation"}); 
    FileInformation.text = "添加文档信息"; 
    FileInformation.value = true; 

// PANEL_3
// =======
var Panel_3 = GeneralGroup1_2.add("panel", undefined, undefined, {name: "Panel_3"}); 
    Panel_3.enabled = false; 
    Panel_3.text = "等分线"; 
    Panel_3.preferredSize.width = 148; 
    Panel_3.orientation = "column"; 
    Panel_3.alignChildren = ["right","top"]; 
    Panel_3.spacing = 10; 
    Panel_3.margins = 23; 

// BISECTORGROUP_1
// ===============
var Bisectorgroup_1 = Panel_3.add("group", undefined, {name: "Bisectorgroup_1"}); 
    Bisectorgroup_1.orientation = "row"; 
    Bisectorgroup_1.alignChildren = ["left","center"]; 
    Bisectorgroup_1.spacing = 4; 
    Bisectorgroup_1.margins = 0; 

var statictext8 = Bisectorgroup_1.add("statictext", undefined, undefined, {name: "statictext8"}); 
    statictext8.helpTip = "切割线水平数量"; 
    statictext8.text = "水平数："; 

var horizontalDirection = Bisectorgroup_1.add('edittext {properties: {name: "horizontalDirection"}}'); 
    horizontalDirection.helpTip = "单位毫米"; 
    horizontalDirection.text = "2"; 
    horizontalDirection.preferredSize.width = 40; 

// BISECTORGROUP_2
// ===============
var Bisectorgroup_2 = Panel_3.add("group", undefined, {name: "Bisectorgroup_2"}); 
    Bisectorgroup_2.orientation = "row"; 
    Bisectorgroup_2.alignChildren = ["left","center"]; 
    Bisectorgroup_2.spacing = 4; 
    Bisectorgroup_2.margins = 0; 

var statictext9 = Bisectorgroup_2.add("statictext", undefined, undefined, {name: "statictext9"}); 
    statictext9.helpTip = "水平切割线之间间距"; 
    statictext9.text = "间距："; 

var spacing_1 = Bisectorgroup_2.add('edittext {properties: {name: "spacing_1"}}'); 
    spacing_1.helpTip = "单位毫米"; 
    spacing_1.text = "6"; 
    spacing_1.preferredSize.width = 40; 

// BISECTORGROUP_3
// ===============
var Bisectorgroup_3 = Panel_3.add("group", undefined, {name: "Bisectorgroup_3"}); 
    Bisectorgroup_3.orientation = "row"; 
    Bisectorgroup_3.alignChildren = ["left","center"]; 
    Bisectorgroup_3.spacing = 4; 
    Bisectorgroup_3.margins = 0; 

var statictext10 = Bisectorgroup_3.add("statictext", undefined, undefined, {name: "statictext10"}); 
    statictext10.helpTip = "切割线垂直数量"; 
    statictext10.text = "垂直数："; 

var verticalDirection = Bisectorgroup_3.add('edittext {properties: {name: "verticalDirection"}}'); 
    verticalDirection.helpTip = "单位毫米"; 
    verticalDirection.text = "4"; 
    verticalDirection.preferredSize.width = 40; 

// BISECTORGROUP_4
// ===============
var Bisectorgroup_4 = Panel_3.add("group", undefined, {name: "Bisectorgroup_4"}); 
    Bisectorgroup_4.orientation = "row"; 
    Bisectorgroup_4.alignChildren = ["left","center"]; 
    Bisectorgroup_4.spacing = 4; 
    Bisectorgroup_4.margins = 0; 

var statictext11 = Bisectorgroup_4.add("statictext", undefined, undefined, {name: "statictext11"}); 
    statictext11.helpTip = "垂直切割线之间间距"; 
    statictext11.text = "间距："; 

var spacing_2 = Bisectorgroup_4.add('edittext {properties: {name: "spacing_2"}}'); 
    spacing_2.helpTip = "单位毫米"; 
    spacing_2.text = "6"; 
    spacing_2.preferredSize.width = 40; 

// BUTTONGROUP1
// ============
var buttongroup1 = dialog.add("group", undefined, {name: "buttongroup1"}); 
    buttongroup1.orientation = "row"; 
    buttongroup1.alignChildren = ["left","center"]; 
    buttongroup1.spacing = 25; 
    buttongroup1.margins = 0; 

var ok = buttongroup1.add("button", undefined, undefined, {name: "ok"}); 
    ok.text = "确定"; 

var cancel = buttongroup1.add("button", undefined, undefined, {name: "cancel"}); 
    cancel.text = "取消"; 

dialog.show();

