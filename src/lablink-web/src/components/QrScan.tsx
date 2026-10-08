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

type Source = HTMLVideoElement | HTMLImageElement;
type NativeDetector = { detect: (v: unknown) => Promise<{ rawValue: string }[]> };
type NativeDetectorCtor = (new (o: object) => NativeDetector) & { getSupportedFormats?: () => Promise<string[]> };
type JsQR = typeof import("jsqr").default;

const srcSize = (src: Source) =>
  src instanceof HTMLVideoElement ? [src.videoWidth, src.videoHeight] : [src.naturalWidth, src.naturalHeight];

/** Bộ đọc QR: BarcodeDetector của trình duyệt (Chrome Android/Mac) nếu có, cộng jsQR cho mọi trình duyệt.
 * jsQR thử nhiều vùng/cỡ ảnh vì QR CCCD khá dày: vùng giữa ở độ phân giải gốc, rồi cả khung hình. */
class QrReader {
  private native: NativeDetector | null = null;
  private jsqr: JsQR | null = null;
  private canvas = document.createElement("canvas");
  private ctx = this.canvas.getContext("2d", { willReadFrequently: true });

  static async create(): Promise<QrReader> {
    const r = new QrReader();
    const BD = (window as unknown as { BarcodeDetector?: NativeDetectorCtor }).BarcodeDetector;
    if (BD) {
      try {
        const formats = (await BD.getSupportedFormats?.()) ?? ["qr_code"];
        if (formats.includes("qr_code")) r.native = new BD({ formats: ["qr_code"] });
      } catch { /* dùng jsQR */ }
    }
    r.jsqr = (await import("jsqr")).default;
    return r;
  }

  /** Đọc 1 khung hình/ảnh. `thorough` = thử thêm nhiều cỡ + đảo màu (dùng cho ảnh chụp). */
  async read(src: Source, frame: number, thorough = false): Promise<string | null> {
    if (this.native) {
      try {
        const hit = (await this.native.detect(src))[0]?.rawValue;
        if (hit) return hit;
      } catch { /* thử jsQR */ }
    }
    const [w, h] = srcSize(src);
    if (!this.jsqr || !this.ctx || !w || !h) return null;
    const side = Math.min(w, h);
    // Các vùng thử: [x, y, rộng, cao, cạnh dài tối đa sau khi thu nhỏ]
    const regions: [number, number, number, number, number][] = thorough
      ? [[0, 0, w, h, 2000], [0, 0, w, h, 1200], [0, 0, w, h, 800],
         [(w - side * 0.7) / 2, (h - side * 0.7) / 2, side * 0.7, side * 0.7, 1200]]
      : frame % 2 === 0
        ? [[(w - side * 0.75) / 2, (h - side * 0.75) / 2, side * 0.75, side * 0.75, 1000]] // vùng giữa, gần độ phân giải gốc
        : [[0, 0, w, h, 1280]];                                                           // cả khung hình
    for (const [x, y, rw, rh, max] of regions) {
      const k = Math.min(1, max / Math.max(rw, rh));
      this.canvas.width = Math.round(rw * k);
      this.canvas.height = Math.round(rh * k);
      this.ctx.drawImage(src, x, y, rw, rh, 0, 0, this.canvas.width, this.canvas.height);
      const img = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      const res = this.jsqr(img.data, img.width, img.height, {
        inversionAttempts: thorough || frame % 6 === 0 ? "attemptBoth" : "dontInvert",
      });
      if (res?.data) return res.data;
    }
    return null;
  }
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
  const fileRef = useRef<HTMLInputElement>(null);
  const readerRef = useRef<Promise<QrReader> | null>(null);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [camWarn, setCamWarn] = useState("");
  const [status, setStatus] = useState("Đang mở camera…");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoErr, setPhotoErr] = useState("");

  // Giữ callback mới nhất trong ref → effect camera chỉ chạy 1 lần, không bị bật/tắt lại khi trang cha render.
  const fillRef = useRef(onFill);
  const closeRef = useRef(onClose);
  useEffect(() => { fillRef.current = onFill; closeRef.current = onClose; });

  const getReader = () => (readerRef.current ??= QrReader.create());

  /** Đọc được chuỗi → điền form nếu đúng QR CCCD. Trả false nếu không phải QR CCCD. */
  const accept = (raw: string) => {
    const d = parseCccd(raw);
    if (!d) return false;
    fillRef.current(d);
    closeRef.current();
    return true;
  };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;

    async function start() {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setCamWarn("Trình duyệt chỉ cho dùng camera trực tiếp khi mở trang bằng https://.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
      } catch (e) {
        setCamWarn(cameraError(e));
        return;
      }
      // Popup đã đóng trong lúc chờ cấp quyền → tắt camera ngay.
      if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }

      // Bật lấy nét liên tục nếu camera hỗ trợ (Android); máy không hỗ trợ thì bỏ qua.
      const track = stream.getVideoTracks()[0];
      try {
        const caps = (track.getCapabilities?.() ?? {}) as { focusMode?: string[] };
        if (caps.focusMode?.includes("continuous"))
          await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] });
      } catch { /* bỏ qua */ }

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      try { await video.play(); } catch { /* iOS có thể chặn autoplay; video vẫn chạy khi đã có stream */ }

      let reader: QrReader;
      try { reader = await getReader(); }
      catch { setCamWarn("Không tải được bộ đọc QR."); return; }
      setStatus("Đưa mã QR trên thẻ CCCD vào khung, giữ yên 1–2 giây");

      let frame = 0;
      let wrongShown = false;
      const tick = async () => {
        if (stopped) return;
        try {
          const raw = await reader.read(video, frame++);
          if (raw && accept(raw)) return;
          if (raw && !wrongShown) { wrongShown = true; setStatus("Đọc được mã QR nhưng không phải QR trên CCCD."); }
        } catch { /* bỏ qua khung hình lỗi */ }
        timer = window.setTimeout(tick, 120);
      };
      tick();
    }
    start();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Chụp ảnh bằng app camera của máy (lấy nét tự động, nét hơn) rồi đọc QR từ ảnh. */
  async function readPhoto(file: File) {
    setPhotoBusy(true);
    setPhotoErr("");
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const reader = await getReader();
      const raw = await reader.read(img, 0, true);
      if (!raw) setPhotoErr("Không thấy mã QR trong ảnh. Chụp gần hơn để mã QR chiếm khoảng 1/3 ảnh, rõ nét, không loá đèn.");
      else if (!accept(raw)) setPhotoErr("Ảnh có mã QR nhưng không phải QR trên CCCD.");
    } catch {
      setPhotoErr("Không đọc được ảnh này.");
    } finally {
      URL.revokeObjectURL(url);
      setPhotoBusy(false);
    }
  }

  function applyText(raw: string) {
    if (!accept(raw)) setErr("Chuỗi QR không hợp lệ.");
  }

  return (
    <Modal title="Quét QR CCCD" onClose={onClose}>
      <div className={s.body}>
        {camWarn ? (
          <div className={s.warn}>{camWarn} Dùng nút "Chụp ảnh QR" bên dưới, hoặc dán chuỗi QR.</div>
        ) : (
          <>
            <div className={s.viewport}>
              <video ref={videoRef} className={s.video} muted playsInline autoPlay />
              <div className={s.frame} aria-hidden="true" />
            </div>
            <div className={s.status}><Icon name="scan" size={14} /> {status}</div>
          </>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) readPhoto(f); e.target.value = ""; }}
        />
        <button type="button" className={`${a.btn} ${s.photoBtn}`} disabled={photoBusy} onClick={() => fileRef.current?.click()}>
          <Icon name="scan" /> {photoBusy ? "Đang đọc ảnh…" : "Chụp ảnh QR (nét hơn)"}
        </button>
        {photoErr && <div className={s.photoErr}>{photoErr}</div>}

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
