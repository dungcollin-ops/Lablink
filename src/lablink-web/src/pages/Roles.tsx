import { useEffect, useMemo, useState } from "react";
import type { Session } from "../auth/session";
import { listPermissions, listRoles, setRolePermissions, type AdminRole } from "../api/admin";
import s from "./admin.module.css";
import r from "./Roles.module.css";

interface Props {
  session: Session;
}

export default function Roles({ session }: Props) {
  const token = session.token;
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [perms, setPerms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listRoles(token), listPermissions(token)])
      .then(([rs, ps]) => {
        setRoles(rs);
        setPerms(ps);
      })
      .finally(() => setLoading(false));
  }, [token]);

  // Nhóm permission theo tiền tố "<đối tượng>."
  const grouped = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const p of perms) {
      const obj = p.split(".")[0];
      if (!m.has(obj)) m.set(obj, []);
      m.get(obj)!.push(p);
    }
    return [...m.entries()];
  }, [perms]);

  if (loading) return <div className={s.state}>Đang tải…</div>;

  return (
    <div>
      <div className={s.head}>
        <div className={s.h1}>Vai trò &amp; phân quyền</div>
      </div>
      <div className={r.grid}>
        {roles.map((role) => (
          <RoleCard key={role.id} role={role} grouped={grouped} token={token} />
        ))}
      </div>
    </div>
  );
}

function RoleCard({
  role,
  grouped,
  token,
}: {
  role: AdminRole;
  grouped: [string, string[]][];
  token?: string;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set(role.permissions));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const isAdmin = role.code === "admin";

  function toggle(key: string) {
    setSaved(false);
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setSaved(false);
    await setRolePermissions(token, role.id, [...picked]);
    setBusy(false);
    setSaved(true);
  }

  return (
    <div className={r.card}>
      <div className={r.cardHead}>
        <span className={r.roleName}>{role.name}</span>
        <span className={r.roleCode}>{role.code}</span>
      </div>
      <div className={r.userCount}>{role.userCount} người dùng · {picked.size} quyền</div>

      {grouped.map(([obj, keys]) => (
        <div key={obj} className={r.group}>
          <div className={r.groupName}>{obj}</div>
          {keys.map((k) => (
            <label key={k} className={r.perm}>
              <input
                type="checkbox"
                checked={picked.has(k)}
                disabled={isAdmin}
                onChange={() => toggle(k)}
              />
              <code>{k}</code>
            </label>
          ))}
        </div>
      ))}

      <div className={r.save}>
        <button className={`${s.btn} ${s.btnPrimary}`} onClick={save} disabled={busy || isAdmin}>
          {busy ? "Đang lưu…" : "Lưu"}
        </button>
        {isAdmin && <span className={r.roleCode}>Nhóm quản trị luôn đủ quyền</span>}
        {saved && <span className={r.saved}>✓ Đã lưu</span>}
      </div>
    </div>
  );
}
