import { useEffect, useState, type CSSProperties } from "react";
import { getOrderFull, updateOrder, setOrderStage, type OrderFull } from "../api/orders";
import { fetchCatalog, type CatalogItem } from "../api/catalog";
import { ApiError } from "../api/http";
import { allowedNext, STAGE_ACTION } from "../workflow";
import Modal from "./Modal";
import ResultViewer from "./ResultViewer";
import a from "../pages/admin.module.css";

const vnd = new Intl.NumberFormat("vi-VN");
const STAGE_LABEL: Record<string, string> = {
  Ordered: "Chờ lấy mẫu", Collected: "Đã lấy mẫu", Gathered: "Đã gom mẫu",
  Received: "Đã nhận mẫu", Resulted: "Có kết quả",
  HardCopySent: "Đã giao bản cứng", HardCopyReceived: "Đã nhận bản cứng",
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

/** Modal xem đầy đủ + sửa 1 phiếu (tự tải theo orderId). onSaved() báo caller làm mới danh sách. */
export default function OrderDetailModal({ token, orderId, perms, onClose, onSaved }: {
  token?: string; orderId: string; perms: string[]; onClose: () => void; onSaved?: () => void;
}) {
  const [order, setOrder] = useState<OrderFull | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    getOrderFull(token, orderId)
      .then((o) => { if (alive) setOrder(o); })
      .catch((e) => setErr(e instanceof ApiError ? e.message : "Không tải được phiếu"));
    return () => { alive = false; };
  }, [token, orderId]);

  if (err) {
    return (
      <Modal title="Phiếu" onClose={onClose} footer={<button className={a.btn} onClick={onClose}>Đóng</button>}>
        <div className={a.error}>{err}</div>
      </Modal>
    );
  }
  if (!order) {
    return (
      <Modal title="Phiếu" onClose={onClose}>
        <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Đang tải…</div>
      </Modal>
    );
  }
  return (
    <OrderModal
      token={token}
      order={order}
      perms={perms}
      onClose={onClose}
      onSaved={(o) => { setOrder(o); onSaved?.(); }}
    />
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

function OrderModal({ token, order, perms, onClose, onSaved }: {
  token?: string; order: OrderFull; perms: string[]; onClose: () => void; onSaved: (o: OrderFull) => void;
}) {
  const [o, setO] = useState<OrderFull>(order);
  const [editing, setEditing] = useState(false);
  const [by, setBy] = useState("");
  const [advancing, setAdvancing] = useState(false);
  const [pf, setPf] = useState<PForm>(() => toPForm(order));
  const [items, setItems] = useState<EditItem[]>(() => toEditItems(order));
  const [tQuery, setTQuery] = useState("");
  const [tResults, setTResults] = useState<CatalogItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState(false);

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

  const nx = !editing ? allowedNext(o.stage, perms) : null;
  async function advance() {
    if (!nx) return;
    setAdvancing(true);
    try {
      await setOrderStage(token, o.id, nx.stage, nx.stage === "Collected" ? (by.trim() || undefined) : undefined);
      const full = await getOrderFull(token, o.id);
      setO(full); onSaved(full); setBy("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Lỗi chuyển bước");
    } finally { setAdvancing(false); }
  }

  const grid3: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 };
  const blkTitle: CSSProperties = { fontSize: 11.5, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--text-faint)", margin: "16px 0 8px" };

  return (
    <>
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
          Phiếu đã chuyển cho phòng xét nghiệm — chỉ xem, không sửa được.
        </div>
      )}

      {nx && (
        <div style={{ marginTop: 12, padding: "10px 12px", background: "var(--action-soft)", borderRadius: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "var(--action-hover)", fontWeight: 600 }}>Bước kế của bạn:</span>
          {nx.stage === "Collected" && (
            <input className={a.input} style={{ maxWidth: 200 }} placeholder="Người lấy mẫu (tuỳ chọn)" value={by} onChange={(e) => setBy(e.target.value)} />
          )}
          <button className={`${a.btn} ${a.btnPrimary}`} style={{ marginLeft: "auto" }} disabled={advancing} onClick={advance}>
            {advancing ? "Đang lưu…" : `✓ ${STAGE_ACTION[nx.stage] ?? nx.stage}`}
          </button>
        </div>
      )}

      {!editing ? (
        <>
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
              <button className={`${a.btn} ${a.btnPrimary}`} onClick={() => setViewing(true)}>
                👁 Xem kết quả ({o.resultFileName})
              </button>
            </>
          )}

          {o.events && o.events.length > 0 && (
            <>
              <div style={blkTitle}>Lịch sử xử lý (ai làm gì lúc nào)</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {o.events.map((ev, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "baseline", fontSize: 13, borderBottom: "1px dashed var(--divider)", paddingBottom: 6 }}>
                    <span style={{ minWidth: 128, fontWeight: 600, color: "var(--action-hover)" }}>{STAGE_LABEL[ev.step] ?? ev.step}</span>
                    <span style={{ flex: 1 }}>{ev.actorName || "—"}{ev.note ? ` · ${ev.note}` : ""}</span>
                    <span style={{ color: "var(--text-faint)", fontSize: 12, whiteSpace: "nowrap" }}>{new Date(ev.at).toLocaleString("vi-VN")}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <>
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
    {viewing && (
      <ResultViewer token={token} orderId={o.id} orderNo={o.orderNo} onClose={() => setViewing(false)} />
    )}
    </>
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
