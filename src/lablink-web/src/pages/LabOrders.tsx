import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "../auth/session";
import {
  assignCollect,
  downloadResult,
  getOrder,
  listOrders,
  setOrderStage,
  setSampleQuality,
  uploadResult,
  type OrderDto,
  type OrderListItem,
} from "../api/orders";
import { ApiError } from "../api/http";
import Modal from "../components/Modal";
import SidPrint from "../components/SidPrint";
import SampleSteps from "../components/SampleSteps";
import {
  PERM_FOR_STAGE, stageLabel,
  LIST_STAGES, LIST_QUICK, matchStage, matchQuick, isOverdue, type QuickFilter,
  hasMyWorkRole, isMyWork, orderCompare, SORT_OPTIONS, type SortMode,
} from "../workflow";
import a from "./admin.module.css";
import t from "./Track.module.css";

const vnd = new Intl.NumberFormat("vi-VN");
const fmtDT = (s?: string | null) => {
  if (!s) return "—";
  const d = new Date(s);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

// Thứ tự bước tuyến tính ở PXN (dùng cho pxnNextStage + tra nhãn nút bước kế).
const STAGES = [
  { key: "Ordered", label: "Chờ lấy mẫu" },
  { key: "Collected", label: "Đã lấy mẫu" },
  { key: "Gathered", label: "Đã gom mẫu" },
  { key: "Received", label: "Đã nhận mẫu" },
  { key: "Resulted", label: "Có kết quả" },
  { key: "HardCopySent", label: "Đã giao bản cứng" },
  { key: "HardCopyReceived", label: "Đã nhận bản cứng" },
];
const STAGE_CLS: Record<string, string> = {
  Ordered: t.stageOrdered, Collected: t.stageCollected, Gathered: t.stageSent,
  Received: t.stageReceived, Resulted: t.stageResulted,
  HardCopySent: t.stageRunning, HardCopyReceived: t.stageResulted,
};
const QC_LABEL: Record<string, string> = { Unset: "Chưa đánh giá", Pass: "Đạt", Fail: "Không đạt" };
const STAGE_ORDER = STAGES.map((s) => s.key);

// Luồng 7 bước đi tuyến tính: chỉ cho tiến đúng bước kế tiếp, không lùi.
// "Có kết quả" chỉ đạt được khi upload file → không cho bấm chip tới đó.
function pxnNextStage(current: string): string | null {
  const i = STAGE_ORDER.indexOf(current);
  if (i < 0 || i >= STAGE_ORDER.length - 1) return null;
  const next = STAGE_ORDER[i + 1];
  if (next === "Resulted") return null; // Received → Resulted: chỉ qua tải kết quả lên
  return next;
}

export default function LabOrders({ session }: { session: Session }) {
  const token = session.token;
  const perms = session.permissions as string[];
  const myRole = hasMyWorkRole(perms);
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState(myRole ? "MINE" : "");
  const [quick, setQuick] = useState<QuickFilter>("");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderDto | null>(null);
  const [printOrder, setPrintOrder] = useState<OrderDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reloadList = useCallback(() => {
    setLoading(true);
    // Lọc trạng thái / lọc nhanh / sắp xếp làm phía client (chip gộp + đếm quá hạn).
    listOrders(token, query || undefined)
      .then(setOrders)
      .finally(() => setLoading(false));
  }, [token, query]);

  useEffect(() => {
    const h = setTimeout(reloadList, 200);
    return () => clearTimeout(h);
  }, [reloadList]);

  function open(id: string) {
    if (openId === id) { setOpenId(null); setDetail(null); return; }
    setOpenId(id);
    setDetail(null);
    getOrder(token, id).then(setDetail).catch(() => {});
  }

  async function changeStage(id: string, st: string) {
    setBusy(true);
    try {
      const updated = await setOrderStage(token, id, st);
      setDetail(updated);
      reloadList();
    } finally { setBusy(false); }
  }
  async function qc(sampleId: string, quality: string) {
    setBusy(true);
    try {
      const updated = await setSampleQuality(token, sampleId, quality);
      setDetail(updated);
      reloadList(); // QC có thể đã tự chuyển "Đã nhận mẫu" → cập nhật badge dòng
    } finally { setBusy(false); }
  }
  async function onUpload(orderId: string, file: File) {
    setBusy(true);
    try {
      const updated = await uploadResult(token, orderId, file);
      setDetail(updated);
      reloadList();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "Lỗi tải file lên");
    } finally { setBusy(false); }
  }

  const canQc = perms.includes("sample.qc");
  const canPrintSid = perms.includes("sid.print"); // chỉ người lấy mẫu / KTV nhận mẫu mới thấy In SID
  const canUpload = perms.includes("result.upload");
  const canReadResult = perms.includes("result.read");

  const now = Date.now();
  const overdueCount = orders.filter((o) => isOverdue(o, now)).length;
  const myCount = myRole ? orders.filter((o) => isMyWork(perms, o)).length : 0;
  const shown = orders
    .filter((o) => (stage === "MINE" ? isMyWork(perms, o) : matchStage(stage, o)) && matchQuick(quick, o, now))
    .sort(orderCompare(sortMode));

  return (
    <div>
      <div className={a.head} style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <div className={a.h1}>Chỉ định &amp; trả kết quả</div>
        {!loading && <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{shown.length} phiếu</span>}
        <label style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-muted)" }}>
          Sắp theo
          <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)} style={{ fontSize: 12.5, padding: "3px 6px", borderRadius: 8, border: "1px solid var(--border-2)", background: "var(--surface-2)", color: "var(--text-body)" }}>
            {SORT_OPTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
      </div>

      <div className={t.filters}>
        <input
          className={t.search}
          placeholder="Tìm mã phiếu / tên BN / SID / xét nghiệm…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className={t.chips}>
          {myRole && (
            <button
              className={`${t.chip} ${stage === "MINE" ? t.chipActive : ""}`}
              onClick={() => setStage("MINE")}
              title="Phiếu đang chờ đúng việc của bạn"
            >
              🎯 Việc của tôi{myCount > 0 ? ` ${myCount}` : ""}
            </button>
          )}
          {LIST_STAGES.map((sg) => (
            <button key={sg.key} className={`${t.chip} ${stage === sg.key ? t.chipActive : ""}`} onClick={() => setStage(sg.key)}>
              {sg.label}
            </button>
          ))}
        </div>
        <div className={t.chips} style={{ marginTop: 6, alignItems: "center" }}>
          <span style={{ fontSize: 11.5, color: "var(--text-muted)", marginRight: 2 }}>Lọc nhanh:</span>
          {LIST_QUICK.map((q) => {
            const on = quick === q.key;
            const danger = q.key === "overdue" && overdueCount > 0;
            return (
              <button
                key={q.key}
                className={`${t.chip} ${on ? t.chipActive : ""}`}
                onClick={() => setQuick(on ? "" : q.key)}
                style={!on && danger ? { background: "var(--danger-bg)", borderColor: "var(--danger-border)", color: "var(--danger)" } : undefined}
              >
                {q.key === "overdue" ? "⚠️ " : ""}{q.label}{danger ? ` ${overdueCount}` : ""}
              </button>
            );
          })}
        </div>
      </div>

      {loading && <div className={t.state}>Đang tải…</div>}
      {!loading && orders.length === 0 && <div className={t.state}>Chưa có phiếu nào.</div>}
      {!loading && orders.length > 0 && shown.length === 0 && <div className={t.state}>Không có phiếu khớp bộ lọc.</div>}

      {shown.map((o) => {
        const ovd = isOverdue(o, now);
        return (
        <div key={o.id} className={t.card} style={ovd ? { background: "var(--danger-bg)", borderColor: "var(--danger-border)" } : undefined}>
          <div className={t.cardHead} onClick={() => open(o.id)} style={ovd ? { background: "var(--danger-bg)" } : undefined}>
            <span className={t.orderNo}>{o.orderNo}</span>
            <span className={`${t.badge} ${o.source === "Doctor" ? t.srcDoctor : t.srcRetail}`}>
              {o.source === "Doctor" ? "Bác sĩ" : "Khách lẻ"}
            </span>
            <span className={`${t.badge} ${STAGE_CLS[o.stage] ?? ""}`}>{stageLabel(o.stage, { collectAt: o.collectedAt, gatherAt: o.gatheredAt })}</span>
            <span className={t.patient}>
              {ovd && <span title="Quá hạn dự kiến KQ" style={{ marginRight: 4 }}>⚠️</span>}
              {o.patientName} <span className={t.maBN}>{o.patientMaBN} · {o.itemCount} XN</span>
            </span>
            <div style={{ marginLeft: "auto", textAlign: "right", fontSize: 11.5, lineHeight: 1.35, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
              {o.resultAt ? (
                <>Đã trả KQ<br /><b style={{ color: "var(--success-text)" }}>{fmtDT(o.resultAt)}</b></>
              ) : (o.expectedMinAt || o.expectedMaxAt) ? (
                <>Dự kiến KQ<br /><b style={{ color: ovd ? "var(--danger)" : "var(--action-hover)" }}>{fmtDT(o.expectedMinAt)} – {fmtDT(o.expectedMaxAt)}</b></>
              ) : (
                <>Chỉ định<br /><b style={{ color: "var(--text-body)" }}>{fmtDT(o.createdAt)}</b></>
              )}
            </div>
            <span className={t.total}>{vnd.format(o.total)} ₫</span>
          </div>

          {openId === o.id && (
            <div className={t.detail}>
              {!detail && <div className={t.state}>Đang tải chi tiết…</div>}
              {detail && (
                <>
                  {detail.source === "Retail" && detail.stage === "Ordered" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, padding: "10px 12px", background: "var(--action-soft)", borderRadius: "var(--radius-control)" }}>
                      <span style={{ fontSize: 13, color: "var(--action-hover)", fontWeight: 600 }}>
                        Khách lẻ — cần phân công nhân viên đến lấy mẫu
                      </span>
                      <button className={`${a.btn} ${a.btnPrimary}`} style={{ marginLeft: "auto" }} onClick={() => setAssignOpen(true)}>
                        Phân công NV lấy mẫu
                      </button>
                    </div>
                  )}
                  <div className={t.blockTitle}>Tiến trình mẫu</div>
                  {detail.stage === "Ordered" && detail.source === "Doctor" ? (
                    <SampleSteps
                      token={token}
                      orderId={detail.id}
                      progress={detail.progress}
                      perms={session.permissions}
                      onDone={() => { getOrder(token, detail.id).then(setDetail).catch(() => {}); reloadList(); }}
                    />
                  ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    <span className={`${t.badge} ${STAGE_CLS[detail.stage] ?? ""}`}>{stageLabel(detail.stage, { collectAt: detail.progress.collectAt, gatherAt: detail.progress.gatherAt })}</span>
                    {(() => {
                      const next = pxnNextStage(detail.stage);
                      if (!next) return <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>{detail.stage === "Received" ? "→ chờ tải kết quả lên" : "—"}</span>;
                      const label = STAGES.find((s) => s.key === next)?.label ?? next;
                      const canNext = (session.permissions as string[]).includes(PERM_FOR_STAGE[next] ?? "");
                      return canNext
                        ? <button className={`${a.btn} ${a.btnPrimary}`} disabled={busy} onClick={() => changeStage(o.id, next)}>✓ {label}</button>
                        : <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>Bước kế: {label} (bạn không có quyền)</span>;
                    })()}
                  </div>
                  )}

                  <div className={t.detailGrid}>
                    <div>
                      <div className={t.blockTitle}>Xét nghiệm ({detail.items.length})</div>
                      {detail.items.map((it) => (
                        <div key={it.id} className={t.itemRow}>
                          <span>{it.testName} {it.qty > 1 ? `×${it.qty}` : ""}</span>
                          <span style={{ whiteSpace: "nowrap", color: "var(--text-muted)" }}>{vnd.format(it.unitPrice)} ₫</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className={t.blockTitle}>Mẫu &amp; chất lượng ({detail.samples.length})</div>
                      {detail.samples.map((sm) => (
                        <div key={sm.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", flexWrap: "wrap" }}>
                          <span className={t.sidChip}>{sm.sid}</span>
                          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{sm.sampleType}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: sm.quality === "Pass" ? "var(--success-text)" : sm.quality === "Fail" ? "var(--danger)" : "var(--text-faint)" }}>
                            {QC_LABEL[sm.quality]}
                          </span>
                          {canQc && (
                            <span style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
                              <button className={`${a.btn} ${a.btnPrimary}`} disabled={busy} onClick={() => qc(sm.id, "Pass")}>Đạt</button>
                              <button className={`${a.btn} ${a.btnDanger}`} disabled={busy} onClick={() => qc(sm.id, "Fail")}>Không đạt</button>
                            </span>
                          )}
                        </div>
                      ))}
                      {canPrintSid && (
                        <button
                          className={a.btn}
                          style={{ marginTop: 10, borderColor: "var(--sid-border)", color: "var(--sid)" }}
                          onClick={() => setPrintOrder(detail)}
                        >
                          ⎙ In SID
                        </button>
                      )}
                    </div>
                  </div>

                  {(canUpload || (detail.hasResult && canReadResult)) && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border-2)" }}>
                      <div className={t.blockTitle}>Kết quả xét nghiệm</div>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="application/pdf,image/*"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) onUpload(o.id, f);
                          e.target.value = "";
                        }}
                      />
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        {canUpload && (
                          <button className={`${a.btn} ${a.btnPrimary}`} disabled={busy} onClick={() => fileRef.current?.click()}>
                            {detail.hasResult ? "Cập nhật kết quả" : "⭱ Tải kết quả lên"}
                          </button>
                        )}
                        {detail.hasResult && canReadResult && (
                          <button className={a.btn} onClick={() => downloadResult(token, o.id, detail.resultFileName ?? undefined)}>
                            ⭳ {detail.resultFileName}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        );
      })}

      {printOrder && <SidPrint order={printOrder} onClose={() => setPrintOrder(null)} />}

      {assignOpen && detail && (
        <AssignCollectModal
          token={token}
          orderId={detail.id}
          onClose={() => setAssignOpen(false)}
          onDone={(updated) => {
            setAssignOpen(false);
            setDetail(updated);
            reloadList();
          }}
        />
      )}
    </div>
  );
}

function AssignCollectModal({
  token, orderId, onClose, onDone,
}: {
  token?: string;
  orderId: string;
  onClose: () => void;
  onDone: (o: OrderDto) => void;
}) {
  const [collector, setCollector] = useState("");
  const [appointmentAt, setAppointmentAt] = useState("");
  const [place, setPlace] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!collector.trim()) { setError("Cần nhập NV lấy mẫu."); return; }
    setBusy(true);
    setError("");
    try {
      const o = await assignCollect(token, orderId, {
        collector: collector.trim(),
        appointmentAt: appointmentAt || undefined,
        place: place || undefined,
      });
      onDone(o);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Lỗi phân công");
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Phân công NV lấy mẫu"
      onClose={onClose}
      footer={
        <>
          <button className={a.btn} onClick={onClose}>Huỷ</button>
          <button className={`${a.btn} ${a.btnPrimary}`} onClick={submit} disabled={busy}>
            {busy ? "Đang lưu…" : "Phân công & sinh SID"}
          </button>
        </>
      }
    >
      {error && <div className={a.error}>{error}</div>}
      <div className={a.field}>
        <label className={a.label}>Nhân viên lấy mẫu *</label>
        <input className={a.input} value={collector} onChange={(e) => setCollector(e.target.value)} />
      </div>
      <div className={a.field}>
        <label className={a.label}>Giờ hẹn lấy mẫu</label>
        <input className={a.input} type="datetime-local" value={appointmentAt} onChange={(e) => setAppointmentAt(e.target.value)} />
      </div>
      <div className={a.field}>
        <label className={a.label}>Nơi lấy mẫu</label>
        <input className={a.input} value={place} onChange={(e) => setPlace(e.target.value)} />
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
        Khi phân công, hệ thống sẽ sinh SID để in tem cho NV mang đi lấy.
      </div>
    </Modal>
  );
}

