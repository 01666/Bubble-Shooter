param([int]$Port = 4210)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Split-Path $PSScriptRoot -Parent))
$utf8 = New-Object Text.UTF8Encoding($false)
$mime = @{
  '.html'='text/html; charset=utf-8'; '.css'='text/css; charset=utf-8'
  '.js'='text/javascript; charset=utf-8'; '.mjs'='text/javascript; charset=utf-8'
  '.json'='application/json; charset=utf-8'; '.png'='image/png'; '.svg'='image/svg+xml'
  '.ttf'='font/ttf'; '.woff2'='font/woff2'; '.wav'='audio/wav'; '.mp3'='audio/mpeg'; '.ogg'='audio/ogg'
}
$listener = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback, $Port)
$listener.Start()
try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $client.ReceiveTimeout = 5000
      $stream = $client.GetStream()
      $reader = New-Object IO.StreamReader($stream, $utf8, $false, 4096, $true)
      $request = $reader.ReadLine()
      while (($line = $reader.ReadLine()) -ne '') { if ($null -eq $line) { break } }
      if ($request -notmatch '^(GET|HEAD)\s+([^\s]+)\s+HTTP/') { continue }
      $method = $matches[1]
      $urlPath = ([Uri]('http://127.0.0.1' + $matches[2])).AbsolutePath
      if ($urlPath -eq '/health') {
        $body = $utf8.GetBytes('{"app":"bubble-ticket-arcade","version":"1.8.0"}')
        $contentType = 'application/json; charset=utf-8'
        $status = '200 OK'
      } else {
        if ($urlPath -eq '/') { $urlPath = '/index.html' }
        $relative = [Uri]::UnescapeDataString($urlPath.TrimStart('/')).Replace('/', [IO.Path]::DirectorySeparatorChar)
        $path = [IO.Path]::GetFullPath((Join-Path $root $relative))
        if (-not $path.StartsWith($root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $path -PathType Leaf)) {
          $body = $utf8.GetBytes('Not Found'); $contentType = 'text/plain; charset=utf-8'; $status = '404 Not Found'
        } else {
          $body = [IO.File]::ReadAllBytes($path)
          $ext = [IO.Path]::GetExtension($path).ToLowerInvariant()
          $contentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
          $status = '200 OK'
        }
      }
      $header = "HTTP/1.1 $status`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
      $headerBytes = $utf8.GetBytes($header)
      $stream.Write($headerBytes, 0, $headerBytes.Length)
      if ($method -eq 'GET') { $stream.Write($body, 0, $body.Length) }
      $stream.Flush()
    } catch {
      # A browser may cancel speculative requests; keep serving the game.
    } finally {
      $client.Dispose()
    }
  }
} finally {
  $listener.Stop()
}
