import { useCallback, useEffect, useState, type CSSProperties } from "react";
import type { Session } from "../auth/session";
import {
  listDepartments, createDepartment, updateDepartment, DEPT_TYPES,
  type Department, type DepartmentInput,
} from "../api/departments";
import { ApiError } from "../api/http";
import Modal from "../components/Modal";
import a from "./admin.module.css";

const empty: DepartmentInput = {
  name: "", type: "Phòng khám", address: "", phone: "", hardCopyRequired: true, isActive: true,
};

export default function Departments({ session }: { session: Session }) {
  const token = session.token;
  const [items, setItems] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Department | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    listDepartments(token, true).then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, [token]);
  useEffect(reload, [reload]);

  const th: CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" };
  const td: CSSProperties = { padding: "8px 10px", fontSize: 14, borderBottom: "1px solid var(--border-2)" };

  return (
    <div>
      <div className={a.head}>
        <div className={a.h1}>Danh mục phòng ban</div>
        <button className={`${a.btn} ${a.btnPrimary}`} onClick={() => setCreating(true)}>＋ Thêm phòng ban</button>
      </div>

      {loading && <div style={{ padding: 16, color: "var(--text-muted)" }}>Đang tải…</div>}
      {!loading && (
        <div style={{ overflowX: "auto", background: "var(--white)", border: "1px solid var(--border)", borderRadius: "var(--radius-card)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Tên phòng ban</th>
                <th style={th}>Loại</th>
                <th style={th}>Địa chỉ</th>
                <th style={th}>SĐT</th>
                <th style={th}>Bản cứng</th>
                <th style={th}>Trạng thái</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id}>
                  <td style={{ ...td, fontWeight: 600 }}>{d.name}</td>
                  <td style={td}>{d.type}</td>
                  <td style={td}>{d.address || "—"}</td>
                  <td style={td}>{d.phone || "—"}</td>
                  <td style={td}>{d.hardCopyRequired ? "Có" : "Không"}</td>
                  <td style={td}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: d.isActive ? "var(--success-text)" : "var(--text-faint)" }}>
                      {d.isActive ? "Đang dùng" : "Đã ẩn"}
                    </span>
                  </td>
                  <td style={td}>
                    <button className={a.btn} onClick={() => setEditing(d)}>Sửa</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td style={{ ...td, color: "var(--text-faint)" }} colSpan={7}>Chưa có phòng ban nào.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <DeptForm
          token={token}
          initial={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); reload(); }}
        />
      )}
    </div>
  );
}

function DeptForm({ token, initial, onClose, onSaved }: {
  token?: string; initial: Department | null; onClose: () => void; onSaved: () => void;
}) {
  const [f, setF] = useState<DepartmentInput>(initial
    ? { name: initial.name, type: initial.type, address: initial.address ?? "", phone: initial.phone ?? "", hardCopyRequired: initial.hardCopyRequired, isActive: initial.isActive }
    : empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof DepartmentInput>(k: K, v: DepartmentInput[K]) => setF((s) => ({ ...s, [k]: v }));

  async function save() {
    if (!f.name.trim()) { setError("Nhập tên phòng ban."); return; }
    setBusy(true); setError("");
    try {
      if (initial) await updateDepartment(token, initial.id, f);
      else await createDepartment(token, f);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Lỗi lưu phòng ban");
      setBusy(false);
    }
  }

  return (
    <Modal
      title={initial ? "Sửa phòng ban" : "Thêm phòng ban"}
      onClose={onClose}
      footer={<>
        <button className={a.btn} onClick={onClose}>Huỷ</button>
        <button className={`${a.btn} ${a.btnPrimary}`} onClick={save} disabled={busy}>{busy ? "Đang lưu…" : "Lưu"}</button>
      </>}
    >
      {error && <div className={a.error}>{error}</div>}
      <div className={a.field}>
        <label className={a.label}>Tên phòng ban *</label>
        <input className={a.input} value={f.name} onChange={(e) => set("name", e.target.value)} />
      </div>
      <div className={a.field}>
        <label className={a.label}>Loại</label>
        <select className={a.input} value={f.type} onChange={(e) => set("type", e.target.value)}>
          {DEPT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className={a.field}>
        <label className={a.label}>Địa chỉ</label>
        <input className={a.input} value={f.address ?? ""} onChange={(e) => set("address", e.target.value)} />
      </div>
      <div className={a.field}>
        <label className={a.label}>Điện thoại</label>
        <input className={a.input} value={f.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
      </div>
      <div className={a.field}>
        <label className={a.label} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={f.hardCopyRequired} onChange={(e) => set("hardCopyRequired", e.target.checked)} />
          Theo dõi bản cứng (B6/B7) cho phiếu của đơn vị này
        </label>
      </div>
      <div className={a.field}>
        <label className={a.label} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={f.isActive} onChange={(e) => set("isActive", e.target.checked)} />
          Đang sử dụng
        </label>
      </div>
    </Modal>
  );
}
