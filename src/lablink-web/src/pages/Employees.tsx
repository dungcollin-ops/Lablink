import { useCallback, useEffect, useState, type CSSProperties } from "react";
import type { Session } from "../auth/session";
import {
  listEmployees, createEmployee, updateEmployee, POSITIONS,
  type Employee, type EmployeeInput,
} from "../api/employees";
import { listDepartments, type Department } from "../api/departments";
import { ApiError } from "../api/http";
import Modal from "../components/Modal";
import a from "./admin.module.css";

export default function Employees({ session }: { session: Session }) {
  const token = session.token;
  const [depts, setDepts] = useState<Department[]>([]);
  const [items, setItems] = useState<Employee[]>([]);
  const [filterDept, setFilterDept] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => { listDepartments(token, true).then(setDepts).catch(() => {}); }, [token]);

  const reload = useCallback(() => {
    setLoading(true);
    listEmployees(token, filterDept || undefined, true).then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, [token, filterDept]);
  useEffect(reload, [reload]);

  const th: CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" };
  const td: CSSProperties = { padding: "8px 10px", fontSize: 14, borderBottom: "1px solid var(--border-2)" };

  return (
    <div>
      <div className={a.head}>
        <div className={a.h1}>Danh mục nhân viên</div>
        <button className={`${a.btn} ${a.btnPrimary}`} onClick={() => setCreating(true)}>＋ Thêm nhân viên</button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <select className={a.input} style={{ maxWidth: 280 }} value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
          <option value="">Tất cả phòng ban</option>
          {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {loading && <div style={{ padding: 16, color: "var(--text-muted)" }}>Đang tải…</div>}
      {!loading && (
        <div style={{ overflowX: "auto", background: "var(--white)", border: "1px solid var(--border)", borderRadius: "var(--radius-card)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Họ tên</th>
                <th style={th}>Chức danh</th>
                <th style={th}>Phòng ban</th>
                <th style={th}>Mã NV</th>
                <th style={th}>SĐT</th>
                <th style={th}>Trạng thái</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id}>
                  <td style={{ ...td, fontWeight: 600 }}>{e.fullName}</td>
                  <td style={td}>{e.position || "—"}</td>
                  <td style={td}>{e.departmentName}</td>
                  <td style={td}>{e.code || "—"}</td>
                  <td style={td}>{e.phone || "—"}</td>
                  <td style={td}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: e.isActive ? "var(--success-text)" : "var(--text-faint)" }}>
                      {e.isActive ? "Đang dùng" : "Đã ẩn"}
                    </span>
                  </td>
                  <td style={td}><button className={a.btn} onClick={() => setEditing(e)}>Sửa</button></td>
                </tr>
              ))}
              {items.length === 0 && <tr><td style={{ ...td, color: "var(--text-faint)" }} colSpan={7}>Chưa có nhân viên nào.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <EmpForm
          token={token} depts={depts} initial={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); reload(); }}
        />
      )}
    </div>
  );
}

function EmpForm({ token, depts, initial, onClose, onSaved }: {
  token?: string; depts: Department[]; initial: Employee | null; onClose: () => void; onSaved: () => void;
}) {
  const [f, setF] = useState<EmployeeInput>(initial
    ? { departmentId: initial.departmentId, fullName: initial.fullName, code: initial.code ?? "", position: initial.position, phone: initial.phone ?? "", isActive: initial.isActive }
    : { departmentId: depts[0]?.id ?? "", fullName: "", code: "", position: "Bác sĩ", phone: "", isActive: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof EmployeeInput>(k: K, v: EmployeeInput[K]) => setF((s) => ({ ...s, [k]: v }));

  async function save() {
    if (!f.fullName.trim()) { setError("Nhập họ tên."); return; }
    if (!f.departmentId) { setError("Chọn phòng ban."); return; }
    setBusy(true); setError("");
    try {
      if (initial) await updateEmployee(token, initial.id, f);
      else await createEmployee(token, f);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Lỗi lưu nhân viên");
      setBusy(false);
    }
  }

  return (
    <Modal
      title={initial ? "Sửa nhân viên" : "Thêm nhân viên"}
      onClose={onClose}
      footer={<>
        <button className={a.btn} onClick={onClose}>Huỷ</button>
        <button className={`${a.btn} ${a.btnPrimary}`} onClick={save} disabled={busy}>{busy ? "Đang lưu…" : "Lưu"}</button>
      </>}
    >
      {error && <div className={a.error}>{error}</div>}
      <div className={a.field}>
        <label className={a.label}>Họ tên *</label>
        <input className={a.input} value={f.fullName} onChange={(e) => set("fullName", e.target.value)} />
      </div>
      <div className={a.field}>
        <label className={a.label}>Chức danh</label>
        <select className={a.input} value={f.position} onChange={(e) => set("position", e.target.value)}>
          {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div className={a.field}>
        <label className={a.label}>Phòng ban *</label>
        <select className={a.input} value={f.departmentId} onChange={(e) => set("departmentId", e.target.value)}>
          <option value="">— Chọn phòng ban —</option>
          {depts.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.type})</option>)}
        </select>
      </div>
      <div className={a.field}>
        <label className={a.label}>Mã nhân viên</label>
        <input className={a.input} value={f.code ?? ""} onChange={(e) => set("code", e.target.value)} />
      </div>
      <div className={a.field}>
        <label className={a.label}>Điện thoại</label>
        <input className={a.input} value={f.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
      </div>
      <div className={a.field}>
        <label className={a.label} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={f.isActive} onChange={(e) => set("isActive", e.target.checked)} />
          Đang làm việc
        </label>
      </div>
    </Modal>
  );
}
