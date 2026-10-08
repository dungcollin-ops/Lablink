import type { ReactNode } from "react";
import type { OrderListItem } from "../api/orders";
import {
  LIST_STAGES, LIST_QUICK, SORT_OPTIONS, stageLabel, type QuickFilter, type SortMode,
} from "../workflow";
import Icon from "./Icon";
import { STAGE_CLS } from "./stageClass";
import a from "../pages/admin.module.css";
import t from "../pages/Track.module.css";

/** Phần dùng chung giữa "Theo dõi & kết quả" (Track) và "Chỉ định & trả kết quả" (LabOrders):
 * thanh lọc phía trên + dòng phiếu (bảng trên máy tính, thẻ trên điện thoại). */

const vnd = new Intl.NumberFormat("vi-VN");
const p2 = (n: number) => String(n).padStart(2, "0");
const fmtDT = (s?: string | null) => {
  if (!s) return "—";
  const d = new Date(s);
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
};

interface ToolbarProps {
  title: string;
  loading: boolean;
  count: number;
  query: string;
  onQuery: (v: string) => void;
  placeholder: string;
  sortMode: SortMode;
  onSort: (v: SortMode) => void;
  myRole: boolean;
  myCount: number;
  stage: string;
  onStage: (v: string) => void;
  quick: QuickFilter;
  onQuick: (v: QuickFilter) => void;
  overdueCount: number;
}

export function OrderListToolbar(p: ToolbarProps) {
  return (
    <>
      <div className={t.pageHead}>
        <h1 className={a.h1}>{p.title}</h1>
        {!p.loading && <span className={t.count}>{p.count} phiếu</span>}
        <label className={t.sort}>
          <span className={t.sortLabel}>Sắp theo</span>
          <select value={p.sortMode} onChange={(e) => p.onSort(e.target.value as SortMode)} aria-label="Sắp xếp">
            {SORT_OPTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
      </div>

      <div className={t.filters}>
        <label className={t.searchBox}>
          <Icon name="search" />
          <input
            type="search"
            aria-label="Tìm phiếu"
            placeholder={p.placeholder}
            value={p.query}
            onChange={(e) => p.onQuery(e.target.value)}
          />
        </label>
        <div className={t.chipRow}>
          <div className={t.segment} role="tablist" aria-label="Trạng thái">
            {p.myRole && (
              <button
                role="tab"
                aria-selected={p.stage === "MINE"}
                className={`${t.segItem} ${p.stage === "MINE" ? t.segActive : ""}`}
                onClick={() => p.onStage("MINE")}
                title="Phiếu đang chờ đúng việc của bạn"
              >
                <Icon name="target" size={14} /> Việc của tôi
                {p.myCount > 0 && <span className={t.segCount}>{p.myCount}</span>}
              </button>
            )}
            {LIST_STAGES.map((sg) => (
              <button
                key={sg.key}
                role="tab"
                aria-selected={p.stage === sg.key}
                className={`${t.segItem} ${p.stage === sg.key ? t.segActive : ""}`}
                onClick={() => p.onStage(sg.key)}
              >
                {sg.label}
              </button>
            ))}
          </div>
          <div className={t.quick}>
            {LIST_QUICK.map((q) => {
              const on = p.quick === q.key;
              const danger = q.key === "overdue" && p.overdueCount > 0;
              return (
                <button
                  key={q.key}
                  aria-pressed={on}
                  className={`${t.chip} ${on ? t.chipActive : ""} ${!on && danger ? t.chipDanger : ""}`}
                  onClick={() => p.onQuick(on ? "" : q.key)}
                >
                  {q.key === "overdue" && <Icon name="alert" size={14} />}
                  {q.label}{danger ? ` ${p.overdueCount}` : ""}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

/** Tiêu đề cột — chỉ hiện trên máy tính. */
export function OrderListHeader() {
  return (
    <div className={t.listHead} aria-hidden="true">
      <span>Mã phiếu</span>
      <span>Bệnh nhân</span>
      <span>Trạng thái</span>
      <span>Thời gian</span>
      <span className={t.right}>Thành tiền</span>
      <span />
      <span />
    </div>
  );
}

interface RowProps {
  o: OrderListItem;
  overdue: boolean;
  open: boolean;
  onToggle: () => void;
  /** Nút thao tác nhanh bên phải (Kết quả / In SID / Đã lấy mẫu…). */
  actions?: ReactNode;
}

export function OrderRowHead({ o, overdue, open, onToggle, actions }: RowProps) {
  const time = o.resultAt
    ? { label: "Đã trả KQ", value: fmtDT(o.resultAt), cls: t.timeDone }
    : o.expectedMinAt || o.expectedMaxAt
      ? { label: overdue ? "Quá hạn KQ" : "Dự kiến KQ", value: `${fmtDT(o.expectedMinAt)} – ${fmtDT(o.expectedMaxAt)}`, cls: overdue ? t.timeLate : "" }
      : { label: "Chỉ định", value: fmtDT(o.createdAt), cls: "" };
  return (
    <div
      className={t.cardHead}
      role="button"
      tabIndex={0}
      aria-expanded={open}
      onClick={onToggle}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
    >
      <span className={t.cNo}>
        <span className={t.orderNo}>{o.orderNo}</span>
        <span className={t.src}>{o.source === "Doctor" ? "Bác sĩ" : "Khách lẻ"}</span>
      </span>
      <span className={t.cPt}>
        <span className={t.patient}>{o.patientName}</span>
        <span className={t.maBN}>{o.patientMaBN} · {o.itemCount} XN{o.departmentName ? ` · ${o.departmentName}` : ""}</span>
      </span>
      <span className={t.cStage}>
        <span className={`${t.badge} ${o.stage === "Ordered" && o.collectedAt ? t.stageCollected : STAGE_CLS[o.stage] ?? ""}`}>
          {stageLabel(o.stage, { collectAt: o.collectedAt, gatherAt: o.gatheredAt })}
        </span>
      </span>
      <span className={`${t.cTime} ${time.cls}`}>
        {overdue && <Icon name="clock" size={14} />}
        <span className={t.timeLabel}>{time.label}</span>
        <span className={t.timeValue}>{time.value}</span>
      </span>
      <span className={t.cTotal}>{vnd.format(o.total)} ₫</span>
      <span className={t.cAct} onClick={(e) => e.stopPropagation()}>
        {actions}
      </span>
      <Icon name="chevronRight" className={`${t.chev} ${open ? t.chevOpen : ""}`} />
    </div>
  );
}
