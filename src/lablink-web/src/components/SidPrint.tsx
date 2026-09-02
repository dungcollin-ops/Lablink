import { useEffect, useMemo, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import type { OrderDto } from "../api/orders";
import s from "./SidPrint.module.css";

interface Props {
  order: OrderDto;
  onClose: () => void;
}

interface LabelData {
  key: string;
  sid: string;
  sampleType: string;
}

/** Modal in tem SID — mỗi tem: mã SID + barcode Code128 + thông tin BN/loại mẫu
 * (README · Screen 5). Số bản in chỉ nhân số tem, KHÔNG sinh SID mới. */
export default function SidPrint({ order, onClose }: Props) {
  const [selected, setSelected] = useState(""); // "" = tất cả SID
  const [copies, setCopies] = useState(1);
  const svgRefs = useRef<(SVGSVGElement | null)[]>([]);

  const labels = useMemo<LabelData[]>(() => {
    const chosen = selected
      ? order.samples.filter((s) => s.sid === selected)
      : order.samples;
    const out: LabelData[] = [];
    const c = Math.min(99, Math.max(1, copies));
    for (const sm of chosen) {
      for (let i = 0; i < c; i++) {
        out.push({ key: `${sm.id}-${i}`, sid: sm.sid, sampleType: sm.sampleType });
      }
    }
    return out;
  }, [order.samples, selected, copies]);

  // Vẽ barcode Code128 vào từng svg.
  useEffect(() => {
    labels.forEach((l, i) => {
      const el = svgRefs.current[i];
      if (!el) return;
      try {
        JsBarcode(el, l.sid, {
          format: "CODE128",
          displayValue: false,
          margin: 0,
          height: 46,
          width: 1.6,
        });
      } catch {
        /* ignore invalid */
      }
    });
  }, [labels]);

  const n = order.samples.length;
  const c = Math.min(99, Math.max(1, copies));
  const hint = selected
    ? `SID ${selected} × ${c} bản = ${c} tem`
    : `Tất cả ${n} SID × ${c} bản = ${n * c} tem — dán ống mẫu, khay đựng, giấy chỉ định`;

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.modal} onClick={(e) => e.stopPropagation()}>
        <div className={s.header}>
          <span className={s.title}>In tem SID · {order.orderNo}</span>
          <span className={s.label}>SID cần in</span>
          <select className={s.select} value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">Tất cả SID</option>
            {order.samples.map((sm) => (
              <option key={sm.id} value={sm.sid}>{sm.sid} · {sm.sampleType}</option>
            ))}
          </select>
          <span className={s.label}>Số bản in</span>
          <input
            className={s.copies}
            type="number"
            min={1}
            max={99}
            value={copies}
            onChange={(e) => setCopies(Math.min(99, Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1)))}
          />
          <button className={s.printBtn} onClick={() => window.print()}>⎙ In SID</button>
          <button className={s.close} onClick={onClose} aria-label="Đóng">×</button>
        </div>
        <div className={s.hint}>{hint}</div>

        <div className={s.body}>
          <div className={`${s.labels} sid-print-labels`}>
            {labels.map((l, i) => (
              <div key={l.key} className={s.label1}>
                <div className={s.sidText}>{l.sid}</div>
                <svg
                  className={s.barcode}
                  ref={(el) => { svgRefs.current[i] = el; }}
                />
                <div className={s.meta}>
                  {order.patientName} · {order.patientMaBN}
                  <br />
                  {l.sampleType}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
