import { useEffect, useState } from "react";
import { fetchCatalog, fetchFacets, type CatalogItem } from "../api/catalog";
import Modal from "./Modal";
import a from "../pages/admin.module.css";

const vnd = new Intl.NumberFormat("vi-VN");
const PAGE_SIZE = 20;

interface Props {
  token?: string;
  addedIds: Set<string>;
  onAdd: (it: CatalogItem) => void;
  onClose: () => void;
}

/** Popup duyệt toàn bộ danh mục xét nghiệm: tìm theo tên/mã, lọc nhóm, phân trang, click để thêm. */
export default function CatalogPicker({ token, addedIds, onAdd, onClose }: Props) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("");
  const [groups, setGroups] = useState<string[]>([]);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFacets(token).then((f) => setGroups(f.groups)).catch(() => {});
  }, [token]);

  useEffect(() => { setPage(1); }, [q, group]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    const h = setTimeout(() => {
      fetchCatalog(token, { query: q || undefined, group: group || undefined, page, pageSize: PAGE_SIZE })
        .then((r) => { if (live) { setItems(r.items); setTotal(r.total); } })
        .catch(() => { if (live) { setItems([]); setTotal(0); } })
        .finally(() => { if (live) setLoading(false); });
    }, 250);
    return () => { live = false; clearTimeout(h); };
  }, [token, q, group, page]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Modal title="Danh mục xét nghiệm" onClose={onClose}>
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <input
          className={a.input}
          style={{ flex: 1, minWidth: 200 }}
          placeholder="Tìm tên hoặc mã xét nghiệm…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        <select className={a.input} style={{ maxWidth: 220 }} value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="">Tất cả nhóm</option>
          {groups.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 6 }}>
        {loading ? "Đang tải…" : `${total} kết quả`}
      </div>

      <div style={{ maxHeight: "50vh", overflowY: "auto", border: "1px solid var(--border-2)", borderRadius: "var(--radius-control)" }}>
        {items.map((it) => {
          const added = addedIds.has(it.id);
          return (
            <div
              key={it.id}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5 }}>
                  <span className={a.mono} style={{ color: "var(--action-hover)" }}>{it.code}</span> {it.name}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                  {it.group} · {it.provider} · {vnd.format(it.listPrice)} ₫
                </div>
              </div>
              <button
                className={`${a.btn} ${added ? "" : a.btnPrimary}`}
                disabled={added}
                onClick={() => onAdd(it)}
                style={{ whiteSpace: "nowrap" }}
              >
                {added ? "✓ Đã thêm" : "＋ Thêm"}
              </button>
            </div>
          );
        })}
        {!loading && items.length === 0 && (
          <div style={{ padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            Không tìm thấy xét nghiệm phù hợp.
          </div>
        )}
      </div>

      {pages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 10 }}>
          <button className={a.btn} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Trước</button>
          <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Trang {page}/{pages}</span>
          <button className={a.btn} disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Sau →</button>
        </div>
      )}
    </Modal>
  );
}
