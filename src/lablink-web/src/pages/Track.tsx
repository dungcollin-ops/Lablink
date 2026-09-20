import { useCallback, useEffect, useState } from "react";
import type { Session } from "../auth/session";
import { getOrder, listOrders, setOrderStage, type OrderDto, type OrderListItem } from "../api/orders";
import { ApiError } from "../api/http";
import {
  allowedNext, STAGE_ACTION, stageLabel,
  LIST_STAGES, LIST_QUICK, matchStage, matchQuick, isOverdue, type QuickFilter,
  hasMyWorkRole, isMyWork, orderCompare, SORT_OPTIONS, type SortMode,
} from "../workflow";
import SidPrint from "../components/SidPrint";
import ResultViewer from "../components/ResultViewer";
import OrderDetailModal from "../components/OrderDetailModal";
import SampleSteps from "../components/SampleSteps";
import a from "./admin.module.css";
import t from "./Track.module.css";

const vnd = new Intl.NumberFormat("vi-VN");
const fmtDT = (s?: string | null) => {
  if (!s) return "—";
  const d = new Date(s);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const STAGE_CLS: Record<string, string> = {
  Ordered: t.stageOrdered, Collected: t.stageCollected, Gathered: t.stageSent,
  Received: t.stageReceived, Resulted: t.stageResulted,
  HardCopySent: t.stageRunning, HardCopyReceived: t.stageResulted,
};

export default function Track({ session }: { session: Session }) {
  const token = session.token;
  const perms = session.permissions as string[];
  const myRole = hasMyWorkRole(perms);
  const canPrintSid = perms.includes("sid.print"); // chỉ người lấy mẫu / KTV nhận mẫu mới thấy In SID
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState(myRole ? "MINE" : "");
  const [quick, setQuick] = useState<QuickFilter>("");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderDto | null>(null);
  const [printOrder, setPrintOrder] = useState<OrderDto | null>(null);
  const [viewResult, setViewResult] = useState<{ id: string; orderNo: string } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [advBusy, setAdvBusy] = useState(false);

  async function advance(id: string, nextStageKey: string) {
    setAdvBusy(true);
    try {
      const updated = await setOrderStage(token, id, nextStageKey);
      setDetail(updated);
      reload();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "Lỗi chuyển bước");
    } finally {
      setAdvBusy(false);
    }
  }

  const reload = useCallback(() => {
    setLoading(true);
    // Lọc trạng thái / lọc nhanh / sắp xếp làm phía client để hỗ trợ chip gộp + đếm quá hạn.
    listOrders(token, query || undefined)
      .then(setOrders)
      .finally(() => setLoading(false));
  }, [token, query]);

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

  const now = Date.now();
  const overdueCount = orders.filter((o) => isOverdue(o, now)).length;
  const myCount = myRole ? orders.filter((o) => isMyWork(perms, o)).length : 0;
  const shown = orders
    .filter((o) => (stage === "MINE" ? isMyWork(perms, o) : matchStage(stage, o)) && matchQuick(quick, o, now))
    .sort(orderCompare(sortMode));

  return (
    <div>
      <div className={a.head} style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <div className={a.h1}>Theo dõi &amp; kết quả</div>
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
          placeholder="Tìm mã phiếu / tên BN / mã BN / SID / xét nghiệm…"
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
            <button
              key={sg.key}
              className={`${t.chip} ${stage === sg.key ? t.chipActive : ""}`}
              onClick={() => setStage(sg.key)}
            >
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
          <div className={t.cardHead} onClick={() => toggle(o.id)} style={ovd ? { background: "var(--danger-bg)" } : undefined}>
            <span className={t.orderNo}>{o.orderNo}</span>
            <span className={`${t.badge} ${o.source === "Doctor" ? t.srcDoctor : t.srcRetail}`}>
              {o.source === "Doctor" ? "Bác sĩ" : "Khách lẻ"}
            </span>
            <span className={`${t.badge} ${STAGE_CLS[o.stage] ?? ""}`}>{stageLabel(o.stage, { collectAt: o.collectedAt, gatherAt: o.gatheredAt })}</span>
            <span className={t.patient}>
              {ovd && <span title="Quá hạn dự kiến KQ" style={{ marginRight: 4 }}>⚠️</span>}
              {o.patientName} <span className={t.maBN}>{o.patientMaBN} · {o.itemCount} XN</span>
            </span>
            {/* Cụm phải: nút Kết quả (nếu có) → 1 mốc thời gian quan trọng → thành tiền. */}
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
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
              <div style={{ textAlign: "right", fontSize: 11.5, lineHeight: 1.35, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                {o.resultAt ? (
                  <>Đã trả KQ<br /><b style={{ color: "var(--success-text)" }}>{fmtDT(o.resultAt)}</b></>
                ) : (o.expectedMinAt || o.expectedMaxAt) ? (
                  <>Dự kiến KQ<br /><b style={{ color: ovd ? "var(--danger)" : "var(--action-hover)" }}>{fmtDT(o.expectedMinAt)} – {fmtDT(o.expectedMaxAt)}</b></>
                ) : (
                  <>Chỉ định<br /><b style={{ color: "var(--text-body)" }}>{fmtDT(o.createdAt)}</b></>
                )}
              </div>
            </div>
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
                {detail.stage === "Ordered" && detail.source === "Doctor" && (
                  <SampleSteps
                    token={token}
                    orderId={detail.id}
                    progress={detail.progress}
                    perms={session.permissions}
                    onDone={() => { getOrder(token, detail.id).then(setDetail).catch(() => {}); reload(); }}
                  />
                )}
                {(() => {
                  const nx = allowedNext(detail.stage, session.permissions);
                  if (!nx) return null;
                  return (
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "10px 12px", background: "var(--action-soft)", borderRadius: "var(--radius-control)" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--action-hover)" }}>Bước kế của bạn:</span>
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
                    {detail.samples.length > 0 && canPrintSid && (
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
        );
      })}

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
