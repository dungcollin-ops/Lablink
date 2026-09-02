# P1 — Kết nối DB & chạy backend auth

## 1. Lấy connection string từ Supabase
Supabase Dashboard → **Project Settings → Database → Connection string** → tab **Npgsql**.
Dạng chuẩn Npgsql:

```
Host=<host>;Port=5432;Database=postgres;Username=<user>;Password=<PASSWORD>;SSL Mode=Require;Trust Server Certificate=true
```

> ⚠️ **QUAN TRỌNG (đã gặp thực tế):** host trực tiếp `db.<ref>.supabase.co` chỉ có **IPv6** và DNS
> phân giải chập chờn → API crash `SocketException 11004` khi khởi động. **Dùng Connection pooler (IPv4)**:
> Supabase → Connect → **Connection pooling → Session** → host dạng `aws-0-<region>.pooler.supabase.com`,
> **username `postgres.<ref>`** (lưu ý tiền tố `postgres.`).
>
> Cấu hình hiện dùng: `Host=aws-0-ap-northeast-1.pooler.supabase.com;Port=5432;Username=postgres.sonchotlyhsihgobziph;...`

## 2. Đặt connection string vào user-secrets (KHÔNG commit, không dán mật khẩu vào chat)

```bash
cd "C:/Project Claude/LabLink/src/LabLink.Api"
dotnet user-secrets set "ConnectionStrings:Default" "Host=...;Port=5432;Database=postgres;Username=...;Password=...;SSL Mode=Require;Trust Server Certificate=true"
```

## 3. Chạy API (tự động migrate + seed dữ liệu nền + 4 user demo)

```bash
cd "C:/Project Claude/LabLink"
dotnet run --project src/LabLink.Api
```

Lần đầu chạy sẽ: tạo bảng (users, roles, permissions, user_roles, role_permissions, audit_logs) →
seed 18 permission, 4 nhóm, và 4 tài khoản demo (mật khẩu `demo`).

## 4. Bật frontend gọi API thật
Sửa `src/lablink-web/.env.development`, bỏ comment và trỏ đúng cổng API (xem cổng trong log `dotnet run`):

```
VITE_API_BASE=http://localhost:<cổng-API>
```

Restart Vite → đăng nhập bằng `admin@lablink.local / demo` sẽ đi qua **API + JWT thật**.

## Tài khoản demo (chỉ dev/test)
| Email | Nhóm | Mật khẩu |
|---|---|---|
| bacsi@lablink.local | Bác sĩ chỉ định | demo |
| khachle@lablink.local | Khách lẻ | demo |
| lab@lablink.local | Trưởng phòng XN | demo |
| admin@lablink.local | Quản trị hệ thống | demo |
