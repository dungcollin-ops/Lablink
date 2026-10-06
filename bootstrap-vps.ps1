# bootstrap-vps.ps1 — Chuẩn bị VPS Windows MỚI để chạy LabLink (chạy 1 LẦN cho mỗi VPS mới).
#
# Trước khi chạy:
#   (a) Trên VPS, qua RDP, mở PowerShell Administrator:
#         Enable-PSRemoting -Force -SkipNetworkProfileCheck
#         Set-NetFirewallRule -DisplayName "Windows Remote Management (HTTP-In)" -RemoteAddress <IP-may-DEV>
#   (b) Trên máy DEV, PowerShell Administrator (1 lần):
#         Set-Item WSMan:\localhost\Client\TrustedHosts -Value "<IP-VPS>" -Concatenate -Force
#   (c) Firewall của nhà cung cấp VPS: cho phép 5985 (từ IP máy DEV) và 8080.
#
# Script sẽ (trên VPS):
#   - Cài ASP.NET Core 8 Hosting Bundle nếu chưa có (tải bản chính thức của Microsoft).
#   - Đặt biến môi trường Machine: ASPNETCORE_ENVIRONMENT, ASPNETCORE_URLS,
#     ConnectionStrings__Default (đọc từ user-secrets máy DEV), Jwt__SigningKey (sinh ngẫu nhiên,
#     giữ nguyên nếu đã có). Bí mật truyền qua phiên WinRM (mã hoá), KHÔNG in ra màn hình.
#   - Mở firewall Windows cổng 8080, tạo C:\LabLink-data (nơi lưu file kết quả).
#   - Khởi động lại VPS (service Windows chỉ nhận biến môi trường mới sau khi reboot).
#
# Ví dụ (PowerShell Administrator trên máy DEV):
#   .\bootstrap-vps.ps1 -VpsHost 103.178.235.143 -User "103.178.235.143\Administrator"

param(
  [Parameter(Mandatory = $true)][string]$VpsHost,
  [string]$User = "Administrator",
  [int]$Port = 8080,
  [switch]$NoReboot
)
$ErrorActionPreference = "Stop"
function Step($m) { Write-Host "== $m ==" -ForegroundColor Cyan }
$root = $PSScriptRoot

Step "1/5  Đọc connection string từ user-secrets (máy DEV)"
[xml]$proj = Get-Content "$root\src\LabLink.Api\LabLink.Api.csproj"
$sid = @($proj.Project.PropertyGroup | ForEach-Object { $_.UserSecretsId } | Where-Object { $_ })[0]
$secFile = Join-Path $env:APPDATA "Microsoft\UserSecrets\$sid\secrets.json"
if (-not (Test-Path $secFile)) { throw "Không thấy user-secrets: $secFile" }
$conn = (Get-Content $secFile -Raw | ConvertFrom-Json).'ConnectionStrings:Default'
if ([string]::IsNullOrWhiteSpace($conn)) { throw "user-secrets chưa có ConnectionStrings:Default" }

# Khoá JWT ngẫu nhiên 64 byte (base64) — chỉ dùng nếu VPS chưa có khoá.
$bytes = New-Object byte[] 64
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$jwtKey = [Convert]::ToBase64String($bytes)

Step "2/5  Kết nối VPS $VpsHost"
$sec = Read-Host "Mat khau Windows tren VPS ($VpsHost) cho tai khoan $User" -AsSecureString
$cred = New-Object System.Management.Automation.PSCredential($User, $sec)
$s = New-PSSession -ComputerName $VpsHost -Credential $cred -Authentication Negotiate

try {
  Step "3/5  ASP.NET Core 8 Hosting Bundle"
  $rt = Invoke-Command -Session $s {
    $ErrorActionPreference = "Stop"
    $runtimeDir = "C:\Program Files\dotnet\shared\Microsoft.AspNetCore.App\8.*"
    if (Test-Path $runtimeDir) { return "đã có sẵn" }
    $ProgressPreference = "SilentlyContinue"   # tải nhanh hơn nhiều trên PowerShell 5.1
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $exe = Join-Path $env:TEMP "dotnet-hosting-8-win.exe"
    Invoke-WebRequest -Uri "https://aka.ms/dotnet/8.0/dotnet-hosting-win.exe" -OutFile $exe -UseBasicParsing
    $p = Start-Process $exe -ArgumentList "/install", "/quiet", "/norestart" -Wait -PassThru
    if ($p.ExitCode -notin 0, 3010) { throw "Cài Hosting Bundle lỗi (exit $($p.ExitCode))." }
    if (-not (Test-Path $runtimeDir)) { throw "Cài xong nhưng không thấy runtime ASP.NET Core 8." }
    "vừa cài xong"
  }
  Write-Host "  ASP.NET Core 8: $rt"

  Step "4/5  Biến môi trường + firewall + thư mục dữ liệu"
  Invoke-Command -Session $s -ArgumentList $conn, $jwtKey, $Port {
    param($conn, $jwtKey, $port)
    $ErrorActionPreference = "Stop"
    [Environment]::SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Production", "Machine")
    [Environment]::SetEnvironmentVariable("ASPNETCORE_URLS", "http://0.0.0.0:$port", "Machine")
    [Environment]::SetEnvironmentVariable("ConnectionStrings__Default", $conn, "Machine")
    # Giữ khoá JWT nếu đã có → chạy lại script không làm mọi người bị đăng xuất.
    if (-not [Environment]::GetEnvironmentVariable("Jwt__SigningKey", "Machine")) {
      [Environment]::SetEnvironmentVariable("Jwt__SigningKey", $jwtKey, "Machine")
    }
    if (-not (Get-NetFirewallRule -DisplayName "LabLink $port" -ErrorAction SilentlyContinue)) {
      New-NetFirewallRule -DisplayName "LabLink $port" -Direction Inbound -Protocol TCP -LocalPort $port -Action Allow | Out-Null
    }
    New-Item -ItemType Directory -Path "C:\LabLink-data" -Force | Out-Null
  }
  Write-Host "  Đã đặt ASPNETCORE_ENVIRONMENT, ASPNETCORE_URLS, ConnectionStrings__Default, Jwt__SigningKey (không in giá trị)."
  Write-Host "  Đã mở firewall Windows cổng $Port, tạo C:\LabLink-data."

  Step "5/5  Khởi động lại VPS"
  if ($NoReboot) {
    Write-Host "  Bỏ qua reboot (-NoReboot). Nhớ restart VPS trước khi deploy." -ForegroundColor Yellow
  } else {
    try { Invoke-Command -Session $s { Restart-Computer -Force } } catch { }   # phiên bị ngắt khi máy tắt là bình thường
    Write-Host "  VPS đang khởi động lại — chờ khoảng 2 phút." -ForegroundColor Green
  }
}
finally {
  Remove-PSSession $s -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Tiếp theo (sau khi VPS lên lại):" -ForegroundColor Green
Write-Host "  .\deploy-vps.ps1 -VpsHost $VpsHost -User `"$User`" -SkipBuild"
