import { useCallback, useEffect, useState } from "react";
import type { Session } from "../auth/session";
import { getOrder, listOrders, setOrderStage, type OrderDto, type OrderListItem } from "../api/orders";
import { ApiError } from "../api/http";
import { allowedNext, STAGE_ACTION } from "../workflow";
import SidPrint from "../components/SidPrint";
import ResultViewer from "../components/ResultViewer";
import OrderDetailModal from "../components/OrderDetailModal";
import a from "./admin.module.css";
import t from "./Track.module.css";

const vnd = new Intl.NumberFormat("vi-VN");

const STAGES = [
  { key: "", label: "Tất cả" },
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

export default function Track({ session }: { session: Session }) {
  const token = session.token;
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("");
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderDto | null>(null);
  const [printOrder, setPrintOrder] = useState<OrderDto | null>(null);
  const [viewResult, setViewResult] = useState<{ id: string; orderNo: string } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [advBy, setAdvBy] = useState("");
  const [advBusy, setAdvBusy] = useState(false);

  async function advance(id: string, nextStageKey: string) {
    setAdvBusy(true);
    try {
      const updated = await setOrderStage(token, id, nextStageKey, nextStageKey === "Collected" ? (advBy.trim() || undefined) : undefined);
      setDetail(updated);
      setAdvBy("");
      reload();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "Lỗi chuyển bước");
    } finally {
      setAdvBusy(false);
    }
  }

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
            {o.hasResult && (
              <button
                onClick={(e) => { e.stopPropagation(); setViewResult({ id: o.id, orderNo: o.orderNo }); }}
                title="Xem kết quả xét nghiệm"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "3px 10px", borderRadius: 999,
                  border: "1px solid var(--success-soft)", background: "var(--success-soft)",
                  color: "var(--success-text)", fontSize: 12, fontWeight: 600,
                  cursor: "pointer", whiteSpace: "nowrap",
                }}
              >
                👁 Kết quả
              </button>
            )}
            <span className={t.total}>{vnd.format(o.total)} ₫</span>
          </div>

          {openId === o.id && (
            <div className={t.detail}>
              {!detail && <div className={t.state}>Đang tải chi tiết…</div>}
              {detail && (
                <>
                <div style={{ marginBottom: 12 }}>
                  <button className={a.btn} onClick={() => setDetailId(detail.id)}>📋 Xem đầy đủ / Sửa phiếu</button>
                </div>
                {(() => {
                  const nx = allowedNext(detail.stage, session.permissions);
                  if (!nx) return null;
                  return (
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "10px 12px", background: "var(--action-soft)", borderRadius: "var(--radius-control)" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--action-hover)" }}>Bước kế của bạn:</span>
                      {nx.stage === "Collected" && (
                        <input className={a.input} style={{ maxWidth: 200 }} placeholder="Người lấy mẫu (tuỳ chọn)" value={advBy} onChange={(e) => setAdvBy(e.target.value)} />
                      )}
                      <button className={`${a.btn} ${a.btnPrimary}`} style={{ marginLeft: "auto" }} disabled={advBusy} onClick={() => advance(detail.id, nx.stage)}>
                        {advBusy ? "Đang lưu…" : `✓ ${STAGE_ACTION[nx.stage] ?? nx.stage}`}
                      </button>
                    </div>
                  );
                })()}
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
                          onClick={() => setViewResult({ id: detail.id, orderNo: detail.orderNo })}
                        >
                          👁 Xem kết quả ({detail.resultFileName})
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                </>
              )}
            </div>
          )}
        </div>
      ))}

      {printOrder && <SidPrint order={printOrder} onClose={() => setPrintOrder(null)} />}

      {viewResult && (
        <ResultViewer token={token} orderId={viewResult.id} orderNo={viewResult.orderNo} onClose={() => setViewResult(null)} />
      )}

      {detailId && (
        <OrderDetailModal
          token={token}
          orderId={detailId}
          perms={session.permissions}
          onClose={() => setDetailId(null)}
          onSaved={() => { reload(); if (openId) getOrder(token, openId).then(setDetail).catch(() => {}); }}
        />
      )}

    </div>
  );
}
