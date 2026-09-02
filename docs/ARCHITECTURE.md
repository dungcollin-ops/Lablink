# LabLink — Kế hoạch kiến trúc

> Hệ thống đặt · chốt giá · duyệt xét nghiệm giữa **bác sĩ/phòng khám**, **khách lẻ** và **phòng xét nghiệm (lab)**.
> Tài liệu này là bản thiết kế kiến trúc cho việc chuyển prototype (`LabLink v7.html` + `README.md`) thành ứng dụng thật.

---

## 1. Đề xuất stack công nghệ

Bối cảnh quyết định: codebase hiện có là **.NET 8** (HealthDataSync — Dapper/SQL/Hangfire/RSA; ProjectMgmt — EF Core/Blazor/MailKit/BCrypt), triển khai on-premise Windows Server + IIS, dữ liệu y tế nhạy cảm cần RBAC + audit + sinh SID phía server.

| Layer | Công nghệ đề xuất | Lý do |
|---|---|---|
| **Backend** | ASP.NET Core 8 Web API | Khớp đội ngũ & hạ tầng .NET sẵn có, deploy IIS, mạnh cho RBAC/audit/tích hợp HL7-FHIR |
| **Frontend** | **React 18 + TypeScript + Vite** | README khuyến nghị; UI tương tác cao (autocomplete điều hướng bàn phím, quét QR camera, in tem barcode) hợp SPA hơn |
| **DB** | **PostgreSQL 16** | Open-source, miễn phí, không cap dung lượng; sinh SID atomic bằng `SEQUENCE` / advisory lock |
| **ORM** | EF Core 8 (Code First) + **Npgsql** | Domain nhiều entity + migration; đúng hướng CLAUDE.md. Dùng Dapper cho vài read-path nóng (tra danh mục ~800 mục) nếu cần |
| **Auth** | ASP.NET Identity + JWT (hoặc cookie), sẵn hook SSO/LDAP | Phân quyền theo permission, kiểm tra **cả ở server** |
| **Barcode** | JsBarcode / bwip-js (Code128) FE + ZPL/EPL hoặc PDF khổ tem cho máy in nhãn | Tem thật thay CSS-bars của prototype |
| **Background jobs** | Hangfire (đã có trong shop) | Nhắc kết quả, dọn file, đồng bộ LIS |
| **Email** | MailKit + SMTP nội bộ | Đồng bộ với ProjectMgmt |
| **File kết quả** | File store có kiểm soát truy cập + log tải | Dữ liệu y khoa |

### Vì sao React thay vì Blazor?
Blazor Server (tái dùng pattern ProjectMgmt, một ngôn ngữ) là lựa chọn hợp lệ. Nhưng LabLink có 3 điểm UI nặng client mà React xử lý gọn hơn: (1) autocomplete điều hướng bằng bàn phím ở màn chỉ định, (2) quét QR CCCD qua camera (`BarcodeDetector`), (3) render + in tem barcode hàng loạt. Blazor Server còn phụ thuộc kết nối SignalR liên tục — kém ổn khi in tem tại nhiều điểm lấy mẫu. **Nếu đội chưa có FE dev**, fallback Blazor vẫn khả thi — kiến trúc backend bên dưới không đổi.

---

## 2. Cấu trúc solution (Clean Architecture, theo phong cách HealthDataSync)

```
LabLink/
├── LabLink.sln
├── src/
│   ├── LabLink.Domain/          # Entities, Enums, ValueObjects, domain services thuần
│   │   ├── Entities/            # LabTest, Order, Sample, PriceDeal, Patient, User, Role...
│   │   ├── Enums/               # OrderStage, DealStatus, SampleQuality, OrderSource...
│   │   └── Services/            # SidGenerator, PricingCalculator, OrderStateMachine (đặc tả từ prototype)
│   ├── LabLink.Application/     # Use case, DTO, interface, validator (FluentValidation)
│   │   ├── Orders/  Deals/  Catalog/  Patients/  Results/  Admin/
│   │   └── Common/              # IUnitOfWork, ICurrentUser, IAuditLogger
│   ├── LabLink.Infrastructure/  # EF Core DbContext + Configurations + Migrations, repo, file store, barcode, email, Hangfire jobs
│   └── LabLink.Api/             # Controllers, auth middleware, permission policy, Program.cs
│       └── lablink-web/         # React + TS + Vite SPA (hoặc repo FE riêng)
├── tests/
│   ├── LabLink.Domain.Tests/    # Ưu tiên: SID, pricing, state machine, validate email
│   └── LabLink.Api.Tests/       # Integration test endpoint + phân quyền
└── docs/
    └── ARCHITECTURE.md          # (file này)
```

---

## 3. Domain model

### Danh mục & giá
```
LabTest        (Id, Code, Name, Group, SampleType, TubeType, ListPrice, TurnaroundHours, Provider, IsActive)
Clinic         (Id, Code, Name, ...)                       -- phòng khám / KH sỉ
PriceDealBatch (Id, ClinicId, ProposedById, Note, Status, CreatedAt)   -- 1 lần đề nghị gói giá
PriceDeal      (Id, BatchId, LabTestId, ProposedPrice, Status,
                EffectiveFrom, EffectiveTo, DecidedById, DecidedAt)     -- giá chốt theo cặp Clinic×Test, có hiệu lực
```

### Bệnh nhân & phiếu chỉ định
```
Patient    (Id, MaBN, FullName, Dob, Gender, Phone, Email, NationalId, Bhyt, Address, CreatedAt)
Order      (Id "O-<seq>", Source, Stage, ClinicId?, DoctorCode?, Diagnosis?, Note?,
            PatientId, PatientSnapshot(json), Total, CreatedAt)
OrderItem  (Id, OrderId, LabTestId, SampleType, Qty, UnitPrice)         -- UnitPrice = giá chốt hoặc niêm yết
Sample     (Id, OrderId, Sid, SampleType, TubeType, Quality,
            CollectedById?, CollectedAt?, SentVia?, TrackingNo?,
            ReceivedById?, ReceivedAt?, AssignedTechId?)                -- 1 loại mẫu = 1 Sample = 1 SID
TestResult (Id, OrderId, SampleId?, FilePath, Status, IssuedAt, VerifiedById?, VerifiedAt?)
```

### RBAC & audit (chưa có trong prototype — bắt buộc build)
```
User           (Id, EmployeeCode, FullName, Email, PasswordHash, Phone, Department, Status, LastLoginAt, CreatedAt)
Role           (Id, Code, Name, Description)
Permission     (Id, Key)                 -- "order.create", "deal.approve", "sid.print", "result.upload"...
UserRole       (UserId, RoleId)
RolePermission (RoleId, PermissionId)
UserScope      (UserId, ScopeType, ScopeId)   -- giới hạn dữ liệu theo phòng khám/lab
AuditLog       (Id, UserId, Action, ObjectType, ObjectId, Detail(json), At)
```

### Sinh mã tuần tự (atomic phía server — điểm mấu chốt)
```
SidSequence  (DateKey "DDMMYY", NextSeq)   -- khoá dòng khi cấp SID, chống trùng đa điểm in
MaBnSequence (MonthKey "MMYY", NextSeq)
```

### Enum
```
OrderSource   : Doctor | Retail
OrderStage    : Ordered | Collected | Sent | Received | Running | Resulted   -- luồng 6 bước
DealStatus    : Pending | Approved | Rejected
SampleQuality : Unset | Pass | Fail
SentVia       : Direct | Bus | Grab
UserStatus    : Active | Suspended | Left
```

---

## 4. Business logic (đặc tả rút từ prototype — chuyển thành domain service)

| Logic | Đặc tả |
|---|---|
| **Sinh SID** | `DDMMYY-####` (4 chữ số, pad 0). 1 loại mẫu = 1 SID. **Số bản in chỉ nhân số tem, KHÔNG sinh SID mới.** Sinh phía server, atomic qua PostgreSQL `SEQUENCE` (reset theo ngày) hoặc `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` trên `SidSequence`, chống trùng khi nhiều điểm in song song. |
| **Sinh MaBN** | `MMYY####`, tự cấp khi bác sĩ không nhập. |
| **Gom mẫu** | `buildSamples`: gom các item cùng `SampleType` thành 1 Sample duy nhất (kèm loại ống). |
| **Tính tiền** | mỗi dòng `Qty × UnitPrice`; `UnitPrice` = giá deal đã chốt & còn hiệu lực cho (Clinic×Test) nếu có, ngược lại giá niêm yết. Tổng = Σ dòng. Hiển thị số VN (chấm phân nhóm nghìn, hậu tố ₫). |
| **State machine** | `Ordered → Collected → Sent → Received → Running → Resulted`. Chuyển trạng thái phải hợp lệ + ghi audit. |
| **Validate email** | chuẩn hoá (bỏ khoảng trắng + lower), regex `^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$`, **để trống = hợp lệ**. |
| **Validate khác** | bắt buộc Họ tên; ≥1 xét nghiệm; Qty ≥ 1; số bản in kẹp 1–99. |
| **Duyệt giá** | lab `Approve`/`Reject` từng dòng hoặc cả batch → giá chốt dùng khi tạo chỉ định; ghi audit. |

---

## 5. API endpoints (phác thảo theo view)

```
POST   /api/auth/login                       # JWT
GET    /api/me                               # user + permissions + scope

# Catalog (lab)
GET    /api/catalog?query=&group=            # tra ~800 mục
POST   /api/catalog/import                   # nhập Excel (592 mục Medic Hòa Hảo)
PUT    /api/catalog/{id}/price               # sửa giá niêm yết  [catalog.price.edit]

# Deals — bác sĩ đề nghị / lab duyệt
POST   /api/deals                            # bác sĩ gửi batch đề nghị       [deal.create]
GET    /api/deals?status=pending&clinicId=   # lab xem hàng chờ
POST   /api/deals/{id}/approve               # [deal.approve]
POST   /api/deals/{id}/reject                # [deal.approve]

# Patients
GET    /api/patients/search?q=               # tìm BN cũ (tên/năm sinh/giới/địa chỉ)
POST   /api/patients                         # tạo BN (cấp MaBN nếu trống)

# Orders
POST   /api/orders                           # doctor & retail; validate → sinh SID → tạo order  [order.create]
GET    /api/orders?stage=&q=                 # theo dõi (lọc theo scope)
GET    /api/orders/{id}
POST   /api/orders/{id}/samples/collect      # lấy/soạn mẫu (nơi/người/giờ)  [sample.collect]
POST   /api/orders/{id}/samples/send         # gửi mẫu (hình thức + mã vận đơn)
POST   /api/orders/{id}/samples/receive      # lab nhận + QC Đạt/Không đạt    [sample.receive, sample.qc]
POST   /api/orders/{id}/assign               # gán KTV
POST   /api/sid/print                        # sinh payload tem (SID + copies) [sid.print]

# Results
POST   /api/orders/{id}/result               # upload PDF                     [result.upload]
GET    /api/orders/{id}/result               # tải (ghi log)                  [result.read] + audit
POST   /api/orders/{id}/result/verify        # duyệt kết quả                  [result.verify]

# Admin
GET/POST/PUT  /api/admin/users               # [user.manage]
GET/POST/PUT  /api/admin/roles               # ma trận role×permission        [role.manage]
GET    /api/admin/audit                      # nhật ký                        [audit.read]
```

**Nguyên tắc:** mỗi endpoint gắn policy theo **permission key**, không hard-code theo role. Client chỉ ẩn/hiện UI; server luôn kiểm tra lại + lọc theo scope.

---

## 6. Phân quyền (RBAC) — role mặc định

| Role | Quyền chính |
|---|---|
| Quản trị hệ thống | toàn quyền + `user.manage`, `role.manage`, `audit.read` |
| Quản lý phòng khám | `deal.create/read`, `order.read` (toàn phòng khám), `report.read` |
| Bác sĩ chỉ định | `order.create/read` (của mình), `sid.print`, `result.read` |
| Điều dưỡng/lấy mẫu | `order.read`, `sample.collect`, `sid.print` |
| Khách lẻ | `order.create` (chính mình), `result.read` (của mình) |
| KTV xét nghiệm | `sample.receive/qc`, `result.upload`, `order.read` |
| Trưởng phòng XN | KTV + `deal.approve`, `catalog.price.edit`, `result.verify` |
| Kế toán | `order.read`, `invoice.*`, `report.read` (không xem kết quả y khoa) |

Bắt buộc audit: duyệt/từ chối giá · sửa giá niêm yết · in tem SID · tải & upload kết quả · thay đổi user/role. Quyền **xem kết quả tách riêng** khỏi quyền xem phiếu.

---

## 7. Lộ trình build (phase)

- **P0 — Nền tảng:** scaffold solution + SPA + design tokens FPT IS + CI. *(chạy được, màn Login chọn vai)*
- **P1 — Auth & RBAC:** Identity + JWT + permission policy + màn quản trị User/Role + audit log.
- **P2 — Catalog:** entity + import Excel 592 mục + màn tra cứu/giá niêm yết.
- **P3 — Deals:** bác sĩ đề nghị giá → lab duyệt; giá chốt theo Clinic×Test có hiệu lực.
- **P4 — Orders:** form hành chính + patient bank + QR CCCD + chọn xét nghiệm (autocomplete + combo) + **sinh SID server-side** + tính tiền.
- **P5 — Tracking & in tem:** theo dõi phiếu + khối in SID + tem Code128 thật (ZPL/PDF).
- **P6 — Lab workflow:** luồng 6 bước (lấy → gửi → nhận → QC → chạy → trả KQ) + upload/download kết quả có kiểm soát.
- **P7 — Report & tích hợp:** báo cáo, hoàn thiện audit, tích hợp LIS/HL7-FHIR (tùy chọn).

---

## 8. Rủi ro & lưu ý production

1. **SID sinh ở server** (atomic) — prototype đếm cục bộ sẽ trùng khi nhiều điểm in song song.
2. **In tem thật** — cần driver + khổ tem (50×25mm hoặc 38×25mm) + Code128 thật, không dùng CSS-bars.
3. **Auth & scope thật** — mỗi vai chỉ thấy dữ liệu trong phạm vi được gán; hỗ trợ SSO/LDAP + 2FA cho role quản trị.
4. **Giá chốt (deal)** lưu theo cặp Clinic×Test, có hiệu lực theo thời gian + lịch sử duyệt.
5. **Kết quả y khoa** — file có kiểm soát truy cập, log mọi lần xem/tải; sẵn sàng HL7/FHIR nếu nối LIS.
6. **Quét QR CCCD** cần HTTPS (hoặc localhost) + quyền camera; fallback dán tay.

---

## 9. Quyết định đã chốt (P0)

| Hạng mục | Quyết định |
|---|---|
| **Frontend** | ✅ React 18 + TypeScript + Vite |
| **Backend** | ✅ ASP.NET Core 8 Web API + EF Core 8 (Code First) |
| **DB dev** | ✅ **Supabase** (PostgreSQL cloud, free) — chỉ dữ liệu giả/test. Connection string trong user-secrets, KHÔNG commit. |
| **DB production** | ✅ **PostgreSQL self-hosted on-premise** — dữ liệu bệnh nhân thật nằm trong nhà (đúng spec). Đổi connection string, code không đổi. Provider: `Npgsql.EntityFrameworkCore.PostgreSQL`. |
| **Auth** | ✅ Mật khẩu nội bộ trước (Identity + JWT + BCrypt); chừa hook SSO/LDAP cho sau |
| **Vị trí** | ✅ `C:\Project Claude\LabLink` (thư mục dự án riêng) |

*(Chốt ngày 2026-08-12. SSO/LDAP + 2FA cho role quản trị để ở phase sau.)*
