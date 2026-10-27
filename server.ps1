param([switch]$NoBrowser)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$root = [IO.Path]::GetFullPath($PSScriptRoot)
if (-not $root.EndsWith('\')) { $root += '\' }
$certDir = Join-Path $root 'certs'
$pfxPath = Join-Path $certDir 'localhost.pfx'
$cerPath = Join-Path $certDir 'localhost.cer'
$pfxPass = 'jinhe-local'
$port = 8443
$url = "https://127.0.0.1:$port/"

function New-LocalCertificate {
    $rsa = [System.Security.Cryptography.RSA]::Create(2048)
    $req = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new(
        'CN=localhost', $rsa,
        [System.Security.Cryptography.HashAlgorithmName]::SHA256,
        [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
    $san = [System.Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new()
    $san.AddDnsName('localhost')
    $san.AddIpAddress([System.Net.IPAddress]::Parse('127.0.0.1'))
    $req.CertificateExtensions.Add($san.Build())
    $req.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($true, $false, 0, $true))
    $ku = [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::DigitalSignature -bor `
          [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::KeyEncipherment -bor `
          [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::CertSign
    $req.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new($ku, $true))
    $eku = [System.Security.Cryptography.OidCollection]::new()
    [void]$eku.Add([System.Security.Cryptography.Oid]::new('1.3.6.1.5.5.7.3.1'))
    $req.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new($eku, $false))
    $cert = $req.CreateSelfSigned([DateTimeOffset]::Now.AddDays(-1), [DateTimeOffset]::Now.AddDays(397))
    [IO.File]::WriteAllBytes($pfxPath, $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pfx, $pfxPass))
    [IO.File]::WriteAllBytes($cerPath, $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert))
    return $cert
}

if (-not (Test-Path $certDir)) { New-Item -ItemType Directory -Path $certDir | Out-Null }

$needCert = $true
if ((Test-Path $pfxPath) -and (Test-Path $cerPath)) {
    try {
        $probe = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($pfxPath, $pfxPass)
        if ($probe.HasPrivateKey -and $probe.NotAfter -gt (Get-Date).AddDays(30)) {
            $needCert = $false
        }
    } catch { $needCert = $true }
}
if ($needCert) {
    Write-Host '正在產生本機 HTTPS 憑證...' -ForegroundColor DarkYellow
    New-LocalCertificate | Out-Null
}

$serverCert = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new(
    $pfxPath, $pfxPass,
    [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable)

$listener = $null
try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
    $listener.Start()
} catch {
    Write-Host ''
    Write-Host "連接埠 $port 已被占用，請關閉其他視窗後再試。" -ForegroundColor Red
    Read-Host '按 Enter 結束'
    exit 1
}

Write-Host ''
Write-Host '  ██  金鶴賭場 · 還債之夜  ██' -ForegroundColor Yellow
Write-Host ''
Write-Host "  網址： $url" -ForegroundColor Cyan
Write-Host '  首次開啟若出現憑證警告，按「進階」→「繼續前往」。' -ForegroundColor DarkGray
Write-Host '  想消除警告：執行 trust-cert.bat 後重開瀏覽器。' -ForegroundColor DarkGray
Write-Host '  按 Ctrl+C 關閉伺服器。'
Write-Host ''

if (-not $NoBrowser) { Start-Process $url }

$mimeMap = @{
    '.html' = 'text/html; charset=utf-8'
    '.htm'  = 'text/html; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.js'   = 'text/javascript; charset=utf-8'
    '.mjs'  = 'text/javascript; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.svg'  = 'image/svg+xml'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.gif'  = 'image/gif'
    '.ico'  = 'image/x-icon'
    '.woff' = 'font/woff'
    '.woff2'= 'font/woff2'
    '.txt'  = 'text/plain; charset=utf-8'
}

function Send-Response {
    param($Ssl, [int]$Status, [string]$StatusText, [string]$ContentType, [byte[]]$Body, [string]$Method)
    $head = "HTTP/1.1 $Status $StatusText`r`n" +
            "Content-Type: $ContentType`r`n" +
            "Content-Length: $($Body.Length)`r`n" +
            "Cache-Control: no-store`r`n" +
            "X-Content-Type-Options: nosniff`r`n" +
            "Connection: close`r`n`r`n"
    $headBytes = [Text.Encoding]::ASCII.GetBytes($head)
    $Ssl.Write($headBytes, 0, $headBytes.Length)
    if ($Method -ne 'HEAD' -and $Body.Length -gt 0) { $Ssl.Write($Body, 0, $Body.Length) }
    $Ssl.Flush()
}

while ($true) {
    $tcp = $null
    $ssl = $null
    try {
        $tcp = $listener.AcceptTcpClient()
        $tcp.NoDelay = $true
        $ssl = [System.Net.Security.SslStream]::new($tcp.GetStream(), $false)
        $ssl.AuthenticateAsServer($serverCert, $false, [System.Security.Authentication.SslProtocols]::Tls12, $false)

        $reader = [System.IO.StreamReader]::new($ssl, [System.Text.Encoding]::ASCII, $false, 8192, $true)
        $requestLine = $reader.ReadLine()
        if ([string]::IsNullOrWhiteSpace($requestLine)) { continue }
        while ($true) {
            $header = $reader.ReadLine()
            if ([string]::IsNullOrEmpty($header)) { break }
        }

        $parts = $requestLine.Split(' ')
        if ($parts.Length -lt 2) { continue }
        $method = $parts[0].ToUpperInvariant()
        $target = $parts[1]
        $queryAt = $target.IndexOf('?')
        if ($queryAt -ge 0) { $target = $target.Substring(0, $queryAt) }

        if ($method -ne 'GET' -and $method -ne 'HEAD') {
            Send-Response $ssl 405 'Method Not Allowed' 'text/plain; charset=utf-8' ([Text.Encoding]::UTF8.GetBytes('Method Not Allowed')) $method
            continue
        }

        $rel = [Uri]::UnescapeDataString($target)
        $rel = $rel.TrimStart('/')
        if ($rel -eq '') { $rel = 'index.html' }
        $full = [IO.Path]::GetFullPath((Join-Path $root $rel))
        if (-not $full.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
            Send-Response $ssl 403 'Forbidden' 'text/plain; charset=utf-8' ([Text.Encoding]::UTF8.GetBytes('Forbidden')) $method
            continue
        }
        if ([IO.Directory]::Exists($full)) { $full = Join-Path $full 'index.html' }

        if (-not [IO.File]::Exists($full)) {
            Send-Response $ssl 404 'Not Found' 'text/plain; charset=utf-8' ([Text.Encoding]::UTF8.GetBytes('Not Found')) $method
            continue
        }

        $ext = [IO.Path]::GetExtension($full).ToLowerInvariant()
        $mime = $mimeMap[$ext]
        if (-not $mime) { $mime = 'application/octet-stream' }
        $bytes = [IO.File]::ReadAllBytes($full)
        Send-Response $ssl 200 'OK' $mime $bytes $method
    } catch {
        # 瀏覽器探測或中途關閉連線時會到這裡，忽略即可
    } finally {
        if ($ssl) { try { $ssl.Dispose() } catch {} }
        if ($tcp) { try { $tcp.Close() } catch {} }
    }
}
