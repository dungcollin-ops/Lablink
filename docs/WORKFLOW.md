# LabLink — Quy trình xử lý phiếu xét nghiệm (ĐÃ CHỐT)

> Bản đặc tả chính thức, chốt sau khi xác nhận với người dùng. Sơ đồ: `status-flow-2lanes.png`.
> Mọi thay đổi quy trình sau này phải cập nhật lại tài liệu này.

## 1. Vai trò tham gia
| Vai | Trách nhiệm trong luồng |
|---|---|
| **Khách lẻ** | Đặt xét nghiệm cho bản thân; theo dõi & tải kết quả |
| **Bác sĩ / Phòng khám (KH sỉ)** | Chỉ định, **tự soạn mẫu + tự gửi mẫu**; theo dõi & tải kết quả |
| **Phòng xét nghiệm (PXN)** | Với khách lẻ: **cử NV đến lấy mẫu**. Với mọi phiếu: nhận mẫu, QC, chạy, trả kết quả |

## 2. Hai luồng đầu vào

### 2A. Luồng KHÁCH LẺ
```
Khách đặt → [Chờ lấy mẫu] → PXN cử NV đến lấy → [Đã soạn mẫu]
          → NV mang mẫu về → (hợp lưu) → [Đã nhận] → [Đang chạy] → [Có kết quả]
```
- Khách **không tự gửi mẫu**. PXN chủ động **phân công NV đến tận nơi lấy**.

### 2B. Luồng BÁC SĨ / PHÒNG KHÁM
```
Bác sĩ chỉ định → [Đã soạn mẫu] → Phòng khám gửi mẫu → [Đã gửi]
              → chuyển tới PXN → (hợp lưu) → [Đã nhận] → [Đang chạy] → [Có kết quả]
```
- Phòng khám **tự soạn và tự gửi** (chọn hình thức gửi + mã vận đơn).

Hai luồng **hợp lưu tại `Đã nhận`**, sau đó đi chung tới `Có kết quả`.

## 3. Định nghĩa trạng thái & người chuyển

| Trạng thái | Enum | Ý nghĩa | Ai chuyển vào | Dữ liệu bắt buộc kèm |
|---|---|---|---|---|
| **Chờ lấy mẫu** | `Ordered` | Phiếu khách lẻ vừa đặt, chưa lấy mẫu | Hệ thống (khi khách đặt) | — |
| **Đã soạn mẫu** | `Collected` | Mẫu đã lấy/soạn, **SID đã sinh** | Bác sĩ (khi chỉ định) · PXN (khi phân công lấy mẫu cho khách lẻ) | NV lấy mẫu + giờ (khách lẻ) |
| **Đã gửi** | `Sent` | Phòng khám đã gửi mẫu đi PXN | **Phòng khám** | Hình thức gửi (Trực tiếp/Nhà xe/Grab) + mã vận đơn |
| **Đã nhận** | `Received` | PXN đã nhận mẫu + đánh giá QC | PXN | Người nhận + giờ + QC (Đạt/Không đạt) |
| **Đang chạy** | `Running` | Mẫu đang phân tích | PXN | — |
| **Có kết quả** | `Resulted` | Đã trả kết quả (có file) | **Tự động** khi PXN upload file KQ | File kết quả |

## 4. Quy tắc sinh SID (theo sơ đồ)
- **Bác sĩ (KH sỉ):** SID sinh **ngay khi chỉ định** (phiếu vào thẳng `Đã soạn mẫu`).
- **Khách lẻ:** SID sinh **khi PXN phân công lấy mẫu** (lúc `Chờ lấy mẫu → Đã soạn mẫu`), để in tem cho NV mang đi lấy.
- Quy tắc chung: **1 loại mẫu = 1 SID**; số bản in chỉ nhân số tem, không sinh SID mới. Mã `DDMMYY-####`.

## 5. QC & kết quả
- **QC mẫu** (Đạt/Không đạt) đánh giá ở bước `Đã nhận`. Mẫu **Không đạt** → cảnh báo, có thể yêu cầu lấy lại (chưa tự động hoá).
- **Trả kết quả:** PXN upload file → phiếu tự chuyển `Có kết quả` → bác sĩ/khách tải được. Mọi lần tải đều ghi log.

## 6. Phân quyền theo hành động (chốt)
| Hành động | Quyền | Nhóm |
|---|---|---|
| Đặt/chỉ định phiếu | `order.create` | Bác sĩ, Khách lẻ |
| **Phân công NV lấy mẫu** (khách lẻ) → `Đã soạn mẫu` + sinh SID | `sample.collect` | PXN |
| **Gửi mẫu** (phòng khám) → `Đã gửi` | `sample.send` | Bác sĩ (phiếu của mình) |
| Nhận mẫu + QC → `Đã nhận` | `sample.receive`, `sample.qc` | PXN |
| Chuyển `Đang chạy` | `sample.receive` | PXN |
| Trả kết quả → `Có kết quả` | `result.upload` | PXN |
| Tải kết quả | `result.read` | Bác sĩ/khách (phiếu của mình), PXN |

> Cần thêm 2 permission mới: **`sample.collect`** (PXN phân công/lấy mẫu) và **`sample.send`** (phòng khám gửi mẫu).

## 7. Quy tắc chuyển trạng thái
- Đi **tuần tự tiến**: các nút hành động chỉ hiện ở đúng bước trước đó
  (vd nút "Gửi mẫu" chỉ hiện khi phiếu đang `Đã soạn mẫu`).
- **PXN không kéo lùi và không đụng phần luồng của bên chỉ định.** Ở màn PXN, dãy chip trạng thái chỉ cho bấm **đúng bước kế tiếp** theo loại phiếu; các bước khác khoá (bước đã qua hiện 🔒, không quay lại được):
  - **Bác sĩ:** bên BS tự đẩy tới `Đã gửi`; PXN chỉ bấm từ `Đã nhận` trở đi (`Đã gửi → Đã nhận → Đang chạy`).
  - **Khách lẻ:** PXN lấy mẫu bằng nút *Phân công NV lấy mẫu* (`Chờ lấy mẫu → Đã soạn mẫu`, sinh SID), rồi `Đã soạn mẫu → Đã nhận → Đang chạy`. Khách lẻ **không** có bước `Đã gửi`.
  - `Có kết quả`: **tự động** khi PXN upload file kết quả — không bấm chip.
- Logic bước kế: `pxnNextStage(source, stage)` trong `LabOrders.tsx` (khoá phía giao diện). Nếu cần siết chặt tuyệt đối, thêm kiểm tra tương ứng ở API `SetOrderStage`.

---
## Chênh lệch so với code hiện tại (cần build để khớp quy trình đã chốt)
1. **Thiếu** hành động "Phân công NV lấy mẫu" cho PXN (khách lẻ) — kèm **dời việc sinh SID của khách lẻ** sang bước này.
2. **Thiếu** nút "Gửi mẫu" cho phòng khám (bác sĩ) → `Đã gửi`.
3. **Thêm 2 permission**: `sample.collect`, `sample.send`.
4. Hiện app sinh SID cho khách lẻ ngay khi đặt → cần đổi theo mục 4.
