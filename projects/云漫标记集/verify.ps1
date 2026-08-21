param(
    [string]$ScriptPath = (Join-Path $PSScriptRoot '云漫标记集.jsx')
)

$ErrorActionPreference = 'Stop'
$resolvedPath = (Resolve-Path -LiteralPath $ScriptPath).Path
$content = Get-Content -LiteralPath $resolvedPath -Raw

function Assert-Contains([string]$Text, [string]$Expected, [string]$Label) {
    if ($Text.IndexOf($Expected, [System.StringComparison]::Ordinal) -lt 0) {
        throw "缺少必要规则：$Label"
    }
}

function Assert-NotContains([string]$Text, [string]$Forbidden, [string]$Label) {
    if ($Text.IndexOf($Forbidden, [System.StringComparison]::Ordinal) -ge 0) {
        throw "发现已禁止的旧逻辑：$Label"
    }
}

Assert-Contains $content '云漫标记集 Ver 0.7.4.4' '版本号'
Assert-Contains $content '["青(C)", "红(M)", "黄(Y)", "黑(K)"]' '紧凑 CMYK 中文标签'
Assert-NotContains $content '洋(M)' '错误的紧凑洋红标签'
Assert-Contains $content 'markAreaMM < 4 || offsetMM < 0' '标记大小和偏移下限'
Assert-Contains $content '标记大小必须大于等于4mm且偏移大于等于0mm' '下限错误提示'
Assert-NotContains $content 'markAreaMM <= 5 || offsetMM <= 0' '旧的 5mm/0mm 严格下限'
Assert-Contains $content 'Grating.onClick = function ()' '对位线点击联动'
Assert-Contains $content 'lineWidthInput.text = "0.04"' '对位线自动设置 0.04mm'
Assert-Contains $content 'var bandTop = bottom - markOffset - crossPad;' '底部外围标识区'
Assert-Contains $content 'var bandBottom = top + markOffset + crossPad;' '顶部外围标识区'
Assert-Contains $content '避免“fit=true 但 place=false”导致文字被删除' 'fit/place 一致性修复'
Assert-Contains $content 'var epsilon = 0.03 * pointTomm;' '多画板坐标舍入容差'
Assert-Contains $content 'function getHotStampInfoLayout()' '冷烫信息长边方向布局'
Assert-Contains $content 'function getHotStampColorLayout(layout)' '竖版冷烫色标落位'
Assert-Contains $content 'var colorLayout = getHotStampColorLayout(layout);' '冷烫色标落位接入'
Assert-Contains $content 'rotateHotStampInfoFrame(mainFrame, layout.rotation);' '冷烫信息旋转'
Assert-Contains $content 'var BottomGroup = dialog.add("group"' '底部信息分组'
Assert-Contains $content 'var Commentpanel = BottomGroup.add("panel"' '备注底部布局'
Assert-Contains $content 'var spotColorSelectionPanel = BottomGroup.add("panel"' '专色选择分组面板'
Assert-Contains $content 'var spotColorSelectionGroup = spotColorSelectionPanel.add("group"' '横向专色选择区'
Assert-Contains $content 'spotColorSelectionGroup.orientation = "column"' '专色选择自动换行容器'
Assert-Contains $content 'function getSpotColorControlWidth(control, name)' '专色控件宽度测量'
Assert-Contains $content 'currentRow.remove(checkbox)' '专色换行重排'
Assert-Contains $content 'Panel_1.preferredSize.width = 148' '左侧参数区宽度'
Assert-Contains $content 'Panel_2.preferredSize.width = 148' '右侧选项区宽度'
Assert-Contains $content 'Panel_3.preferredSize.width = 148' '等分线区宽度'
Assert-Contains $content 'spotColorSelectionPanel.preferredSize.width = 148' '专色选择区宽度'
Assert-Contains $content 'spotColorSelectionPanel.text = "专色"' '专色区短标题'
Assert-Contains $content 'function getSelectableSpotColors(documentRef)' '文档专色列表'
Assert-Contains $content 'swatch.color.typename !== "SpotColor"' '色板专色读取'
Assert-Contains $content 'var checkbox = currentRow.add("checkbox"' '专色勾选控件'
Assert-Contains $content 'function collectSelectedSpotColorNames()' '专色勾选结果收集'
Assert-Contains $content 'var spotColorInfo = getSelectedSpotColorInfo(doc, selectedSpotColorNames);' '手动选择专色接入标记'
Assert-Contains $content 'var documentContextReady = false;' '生成前文档上下文预检'
Assert-Contains $content 'if (myReturn == true && documentContextReady)' '无文档时阻止生成'
Assert-NotContains $content 'var selectionMode = app.activeDocument.selection.length > 0;' '对话框前直接访问活动文档'
Assert-Contains $content 'var colorRecord = buildHotStampColorRecord(0);' 'CMYK 与专色统一文字框'
Assert-Contains $content 'applyStyledColors(textRef, colorRecord);' '统一文字框分色着色'
Assert-Contains $content 'var spotColorNameLibrary = [' '已确认专色名称库'
Assert-Contains $content 'getSpotColorLabel(spotColorInfo[h].name, level >= 2)' '专色常规名/最小短码切换'
Assert-Contains $content 'isIgnoredSpotColorName(swatchSpot.name)' '剔除 AutoCAD Color 4'
Assert-Contains $content 'PANTONE 1205 C' 'PANTONE 1205 C 规则'
Assert-Contains $content '"纳米", compact: "SN"' '纳米短码规则'
Assert-Contains $content '"消光", compact: "SM"' '消光短码规则'
Assert-Contains $content '"白墨", compact: "W"' '白墨最小短码规则'
Assert-NotContains $content 'level === 0 ? ("(" + spotColorInfo[h].name + ")")' '专色名称括号格式分叉'
Assert-NotContains $content 'spotNametextRef' '专色独立文字框'
Assert-NotContains $content 'documentSpotColorInfoEnabled' '旧的自动专色识别开关'
Assert-NotContains $content 'function isDocumentMonochrome()' '旧的自动单色/专色扫描'
Assert-Contains $content 'restoreDocumentContext(doc, originalActiveLayer, originalActiveArtboardIndex);' '文档上下文恢复'
Assert-Contains $content 'function loadStoredParams(file)' '设置读取容错'
Assert-Contains $content 'function parseFiniteInput(text)' '数值输入校验'

Assert-NotContains $content 'bottom + innerDepth' '文字回到成品内容区'
Assert-NotContains $content 'getHotStampEmergencyCMYKZone' '内容区紧急 CMYK 回退'
Assert-NotContains $content 'getHotStampCornerHorizontalBounds' '内容区四角区域'

$runtimeStart = $content.IndexOf('var doc;')
if ($runtimeStart -lt 0) { throw '无法定位插件运行时代码入口。' }
$runtimeCode = $content.Substring($runtimeStart)
if ([regex]::IsMatch($runtimeCode, '\beval\s*\(')) {
    throw '运行时代码仍包含 eval；json2.js 兼容代码之外不允许使用 eval。'
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw '未找到 Node.js，无法执行语法与布局探针。'
}

$nodeProbe = @'
const fs = require('fs');
const path = process.argv[2];
const source = fs.readFileSync(path, 'utf8');
const stripped = source.replace(/^\s*#.*$/gm, '');
new Function(stripped);

function functionText(name) {
  const start = source.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('missing function: ' + name);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error('unclosed function: ' + name);
}

function probeOuterZones() {
  let left = 0, right = 100, top = 100, bottom = 0;
  let pointTomm = 1, markOffset = 10, markArea = 20, reticleLength = 2;
  function getExpandedArtboardBounds() {
    return { left: -30, right: 130, bottom: -30, top: 130 };
  }
  function getHotStampEdgePositions() {
    return { low: [30], high: [70] };
  }
  eval([
    functionText('makeInfoZone'),
    functionText('getOutermostPosition'),
    functionText('getHotStampBottomInfoZones'),
    functionText('getHotStampTopInfoZones')
  ].join('\n'));
  const bottomZones = getHotStampBottomInfoZones();
  const topZones = getHotStampTopInfoZones();
  if (!(bottomZones.low.top < bottom && bottomZones.high.top < bottom)) {
    throw new Error('bottom information zones entered content area');
  }
  if (!(topZones.low.bottom > top && topZones.high.bottom > top)) {
    throw new Error('top information zones entered content area');
  }
}

function probePlacement(roundingError) {
  let pointTomm = 1;
  eval([
    functionText('zoneWidth'),
    functionText('zoneHeight'),
    functionText('getInfoGuard'),
    functionText('zoneUsableWidth'),
    functionText('zoneUsableHeight'),
    functionText('frameInsideZone'),
    functionText('clampFrameInsideZone'),
    functionText('placeFrameInZone')
  ].join('\n'));

  let bounds = [0, 0, 20, -5];
  const frame = {
    get visibleBounds() { return bounds.slice(); },
    translate(dx, dy) {
      const error = (Math.abs(dx) > 500 || bounds[0] > 500) ? roundingError : 0;
      bounds = [
        bounds[0] + dx + error,
        bounds[1] + dy,
        bounds[2] + dx + error,
        bounds[3] + dy
      ];
    }
  };
  return placeFrameInZone(
    frame,
    { left: 1000, top: 100, right: 1100, bottom: 80 },
    'right',
    'center'
  );
}

function probeHotStampEdgesAndInfoDirection() {
  let left = 0, right = 200, top = 100, bottom = 0;
  let pw = 200, ph = 100;
  let markOffset = 2, reticleLength = 3, stripWidth = 6;
  let topMarksGroup = 'top', bottomMarksGroup = 'bottom';
  let rightMarksGroup = 'right', leftMarksGroup = 'left';
  function getExpandedArtboardBounds() {
    return { left: -8, right: 208, top: 108, bottom: -8 };
  }
  let markCalls = [];
  function placeHotStampMarksOnEdge(cx, cy, axis, low, high, group) {
    markCalls.push({ axis, group });
  }
  eval(functionText('createMark'));

  const expectedMarks = JSON.stringify([
    { axis: 'h', group: 'top' }, { axis: 'h', group: 'bottom' },
    { axis: 'v', group: 'right' }, { axis: 'v', group: 'left' }
  ]);

  createMark();
  if (JSON.stringify(markCalls) !== expectedMarks) {
    throw new Error('landscape hot-stamp marks were not generated on all four edges');
  }

  pw = 100; ph = 200; right = 100; top = 200; markCalls = [];
  createMark();
  if (JSON.stringify(markCalls) !== expectedMarks) {
    throw new Error('portrait hot-stamp marks were not generated on all four edges');
  }

  pw = ph = 100; right = top = 100; markCalls = [];
  createMark();
  if (JSON.stringify(markCalls) !== expectedMarks) {
    throw new Error('square hot-stamp marks were not generated on all four edges');
  }

  let whiteAxes = [];
  function getHotStampEdgePositions() { return { low: [1], high: [2] }; }
  function addWhiteInkAlongPositions(axis) { whiteAxes.push(axis); }
  eval(functionText('createWhiteInkByHotStampRange'));

  pw = 200; ph = 100; right = 200; top = 100; whiteAxes = [];
  createWhiteInkByHotStampRange({}, {});
  if (whiteAxes.join('') !== 'hhhhvvvv') throw new Error('landscape white ink did not cover all mark edges');

  pw = 100; ph = 200; right = 100; top = 200; whiteAxes = [];
  createWhiteInkByHotStampRange({}, {});
  if (whiteAxes.join('') !== 'hhhhvvvv') throw new Error('portrait white ink did not cover all mark edges');

  function getHotStampTopInfoZones() {
    return { low: { id: 'top-left' }, high: { id: 'top-right' } };
  }
  function getHotStampBottomInfoZones() {
    return { low: { id: 'bottom-left' }, high: { id: 'bottom-right' } };
  }
  function getHotStampLeftInfoZones() {
    return { low: { id: 'left-bottom' }, high: { id: 'left-top' } };
  }
  function getHotStampRightInfoZones() {
    return { low: { id: 'right-bottom' }, high: { id: 'right-top' } };
  }
  let Comment_text = { text: '' };
  eval([
    functionText('getHotStampInfoLayout'),
    functionText('getHotStampColorLayout')
  ].join('\n'));

  pw = 200; ph = 100;
  let layout = getHotStampInfoLayout();
  if (layout.rotation !== 0
      || layout.comment.zone.id !== 'top-left'
      || layout.secondary.zone.id !== 'top-right'
      || layout.color.zone.id !== 'bottom-left'
      || layout.main.zone.id !== 'bottom-right') {
    throw new Error('landscape information did not use four horizontal corner zones');
  }

  pw = 100; ph = 200;
  layout = getHotStampInfoLayout();
  if (layout.rotation !== 270
      || layout.comment.zone.id !== 'right-top'
      || layout.secondary.zone.id !== 'right-bottom'
      || layout.color.zone.id !== 'left-top'
      || layout.main.zone.id !== 'left-bottom') {
    throw new Error('portrait information did not rotate clockwise into the expected four corner zones');
  }

  let colorLayout = getHotStampColorLayout(layout);
  if (colorLayout.zone.id !== 'left-top' || colorLayout.vAlign !== 'top') {
    throw new Error('portrait hot-stamp color information did not use the rotated top-left position');
  }

  Comment_text.text = '备注';
  colorLayout = getHotStampColorLayout(layout);
  if (layout.comment.zone.id !== 'right-top' || colorLayout.zone.id !== 'left-top') {
    throw new Error('portrait comment and color information still overlap after rotation mapping');
  }
}

function probeFilenameCompaction() {
  eval([
    functionText('isHighSurrogateCode'),
    functionText('isLowSurrogateCode'),
    functionText('safePrefix'),
    functionText('safeSuffix'),
    functionText('truncateFilenameFromEnd')
  ].join('\n'));

  const original = 'uv烫金机2026测试_理光';
  const compacted = truncateFilenameFromEnd(original, original.length - 1);
  if (compacted.length >= original.length) {
    throw new Error('abbreviated filename became as long as or longer than the original');
  }
  if (!compacted.startsWith('uv')
      || !compacted.endsWith('…')
      || compacted.includes('……')
      || compacted.endsWith('理光')) {
    throw new Error('abbreviated filename did not use end truncation with one marker');
  }
}

function probeSpotColorNameLibrary() {
  const libraryStart = source.indexOf('var spotColorNameLibrary =');
  const libraryEnd = source.indexOf('];', libraryStart);
  if (libraryStart < 0 || libraryEnd < 0) throw new Error('spot color library declaration is missing');
  eval(source.slice(libraryStart, libraryEnd + 2));
  eval([
    functionText('normalizeSpotColorLookupName'),
    functionText('findSpotColorNameEntry'),
    functionText('getSpotColorLabel'),
    functionText('isIgnoredSpotColorName')
  ].join('\n'));

  const expected = [
    ['White', '白墨', 'W'],
    ['White2', '白墨2', 'W2'],
    ['nixiang', '纳米', 'SN'],
    ['逆向', '纳米', 'SN'],
    ['Gold Foil', '烫金', 'GF'],
    ['冷烫银', '烫银', 'SF'],
    ['Matte', '消光', 'SM'],
    ['Spot Red', '专红', 'SR'],
    ['Spot Yellow', '专黄', 'SY'],
    ['Orange', '橙色', 'SO'],
    ['Green', '绿色', 'SG'],
    ['Violet', '紫色', 'SV'],
    ['PANTONE 1205 C', '1205c', '1205c']
  ];
  for (const [name, display, compact] of expected) {
    if (getSpotColorLabel(name, false) !== display || getSpotColorLabel(name, true) !== compact) {
      throw new Error('spot color label mapping failed for ' + name);
    }
  }
  if (getSpotColorLabel('逆向UV', false) !== '逆向UV') {
    throw new Error('逆向UV was incorrectly merged into the 纳米 alias');
  }
  if (getSpotColorLabel('PANTONE 186 C', false) !== 'PANTONE 186 C'
      || getSpotColorLabel('自定义专色', false) !== '自定义专色') {
    throw new Error('unknown spot color name was unexpectedly rewritten');
  }
  if (!isIgnoredSpotColorName('AutoCAD Color 4') || !isIgnoredSpotColorName(' autocad color 4 ')) {
    throw new Error('AutoCAD Color 4 was not ignored case-insensitively');
  }
}

function probeManualSpotSelection() {
  const ColorModel = { SPOT: 'SPOT', REGISTRATION: 'REGISTRATION' };
  const goldSpot = { name: '烫金', colorType: ColorModel.SPOT, spotKind: 'CMYK', typename: 'Spot', color: {} };
  const silverSpot = { name: '冷烫银', colorType: ColorModel.SPOT, spotKind: 'LAB', typename: 'Spot', color: {} };
  const autoSpot = { name: 'AutoCAD Color 4', colorType: ColorModel.SPOT, spotKind: 'CMYK', typename: 'Spot', color: {} };
  const registrationSpot = { name: '套版色', colorType: ColorModel.REGISTRATION, spotKind: 'CMYK', typename: 'Spot', color: {} };
  const documentRef = {
    swatches: [
      { name: '烫金', color: { typename: 'SpotColor', spot: goldSpot } },
      { name: 'AutoCAD Color 4', color: { typename: 'SpotColor', spot: autoSpot } },
      { name: '套版色', color: { typename: 'SpotColor', spot: registrationSpot } }
    ],
    spots: [
      goldSpot,
      registrationSpot,
      silverSpot,
      autoSpot
    ]
  };
  eval([
    functionText('getSelectableSpotColors'),
    functionText('containsSpotName'),
    functionText('normalizeSpotColorLookupName'),
    functionText('isIgnoredSpotColorName'),
    functionText('getSpotColorInfo'),
    functionText('getSelectedSpotColorInfo')
  ].join('\n'));

  const available = getSelectableSpotColors(documentRef);
  if (available.map(spot => spot.name).join('|') !== '烫金|冷烫银') {
    throw new Error('manual spot list did not keep only real spot colors');
  }
  const selected = getSelectedSpotColorInfo(documentRef, ['冷烫银']);
  if (selected.length !== 1 || selected[0].name !== '冷烫银') {
    throw new Error('manual spot selection was not passed to mark output');
  }
}

probeOuterZones();
probeHotStampEdgesAndInfoDirection();
probeFilenameCompaction();
probeSpotColorNameLibrary();
probeManualSpotSelection();
if (!probePlacement(0.02)) throw new Error('small multi-artboard rounding error was rejected');
if (probePlacement(0.20)) throw new Error('real overflow was incorrectly accepted');
console.log('Node syntax, layout, filename compaction, four-edge marks, direction, spot color library, and manual spot selection probes: OK');
'@

$nodeProbe | & node - $resolvedPath
if ($LASTEXITCODE -ne 0) {
    throw "Node 布局探针失败，退出码：$LASTEXITCODE"
}

Write-Output "PASS: $resolvedPath"
