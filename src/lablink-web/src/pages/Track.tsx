import { useCallback, useEffect, useState } from "react";
import type { Session } from "../auth/session";
import { downloadResult, getOrder, listOrders, sendSample, type OrderDto, type OrderListItem } from "../api/orders";
import { ApiError } from "../api/http";
import Modal from "../components/Modal";
import SidPrint from "../components/SidPrint";
import a from "./admin.module.css";
import t from "./Track.module.css";

const vnd = new Intl.NumberFormat("vi-VN");

const STAGES = [
  { key: "", label: "Tất cả" },
  { key: "Ordered", label: "Chờ lấy mẫu" },
  { key: "Collected", label: "Đã soạn mẫu" },
  { key: "Sent", label: "Đã gửi" },
  { key: "Received", label: "Đã nhận" },
  { key: "Running", label: "Đang chạy" },
  { key: "Resulted", label: "Có kết quả" },
];
const STAGE_LABEL: Record<string, string> = Object.fromEntries(STAGES.map((s) => [s.key, s.label]));
const STAGE_CLS: Record<string, string> = {
  Ordered: t.stageOrdered, Collected: t.stageCollected, Sent: t.stageSent,
  Received: t.stageReceived, Running: t.stageRunning, Resulted: t.stageResulted,
};

export default function Track({ session }: { session: Session }) {
  const token = session.token;
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("");
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderDto | null>(null);
  const [printOrder, setPrintOrder] = useState<OrderDto | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const canSend = session.permissions.includes("sample.send");

  const reload = useCallback(() => {
    setLoading(true);
    listOrders(token, query || undefined, stage || undefined)
      .then(setOrders)
      .finally(() => setLoading(false));
  }, [token, query, stage]);

  useEffect(() => {
    const h = setTimeout(reload, 200);
    return () => clearTimeout(h);
  }, [reload]);

  function toggle(id: string) {
    if (openId === id) {
      setOpenId(null);
      setDetail(null);
      return;
    }
    setOpenId(id);
    setDetail(null);
    getOrder(token, id).then(setDetail).catch(() => {});
  }

  return (
    <div>
      <div className={a.head}>
        <div className={a.h1}>Theo dõi &amp; kết quả</div>
      </div>

      <div className={t.filters}>
        <input
          className={t.search}
          placeholder="Tìm mã phiếu / tên BN / mã BN / SID / xét nghiệm…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className={t.chips}>
          {STAGES.map((sg) => (
            <button
              key={sg.key}
              className={`${t.chip} ${stage === sg.key ? t.chipActive : ""}`}
              onClick={() => setStage(sg.key)}
            >
              {sg.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className={t.state}>Đang tải…</div>}
      {!loading && orders.length === 0 && <div className={t.state}>Chưa có phiếu nào.</div>}

      {orders.map((o) => (
        <div key={o.id} className={t.card}>
          <div className={t.cardHead} onClick={() => toggle(o.id)}>
            <span className={t.orderNo}>{o.orderNo}</span>
            <span className={`${t.badge} ${o.source === "Doctor" ? t.srcDoctor : t.srcRetail}`}>
              {o.source === "Doctor" ? "Bác sĩ" : "Khách lẻ"}
            </span>
            <span className={`${t.badge} ${STAGE_CLS[o.stage] ?? ""}`}>{STAGE_LABEL[o.stage] ?? o.stage}</span>
            <span className={t.patient}>
              {o.patientName} <span className={t.maBN}>{o.patientMaBN}</span>
            </span>
            <span className={t.total}>{vnd.format(o.total)} ₫</span>
          </div>

          {openId === o.id && (
            <div className={t.detail}>
              {!detail && <div className={t.state}>Đang tải chi tiết…</div>}
              {detail && (
                <div className={t.detailGrid}>
                  <div>
                    <div className={t.blockTitle}>Xét nghiệm ({detail.items.length})</div>
                    {detail.items.map((it) => (
                      <div key={it.id} className={t.itemRow}>
                        <span>{it.testName} {it.qty > 1 ? `×${it.qty}` : ""}</span>
                        <span style={{ whiteSpace: "nowrap", color: "var(--text-muted)" }}>
                          {vnd.format(it.unitPrice)} ₫
                        </span>
                      </div>
                    ))}
                    {detail.diagnosis && (
                      <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--text-muted)" }}>
                        Chẩn đoán: {detail.diagnosis}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className={t.blockTitle}>Mã SID ({detail.samples.length})</div>
                    <div className={t.sids}>
                      {detail.samples.map((sm) => (
                        <span key={sm.id} className={t.sidChip}>{sm.sid} · {sm.sampleType}</span>
                      ))}
                    </div>
                    {detail.samples.length > 0 && (
                      <button
                        className={`${a.btn}`}
                        style={{ marginTop: 10, borderColor: "var(--sid-border)", color: "var(--sid)" }}
                        onClick={() => setPrintOrder(detail)}
                      >
                        ⎙ In SID
                      </button>
                    )}
                    {canSend && detail.source === "Doctor" && detail.stage === "Collected" && (
                      <div style={{ marginTop: 12 }}>
                        <div className={t.blockTitle}>Gửi mẫu tới PXN</div>
                        <button className={`${a.btn} ${a.btnPrimary}`} onClick={() => setSendOpen(true)}>
                          ➤ Gửi mẫu
                        </button>
                      </div>
                    )}
                    {detail.progress?.sendVia && (
                      <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--text-muted)" }}>
                        Đã gửi: {detail.progress.sendVia}
                        {detail.progress.trackingNo ? ` · VĐ ${detail.progress.trackingNo}` : ""}
                      </div>
                    )}
                    {detail.hasResult && (
                      <div style={{ marginTop: 12 }}>
                        <div className={t.blockTitle}>Kết quả</div>
                        <button
                          className={`${a.btn} ${a.btnPrimary}`}
                          onClick={() => downloadResult(token, detail.id, detail.resultFileName ?? undefined)}
                        >
                          ⭳ Tải kết quả ({detail.resultFileName})
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {printOrder && <SidPrint order={printOrder} onClose={() => setPrintOrder(null)} />}

      {sendOpen && detail && (
        <SendSampleModal
          token={token}
          orderId={detail.id}
          onClose={() => setSendOpen(false)}
          onDone={(updated) => {
            setSendOpen(false);
            setDetail(updated);
            reload();
          }}
        />
      )}
    </div>
  );
}

function SendSampleModal({
  token, orderId, onClose, onDone,
}: {
  token?: string;
  orderId: string;
  onClose: () => void;
  onDone: (o: OrderDto) => void;
}) {
  const [sendVia, setSendVia] = useState("Direct");
  const [trackingNo, setTrackingNo] = useState("");
  const [shipper, setShipper] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const o = await sendSample(token, orderId, {
        sendVia,
        trackingNo: trackingNo || undefined,
        shipper: shipper || undefined,
      });
      onDone(o);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Lỗi gửi mẫu");
      setBusy(false);
    }
  }

  const needTracking = sendVia !== "Direct";
  return (
    <Modal
      title="Gửi mẫu tới phòng xét nghiệm"
      onClose={onClose}
      footer={
        <>
          <button className={a.btn} onClick={onClose}>Huỷ</button>
          <button className={`${a.btn} ${a.btnPrimary}`} onClick={submit} disabled={busy}>
            {busy ? "Đang gửi…" : "Xác nhận gửi"}
          </button>
        </>
      }
    >
      {error && <div className={a.error}>{error}</div>}
      <div className={a.field}>
        <label className={a.label}>Hình thức gửi</label>
        <select className={a.input} value={sendVia} onChange={(e) => setSendVia(e.target.value)}>
          <option value="Direct">Trực tiếp</option>
          <option value="Bus">Nhà xe</option>
          <option value="Grab">Grab</option>
        </select>
      </div>
      <div className={a.field}>
        <label className={a.label}>Mã vận đơn {needTracking ? "" : "(nếu có)"}</label>
        <input className={a.input} value={trackingNo} onChange={(e) => setTrackingNo(e.target.value)} />
      </div>
      <div className={a.field}>
        <label className={a.label}>Người gửi / shipper (nếu có)</label>
        <input className={a.input} value={shipper} onChange={(e) => setShipper(e.target.value)} />
      </div>
    </Modal>
  );
}
