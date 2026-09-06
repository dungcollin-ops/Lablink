import { useEffect, useState } from "react";
import type { Session } from "../auth/session";
import { fetchCatalog, type CatalogItem } from "../api/catalog";
import {
  createOrder,
  searchPatients,
  type OrderDto,
  type PatientSearch,
} from "../api/orders";
import { ApiError } from "../api/http";
import { COMBOS } from "../combos";
import QrScan, { type CccdData } from "../components/QrScan";
import OrderLookup from "../components/OrderLookup";
import a from "./admin.module.css";
import s from "./OrderForm.module.css";

const vnd = new Intl.NumberFormat("vi-VN");
const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

interface Patient {
  maBN: string;
  fullName: string;
  dob: string;
  gender: string;
  phone: string;
  email: string;
  nationalId: string;
  bhyt: string;
  address: string;
  note: string;
}
const emptyPatient: Patient = {
  maBN: "", fullName: "", dob: "", gender: "", phone: "",
  email: "", nationalId: "", bhyt: "", address: "", note: "",
};

interface CartLine {
  labTestId: string;
  code: string;
  name: string;
  samples: string[];
  sampleType: string;
  qty: number;
  listPrice: number;
}

interface Props {
  session: Session;
  mode: "doctor" | "retail";
  onNavigate: (view: string) => void;
}

export default function OrderForm({ session, mode, onNavigate }: Props) {
  const token = session.token;
  const isDoctor = mode === "doctor";

  const [patient, setPatient] = useState<Patient>(emptyPatient);
  const [diagnosis, setDiagnosis] = useState("");
  const [doctorCode, setDoctorCode] = useState("");
  const [clinicName, setClinicName] = useState("");

  const [pQuery, setPQuery] = useState("");
  const [pResults, setPResults] = useState<PatientSearch[]>([]);

  const [tQuery, setTQuery] = useState("");
  const [tResults, setTResults] = useState<CatalogItem[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);

  const [emailErr, setEmailErr] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<OrderDto | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [comboBusy, setComboBusy] = useState("");

  const set = (k: keyof Patient, v: string) => setPatient((p) => ({ ...p, [k]: v }));

  // Tìm bệnh nhân cũ (bác sĩ)
  useEffect(() => {
    if (!isDoctor || pQuery.trim().length < 2) {
      setPResults([]);
      return;
    }
    const h = setTimeout(() => {
      searchPatients(token, pQuery).then(setPResults).catch(() => setPResults([]));
    }, 250);
    return () => clearTimeout(h);
  }, [token, pQuery, isDoctor]);

  // Tìm xét nghiệm
  useEffect(() => {
    if (tQuery.trim().length < 2) {
      setTResults([]);
      return;
    }
    const h = setTimeout(() => {
      fetchCatalog(token, { query: tQuery, pageSize: 8 })
        .then((r) => setTResults(r.items))
        .catch(() => setTResults([]));
    }, 250);
    return () => clearTimeout(h);
  }, [token, tQuery]);

  function pickPatient(p: PatientSearch) {
    setPatient({
      ...emptyPatient,
      maBN: p.maBN,
      fullName: p.fullName,
      dob: p.dob ?? "",
      gender: p.gender ?? "",
      phone: p.phone ?? "",
      address: p.address ?? "",
    });
    setPQuery("");
    setPResults([]);
  }

  function addTest(it: CatalogItem) {
    setCart((c) =>
      c.some((x) => x.labTestId === it.id)
        ? c
        : [...c, {
            labTestId: it.id, code: it.code, name: it.name,
            samples: it.samples.length ? it.samples : ["—"],
            sampleType: it.samples[0] ?? "—", qty: 1, listPrice: it.listPrice,
          }],
    );
    setTQuery("");
    setTResults([]);
  }

  async function applyCombo(name: string, queries: string[]) {
    setComboBusy(name);
    try {
      for (const q of queries) {
        const r = await fetchCatalog(token, { query: q, pageSize: 1 });
        if (r.items[0]) addTest(r.items[0]);
      }
    } finally {
      setComboBusy("");
      setTQuery("");
      setTResults([]);
    }
  }

  function applyCccd(d: CccdData) {
    setPatient((p) => ({
      ...p,
      fullName: d.fullName ?? p.fullName,
      dob: d.dob ?? p.dob,
      gender: d.gender === "Nam" || d.gender === "Nữ" ? d.gender : p.gender,
      nationalId: d.nationalId ?? p.nationalId,
      address: d.address ?? p.address,
    }));
  }

  const estTotal = cart.reduce((sum, x) => sum + x.listPrice * x.qty, 0);

  async function submit() {
    setError("");
    if (!patient.fullName.trim()) return setError("Bắt buộc nhập họ tên bệnh nhân.");
    if (cart.length === 0) return setError("Cần ít nhất 1 xét nghiệm.");
    const email = patient.email.replace(/\s/g, "").toLowerCase();
    if (email && !EMAIL.test(email)) {
      setEmailErr(true);
      return setError("Email không hợp lệ — ví dụ: ten@benhvien.vn");
    }
    setBusy(true);
    try {
      const order = await createOrder(token, {
        source: mode,
        patient: {
          maBN: patient.maBN || undefined,
          fullName: patient.fullName.trim(),
          dob: patient.dob || undefined,
          gender: patient.gender || undefined,
          phone: patient.phone || undefined,
          email: email || undefined,
          nationalId: patient.nationalId || undefined,
          bhyt: patient.bhyt || undefined,
          address: patient.address || undefined,
          note: patient.note || undefined,
        },
        clinicName: isDoctor ? clinicName || undefined : undefined,
        doctorCode: isDoctor ? doctorCode || undefined : undefined,
        diagnosis: isDoctor ? diagnosis || undefined : undefined,
        items: cart.map((x) => ({ labTestId: x.labTestId, sampleType: x.sampleType, qty: x.qty })),
      });
      setCreated(order);
      setCart([]);
      setPatient(emptyPatient);
      setDiagnosis("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Lỗi gửi chỉ định");
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <div>
        <div className={a.head}>
          <div className={a.h1}>{isDoctor ? "Chỉ định cho bệnh nhân" : "Đặt xét nghiệm"}</div>
        </div>
        <div className={s.success}>
          <div className={s.successTitle}>✓ Đã gửi chỉ định tới phòng xét nghiệm</div>
          <div>
            Phiếu <strong>{created.orderNo}</strong> · BN {created.patientName} ({created.patientMaBN}) ·
            Tổng <strong>{vnd.format(created.total)} ₫</strong>
          </div>
          <div className={s.sidList}>
            {created.samples.map((sm) => (
              <span key={sm.id} className={s.sidChip}>{sm.sid} · {sm.sampleType}</span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button className={`${a.btn} ${a.btnPrimary}`} onClick={() => onNavigate("track")}>
              Xem theo dõi
            </button>
            <button className={a.btn} onClick={() => setCreated(null)}>Tạo phiếu mới</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className={a.head}>
        <div className={a.h1}>{isDoctor ? "Chỉ định cho bệnh nhân" : "Đặt xét nghiệm"}</div>
      </div>

      {isDoctor && <OrderLookup session={session} />}

      <div className={s.layout}>
        <div>
          <div className={s.section}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className={s.sectionTitle}>Thông tin bệnh nhân</div>
              <button type="button" className={a.btn} onClick={() => setQrOpen(true)}>⛶ Quét QR CCCD</button>
            </div>

            {isDoctor && (
              <div className={s.searchBox} style={{ marginBottom: 12 }}>
                <input
                  className={s.input}
                  style={{ width: "100%" }}
                  placeholder="Tìm bệnh nhân cũ (tên / mã BN / CCCD / SĐT)…"
                  value={pQuery}
                  onChange={(e) => setPQuery(e.target.value)}
                />
                {pResults.length > 0 && (
                  <div className={s.results}>
                    {pResults.map((p) => (
                      <button key={p.id} className={s.resultRow} onClick={() => pickPatient(p)}>
                        <span>{p.fullName} · <span className={a.mono}>{p.maBN}</span></span>
                        <span className={s.resultMeta}>{p.phone ?? ""}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className={s.grid}>
              {isDoctor && (
                <div className={s.field}>
                  <label className={s.label}>Mã BN (tự sinh nếu trống)</label>
                  <input className={s.input} value={patient.maBN} onChange={(e) => set("maBN", e.target.value)} />
                </div>
              )}
              <div className={s.field}>
                <label className={s.label}>Họ tên *</label>
                <input className={s.input} value={patient.fullName} onChange={(e) => set("fullName", e.target.value)} />
              </div>
              <div className={s.field}>
                <label className={s.label}>Ngày sinh</label>
                <input className={s.input} type="date" value={patient.dob} onChange={(e) => set("dob", e.target.value)} />
              </div>
              <div className={s.field}>
                <label className={s.label}>Giới tính</label>
                <select className={s.select} value={patient.gender} onChange={(e) => set("gender", e.target.value)}>
                  <option value="">—</option>
                  <option value="Nam">Nam</option>
                  <option value="Nữ">Nữ</option>
                </select>
              </div>
              <div className={s.field}>
                <label className={s.label}>Điện thoại</label>
                <input className={s.input} value={patient.phone} onChange={(e) => set("phone", e.target.value)} />
              </div>
              <div className={s.field}>
                <label className={s.label}>Email</label>
                <input
                  className={`${s.input} ${emailErr ? s.inputError : ""}`}
                  value={patient.email}
                  onChange={(e) => { set("email", e.target.value); setEmailErr(false); }}
                  placeholder="ten@benhvien.vn"
                />
                {emailErr && <span className={s.errText}>Email không hợp lệ</span>}
              </div>
              <div className={s.field}>
                <label className={s.label}>CCCD</label>
                <input className={s.input} value={patient.nationalId} onChange={(e) => set("nationalId", e.target.value)} />
              </div>
              <div className={s.field}>
                <label className={s.label}>BHYT</label>
                <input className={s.input} value={patient.bhyt} onChange={(e) => set("bhyt", e.target.value)} />
              </div>
              <div className={`${s.field} ${s.span2}`}>
                <label className={s.label}>Địa chỉ</label>
                <input className={s.input} value={patient.address} onChange={(e) => set("address", e.target.value)} />
              </div>

              {isDoctor && (
                <>
                  <div className={`${s.field} ${s.span2}`}>
                    <label className={s.label}>Chẩn đoán</label>
                    <input className={s.input} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
                  </div>
                  <div className={s.field}>
                    <label className={s.label}>Bác sĩ chỉ định</label>
                    <input className={s.input} value={doctorCode} onChange={(e) => setDoctorCode(e.target.value)} />
                  </div>
                  <div className={s.field}>
                    <label className={s.label}>Phòng khám</label>
                    <input className={s.input} value={clinicName} onChange={(e) => setClinicName(e.target.value)} />
                  </div>
                </>
              )}
              {!isDoctor && (
                <div className={`${s.field} ${s.span2}`}>
                  <label className={s.label}>Ghi chú</label>
                  <input className={s.input} value={patient.note} onChange={(e) => set("note", e.target.value)} />
                </div>
              )}
            </div>
          </div>

          <div className={s.section}>
            <div className={s.sectionTitle}>Chọn xét nghiệm</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {COMBOS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  className={a.btn}
                  disabled={comboBusy !== ""}
                  onClick={() => applyCombo(c.name, c.queries)}
                >
                  {comboBusy === c.name ? "Đang thêm…" : `＋ ${c.name}`}
                </button>
              ))}
            </div>
            <div className={s.searchBox}>
              <input
                className={s.input}
                style={{ width: "100%" }}
                placeholder="Tìm tên hoặc mã xét nghiệm…"
                value={tQuery}
                onChange={(e) => setTQuery(e.target.value)}
              />
              {tResults.length > 0 && (
                <div className={s.results}>
                  {tResults.map((it) => (
                    <button key={it.id} className={s.resultRow} onClick={() => addTest(it)}>
                      <span><span className={a.mono}>{it.code}</span> {it.name}</span>
                      <span className={s.resultMeta}>{it.provider} · {vnd.format(it.listPrice)} ₫</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={s.cart}>
          <div className={s.cartTitle}>{isDoctor ? "Phiếu chỉ định" : "Giỏ xét nghiệm"}</div>
          {cart.length === 0 && <div className={s.empty}>Tìm và thêm xét nghiệm ở bên trái.</div>}
          {cart.map((x) => (
            <div key={x.labTestId} className={s.line}>
              <div className={s.lineTop}>
                <span className={s.lineName}>{x.name}</span>
                <button className={s.remove} onClick={() => setCart((c) => c.filter((y) => y.labTestId !== x.labTestId))}>×</button>
              </div>
              <div className={s.lineCtrl}>
                <select
                  className={s.sampleSel}
                  value={x.sampleType}
                  onChange={(e) => setCart((c) => c.map((y) => y.labTestId === x.labTestId ? { ...y, sampleType: e.target.value } : y))}
                >
                  {x.samples.map((sm) => <option key={sm} value={sm}>{sm}</option>)}
                </select>
                <input
                  className={s.qty}
                  type="number"
                  min={1}
                  value={x.qty}
                  onChange={(e) => setCart((c) => c.map((y) => y.labTestId === x.labTestId ? { ...y, qty: Math.max(1, Number(e.target.value) || 1) } : y))}
                />
                <span className={s.linePrice}>{vnd.format(x.listPrice * x.qty)} ₫</span>
              </div>
            </div>
          ))}

          {cart.length > 0 && (
            <div className={s.summary}>
              <span>{cart.length} XN · tạm tính</span>
              <span className={s.total}>{vnd.format(estTotal)} ₫</span>
            </div>
          )}
          {error && <div className={a.error} style={{ marginTop: 8 }}>{error}</div>}
          <button className={s.submit} onClick={submit} disabled={busy}>
            {busy ? "Đang gửi…" : isDoctor ? "Gửi chỉ định" : "Đặt xét nghiệm"}
          </button>
          {isDoctor && <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 8, textAlign: "center" }}>
            Giá chốt (deal) áp dụng khi gửi; tạm tính hiển thị giá niêm yết.
          </div>}
        </div>
      </div>

      {qrOpen && <QrScan onFill={applyCccd} onClose={() => setQrOpen(false)} />}
    </div>
  );
}
