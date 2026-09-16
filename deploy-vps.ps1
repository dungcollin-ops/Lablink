# deploy-vps.ps1 — Build + release LabLink lên VPS Windows TỰ ĐỘNG (1 lệnh).
# Dùng PowerShell Remoting (WinRM). Xem phần "Chuẩn bị 1 lần" trong DEPLOY.md.
#
# Ví dụ:  .\deploy-vps.ps1 -VpsHost 123.45.67.89
#         .\deploy-vps.ps1 -VpsHost 123.45.67.89 -User Administrator -RemotePath C:\LabLink

param(
  [Parameter(Mandatory = $true)][string]$VpsHost,
  [string]$User = "Administrator",
  [string]$RemotePath = "C:\LabLink",
  [switch]$SkipBuild   # bỏ qua bước build nếu đã có sẵn .\publish
)
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
function Step($m) { Write-Host "== $m ==" -ForegroundColor Cyan }

# 1) Build
if (-not $SkipBuild) {
  Step "1/5  Build (SPA + API) -> .\publish"
  & "$root\build.ps1"
} else { Step "1/5  Bỏ qua build (dùng .\publish sẵn có)" }

# 2) Nén
Step "2/5  Nén publish.zip"
$zip = "$root\publish.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path "$root\publish\*" -DestinationPath $zip

# 3) Kết nối VPS — dùng Read-Host thay Get-Credential (Get-Credential prompt kiểu console
#    dễ nhập lệch mật khẩu → Access denied). Read-Host + PSCredential ổn định hơn.
Step "3/5  Kết nối VPS $VpsHost"
$sec = Read-Host "Mat khau Windows tren VPS ($VpsHost) cho tai khoan $User" -AsSecureString
$cred = New-Object System.Management.Automation.PSCredential($User, $sec)
$s = New-PSSession -ComputerName $VpsHost -Credential $cred -Authentication Negotiate

try {
  # 4) Dừng service + GIẾT tiến trình cũ (nhả cổng 8080, tránh bind lỗi) + copy bản mới
  Step "4/5  Dừng service + copy bản mới"
  Invoke-Command -Session $s {
    Stop-Service LabLink -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    # Stop-Service đôi khi không kết thúc tiến trình → kill để nhả cổng + bỏ khoá file khi giải nén đè.
    Get-Process LabLink.Api -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 2
  }
  Copy-Item -Path $zip -Destination "C:\LabLink-deploy.zip" -ToSession $s -Force

  # 5) Giải nén đè + tạo service nếu chưa có + khởi động
  Step "5/5  Cập nhật + khởi động service"
  $result = Invoke-Command -Session $s -ArgumentList $RemotePath {
    param($p)
    $exists = Get-Service LabLink -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Path $p -Force | Out-Null
    $zipPath = "C:\LabLink-deploy.zip"
    if (Get-Command Expand-Archive -ErrorAction SilentlyContinue) {
      Expand-Archive -Path $zipPath -DestinationPath $p -Force
    } else {
      # VPS chạy PowerShell < 5.0 (không có Expand-Archive) → giải nén bằng .NET, ghi đè
      Add-Type -AssemblyName System.IO.Compression.FileSystem
      $archive = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
      try {
        foreach ($entry in $archive.Entries) {
          if ([string]::IsNullOrEmpty($entry.Name)) { continue } # bỏ qua entry thư mục
          $dest = Join-Path $p ($entry.FullName -replace '/', '\')
          $destDir = Split-Path $dest -Parent
          if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
          [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $dest, $true)
        }
      } finally { $archive.Dispose() }
    }
    if (-not $exists) {
      New-Service -Name "LabLink" -BinaryPathName "$p\LabLink.Api.exe" -DisplayName "LabLink" -StartupType Automatic | Out-Null
    }
    # An toàn: đảm bảo không còn tiến trình cũ giữ cổng trước khi start.
    Get-Process LabLink.Api -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 1
    Start-Service LabLink
    Start-Sleep -Seconds 2
    [pscustomobject]@{
      Status   = (Get-Service LabLink).Status
      Build    = (Get-Item "$p\LabLink.Infrastructure.dll").LastWriteTime
      Created  = -not $exists
    }
  }
  Write-Host ""
  Write-Host "KẾT QUẢ:" -ForegroundColor Green
  Write-Host ("  Service : {0}" -f $result.Status)
  Write-Host ("  Bản build: {0}" -f $result.Build)
  if ($result.Created) { Write-Host "  (Đã tạo mới service LabLink)" -ForegroundColor Yellow }
  Write-Host ""
  Write-Host "Xong. Kiểm tra: http://$VpsHost:8080" -ForegroundColor Green
}
finally {
  Remove-PSSession $s
}
