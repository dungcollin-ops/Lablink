import { useEffect, useState } from "react";
import type { Session } from "../auth/session";
import { reportSummary, type ReportSummary } from "../api/reports";
import a from "./admin.module.css";
import r from "./Report.module.css";

const vnd = new Intl.NumberFormat("vi-VN");

const STAGE_LABEL: Record<string, string> = {
  Ordered: "Chờ lấy mẫu", Collected: "Đã soạn mẫu", Sent: "Đã gửi",
  Received: "Đã nhận", Running: "Đang chạy", Resulted: "Có kết quả",
};

export default function Report({ session }: { session: Session }) {
  const [data, setData] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reportSummary(session.token).then(setData).finally(() => setLoading(false));
  }, [session.token]);

  if (loading) return <div className={r.state}>Đang tải…</div>;
  if (!data) return <div className={r.state}>Không tải được báo cáo.</div>;

  const maxDay = Math.max(1, ...data.revenueByDay.map((d) => d.revenue));
  const pendingTotal = data.aging.pendingToday + data.aging.pending1To3 + data.aging.pendingOver3;

  return (
    <div>
      <div className={a.head}>
        <div className={a.h1}>Báo cáo &amp; thống kê</div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>30 ngày gần nhất</div>
      </div>

      <div className={r.cards}>
        <div className={r.kpi}>
          <div className={r.kpiLabel}>Tổng phiếu</div>
          <div className={r.kpiValue}>{vnd.format(data.totalOrders)}</div>
        </div>
        <div className={r.kpi}>
          <div className={r.kpiLabel}>Doanh thu</div>
          <div className={r.kpiValue}>{vnd.format(data.totalRevenue)} ₫</div>
        </div>
        <div className={r.kpi}>
          <div className={r.kpiLabel}>Đã trả kết quả</div>
          <div className={r.kpiValue}>{data.aging.resulted}</div>
          <div className={r.kpiSub}>/ {data.totalOrders} phiếu</div>
        </div>
        <div className={r.kpi}>
          <div className={r.kpiLabel}>Tồn đọng</div>
          <div className={r.kpiValue} style={{ color: pendingTotal > 0 ? "var(--danger)" : undefined }}>{pendingTotal}</div>
          <div className={r.kpiSub}>chưa có kết quả</div>
        </div>
      </div>

      <div className={r.grid2}>
        <div className={r.panel}>
          <div className={r.panelTitle}>Theo nguồn</div>
          {data.bySource.map((sc) => (
            <div key={sc.source} className={r.row}>
              <span className={r.rowLabel}>{sc.source === "Doctor" ? "Bác sĩ" : "Khách lẻ"} · {sc.count} phiếu</span>
              <span className={r.rowVal}>{vnd.format(sc.revenue)} ₫</span>
            </div>
          ))}
          {data.bySource.length === 0 && <div className={r.state}>Chưa có dữ liệu.</div>}
        </div>

        <div className={r.panel}>
          <div className={r.panelTitle}>Tồn đọng theo tuổi (chưa trả KQ)</div>
          <div className={r.agingRow}><span className={r.dot} style={{ background: "var(--success)" }} /> Hôm nay: <strong>{data.aging.pendingToday}</strong></div>
          <div className={r.agingRow}><span className={r.dot} style={{ background: "#e0a24a" }} /> 1–3 ngày: <strong>{data.aging.pending1To3}</strong></div>
          <div className={r.agingRow}><span className={r.dot} style={{ background: "var(--danger-2)" }} /> Trên 3 ngày: <strong style={{ color: "var(--danger)" }}>{data.aging.pendingOver3}</strong> ⚠️</div>
        </div>
      </div>

      <div className={r.panel} style={{ marginBottom: 20 }}>
        <div className={r.panelTitle}>Phiếu theo trạng thái</div>
        {data.byStage.map((st) => (
          <div key={st.stage} className={r.row}>
            <span className={r.rowLabel}>{STAGE_LABEL[st.stage] ?? st.stage}</span>
            <span className={r.rowVal}>{st.count}</span>
          </div>
        ))}
        {data.byStage.length === 0 && <div className={r.state}>Chưa có dữ liệu.</div>}
      </div>

      <div className={r.panel}>
        <div className={r.panelTitle}>Doanh thu theo ngày</div>
        {data.revenueByDay.length === 0 ? (
          <div className={r.state}>Chưa có dữ liệu.</div>
        ) : (
          <div className={r.bars}>
            {data.revenueByDay.map((d) => (
              <div key={d.date} className={r.bar} title={`${d.date}: ${vnd.format(d.revenue)} ₫ · ${d.orders} phiếu`}>
                <div className={r.barFill} style={{ height: `${Math.round((d.revenue / maxDay) * 100)}%` }} />
                <div className={r.barLabel}>{d.date.slice(5)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
