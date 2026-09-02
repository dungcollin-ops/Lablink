import { useCallback, useEffect, useState } from "react";
import { NAV } from "../nav";
import { ROLE_LABEL } from "../auth/permissions";
import type { Session } from "../auth/session";
import { pendingDealCount } from "../api/deals";
import Catalog from "./Catalog";
import Deal from "./Deal";
import Deals from "./Deals";
import OrderForm from "./OrderForm";
import Track from "./Track";
import LabOrders from "./LabOrders";
import Users from "./Users";
import Roles from "./Roles";
import Audit from "./Audit";
import Report from "./Report";
import styles from "./Shell.module.css";

interface Props {
  session: Session;
  onLogout: () => void;
}

/** Shell 2 cột — sidebar trái + content phải (README · Layout).
 * Menu = chức năng của NHÓM (role) user đang thuộc; mỗi mục gắn permission. */
export default function Shell({ session, onLogout }: Props) {
  const items = NAV[session.role].filter((it) =>
    session.permissions.includes(it.perm),
  );
  const [view, setView] = useState(items[0]?.view ?? "");
  const active = items.find((i) => i.view === view);

  // Badge số đề nghị chờ duyệt (chỉ nhóm có deal.approve).
  const [dealBadge, setDealBadge] = useState(0);
  const canApprove = session.permissions.includes("deal.approve");
  const refreshBadge = useCallback(() => {
    if (canApprove) pendingDealCount(session.token).then(setDealBadge).catch(() => {});
  }, [canApprove, session.token]);
  useEffect(refreshBadge, [refreshBadge, view]);

  return (
    <div className={styles.shell}>
      <nav className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.logo}>L</div>
          <div className={styles.name}>LabLink</div>
        </div>

        <div className={styles.userBox}>
          <div className={styles.userName}>{session.user.fullName}</div>
          <div className={styles.roleTag}>{ROLE_LABEL[session.role]}</div>
        </div>

        {items.map((it) => {
          const badge = it.view === "deals" ? dealBadge : it.badge ?? 0;
          return (
            <button
              key={it.view}
              className={`${styles.item} ${it.view === view ? styles.itemActive : ""}`}
              onClick={() => setView(it.view)}
            >
              <span>{it.label}</span>
              {badge > 0 ? <span className={styles.badge}>{badge}</span> : null}
            </button>
          );
        })}

        <div className={styles.spacer} />
        <button className={styles.switch} onClick={onLogout}>
          Đăng xuất
        </button>
      </nav>

      <main className={styles.content}>
        {view === "catalog" ? (
          <Catalog session={session} />
        ) : view === "deal" ? (
          <Deal session={session} />
        ) : view === "deals" ? (
          <Deals session={session} />
        ) : view === "order" ? (
          <OrderForm session={session} mode="doctor" onNavigate={setView} />
        ) : view === "book" ? (
          <OrderForm session={session} mode="retail" onNavigate={setView} />
        ) : view === "track" ? (
          <Track session={session} />
        ) : view === "orders" ? (
          <LabOrders session={session} />
        ) : view === "users" ? (
          <Users session={session} />
        ) : view === "roles" ? (
          <Roles session={session} />
        ) : view === "audit" ? (
          <Audit session={session} />
        ) : view === "report" ? (
          <Report session={session} />
        ) : (
          <div className={styles.placeholder}>
            <h1 className={styles.h1}>{active?.label ?? "Không có chức năng"}</h1>
            <div className={styles.note}>
              Màn hình <code>{view || "—"}</code> sẽ được xây ở phase sau theo{" "}
              <code>docs/ARCHITECTURE.md</code>. Khung đăng nhập, phân quyền theo
              nhóm và design tokens đã sẵn sàng.
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
