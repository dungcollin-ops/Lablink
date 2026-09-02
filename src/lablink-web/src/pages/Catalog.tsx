import { useEffect, useState } from "react";
import {
  fetchCatalog,
  fetchFacets,
  type CatalogItem,
} from "../api/catalog";
import type { Session } from "../auth/session";
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
  }, [token, query, group, provider, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div>
      <div className={styles.head}>
        <div className={styles.h1}>Danh mục &amp; giá niêm yết</div>
        <div className={styles.count}>{vnd.format(total)} xét nghiệm</div>
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
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td className={styles.code}>{it.code}</td>
                  <td className={styles.name}>{it.name}</td>
                  <td><span className={styles.pill}>{it.group}</span></td>
                  <td className={styles.provider}>{it.samples.join(", ") || "—"}</td>
                  <td className={styles.provider}>{it.provider}</td>
                  <td className={styles.price}>{vnd.format(it.listPrice)} ₫</td>
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
    </div>
  );
}
