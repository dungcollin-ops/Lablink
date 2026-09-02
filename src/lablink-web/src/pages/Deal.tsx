import { useCallback, useEffect, useState } from "react";
import type { Session } from "../auth/session";
import { fetchCatalog, type CatalogItem } from "../api/catalog";
import { createDealBatch, myDeals, type DealBatch } from "../api/deals";
import { ApiError } from "../api/http";
import a from "./admin.module.css";
import d from "./Deal.module.css";

const vnd = new Intl.NumberFormat("vi-VN");

const STATUS: Record<string, { cls: string; label: string }> = {
  Pending: { cls: d.pending, label: "Chờ duyệt" },
  Approved: { cls: d.approved, label: "Đã chốt" },
  Rejected: { cls: d.rejected, label: "Từ chối" },
};

interface CartLine {
  labTestId: string;
  code: string;
  name: string;
  listPrice: number;
  proposedPrice: number;
}

export default function Deal({ session }: { session: Session }) {
  const token = session.token;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogItem[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [batches, setBatches] = useState<DealBatch[]>([]);

  const reload = useCallback(() => {
    myDeals(token).then(setBatches).catch(() => {});
  }, [token]);

  useEffect(reload, [reload]);

  // Tìm danh mục (debounce)
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const h = setTimeout(() => {
      fetchCatalog(token, { query, pageSize: 8 })
        .then((r) => setResults(r.items))
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(h);
  }, [token, query]);

  function add(item: CatalogItem) {
    setCart((c) =>
      c.some((x) => x.labTestId === item.id)
        ? c
        : [...c, { labTestId: item.id, code: item.code, name: item.name, listPrice: item.listPrice, proposedPrice: item.listPrice }],
    );
    setQuery("");
    setResults([]);
  }

  function setPrice(id: string, v: string) {
    const n = Number(v.replace(/\D/g, "")) || 0;
    setCart((c) => c.map((x) => (x.labTestId === id ? { ...x, proposedPrice: n } : x)));
  }

  const totalProposed = cart.reduce((s, x) => s + x.proposedPrice, 0);

  async function submit() {
    if (cart.length === 0) return;
    setBusy(true);
    setError("");
    try {
      await createDealBatch(token, {
        note: note.trim() || undefined,
        items: cart.map((x) => ({ labTestId: x.labTestId, proposedPrice: x.proposedPrice })),
      });
      setCart([]);
      setNote("");
      reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Lỗi gửi đề nghị");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className={a.head}>
        <div className={a.h1}>Chốt giá xét nghiệm</div>
      </div>

      <div className={d.layout}>
        <div>
          <div className={d.searchBox}>
            <input
              className={a.search}
              style={{ width: "100%" }}
              placeholder="Tìm xét nghiệm để đề nghị giá…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {results.length > 0 && (
              <div className={d.results}>
                {results.map((r) => (
                  <button key={r.id} className={d.resultRow} onClick={() => add(r)}>
                    <span>
                      <span className={a.mono}>{r.code}</span> {r.name}
                    </span>
                    <span className={d.resultMeta}>{r.provider} · {vnd.format(r.listPrice)} ₫</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={d.sent}>
            <div className={d.sentTitle}>Đề nghị đã gửi</div>
            {batches.length === 0 && <div className={d.cartEmpty}>Chưa có đề nghị nào.</div>}
            {batches.map((b) => (
              <div key={b.id} className={d.batch}>
                <div className={d.batchHead}>
                  <span>{new Date(b.createdAt).toLocaleString("vi-VN")}</span>
                  {b.note && <span>“{b.note}”</span>}
                </div>
                {b.items.map((i) => {
                  const st = STATUS[i.status] ?? STATUS.Pending;
                  return (
                    <div key={i.id} className={d.line}>
                      <span className={d.lineName}>{i.name}</span>
                      <span className={d.lineNums}>
                        {vnd.format(i.listPrice)} → {vnd.format(i.proposedPrice)} ₫ ({i.diffPercent}%)
                      </span>
                      <span className={`${d.badge} ${st.cls}`}>{st.label}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className={d.cart}>
          <div className={d.cartTitle}>Đề nghị của bạn</div>
          {cart.length === 0 && <div className={d.cartEmpty}>Tìm và thêm xét nghiệm để đề nghị giá.</div>}
          {cart.map((x) => (
            <div key={x.labTestId} className={d.cartLine}>
              <div>
                <div className={d.cartName}>{x.name}</div>
                <div className={d.cartListed}>Niêm yết {vnd.format(x.listPrice)} ₫</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input
                  className={d.priceInput}
                  value={vnd.format(x.proposedPrice)}
                  onChange={(e) => setPrice(x.labTestId, e.target.value)}
                />
                <button className={d.remove} onClick={() => setCart((c) => c.filter((y) => y.labTestId !== x.labTestId))}>
                  ×
                </button>
              </div>
            </div>
          ))}

          {cart.length > 0 && (
            <>
              <textarea
                className={d.note}
                placeholder="Ghi chú gửi kèm (tuỳ chọn)…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className={d.summary}>
                <span>{cart.length} xét nghiệm</span>
                <span className={d.total}>{vnd.format(totalProposed)} ₫</span>
              </div>
            </>
          )}
          {error && <div className={a.error}>{error}</div>}
          <button className={d.submit} onClick={submit} disabled={busy || cart.length === 0}>
            {busy ? "Đang gửi…" : "Gửi phòng xét nghiệm duyệt"}
          </button>
        </div>
      </div>
    </div>
  );
}
