import { useEffect, useState } from "react";
import { fetchResultBlob } from "../api/orders";
import a from "../pages/admin.module.css";

interface Loaded { url: string; type: string; name: string }

/** Xem file kết quả xét nghiệm trực tiếp (PDF / ảnh / SVG) trong một cửa sổ lớn. */
export default function ResultViewer({ token, orderId, orderNo, onClose }: {
  token?: string; orderId: string; orderNo: string; onClose: () => void;
}) {
  const [data, setData] = useState<Loaded | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let created = "";
    let alive = true;
    fetchResultBlob(token, orderId)
      .then((r) => { if (alive) { created = r.url; setData(r); } else { URL.revokeObjectURL(r.url); } })
      .catch((e) => setErr(e?.message ?? "Lỗi tải kết quả"));
    return () => { alive = false; if (created) URL.revokeObjectURL(created); };
  }, [token, orderId]);

  const name = (data?.name ?? "").toLowerCase();
  const isPdf = !!data && (data.type.includes("pdf") || name.endsWith(".pdf"));
  const isImg = !!data && (data.type.includes("image") || /\.(png|jpe?g|gif|webp|svg)$/.test(name));

  function download() {
    if (!data) return;
    const link = document.createElement("a");
    link.href = data.url;
    link.download = data.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(15,33,63,.55)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--white)", borderRadius: 12, width: "min(960px,96vw)", height: "92vh",
          display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "var(--shadow-modal)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <b style={{ color: "var(--text-title)" }}>Kết quả · {orderNo}</b>
          {data && <span style={{ fontSize: 12, color: "var(--text-faint)" }}>{data.name}</span>}
          <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {data && <button className={`${a.btn} ${a.btnPrimary}`} onClick={download}>⭳ Tải về</button>}
            <button className={a.btn} onClick={onClose}>Đóng</button>
          </span>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: "auto", background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {err && <div className={a.error} style={{ margin: 20 }}>{err}</div>}
          {!data && !err && <div style={{ color: "var(--text-muted)" }}>Đang tải…</div>}
          {data && isPdf && (
            <iframe title={`Kết quả ${orderNo}`} src={data.url} style={{ width: "100%", height: "100%", border: "none", background: "#fff" }} />
          )}
          {data && !isPdf && isImg && (
            <img src={data.url} alt={`Kết quả ${orderNo}`} style={{ maxWidth: "100%", height: "auto", display: "block", padding: 16 }} />
          )}
          {data && !isPdf && !isImg && (
            <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
              Định dạng này không xem trực tiếp được.<br />
              <button className={`${a.btn} ${a.btnPrimary}`} style={{ marginTop: 12 }} onClick={download}>⭳ Tải về để mở</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
