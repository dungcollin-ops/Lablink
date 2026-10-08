import { useEffect, useState } from "react";
import type { Session } from "../auth/session";
import { fetchCatalog, type CatalogItem } from "../api/catalog";
import {
  createOrder,
  searchPatients,
  type OrderDto,
  type PatientSearch,
} from "../api/orders";
import { listDoctorsForOrder, type Employee } from "../api/employees";
import { myDealPrices } from "../api/deals";
import { ApiError } from "../api/http";
import { COMBOS } from "../combos";
import QrScan, { type CccdData } from "../components/QrScan";
import Modal from "../components/Modal";
import CatalogPicker from "../components/CatalogPicker";
import Icon from "../components/Icon";
import { isoToVnDob as isoToVn, vnToIsoDob as vnToIso, maskDob } from "../lib/dob";
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
  const [doctorId, setDoctorId] = useState("");
  const [doctors, setDoctors] = useState<Employee[]>([]);
  const [dealPrices, setDealPrices] = useState<Record<string, number>>({});

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
  const [phoneWarn, setPhoneWarn] = useState(false); // cảnh báo SĐT 9/11 số (lệch 10 số thường gặp)
  const [pickerOpen, setPickerOpen] = useState(false); // popup duyệt toàn bộ danh mục
  const [moreOpen, setMoreOpen] = useState(false); // điện thoại: mở các trường phụ (CCCD, BHYT, email, địa chỉ)

  const set = (k: keyof Patient, v: string) => setPatient((p) => ({ ...p, [k]: v }));

  // Giá deal đã chốt của phòng (labTestId → giá) để giỏ hiển thị đúng giá hiệu lực.
  useEffect(() => {
    if (!isDoctor) return;
    myDealPrices(token).then(setDealPrices).catch(() => setDealPrices({}));
  }, [token, isDoctor]);

  // Giá hiệu lực: có deal của phòng thì lấy giá deal, không thì giá niêm yết.
  const effPrice = (labTestId: string, listPrice: number) =>
    (isDoctor && dealPrices[labTestId] != null) ? dealPrices[labTestId] : listPrice;

  // Danh mục bác sĩ (theo phòng của người tạo) cho ô "Bác sĩ chỉ định".
  useEffect(() => {
    if (!isDoctor) return;
    listDoctorsForOrder(token)
      .then((list) => {
        setDoctors(list);
        // Mặc định chọn sẵn bác sĩ = nhân viên gắn với tài khoản đang đăng nhập (nếu có trong danh sách).
        if (session.employeeId && list.some((d) => d.id === session.employeeId)) {
          setDoctorId((cur) => cur || session.employeeId!);
        }
      })
      .catch(() => setDoctors([]));
  }, [token, isDoctor, session.employeeId]);

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
      fullName: (p.fullName ?? "").toUpperCase(),
      dob: isoToVn(p.dob),
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
      fullName: d.fullName ? d.fullName.toUpperCase() : p.fullName,
      dob: d.dob ? isoToVn(d.dob) : p.dob,
      gender: d.gender === "Nam" || d.gender === "Nữ" ? d.gender : p.gender,
      nationalId: d.nationalId ?? p.nationalId,
      address: d.address ?? p.address,
    }));
  }

  const estTotal = cart.reduce((sum, x) => sum + effPrice(x.labTestId, x.listPrice) * x.qty, 0);

  const phoneDigits = patient.phone.replace(/\D/g, "").length;
  const phoneInvalid = phoneDigits > 0 && phoneDigits !== 9 && phoneDigits !== 11; // hợp lệ = 9 hoặc 11 số

  async function submit(skipPhoneCheck = false) {
    setError("");
    if (!patient.fullName.trim()) return setError("Bắt buộc nhập họ tên bệnh nhân.");
    if (!vnToIso(patient.dob)) return setError("Cần nhập năm sinh (gõ đủ dd/mm/yyyy, hoặc chỉ năm yyyy).");
    if (cart.length === 0) return setError("Cần ít nhất 1 xét nghiệm.");
    const email = patient.email.replace(/\s/g, "").toLowerCase();
    if (email && !EMAIL.test(email)) {
      setEmailErr(true);
      return setError("Email không hợp lệ — ví dụ: ten@benhvien.vn");
    }
    // Cảnh báo mềm: SĐT hợp lệ có 9 hoặc 11 số — cho phép bỏ qua nếu người dùng chắc chắn.
    if (!skipPhoneCheck && phoneInvalid) { setPhoneWarn(true); return; }
    setBusy(true);
    try {
      const order = await createOrder(token, {
        source: mode,
        patient: {
          maBN: patient.maBN || undefined,
          fullName: patient.fullName.trim().toUpperCase(),
          dob: vnToIso(patient.dob) || undefined,
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
        doctorId: isDoctor ? doctorId || undefined : undefined,
        items: cart.map((x) => ({ labTestId: x.labTestId, sampleType: x.sampleType, qty: x.qty })),
      });
      setCreated(order);
      setCart([]);
      setPatient(emptyPatient);
      setDiagnosis("");
      setDoctorId("");
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
          <div className={a.h1}>{isDoctor ? "Chỉ định xét nghiệm" : "Đặt xét nghiệm"}</div>
        </div>
        <div className={s.success}>
          <div className={s.successTitle}><Icon name="check" size={18} strokeWidth={2.4} /> Đã gửi chỉ định tới phòng xét nghiệm</div>
          <div>
            Phiếu <strong>{created.orderNo}</strong> · BN {created.patientName} ({created.patientMaBN}) ·
            Tổng <strong>{vnd.format(created.total)} ₫</strong>
          </div>
          <div className={s.sidList}>
            {created.samples.map((sm) => (
              <span key={sm.id} className={s.sidChip}>{sm.sid} · {sm.sampleType}</span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
            <button className={`${a.btn} ${a.btnPrimary}`} onClick={() => onNavigate("track")}>
              Xem theo dõi
            </button>
            <button className={a.btn} onClick={() => setCreated(null)}>Tạo phiếu mới</button>
          </div>
        </div>
      </div>
    );
  }

  const showExtra = moreOpen || !!(patient.email || patient.nationalId || patient.bhyt || patient.address || patient.maBN);
  const submitLabel = busy ? "Đang gửi…" : isDoctor ? "Gửi chỉ định" : "Đặt xét nghiệm";

  return (
    <div>
      <div className={`${a.head} ${s.pageTitle}`}>
        <div>
          <h1 className={a.h1}>{isDoctor ? "Chỉ định xét nghiệm" : "Đặt xét nghiệm"}</h1>
          <div className={s.pageSub}>
            {isDoctor
              ? "Nhập thông tin bệnh nhân, chọn xét nghiệm rồi gửi phiếu sang phòng xét nghiệm."
              : "Nhập thông tin khách hàng và chọn xét nghiệm cần làm."}
          </div>
        </div>
      </div>

      <div className={s.layout}>
        <div>
          <section className={s.section} aria-labelledby="of-bn">
            <div className={s.sectionHead}>
              <h2 id="of-bn" className={s.sectionTitle}>{isDoctor ? "Bệnh nhân" : "Khách hàng"}</h2>
              <button type="button" className={`${a.btn} ${s.qrBtn}`} onClick={() => setQrOpen(true)}>
                <Icon name="scan" /> Quét QR CCCD
              </button>
            </div>

            {isDoctor && (
              <div className={s.searchBox} style={{ marginBottom: 14 }}>
                <label className={s.searchField}>
                  <Icon name="search" />
                  <input
                    type="search"
                    aria-label="Tìm bệnh nhân cũ"
                    placeholder="Tìm bệnh nhân cũ (tên / mã BN / CCCD / SĐT)…"
                    value={pQuery}
                    onChange={(e) => setPQuery(e.target.value)}
                  />
                </label>
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

            <div className={`${s.grid} ${showExtra ? s.showExtra : ""}`}>
              {isDoctor && (
                <div className={`${s.field} ${s.extra}`}>
                  <label className={s.label} htmlFor="of-mabn">Mã bệnh nhân</label>
                  <input id="of-mabn" className={s.input} style={{ fontFamily: "var(--font-mono)" }} placeholder="Tự sinh nếu để trống" value={patient.maBN} onChange={(e) => set("maBN", e.target.value)} />
                </div>
              )}
              <div className={s.field}>
                <label className={s.label} htmlFor="of-name">Họ tên <span className={s.req}>*</span></label>
                <input id="of-name" className={s.input} value={patient.fullName} onChange={(e) => set("fullName", e.target.value.toUpperCase())} style={{ textTransform: "uppercase" }} />
              </div>
              <div className={`${s.field} ${s.half}`}>
                <label className={s.label} htmlFor="of-dob">Ngày sinh <span className={s.req}>*</span></label>
                <input
                  id="of-dob"
                  className={s.input}
                  type="text"
                  inputMode="numeric"
                  placeholder="dd/mm/yyyy hoặc yyyy"
                  maxLength={10}
                  value={patient.dob}
                  onChange={(e) => set("dob", maskDob(e.target.value))}
                />
                <span className={s.hint}>Gõ đủ ngày tháng năm, hoặc chỉ năm</span>
              </div>
              <div className={`${s.field} ${s.half}`}>
                <span className={s.label} id="of-sex">Giới tính</span>
                <div className={s.seg} role="radiogroup" aria-labelledby="of-sex">
                  {["Nam", "Nữ"].map((g) => (
                    <button
                      key={g}
                      type="button"
                      role="radio"
                      aria-checked={patient.gender === g}
                      className={`${s.segBtn} ${patient.gender === g ? s.segOn : ""}`}
                      onClick={() => set("gender", g)}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <div className={s.field}>
                <label className={s.label} htmlFor="of-phone">Điện thoại</label>
                <input id="of-phone" className={s.input} type="tel" inputMode="tel" placeholder="9 hoặc 11 số" value={patient.phone} onChange={(e) => set("phone", e.target.value)} />
              </div>
              <div className={`${s.field} ${s.extra}`}>
                <label className={s.label} htmlFor="of-email">Email</label>
                <input
                  id="of-email"
                  type="email"
                  className={`${s.input} ${emailErr ? s.inputError : ""}`}
                  value={patient.email}
                  onChange={(e) => { set("email", e.target.value); setEmailErr(false); }}
                  placeholder="ten@email.com"
                />
                {emailErr && <span className={s.errText}>Email không hợp lệ</span>}
              </div>
              <div className={`${s.field} ${s.extra}`}>
                <label className={s.label} htmlFor="of-cccd">Số CCCD</label>
                <input id="of-cccd" className={s.input} inputMode="numeric" value={patient.nationalId} onChange={(e) => set("nationalId", e.target.value)} />
              </div>
              <div className={`${s.field} ${s.extra}`}>
                <label className={s.label} htmlFor="of-bhyt">Số thẻ BHYT</label>
                <input id="of-bhyt" className={s.input} value={patient.bhyt} onChange={(e) => set("bhyt", e.target.value)} />
              </div>
              <div className={`${s.field} ${s.span2} ${s.extra}`}>
                <label className={s.label} htmlFor="of-addr">Địa chỉ</label>
                <input id="of-addr" className={s.input} value={patient.address} onChange={(e) => set("address", e.target.value)} />
              </div>
              {!showExtra && (
                <button type="button" className={s.moreToggle} aria-expanded={false} onClick={() => setMoreOpen(true)}>
                  <Icon name="plus" size={14} /> Thêm thông tin: CCCD, BHYT, email, địa chỉ
                </button>
              )}
              {!isDoctor && (
                <div className={`${s.field} ${s.span2}`}>
                  <label className={s.label} htmlFor="of-note">Ghi chú</label>
                  <input id="of-note" className={s.input} value={patient.note} onChange={(e) => set("note", e.target.value)} />
                </div>
              )}
            </div>
          </section>

          {isDoctor && (
            <section className={s.section} aria-labelledby="of-cd">
              <h2 id="of-cd" className={s.sectionTitle}>Chỉ định</h2>
              <div className={s.grid}>
                <div className={`${s.field} ${s.span2}`}>
                  <label className={s.label} htmlFor="of-dx">Chẩn đoán</label>
                  <input id="of-dx" className={s.input} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
                </div>
                <div className={s.field}>
                  <label className={s.label} htmlFor="of-doc">Bác sĩ chỉ định</label>
                  {doctors.length > 0 ? (
                    <select id="of-doc" className={s.input} value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
                      <option value="">— Chọn bác sĩ —</option>
                      {doctors.map((d) => (
                        <option key={d.id} value={d.id}>{d.fullName} · {d.departmentName}</option>
                      ))}
                    </select>
                  ) : (
                    <input id="of-doc" className={s.input} placeholder="Nhập tên bác sĩ" value={doctorCode} onChange={(e) => setDoctorCode(e.target.value)} />
                  )}
                </div>
                <div className={s.field}>
                  <label className={s.label} htmlFor="of-clinic">Phòng khám (ghi chú)</label>
                  <input id="of-clinic" className={s.input} value={clinicName} onChange={(e) => setClinicName(e.target.value)} />
                </div>
              </div>
            </section>
          )}

          <section className={s.section} aria-labelledby="of-xn">
            <h2 id="of-xn" className={s.sectionTitle}>Chọn xét nghiệm</h2>
            <div className={s.combos}>
              {COMBOS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  className={s.combo}
                  disabled={comboBusy !== ""}
                  onClick={() => applyCombo(c.name, c.queries)}
                >
                  <Icon name="plus" size={14} />
                  {comboBusy === c.name ? "Đang thêm…" : c.name}
                </button>
              ))}
            </div>
            <div className={s.searchRow}>
              <div className={s.searchBox}>
                <label className={s.searchField}>
                  <Icon name="search" />
                  <input
                    type="search"
                    aria-label="Tìm xét nghiệm"
                    placeholder="Tìm tên hoặc mã xét nghiệm…"
                    value={tQuery}
                    onChange={(e) => setTQuery(e.target.value)}
                  />
                </label>
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
              <button
                type="button"
                className={s.catalogBtn}
                onClick={() => setPickerOpen(true)}
                title="Xem toàn bộ danh mục xét nghiệm"
                aria-label="Xem toàn bộ danh mục xét nghiệm"
              >
                <Icon name="list" />
                <span className={s.catalogLabel}>Danh mục</span>
              </button>
            </div>
          </section>
        </div>

        <aside className={s.cart} aria-labelledby="of-cart">
          <div className={s.cartHead}>
            <h2 id="of-cart" className={s.cartTitle}>{isDoctor ? "Phiếu chỉ định" : "Giỏ xét nghiệm"}</h2>
            {cart.length > 0 && <span className={s.cartCount}>{cart.length} xét nghiệm</span>}
          </div>
          {cart.length === 0 && <div className={s.empty}>Chưa chọn xét nghiệm nào.</div>}
          {cart.map((x) => {
            const eff = effPrice(x.labTestId, x.listPrice);
            return (
            <div key={x.labTestId} className={s.line}>
              <div className={s.lineTop}>
                <span className={s.lineName}>{x.name}</span>
                <button className={s.remove} aria-label={`Bỏ ${x.name}`} onClick={() => setCart((c) => c.filter((y) => y.labTestId !== x.labTestId))}>
                  <Icon name="x" size={14} />
                </button>
              </div>
              <div className={s.lineCtrl}>
                <select
                  className={s.sampleSel}
                  aria-label="Loại mẫu"
                  value={x.sampleType}
                  onChange={(e) => setCart((c) => c.map((y) => y.labTestId === x.labTestId ? { ...y, sampleType: e.target.value } : y))}
                >
                  {x.samples.map((sm) => <option key={sm} value={sm}>{sm}</option>)}
                </select>
                <input
                  className={s.qty}
                  type="number"
                  aria-label="Số lượng"
                  min={1}
                  value={x.qty}
                  onChange={(e) => setCart((c) => c.map((y) => y.labTestId === x.labTestId ? { ...y, qty: Math.max(1, Number(e.target.value) || 1) } : y))}
                />
                {eff !== x.listPrice ? (
                  <span className={s.linePrice} title="Giá đã chốt (deal) của phòng">
                    <span className={s.dealTag}>Giá deal</span>
                    <span style={{ textDecoration: "line-through", color: "var(--text-faint)", fontWeight: 400, marginRight: 4 }}>
                      {vnd.format(x.listPrice * x.qty)}
                    </span>
                    {vnd.format(eff * x.qty)} ₫
                  </span>
                ) : (
                  <span className={s.linePrice}>{vnd.format(x.listPrice * x.qty)} ₫</span>
                )}
              </div>
            </div>
            );
          })}

          {cart.length > 0 && (
            <div className={s.summary}>
              <span>Thành tiền</span>
              <span className={s.total}>{vnd.format(estTotal)} ₫</span>
            </div>
          )}
          {error && <div className={a.error} style={{ marginTop: 8 }}>{error}</div>}
          <button className={s.submit} onClick={() => submit()} disabled={busy}>{submitLabel}</button>
          {isDoctor && <div className={s.cartNote}>
            Dịch vụ có giá chốt (deal) của phòng hiển thị giá deal; còn lại theo giá niêm yết.
          </div>}
        </aside>
      </div>

      {/* Điện thoại: thanh gửi luôn hiện ở đáy */}
      <div className={s.mobileSpacer} />
      <div className={s.mobileBar}>
        <div className={s.mobileSum}>
          <span>{cart.length} xét nghiệm</span>
          <span>{vnd.format(estTotal)} ₫</span>
        </div>
        <button className={s.submit} onClick={() => submit()} disabled={busy}>{submitLabel}</button>
      </div>

      {qrOpen && <QrScan onFill={applyCccd} onClose={() => setQrOpen(false)} />}

      {pickerOpen && (
        <CatalogPicker
          token={token}
          addedIds={new Set(cart.map((x) => x.labTestId))}
          onAdd={addTest}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {phoneWarn && (
        <Modal
          title="Kiểm tra số điện thoại"
          onClose={() => setPhoneWarn(false)}
          footer={
            <>
              <button className={a.btn} onClick={() => setPhoneWarn(false)}>Sửa lại</button>
              <button
                className={`${a.btn} ${a.btnPrimary}`}
                onClick={() => { setPhoneWarn(false); submit(true); }}
              >
                Đúng, tiếp tục
              </button>
            </>
          }
        >
          <div style={{ fontSize: 14, lineHeight: 1.6 }}>
            Số điện thoại hợp lệ phải có <b>9 hoặc 11 số</b>. Số bạn nhập có <b>{phoneDigits} số</b>.
            <br />
            Bạn có chắc số <b>{patient.phone}</b> là đúng không?
          </div>
        </Modal>
      )}
    </div>
  );
}
