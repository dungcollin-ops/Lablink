# Chẩn đoán + khởi động lại LabLink trên VPS khi trang báo 502 (Caddy chạy nhưng app không trả lời).
#   .\diagnose-vps.ps1 -VpsHost 165.99.14.10 -User "165.99.14.10\Administrator"
# Chỉ đọc trạng thái; việc duy nhất có thay đổi: Start-Service LabLink nếu service đang dừng.
param(
  [Parameter(Mandatory = $true)][string]$VpsHost,
  [string]$User = "Administrator",
  [string]$RemotePath = "C:\LabLink"
)
$ErrorActionPreference = "Stop"
function Step($m) { Write-Host "== $m ==" -ForegroundColor Cyan }

$sec = Read-Host "Mat khau Windows tren VPS ($VpsHost) cho tai khoan $User" -AsSecureString
$cred = New-Object System.Management.Automation.PSCredential($User, $sec)
$s = New-PSSession -ComputerName $VpsHost -Credential $cred -Authentication Negotiate

try {
  Invoke-Command -Session $s -ArgumentList $RemotePath {
    param($p)
    $ErrorActionPreference = "Continue"
    function Step($m) { Write-Host "== $m ==" -ForegroundColor Cyan }
    function Probe {
      try { (Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:8080/" -TimeoutSec 10).StatusCode }
      catch { "LỖI: $($_.Exception.Message)" }
    }

    Step "1. Máy chủ"
    $os = Get-CimInstance Win32_OperatingSystem
    "Khởi động lần cuối : $($os.LastBootUpTime)"
    "RAM trống          : {0:N0} MB / {1:N0} MB" -f ($os.FreePhysicalMemory / 1KB), ($os.TotalVisibleMemorySize / 1KB)
    Get-PSDrive C | ForEach-Object { "Ổ C trống          : {0:N1} GB" -f ($_.Free / 1GB) }

    Step "2. Service LabLink"
    $svc = Get-CimInstance Win32_Service -Filter "Name='LabLink'"
    if (-not $svc) { "KHÔNG có service LabLink!" } else {
      "Trạng thái : $($svc.State)   Kiểu khởi động: $($svc.StartMode)"
      "Lệnh chạy  : $($svc.PathName)"
    }
    $proc = Get-Process LabLink.Api -ErrorAction SilentlyContinue
    "Tiến trình : " + $(if ($proc) { "đang chạy (PID $($proc.Id), RAM {0:N0} MB)" -f ($proc.WorkingSet64 / 1MB) } else { "không chạy" })
    "Cổng 8080  : " + $(if (Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue) { "đang lắng nghe" } else { "KHÔNG lắng nghe" })
    "Gọi thử    : $(Probe)"
    $build = Get-Item "$p\LabLink.Api.dll" -ErrorAction SilentlyContinue
    "Bản build  : " + $(if ($build) { $build.LastWriteTime } else { "không thấy $p\LabLink.Api.dll" })

    Step "3. Lỗi gần đây trong Event Log (48 giờ)"
    $since = (Get-Date).AddHours(-48)
    $ev = Get-WinEvent -FilterHashtable @{ LogName = 'Application'; Level = 1, 2; StartTime = $since } -ErrorAction SilentlyContinue |
      Where-Object { $_.ProviderName -match '\.NET Runtime|Application Error|LabLink|ASP\.NET' } | Select-Object -First 5
    $ev += Get-WinEvent -FilterHashtable @{ LogName = 'System'; ProviderName = 'Service Control Manager'; StartTime = $since } -ErrorAction SilentlyContinue |
      Where-Object { $_.Message -match 'LabLink' } | Select-Object -First 5
    if (-not $ev) { "(không có)" }
    foreach ($e in $ev) {
      Write-Host ("--- {0}  [{1}]" -f $e.TimeCreated, $e.ProviderName) -ForegroundColor Yellow
      ($e.Message -split "`n" | Select-Object -First 25) -join "`n"
    }

    if ($svc -and $svc.State -ne 'Running') {
      Step "4. Khởi động lại service"
      Get-Process LabLink.Api -ErrorAction SilentlyContinue | Stop-Process -Force
      Start-Service LabLink -ErrorAction SilentlyContinue
      Start-Sleep -Seconds 8
      "Trạng thái : $((Get-Service LabLink).Status)"
      "Gọi thử    : $(Probe)"

      if ((Get-Service LabLink).Status -ne 'Running') {
        Step "5. Service không lên được → chạy thử trực tiếp 20 giây để xem lỗi khởi động"
        $out = "$env:TEMP\lablink-start.log"
        $pr = Start-Process -FilePath "$p\LabLink.Api.exe" -ArgumentList "--urls", "http://localhost:8081" `
          -WorkingDirectory $p -RedirectStandardOutput $out -RedirectStandardError "$out.err" -PassThru -NoNewWindow
        Start-Sleep -Seconds 20
        if (-not $pr.HasExited) { $pr | Stop-Process -Force; "(Chạy trực tiếp KHÔNG crash — lỗi nằm ở cấu hình service)" }
        else { "Tiến trình thoát với mã $($pr.ExitCode)" }
        Get-Content $out, "$out.err" -ErrorAction SilentlyContinue | Select-Object -Last 40
      }
    }
  }
}
finally {
  Remove-PSSession $s
}
