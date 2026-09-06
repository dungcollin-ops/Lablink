import { useEffect, useState, type CSSProperties } from "react";
import type { Session } from "../auth/session";
import {
  listOrders, getOrderFull, updateOrder, downloadResult,
  type OrderListItem, type OrderFull,
} from "../api/orders";
import { fetchCatalog, type CatalogItem } from "../api/catalog";
import { ApiError } from "../api/http";
import Modal from "./Modal";
import a from "../pages/admin.module.css";
import t from "../pages/Track.module.css";

const vnd = new Intl.NumberFormat("vi-VN");
const STAGE_LABEL: Record<string, string> = {
  Ordered: "Chờ lấy mẫu", Collected: "Đã soạn mẫu", Sent: "Đã gửi",
  Received: "Đã nhận", Running: "Đang chạy", Resulted: "Có kết quả",
};

interface EditItem {
  labTestId: string; code: string; name: string;
  samples: string[]; sampleType: string; qty: number; unitPrice: number;
}
interface PForm {
  fullName: string; dob: string; gender: string; phone: string; email: string;
  nationalId: string; bhyt: string; address: string; note: string;
  clinicName: string; doctorCode: string; diagnosis: string; orderNote: string;
}
const toPForm = (o: OrderFull): PForm => ({
  fullName: o.patient.fullName, dob: o.patient.dob ?? "", gender: o.patient.gender ?? "",
  phone: o.patient.phone ?? "", email: o.patient.email ?? "", nationalId: o.patient.nationalId ?? "",
  bhyt: o.patient.bhyt ?? "", address: o.patient.address ?? "", note: o.patient.note ?? "",
  clinicName: o.clinicName ?? "", doctorCode: o.doctorCode ?? "", diagnosis: o.diagnosis ?? "",
  orderNote: o.note ?? "",
});
const toEditItems = (o: OrderFull): EditItem[] => o.items.map((i) => ({
  labTestId: i.labTestId, code: i.testCode, name: i.testName,
  samples: [i.sampleType], sampleType: i.sampleType, qty: i.qty, unitPrice: i.unitPrice,
}));

export default function OrderLookup({ session }: { session: Session }) {
  const token = session.token;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OrderListItem[]>([]);
  const [detail, setDetail] = useState<OrderFull | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const h = setTimeout(() => {
      listOrders(token, query.trim()).then(setResults).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(h);
  }, [token, query]);

  async function openOrder(id: string) {
    setLoadingId(id);
    try {
      setDetail(await getOrderFull(token, id));
    } catch { /* ignore */ } finally { setLoadingId(null); }
  }

  return (
    <div className={t.card} style={{ padding: 16, marginBottom: 16 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Tìm phiếu chỉ định đã tạo</div>
      <input
        className={a.input}
        style={{ maxWidth: 480 }}
        placeholder="Mã phiếu / tên BN / mã BN / SID / xét nghiệm…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {results.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {results.map((o) => (
            <button
              key={o.id}
              onClick={() => openOrder(o.id)}
              disabled={loadingId === o.id}
              style={{
                display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                background: "var(--surface-2)", border: "1px solid var(--border)",
                borderRadius: 8, padding: "8px 12px", cursor: "pointer", font: "inherit",
              }}
            >
              <b style={{ color: "var(--action-hover)" }}>{o.orderNo}</b>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{STAGE_LABEL[o.stage] ?? o.stage}</span>
              <span>{o.patientName} <span style={{ color: "var(--text-faint)", fontSize: 12 }}>{o.patientMaBN}</span></span>
              <span style={{ marginLeft: "auto", fontWeight: 600 }}>{vnd.format(o.total)} ₫</span>
            </button>
          ))}
        </div>
      )}
      {query.trim().length >= 2 && results.length === 0 && (
        <div style={{ marginTop: 8, fontSize: 13, color: "var(--text-faint)" }}>Không tìm thấy phiếu.</div>
      )}

      {detail && (
        <OrderModal
          token={token}
          order={detail}
          onClose={() => setDetail(null)}
          onSaved={(o) => setDetail(o)}
        />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{label}</span>
      <span style={{ fontSize: 14 }}>{value?.trim() ? value : "—"}</span>
    </div>
  );
}

function OrderModal({ token, order, onClose, onSaved }: {
  token?: string; order: OrderFull; onClose: () => void; onSaved: (o: OrderFull) => void;
}) {
  const [o, setO] = useState<OrderFull>(order);
  const [editing, setEditing] = useState(false);
  const [pf, setPf] = useState<PForm>(() => toPForm(order));
  const [items, setItems] = useState<EditItem[]>(() => toEditItems(order));
  const [tQuery, setTQuery] = useState("");
  const [tResults, setTResults] = useState<CatalogItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { setO(order); }, [order]);
  useEffect(() => {
    if (!editing || tQuery.trim().length < 2) { setTResults([]); return; }
    const h = setTimeout(() => {
      fetchCatalog(token, { query: tQuery, pageSize: 8 })
        .then((r) => setTResults(r.items)).catch(() => setTResults([]));
    }, 250);
    return () => clearTimeout(h);
  }, [token, tQuery, editing]);

  function startEdit() {
    setPf(toPForm(o)); setItems(toEditItems(o)); setError(""); setEditing(true);
  }
  const setP = (k: keyof PForm, v: string) => setPf((s) => ({ ...s, [k]: v }));
  function addTest(it: CatalogItem) {
    setItems((c) => c.some((x) => x.labTestId === it.id) ? c : [...c, {
      labTestId: it.id, code: it.code, name: it.name,
      samples: it.samples.length ? it.samples : ["—"],
      sampleType: it.samples[0] ?? "—", qty: 1, unitPrice: it.listPrice,
    }]);
    setTQuery(""); setTResults([]);
  }
  const estTotal = items.reduce((sum, x) => sum + x.unitPrice * x.qty, 0);

  async function save() {
    setError("");
    if (!pf.fullName.trim()) { setError("Bắt buộc nhập họ tên bệnh nhân."); return; }
    if (items.length === 0) { setError("Cần ít nhất 1 xét nghiệm."); return; }
    setBusy(true);
    try {
      await updateOrder(token, o.id, {
        patient: {
          fullName: pf.fullName.trim(),
          dob: pf.dob || undefined, gender: pf.gender || undefined,
          phone: pf.phone || undefined, email: pf.email || undefined,
          nationalId: pf.nationalId || undefined, bhyt: pf.bhyt || undefined,
          address: pf.address || undefined, note: pf.note || undefined,
        },
        clinicName: pf.clinicName || undefined,
        doctorCode: pf.doctorCode || undefined,
        diagnosis: pf.diagnosis || undefined,
        note: pf.orderNote || undefined,
        items: items.map((x) => ({ labTestId: x.labTestId, sampleType: x.sampleType, qty: x.qty })),
      });
      const full = await getOrderFull(token, o.id);
      setO(full); onSaved(full); setEditing(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Lỗi lưu phiếu");
    } finally { setBusy(false); }
  }

  const grid3: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 };
  const blkTitle: CSSProperties = { fontSize: 11.5, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--text-faint)", margin: "16px 0 8px" };

  return (
    <Modal
      title={`Phiếu ${o.orderNo}`}
      onClose={onClose}
      footer={editing ? (
        <>
          <button className={a.btn} onClick={() => { setEditing(false); setError(""); }}>Huỷ</button>
          <button className={`${a.btn} ${a.btnPrimary}`} onClick={save} disabled={busy}>
            {busy ? "Đang lưu…" : "Lưu thay đổi"}
          </button>
        </>
      ) : (
        <>
          <button className={a.btn} onClick={onClose}>Đóng</button>
          {o.editable && <button className={`${a.btn} ${a.btnPrimary}`} onClick={startEdit}>Sửa phiếu</button>}
        </>
      )}
    >
      {/* Header trạng thái */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13 }}>
        <span style={{ padding: "2px 9px", borderRadius: 999, background: "var(--action-soft)", color: "var(--action-hover)", fontWeight: 600, fontSize: 12 }}>
          {STAGE_LABEL[o.stage] ?? o.stage}
        </span>
        <span style={{ color: "var(--text-muted)" }}>{o.source === "Doctor" ? "Bác sĩ" : "Khách lẻ"}</span>
        <span style={{ color: "var(--text-faint)" }}>Tạo: {new Date(o.createdAt).toLocaleString("vi-VN")}</span>
        <span style={{ marginLeft: "auto", fontWeight: 700 }}>{vnd.format(o.total)} ₫</span>
      </div>
      {!o.editable && !editing && (
        <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--warning-text)" }}>
          Phiếu đã gửi phòng xét nghiệm — chỉ xem, không sửa được.
        </div>
      )}

      {!editing ? (
        <>
          {/* ---- XEM ---- */}
          <div style={blkTitle}>Bệnh nhân</div>
          <div style={grid3}>
            <Row label="Mã BN" value={o.patient.maBN} />
            <Row label="Họ tên" value={o.patient.fullName} />
            <Row label="Ngày sinh" value={o.patient.dob} />
            <Row label="Giới tính" value={o.patient.gender} />
            <Row label="Điện thoại" value={o.patient.phone} />
            <Row label="Email" value={o.patient.email} />
            <Row label="CCCD" value={o.patient.nationalId} />
            <Row label="BHYT" value={o.patient.bhyt} />
            <Row label="Địa chỉ" value={o.patient.address} />
          </div>

          <div style={blkTitle}>Chỉ định</div>
          <div style={grid3}>
            <Row label="Bác sĩ chỉ định" value={o.doctorCode} />
            <Row label="Phòng khám" value={o.clinicName} />
            <Row label="Chẩn đoán" value={o.diagnosis} />
            <Row label="Ghi chú" value={o.note} />
          </div>

          <div style={blkTitle}>Xét nghiệm ({o.items.length})</div>
          {o.items.map((i) => (
            <div key={i.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "5px 0", borderBottom: "1px dashed var(--divider)", fontSize: 14 }}>
              <span><span className={a.mono}>{i.testCode}</span> {i.testName} <span style={{ color: "var(--text-faint)", fontSize: 12 }}>· {i.sampleType}{i.qty > 1 ? ` ×${i.qty}` : ""}</span></span>
              <span style={{ whiteSpace: "nowrap", color: "var(--text-muted)" }}>{vnd.format(i.unitPrice * i.qty)} ₫</span>
            </div>
          ))}

          {o.samples.length > 0 && (
            <>
              <div style={blkTitle}>Mã SID</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {o.samples.map((s) => (
                  <span key={s.id} style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, fontWeight: 600, background: "var(--sid-soft)", color: "var(--sid)", padding: "3px 8px", borderRadius: 6 }}>
                    {s.sid} · {s.sampleType}
                  </span>
                ))}
              </div>
            </>
          )}

          {o.hasResult && (
            <>
              <div style={blkTitle}>Kết quả</div>
              <button className={`${a.btn} ${a.btnPrimary}`} onClick={() => downloadResult(token, o.id, o.resultFileName ?? undefined)}>
                ⭳ {o.resultFileName}
              </button>
            </>
          )}
        </>
      ) : (
        <>
          {/* ---- SỬA ---- */}
          {error && <div className={a.error} style={{ marginTop: 12 }}>{error}</div>}
          <div style={{ fontSize: 12, color: "var(--text-muted)", margin: "12px 0 0" }}>
            Sửa thông tin bệnh nhân sẽ <b>cập nhật vào hồ sơ (danh mục BN)</b>. Bác sĩ / phòng khám / chẩn đoán / xét nghiệm chỉ áp cho phiếu này.
          </div>

          <div style={blkTitle}>Bệnh nhân (mã BN {o.patient.maBN})</div>
          <div style={grid3}>
            <Field label="Họ tên *" v={pf.fullName} on={(x) => setP("fullName", x)} />
            <Field label="Ngày sinh" type="date" v={pf.dob} on={(x) => setP("dob", x)} />
            <FieldSel label="Giới tính" v={pf.gender} on={(x) => setP("gender", x)} opts={[["", "—"], ["Nam", "Nam"], ["Nữ", "Nữ"]]} />
            <Field label="Điện thoại" v={pf.phone} on={(x) => setP("phone", x)} />
            <Field label="Email" v={pf.email} on={(x) => setP("email", x)} />
            <Field label="CCCD" v={pf.nationalId} on={(x) => setP("nationalId", x)} />
            <Field label="BHYT" v={pf.bhyt} on={(x) => setP("bhyt", x)} />
            <Field label="Địa chỉ" v={pf.address} on={(x) => setP("address", x)} />
          </div>

          <div style={blkTitle}>Chỉ định (theo phiếu)</div>
          <div style={grid3}>
            <Field label="Bác sĩ chỉ định" v={pf.doctorCode} on={(x) => setP("doctorCode", x)} />
            <Field label="Phòng khám" v={pf.clinicName} on={(x) => setP("clinicName", x)} />
            <Field label="Chẩn đoán" v={pf.diagnosis} on={(x) => setP("diagnosis", x)} />
            <Field label="Ghi chú" v={pf.orderNote} on={(x) => setP("orderNote", x)} />
          </div>

          <div style={blkTitle}>Xét nghiệm ({items.length})</div>
          {items.map((x) => (
            <div key={x.labTestId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px dashed var(--divider)" }}>
              <span style={{ flex: 1, fontSize: 14 }}><span className={a.mono}>{x.code}</span> {x.name} <span style={{ color: "var(--text-faint)", fontSize: 12 }}>· {x.sampleType}</span></span>
              <input
                type="number" min={1} value={x.qty}
                onChange={(e) => setItems((c) => c.map((y) => y.labTestId === x.labTestId ? { ...y, qty: Math.max(1, Number(e.target.value) || 1) } : y))}
                style={{ width: 56, padding: "4px 6px", border: "1px solid var(--border)", borderRadius: 6 }}
              />
              <span style={{ width: 90, textAlign: "right", fontSize: 13, color: "var(--text-muted)" }}>{vnd.format(x.unitPrice * x.qty)} ₫</span>
              <button className={`${a.btn} ${a.btnDanger}`} style={{ minHeight: 28, padding: "0 8px" }}
                onClick={() => setItems((c) => c.filter((y) => y.labTestId !== x.labTestId))}>×</button>
            </div>
          ))}

          <div style={{ marginTop: 10, position: "relative" }}>
            <input className={a.input} placeholder="＋ Thêm xét nghiệm (tìm tên / mã)…"
              value={tQuery} onChange={(e) => setTQuery(e.target.value)} />
            {tResults.length > 0 && (
              <div style={{ marginTop: 6, border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                {tResults.map((it) => (
                  <button key={it.id} onClick={() => addTest(it)}
                    style={{ display: "flex", width: "100%", justifyContent: "space-between", gap: 10, textAlign: "left", padding: "8px 12px", background: "var(--white)", border: "none", borderBottom: "1px solid var(--divider)", cursor: "pointer", font: "inherit" }}>
                    <span><span className={a.mono}>{it.code}</span> {it.name}</span>
                    <span style={{ color: "var(--text-faint)", fontSize: 12, whiteSpace: "nowrap" }}>{vnd.format(it.listPrice)} ₫</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border-2)", fontWeight: 600 }}>
            <span>{items.length} XN · tạm tính</span>
            <span>{vnd.format(estTotal)} ₫</span>
          </div>
        </>
      )}
    </Modal>
  );
}

function Field({ label, v, on, type }: { label: string; v: string; on: (x: string) => void; type?: string }) {
  return (
    <div className={a.field} style={{ marginBottom: 0 }}>
      <label className={a.label}>{label}</label>
      <input className={a.input} type={type ?? "text"} value={v} onChange={(e) => on(e.target.value)} />
    </div>
  );
}
function FieldSel({ label, v, on, opts }: { label: string; v: string; on: (x: string) => void; opts: [string, string][] }) {
  return (
    <div className={a.field} style={{ marginBottom: 0 }}>
      <label className={a.label}>{label}</label>
      <select className={a.input} value={v} onChange={(e) => on(e.target.value)}>
        {opts.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
      </select>
    </div>
  );
}
