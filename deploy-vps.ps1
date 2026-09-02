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

# 3) Kết nối VPS
Step "3/5  Kết nối VPS $VpsHost (nhập mật khẩu Windows của VPS)"
$cred = Get-Credential -UserName $User -Message "Mật khẩu Windows trên VPS ($VpsHost)"
$s = New-PSSession -ComputerName $VpsHost -Credential $cred -Authentication Negotiate

try {
  # 4) Dừng service (nếu có) + copy bản mới sang VPS
  Step "4/5  Dừng service + copy bản mới"
  Invoke-Command -Session $s { Stop-Service LabLink -ErrorAction SilentlyContinue }
  Copy-Item -Path $zip -Destination "C:\LabLink-deploy.zip" -ToSession $s -Force

  # 5) Giải nén đè + tạo service nếu chưa có + khởi động
  Step "5/5  Cập nhật + khởi động service"
  $result = Invoke-Command -Session $s -ArgumentList $RemotePath {
    param($p)
    $exists = Get-Service LabLink -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Path $p -Force | Out-Null
    Expand-Archive -Path "C:\LabLink-deploy.zip" -DestinationPath $p -Force
    if (-not $exists) {
      New-Service -Name "LabLink" -BinaryPathName "$p\LabLink.Api.exe" -DisplayName "LabLink" -StartupType Automatic | Out-Null
    }
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
