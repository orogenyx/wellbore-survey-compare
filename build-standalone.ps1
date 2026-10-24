# Builds dist\: Survey Compare.html (a single self-contained file that opens offline) plus the
# icon and installer, so dist\ is the complete folder to copy onto a flash drive.
# Run from this folder:  powershell -ExecutionPolicy Bypass -File .\build-standalone.ps1
# Source: survey-compare.html (the page as published to Claude, no <html>/<head> of its own)
#         vendor\xlsx.full.min.js (SheetJS 0.18.5, inlined so no internet is needed)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$src = Join-Path $root 'survey-compare.html'
$lib = Join-Path $root 'vendor\xlsx.full.min.js'
$outDir = Join-Path $root 'dist'
$out = Join-Path $outDir 'Survey Compare.html'

$utf8 = New-Object System.Text.UTF8Encoding $false
$page = [System.IO.File]::ReadAllText($src, $utf8)
$xlsx = [System.IO.File]::ReadAllText($lib, $utf8)
# PNG favicons (rendered from icons/icon.svg) are what Chromium honours on file:// pages; the SVG is kept as the source.
$iconLinks = ''
foreach ($size in 16, 32, 64) {
  $png = Join-Path $root "icons/icon-$size.png"
  if (Test-Path $png) {
    $b64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($png))
    $iconLinks += "<link rel=`"icon`" type=`"image/png`" sizes=`"${size}x${size}`" href=`"data:image/png;base64,$b64`">`n"
  }
}
if (-not $iconLinks) { throw "icons/icon-16/32/64.png not found" }

$cdnTag = '<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>'
if ($page.IndexOf($cdnTag) -lt 0) { throw "CDN script tag not found in survey-compare.html; update build-standalone.ps1" }
$page = $page.Replace($cdnTag, "<script>`n" + $xlsx + "`n</script>")

# The published page keeps <title>, <meta> and <link> at the top of the body; lift them into a real <head>.
$head = @'
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Survey Compare</title>
__ICON__<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)} img{max-width:100%} [hidden]{display:none!important}</style>
</head>
<body>
'@
$page = $page -replace '<title>Survey Compare</title>\r?\n', ''
$page = $page -replace '<meta name="claude:viewport-fit-sides" content="cover">\r?\n', ''
$doc = $head.Replace('__ICON__', $iconLinks) + $page + "`n</body>`n</html>`n"

New-Item -ItemType Directory -Force $outDir | Out-Null
[System.IO.File]::WriteAllText($out, $doc, $utf8)
$kb = [math]::Round((Get-Item $out).Length / 1KB)
Write-Host "Built $out ($kb KB)"

# The handout extras: dist\ is the folder to copy onto a flash drive, so it also carries the
# desktop icon and the installer that puts a shortcut on another PC.
foreach ($extra in 'icons\survey-compare.ico', 'install-shortcut.ps1', 'Install desktop shortcut.cmd') {
  Copy-Item (Join-Path $root $extra) $outDir -Force
}
Write-Host "Copied survey-compare.ico, install-shortcut.ps1 and Install desktop shortcut.cmd into dist"
