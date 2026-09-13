import { useCallback, useEffect, useState } from "react";
import Modal from "../components/Modal";
import type { Session } from "../auth/session";
import {
  createUser,
  deleteUser,
  listRoles,
  listUsers,
  resetPassword,
  setUserRoles,
  setUserStatus,
  updateUser,
  type AdminRole,
  type AdminUser,
} from "../api/admin";
import { listEmployees, type Employee } from "../api/employees";
import { ApiError } from "../api/http";
import s from "./admin.module.css";

const STATUS: Record<string, { cls: string; label: string }> = {
  Active: { cls: s.badgeActive, label: "Hoạt động" },
  Suspended: { cls: s.badgeSuspended, label: "Tạm khoá" },
  Left: { cls: s.badgeLeft, label: "Đã nghỉ" },
};

interface Props {
  session: Session;
}

export default function Users({ session }: Props) {
  const token = session.token;
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);

  const reload = useCallback(
    (q: string) => {
      setLoading(true);
      listUsers(token, q)
        .then(setUsers)
        .finally(() => setLoading(false));
    },
    [token],
  );

  useEffect(() => {
    listRoles(token).then(setRoles).catch(() => {});
    listEmployees(token, undefined, false).then(setEmployees).catch(() => {});
  }, [token]);

  useEffect(() => {
    const h = setTimeout(() => reload(query), 250);
    return () => clearTimeout(h);
  }, [query, reload]);

  async function toggleStatus(u: AdminUser) {
    const next = u.status === "Active" ? "Suspended" : "Active";
    await setUserStatus(token, u.id, next);
    reload(query);
  }

  async function doDelete(u: AdminUser) {
    if (!window.confirm(`Xóa hẳn tài khoản "${u.accountName}"? Chỉ xóa được khi chưa phát sinh phiếu.`)) return;
    try {
      await deleteUser(token, u.id);
      reload(query);
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "Lỗi xóa");
    }
  }

  async function doReset(u: AdminUser) {
    const pw = window.prompt(`Đặt lại mật khẩu cho ${u.accountName}:`, "");
    if (!pw) return;
    try {
      await resetPassword(token, u.id, pw);
      alert("Đã đặt lại mật khẩu.");
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "Lỗi");
    }
  }

  return (
    <div>
      <div className={s.head}>
        <div className={s.h1}>Quản trị người dùng</div>
        <div className={s.tools}>
          <input
            className={s.search}
            placeholder="Tìm theo tài khoản / tên / email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className={`${s.btn} ${s.btnPrimary}`} onClick={() => setCreating(true)}>
            ＋ Thêm người dùng
          </button>
        </div>
      </div>

      <div className={s.tableWrap}>
        <div className={s.scroll}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Tên tài khoản</th>
                <th>Họ tên</th>
                <th>Email</th>
                <th>Nhóm</th>
                <th>Phòng ban</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const st = STATUS[u.status] ?? STATUS.Active;
                return (
                  <tr key={u.id}>
                    <td className={s.mono}>{u.accountName}</td>
                    <td className={s.name}>{u.fullName}</td>
                    <td className={s.mono}>{u.email || "—"}</td>
                    <td>
                      {u.roles.map((r) => (
                        <span key={r} className={s.chip}>{r}</span>
                      ))}
                    </td>
                    <td>{u.department ?? "—"}</td>
                    <td><span className={`${s.badge} ${st.cls}`}>{st.label}</span></td>
                    <td>
                      <div className={s.rowActions}>
                        <button className={s.btn} onClick={() => setEditing(u)}>Sửa</button>
                        <button className={s.btn} onClick={() => toggleStatus(u)}>
                          {u.status === "Active" ? "Khoá" : "Mở khoá"}
                        </button>
                        <button className={s.btn} onClick={() => doReset(u)}>Đặt lại MK</button>
                        <button className={s.btn} onClick={() => doDelete(u)}>Xóa</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {loading && <div className={s.state}>Đang tải…</div>}
        {!loading && users.length === 0 && <div className={s.state}>Không có người dùng.</div>}
      </div>

      {creating && (
        <CreateUserModal
          roles={roles}
          employees={employees}
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            reload(query);
          }}
          token={token}
        />
      )}

      {editing && (
        <EditRolesModal
          user={editing}
          roles={roles}
          employees={employees}
          token={token}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            reload(query);
          }}
        />
      )}
    </div>
  );
}

// ---- Create user ----
function CreateUserModal({
  roles,
  employees,
  token,
  onClose,
  onDone,
}: {
  roles: AdminRole[];
  employees: Employee[];
  token?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [accountName, setAccountName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedEmp = employees.find((e) => e.id === employeeId);

  function toggle(code: string) {
    setPicked((p) => (p.includes(code) ? p.filter((x) => x !== code) : [...p, code]));
  }

  async function submit() {
    setBusy(true);
    setError("");
    try {
      await createUser(token, {
        accountName,
        email: email || undefined,
        password,
        roleCodes: picked,
        fullName: employeeId ? undefined : fullName || undefined,
        employeeId: employeeId || undefined,
      });
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Lỗi tạo người dùng");
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Thêm người dùng"
      onClose={onClose}
      footer={
        <>
          <button className={s.btn} onClick={onClose}>Huỷ</button>
          <button className={`${s.btn} ${s.btnPrimary}`} onClick={submit} disabled={busy}>
            {busy ? "Đang lưu…" : "Tạo"}
          </button>
        </>
      }
    >
      {error && <div className={s.error}>{error}</div>}
      <div className={s.field}>
        <label className={s.label}>Tên tài khoản *</label>
        <input className={s.input} value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Dùng để đăng nhập" />
      </div>
      <div className={s.field}>
        <label className={s.label}>Nhân viên (thuộc phòng ban)</label>
        <select className={s.input} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
          <option value="">— Chưa gắn nhân viên —</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>{emp.fullName} · {emp.position} · {emp.departmentName}</option>
          ))}
        </select>
      </div>
      {selectedEmp ? (
        <div className={s.field}>
          <label className={s.label}>Họ tên</label>
          <input className={s.input} value={selectedEmp.fullName} disabled />
        </div>
      ) : (
        <div className={s.field}>
          <label className={s.label}>Họ tên</label>
          <input className={s.input} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Bỏ trống sẽ lấy theo tên tài khoản" />
        </div>
      )}
      <div className={s.field}>
        <label className={s.label}>Email <span className={s.hint}>(chỉ cần cho khách lẻ)</span></label>
        <input className={s.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className={s.field}>
        <label className={s.label}>Mật khẩu *</label>
        <input className={s.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className={s.field}>
        <label className={s.label}>Nhóm</label>
        <div className={s.checks}>
          {roles.map((r) => (
            <label key={r.code} className={s.check}>
              <input type="checkbox" checked={picked.includes(r.code)} onChange={() => toggle(r.code)} />
              {r.name}
            </label>
          ))}
        </div>
      </div>
    </Modal>
  );
}

// ---- Edit roles ----
function EditRolesModal({
  user,
  roles,
  employees,
  token,
  onClose,
  onDone,
}: {
  user: AdminUser;
  roles: AdminRole[];
  employees: Employee[];
  token?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [accountName, setAccountName] = useState(user.accountName);
  const [picked, setPicked] = useState<string[]>(user.roles);
  const [employeeId, setEmployeeId] = useState(user.employeeId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const selectedEmp = employees.find((e) => e.id === employeeId);

  function toggle(code: string) {
    setPicked((p) => (p.includes(code) ? p.filter((x) => x !== code) : [...p, code]));
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      await updateUser(token, user.id, {
        accountName,
        fullName: employeeId ? undefined : user.fullName,
        employeeId: employeeId || null,
      });
      await setUserRoles(token, user.id, picked);
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Lỗi lưu");
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Sửa: ${user.accountName}`}
      onClose={onClose}
      footer={
        <>
          <button className={s.btn} onClick={onClose}>Huỷ</button>
          <button className={`${s.btn} ${s.btnPrimary}`} onClick={save} disabled={busy}>
            {busy ? "Đang lưu…" : "Lưu"}
          </button>
        </>
      }
    >
      {error && <div className={s.error}>{error}</div>}
      <div className={s.field}>
        <label className={s.label}>Tên tài khoản *</label>
        <input className={s.input} value={accountName} onChange={(e) => setAccountName(e.target.value)} />
      </div>
      <div className={s.field}>
        <label className={s.label}>Nhân viên (thuộc phòng ban)</label>
        <select className={s.input} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
          <option value="">— Chưa gắn nhân viên —</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>{emp.fullName} · {emp.position} · {emp.departmentName}</option>
          ))}
        </select>
      </div>
      {selectedEmp && (
        <div className={s.field}>
          <label className={s.label}>Họ tên</label>
          <input className={s.input} value={selectedEmp.fullName} disabled />
        </div>
      )}
      <div className={s.field}>
        <label className={s.label}>Nhóm (vai trò)</label>
        <div className={s.checks}>
          {roles.map((r) => (
            <label key={r.code} className={s.check}>
              <input type="checkbox" checked={picked.includes(r.code)} onChange={() => toggle(r.code)} />
              {r.name}
            </label>
          ))}
        </div>
      </div>
    </Modal>
  );
}
