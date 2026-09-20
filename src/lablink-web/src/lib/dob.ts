// Ngày sinh — 1 ô, tự nhận dạng theo số chữ số:
//  · gõ ĐỦ 8 số ddmmyyyy → hiển thị dd/mm/yyyy, lưu ISO yyyy-MM-dd
//  · gõ 4 số yyyy         → chỉ năm, hiển thị & lưu "yyyy"
// Năm bắt buộc; ngày/tháng tùy chọn (BS/BN có thể không biết ngày/tháng).

/** Giá trị lưu (partial: "yyyy" | "yyyy-MM" | "yyyy-MM-dd") → chuỗi hiển thị. */
export const isoToVnDob = (iso?: string | null): string => {
  if (!iso) return "";
  if (/^\d{4}$/.test(iso)) return iso;              // chỉ năm
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const ym = /^(\d{4})-(\d{2})$/.exec(iso);         // năm-tháng (hiếm)
  if (ym) return `${ym[2]}/${ym[1]}`;
  return iso;
};

/** Chuỗi hiển thị → giá trị lưu; trả "" nếu chưa hợp lệ (thiếu năm hoặc sai). */
export const vnToIsoDob = (s: string): string => {
  const t = s.trim();
  if (/^\d{4}$/.test(t)) {                          // chỉ năm
    const y = +t;
    return y >= 1900 && y <= new Date().getFullYear() ? t : "";
  }
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);  // đủ dd/mm/yyyy
  if (!m) return "";
  const d = +m[1], mo = +m[2];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
};

/** Mask khi gõ: ≤4 số → giữ nguyên (đang gõ năm); >4 số → dd/mm/yyyy. */
export const maskDob = (raw: string): string => {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 4) return d;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4, 8)}`;
};
