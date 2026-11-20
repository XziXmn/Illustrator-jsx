# 把 Qwen 兜底档(bin + 模型,约 3.2GB)打包成 dist\YunLiAi.zip
# 目标机器: 解压到 %LOCALAPPDATA%\YunLi\ 下(与 bin\models 同级),
# 需要 NVIDIA GPU >= 6GB 才会启用(核心自动探测)。
param()
$ErrorActionPreference = "Stop"
$src = Join-Path $env:LOCALAPPDATA "YunLi"
$outDir = Join-Path $PSScriptRoot "dist"
$out = Join-Path $outDir "YunLiAi.zip"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
if (-not (Test-Path (Join-Path $src "bin\llama-server.exe"))) { throw "本机没有 llama-server.exe: $src\bin" }
if (-not (Test-Path (Join-Path $src "models\qwen2.5-vl-3b"))) { throw "本机没有模型: $src\models\qwen2.5-vl-3b" }
if (Test-Path $out) { Remove-Item $out -Force }
Compress-Archive -Path (Join-Path $src "bin"), (Join-Path $src "models") -DestinationPath $out -Force
Write-Host "AI 兜底档已打包: $out"
Write-Host "目标机器解压到 %LOCALAPPDATA%\YunLi\ 即可;识别档自动探测 NVIDIA GPU >= 6GB"
