# LabLink — Hướng dẫn deploy lên VPS Windows Server

> Cấu hình đã chốt: **Windows Server · chạy bare (Kestrel + Windows Service) · DB Supabase cloud**.
> App đóng gói thành **1 tiến trình** (`LabLink.Api.exe`) phục vụ **cả API lẫn giao diện** trên cùng một cổng — không cần IIS, không cần Node trên VPS.

```
[Trình duyệt] → http://<IP-VPS>:8080
                     │
              LabLink.Api.exe (Kestrel, Windows Service)
                ├─ /            → giao diện React (wwwroot)
                ├─ /api/*       → REST API
                └─ ──────────►  Supabase (PostgreSQL cloud)
```

---

## A. Trên máy DEV — đóng gói (1 lệnh)

Yêu cầu máy dev: **.NET 8 SDK** + **Node.js**.

```powershell
cd "C:\Project Claude\LabLink"
.\build.ps1
```

Script sẽ: build React → gộp vào `wwwroot` → `dotnet publish`. Kết quả nằm ở thư mục **`.\publish`** (đã có sẵn API + giao diện). Copy **nguyên thư mục này** sang VPS.

---

## B. Trên VPS Windows Server — cài đặt 1 lần

### B1. Cài .NET 8 Runtime (không cần SDK, không cần Node)
Tải **ASP.NET Core Runtime 8.x (Hosting Bundle)**: <https://dotnet.microsoft.com/download/dotnet/8.0>
→ chạy installer → xong. Kiểm tra:
```powershell
dotnet --list-runtimes    # phải thấy Microsoft.AspNetCore.App 8.x
```

### B2. Copy bản build
Copy thư mục `publish` từ máy dev sang VPS, ví dụ đặt tại **`C:\LabLink`**
(→ có `C:\LabLink\LabLink.Api.exe`).

### B3. Đặt biến môi trường (cấp Machine — để Windows Service đọc được)
Mở **PowerShell (Run as Administrator)**:

```powershell
# 1) Chuỗi kết nối Supabase (thay <PASSWORD> bằng mật khẩu DB — GIỮ NGUYÊN 1 DÒNG)
[Environment]::SetEnvironmentVariable("ConnectionStrings__Default", "Host=aws-0-ap-northeast-1.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.sonchotlyhsihgobziph;Password=<PASSWORD>;SSL Mode=Require;Trust Server Certificate=true", "Machine")

# 2) Khoá ký JWT — tạo ngẫu nhiên, 1 dòng (không cần sửa)
[Environment]::SetEnvironmentVariable("Jwt__SigningKey", [Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 })), "Machine")

# 3) Môi trường + cổng lắng nghe (0.0.0.0 để truy cập từ ngoài)
[Environment]::SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Production", "Machine")
[Environment]::SetEnvironmentVariable("ASPNETCORE_URLS", "http://0.0.0.0:8080", "Machine")
```

> **`<ref>`** = mã project (của bản demo là `sonchotlyhsihgobziph`) — thấy ở Supabase → Settings → General → Reference ID, hoặc chính là phần sau `postgres.` trong username.
>
> **Mẹo nhanh — khỏi ghép tay `<ref>`/`<PASSWORD>`:** chuỗi kết nối (đủ mật khẩu) đã có sẵn trong user-secrets ở **máy dev**. Đọc ra và copy y nguyên sang VPS:
> ```powershell
> # chạy trên MÁY DEV
> dotnet user-secrets list --project "C:\Project Claude\LabLink\src\LabLink.Api"
> # → copy phần sau "ConnectionStrings:Default = ..." dán vào lệnh (1) ở trên
> ```
> **Mật khẩu Supabase không hiện lại** sau khi tạo project. Nếu quên và không lấy được từ user-secrets → Supabase → **Settings → Database → Reset database password** (đổi xong phải cập nhật lại cả user-secrets ở dev lẫn biến trên VPS).
>
> Bí mật (mật khẩu DB, khoá JWT) nằm trong **biến môi trường Machine**, không nằm trong file cấu hình — an toàn hơn. ⚠️ Không dán chuỗi có mật khẩu ra nơi công khai.

### B4. Mở firewall cổng 8080
```powershell
New-NetFirewallRule -DisplayName "LabLink 8080" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow
```

### B5. Cài Windows Service
```powershell
New-Service -Name "LabLink" -BinaryPathName "C:\LabLink\LabLink.Api.exe" -DisplayName "LabLink" -StartupType Automatic ; Start-Service LabLink
```
> Nếu báo "service already exists": `sc.exe delete LabLink` rồi chạy lại dòng trên.
> Kiểm trước khi start: `Test-Path "C:\LabLink\LabLink.Api.exe"` = True, và đã đặt xong 4 biến ở B3.
> Nếu service tắt ngay: `Get-EventLog -LogName Application -Source LabLink -Newest 5 | Format-List`.

Lần đầu khởi động, app **tự tạo bảng (migration) + seed danh mục + 4 tài khoản demo** vào Supabase.

### B6. Kiểm tra
- Trên VPS: `Invoke-WebRequest http://localhost:8080/ -UseBasicParsing | Select StatusCode` → 200.
- Từ máy khác: mở trình duyệt vào **`http://<IP-VPS>:8080`** → hiện màn đăng nhập.
- Đăng nhập `admin@lablink.local` / `demo`.

---

## C. Bảo mật trước khi cho dùng thật

1. **Đổi mật khẩu** tất cả tài khoản demo (Quản trị người dùng → Đặt lại MK), hoặc tạo admin thật rồi khoá demo.
2. Muốn **không tạo user demo** ở lần deploy sau: đặt thêm biến
   `Seed__DemoUsers = false` (giữ `true` ở lần đầu để có admin đăng nhập).
3. **HTTPS** (khuyến nghị cho dữ liệu y tế + JWT):
   - Đặt **IIS** hoặc **Caddy/nginx** làm reverse proxy trước Kestrel (cổng 443, gắn chứng chỉ), **hoặc**
   - Cho Kestrel bind HTTPS bằng chứng chỉ `.pfx`:
     ```powershell
     [Environment]::SetEnvironmentVariable("ASPNETCORE_URLS","https://0.0.0.0:8443","Machine")
     [Environment]::SetEnvironmentVariable("ASPNETCORE_Kestrel__Certificates__Default__Path","C:\LabLink\cert.pfx","Machine")
     [Environment]::SetEnvironmentVariable("ASPNETCORE_Kestrel__Certificates__Default__Password","<pfx-pass>","Machine")
     ```
   - Nếu chỉ chạy nội bộ qua VPN, HTTP tạm chấp nhận cho bản dùng thử.
4. **Dữ liệu bệnh nhân thật**: KHÔNG đưa lên Supabase free (dữ liệu ra cloud + tự pause). Bản chạy thật nên dùng **Supabase trả phí** hoặc **PostgreSQL on-premise** (chỉ đổi `ConnectionStrings__Default`, code không đổi).

---

## D. Vận hành

**Cập nhật phiên bản mới:**
```powershell
Stop-Service LabLink
# copy đè thư mục publish mới vào C:\LabLink
Start-Service LabLink      # migration mới (nếu có) tự chạy khi khởi động
```

**Xem log:** Event Viewer → Windows Logs → Application (nguồn "LabLink"), hoặc thêm ghi log ra file nếu cần.

**Khởi động lại / dừng:**
```powershell
Restart-Service LabLink
Stop-Service LabLink
```

**Gỡ service:**
```powershell
Stop-Service LabLink
sc.exe delete LabLink
```

---

## E. Xử lý sự cố nhanh

| Triệu chứng | Nguyên nhân & cách xử lý |
|---|---|
| Service không start, log `Thiếu Jwt:SigningKey` | Chưa đặt `Jwt__SigningKey` (Machine). Đặt lại rồi `Restart-Service`. |
| Log `Thiếu ConnectionStrings:Default` | Chưa đặt `ConnectionStrings__Default` (Machine). |
| Log `tenant/user ... not found` hoặc `SocketException` | **Supabase free đang pause** → vào dashboard bấm Restore; hoặc sai host/user pooler. |
| Vào IP:8080 không lên | Chưa mở firewall (B4), hoặc `ASPNETCORE_URLS` chưa `0.0.0.0`, hoặc VPS chặn inbound ở cấp cloud (mở Security Group/Network). |
| Trang trắng, /api gọi lỗi CORS | Không xảy ra khi chạy cùng origin (kiến trúc này). Nếu tách domain riêng, thêm origin vào `Cors:Origins`. |

> Sau khi đổi biến môi trường Machine, phải `Restart-Service LabLink` để nạp lại.

---

## F. Deploy TỰ ĐỘNG (1 lệnh) — `deploy-vps.ps1`

Thay vì copy tay mỗi lần, script `deploy-vps.ps1` làm hết từ máy dev: **build → nén → kết nối VPS (PowerShell Remoting) → dừng service → copy đè → khởi động lại → báo trạng thái**.

### Chuẩn bị 1 lần
**Trên VPS** (PowerShell Admin):
```powershell
Enable-PSRemoting -Force
New-NetFirewallRule -DisplayName "WinRM 5985" -Direction Inbound -Protocol TCP -LocalPort 5985 -Action Allow
```
**Trên máy DEV** (nếu VPS không cùng domain — thay IP VPS):
```powershell
Set-Item WSMan:\localhost\Client\TrustedHosts -Value "223.130.11.116" -Force
```
Và đảm bảo đã đặt **biến môi trường bí mật** trên VPS 1 lần (mục B3: `ConnectionStrings__Default`, `Jwt__SigningKey`, `ASPNETCORE_ENVIRONMENT`, `ASPNETCORE_URLS`). Script **không** đụng tới secrets — chúng nằm sẵn trên VPS.

### Mỗi lần release
```powershell
cd "C:\Project Claude\LabLink"
.\deploy-vps.ps1 -VpsHost 223.130.11.116
```
- Nhập mật khẩu Windows của VPS khi được hỏi.
- Script tự dừng service → thay file → (tạo service nếu chưa có) → start → in **Status** + **ngày build** để xác nhận đã lên đúng bản.
- Bỏ qua build nếu đã có `.\publish`: thêm `-SkipBuild`.

> Ưu điểm: không còn copy tay, không lo quên Stop-Service. Bí mật vẫn ở VPS, không đi qua script.

### Nâng cao (nếu cần CI/CD thật)
Muốn **push git là tự deploy**: dùng **GitHub Actions** với một **self-hosted runner** cài trên VPS (runner tự có quyền chạy `Stop/Start-Service` + copy local), hoặc runner trên cloud + OpenSSH tới VPS. Khi cần dựng, báo để làm workflow `.github/workflows/deploy.yml` theo hướng này.
