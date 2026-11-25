# 生成双发布包(单文件 .aip + 轻量热更包 .zip)、写入向后兼容的 update.json, 可选发布到 GitHub Release。
# 用法:
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\release.ps1 -Notes "本次更新说明"
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\release.ps1 -Notes "..." -Publish
param(
    [string]$Notes = "",
    [int]$MinShell = 0,
    [switch]$SkipBuild,
    [switch]$Publish
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$project = Join-Path $root "projects\yunli-tools"
$asset = Join-Path $project "dist\YunLiTools.aip"

# 版本号唯一来源: Program.cs 的 Version 常量; 壳版本号来源: main.c 的 YUNLI_SHELL_VERSION
$source = [IO.File]::ReadAllText((Join-Path $project "core\src\Program.cs"))
$match = [regex]::Match($source, 'Version\s*=\s*"([0-9]+(?:\.[0-9]+)+)"')
if (-not $match.Success) { throw "无法从 Program.cs 读取版本号" }
$version = $match.Groups[1].Value
$tag = "yunli-v$version"

$mainC = [IO.File]::ReadAllText((Join-Path $project "shell\src\main.c"))
$shellMatch = [regex]::Match($mainC, '#define\s+YUNLI_SHELL_VERSION\s+([0-9]+)')
if (-not $shellMatch.Success) { throw "无法从 main.c 读取 YUNLI_SHELL_VERSION" }
$shellVersion = [int]$shellMatch.Groups[1].Value
$effectiveMinShell = if ($MinShell -gt 0) { $MinShell } else { $shellVersion }

if (-not $SkipBuild) {
    & (Join-Path $project "build.ps1") -Pack
    if ($LASTEXITCODE -ne 0) { throw "构建失败" }
}
if (-not (Test-Path $asset)) { throw "找不到完整发布包: $asset" }
# 开发布局的壳只有几十 KB; 打包版内嵌载荷, 至少几十 MB。防止误传开发版。
$size = (Get-Item $asset).Length
if ($size -lt 20MB) {
    throw "发布包只有 $size 字节, 疑似开发版壳。请先运行 build.ps1 -Pack。"
}

$hotAssetName = "YunLiHot-$version.zip"
$hotAsset = Join-Path $project "dist\$hotAssetName"
if (-not (Test-Path $hotAsset)) { throw "找不到轻量热更包: $hotAsset" }
$hotSize = (Get-Item $hotAsset).Length
if ($hotSize -lt 50KB -or $hotSize -gt 25MB) {
    throw "热更包体积异常($hotSize 字节), 请确认未把完整载荷打入热更包。"
}

$sha = (Get-FileHash $asset -Algorithm SHA256).Hash.ToLower()
$hotSha = (Get-FileHash $hotAsset -Algorithm SHA256).Hash.ToLower()
Write-Host "版本:        $version (shellVersion=$shellVersion, minShell=$effectiveMinShell)"
Write-Host ("完整包:      $asset ({0:N2} MB)" -f ($size / 1MB))
Write-Host "完整包 SHA:  $sha"
Write-Host ("热更包:      $hotAsset ({0:N2} MB)" -f ($hotSize / 1MB))
Write-Host "热更包 SHA:  $hotSha"

# 先发布、后写清单: 发布失败时仓库里的 update.json 仍指向有效版本。
if ($Publish) {
    # gh 把进度写到 stderr; Stop 会把原生命令的 stderr 当成终止错误, 这里临时放宽。
    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    gh release view $tag --repo XziXmn/Illustrator-jsx 1> $null 2> $null
    $exists = ($LASTEXITCODE -eq 0)
    if ($exists) {
        gh release upload $tag $asset $hotAsset --repo XziXmn/Illustrator-jsx --clobber
    } else {
        gh release create $tag $asset $hotAsset --repo XziXmn/Illustrator-jsx `
            --title "YunLi工具箱 $tag" --notes $Notes
    }
    $code = $LASTEXITCODE
    $ErrorActionPreference = $previous
    if ($code -ne 0) { throw "发布失败" }
    Write-Host "已发布 $tag (含完整包与热更包)"
}

# 顶层保留 version/tag/asset/sha256/notes/published, 确保旧版(v0.3.3 等)可直接冷更新升级到热更版;
# 新增 shellVersion 与 hot 字段供 v0.4.0+ 免重启轻量热更新。
$manifest = [ordered]@{
    version      = $version
    tag          = $tag
    asset        = "YunLiTools.aip"
    sha256       = $sha
    shellVersion = $shellVersion
    hot          = [ordered]@{
        asset    = $hotAssetName
        sha256   = $hotSha
        minShell = $effectiveMinShell
    }
    notes        = $Notes
    published    = (Get-Date -Format "yyyy-MM-dd")
}
$json = $manifest | ConvertTo-Json -Depth 4
[IO.File]::WriteAllText((Join-Path $root "update.json"), $json + "`n", (New-Object System.Text.UTF8Encoding $false))
Write-Host "update.json 已更新: $version"
Write-Host ""
Write-Host "后续: 提交并推送 update.json, 旧版将自动冷更新到 $version, $version 及以后将支持免重启热更新。"
