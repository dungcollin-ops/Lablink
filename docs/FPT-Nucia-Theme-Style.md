# Bộ giao diện FPT.Nucia — tài liệu dùng lại

> Trích từ mã nguồn thật ngày **04-09-2026**, nguồn `FPT.Nucia_GiaDinh/web/src`:
> `styles/tokens.css` · `styles/base.css` · `styles/themes.css` · `shared/ui/ui.css`.
>
> Đây là **bộ giao diện của phần mềm y tế**, nên vài quy tắc dưới đây không phải
> sở thích mà là ràng buộc an toàn. Chỗ nào như vậy đều có dấu ⛔ và ghi lý do —
> mang sang ứng dụng khác thì đọc lý do trước rồi hãy quyết giữ hay bỏ.

---

## 0. Ba nguyên tắc quyết định mọi thứ còn lại

**① Màu chia làm hai loại, không trộn.**

| Loại | Gồm | Đổi theo chủ đề? |
|---|---|---|
| **Thương hiệu** | `--brand-*`, `--accent-*`, `--side-*`, `--topbar-*` | **có** |
| **Ý nghĩa** | `--ok` · `--warn` · `--danger` (và 3 nền) | ⛔ **không bao giờ** |

> ⛔ Một chủ đề tím mà đổi luôn `--danger` thành tím thì cảnh báo lẫn vào trang
> trí — người đọc mất đúng cái phản xạ mà màu đỏ sinh ra để tạo.
>
> Ứng dụng không phải y tế vẫn nên giữ ranh giới này: «đỏ = có vấn đề thật» là
> hợp đồng với người dùng, không phải một lựa chọn thẩm mỹ.

**② Không viết mã màu cứng trong CSS của từng màn hình.** Mọi màu đi qua biến.
Viết cứng thì đổi chủ đề là chỗ đó đứng im, lệch với phần còn lại.

**③ Tương phản đo, không ước lượng.** Mọi cặp màu chữ/nền trong bộ này đều đã đo
theo WCAG. Ngưỡng dùng: **4,5:1** cho chữ thường, và chữ nhỏ (≤12px) phải cao hơn.

---

## 1. Biến thiết kế (`tokens.css`)

Dán nguyên khối này vào `:root` của ứng dụng mới.

```css
:root {
  /* ── Thương hiệu ──────────────────────────────────────────────────── */
  --brand-900: #0c1d27;
  --brand-800: #0e4a66;
  --brand-700: #135c7d;   /* nút chính, thanh tiêu đề */
  --brand-600: #1b7fa8;   /* viền khi focus, nền pha của đầu thẻ */
  --brand-400: #29b6e8;   /* nhấn, biểu tượng đang chọn */
  --brand-100: #e7f1f6;   /* nền nhạt, nhãn info */
  --accent-500: #e08a1e;
  --accent-100: #fdf1e1;

  /* ── Nền & bề mặt ─────────────────────────────────────────────────── */
  --bg: #f4f7f9;
  --surface: #ffffff;
  --surface-alt: #f1f5f7;
  --border: #dde5ea;
  --divider: #edf2f5;

  /* ── Lưới ─────────────────────────────────────────────────────────── */
  --table-head: #e3ebf1;       /* nền hàng tiêu đề */
  --table-head-text: #3d5566;  /* 6,48:1 trên nền trên */
  --table-col: #eef3f6;        /* kẻ DỌC, nhạt hơn kẻ ngang */

  /* ── Chữ ──────────────────────────────────────────────────────────── */
  --text: #0f2733;         /* 12,82:1 trên --surface */
  --text-muted: #5e7381;
  --text-faint: #8296a2;

  /* ── ⛔ TRẠNG THÁI — KHÔNG ĐỔI THEO CHỦ ĐỀ ────────────────────────── */
  --ok: #17835a;      --ok-bg: #e4f4ec;
  --warn: #b8710f;    --warn-bg: #fdf1e1;
  --danger: #c0392b;  --danger-bg: #fbe9e7;

  /* ── Hình khối ────────────────────────────────────────────────────── */
  --radius-card: 12px;
  --radius-input: 8px;
  --radius-pill: 999px;

  --shadow-sm: 0 1px 2px rgba(15, 39, 51, 0.06);
  --shadow-md: 0 4px 16px rgba(15, 39, 51, 0.1);
  --shadow-lg: 0 12px 40px rgba(15, 39, 51, 0.16);

  /* ── Chữ nghĩa ────────────────────────────────────────────────────── */
  --font: 'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
    'Helvetica Neue', Arial, sans-serif;
  --font-mono: ui-monospace, 'Cascadia Mono', 'Segoe UI Mono', Consolas, monospace;

  /* ── Khoảng cách — thang 4px ──────────────────────────────────────── */
  --sp-1: 4px;   --sp-2: 8px;   --sp-3: 12px;  --sp-4: 16px;
  --sp-5: 20px;  --sp-6: 24px;  --sp-8: 32px;  --sp-10: 40px;

  /* ── Vùng chạm tối thiểu trên điện thoại ──────────────────────────── */
  --touch: 44px;

  /* ── Chừa cho thanh gạt dưới của iPhone ───────────────────────────── */
  /* ⚠ CHỪA MỘT PHẦN, KHÔNG CHỪA HẾT `env(safe-area-inset-bottom)`.
     Đo 30-08-2026 (env = 34px): chừa trọn thì dưới NHÃN còn trống 47px — hơn
     nửa thanh đáy là khoảng không, người dùng đọc ra là «menu bị đẩy lên».
     47px = 34px vùng an toàn + ~13px do nội dung căn giữa trong ô cao 60px.
     Trừ 14px là đóng gần hết phần thừa mà nhãn vẫn cách mép ~33px.
     `max(6px, …)` để máy KHÔNG có thanh gạt vẫn còn lề. */
  --tabbar-dem: max(6px, calc(env(safe-area-inset-bottom) - 14px));

  /* ── Khung ứng dụng ───────────────────────────────────────────────── */
  --side-bg: #0f3648;
  --side-text: #a9c5d2;
  --side-text-on: #eaf3f7;
  --side-icon: #8cafbf;
  --side-icon-on: var(--brand-400);
  --side-active-bg: rgba(41, 182, 232, 0.16);
  --side-border: #2b5468;
  --side-dim: #9cbecd;

  --topbar-bg: var(--brand-700);
  --topbar-sub: #b7dcec;

  --sidebar-w: 254px;
  --topbar-h: 60px;
  --tabbar-h: 60px;
}
```

### Vài trị số có lý do, đừng chỉnh bừa

| Biến | Lý do |
|---|---|
| `--sidebar-w: 254px` | nới +20% ngày 28-08-2026 vì nhãn menu dài bị cắt ở 212px. Đo lại nếu đổi cỡ chữ menu. |
| `--table-head-text` | KHÔNG dùng `--text-muted`: trên nền tiêu đề nó chỉ đạt **4,10:1**, dưới ngưỡng AA cho chữ 12px. Màu này đạt **6,48:1** mà vẫn nhẹ hơn chữ thân bài — tiêu đề không được hút mắt hơn chính dữ liệu. |
| `--table-col` nhạt hơn `--divider` | kẻ dọc đậm bằng kẻ ngang thì lưới thành ô ca-rô, mắt đọc theo ô thay vì theo **hàng**. |
| `--touch: 44px` | vùng chạm tối thiểu trên điện thoại. |
| ⛔ đừng lấy `--brand-900` làm nền sidebar | `#0c1d27` là nền của trang demo bao quanh khung máy ảo trong prototype, không phải màu ứng dụng. Dùng nhầm ra sidebar **đen** thay vì xanh. Sidebar thật là `#0f3648`. |

### Nhóm biến theo nghiệp vụ — mang sang thì cân nhắc

Bộ gốc còn sáu biến màu cho **ảnh đại diện bệnh nhân khi chưa có ảnh**. Chúng
không thuộc phần khung giao diện; ứng dụng khác thường bỏ đi hoặc thay bằng thứ
tương đương của mình.

```css
:root {
  --gender-male:      #1b7fa8;  --gender-male-bg:    #e7f1f6;
  --gender-female:    #c2478f;  --gender-female-bg:  #fbe9f3;
  --gender-unknown:   #8296a2;  --gender-unknown-bg: #f1f5f7;
}
```

> ⚠ Trong bộ gốc có ghi rõ: **không** dùng nhóm này cho trạng thái — trạng thái
> là `--ok` / `--warn` / `--danger`. Cùng một lý do với §0: màu mang ý nghĩa thì
> không được dùng để trang trí, và ngược lại.

---

## 2. Mười chủ đề (`themes.css`)

Mỗi chủ đề **chỉ khai 10 biến**; phần còn lại suy ra từ chúng. Thêm chủ đề thứ 11
= chép một khối 10 dòng. Đừng khai thêm biến — khai càng nhiều thì chủ đề càng dễ
lệch khỏi bộ gốc.

Đặt trên phần tử gốc: `<html data-chu-de="bien-sau">`.

| # | Mã | Tên | `--brand-700` | `--brand-400` | `--side-bg` |
|---|---|---|---|---|---|
| 1 | *(không có)* | Xanh y tế — mặc định | `#135c7d` | `#29b6e8` | `#0f3648` |
| 2 | `bien-sau` | Xanh biển sâu | `#14496f` | `#3f9bd6` | `#0d2c47` |
| 3 | `ngoc-luc` | Ngọc lục bảo | `#0f5c45` | `#2bb98a` | `#0b3a2c` |
| 4 | `cham` | Chàm | `#343a80` | `#7b83d8` | `#23264f` |
| 5 | `man` | Mận | `#6d2c60` | `#c273b1` | `#3f1c39` |
| 6 | `rung` | Rừng | `#365c2b` | `#79b463` | `#22381c` |
| 7 | `dat-nung` | Đất nung | `#813f27` | `#d4885f` | `#4a2618` |
| 8 | `thach-anh` | Thạch anh | `#832b4d` | `#d97ba0` | `#4b1a30` |
| 9 | `xam-da` | Xám đá | `#3f4b53` | `#8b9aa4` | `#262e34` |
| 10 | `dem-xanh` | Đêm xanh | `#1d3d61` | `#5a92cc` | `#142639` |

Khuôn một chủ đề:

```css
[data-chu-de='bien-sau'] {
  --brand-900: #071a2b;
  --brand-800: #10395c;
  --brand-700: #14496f;
  --brand-600: #1c6394;
  --brand-400: #3f9bd6;
  --brand-100: #e6eff7;
  --accent-500: #d98324;
  --accent-100: #fdf1e1;
  --side-bg:   #0d2c47;
  --side-border: #23516f;
}
```

> ⚠ **Chưa có chủ đề tối.** Nền tối cần lật cả `--bg`, `--surface`, `--text`,
> `--border`… và rà lại **164 màu đặt cứng** còn rải trong CSS của từng phân hệ
> (đo 2026-08-21). Làm nửa vời thì sẽ có màn hình chữ trắng trên nền trắng.

---

## 3. Nền tảng (`base.css`)

```css
*, *::before, *::after { box-sizing: border-box; }

html, body, #root { height: 100%; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  font-size: 15px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -webkit-text-size-adjust: 100%;   /* chặn iOS phóng chữ khi xoay ngang */
}

h1, h2, h3, h4, p, figure { margin: 0; }
```

### Lớp tiện ích

```css
.stack    { display: flex; flex-direction: column; gap: var(--sp-4); }
.row      { display: flex; align-items: center; gap: var(--sp-3); }
.row-wrap { display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap; }
.spacer   { flex: 1; }

.muted  { color: var(--text-muted); }
.faint  { color: var(--text-faint); }
.mono   { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.nowrap { white-space: nowrap; }

.h1    { font-size: 20px; font-weight: 650; letter-spacing: -0.01em; }
.h2    { font-size: 17px; font-weight: 620; }
.small { font-size: 13px; }
.tiny  { font-size: 12px; }

.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}
```

> `.mono` luôn kèm `tabular-nums`: số liệu xếp cột phải thẳng hàng, nếu không mắt
> không so được hai con số nằm trên nhau.

---

## 4. Component (`ui.css`)

### 4.1 Nút

```css
.btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: var(--sp-2);
  min-height: 38px; padding: 0 var(--sp-4);
  border: 1px solid transparent; border-radius: var(--radius-input);
  background: var(--surface);
  font-size: 14px; font-weight: 550;
  cursor: pointer; white-space: nowrap;
  transition: background .12s, border-color .12s, opacity .12s;
}
.btn:disabled { opacity: .5; cursor: not-allowed; }

.btn--primary { background: var(--brand-700); color: #fff; }
.btn--primary:not(:disabled):hover { background: var(--brand-800); }

.btn--default { border-color: var(--border); color: var(--text); }
.btn--default:not(:disabled):hover { background: var(--surface-alt); }

.btn--ghost  { background: transparent; color: var(--brand-700); }
.btn--ghost:not(:disabled):hover { background: var(--brand-100); }

.btn--danger { background: var(--danger); color: #fff; }

.btn--sm    { min-height: 32px; padding: 0 var(--sp-3); font-size: 13px; }
.btn--block { width: 100%; }
```

Bốn kiểu, không hơn: **primary** (một việc chính mỗi màn), **default**,
**ghost** (việc phụ), **danger** (thu hồi, xoá — luôn kèm bước xác nhận).

### 4.2 Ô nhập

```css
.input {
  width: 100%; min-height: 38px; padding: 0 var(--sp-3);
  border: 1px solid var(--border); border-radius: var(--radius-input);
  background: var(--surface);
}
.input:focus { border-color: var(--brand-600); }
.input[aria-invalid='true'] { border-color: var(--danger); }
.input:disabled { background: var(--surface-alt); color: var(--text-muted); }

/* ⚠ 16px trở lên thì Safari trên iPhone KHÔNG tự phóng to khi chạm ô nhập */
@media (max-width: 767px) {
  .input { min-height: var(--touch); font-size: 16px; }
}
```

Khối trường: `.field` › `.field__label` · `.field__hint` · `.field__error`.

### 4.3 Thẻ

```css
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-sm);
}

.card__head {
  display: flex; align-items: center; gap: var(--sp-3);
  padding: var(--sp-4) var(--sp-5);
  border-bottom: 1px solid var(--border);
  border-radius: var(--radius-card) var(--radius-card) 0 0;
  background: color-mix(in srgb, var(--brand-600) 12%, var(--surface));
}
.card__head .h2    { color: var(--brand-800); }
.card__head .muted { color: color-mix(in srgb, var(--text-muted) 70%, var(--text)); }

.card__body        { padding: var(--sp-5); }
.card__body--flush { padding: 0; }

.card__foot {
  display: flex; align-items: center; gap: var(--sp-3);
  padding: var(--sp-4) var(--sp-5);
  border-top: 1px solid var(--divider);
  background: var(--surface-alt);
  border-radius: 0 0 var(--radius-card) var(--radius-card);
}
```

Ba điểm đắt giá ở đây:

- **Đầu thẻ có NỀN, không chỉ một đường kẻ.** Màn hình nhiều thẻ liền nhau thì
  một đường kẻ mảnh không đủ tách nhóm — mắt đọc thành một dải chữ dài.
- ⛔ **Nền PHA từ `--brand-600`, không phải mã màu cứng** — để nó đi theo 10 chủ
  đề. 12% cho ra `rgb(228,240,245)`, tiêu đề đạt **8,2:1**.
- ⚠ **Phụ đề phải đậm lên theo nền.** Nền đậm thêm làm `--text-muted` tụt xuống
  **4,25:1** — dưới ngưỡng AA. Nền đậm cho dễ nhìn mà chữ trên nó khó đọc hơn thì
  đổi được cái này mất cái kia.
- ⚠ **Phải bo góc trên theo thẻ**: `.card` bo góc nhưng cố ý **không** cắt tràn
  (có chỗ cần nội dung nhô ra), nên nền đầu thẻ không tự bo.

### 4.4 Nhãn trạng thái

```css
.badge {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 2px 9px; border-radius: var(--radius-pill);
  font-size: 12px; font-weight: 560; line-height: 1.6; white-space: nowrap;
}
.badge--neutral { background: var(--surface-alt); color: var(--text-muted); }
.badge--info    { background: var(--brand-100);   color: var(--brand-800); }
.badge--ok      { background: var(--ok-bg);       color: var(--ok); }
.badge--warn    { background: var(--warn-bg);     color: var(--warn); }
.badge--danger  { background: var(--danger-bg);   color: var(--danger); }
```

### 4.5 Lưới

```css
.table-wrap { overflow-x: auto; }

.table { width: 100%; border-collapse: collapse; font-size: 14px; }

.table th {
  text-align: left;
  font-size: 12px; font-weight: 600;
  text-transform: uppercase; letter-spacing: .03em;
  color: var(--table-head-text);
  padding: var(--sp-3) var(--sp-4);
  border-bottom: 1px solid var(--border);
  border-right: 1px solid var(--border);
  background: var(--table-head);
  white-space: nowrap;
  position: sticky; top: 0; z-index: 1;
}

.table td {
  padding: var(--sp-3) var(--sp-4);
  border-bottom: 1px solid var(--divider);
  border-right: 1px solid var(--table-col);
  vertical-align: middle;
}

.table tbody tr:last-child td { border-bottom: none; }
.table tbody tr:hover { background: var(--surface-alt); }

/* ⚠ Cột CUỐI không kẻ phải: bảng đã có viền ngoài của `.card`, thêm một vạch
   nữa thành đường đôi. */
.table th:last-child, .table td:last-child { border-right: none; }
```

- Tiêu đề **dính đầu** (`position: sticky`) — lưới vài trăm dòng thì cuộn xuống
  vẫn biết đang đọc cột nào.
- **Kẻ dọc nhạt hơn kẻ ngang** — xem §1.
- Bảng rộng luôn bọc trong `.table-wrap` để **nó tự cuộn ngang**, không đẩy cả
  trang cuộn theo.

### 4.6 Hộp thoại

```css
.dialog {
  width: 100%; max-width: 520px; max-height: 90vh;
  display: flex; flex-direction: column;
  background: var(--surface);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}
.dialog__head {
  padding: var(--sp-5) var(--sp-5) var(--sp-4);
  flex: none;
  border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--brand-600) 12%, var(--surface));
}
.dialog__head .muted { color: color-mix(in srgb, var(--text-muted) 70%, var(--text)); }
.dialog__body {
  padding: 0 var(--sp-5) var(--sp-5);
  overflow-y: auto; flex: 1 1 auto; min-height: 0;
}
.dialog__foot {
  display: flex; gap: var(--sp-3); justify-content: flex-end;
  padding: var(--sp-4) var(--sp-5);
}
```

> `min-height: 0` trên `.dialog__body` là bắt buộc: phần tử flex mặc định
> `min-height: auto`, thiếu dòng này thì thân hộp **không cuộn** mà đẩy dài hộp
> thoại ra ngoài màn hình.

Còn có `.overlay` (nền mờ), `.state` (trạng thái rỗng/đang tải), `.spinner`,
`.toasts` — cùng khuôn, xem `ui.css` gốc nếu cần.

---

## 5. Cách mang sang ứng dụng khác

1. Chép ba khối CSS ở §1 §3 §4 thành `tokens.css` · `base.css` · `ui.css`.
2. Nạp theo **đúng thứ tự**: `tokens` → `themes` → `base` → `ui` → CSS từng màn.
3. Đổi `--brand-*` sang màu thương hiệu của anh. ⛔ **Giữ nguyên**
   `--ok/--warn/--danger` — xem §0.
4. Chọn chủ đề bằng `document.documentElement.dataset.chuDe = 'bien-sau'`.

### Font

`Be Vietnam Pro` cần nạp riêng (Google Fonts). Không có thì chuỗi dự phòng tự lùi
về `Segoe UI` / `-apple-system` — vẫn dùng được, chỉ khác dáng chữ.

### ⚠ Ba thứ KHÔNG có trong tệp này

- **Chế độ tối** — chưa làm, xem §2.
- **CSS của từng phân hệ** (`ksk.css`, `dot.css`, `danhmuc.css`…) — đó là bố cục
  riêng của nghiệp vụ bệnh viện, mang sang ứng dụng khác không dùng được.
- **164 màu đặt cứng** còn rải trong CSS phân hệ (đo 2026-08-21) — chúng không
  thuộc bộ này, và chính là lý do chưa làm được chế độ tối.

---

## 6. Kiểm nhanh sau khi mang sang

| Kiểm | Đạt khi |
|---|---|
| Đổi `data-chu-de` | thanh bên, nút chính, đầu thẻ **cùng đổi**; nhãn ok/warn/danger **đứng im** |
| Lưới nhiều dòng | cuộn xuống vẫn thấy hàng tiêu đề |
| Bảng nhiều cột | bảng tự cuộn ngang, **trang** không cuộn ngang |
| Mở hộp thoại nội dung dài | thân hộp cuộn, hộp không tràn khỏi màn hình |
| Chạm ô nhập trên iPhone | Safari **không** tự phóng to trang |
| Rà `grep -n "#[0-9a-f]\{6\}" <css của màn hình>` | không còn mã màu cứng |
