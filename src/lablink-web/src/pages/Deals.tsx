import { useCallback, useEffect, useState } from "react";
import type { Session } from "../auth/session";
import {
  approveDealBatch,
  approveDealItem,
  cancelDealBatch,
  cancelDealItem,
  dealHistory,
  pendingDeals,
  rejectDealBatch,
  rejectDealItem,
  type DealBatch,
} from "../api/deals";
import a from "./admin.module.css";
import d from "./Deal.module.css";

const vnd = new Intl.NumberFormat("vi-VN");
const fmtDT = (s?: string | null) =>
  s ? new Date(s).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const STATUS: Record<string, { cls: string; label: string }> = {
  Pending: { cls: d.pending, label: "Chờ duyệt" },
  Approved: { cls: d.approved, label: "Đã chốt" },
  Rejected: { cls: d.rejected, label: "Từ chối" },
  Cancelled: { cls: d.cancelled, label: "Đã huỷ" },
};

type Tab = "pending" | "history";

export default function Deals({ session }: { session: Session }) {
  const token = session.token;
  const [tab, setTab] = useState<Tab>("pending");
  const [batches, setBatches] = useState<DealBatch[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    (tab === "pending" ? pendingDeals(token) : dealHistory(token))
      .then(setBatches)
      .finally(() => setLoading(false));
  }, [token, tab]);

  useEffect(reload, [reload]);

  async function decideItem(id: string, approve: boolean) {
    await (approve ? approveDealItem(token, id) : rejectDealItem(token, id));
    reload();
  }
  async function decideBatch(id: string, approve: boolean) {
    await (approve ? approveDealBatch(token, id) : rejectDealBatch(token, id));
    reload();
  }
  async function cancelItem(id: string) {
    if (!window.confirm("Huỷ giá đã chốt cho dòng này? Phiếu tạo mới sẽ về giá niêm yết (phiếu cũ giữ nguyên).")) return;
    await cancelDealItem(token, id);
    reload();
  }
  async function cancelBatch(id: string) {
    if (!window.confirm("Huỷ tất cả giá đã chốt trong gói này?")) return;
    await cancelDealBatch(token, id);
    reload();
  }

  const isHistory = tab === "history";
  const emptyMsg = isHistory ? "Chưa có lịch sử duyệt giá." : "Không có đề nghị nào chờ duyệt.";

  return (
    <div>
      <div className={a.head}>
        <div className={a.h1}>Duyệt giá đề nghị</div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["pending", "history"] as Tab[]).map((k) => (
          <button
            key={k}
            className={`${a.btn} ${tab === k ? a.btnPrimary : ""}`}
            onClick={() => setTab(k)}
          >
            {k === "pending" ? "Chờ duyệt" : "Lịch sử đã duyệt"}
          </button>
        ))}
      </div>

      {loading && <div className={a.state}>Đang tải…</div>}
      {!loading && batches.length === 0 && <div className={a.state}>{emptyMsg}</div>}

      {batches.map((b) => {
        const pendingCount = b.items.filter((i) => i.status === "Pending").length;
        const approvedCount = b.items.filter((i) => i.status === "Approved").length;
        const rejectedCount = b.items.filter((i) => i.status === "Rejected").length;
        const cancelledCount = b.items.filter((i) => i.status === "Cancelled").length;
        const decidedTimes = b.items.map((i) => i.decidedAt).filter(Boolean) as string[];
        const lastDecidedAt = decidedTimes.length
          ? decidedTimes.reduce((a, c) => (new Date(c) > new Date(a) ? c : a))
          : null;
        return (
          <div key={b.id} className={d.batch} style={{ marginBottom: 16 }}>
            <div className={d.batchHead}>
              <span>
                <strong style={{ color: "var(--text-title)" }}>{b.proposedByName}</strong>
                {" · "}
                {b.items.length} XN · gửi {fmtDT(b.createdAt)}
                {b.note ? ` · “${b.note}”` : ""}
              </span>
              {isHistory && (
                <span style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                  {approvedCount > 0 && <span style={{ color: "var(--success-text)", fontWeight: 600 }}>✔ {approvedCount} chốt</span>}
                  {rejectedCount > 0 && <span style={{ color: "var(--danger)", fontWeight: 600 }}>✘ {rejectedCount} từ chối</span>}
                  {cancelledCount > 0 && <span style={{ fontWeight: 600 }}>⦸ {cancelledCount} huỷ</span>}
                  {lastDecidedAt && <span>· duyệt {fmtDT(lastDecidedAt)}</span>}
                  {approvedCount > 0 && (
                    <button className={`${a.btn} ${a.btnDanger}`} style={{ marginLeft: 4 }} onClick={() => cancelBatch(b.id)}>
                      Huỷ tất cả đã chốt
                    </button>
                  )}
                </span>
              )}
              {!isHistory && pendingCount > 0 && (
                <span style={{ display: "flex", gap: 6 }}>
                  <button className={`${a.btn} ${a.btnPrimary}`} onClick={() => decideBatch(b.id, true)}>
                    Chốt tất cả ({pendingCount})
                  </button>
                  <button className={`${a.btn} ${a.btnDanger}`} onClick={() => decideBatch(b.id, false)}>
                    Từ chối tất cả
                  </button>
                </span>
              )}
            </div>

            <div className={a.scroll}>
              <table className={a.table} style={{ marginTop: 6 }}>
                <thead>
                  <tr>
                    <th>Xét nghiệm</th>
                    <th style={{ textAlign: "right" }}>Niêm yết</th>
                    <th style={{ textAlign: "right" }}>Đề nghị</th>
                    <th style={{ textAlign: "right" }}>Chênh lệch</th>
                    <th>Trạng thái</th>
                    <th style={{ textAlign: isHistory ? "left" : "right" }}>
                      {isHistory ? "Người duyệt · thời điểm" : "Thao tác"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {b.items.map((i) => {
                    const st = STATUS[i.status] ?? STATUS.Pending;
                    return (
                      <tr key={i.id}>
                        <td className={a.name}>
                          <span className={a.mono}>{i.code}</span> {i.name}
                        </td>
                        <td style={{ textAlign: "right" }} className={d.lineNums}>{vnd.format(i.listPrice)} ₫</td>
                        <td style={{ textAlign: "right" }} className={d.lineNums}>{vnd.format(i.proposedPrice)} ₫</td>
                        <td style={{ textAlign: "right" }} className={d.lineNums}>{i.diffPercent}%</td>
                        <td><span className={`${d.badge} ${st.cls}`}>{st.label}</span></td>
                        <td>
                          {isHistory ? (
                            <span style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-start", fontSize: 12.5, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                              <span>{i.decidedByName ?? "—"}{i.decidedAt ? ` · ${fmtDT(i.decidedAt)}` : ""}</span>
                              {i.status === "Approved" && (
                                <button className={a.btn} onClick={() => cancelItem(i.id)}>Huỷ chốt</button>
                              )}
                            </span>
                          ) : (
                            <div className={a.rowActions}>
                              {i.status === "Pending" ? (
                                <>
                                  <button className={`${a.btn} ${a.btnPrimary}`} onClick={() => decideItem(i.id, true)}>Chốt</button>
                                  <button className={`${a.btn} ${a.btnDanger}`} onClick={() => decideItem(i.id, false)}>Từ chối</button>
                                </>
                              ) : (
                                <span className={d.lineNums}>—</span>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
