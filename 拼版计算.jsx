// Illustrator JSX 脚本，用于文件分配和印刷张数计算 (无GUI)

// 文件数量数组
var fileQuantities = [80,40,40,52];  // 示例数据，可根据实际情况修改

// 网格方向：0 - 水平，1 - 垂直
var gridOrientation = 0;

// 网格宽度（列数）
var gridWidth = 6;

// 网格高度（行数）
var gridHeight = 10;

// 计算文件总数量
var totalQuantity = fileQuantities.reduce((sum, current) => sum + current, 0);

// 计算网格分配的函数
function calculateGridDistribution(fileQuantity, totalGrids) {
  var ratio = fileQuantity / totalQuantity;  // 计算文件数量占总数量的比例
  return Math.round(ratio * totalGrids);    // 根据比例计算应分配的网格数量
}

// 计算每个文件的网格分配
var gridDistribution = [];
for (var i = 0; i < fileQuantities.length; i++) {
  gridDistribution.push(
    calculateGridDistribution(fileQuantities[i], gridWidth)
  );
}

// 计算使用的总网格列数
var totalGridColumns = 0;
for (var i = 0; i < gridDistribution.length; i++) {
  totalGridColumns += gridDistribution[i];
}

// 计算每个文件的印张数
var printSheets = [];
for (var i = 0; i < fileQuantities.length; i++) {
  var gridCells = gridDistribution[i] * gridHeight;  // 计算每个文件占用的网格单元数
  var sheets = Math.ceil(fileQuantities[i] / gridCells);  // 计算印张数
  printSheets.push(sheets);
}

// 如果总列数超过网格宽度，则调整网格分配
if (totalGridColumns > gridWidth) {
  while (totalGridColumns > gridWidth) {
    // 找到印张数最少的文件的索引
    var minSheetsIndex = printSheets.indexOf(Math.min(...printSheets));
    // 减少该文件的列数
    gridDistribution[minSheetsIndex]--;
    // 重新计算总列数
    totalGridColumns--;
    // 重新计算该文件的印张数
    var gridCells = gridDistribution[minSheetsIndex] * gridHeight;
    printSheets[minSheetsIndex] = Math.ceil(fileQuantities[minSheetsIndex] / gridCells);
  }
} else if (totalGridColumns < gridWidth) {  // 如果总列数小于网格宽度，则调整网格分配
  while (totalGridColumns < gridWidth) {
    // 找到印张数最多的文件的索引
    var maxSheetsIndex = printSheets.indexOf(Math.max(...printSheets));
    // 增加该文件的列数
    gridDistribution[maxSheetsIndex]++;
    // 重新计算总列数
    totalGridColumns++;
    // 重新计算该文件的印张数
    var gridCells = gridDistribution[maxSheetsIndex] * gridHeight;
    printSheets[maxSheetsIndex] = Math.ceil(fileQuantities[maxSheetsIndex] / gridCells);
  }
}

// 计算总印张数
var totalPrintSheets = 0;
for (var i = 0; i < fileQuantities.length; i++) {
  totalPrintSheets += printSheets[i];
}

// 打印结果
for (var i = 0; i < fileQuantities.length; i++) {
  var gridCells = gridDistribution[i] * gridHeight;  // 计算每个文件占用的网格单元数
  $.writeln(
    "文件 " +
    (i + 1) +
    ": 数量: " +
    fileQuantities[i] +
    ", 列数: " +
    gridDistribution[i] +
    ", 网格单元: " +
    gridCells +
    ", 印张数: " +
    printSheets[i]
  );
}
$.writeln("总印张数: " + totalPrintSheets);
