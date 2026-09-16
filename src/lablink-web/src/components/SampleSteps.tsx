import { useState } from "react";
import { setOrderStage } from "../api/orders";
import { sampleSteps, type SampleProgress } from "../workflow";
import { ApiError } from "../api/http";
import t from "../pages/Track.module.css";

const fmt = (s?: string | null) =>
  s ? new Date(s).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

/** Giai đoạn đầu (Ordered): 3 xác nhận song song — Nhận đi gom · Đã lấy mẫu · Đã gom mẫu.
 * Hiển thị dạng chip (giống "Tiến trình mẫu"): đã xong = chip xanh + ✓; bước bấm được = chip nổi;
 * bị khoá/không quyền = chip mờ. "Đã gom mẫu" cần "Đã lấy mẫu" trước. */
export default function SampleSteps({ token, orderId, progress, perms, onDone }: {
  token?: string; orderId: string; progress: SampleProgress; perms: string[]; onDone: () => void;
}) {
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const steps = sampleSteps(progress);
  const doneList = steps.filter((s) => s.done);

  async function confirm(key: string) {
    setBusy(key); setErr("");
    try { await setOrderStage(token, orderId, key); onDone(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "Lỗi xác nhận"); }
    finally { setBusy(""); }
  }

  return (
    <div style={{ marginBottom: 14 }}>
      {err && <div style={{ color: "var(--danger)", fontSize: 12.5, marginBottom: 6 }}>{err}</div>}
      <div className={t.chips}>
        {steps.map((s) => {
          const canDo = s.done ? false : perms.includes(s.perm) && !s.blocked;
          const cls = s.done ? `${t.chip} ${t.chipActive}` : canDo ? `${t.chip} ${t.chipNext}` : t.chip;
          const title = s.done
            ? `${s.by || ""}${s.at ? " · " + fmt(s.at) : ""}`
            : s.blocked ? s.blockedReason
              : (!perms.includes(s.perm) ? "Bạn không có quyền bước này" : "Bấm để xác nhận");
          return (
            <button
              key={s.key}
              className={cls}
              disabled={!canDo || busy !== ""}
              title={title}
              onClick={() => canDo && confirm(s.key)}
            >
              {busy === s.key ? "Đang lưu…" : `${s.done ? "✓ " : ""}${s.label}${s.blocked && !s.done ? ` · ${s.blockedReason}` : ""}`}
            </button>
          );
        })}
      </div>
      {doneList.length > 0 && (
        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>
          {doneList.map((s) => `${s.label}: ${s.by || "—"}${s.at ? " · " + fmt(s.at) : ""}`).join("   ·   ")}
        </div>
      )}
    </div>
  );
}
