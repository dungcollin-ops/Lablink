import { useCallback, useEffect, useState } from "react";
import type { Session } from "../auth/session";
import { getOrder, listOrders, setOrderStage, type OrderDto, type OrderListItem } from "../api/orders";
import { ApiError } from "../api/http";
import {
  allowedNext, STAGE_ACTION,
  matchStage, matchQuick, isOverdue, type QuickFilter,
  hasMyWorkRole, isMyWork, orderCompare, type SortMode,
} from "../workflow";
import { OrderListToolbar, OrderListHeader, OrderRowHead } from "../components/OrderList";
import Icon from "../components/Icon";
import SidPrint from "../components/SidPrint";
import ResultViewer from "../components/ResultViewer";
import OrderDetailModal from "../components/OrderDetailModal";
import SampleSteps from "../components/SampleSteps";
import a from "./admin.module.css";
import t from "./Track.module.css";

const vnd = new Intl.NumberFormat("vi-VN");
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

  // Điều dưỡng/BS lấy mẫu: bấm "Đã lấy mẫu" / "In SID" ngay trên dòng, không cần mở chi tiết.
  const canCollect = perms.includes("sample.collect");
  const [rowBusy, setRowBusy] = useState("");
  async function quickCollect(id: string) {
    setRowBusy(id);
    try {
      const updated = await setOrderStage(token, id, "Collected");
      if (openId === id) setDetail(updated);
      reload();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "Lỗi xác nhận lấy mẫu");
    } finally {
      setRowBusy("");
    }
  }
  async function quickPrint(id: string) {
    setRowBusy(id);
    try { setPrintOrder(await getOrder(token, id)); }
    catch { alert("Không tải được phiếu để in SID"); }
    finally { setRowBusy(""); }
  }

  return (
    <div>
      <OrderListToolbar
        title="Theo dõi & kết quả"
        loading={loading}
        count={shown.length}
        query={query}
        onQuery={setQuery}
        placeholder="Tìm mã phiếu, tên BN, mã BN, SID, xét nghiệm…"
        sortMode={sortMode}
        onSort={setSortMode}
        myRole={myRole}
        myCount={myCount}
        stage={stage}
        onStage={setStage}
        quick={quick}
        onQuick={setQuick}
        overdueCount={overdueCount}
      />

      {loading && <div className={t.state}>Đang tải…</div>}
      {!loading && orders.length === 0 && <div className={t.state}>Chưa có phiếu nào.</div>}
      {!loading && orders.length > 0 && shown.length === 0 && <div className={t.state}>Không có phiếu khớp bộ lọc.</div>}

      {!loading && shown.length > 0 && (
      <div className={t.list}>
      <OrderListHeader />
      {shown.map((o) => {
        const ovd = isOverdue(o, now);
        const waitCollect = o.stage === "Ordered" && !o.collectedAt && o.source === "Doctor";
        const busy = rowBusy === o.id;
        return (
        <div key={o.id} className={`${t.card} ${ovd ? t.cardOverdue : ""}`}>
          <OrderRowHead
            o={o}
            overdue={ovd}
            open={openId === o.id}
            onToggle={() => toggle(o.id)}
            actions={
              <>
                {o.hasResult && (
                  <button className={`${t.rowBtn} ${t.rowBtnResult}`} onClick={() => setViewResult({ id: o.id, orderNo: o.orderNo })}>
                    <Icon name="eye" size={14} /> Kết quả
                  </button>
                )}
                {waitCollect && canPrintSid && (
                  <button className={t.rowBtn} disabled={busy} onClick={() => quickPrint(o.id)}>
                    <Icon name="printer" size={14} /> In SID
                  </button>
                )}
                {waitCollect && canCollect && (
                  <button className={`${t.rowBtn} ${t.rowBtnPrimary}`} disabled={busy} onClick={() => quickCollect(o.id)}>
                    <Icon name="check" size={14} strokeWidth={2.4} /> {busy ? "Đang lưu…" : "Đã lấy mẫu"}
                  </button>
                )}
              </>
            }
          />

          {openId === o.id && (
            <div className={t.detail}>
              {!detail && <div className={t.state}>Đang tải chi tiết…</div>}
              {detail && (
                <>
                <div style={{ marginBottom: 12 }}>
                  <button className={a.btn} onClick={() => setDetailId(detail.id)}><Icon name="pencil" size={14} /> Xem đầy đủ / Sửa phiếu</button>
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
                    <div className={t.nextBar}>
                      <span>Bước kế của bạn:</span>
                      <button className={`${a.btn} ${a.btnPrimary}`} style={{ marginLeft: "auto" }} disabled={advBusy} onClick={() => advance(detail.id, nx.stage)}>
                        {advBusy ? "Đang lưu…" : <><Icon name="check" size={14} /> {STAGE_ACTION[nx.stage] ?? nx.stage}</>}
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
                        <Icon name="printer" size={14} /> In SID
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
                          <Icon name="eye" size={14} /> Xem kết quả ({detail.resultFileName})
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
      </div>
      )}

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
