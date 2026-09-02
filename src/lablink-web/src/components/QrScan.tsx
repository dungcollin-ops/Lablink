import { useEffect, useRef, useState } from "react";
import Modal from "./Modal";
import a from "../pages/admin.module.css";
import s from "./QrScan.module.css";

export interface CccdData {
  fullName?: string;
  dob?: string; // yyyy-MM-dd
  gender?: string;
  nationalId?: string;
  address?: string;
}

interface Props {
  onFill: (d: CccdData) => void;
  onClose: () => void;
}

const SAMPLE = "012345678901|123456789|Nguyễn Văn An|01011990|Nam|123 Lê Lợi, P. Bến Nghé, Q.1, TP.HCM|01012021";

/** Chuỗi QR CCCD: CCCD|CMND|HọTên|ddMMyyyy|GiớiTính|ĐịaChỉ|NgàyCấp */
export function parseCccd(raw: string): CccdData | null {
  const parts = raw.trim().split("|");
  if (parts.length < 6) return null;
  const dobRaw = parts[3]?.replace(/\D/g, "");
  let dob: string | undefined;
  if (dobRaw?.length === 8) dob = `${dobRaw.slice(4)}-${dobRaw.slice(2, 4)}-${dobRaw.slice(0, 2)}`;
  return {
    nationalId: parts[0] || undefined,
    fullName: parts[2] || undefined,
    dob,
    gender: parts[4] || undefined,
    address: parts[5] || undefined,
  };
}

export default function QrScan({ onFill, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [camWarn, setCamWarn] = useState("");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;

    async function start() {
      // BarcodeDetector chỉ có trên Chrome/Edge; camera cần https/localhost.
      const BD = (window as unknown as { BarcodeDetector?: new (o: object) => { detect: (v: unknown) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
      if (!BD || !navigator.mediaDevices?.getUserMedia) {
        setCamWarn("Trình duyệt không hỗ trợ quét camera — vui lòng dán chuỗi QR bên dưới.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const detector = new BD({ formats: ["qr_code"] });
        const loop = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length) {
              const d = parseCccd(codes[0].rawValue);
              if (d) { onFill(d); onClose(); return; }
            }
          } catch { /* ignore frame errors */ }
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      } catch {
        setCamWarn("Không truy cập được camera — vui lòng dán chuỗi QR bên dưới.");
      }
    }
    start();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onFill, onClose]);

  function useText(raw: string) {
    const d = parseCccd(raw);
    if (!d) { setErr("Chuỗi QR không hợp lệ."); return; }
    onFill(d);
    onClose();
  }

  return (
    <Modal title="Quét QR CCCD" onClose={onClose}>
      <div className={s.body}>
        {camWarn ? <div className={s.warn}>{camWarn}</div> : <video ref={videoRef} className={s.video} muted playsInline />}
        <div className={s.note}>Hoặc dán chuỗi QR (đọc từ thẻ CCCD) vào đây:</div>
        <textarea
          className={s.textarea}
          value={text}
          onChange={(e) => { setText(e.target.value); setErr(""); }}
          placeholder="012345678901|...|Họ Tên|ddMMyyyy|Nam|Địa chỉ|..."
        />
        {err && <div style={{ fontSize: 12, color: "var(--danger-2)", marginTop: 6 }}>{err}</div>}
        <div className={s.row}>
          <button className={`${a.btn} ${a.btnPrimary}`} onClick={() => useText(text)}>Dùng chuỗi</button>
          <button className={a.btn} onClick={() => setText(SAMPLE)}>Dùng mẫu</button>
        </div>
      </div>
    </Modal>
  );
}
