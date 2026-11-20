# 拉取 PDF 转曲所需的第三方运行时到 core\tools(不入库):
#   qpdf 12.4.2       Apache-2.0
#   Ghostscript 10.08 AGPL-3.0(随发布包附带 COPYING)
# 用法: powershell -NoProfile -ExecutionPolicy Bypass -File tools\fetch-deps.ps1
param(
    [string]$QpdfZip = "https://github.com/qpdf/qpdf/releases/download/v12.4.2/qpdf-12.4.2-mingw64.zip",
    [string]$GhostscriptExe = "https://github.com/ArtifexSoftware/ghostpdl-downloads/releases/download/gs10080/gs10080w64.exe"
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$tools = Join-Path $root "core\tools"
$cache = Join-Path $env:TEMP "yunli-deps"
New-Item -ItemType Directory -Force -Path $cache, $tools | Out-Null

function Get-File([string]$url, [string]$path, [string]$sha) {
    if (Test-Path $path) {
        if ((Get-FileHash $path -Algorithm SHA256).Hash.ToLower() -eq $sha) { return }
        Remove-Item $path -Force
    }
    Write-Host "下载 $url"
    Invoke-WebRequest -Uri $url -OutFile $path -UseBasicParsing
    $actual = (Get-FileHash $path -Algorithm SHA256).Hash.ToLower()
    if ($actual -ne $sha) { throw "校验失败: $path`n期望 $sha`n实际 $actual" }
}

# ---- qpdf ----
$qpdfDir = Join-Path $tools "qpdf"
if (-not (Test-Path (Join-Path $qpdfDir "qpdf.exe"))) {
    $zip = Join-Path $cache "qpdf-12.4.2-mingw64.zip"
    Get-File $QpdfZip $zip "773d2fa0c7d161e2271430734338e560a07b25d0edf11ceee8e53de435012766"
    $out = Join-Path $cache "qpdf"
    if (Test-Path $out) { Remove-Item $out -Recurse -Force }
    Expand-Archive -Path $zip -DestinationPath $out -Force
    $bin = Get-ChildItem $out -Directory | Select-Object -First 1
    New-Item -ItemType Directory -Force -Path $qpdfDir | Out-Null
    Copy-Item (Join-Path $bin.FullName "bin\*") $qpdfDir -Force
    Write-Host "qpdf 就绪: $qpdfDir"
}

# ---- Ghostscript ----
$gsDir = Join-Path $tools "gs"
if (-not (Test-Path (Join-Path $gsDir "bin\gswin64c.exe"))) {
    $setup = Join-Path $cache "gs10080w64.exe"
    Get-File $GhostscriptExe $setup "52a91b8bf09298788d7a57b9206127026c23eacd75405f0a131e26dc381dce50"
    if (Test-Path $gsDir) { Remove-Item $gsDir -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $gsDir | Out-Null
    # NSIS 安装包:/S 静默,/D 必须是不带引号的绝对路径且放最后
    Start-Process -FilePath $setup -ArgumentList "/S", "/D=$gsDir" -Wait
    # 只保留运行所需目录,去掉卸载器与示例
    foreach ($name in @("doc", "examples", "uninstgs.exe")) {
        $path = Join-Path $gsDir $name
        if (Test-Path $path) { Remove-Item $path -Recurse -Force }
    }
    if (-not (Test-Path (Join-Path $gsDir "bin\gswin64c.exe"))) { throw "Ghostscript 安装失败" }
    Write-Host "Ghostscript 就绪: $gsDir"
}

Write-Host "依赖已就绪。"
