# build.ps1 — Đóng gói LabLink để deploy (chạy trên máy DEV có Node + .NET SDK)
# Kết quả: thư mục .\publish chứa API + SPA (đã gộp), copy nguyên sang VPS.
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
function Check($msg){ if ($LASTEXITCODE -ne 0){ throw "Lỗi ở bước: $msg (exit $LASTEXITCODE)" } }

Write-Host "== 1/4  Build giao diện (React) ==" -ForegroundColor Cyan
Push-Location "$root\src\lablink-web"
npm ci; Check "npm ci"
npm run build; Check "npm run build"
Pop-Location

Write-Host "== 2/4  Copy SPA build vào API\wwwroot ==" -ForegroundColor Cyan
$wwwroot = "$root\src\LabLink.Api\wwwroot"
if (Test-Path $wwwroot) { Remove-Item "$wwwroot\*" -Recurse -Force }
else { New-Item -ItemType Directory -Path $wwwroot | Out-Null }
Copy-Item "$root\src\lablink-web\dist\*" $wwwroot -Recurse

Write-Host "== 3/4  dotnet publish (Release) ==" -ForegroundColor Cyan
$out = "$root\publish"
if (Test-Path $out) { Remove-Item $out -Recurse -Force }
dotnet publish "$root\src\LabLink.Api\LabLink.Api.csproj" -c Release -o $out; Check "dotnet publish"

Write-Host "== 4/4  Xong ==" -ForegroundColor Green
Write-Host "Thư mục sẵn sàng deploy: $out"
Write-Host "Copy nguyên thư mục này sang VPS (theo DEPLOY.md)."
