import { useState } from "react";
import { setOrderStage } from "../api/orders";
import { sampleSteps, type SampleProgress } from "../workflow";
import { ApiError } from "../api/http";
import a from "../pages/admin.module.css";

const fmt = (s?: string | null) =>
  s ? new Date(s).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

/** Giai đoạn đầu (Ordered): 3 xác nhận song song — Nhận đi gom · Đã lấy mẫu · Đã gom mẫu.
 * Mỗi xác nhận gọi setOrderStage(key). "Đã gom mẫu" cần "Đã lấy mẫu" trước (blocked). */
export default function SampleSteps({ token, orderId, progress, perms, onDone }: {
  token?: string; orderId: string; progress: SampleProgress; perms: string[]; onDone: () => void;
}) {
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const steps = sampleSteps(progress);

  async function confirm(key: string) {
    setBusy(key); setErr("");
    try { await setOrderStage(token, orderId, key); onDone(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "Lỗi xác nhận"); }
    finally { setBusy(""); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Xác nhận mẫu (làm song song, đủ 3 bước để sang “Nhận mẫu”):</div>
      {err && <div className={a.error}>{err}</div>}
      {steps.map((s) => {
        const canDo = perms.includes(s.perm);
        return (
          <div key={s.key} style={{
            display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
            padding: "8px 12px", borderRadius: 8,
            background: s.done ? "var(--success-soft)" : "var(--action-soft)",
          }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: s.done ? "var(--success-text)" : "var(--action-hover)" }}>
              {s.done ? "✓ " : ""}{s.label}
            </span>
            {s.done && (
              <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{s.by || "—"}{s.at ? ` · ${fmt(s.at)}` : ""}</span>
            )}
            {!s.done && canDo && (
              <button
                className={`${a.btn} ${a.btnPrimary}`}
                style={{ marginLeft: "auto" }}
                disabled={busy !== "" || s.blocked}
                title={s.blocked ? s.blockedReason : ""}
                onClick={() => confirm(s.key)}
              >
                {busy === s.key ? "Đang lưu…" : s.blocked ? `${s.label} · ${s.blockedReason}` : `✓ ${s.label}`}
              </button>
            )}
            {!s.done && !canDo && (
              <span style={{ fontSize: 12, color: "var(--text-faint)", marginLeft: "auto" }}>chờ {s.label.toLowerCase()}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
