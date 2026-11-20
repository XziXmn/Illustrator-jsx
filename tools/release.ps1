# 生成发布包、写入 update.json,可选直接发布到 GitHub Release。
# 用法:
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\release.ps1 -Notes "本次更新说明"
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\release.ps1 -Notes "..." -Publish
param(
    [string]$Notes = "",
    [switch]$SkipBuild,
    [switch]$Publish
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$project = Join-Path $root "projects\云漫工具集"
$asset = Join-Path $project "dist\YunLiTools.aip"

# 版本号唯一来源:Program.cs 的 Version 常量
$source = [IO.File]::ReadAllText((Join-Path $project "core\src\Program.cs"))
$match = [regex]::Match($source, 'Version\s*=\s*"([0-9]+(?:\.[0-9]+)+)"')
if (-not $match.Success) { throw "无法从 Program.cs 读取版本号" }
$version = $match.Groups[1].Value
$tag = "yunli-v$version"

if (-not $SkipBuild) {
    & (Join-Path $project "build.ps1") -Pack
    if ($LASTEXITCODE -ne 0) { throw "构建失败" }
}
if (-not (Test-Path $asset)) { throw "找不到发布包: $asset" }

$sha = (Get-FileHash $asset -Algorithm SHA256).Hash.ToLower()
Write-Host "版本: $version"
Write-Host "SHA256: $sha"
Write-Host "产物: $asset"

# 先发布、后写清单:发布失败时仓库里的 update.json 仍指向有效版本。
if ($Publish) {
    $exists = $false
    gh release view $tag --repo XziXmn/Illustrator-jsx *> $null
    if ($LASTEXITCODE -eq 0) { $exists = $true }
    if ($exists) {
        gh release upload $tag $asset --repo XziXmn/Illustrator-jsx --clobber
    } else {
        gh release create $tag $asset --repo XziXmn/Illustrator-jsx `
            --title "YunLi工具箱 $tag" --notes $Notes
    }
    if ($LASTEXITCODE -ne 0) { throw "发布失败" }
    Write-Host "已发布 $tag"
}

$manifest = [ordered]@{
    version   = $version
    tag       = $tag
    asset     = "YunLiTools.aip"
    sha256    = $sha
    notes     = $Notes
    published = (Get-Date -Format "yyyy-MM-dd")
}
$json = $manifest | ConvertTo-Json
[IO.File]::WriteAllText((Join-Path $root "update.json"), $json + "`n", (New-Object System.Text.UTF8Encoding $false))
Write-Host "update.json 已更新: $version"
Write-Host ""
Write-Host "后续: 提交并推送 update.json,客户端即可检查到 $version。"
