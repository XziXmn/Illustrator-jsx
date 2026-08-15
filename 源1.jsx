// 弹出窗口，获取用户输入的表格数据
var input = prompt("请输入条码编号和数量，用逗号分隔，每行一个条码信息，例如：\n1234567890123,3\n9876543210987,2", "");

// 解析用户输入的表格数据
var data = input.split("\n");
var codes = [];
for (var i = 0; i < data.length; i++) {
  var parts = data[i].split(",");
  // 检查是否为有效行
  if (parts.length === 2) {
    var code = parts[0].trim();
    var count = parseInt(parts[1].trim());
    for (var j = 0; j < count; j++) {
      codes.push(code);
    }
  }
}

// 获取文档中所有文本框
var doc = app.activeDocument;

var textFrames = doc.textFrames;

// 替换文本框内容
var codeIndex = 0;
for (var i = 0; i < textFrames.length; i++) {
  var textFrame = textFrames[i];
  if (textFrame.contents === "EAN code:") {
    if (codeIndex < codes.length) {
      textFrame.contents = "EAN code: " + codes[codeIndex];
      codeIndex++;
    } else {
      alert("条码数量不足，部分文本框未被替换！");
      break;
    }
  }
}

alert("替换完成！");