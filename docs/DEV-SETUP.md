# LabLink — Làm việc đa thiết bị (nhiều máy)

Nguyên tắc: **code để trên Git (GitHub private)** — mỗi máy clone về; **database đã là Supabase cloud nên dùng chung tự động**; **secret (chuỗi kết nối) đặt riêng từng máy**, không commit.

```
      GitHub (code, private)                 Supabase (DB, dùng chung)
        ▲            ▲                          ▲            ▲
   pull │ push  pull │ push                     │            │
     Máy A         Máy B      ───── mọi máy nối cùng 1 DB ────┘
   (.NET+Node)   (.NET+Node)
```

## 1. Đưa code lên GitHub (làm 1 lần, trên máy hiện tại)

Repo git đã được khởi tạo + commit đầu tiên. Giờ tạo remote và đẩy lên:

1. Vào <https://github.com/new> → tạo repo **Private**, tên `LabLink` (đừng tick "Add README").
2. Trên máy này chạy (thay `<user>` bằng tài khoản GitHub):
```powershell
cd "C:\Project Claude\LabLink"
git remote add origin https://github.com/<user>/LabLink.git
git branch -M main
git push -u origin main
```
Lần push đầu sẽ mở trình duyệt đăng nhập GitHub (Git Credential Manager). Sau đó không cần đăng nhập lại.

> Không có tài khoản GitHub? Có thể dùng **GitLab** hoặc **Azure DevOps** tương tự — chỉ khác URL remote.

## 2. Cài trên MÁY MỚI (mỗi thiết bị làm 1 lần)

**Cài sẵn:** Git · **.NET 8 SDK** · **Node.js 18+**.

```powershell
# 1) Lấy code
git clone https://github.com/<user>/LabLink.git
cd LabLink

# 2) Đặt chuỗi kết nối Supabase (secret — không nằm trong git)
dotnet user-secrets set "ConnectionStrings:Default" "Host=aws-0-ap-northeast-1.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.sonchotlyhsihgobziph;Password=<PASSWORD>;SSL Mode=Require;Trust Server Certificate=true" --project "src/LabLink.Api"

# 3) Cài package frontend
npm --prefix src/lablink-web install
```

**Chạy dev (2 cửa sổ terminal):**
```powershell
# API
dotnet run --project src/LabLink.Api --urls http://localhost:5100

# Frontend
npm --prefix src/lablink-web run dev   # mở http://localhost:5173
```

> Vì DB là Supabase dùng chung, **dữ liệu giống nhau trên mọi máy** — không cần đồng bộ DB.
> Lấy `<PASSWORD>` từ Supabase (Settings → Database) hoặc từ máy cũ: `dotnet user-secrets list --project src/LabLink.Api`. Đừng gửi mật khẩu qua kênh công khai — dùng trình quản lý mật khẩu.

## 3. Quy trình hằng ngày (mọi máy)

```powershell
git pull            # lấy thay đổi mới nhất TRƯỚC khi làm
# ... code ...
git add -A
git commit -m "mô tả thay đổi"
git push            # đẩy lên để máy khác pull
```

- Luôn `git pull` đầu buổi để tránh xung đột.
- Nếu 2 máy sửa cùng file → git báo conflict khi pull; mở file sửa phần `<<<<<<<` rồi commit lại.
- Migration mới (đổi DB) khi push, máy khác `git pull` + chạy API là **tự apply** vào Supabase chung.

## 4. Những gì KHÔNG nằm trong git (mỗi máy tự có)

| Mục | Vì sao | Cách có trên máy mới |
|---|---|---|
| `bin/ obj/ node_modules/ dist/ publish/` | Tự sinh khi build | `dotnet build` / `npm install` |
| Chuỗi kết nối (mật khẩu DB) | Bí mật | `dotnet user-secrets set ...` (mục 2) |
| `wwwroot/*` (SPA build) | Tự sinh | `build.ps1` khi deploy |

## 5. Deploy vẫn như cũ
Từ **bất kỳ máy nào** đã clone: `.\deploy-vps.ps1 -VpsHost <IP>` (xem DEPLOY.md mục F). Không phụ thuộc máy nào.
