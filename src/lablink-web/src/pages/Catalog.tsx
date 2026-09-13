import { useEffect, useState, type CSSProperties } from "react";
import {
  createCatalog,
  deleteCatalog,
  fetchCatalog,
  fetchFacets,
  updateCatalog,
  updateCatalogTat,
  type CatalogItem,
  type CatalogItemInput,
} from "../api/catalog";
import type { Session } from "../auth/session";
import Modal from "../components/Modal";
import a from "./admin.module.css";
import styles from "./Catalog.module.css";

const PAGE_SIZE = 50;
const vnd = new Intl.NumberFormat("vi-VN");

interface Props {
  session: Session;
}

/** Lab · Danh mục & giá niêm yết (README · Screen 6).
 * Bảng tra cứu ~1184 mục: tìm, lọc nhóm/NCC, phân trang. */
export default function Catalog({ session }: Props) {
  const token = session.token;
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [provider, setProvider] = useState("");
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<CatalogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [groups, setGroups] = useState<string[]>([]);
  const [providers, setProviders] = useState<string[]>([]);
  const [reloadTick, setReloadTick] = useState(0);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null>(null);

  // Facets một lần
  useEffect(() => {
    fetchFacets(token)
      .then((f) => {
        setGroups(f.groups);
        setProviders(f.providers);
      })
      .catch(() => {});
  }, [token]);

  // Reset trang khi đổi filter
  useEffect(() => setPage(1), [query, group, provider]);

  // Nạp danh mục (debounce theo query)
  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError("");
    const t = setTimeout(() => {
      fetchCatalog(token, { query, group, provider, page, pageSize: PAGE_SIZE })
        .then((res) => {
          if (cancel) return;
          setItems(res.items);
          setTotal(res.total);
        })
        .catch(() => !cancel && setError("Không tải được danh mục."))
        .finally(() => !cancel && setLoading(false));
    }, 250);
    return () => {
      cancel = true;
      clearTimeout(t);
    };
  }, [token, query, group, provider, page, reloadTick]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  const canEdit = (session.permissions as string[]).includes("catalog.price.edit");
  const canManage = (session.permissions as string[]).includes("catalog.manage");
  function reload() { setReloadTick((n) => n + 1); }
  async function doDelete(it: CatalogItem) {
    if (!window.confirm(`Xóa xét nghiệm "${it.name}" (${it.code})? Không xóa được nếu đã dùng trong phiếu.`)) return;
    try {
      await deleteCatalog(token, it.id);
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Lỗi xóa");
    }
  }
  const tatInput: CSSProperties = {
    width: 46, padding: "4px 5px", border: "1px solid var(--border-3)",
    borderRadius: 6, textAlign: "right", fontSize: 13,
  };
  function setTat(id: string, field: "tatMinHours" | "tatMaxHours", val: string) {
    const n = val === "" ? null : Math.max(0, parseInt(val, 10) || 0);
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: n } : it)));
  }
  async function saveTat(it: CatalogItem) {
    if (!canEdit) return;
    try {
      await updateCatalogTat(token, it.id, it.tatMinHours ?? null, it.tatMaxHours ?? null);
    } catch { /* giữ giá trị trên UI; có thể báo lỗi sau */ }
  }

  return (
    <div>
      <div className={styles.head}>
        <div className={styles.h1}>Danh mục &amp; giá niêm yết</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto" }}>
          <div className={styles.count}>{vnd.format(total)} xét nghiệm</div>
          {canManage && (
            <button className={`${a.btn} ${a.btnPrimary}`} onClick={() => setCreating(true)}>＋ Thêm xét nghiệm</button>
          )}
        </div>
      </div>

      <div className={styles.filters}>
        <input
          className={styles.search}
          placeholder="Tìm theo tên hoặc mã xét nghiệm…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className={styles.select} value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="">Tất cả nhóm</option>
          {groups.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        <select className={styles.select} value={provider} onChange={(e) => setProvider(e.target.value)}>
          <option value="">Tất cả nhà cung cấp</option>
          {providers.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      <div className={styles.tableWrap}>
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tên xét nghiệm</th>
                <th>Nhóm</th>
                <th>Loại mẫu</th>
                <th>Nhà cung cấp</th>
                <th style={{ textAlign: "right" }}>Giá niêm yết</th>
                <th style={{ textAlign: "center" }}>TG Min–Max (giờ)</th>
                {canManage && <th style={{ textAlign: "right" }}>Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td className={styles.code}>{it.code}</td>
                  <td className={styles.name}>{it.name}</td>
                  <td><span className={styles.pill}>{it.group}</span></td>
                  <td className={styles.sample}>{it.samples.join(", ") || "—"}</td>
                  <td className={styles.provider}>{it.provider}</td>
                  <td className={styles.price}>{vnd.format(it.listPrice)} ₫</td>
                  <td style={{ textAlign: "center" }}>
                    {canEdit ? (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <input type="number" min={0} style={tatInput} value={it.tatMinHours ?? ""} onChange={(e) => setTat(it.id, "tatMinHours", e.target.value)} onBlur={() => saveTat(it)} />
                        <span style={{ color: "var(--text-faint)" }}>–</span>
                        <input type="number" min={0} style={tatInput} value={it.tatMaxHours ?? ""} onChange={(e) => setTat(it.id, "tatMaxHours", e.target.value)} onBlur={() => saveTat(it)} />
                      </div>
                    ) : (
                      `${it.tatMinHours ?? "—"} – ${it.tatMaxHours ?? "—"}`
                    )}
                  </td>
                  {canManage && (
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button className={a.btn} onClick={() => setEditing(it)}>Sửa</button>{" "}
                      <button className={a.btn} onClick={() => doDelete(it)}>Xóa</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading && <div className={styles.state}>Đang tải…</div>}
        {!loading && error && <div className={styles.state}>{error}</div>}
        {!loading && !error && items.length === 0 && (
          <div className={styles.state}>Không tìm thấy xét nghiệm phù hợp.</div>
        )}
      </div>

      <div className={styles.pager}>
        <span className={styles.pageInfo}>
          {from}–{to} / {vnd.format(total)}
        </span>
        <button
          className={styles.pageBtn}
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          ← Trước
        </button>
        <span className={styles.pageInfo}>
          Trang {page}/{totalPages}
        </span>
        <button
          className={styles.pageBtn}
          disabled={page >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          Sau →
        </button>
      </div>

      {creating && (
        <CatalogModal
          token={token}
          groups={groups}
          providers={providers}
          onClose={() => setCreating(false)}
          onDone={() => { setCreating(false); reload(); }}
        />
      )}
      {editing && (
        <CatalogModal
          token={token}
          item={editing}
          groups={groups}
          providers={providers}
          onClose={() => setEditing(null)}
          onDone={() => { setEditing(null); reload(); }}
        />
      )}
    </div>
  );
}

// ---- Thêm/Sửa 1 xét nghiệm (admin) ----
function CatalogModal({ token, item, groups, providers, onClose, onDone }: {
  token?: string; item?: CatalogItem; groups: string[]; providers: string[];
  onClose: () => void; onDone: () => void;
}) {
  const [code, setCode] = useState(item?.code ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const [group, setGroup] = useState(item?.group ?? "");
  const [provider, setProvider] = useState(item?.provider ?? "");
  const [listPrice, setListPrice] = useState(String(item?.listPrice ?? ""));
  const [samples, setSamples] = useState((item?.samples ?? []).join(", "));
  const [tatMin, setTatMin] = useState(item?.tatMinHours != null ? String(item.tatMinHours) : "");
  const [tatMax, setTatMax] = useState(item?.tatMaxHours != null ? String(item.tatMaxHours) : "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError("");
    setBusy(true);
    const body: CatalogItemInput = {
      code: code.trim(), name: name.trim(), group: group.trim(), provider: provider.trim(),
      listPrice: Math.max(0, parseInt(listPrice, 10) || 0),
      samples: samples.split(",").map((s) => s.trim()).filter(Boolean),
      tatMinHours: tatMin === "" ? null : Math.max(0, parseInt(tatMin, 10) || 0),
      tatMaxHours: tatMax === "" ? null : Math.max(0, parseInt(tatMax, 10) || 0),
    };
    try {
      if (item) await updateCatalog(token, item.id, body);
      else await createCatalog(token, body);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi lưu");
      setBusy(false);
    }
  }

  return (
    <Modal
      title={item ? `Sửa: ${item.name}` : "Thêm xét nghiệm"}
      onClose={onClose}
      footer={
        <>
          <button className={a.btn} onClick={onClose}>Huỷ</button>
          <button className={`${a.btn} ${a.btnPrimary}`} onClick={submit} disabled={busy}>
            {busy ? "Đang lưu…" : item ? "Lưu" : "Tạo"}
          </button>
        </>
      }
    >
      {error && <div className={a.error}>{error}</div>}
      <div className={a.field}>
        <label className={a.label}>Mã xét nghiệm *</label>
        <input className={a.input} value={code} onChange={(e) => setCode(e.target.value)} />
      </div>
      <div className={a.field}>
        <label className={a.label}>Tên xét nghiệm *</label>
        <input className={a.input} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className={a.field}>
        <label className={a.label}>Nhóm</label>
        <input className={a.input} list="cat-groups" value={group} onChange={(e) => setGroup(e.target.value)} placeholder="VD: Sinh hóa" />
        <datalist id="cat-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
      </div>
      <div className={a.field}>
        <label className={a.label}>Nhà cung cấp *</label>
        <input className={a.input} list="cat-providers" value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="VD: FastLab" />
        <datalist id="cat-providers">{providers.map((p) => <option key={p} value={p} />)}</datalist>
      </div>
      <div className={a.field}>
        <label className={a.label}>Loại mẫu (cách nhau bằng dấu phẩy)</label>
        <input className={a.input} value={samples} onChange={(e) => setSamples(e.target.value)} placeholder="VD: M5, NT 24h" />
      </div>
      <div className={a.field}>
        <label className={a.label}>Giá niêm yết (₫)</label>
        <input className={a.input} type="number" min={0} value={listPrice} onChange={(e) => setListPrice(e.target.value)} />
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <div className={a.field} style={{ flex: 1 }}>
          <label className={a.label}>TG Min (giờ)</label>
          <input className={a.input} type="number" min={0} value={tatMin} onChange={(e) => setTatMin(e.target.value)} />
        </div>
        <div className={a.field} style={{ flex: 1 }}>
          <label className={a.label}>TG Max (giờ)</label>
          <input className={a.input} type="number" min={0} value={tatMax} onChange={(e) => setTatMax(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
