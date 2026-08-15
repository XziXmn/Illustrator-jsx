param(
    [string]$ScriptPath = (Join-Path $PSScriptRoot '云漫标记集v0.7.4.1.jsx')
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

Assert-Contains $content '云漫标记集 Ver 0.7.4.1' '版本号'
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
Assert-Contains $content 'var documentSpotColorInfoEnabled = false;' '文档专色信息暂停开关'
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

function probeLongEdgeHotStamp() {
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

  createMark();
  if (JSON.stringify(markCalls) !== JSON.stringify([
    { axis: 'h', group: 'top' }, { axis: 'h', group: 'bottom' }
  ])) throw new Error('landscape hot-stamp marks were not limited to long edges');

  pw = 100; ph = 200; right = 100; top = 200; markCalls = [];
  createMark();
  if (JSON.stringify(markCalls) !== JSON.stringify([
    { axis: 'v', group: 'right' }, { axis: 'v', group: 'left' }
  ])) throw new Error('portrait hot-stamp marks were not limited to long edges');

  pw = ph = 100; right = top = 100; markCalls = [];
  createMark();
  if (markCalls.length !== 2 || markCalls[0].axis !== 'v' || markCalls[1].axis !== 'v') {
    throw new Error('square hot-stamp branch changed unexpectedly');
  }

  let whiteAxes = [];
  function getHotStampEdgePositions() { return { low: [1], high: [2] }; }
  function addWhiteInkAlongPositions(axis) { whiteAxes.push(axis); }
  eval(functionText('createWhiteInkByHotStampRange'));

  pw = 200; ph = 100; right = 200; top = 100; whiteAxes = [];
  createWhiteInkByHotStampRange({}, {});
  if (whiteAxes.join('') !== 'hhhh') throw new Error('landscape white ink did not follow long edges');

  pw = 100; ph = 200; right = 100; top = 200; whiteAxes = [];
  createWhiteInkByHotStampRange({}, {});
  if (whiteAxes.join('') !== 'vvvv') throw new Error('portrait white ink did not follow long edges');
}

probeOuterZones();
probeLongEdgeHotStamp();
if (!probePlacement(0.02)) throw new Error('small multi-artboard rounding error was rejected');
if (probePlacement(0.20)) throw new Error('real overflow was incorrectly accepted');
console.log('Node syntax, layout, and long-edge probes: OK');
'@

$nodeProbe | & node - $resolvedPath
if ($LASTEXITCODE -ne 0) {
    throw "Node 布局探针失败，退出码：$LASTEXITCODE"
}

Write-Output "PASS: $resolvedPath"
