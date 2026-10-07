# PROVIDETECH local preview server (no install needed - uses Windows PowerShell)
# Serves this folder at http://localhost:3000  ·  Close this window to stop.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 3000
$mime = @{
  '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8';
  '.json'='application/json'; '.png'='image/png'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.svg'='image/svg+xml';
  '.ico'='image/x-icon'; '.webp'='image/webp'; '.txt'='text/plain; charset=utf-8'; '.md'='text/plain; charset=utf-8';
  '.woff2'='font/woff2'; '.woff'='font/woff'
}
$listener = New-Object System.Net.HttpListener
while ($true) {
  try { $listener = New-Object System.Net.HttpListener; $listener.Prefixes.Add("http://localhost:$port/"); $listener.Start(); break }
  catch { $port++; if ($port -gt 3010) { Write-Host "Could not find a free port between 3000 and 3010." -ForegroundColor Red; Read-Host "Press Enter to close"; exit 1 } }
}
$base = "http://localhost:$port"
Write-Host ""
Write-Host "  PROVIDETECH is running" -ForegroundColor Cyan
Write-Host "  Website : $base/"
Write-Host "  Checkout: $base/checkout.html"
Write-Host "  Admin   : $base/admin"
Write-Host "  Hub     : $base/hub"
Write-Host ""
Write-Host "  Keep this window open while you use the site. Close it to stop." -ForegroundColor DarkGray
Start-Process "$base/"
$rootFull = [System.IO.Path]::GetFullPath($root)
while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext(); $req = $ctx.Request; $res = $ctx.Response
    $path = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath)
    if ($path -eq '/admin') { $res.StatusCode = 301; $res.RedirectLocation = '/admin/'; $res.Close(); continue }
    if ($path -eq '/hub') { $res.StatusCode = 301; $res.RedirectLocation = '/hub/'; $res.Close(); continue }
    if ($path.EndsWith('/')) { $path += 'index.html' }
    $file = [System.IO.Path]::GetFullPath((Join-Path $rootFull ($path.TrimStart('/') -replace '/', '\')))
    if (-not $file.StartsWith($rootFull) -or -not (Test-Path $file -PathType Leaf)) {
      if (Test-Path ($file + '.html') -PathType Leaf) { $file = $file + '.html' }
      else { $res.StatusCode = 404; $b = [Text.Encoding]::UTF8.GetBytes('Not found'); $res.OutputStream.Write($b,0,$b.Length); $res.Close(); continue }
    }
    $ext = [System.IO.Path]::GetExtension($file).ToLower()
    $res.ContentType = $(if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' })
    $res.Headers.Add('Cache-Control','no-store')
    $bytes = [System.IO.File]::ReadAllBytes($file)
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length); $res.Close()
    Write-Host ("  " + (Get-Date -Format 'HH:mm:ss') + "  " + $req.HttpMethod + " " + $req.Url.AbsolutePath) -ForegroundColor DarkGray
  } catch { try { $res.Close() } catch {} }
}
