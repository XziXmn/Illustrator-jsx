# YunLi工具箱 构建脚本
# 用法:
#   powershell -ExecutionPolicy Bypass -File build.ps1                 # 开发布局: dist\{YunLiTools.aip, payload\}
#   powershell -ExecutionPolicy Bypass -File build.ps1 -Pack           # 发布布局: 单文件 dist\YunLiTools.aip + 热更包 dist\YunLiHot-<ver>.zip
#   powershell -ExecutionPolicy Bypass -File build.ps1 -RunStandalone  # 构建后独立运行核心
param(
    [switch]$Pack,
    [switch]$RunStandalone
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# 读取并校验核心版本号与 C 壳基线版本号一致
$progText = [IO.File]::ReadAllText((Join-Path $root "core\src\Program.cs"))
$verMatch = [regex]::Match($progText, 'Version\s*=\s*"([0-9]+(?:\.[0-9]+)+)"')
if (-not $verMatch.Success) { throw "无法从 Program.cs 读取版本号" }
$version = $verMatch.Groups[1].Value

$mainCText = [IO.File]::ReadAllText((Join-Path $root "shell\src\main.c"))
$baseMatch = [regex]::Match($mainCText, '#define\s+YUNLI_BASE_VERSION\s+"([0-9]+(?:\.[0-9]+)+)"')
if (-not $baseMatch.Success) { throw "无法从 main.c 读取 YUNLI_BASE_VERSION" }
if ($baseMatch.Groups[1].Value -ne $version) {
    throw "版本号不一致: Program.cs=$version, main.c YUNLI_BASE_VERSION=$($baseMatch.Groups[1].Value)"
}

# PDF 转曲的第三方运行时(qpdf / Ghostscript)不入库,缺失时自动拉取。
if (-not (Test-Path (Join-Path $root "core\tools\qpdf\qpdf.exe")) -or
    -not (Test-Path (Join-Path $root "core\tools\gs\bin\gswin64c.exe"))) {
    $fetchDeps = Join-Path $root "tools\fetch-deps.ps1"
    if (Test-Path $fetchDeps) {
        Write-Host "正在拉取 PDF 转曲依赖(qpdf / Ghostscript)…"
        try { & $fetchDeps } catch { Write-Warning ("依赖拉取失败,PDF 转曲不可用: " + $_.Exception.Message) }
    }
}

function Copy-YunLiFontAssets([string]$webDir, [string]$assetsDir) {
    $ref = Join-Path $root "..\..\references\字醒"
    $fontDir = Join-Path $webDir "font"
    New-Item -ItemType Directory -Force -Path (Join-Path $fontDir "js") | Out-Null
    $html = [IO.File]::ReadAllText((Join-Path $ref "web\index.html"))
    $html = $html.Replace("<title>字醒</title>", "<title>YunLi 字体</title>")
    $bar = '<body><main id="view-fonts" class="page font-page" aria-labelledby="font-title" hidden><div class="page-scroll"><button id="font-retry" class="link" type="button" hidden>重新加载字体工具</button>'
    $html = $html.Replace("<body><main>", $bar)
    $html = $html.Replace('<link rel="stylesheet" href="style.css">', '<link rel="stylesheet" href="../style.css?v=28"><link rel="stylesheet" href="style.css?v=28">')
    # 彻底移除参考页面品牌、授权、旧更新与页脚节点
    $html = [regex]::Replace($html, '<header>.*?</header>', '<header class="page-heading"><h1 id="font-title">字体与文字</h1><p>识别、恢复与批量整理文字。</p></header>', [Text.RegularExpressions.RegexOptions]::Singleline)
    $html = [regex]::Replace($html, '<section id="license"[^>]*>.*?</section>', '', [Text.RegularExpressions.RegexOptions]::Singleline)
    $html = [regex]::Replace($html, '<section id="update"[^>]*>.*?</section>', '', [Text.RegularExpressions.RegexOptions]::Singleline)
    $html = [regex]::Replace($html, '<div id="license-account"[^>]*>.*?</div>', '', [Text.RegularExpressions.RegexOptions]::Singleline)
    $html = [regex]::Replace($html, '<details id="merge-settings"[^>]*>.*?</details>', '', [Text.RegularExpressions.RegexOptions]::Singleline)
    $html = [regex]::Replace($html, '<footer\b[^>]*>.*?</footer>', '', [Text.RegularExpressions.RegexOptions]::Singleline)
    $html = [regex]::Replace($html, '(<button id="tab-[^"]+")', '$1 class="secondary" disabled')
    $html = $html.Replace("</head>", '<script src="theme-boot.js"></script></head>')
    # 首帧直接使用最终布局，避免 OCR 运行时加载后再搬动内容和按钮。
    $fontActions = '<div class="page-foot font-foot">'
    foreach ($mode in @('restore', 'overlay', 'merge')) {
        $hidden = if ($mode -eq 'restore') { '' } else { ' hidden' }
        $fontActions += '<div class="font-actions" data-mode="' + $mode + '"' + $hidden + '>'
        $actionIds = if ($mode -eq 'merge') { @('mergeText', 'splitText') } else { @("${mode}-capture", "${mode}-rebuild") }
        foreach ($actionId in $actionIds) {
            $pattern = '<button id="' + [regex]::Escape($actionId) + '"[^>]*>.*?</button>'
            $button = [regex]::Match($html, $pattern, [Text.RegularExpressions.RegexOptions]::Singleline)
            if (-not $button.Success) { throw "字体操作按钮定位失败: $actionId" }
            $fontActions += $button.Value
            $html = $html.Remove($button.Index, $button.Length)
        }
        $fontActions += '</div>'
    }
    $fontActions += '</div>'
    $html = $html.Replace('</main>', '</div>' + $fontActions + '</main>')
    $html = $html.Replace("<button id=""restore-checkUpdate"" class=""link"">检查更新</button><button id=""restore-website"" class=""link"">官方网站</button>", "")
    $html = $html.Replace("<button id=""overlay-checkUpdate"" class=""link"">检查更新</button><button id=""overlay-website"" class=""link"">官方网站</button>", "")
    Copy-Item (Join-Path $root "panel\font-suggest.js") (Join-Path $fontDir "font-suggest.js") -Force
    # 更多选项: AI 优先识别开关(restore / overlay 两页)
    $html = $html.Replace('<details class="settings"><summary>更多选项</summary><label>语言 <select id="restore-language">', '<details class="settings"><summary>更多选项</summary><label class="check" title="文字以 Qwen 复识为准，位置仍由本地模型检测；每次最多复核 5 行"><input id="restore-aiForce" type="checkbox">AI 优先识别（Qwen）</label><label>语言 <select id="restore-language">')
    $html = $html.Replace('<details class="settings"><summary>更多选项</summary><label>语言 <select id="overlay-language">', '<details class="settings"><summary>更多选项</summary><label class="check" title="文字以 Qwen 复识为准，位置仍由本地模型检测；每次最多复核 5 行"><input id="overlay-aiForce" type="checkbox">AI 优先识别（Qwen）</label><label>语言 <select id="overlay-language">')
    $fontView = [regex]::Match($html, '<main\b[^>]*>.*?</main>', [Text.RegularExpressions.RegexOptions]::Singleline)
    $indexPath = Join-Path $webDir 'index.html'
    $indexHtml = [IO.File]::ReadAllText($indexPath)
    $placeholder = [regex]::Match($indexHtml, '<main id="view-fonts"[^>]*>.*?</main>', [Text.RegularExpressions.RegexOptions]::Singleline)
    if (-not $fontView.Success -or -not $placeholder.Success) { throw '字体视图集成位置不存在' }
    [IO.File]::WriteAllText($indexPath, $indexHtml.Replace($placeholder.Value, $fontView.Value))
    # 兼容旧入口；字体功能本身只在主页面的 #fonts 视图运行。
    [IO.File]::WriteAllText((Join-Path $fontDir 'index.html'), '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=../index.html#fonts"><title>YunLi 字体</title></head><body><a href="../index.html#fonts">打开字体与文字</a></body></html>')
    Copy-Item (Join-Path $root "panel\font.css") (Join-Path $fontDir "style.css") -Force
    Copy-Item (Join-Path $root "panel\font-theme.js") (Join-Path $fontDir "theme.js") -Force
    Copy-Item (Join-Path $root "panel\js\theme-boot.js") (Join-Path $fontDir "theme-boot.js") -Force
    Copy-Item (Join-Path $ref "web\js\core.js") (Join-Path $fontDir "js") -Force
    $paddleJs = [IO.File]::ReadAllText((Join-Path $ref "web\js\paddle-ocr.js"))
    $paddleJs = $paddleJs.Replace("ZiXingPaddle", "YunLiPaddle")
    [IO.File]::WriteAllText((Join-Path $fontDir "js\paddle-ocr.js"), $paddleJs)
    $nativeJs = [IO.File]::ReadAllText((Join-Path $ref "web\js\native-runtime.js"))
    # 字体模块复用主页面消息桥；资源相对脚本位置解析，不再依赖页面 URL。
    $transportStart = $nativeJs.IndexOf(' var next=0,pending=')
    $transportEnd = $nativeJs.IndexOf(' // Same measurement')
    if ($transportStart -lt 0 -or $transportEnd -le $transportStart) { throw '字体消息桥适配位置不存在' }
    $transport = " var worker=null,workerLanguage=null;`n var fontBase=new URL('../',document.currentScript.src).href;`n function managed(method,payload,progress){return window.YunLiTool.requestNative(method,payload,progress);}`n"
    $nativeJs = $nativeJs.Substring(0, $transportStart) + $transport + $nativeJs.Substring($transportEnd)
    $nativeJs = $nativeJs.Replace("ZiXingPaddle", "YunLiPaddle").Replace("ZiXingNative", "YunLiFontRuntime")
    $nativeJs = $nativeJs.Replace("location.origin+'/ocr/worker.min.js'", "new URL('ocr/worker.min.js',fontBase).href")
    $nativeJs = $nativeJs.Replace("location.origin+'/ocr/core'", "new URL('ocr/core/',fontBase).href")
    $nativeJs = $nativeJs.Replace("location.origin+'/ocr/lang'", "new URL('ocr/lang/',fontBase).href")
    $nativeJs = $nativeJs.Replace("location.origin+'/ocr/paddle'", "new URL('ocr/paddle',fontBase).href")
    # 档位路由:先问核心(C# server 模型),native:false 时落回 wasm mobile → tesseract
    $nativeJs = $nativeJs.Replace("var result=await managed('image',{session:session});", "var nat=null;try{nat=await managed('ocr',{language:language,session:session});}catch(e){}if(nat&&nat.native)return nat;var result=await managed('image',{session:session});")
    [IO.File]::WriteAllText((Join-Path $fontDir "js\native-runtime.js"), $nativeJs)
    $panelJs = [IO.File]::ReadAllText((Join-Path $ref "web\js\panel.js"))
    $panelJs = $panelJs.Replace("window.ZiXingNative", "window.YunLiFontRuntime")
    $panelJs = $panelJs.Replace("licenseButtons();", "")
    $panelJs = $panelJs.Replace("var options=global('page-'+mode).querySelector&&global('page-'+mode).querySelector('details.settings');if(options)options.appendChild(global('license-account'));", "")
    # 移除尾部授权/购买/旧更新逻辑，替换为精简启动连接链路
    $tailMarker = "// Trial and activation."
    $tailIdx = $panelJs.IndexOf($tailMarker)
    if ($tailIdx -lt 0) { throw "panel.js 授权尾部定位失败" }
    $cleanBoot = @"
  if(!runtime){flows.forEach(function(f){f.status('请从 Illustrator 的「窗口 → YunLi工具箱」打开。','error');});refresh();return;}
  busy=true;refresh();
  (function(){var ch=window.chrome&&window.chrome.webview;if(!ch)return Promise.resolve();return new Promise(function(res){var h=function(ev){var d;try{d=JSON.parse(ev.data);}catch(e){return;}if(d&&d.action==='hello'){ch.removeEventListener('message',h);res(d.version||'');}};ch.addEventListener('message',h);ch.postMessage(JSON.stringify({action:'hello'}));setTimeout(function(){ch.removeEventListener('message',h);res('');},3000);});})().then(function(v){if(v&&v<'0.2.0')throw Error('核心程序过旧（v'+v+'）：请完全退出 Illustrator 后重新安装最新 YunLiTools.aip。');return Promise.race([runtime.request('host',{action:'ping',payload:{}}),new Promise(function(_,reject){setTimeout(function(){reject(Error('连接 Illustrator 超时（15 秒），请重试。'));},15000);})]);})
    .then(function(){return loadFonts();})
    .then(function(){connected=true;flows[0].status('选中转曲文字后开始识别。');flows[1].status('选中图片或转曲对象后提取文字。');})
    .catch(function(e){connected=false;flows.forEach(function(f){f.status(e.message,'error');});})
    .then(function(){busy=false;refresh();});
}());
"@
    $panelJs = $panelJs.Substring(0, $tailIdx) + $cleanBoot
    $panelJs = $panelJs.Replace("if(!l.reviewed)detail.open=true;", "if(!l.reviewed && !document.querySelector('#'+mode+'-lines details[open]'))detail.open=true;")
    # 字形校验纠错:核心对形近字做单字复核后返回 corrected>0 的行,应用修正文字并强制人工确认
    $panelJs = $panelJs.Replace("if(m.text&&!l.edited&&m.text.length===l.text.length){l.text=m.text;l.simplified=true;}", "if(m.text&&!l.edited&&m.text.length===l.text.length){l.text=m.text;if(m.corrected>0){l.corrected=true;l.reviewed=false;}else{l.simplified=true;}}")
    $panelJs = $panelJs.Replace("m.candidates[0]&&m.candidates[0].similarity>=.90))l.reviewed=true;", "m.candidates[0]&&m.candidates[0].similarity>=.90&&!m.corrected))l.reviewed=true;")
    $panelJs = $panelJs.Replace("l.chars=l.text.length===l.ocrLength?l.ocrChars:null;l.simplified=false;", "l.chars=l.text.length===l.ocrLength?l.ocrChars:null;l.simplified=false;l.corrected=false;")
    $panelJs = $panelJs.Replace(":l.simplified?'OCR 读成了繁体字，已按原稿字形改为简体，请核对。':", ":l.aiRescue?'AI 复识结果，请核对。':l.corrected?'OCR 有错字，已按原稿字形修正，请核对。':l.simplified?'OCR 读成了繁体字，已按原稿字形改为简体，请核对。':")
    $panelJs = $panelJs.Replace("l.chars=l.text.length===l.ocrLength?l.ocrChars:null;l.simplified=false;l.corrected=false;", "l.chars=l.text.length===l.ocrLength?l.ocrChars:null;l.simplified=false;l.corrected=false;l.aiRescue=false;")
    $panelJs = $panelJs.Replace("lines=data.lines.map(function(l){l.reviewed=l.stable===true||(l.ocrAgreed===true&&l.confidence>=.45);", "lines=data.lines.map(function(l){l.aiRescue=l.method==='qwen2.5-vl-rescue';l.reviewed=l.stable===true||(l.ocrAgreed===true&&l.confidence>=.45);")
    # 注意: \$ 在 PS 双引号字符串里要用反引号转义,否则 $('...') 会被当子表达式求值
    $panelJs = $panelJs.Replace("function runOCR(){return request('ocr',{language:`$('language').value,vertical:`$('vertical').checked});}", "function runOCR(){var ai=`$('aiForce');return request('ocr',{language:`$('language').value,vertical:`$('vertical').checked,forceAi:!!(ai&&ai.checked)});}")
    [IO.File]::WriteAllText((Join-Path $fontDir "js\panel.js"), $panelJs)
    # 补丁是字符串替换,有 node 就强检语法,坏了直接让构建失败。
    $node = Get-Command node -ErrorAction SilentlyContinue
    if ($node) {
        $check = & node --check (Join-Path $fontDir "js\panel.js") 2>&1
        if ($LASTEXITCODE -ne 0) { throw "panel.js 语法错误(构建已中止): $check" }
        $check2 = & node --check (Join-Path $fontDir "font-suggest.js") 2>&1
        if ($LASTEXITCODE -ne 0) { throw "font-suggest.js 语法错误(构建已中止): $check2" }
        $check3 = & node --check (Join-Path $fontDir "js\native-runtime.js") 2>&1
        if ($LASTEXITCODE -ne 0) { throw "native-runtime.js 语法错误(构建已中止): $check3" }
        $check4 = & node --check (Join-Path $fontDir "js\paddle-ocr.js") 2>&1
        if ($LASTEXITCODE -ne 0) { throw "paddle-ocr.js 语法错误(构建已中止): $check4" }
    }
    if (Test-Path (Join-Path $ref "web\ocr")) {
        Copy-Item (Join-Path $ref "web\ocr") (Join-Path $fontDir "ocr") -Recurse -Force
    }
    $hostDir = Join-Path $assetsDir "host"
    New-Item -ItemType Directory -Force -Path $hostDir | Out-Null
    $mainJsx = [IO.File]::ReadAllText((Join-Path $ref "host\main.jsx"))
    $mainJsx = $mainJsx.Replace("字醒", "YunLi")
    $mainJsx = $mainJsx.Replace('for (j = 0; j < 30 && shownCharacters(area) < text.length; j++) area.textPath.height += lead;', 'area.textPath.height = lead * (members.length + 2) + size * 2; ab = inkBounds(area); area.textPath.height = ab[1] - ab[3] + lead;')
    [IO.File]::WriteAllText((Join-Path $hostDir "main.jsx"), $mainJsx)
    $guardJsx = [IO.File]::ReadAllText((Join-Path $ref "host\guard.jsx"))
    $guardJsx = $guardJsx.Replace("ZiXingCheckHost", "YunLiCheckHost").Replace("字醒", "YunLi工具箱")
    [IO.File]::WriteAllText((Join-Path $hostDir "guard.jsx"), $guardJsx)
    # 标记脚本自带 json2 兼容层(ExtendScript 无 JSON),夹在两行 ////JSON//// 分隔线之间,抽出来给调度层共用
    $markLines = [IO.File]::ReadAllLines((Join-Path $root "..\云漫标记集\云漫标记集.jsx"))
    $sepLines = @()
    for ($i = 0; $i -lt $markLines.Count; $i++) {
        if ($markLines[$i] -match '^/{10,}JSON/{10,}') { $sepLines += $i }
    }
    if ($sepLines.Count -lt 2) { throw "json2 分隔线定位失败" }
    $jsonLines = $markLines[($sepLines[0] + 1)..($sepLines[1] - 1)]
    [IO.File]::WriteAllLines((Join-Path $hostDir "json2.jsx"), $jsonLines, (New-Object System.Text.UTF8Encoding $true))
    Copy-Item (Join-Path $root "..\云漫标记集\云漫标记集.jsx") (Join-Path $hostDir "marks.jsx") -Force
    Copy-Item (Join-Path $root "..\快速导出工艺tif\快速导出工艺tiff.jsx") (Join-Path $hostDir "export.jsx") -Force
    Copy-Item (Join-Path $root "host\dispatch.jsx") (Join-Path $hostDir "dispatch.jsx") -Force
}

$gcc    = "C:\ProgramData\mingw64\mingw64\bin\gcc.exe"
$windres= "C:\ProgramData\mingw64\mingw64\bin\windres.exe"
$csc    = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
foreach ($t in @($gcc, $windres, $csc)) {
    if (-not (Test-Path $t)) { throw "缺少工具: $t" }
}

$outDir = Join-Path $root "dist"
$rcBase = Join-Path $root "shell\rc"
$libs   = Join-Path $root "core\libs"
$coreOut = Join-Path $outDir "payload"
New-Item -ItemType Directory -Force -Path $outDir, $coreOut | Out-Null

# ---------------- 1. PIPL(官方生成器) ----------------
$piplGen = Join-Path $root "..\..\references\SDK\Adobe Illustrator 2027 SDK\tools\pipl\create_pipl.py"
Push-Location $rcBase
python $piplGen -input '[{\"name\":\"YunLi\",\"entry_point\":\"PluginMain\"}]'
if (-not (Test-Path "plugin.pipl")) { throw "PIPL 生成失败" }
Pop-Location

# ---------------- 2. 原生 SDK 子模块: gcc → YunLiNative.dll ----------------
$nativeDll = Join-Path $coreOut "YunLiNative.dll"
& $gcc -O2 -std=c99 -Wall -Wno-unused-function `
    -DYUNLI_NATIVE_EXPORTS -shared -m64 `
    -o $nativeDll `
    (Join-Path $root "shell\src\native_tools.c") `
    (Join-Path $root "shell\src\native_tools.def") `
    -static-libgcc -lm
if ($LASTEXITCODE -ne 0) { throw "gcc 编译 YunLiNative.dll 失败" }
Write-Host "原生模块完成: $nativeDll"

# ---------------- 3. 面板与宿主脚本资产 ----------------
$webDir = Join-Path $coreOut "assets\web"
New-Item -ItemType Directory -Force -Path (Join-Path $webDir "js") | Out-Null
Copy-Item (Join-Path $root "panel\index.html") $webDir -Force
Copy-Item (Join-Path $root "panel\style.css") $webDir -Force
Copy-Item (Join-Path $root "panel\js\*") (Join-Path $webDir "js") -Force
Copy-YunLiFontAssets $webDir (Join-Path $coreOut "assets")

# ---------------- 4. 核心: 内置 csc(FW 4.8) ----------------
$exePath = Join-Path $coreOut "YunLiCore.exe"
$srcPath = Join-Path $root "core\src\Program.cs"
$enginePath = Join-Path $root "core\src\FontEngine.cs"
$refArgs = @(
    "/r:System.dll", "/r:System.Core.dll", "/r:System.Drawing.dll",
    "/r:System.Windows.Forms.dll", "/r:System.Web.Extensions.dll",
    "/r:System.IO.Compression.dll", "/r:System.IO.Compression.FileSystem.dll",
    "/r:$libs\Microsoft.Web.WebView2.Core.dll",
    "/r:$libs\Microsoft.Web.WebView2.WinForms.dll"
)
# 识别档位 1(PP-OCRv5 server, ONNX Runtime): 运行时在 libs\ocr 时一并引用
if (Test-Path (Join-Path $libs "ocr\Microsoft.ML.OnnxRuntime.dll")) {
    $refArgs += @(
        "/r:$libs\ocr\Microsoft.ML.OnnxRuntime.dll",
        "/r:$libs\ocr\System.Memory.dll",
        "/r:$libs\ocr\System.Runtime.CompilerServices.Unsafe.dll",
        "/r:$libs\ocr\System.Numerics.Vectors.dll",
        # ORT 托管库是 netstandard2.0,csc 需要这个 net48 自带的门面
        "/r:$((Split-Path $csc))\netstandard.dll"
    )
}
$srcs = @("$srcPath", "$enginePath")
if (Test-Path (Join-Path $root "core\src\OcrEngine.cs")) { $srcs += (Join-Path $root "core\src\OcrEngine.cs") }
if (Test-Path (Join-Path $root "core\src\AiEngine.cs")) { $srcs += (Join-Path $root "core\src\AiEngine.cs") }
if (Test-Path (Join-Path $root "core\src\PdfCurve.cs")) { $srcs += (Join-Path $root "core\src\PdfCurve.cs") }
if (Test-Path (Join-Path $root "core\src\Update.cs")) { $srcs += (Join-Path $root "core\src\Update.cs") }

$resArgs = @()
$hotZipPath = $null
if ($Pack) {
    Add-Type -AssemblyName System.IO.Compression.FileSystem

    # 4a. 先编一份不含 240MB 内嵌资源的轻量 YunLiCore.exe, 打包成热更新包 YunLiHot-<ver>.zip
    $hotStage = Join-Path $env:TEMP "yunli-hot-stage"
    if (Test-Path $hotStage) { Remove-Item $hotStage -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $hotStage | Out-Null
    $hotExe = Join-Path $hotStage "YunLiCore.exe"
    & $csc /nologo /target:winexe /platform:anycpu /optimize+ `
        "/out:$hotExe" @refArgs $srcs
    if ($LASTEXITCODE -ne 0) { throw "csc 编译热更核心失败" }
    Copy-Item $nativeDll (Join-Path $hotStage "YunLiNative.dll") -Force
    Copy-Item $webDir (Join-Path $hotStage "assets\web") -Recurse -Force
    # 轻量热更包不包含 ~30MB 的 WASM OCR 模型, 安装时复用基线目录
    $hotOcrDir = Join-Path $hotStage "assets\web\font\ocr"
    if (Test-Path $hotOcrDir) { Remove-Item $hotOcrDir -Recurse -Force }
    Copy-Item (Join-Path $coreOut "assets\host") (Join-Path $hotStage "assets\host") -Recurse -Force

    Get-ChildItem -Path $outDir -Filter "YunLiHot-*.zip" -ErrorAction SilentlyContinue | Remove-Item -Force
    $hotZipPath = Join-Path $outDir "YunLiHot-$version.zip"
    if (Test-Path $hotZipPath) { Remove-Item $hotZipPath -Force }
    [System.IO.Compression.ZipFile]::CreateFromDirectory(
        $hotStage, $hotZipPath, [System.IO.Compression.CompressionLevel]::Optimal, $false)
    Remove-Item $hotStage -Recurse -Force
    Write-Host ("热更包完成: $hotZipPath ({0:N2} MB)" -f ((Get-Item $hotZipPath).Length / 1MB))

    # 4b. 再打包完整基线资产为清单资源 YunLi.Payload, 编入单文件 YunLiCore.exe
    $stage = Join-Path $env:TEMP "yunli-assets"
    if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $stage | Out-Null
    Copy-Item $webDir (Join-Path $stage "web") -Recurse -Force
    Copy-Item (Join-Path $coreOut "assets\host") (Join-Path $stage "host") -Recurse -Force
    $qpdfSrc = Join-Path $root "core\tools\qpdf"
    if (Test-Path (Join-Path $qpdfSrc "qpdf.exe")) {
        $qpdfStage = Join-Path $stage "tools\qpdf"
        New-Item -ItemType Directory -Force -Path $qpdfStage | Out-Null
        Copy-Item (Join-Path $qpdfSrc "*") $qpdfStage -Force
    }
    $gsSrc = Join-Path $root "core\tools\gs"
    if (Test-Path (Join-Path $gsSrc "bin\gswin64c.exe")) {
        Copy-Item $gsSrc (Join-Path $stage "tools\gs") -Recurse -Force
    }
    Copy-Item (Join-Path $libs "WebView2Loader.dll") $stage -Force
    Copy-Item (Join-Path $libs "Microsoft.Web.WebView2.Core.dll") $stage -Force
    Copy-Item (Join-Path $libs "Microsoft.Web.WebView2.WinForms.dll") $stage -Force
    if (Test-Path (Join-Path $libs "ocr\onnxruntime.dll")) {
        Copy-Item (Join-Path $libs "ocr\*.dll") $stage -Force
        $serverStage = Join-Path $stage "ocr\server"
        New-Item -ItemType Directory -Force -Path $serverStage | Out-Null
        Copy-Item (Join-Path $root "core\ocr\server\*") $serverStage -Force
    }
    $assetsZip = Join-Path $env:TEMP "yunli-assets.zip"
    if (Test-Path $assetsZip) { Remove-Item $assetsZip -Force }
    [System.IO.Compression.ZipFile]::CreateFromDirectory(
        $stage, $assetsZip, [System.IO.Compression.CompressionLevel]::Optimal, $false)
    # 必须是单个参数: csc 会把逗号后的逻辑名拆成源文件
    $resArgs = @("/resource:${assetsZip},YunLi.Payload")
}
& $csc /nologo /target:winexe /platform:anycpu /optimize+ `
    "/out:$exePath" @refArgs @resArgs $srcs
if ($LASTEXITCODE -ne 0) { throw "csc 失败" }

# 非发布: 平铺运行布局(exe 旁放 DLL 与 assets)
if (-not $Pack) {
    Copy-Item (Join-Path $libs "WebView2Loader.dll") $coreOut -Force
    Copy-Item (Join-Path $libs "Microsoft.Web.WebView2.Core.dll") $coreOut -Force
    Copy-Item (Join-Path $libs "Microsoft.Web.WebView2.WinForms.dll") $coreOut -Force
    $qpdfSrc = Join-Path $root "core\tools\qpdf"
    if (Test-Path (Join-Path $qpdfSrc "qpdf.exe")) {
        $qpdfDest = Join-Path $coreOut "assets\tools\qpdf"
        New-Item -ItemType Directory -Force -Path $qpdfDest | Out-Null
        Copy-Item (Join-Path $qpdfSrc "*") $qpdfDest -Force
    }
    $gsSrc = Join-Path $root "core\tools\gs"
    if (Test-Path (Join-Path $gsSrc "bin\gswin64c.exe")) {
        $gsDest = Join-Path $coreOut "assets\tools\gs"
        if (Test-Path $gsDest) { Remove-Item $gsDest -Recurse -Force }
        Copy-Item $gsSrc $gsDest -Recurse -Force
    }
    if (Test-Path (Join-Path $libs "ocr\onnxruntime.dll")) {
        Copy-Item (Join-Path $libs "ocr\*.dll") $coreOut -Force
        New-Item -ItemType Directory -Force -Path (Join-Path $coreOut "assets\ocr\server") | Out-Null
        Copy-Item (Join-Path $root "core\ocr\server\*") (Join-Path $coreOut "assets\ocr\server") -Force
    }
}
Write-Host "核心完成: $exePath"

# ---------------- 5. 壳: gcc → YunLiTools.aip ----------------
$rc = Join-Path $rcBase "resource.rc"
if ($Pack) {
    Copy-Item $exePath (Join-Path $rcBase "payload.bin") -Force
    Copy-Item $nativeDll (Join-Path $rcBase "native.bin") -Force
    & $windres -DYUNLI_EMBED_PAYLOAD -I $rcBase -O coff -o (Join-Path $rcBase "resource.o") $rc
} else {
    & $windres -I $rcBase -O coff -o (Join-Path $rcBase "resource.o") $rc
}
if ($LASTEXITCODE -ne 0) { throw "windres 失败" }

$aipOut = Join-Path $outDir "YunLiTools.aip"
& $gcc -O2 -std=c99 -Wall -Wno-unused-function `
    -shared -m64 `
    -o $aipOut `
    (Join-Path $root "shell\src\main.c") `
    (Join-Path $rcBase "resource.o") `
    (Join-Path $root "shell\src\plugin.def") `
    -static-libgcc
if ($LASTEXITCODE -ne 0) { throw "gcc 失败" }
$aipLen = (Get-Item $aipOut).Length
Write-Host ("壳完成: dist\YunLiTools.aip ({0:N2} MB)" -f ($aipLen / 1MB))

if ($Pack) {
    Remove-Item (Join-Path $rcBase "payload.bin") -Force -ErrorAction SilentlyContinue
    Remove-Item (Join-Path $rcBase "native.bin") -Force -ErrorAction SilentlyContinue
    Write-Host ""
    Write-Host "发布版(单文件 v$version): dist\YunLiTools.aip"
    Write-Host "轻量热更包(v$version):   dist\YunLiHot-$version.zip"
    Write-Host "安装: 仅复制 YunLiTools.aip 到 AI 的(附加)插件目录即可; 后续小版本可通过 GitHub 热更新。"
} else {
    Write-Host ""
    Write-Host "[注意] 当前为开发布局空壳($aipLen 字节), 不能单独复制 YunLiTools.aip 使用!"
    Write-Host "开发布局: 复制 dist\ 整个目录(YunLiTools.aip 与 payload\ 必须同级); 发布单文件请加 -Pack。"
}

if ($RunStandalone) {
    Start-Process $exePath -ArgumentList "--standalone"
}
