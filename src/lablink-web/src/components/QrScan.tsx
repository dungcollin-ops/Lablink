import { useEffect, useRef, useState } from "react";
import Modal from "./Modal";
import Icon from "./Icon";
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
// eslint-disable-next-line react-refresh/only-export-components
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

type Detect = (video: HTMLVideoElement) => Promise<string | null>;
type NativeDetector = { detect: (v: unknown) => Promise<{ rawValue: string }[]> };
type NativeDetectorCtor = (new (o: object) => NativeDetector) & { getSupportedFormats?: () => Promise<string[]> };

/** Bộ đọc QR: dùng BarcodeDetector của trình duyệt nếu có (Chrome Android/Mac),
 * còn lại (Chrome/Edge Windows, iPhone, Firefox) dùng jsQR — tải khi cần để không nặng trang. */
async function makeDetector(): Promise<Detect> {
  const BD = (window as unknown as { BarcodeDetector?: NativeDetectorCtor }).BarcodeDetector;
  if (BD) {
    try {
      const formats = (await BD.getSupportedFormats?.()) ?? ["qr_code"];
      if (formats.includes("qr_code")) {
        const det = new BD({ formats: ["qr_code"] });
        return async (v) => (await det.detect(v))[0]?.rawValue ?? null;
      }
    } catch { /* rơi xuống jsQR */ }
  }
  const { default: jsQR } = await import("jsqr");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  return async (v) => {
    if (!ctx || !v.videoWidth) return null;
    // Thu nhỏ khung hình (cạnh dài ≤ 960px) cho nhanh mà vẫn đủ nét với QR CCCD.
    const k = Math.min(1, 960 / Math.max(v.videoWidth, v.videoHeight));
    canvas.width = Math.round(v.videoWidth * k);
    canvas.height = Math.round(v.videoHeight * k);
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" })?.data ?? null;
  };
}

function cameraError(e: unknown): string {
  const name = (e as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Bạn đã chặn quyền camera. Bấm biểu tượng ổ khoá cạnh địa chỉ trang → cho phép Camera, rồi mở lại.";
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return "Không tìm thấy camera trên thiết bị này.";
  if (name === "NotReadableError" || name === "AbortError")
    return "Camera đang được ứng dụng khác dùng (Zalo, Teams…). Tắt ứng dụng đó rồi thử lại.";
  return "Không mở được camera.";
}

export default function QrScan({ onFill, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [camWarn, setCamWarn] = useState("");
  const [status, setStatus] = useState("Đang mở camera…");

  // Giữ callback mới nhất trong ref → effect camera chỉ chạy 1 lần, không bị bật/tắt lại khi trang cha render.
  const fillRef = useRef(onFill);
  const closeRef = useRef(onClose);
  useEffect(() => { fillRef.current = onFill; closeRef.current = onClose; });

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;

    async function start() {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setCamWarn("Trình duyệt chỉ cho dùng camera khi mở trang bằng https:// — vui lòng dán chuỗi QR bên dưới.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (e) {
        setCamWarn(cameraError(e) + " Hoặc dán chuỗi QR bên dưới.");
        return;
      }
      // Popup đã đóng trong lúc chờ cấp quyền → tắt camera ngay.
      if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      try { await video.play(); } catch { /* iOS có thể chặn autoplay; video vẫn chạy khi đã có stream */ }

      let detect: Detect;
      try { detect = await makeDetector(); }
      catch { setCamWarn("Không tải được bộ đọc QR — vui lòng dán chuỗi QR bên dưới."); return; }
      setStatus("Đưa mã QR trên thẻ CCCD vào khung hình");

      let wrongShown = false;
      const tick = async () => {
        if (stopped) return;
        try {
          const raw = await detect(video);
          if (raw) {
            const d = parseCccd(raw);
            if (d) { fillRef.current(d); closeRef.current(); return; }
            if (!wrongShown) { wrongShown = true; setStatus("Đã đọc được mã QR nhưng không phải QR trên CCCD."); }
          }
        } catch { /* bỏ qua khung hình lỗi */ }
        timer = window.setTimeout(tick, 150);
      };
      tick();
    }
    start();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function applyText(raw: string) {
    const d = parseCccd(raw);
    if (!d) { setErr("Chuỗi QR không hợp lệ."); return; }
    onFill(d);
    onClose();
  }

  return (
    <Modal title="Quét QR CCCD" onClose={onClose}>
      <div className={s.body}>
        {camWarn ? (
          <div className={s.warn}>{camWarn}</div>
        ) : (
          <>
            <div className={s.viewport}>
              <video ref={videoRef} className={s.video} muted playsInline autoPlay />
              <div className={s.frame} aria-hidden="true" />
            </div>
            <div className={s.status}><Icon name="scan" size={14} /> {status}</div>
          </>
        )}
        <div className={s.note}>Hoặc dán chuỗi QR (đọc từ thẻ CCCD) vào đây:</div>
        <textarea
          className={s.textarea}
          value={text}
          onChange={(e) => { setText(e.target.value); setErr(""); }}
          placeholder="012345678901|...|Họ Tên|ddMMyyyy|Nam|Địa chỉ|..."
        />
        {err && <div style={{ fontSize: 12, color: "var(--danger-2)", marginTop: 6 }}>{err}</div>}
        <div className={s.row}>
          <button className={`${a.btn} ${a.btnPrimary}`} onClick={() => applyText(text)}>Dùng chuỗi</button>
          {import.meta.env.DEV && <button className={a.btn} onClick={() => setText(SAMPLE)}>Dùng mẫu</button>}
        </div>
      </div>
    </Modal>
  );
}
