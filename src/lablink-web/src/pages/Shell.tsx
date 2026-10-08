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
import Departments from "./Departments";
import Employees from "./Employees";
import Audit from "./Audit";
import Report from "./Report";
import Icon, { type IconName } from "../components/Icon";
import styles from "./Shell.module.css";

const VIEW_ICON: Record<string, IconName> = {
  track: "clipboard", order: "filePlus", book: "calendar", deal: "tag", deals: "tag",
  catalog: "book", orders: "flask", report: "chart", departments: "building",
  employees: "idCard", users: "users", roles: "shield", audit: "history",
};

/** Nhãn ngắn cho thanh tab dưới đáy (điện thoại). */
const VIEW_SHORT: Record<string, string> = {
  track: "Kết quả", order: "Chỉ định", book: "Đặt XN", deal: "Danh mục", deals: "Duyệt giá",
  catalog: "Danh mục", orders: "Phiếu",
};

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(-2).map((w) => w[0]?.toUpperCase() ?? "").join("");

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

  // Điện thoại: ≤4 mục → thanh tab dưới đáy; >4 mục → menu trượt (nút ☰ ở thanh trên).
  const useTabs = items.length > 1 && items.length <= 4;
  const useDrawer = items.length > 4;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const go = (v: string) => { setView(v); setDrawerOpen(false); setUserMenu(false); };
  const badgeOf = (v: string, fallback?: number) => (v === "deals" ? dealBadge : fallback ?? 0);

  return (
    <div className={`${styles.shell} ${useTabs ? styles.withTabs : ""}`}>
      {/* Thanh trên — chỉ hiện trên điện thoại */}
      <header className={styles.mobileBar}>
        {useDrawer ? (
          <button className={styles.iconBtn} aria-label="Mở menu" onClick={() => setDrawerOpen(true)}>
            <Icon name="list" size={20} />
          </button>
        ) : (
          <div className={styles.logo}>L</div>
        )}
        <div className={styles.mobileTitle}>{active?.label ?? "LabLink"}</div>
        <button
          className={styles.avatar}
          aria-label={`Tài khoản: ${session.user.fullName}`}
          aria-expanded={userMenu}
          onClick={() => setUserMenu((v) => !v)}
        >
          {initials(session.user.fullName)}
        </button>
        {userMenu && (
          <>
            <div className={styles.menuBackdrop} onClick={() => setUserMenu(false)} />
            <div className={styles.userMenu} role="menu">
              <div className={styles.userName}>{session.user.fullName}</div>
              <div className={styles.roleTag}>{ROLE_LABEL[session.role]}</div>
              <button className={styles.menuItem} role="menuitem" onClick={onLogout}>
                <Icon name="logOut" /> Đăng xuất
              </button>
            </div>
          </>
        )}
      </header>

      {drawerOpen && <div className={styles.drawerBackdrop} onClick={() => setDrawerOpen(false)} />}
      <nav className={`${styles.sidebar} ${drawerOpen ? styles.sidebarOpen : ""}`} aria-label="Điều hướng chính">
        <div className={styles.brand}>
          <div className={styles.logo}>L</div>
          <div className={styles.brandText}>
            <div className={styles.name}>LabLink</div>
            <div className={styles.brandSub}>FastLab</div>
          </div>
        </div>

        <div className={styles.navList}>
          {items.map((it) => {
            const badge = badgeOf(it.view, it.badge);
            const on = it.view === view;
            return (
              <button
                key={it.view}
                className={`${styles.item} ${on ? styles.itemActive : ""}`}
                aria-current={on ? "page" : undefined}
                onClick={() => go(it.view)}
              >
                <Icon name={VIEW_ICON[it.view] ?? "clipboard"} />
                <span className={styles.itemLabel}>{it.label}</span>
                {badge > 0 ? <span className={styles.badge}>{badge}</span> : null}
              </button>
            );
          })}
        </div>

        <div className={styles.spacer} />
        <div className={styles.userBox}>
          <div className={styles.avatarSm}>{initials(session.user.fullName)}</div>
          <div className={styles.userText}>
            <div className={styles.userName}>{session.user.fullName}</div>
            <div className={styles.roleTag}>{ROLE_LABEL[session.role]}</div>
          </div>
          <button className={styles.iconBtn} onClick={onLogout} aria-label="Đăng xuất" title="Đăng xuất">
            <Icon name="logOut" />
          </button>
        </div>
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
        ) : view === "departments" ? (
          <Departments session={session} />
        ) : view === "employees" ? (
          <Employees session={session} />
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

      {useTabs && (
        <nav className={styles.tabBar} aria-label="Điều hướng chính (điện thoại)">
          {items.map((it) => {
            const badge = badgeOf(it.view, it.badge);
            const on = it.view === view;
            return (
              <button
                key={it.view}
                className={`${styles.tab} ${on ? styles.tabActive : ""}`}
                aria-current={on ? "page" : undefined}
                onClick={() => go(it.view)}
              >
                <span className={styles.tabIcon}>
                  <Icon name={VIEW_ICON[it.view] ?? "clipboard"} size={20} />
                  {badge > 0 ? <span className={styles.tabBadge}>{badge}</span> : null}
                </span>
                {VIEW_SHORT[it.view] ?? it.label}
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
