import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "../auth/session";
import {
  assignCollect,
  downloadResult,
  getOrder,
  listOrders,
  setOrderProgress,
  setOrderStage,
  setSampleQuality,
  uploadResult,
  type OrderDto,
  type OrderListItem,
  type ProgressDto,
} from "../api/orders";
import { ApiError } from "../api/http";
import Modal from "../components/Modal";
import SidPrint from "../components/SidPrint";
import { PERM_FOR_STAGE } from "../workflow";
import a from "./admin.module.css";
import t from "./Track.module.css";

const vnd = new Intl.NumberFormat("vi-VN");

const STAGES = [
  { key: "Ordered", label: "Chờ lấy mẫu" },
  { key: "Collected", label: "Đã lấy mẫu" },
  { key: "Gathered", label: "Đã gom mẫu" },
  { key: "Received", label: "Đã nhận mẫu" },
  { key: "Resulted", label: "Có kết quả" },
  { key: "HardCopySent", label: "Đã giao bản cứng" },
  { key: "HardCopyReceived", label: "Đã nhận bản cứng" },
];
const STAGE_LABEL: Record<string, string> = Object.fromEntries(STAGES.map((s) => [s.key, s.label]));
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
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("");
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderDto | null>(null);
  const [printOrder, setPrintOrder] = useState<OrderDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState<ProgressDto>({});
  const [assignOpen, setAssignOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (detail) setProg(detail.progress ?? {}); }, [detail]);

  const reloadList = useCallback(() => {
    setLoading(true);
    listOrders(token, query || undefined, stage || undefined)
      .then(setOrders)
      .finally(() => setLoading(false));
  }, [token, query, stage]);

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
  async function saveProgress(orderId: string) {
    setBusy(true);
    try {
      const updated = await setOrderProgress(token, orderId, prog);
      setDetail(updated);
    } finally { setBusy(false); }
  }
  const setP = (k: keyof ProgressDto, v: string) => setProg((p) => ({ ...p, [k]: v || null }));

  return (
    <div>
      <div className={a.head}>
        <div className={a.h1}>Chỉ định &amp; trả kết quả</div>
      </div>

      <div className={t.filters}>
        <input
          className={t.search}
          placeholder="Tìm mã phiếu / tên BN / SID / xét nghiệm…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className={t.chips}>
          <button className={`${t.chip} ${stage === "" ? t.chipActive : ""}`} onClick={() => setStage("")}>Tất cả</button>
          {STAGES.map((sg) => (
            <button key={sg.key} className={`${t.chip} ${stage === sg.key ? t.chipActive : ""}`} onClick={() => setStage(sg.key)}>
              {sg.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className={t.state}>Đang tải…</div>}
      {!loading && orders.length === 0 && <div className={t.state}>Chưa có phiếu nào.</div>}

      {orders.map((o) => (
        <div key={o.id} className={t.card}>
          <div className={t.cardHead} onClick={() => open(o.id)}>
            <span className={t.orderNo}>{o.orderNo}</span>
            <span className={`${t.badge} ${o.source === "Doctor" ? t.srcDoctor : t.srcRetail}`}>
              {o.source === "Doctor" ? "Bác sĩ" : "Khách lẻ"}
            </span>
            <span className={`${t.badge} ${STAGE_CLS[o.stage] ?? ""}`}>{STAGE_LABEL[o.stage] ?? o.stage}</span>
            <span className={t.patient}>{o.patientName} <span className={t.maBN}>{o.patientMaBN}</span></span>
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
                  <div className={t.chips} style={{ marginBottom: 14 }}>
                    {(() => {
                      const next = pxnNextStage(detail.stage);
                      const canNext = next != null && (session.permissions as string[]).includes(PERM_FOR_STAGE[next] ?? "");
                      const curIdx = STAGE_ORDER.indexOf(detail.stage);
                      return STAGES.map((sg) => {
                        const isCurrent = detail.stage === sg.key;
                        const isNext = sg.key === next && canNext;
                        const passed = STAGE_ORDER.indexOf(sg.key) < curIdx;
                        return (
                          <button
                            key={sg.key}
                            disabled={busy || !isNext}
                            title={
                              isNext ? "Bấm để chuyển sang bước này"
                                : (sg.key === next && !canNext) ? "Bạn không có quyền cho bước này"
                                  : isCurrent ? "Trạng thái hiện tại"
                                    : passed ? "Bước đã đi qua — không quay lại"
                                      : "Chưa tới bước này"
                            }
                            className={`${t.chip} ${isCurrent ? t.chipActive : ""} ${isNext ? t.chipNext : ""}`}
                            onClick={() => isNext && changeStage(o.id, sg.key)}
                          >
                            {passed ? "🔒 " : ""}{sg.label}
                          </button>
                        );
                      });
                    })()}
                  </div>

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
                          <span style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
                            <button className={`${a.btn} ${a.btnPrimary}`} disabled={busy} onClick={() => qc(sm.id, "Pass")}>Đạt</button>
                            <button className={`${a.btn} ${a.btnDanger}`} disabled={busy} onClick={() => qc(sm.id, "Fail")}>Không đạt</button>
                          </span>
                        </div>
                      ))}
                      <button
                        className={a.btn}
                        style={{ marginTop: 10, borderColor: "var(--sid-border)", color: "var(--sid)" }}
                        onClick={() => setPrintOrder(detail)}
                      >
                        ⎙ In SID
                      </button>
                    </div>
                  </div>

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
                      <button className={`${a.btn} ${a.btnPrimary}`} disabled={busy} onClick={() => fileRef.current?.click()}>
                        {detail.hasResult ? "Cập nhật kết quả" : "⭱ Tải kết quả lên"}
                      </button>
                      {detail.hasResult && (
                        <button className={a.btn} onClick={() => downloadResult(token, o.id, detail.resultFileName ?? undefined)}>
                          ⭳ {detail.resultFileName}
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border-2)" }}>
                    <div className={t.blockTitle}>Tiến trình mẫu chi tiết</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 }}>
                      <Field label="Nơi lấy mẫu" v={prog.collectPlace} on={(x) => setP("collectPlace", x)} />
                      <Field label="Người lấy" v={prog.collectBy} on={(x) => setP("collectBy", x)} />
                      <Field label="Giờ lấy" type="datetime-local" v={dt(prog.collectAt)} on={(x) => setP("collectAt", x)} />
                      <FieldSelect label="Hình thức gửi" v={prog.sendVia} on={(x) => setP("sendVia", x)}
                        opts={[["", "—"], ["Direct", "Trực tiếp"], ["Bus", "Nhà xe"], ["Grab", "Grab"]]} />
                      <Field label="Mã vận đơn" v={prog.trackingNo} on={(x) => setP("trackingNo", x)} />
                      <Field label="Shipper" v={prog.shipper} on={(x) => setP("shipper", x)} />
                      <Field label="Giờ gửi" type="datetime-local" v={dt(prog.sendAt)} on={(x) => setP("sendAt", x)} />
                      <Field label="Nơi nhận" v={prog.receivePlace} on={(x) => setP("receivePlace", x)} />
                      <Field label="Người nhận" v={prog.receiveBy} on={(x) => setP("receiveBy", x)} />
                      <Field label="Giờ nhận" type="datetime-local" v={dt(prog.receiveAt)} on={(x) => setP("receiveAt", x)} />
                      <Field label="Dự kiến có KQ" type="datetime-local" v={dt(prog.expectedResultAt)} on={(x) => setP("expectedResultAt", x)} />
                    </div>
                    <button className={`${a.btn} ${a.btnPrimary}`} style={{ marginTop: 10 }} disabled={busy} onClick={() => saveProgress(o.id)}>
                      Lưu tiến trình
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      ))}

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

const dt = (v?: string | null) => (v ? v.slice(0, 16) : "");

function Field({ label, v, on, type }: { label: string; v?: string | null; on: (x: string) => void; type?: string }) {
  return (
    <div className={a.field} style={{ marginBottom: 0 }}>
      <label className={a.label}>{label}</label>
      <input className={a.input} type={type ?? "text"} value={v ?? ""} onChange={(e) => on(e.target.value)} />
    </div>
  );
}

function FieldSelect({ label, v, on, opts }: { label: string; v?: string | null; on: (x: string) => void; opts: [string, string][] }) {
  return (
    <div className={a.field} style={{ marginBottom: 0 }}>
      <label className={a.label}>{label}</label>
      <select className={a.input} value={v ?? ""} onChange={(e) => on(e.target.value)}>
        {opts.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
      </select>
    </div>
  );
}
