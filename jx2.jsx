// 检查当前是否打开了文档，如果没有，则创建一个新文档
if (app.documents.length == 0) {
    // 使用 alert 函数弹出一个提示框，标题为 "错误"，内容为 "请先建立一个新文件"
    alert("请先建立一个新文件", "错误");
    // 创建一个新文档
    var myDoc = app.documents.add();
}

// 定义对话框的结构和内容，使用 JSON 格式的字符串
luRes = "dialog {alignChildren: 'fill', text: '裁切标记',margins:[8,8,8,8]\n" +
    "all: Group { orientation: 'row',alignChildren: 'fill', \n" +
    "    myType: Panel {text:'类型',alignChildren: 'right',orientation: 'column',properties:{borderStyle:'sunken'},\n" +
    "                  lineType: Group { orientation: 'row',  spacing:1,\n" +
    "                               st: StaticText { text:'角线:' }, \n" +
    "                             ddl: DropDownList {preferredSize: [50, 20] ,properties:{items:['日式', '罗马','中式']}},\n" +
    "                                          } \n" +
    "                crossType: Group { orientation: 'row',  spacing:1,\n" +
    "                              cb: Checkbox { text:'套准', value: true}, \n" +
    "                             ddl: DropDownList {preferredSize: [50, 20],properties:{items:['带圆', '无圆']}},\n" +
    "                                          } \n" +
    "                          } \n" +
    "    mySize: Panel {text:'角线设置',alignChildren: 'fill',orientation: 'column',properties:{borderStyle:'sunken'},\n" +
    "                        lineLen: Group { orientation: 'row',  \n" +
    "                                    s: StaticText { text:'长度:' }, \n" +
    "                                    e: EditText {text: 6 , preferredSize: [36, 20],active:true}, \n" +
    "                                    s: StaticText { text:'毫米' }, \n" +
    "                                              } \n" +
    "                    lineBleed: Group { orientation: 'row', \n" +
    "                                    s: StaticText { text:'出血:' }, \n" +
    "                                    e: EditText { text:3, preferredSize: [36, 20] },\n" +
    "                                    s: StaticText { text:'毫米' }, \n" +
    "                                             } \n" +
    "                  lineStroke: Group { orientation: 'row', \n" +
    "                                    s: StaticText { text:'描边:' }, \n" +
    "                                    e: EditText { text:0.25, preferredSize: [36, 20] },\n" +
    "                                    s: StaticText { text:'点' }, \n" +
    "                                             } \n" +
    "                         }  \n" +
    "           } \n" +
    "all2: Group { orientation: 'row',alignChildren: 'fill',\n" +
    "        checkboxes: Panel { text:'选项', orientation:'column', alignChildren:'left' ,properties:{borderStyle:'black'},\n" +
    "                 cb1: Checkbox { text:'添加角线图层', value: true}, \n" +
    "                 cb2: Checkbox { text:'添加色标名称', value: true}, \n" +
    "                 cb3: Checkbox { text:'添加文档信息' , value: true}, \n" +
    "                 cb6: Checkbox { text:'包含对象边宽' }, \n" +
    "                 cb4: Checkbox { text:'添加色条框',  value: true}, \n" +
    "                 cb5: Checkbox { text:'色条框线',alignment: 'center',  value: true}, \n" +
    "                }\n" +
    "    myBisector: Panel { text:'等分线',alignChildren: 'left',orientation: 'column',properties:{borderStyle:'sunken'},\n" +
    "                               cb: Checkbox {text:'使用', value: true}\n" +
    "            myUse: Group { orientation: 'column',alignChildren: 'fill',\n" +
    "                        myHor: Group { orientation: 'row', \n" +
    "                                    s: StaticText { text:'水平数:' }, \n" +
    "                                    e: EditText { text:2, preferredSize: [55, 20]},  } \n" +
    "                      myHor2: Group { orientation: 'row', \n" +
    "                                    s3: StaticText { text:'切线距:' }, \n" +
    "                                    e2: EditText { text:6, preferredSize: [25, 20]},\n" +
    "                                    s4: StaticText { text:'毫米' }, \n" +
    "                                           } \n" +
    "                        myVer: Group { orientation: 'row', \n" +
    "                                    s: StaticText {text:'垂直数:' }, \n" +
    "                                    e: EditText { text:4, preferredSize: [55, 20] },  } \n" +
    "                     myVer2: Group { orientation: 'row',  \n" +
    "                                    s3: StaticText { text:'切线距:' }, \n" +
    "                                    e2: EditText { text:6, preferredSize: [25, 20]},\n" +
    "                                    s4: StaticText { text:'毫米' }, \n" +
    "                                            } \n" +
    "                                  }\n" +
    "                            }\n" +
    "              }\n" +
    "buttonGroups: Group { orientation: 'row', alignment: 'center', \n" +
    "cancelBtn: Button { text:'取消',properties:{name:'cancel'}}, \n" +
    "okBtn: Button { text:'确定',properties:{name:'ok'}}, \n" +
    "        }\n" +
    "}";

// 创建对话框窗口
var win = new Window(luRes);

// 设置默认选项
win.all.myType.lineType.ddl.selection = win.all.myType.lineType.ddl.items[0]; // 默认角线类型为 "日式"
win.all.myType.crossType.ddl.selection = win.all.myType.crossType.ddl.items[0]; // 默认套准类型为 "带圆"
selLine = win.all.myType.lineType.ddl.items[0]; // 存储 "日式" 角线类型
selLine1 = win.all.myType.lineType.ddl.items[1]; // 存储 "罗马" 角线类型
selellipse = win.all.myType.crossType.ddl.items[0]; // 存储 "带圆" 套准类型

// 当 "套准" 复选框状态改变时，启用或禁用套准类型下拉列表
win.all.myType.crossType.cb.onClick = function() {
    win.all.myType.crossType.ddl.enabled = this.value;
};

// 当 "使用" 等分线复选框状态改变时，启用或禁用等分线设置
win.all2.myBisector.cb.onClick = function() {
    win.all2.myBisector.myUse.enabled = this.value;
};

// 如果 "使用" 等分线复选框默认选中，则触发其 onClick 事件
if (win.all2.myBisector.cb.value == true) {
    win.all2.myBisector.cb.notify();
}

// 当 "添加色条框" 复选框状态改变时，启用或禁用 "色条框线" 复选框
win.all2.checkboxes.cb4.onClick = function() {
    win.all2.checkboxes.cb5.enabled = this.value;
};

// 将对话框窗口居中显示
win.center();

// 显示对话框并获取用户选择结果
myReturn = win.show();

// 如果用户点击了 "确定" 按钮
if (myReturn == true) {
    // 获取当前活动文档
    var docRef = app.activeDocument;

    // 定义一些常量和变量
    var pointTomm = 2.83464566929134; // 点转换为毫米的比例
    var pw = 0; // 页面宽度
    var ph = 0; // 页面高度
    var x = 0; // x 坐标
    var y = 0; // y 坐标
    var aiver = app.version; // 获取 Illustrator 版本号
    var fileNameLocation = 0;
    var pageNumberLocation = 0;
    // 定义 CMYK 颜色数组
    var mCMYK = [setCMYKcolor(100, 0, 0, 0), setCMYKcolor(0, 100, 0, 0), setCMYKcolor(0, 0, 100, 0), setCMYKcolor(0, 0, 0, 100)];
    mCMYK.push(setCMYKcolor(100, 100, 0, 0), setCMYKcolor(100, 0, 100, 0), setCMYKcolor(0, 100, 100, 0), setCMYKcolor(0, 0, 0, 50));
    
    // 定义其他变量
    var colorBarSize = 5 * pointTomm; // 色标大小
    var regRoundSize = 3.6 * pointTomm; // 套准标记圆形大小
    var myFont = textFonts.getByName("MicrosoftYaHei"); // 文本字体
    var myFontSize = 9; // 文本字号

    // 从对话框获取用户输入的值
    var lineLen = eval(win.all.mySize.lineLen.e.text) * pointTomm; // 角线长度
    var lineBleed = eval(win.all.mySize.lineBleed.e.text) * pointTomm; // 出血量
    var hBisector = eval(win.all2.myBisector.myUse.myHor.e.text); // 水平等分线数量
    var vBisector = eval(win.all2.myBisector.myUse.myVer.e.text); // 垂直等分线数量
    var hBSpace = eval(win.all2.myBisector.myUse.myHor2.e2.text) * pointTomm; // 水平等分线间距
    var vBSpace = eval(win.all2.myBisector.myUse.myVer2.e2.text) * pointTomm; // 垂直等分线间距
    var SW = eval(win.all.mySize.lineStroke.e.text); // 描边粗细

    // 设置其他参数
    placeCropline = true; // 是否添加角线
    creatCropMarkLayer = win.all2.checkboxes.cb1.value; // 是否创建角线图层
    placeBisector = win.all2.myBisector.cb.value; // 是否添加等分线
    placeColorName = win.all2.checkboxes.cb2.value; // 是否添加颜色名称
    placeFileDateName = placePageSize = win.all2.checkboxes.cb3.value; // 是否添加文档信息
    placeRegMark = win.all.myType.crossType.cb.value; // 是否添加套准标记
    placeColorBar = win.all2.checkboxes.cb4.value; // 是否添加色标
    colorBarStroked = win.all2.checkboxes.cb5.value; // 是否为色标添加描边

    // 检查用户输入的角线长度和出血量是否有效
    if (lineLen <= 0 || lineBleed <= 0 || isNaN(lineLen) == true || isNaN(lineBleed) == true) {
        // 如果无效，则弹出提示框，并将角线长度和出血量设置为默认值
        alert("输入的数值必须大于零！已自动更正为 长度:6mm 出血:3mm。", "错误");
        lineLen = 6 * pointTomm;
        lineBleed = 3 * pointTomm;
    }

    // 如果需要创建角线图层，则创建一个名为 "角线图层" 的新图层
    if (creatCropMarkLayer == true) {
        docRef.layers.add();
        docRef.layers[0].name = "角线图层";
    }

    // 如果有选中的对象
    if (docRef.selection.length > 0) {
        var sl = true;
        var obj = docRef.selection; // 获取选中对象
        var selVB = getBounds(obj); // 获取选中对象的边界框
        var docName = "文件名: " + docRef.name; // 获取文档名
        pw = selVB[2] - selVB[0]; // 计算页面宽度
        ph = selVB[1] - selVB[3]; // 计算页面高度
        x = selVB[0]; // 获取 x 坐标
        y = selVB[3]; // 获取 y 坐标
        // 取消选中所有对象
        for (var i = 0; i < obj.length; i += 1) {
            obj[i].selected = false;
        }
        // 执行 setOpt 函数
        setOpt();
    // 如果 Illustrator 版本号大于等于 14 (CS4 及以上版本)
    } else if (aiver.slice(0, 2) >= 14) {
        var ab = docRef.artboards.length - 1; // 获取画板数量
        // 如果画板数量大于等于 49，则弹出提示框
        if (ab >= 49) {
            alert("注意:页面数量超过 50 时需要较多的内存与较长的运行时间，请耐心等候。\n当出现 \"PARM\"错误时，请关掉一些不用的软件以释放可用内存！", "提示");
        }
        // 遍历所有画板
        for (var j = 0; j <= ab; j += 1) {
            docRef.artboards.setActiveArtboardIndex(j); // 设置当前活动画板
            var artboardnumber = docRef.artboards.getActiveArtboardIndex() + 1; // 获取当前画板序号
            var docName = "文件名: " + docRef.name + "  页码: " + docRef.artboards.length + "-" + artboardnumber; // 获取文档名和页码
            pw = docRef.width; // 获取页面宽度
            ph = docRef.height; // 获取页面高度
            x = docRef.cropBox[0]; // 获取 x 坐标
            y = docRef.cropBox[1] - ph; // 获取 y 坐标
            // 执行 setOpt 函数
            setOpt();
        }
    // 如果没有选中对象，且 Illustrator 版本号小于 14
    } else {
        pw = docRef.width; // 获取页面宽度
        ph = docRef.height; // 获取页面高度
        var docName = "文件名: " + docRef.name; // 获取文档名
        // 执行 setOpt 函数
        setOpt();
    }
}

// 定义 setOpt 函数
function setOpt() {
    // 创建图形组
    regGroup = docRef.groupItems.add();
    textGroup = docRef.groupItems.add();
    colorBarGroup = docRef.groupItems.add();
    // 执行其他函数
    cropmark(); // 添加角线
    if (placeColorName == true) {
        colorname(); // 添加颜色名称
    }
    if (placeColorBar == true) {
        colorBar(); // 添加色标
        colorbar2(); // 添加色标
    }
    if (placeBisector == true) {
        Bisector(); // 添加等分线
    }
    if (placeFileDateName == true) {
        filenameDate(); // 添加文件名和日期
    }
    if (placeRegMark == true) {
        Regmark(); // 添加套准标记
    }
    if (placePageSize == true) {
        pagesize(); // 添加页面尺寸
    }
}

// 定义 setCMYKcolor 函数，用于创建 CMYK 颜色
function setCMYKcolor(c, m, y, k) {
    var newCMYKcolor = new CMYKColor();
    newCMYKcolor.cyan = c;
    newCMYKcolor.magenta = m;
    newCMYKcolor.yellow = y;
    newCMYKcolor.black = k;
    return newCMYKcolor;
}

// 定义 filenameDate 函数，用于添加文件名和日期文本
function filenameDate() {
    // 获取当前日期和时间
    var today = new Date();
    var week = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
    var thisDate = today.getFullYear() + "年" + today.getMonth() + 1 + "月" + today.getDate() + "日" + " " + week[today.getDay()];
    // 创建文本内容
    var textString = "文件名: " + docName + "  " + thisDate;
    // 创建文本框
    var textRef = textGroup.textFrames.add();
    textRef.contents = docName + "  " + thisDate;
    // 设置文本属性
    textRef.textRange.characterAttributes.size = myFontSize;
    textRef.textRange.characterAttributes.textFont = myFont;
    textRef.textRange.characterAttributes.fillColor = docRef.swatches[1].color;
    // 设置文本框位置
    textRef.top = (y - 2) - lineBleed;
    textRef.left = ((pw - textRef.width) - lineBleed) + x;
}

// 定义 colorname 函数，用于添加颜色名称文本
function colorname() {
    // 创建文本框
    var textRef = textGroup.textFrames.add();
    textRef.contents = "青色(C) 洋红(M) 黄色(Y) 黑色(K)";
    // 设置文本属性
    textRef.textRange.characterAttributes.size = myFontSize;
    textRef.textRange.characterAttributes.textFont = myFont;
    // 设置文本框位置
    textRef.top = (y - 2) - lineBleed;
    textRef.left = x + lineBleed;
    // 设置每个字符的颜色
    for (var i = 0; i <= 5; i += 1) {
        textRef.textRange.characters[i].characterAttributes.fillColor = mCMYK[0];
    }
    for (var i = 6; i <= 11; i += 1) {
        textRef.textRange.characters[i].characterAttributes.fillColor = mCMYK[1];
    }
    for (var i = 12; i <= 17; i += 1) {
        textRef.textRange.characters[i].characterAttributes.fillColor = mCMYK[2];
    }
    for (var i = 18; i <= 22; i += 1) {
        textRef.textRange.characters[i].characterAttributes.fillColor = mCMYK[3];
    }
}

// 定义 pagesize 函数，用于添加页面尺寸文本
function pagesize() {
    var sizeUnit = "MM";
    var sizeX = pw;
    var sizeY = ph;
    // 根据文档单位设置尺寸单位和值
    switch (docRef.rulerUnits) {
        case RulerUnits.Centimeters:
            sizeUnit = " 厘米";
            sizeX = Math.round(((pw / pointTomm) / 10) * 100) / 100;
            sizeY = Math.round(((ph / pointTomm) / 10) * 100) / 100;
            break;
        case RulerUnits.Inches:
            sizeUnit = " 英吋";
            sizeX = Math.round((pw / 72) * 100) / 100;
            sizeY = Math.round((ph / 72) * 100) / 100;
            break;
        case RulerUnits.Millimeters:
            sizeUnit = " 毫米";
            sizeX = Math.round(((pw / pointTomm) + 0.001) * 100) / 100;
            sizeY = Math.round(((ph / pointTomm) + 0.001) * 100) / 100;
            break;
        case RulerUnits.Points:
            sizeUnit = " 点";
            sizeX = Math.round(pw * 100) / 100;
            sizeY = Math.round(ph * 100) / 100;
            break;
        case RulerUnits.Pixels:
            sizeUnit = " 像素";
            sizeX = Math.round(pw * 100) / 100;
            sizeY = Math.round(ph * 100) / 100;
            break;
        case RulerUnits.Qs:
            sizeUnit = " Ha";
            sizeX = Math.round(pw * 141.111) / 100;
            sizeY = Math.round(ph * 141.111) / 100;
            break;
        default:

    }
    // 创建文本框
    var textPageSize = textGroup.textFrames.add();
    textPageSize.contents = "尺寸: " + sizeX + "X" + sizeY + sizeUnit;
    // 设置文本属性
    textPageSize.textRange.characterAttributes.size = myFontSize;
    textPageSize.textRange.characterAttributes.textFont = myFont;
    textPageSize.textRange.characterAttributes.fillColor = docRef.swatches[1].color;
    // 设置文本框位置
    textPageSize.position = [((x + pw) - lineBleed) - textPageSize.width, y + ph + textPageSize.height + lineBleed];
}

// 定义 cropmark 函数，用于添加角线
function cropmark() {
    var line = new Array(4); // 创建线条数组
    var lineGroup = docRef.groupItems.add(); // 创建图形组
    var lineGroup = regGroup.groupItems.add(); // 创建图形组
    // 创建四条线
    for (var i = 0; i < 4; i += 1) {
        line[i] = lineGroup.pathItems.add(); // 创建路径
        line[i].filled = false; // 设置不填充
        line[i].stroked = true; // 设置描边
        line[i].strokeWidth = SW; // 设置描边粗细
        line[i].strokeColor = docRef.swatches[1].color; // 设置描边颜色
    }
    // 根据角线类型设置线条路径
    if (win.all.myType.lineType.ddl.selection == selLine) {
        line[0].setEntirePath([
            [0, lineLen + lineBleed],
            [lineLen, lineLen + lineBleed],
            [lineLen, 0]
        ]);
        line[1].setEntirePath([
            [0, lineLen],
            [lineLen + lineBleed, lineLen],
            [lineLen + lineBleed, 0]
        ]);
    } else if (win.all.myType.lineType.ddl.selection == selLine1) {
        line[0].setEntirePath([
            [0, lineLen + lineBleed],
            [lineLen, lineLen + lineBleed]
        ]);
        line[1].setEntirePath([
            [lineLen + lineBleed, lineLen],
            [lineLen + lineBleed, 0]
        ]);
    } else {
        line[0].setEntirePath([
            [0, lineLen + lineBleed],
            [lineLen, lineLen + lineBleed]
        ]);
        line[1].setEntirePath([
            [0, lineLen],
            [lineLen + (lineBleed / 2), lineLen]
        ]);
        line[2].setEntirePath([
            [lineLen + lineBleed, lineLen],
            [lineLen + lineBleed, 0]
        ]);
        line[3].setEntirePath([
            [lineLen, lineLen + (lineBleed / 2)],
            [lineLen, 0]
        ]);
    }
    // 设置图形组位置
    lineGroup.position = [-lineGroup.width + x, y];
    // 复制图形组并设置位置和旋转角度
    lineGroup2 = lineGroup.duplicate();
    lineGroup2.rotate(90);
    lineGroup2.left = lineGroup2.left + lineGroup2.width + pw;
    lineGroup3 = lineGroup.duplicate();
    lineGroup3.rotate(270);
    lineGroup3.top = lineGroup3.top + lineGroup3.height + ph;
    lineGroup4 = lineGroup2.duplicate();
    lineGroup4.rotate(90);
    lineGroup4.top = lineGroup4.top + lineGroup4.height + ph;
}

// 定义 Regmark 函数，用于添加套准标记
function Regmark() {
    var line = new Array(2); // 创建线条数组
    var lineGroup = docRef.groupItems.add(); // 创建图形组
    var lineGroup = regGroup.groupItems.add(); // 创建图形组
    // 如果套准类型为 "带圆"，则创建一个圆形
    if (win.all.myType.crossType.ddl.selection == selellipse) {
        ellipse = lineGroup.pathItems.ellipse((regRoundSize / 2) + y, (-regRoundSize / 2) + x, regRoundSize, regRoundSize, false, true);
        with (ellipse) {
            filled = false; // 设置不填充
            stroked = true; // 设置描边
            strokeWidth = SW; // 设置描边粗细
            strokeColor = docRef.swatches[1].color; // 设置描边颜色
        }
    }
    // 创建两条线
    for (var i = 0; i < 2; i += 1) {
        line[i] = lineGroup.pathItems.add(); // 创建路径
        line[i].filled = false; // 设置不填充
        line[i].stroked = true; // 设置描边
        line[i].strokeWidth = SW; // 设置描边粗细
        line[i].strokeColor = docRef.swatches[1].color; // 设置描边颜色
    }
    // 设置线条路径
    line[0].setEntirePath([
        [(-lineLen / 2) + x, y],
        [(lineLen / 2) + x, y]
    ]);
    line[1].setEntirePath([
        [x, -(lineLen + lineBleed) + y],
        [x, lineLen + lineBleed + y]
    ]);
    // 设置图形组位置
    lineGroup.position = [(-lineGroup.width - lineBleed) + x, ((ph + lineGroup.height) / 2) + y];
    // 复制图形组并设置位置
    lineGroup.duplicate().position = [pw + lineBleed + x, ((ph + lineGroup.height) / 2) + y];
    lineGroup.duplicate();
    lineGroup.rotate(90);
    lineGroup.position = [((pw - lineGroup.width) / 2) + x, -lineBleed + y];
    lineGroup.duplicate().position = [((pw - lineGroup.width) / 2) + x, ph + lineGroup.height + lineBleed + y];
}

// 定义 colorBar 函数，用于添加色标
function colorBar() {
    // 创建 11 个色块
    for (var i = 0; i <= 10; i += 1) {
        // 创建矩形
        var rectangle = colorBarGroup.pathItems.rectangle(y + (i * colorBarSize) + colorBarSize + lineBleed, (-colorBarSize - lineBleed) + x, colorBarSize, colorBarSize);
        rectangle.fillColor = setCMYKcolor(10 * i, 0, 0, 0); // 设置填充颜色
        rectangle.stroked = false; // 设置不描边
        // 如果需要为色标添加描边
        if (colorBarStroked == true) {
            rectangle.strokeColor = mCMYK[0]; // 设置描边颜色
            rectangle.strokeWidth = SW; // 设置描边粗细
        }
        // 创建矩形
        var rectangle = colorBarGroup.pathItems.rectangle((((y + (i * colorBarSize)) - (10 * colorBarSize)) - lineBleed) + ph, (-colorBarSize - lineBleed) + x, colorBarSize, colorBarSize);
        rectangle.fillColor = setCMYKcolor(0, 10 * i, 0, 0); // 设置填充颜色
        rectangle.stroked = false; // 设置不描边
        // 如果需要为色标添加描边
        if (colorBarStroked == true) {
            rectangle.strokeColor = mCMYK[1]; // 设置描边颜色
            rectangle.strokeWidth = SW; // 设置描边粗细
        }
        // 创建矩形
        var rectangle = colorBarGroup.pathItems.rectangle((((y + (i * colorBarSize)) - (10 * colorBarSize)) - lineBleed) + ph, lineBleed + x + pw, colorBarSize, colorBarSize);
        rectangle.fillColor = setCMYKcolor(0, 0, 10 * i, 0); // 设置填充颜色
        rectangle.stroked = false; // 设置不描边
        // 如果需要为色标添加描边
        if (colorBarStroked == true) {
            rectangle.strokeColor = mCMYK[2]; // 设置描边颜色
            rectangle.strokeWidth = SW; // 设置描边粗细
        }
        // 创建矩形
        var rectangle = colorBarGroup.pathItems.rectangle(y + (i * colorBarSize) + colorBarSize + lineBleed, lineBleed + x + pw, colorBarSize, colorBarSize);
        rectangle.fillColor = setCMYKcolor(0, 0, 0, 10 * i); // 设置填充颜色
        rectangle.stroked = false; // 设置不描边
        // 如果需要为色标添加描边
        if (colorBarStroked == true) {
            rectangle.strokeColor = mCMYK[3]; // 设置描边颜色
            rectangle.strokeWidth = SW; // 设置描边粗细
        }
    }
}

// 定义 colorbar2 函数，用于添加色标
function colorbar2() {
    // 创建 8 个色块
    for (var j = 0; j <= 7; j += 1) {
        // 创建矩形
        var myRectangle = colorBarGroup.pathItems.rectangle(y + ph + colorBarSize + lineBleed, lineBleed + x + (j * colorBarSize), colorBarSize, colorBarSize);
        myRectangle.fillColor = mCMYK[j]; // 设置填充颜色
        myRectangle.stroked = false; // 设置不描边
        // 如果需要为色标添加描边
        if (colorBarStroked == true) {
            myRectangle.strokeColor = docRef.swatches[1].color; // 设置描边颜色
            myRectangle.strokeWidth = SW; // 设置描边粗细
        }
    }
}

// 定义 Bisector 函数，用于添加等分线
function Bisector() {
    var lineGroup = docRef.groupItems.add(); // 创建图形组
    var lineGroup = regGroup.groupItems.add(); // 创建图形组
    // 如果垂直等分线间距为 0
    if (vBSpace == 0) {
        // 创建垂直等分线
        for (var vML = 1; vML < vBisector; vML += 1) {
            var vEquidistant = ph / vBisector; // 计算等分线间距
            var myLine1 = lineGroup.pathItems.add(); // 创建路径
            myLine1.setEntirePath([
                [(x - lineLen) - lineBleed, y + (vML * vEquidistant)],
                [x - lineBleed, y + (vML * vEquidistant)]
            ]);
            myLine1.filled = false; // 设置不填充
            myLine1.stroked = true; // 设置描边
            myLine1.strokeWidth = SW; // 设置描边粗细
            myLine1.strokeColor = docRef.swatches[1].color; // 设置描边颜色
            myLine1.duplicate().left = x + pw + lineBleed; // 复制线条并设置位置
        }
    // 如果垂直等分线间距不为 0
    } else {
        // 创建垂直等分线
        for (var vML = 1; vML < vBisector; vML += 1) {
            var vEquidistant = (ph + vBSpace) / vBisector; // 计算等分线间距
            var myLine1 = lineGroup.pathItems.add(); // 创建路径
            myLine1.setEntirePath([
                [(x - lineLen) - lineBleed, y + (vML * vEquidistant)],
                [x - lineBleed, y + (vML * vEquidistant)]
            ]);
            myLine1.filled = false; // 设置不填充
            myLine1.stroked = true; // 设置描边
            myLine1.strokeWidth = SW; // 设置描边粗细
            myLine1.strokeColor = docRef.swatches[1].color; // 设置描边颜色
            var myLine2 = myLine1.duplicate(); // 复制线条
            myLine2.position = [(x - lineLen) - lineBleed, (y - vBSpace) + (vML * vEquidistant)]; // 设置线条位置
            myLine1.duplicate().left = x + pw + lineBleed; // 复制线条并设置位置
            myLine2.duplicate().left = x + pw + lineBleed; // 复制线条并设置位置
        }
    }
    // 如果水平等分线间距为 0
    if (hBSpace == 0) {
       for (var hML = 1; hML < hBisector; hML += 1) {
            var hEquidistant = pw / hBisector; // 计算等分线间距
            var myLine3 = lineGroup.pathItems.add(); // 创建路径
            myLine3.setEntirePath([
                [x + (hML * hEquidistant), y - (1.5 * lineLen)],
                [x + (hML * hEquidistant), y - (0.5 * lineLen)]
            ]);
            myLine3.filled = false; // 设置不填充
            myLine3.stroked = true; // 设置描边
            myLine3.strokeWidth = SW; // 设置描边粗细
            myLine3.strokeColor = docRef.swatches[1].color; // 设置描边颜色
            myLine3.duplicate().top = y + ph + lineBleed + lineLen; // 复制线条并设置位置
        }    // 如果水平等分线间距不为 0
    } else {
        // 创建水平等分线
        for (var hML = 1; hML < hBisector; hML += 1) {
            var hEquidistant = (pw + hBSpace) / hBisector; // 计算等分线间距
            var myLine3 = lineGroup.pathItems.add(); // 创建路径
            myLine3.setEntirePath([
                [(x + (hML * hEquidistant)) - hBSpace, y - (1.5 * lineLen)],
                [(x + (hML * hEquidistant)) - hBSpace, y - (0.5 * lineLen)]
            ]);
            myLine3.filled = false; // 设置不填充
            myLine3.stroked = true; // 设置描边
            myLine3.strokeWidth = SW; // 设置描边粗细
            myLine3.strokeColor = docRef.swatches[1].color; // 设置描边颜色
            var myLine4 = myLine3.duplicate(); // 复制线条
            myLine4.position = [x + (hML * hEquidistant), y - (0.5 * lineLen)]; // 设置线条位置
            myLine3.duplicate().top = y + ph + lineBleed + lineLen; // 复制线条并设置位置
            myLine4.duplicate().top = y + ph + lineBleed + lineLen; // 复制线条并设置位置
        }
    }
}

// 定义 getBounds 函数，用于获取对象的边界框
function getBounds(obj) {
    var selObj1 = new Array();
    var selObj2 = new Array();
    var vgb1 = new Array();
    var vgb2 = new Array();
    var n = obj.length; // 获取对象数量
    // 如果对象数量大于 0
    if (n > 0) {
        // 如果第一个对象是剪切组
        if (obj[0].typename == "GroupItem" && obj[0].clipped && obj[0].pageItems.length > 1) {
            // 获取剪切路径的边界框
            clipObj = obj[0].pathItems[0].geometricBounds;
            vgb1 = clipObj;
        } else {
            selObj1 = obj[0];
            // 如果需要包含对象边宽
            if (win.all2.checkboxes.cb6.value) {
                vgb1 = selObj1.visibleBounds; // 获取对象的可见边界框
            } else {
                vgb1 = selObj1.geometricBounds; // 获取对象的几何边界框
            }
        }
        // 如果对象数量大于 1
        if (n > 1) {
            // 遍历所有对象
            for (var i = 1; i < n; i += 1) {
                selObj2 = obj[i];
                // 如果当前对象是剪切组
                if (obj[i].typename == "GroupItem" && obj[i].clipped && obj[i].pageItems.length > 1) {
                    // 如果需要包含对象边宽
                    if (win.all2.checkboxes.cb6.value) {
                        vgb2 = obj[i].pathItems[0].visibleBounds; // 获取剪切路径的可见边界框
                    } else {
                        vgb2 = obj[i].pathItems[0].geometricBounds; // 获取剪切路径的几何边界框
                    }
                } else {
                    // 如果需要包含对象边宽
                    if (win.all2.checkboxes.cb6.value) {
                        vgb2 = selObj2.visibleBounds; // 获取对象的可见边界框
                    } else {
                        vgb2 = selObj2.geometricBounds; // 获取对象的几何边界框
                    }
                }
                // 计算所有对象的最小边界框
                if (vgb1[0] > vgb2[0]) {
                    vgb1[0] = vgb2[0];
                }
                if (vgb1[1] < vgb2[1]) {
                    vgb1[1] = vgb2[1];
                }
                if (vgb1[2] < vgb2[2]) {
                    vgb1[2] = vgb2[2];
                }
                if (vgb1[3] > vgb2[3]) {
                    vgb1[3] = vgb2[3];
                }
            }
        }
    }
    return vgb1; // 返回最小边界框
}