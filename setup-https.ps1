# setup-https.ps1 — Cài HTTPS cho LabLink trên VPS (chạy 1 LẦN): Caddy reverse proxy + Let's Encrypt.
#
# Điều kiện trước khi chạy:
#   1. Tên miền đã có bản ghi A trỏ về IP VPS (kiểm tra: nslookup <ten-mien>).
#   2. Firewall của nhà cung cấp VPS (cấp cloud) đã mở inbound TCP 80 và 443.
#
# Script sẽ (trên VPS):
#   - Tải Caddy (bản chính thức, Windows amd64) về C:\caddy, sinh Caddyfile cho tên miền.
#   - Mở firewall Windows 80/443, xoá rule mở 8080 ra ngoài.
#   - Cho LabLink chỉ nghe localhost:8080 (thêm --urls vào service) → chỉ vào được qua Caddy.
#   - Tạo + chạy service "caddy" (tự lấy/gia hạn chứng chỉ, tự chuyển http → https).
#
# Ví dụ (PowerShell Administrator):
#   .\setup-https.ps1 -VpsHost 223.130.11.116 -User "223.130.11.116\Administrator" -Domain lablink.vn -Email ban@congty.vn

param(
  [Parameter(Mandatory = $true)][string]$VpsHost,
  [string]$User = "Administrator",
  [Parameter(Mandatory = $true)][string]$Domain,
  [Parameter(Mandatory = $true)][string]$Email   # Let's Encrypt gửi cảnh báo hết hạn về đây
)
$ErrorActionPreference = "Stop"
function Step($m) { Write-Host "== $m ==" -ForegroundColor Cyan }

# 0) DNS phải trỏ đúng về VPS, nếu không Let's Encrypt sẽ từ chối cấp chứng chỉ.
Step "0/4  Kiểm tra DNS $Domain"
try { $ips = @([System.Net.Dns]::GetHostAddresses($Domain) | ForEach-Object { $_.IPAddressToString }) } catch { $ips = @() }
if ($ips -notcontains $VpsHost) {
  Write-Host ("  {0} hiện trỏ về: {1}" -f $Domain, ($(if ($ips.Count) { $ips -join ', ' } else { '(chưa có bản ghi)' }))) -ForegroundColor Yellow
  throw "DNS chưa trỏ về $VpsHost. Tạo bản ghi A rồi chờ vài phút (kiểm tra: nslookup $Domain)."
}

Step "1/4  Kết nối VPS $VpsHost"
$sec = Read-Host "Mat khau Windows tren VPS ($VpsHost) cho tai khoan $User" -AsSecureString
$cred = New-Object System.Management.Automation.PSCredential($User, $sec)
$s = New-PSSession -ComputerName $VpsHost -Credential $cred -Authentication Negotiate

try {
  Step "2/4  Cài Caddy + cấu hình firewall + LabLink chỉ nghe localhost"
  $result = Invoke-Command -Session $s -ArgumentList $Domain, $Email {
    param($domain, $email)
    $ErrorActionPreference = "Stop"
    $dir = "C:\caddy"
    New-Item -ItemType Directory -Path $dir -Force | Out-Null

    # Tải Caddy bản chính thức nếu chưa có.
    if (-not (Test-Path "$dir\caddy.exe")) {
      [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
      Invoke-WebRequest -Uri "https://caddyserver.com/api/download?os=windows&arch=amd64" -OutFile "$dir\caddy.exe" -UseBasicParsing
    }

    # Caddyfile: reverse proxy tới LabLink + header bảo mật. Giới hạn body 25MB (app cho upload 20MB).
    $caddyfile = @"
{
    email $email
    log {
        output file C:/caddy/caddy.log
    }
}

$domain {
    encode gzip
    reverse_proxy localhost:8080
    request_body {
        max_size 25MB
    }
    header {
        Strict-Transport-Security "max-age=31536000"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "SAMEORIGIN"
        Referrer-Policy "strict-origin-when-cross-origin"
        -Server
    }
}
"@
    # ASCII (không BOM) để Caddy đọc chuẩn.
    Set-Content -Path "$dir\Caddyfile" -Value $caddyfile -Encoding ASCII
    & "$dir\caddy.exe" validate --config "$dir\Caddyfile" --adapter caddyfile 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Caddyfile không hợp lệ — chạy tay: C:\caddy\caddy.exe validate --config C:\caddy\Caddyfile" }

    # Cổng 80/443 phải trống cho Caddy (hay bị IIS chiếm sẵn).
    $caddyPids = @(Get-Process caddy -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
    $busy = @(Get-NetTCPConnection -LocalPort 80, 443 -State Listen -ErrorAction SilentlyContinue |
      Where-Object { $caddyPids -notcontains $_.OwningProcess })
    if ($busy.Count) {
      $owners = ($busy | ForEach-Object { "cổng $($_.LocalPort) ← PID $($_.OwningProcess)" }) -join "; "
      throw "Cổng 80/443 đang bị chiếm ($owners). Nếu là IIS: Stop-Service W3SVC; Set-Service W3SVC -StartupType Disabled — rồi chạy lại."
    }

    # Firewall Windows: mở 80/443, bỏ rule mở 8080 ra ngoài.
    if (-not (Get-NetFirewallRule -DisplayName "LabLink HTTP 80" -ErrorAction SilentlyContinue)) {
      New-NetFirewallRule -DisplayName "LabLink HTTP 80" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow | Out-Null
    }
    if (-not (Get-NetFirewallRule -DisplayName "LabLink HTTPS 443" -ErrorAction SilentlyContinue)) {
      New-NetFirewallRule -DisplayName "LabLink HTTPS 443" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow | Out-Null
    }
    Get-NetFirewallRule -DisplayName "LabLink 8080" -ErrorAction SilentlyContinue | Remove-NetFirewallRule

    # LabLink chỉ nghe localhost. Dùng tham số --urls trên service (ưu tiên cao nhất, không cần reboot —
    # service KHÔNG nhận biến môi trường Machine mới cho tới khi khởi động lại máy).
    $svc = Get-WmiObject Win32_Service -Filter "Name='LabLink'"
    if (-not $svc) { throw "Chưa có service LabLink — chạy deploy-vps.ps1 trước." }
    if ($svc.PathName -notmatch '^"?(?<exe>[^"]+?\.exe)"?') { throw "Không đọc được đường dẫn LabLink: $($svc.PathName)" }
    $exe = $Matches['exe']
    sc.exe config LabLink binPath= "$exe --urls http://localhost:8080" | Out-Null
    [Environment]::SetEnvironmentVariable("ASPNETCORE_URLS", "http://localhost:8080", "Machine")  # cho lần reboot sau
    Restart-Service LabLink -Force

    # Caddy chạy như Windows service.
    if (Get-Service caddy -ErrorAction SilentlyContinue) {
      Restart-Service caddy -Force
    } else {
      New-Service -Name caddy -DisplayName "Caddy (HTTPS cho LabLink)" -StartupType Automatic `
        -BinaryPathName "$dir\caddy.exe run --config $dir\Caddyfile --adapter caddyfile" | Out-Null
      Start-Service caddy
    }
    Start-Sleep -Seconds 3
    [pscustomobject]@{ LabLink = (Get-Service LabLink).Status; Caddy = (Get-Service caddy).Status }
  }
  Write-Host ("  LabLink: {0} · Caddy: {1}" -f $result.LabLink, $result.Caddy)

  # 3) Chờ Caddy lấy chứng chỉ rồi thử truy cập https (thường 10–60 giây).
  Step "3/4  Chờ cấp chứng chỉ + kiểm tra https://$Domain"
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $ok = $false
  for ($i = 1; $i -le 12 -and -not $ok; $i++) {
    Start-Sleep -Seconds 10
    try {
      $resp = Invoke-WebRequest "https://$Domain/" -UseBasicParsing -TimeoutSec 15
      if ($resp.StatusCode -eq 200) { $ok = $true }
    } catch { Write-Host "  lần $i/12 chưa được: $($_.Exception.Message)" }
  }

  Step "4/4  Kết quả"
  if ($ok) {
    Write-Host "Xong. Truy cập: https://$Domain" -ForegroundColor Green
    Write-Host "Cổng 8080 đã đóng ra ngoài — từ nay chỉ dùng https://$Domain."
  } else {
    Write-Host "Chưa truy cập được https://$Domain." -ForegroundColor Yellow
    Write-Host "Kiểm tra: (1) firewall cloud đã mở 80/443; (2) nslookup $Domain; (3) log Caddy trên VPS:"
    Write-Host "  Get-Content C:\caddy\caddy.log -Tail 30"
  }
}
finally {
  Remove-PSSession $s
}
