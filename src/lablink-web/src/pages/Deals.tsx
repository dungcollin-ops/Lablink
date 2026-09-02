import { useCallback, useEffect, useState } from "react";
import type { Session } from "../auth/session";
import {
  approveDealBatch,
  approveDealItem,
  pendingDeals,
  rejectDealBatch,
  rejectDealItem,
  type DealBatch,
} from "../api/deals";
import a from "./admin.module.css";
import d from "./Deal.module.css";

const vnd = new Intl.NumberFormat("vi-VN");

const STATUS: Record<string, { cls: string; label: string }> = {
  Pending: { cls: d.pending, label: "Chờ duyệt" },
  Approved: { cls: d.approved, label: "Đã chốt" },
  Rejected: { cls: d.rejected, label: "Từ chối" },
};

export default function Deals({ session }: { session: Session }) {
  const token = session.token;
  const [batches, setBatches] = useState<DealBatch[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    pendingDeals(token)
      .then(setBatches)
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(reload, [reload]);

  async function decideItem(id: string, approve: boolean) {
    await (approve ? approveDealItem(token, id) : rejectDealItem(token, id));
    reload();
  }
  async function decideBatch(id: string, approve: boolean) {
    await (approve ? approveDealBatch(token, id) : rejectDealBatch(token, id));
    reload();
  }

  return (
    <div>
      <div className={a.head}>
        <div className={a.h1}>Duyệt giá đề nghị</div>
      </div>

      {loading && <div className={a.state}>Đang tải…</div>}
      {!loading && batches.length === 0 && <div className={a.state}>Không có đề nghị nào chờ duyệt.</div>}

      {batches.map((b) => {
        const pendingCount = b.items.filter((i) => i.status === "Pending").length;
        return (
          <div key={b.id} className={d.batch} style={{ marginBottom: 16 }}>
            <div className={d.batchHead}>
              <span>
                <strong style={{ color: "var(--text-title)" }}>{b.proposedByName}</strong>
                {" · "}
                {new Date(b.createdAt).toLocaleString("vi-VN")}
                {b.note ? ` · “${b.note}”` : ""}
              </span>
              {pendingCount > 0 && (
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
                    <th style={{ textAlign: "right" }}>Thao tác</th>
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
