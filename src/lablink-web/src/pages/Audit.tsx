import { useEffect, useState } from "react";
import type { Session } from "../auth/session";
import { listAudit, type AuditItem } from "../api/admin";
import s from "./admin.module.css";

const PAGE_SIZE = 50;

const ACTION_LABEL: Record<string, string> = {
  "auth.login": "Đăng nhập",
  "user.create": "Tạo người dùng",
  "user.update": "Sửa người dùng",
  "user.roles": "Gán nhóm",
  "user.status": "Đổi trạng thái",
  "user.reset_password": "Đặt lại mật khẩu",
  "role.permissions": "Sửa quyền vai trò",
};

function fmt(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function Audit({ session }: { session: Session }) {
  const token = session.token;
  const [items, setItems] = useState<AuditItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listAudit(token, page, PAGE_SIZE)
      .then((d) => {
        setItems(d.items);
        setTotal(d.total);
      })
      .finally(() => setLoading(false));
  }, [token, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className={s.head}>
        <div className={s.h1}>Nhật ký hoạt động</div>
      </div>

      <div className={s.tableWrap}>
        <div className={s.scroll}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Người thực hiện</th>
                <th>Hành động</th>
                <th>Đối tượng</th>
                <th>Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id}>
                  <td className={s.mono}>{fmt(a.at)}</td>
                  <td className={s.name}>{a.userName ?? "—"}</td>
                  <td>{ACTION_LABEL[a.action] ?? a.action}</td>
                  <td className={s.mono}>{a.objectType ?? "—"}</td>
                  <td>{a.detail ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading && <div className={s.state}>Đang tải…</div>}
        {!loading && items.length === 0 && <div className={s.state}>Chưa có nhật ký.</div>}
      </div>

      <div className={s.pager}>
        <span className={s.pageInfo}>{total} bản ghi · trang {page}/{totalPages}</span>
        <button className={s.btn} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Trước</button>
        <button className={s.btn} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Sau →</button>
      </div>
    </div>
  );
}
