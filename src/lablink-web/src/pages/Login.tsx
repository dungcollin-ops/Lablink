import { useState } from "react";
import { mockLogin, type Session } from "../auth/session";
import { apiLogin } from "../api/auth";
import { USE_API } from "../api/config";
import styles from "./Login.module.css";

interface Props {
  onLogin: (session: Session) => void;
}

/** Màn đăng nhập (README · Screen 1).
 * USE_API bật → gọi POST /api/auth/login; tắt → mockLogin (chưa có backend). */
export default function Login({ onLogin }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      let session: Session | null;
      if (USE_API) {
        session = await apiLogin(email, password);
      } else {
        session = mockLogin(email, password);
      }
      if (!session) throw new Error("Sai thông tin đăng nhập.");
      onLogin(session);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Đăng nhập không thành công.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <form className={styles.card} onSubmit={submit}>
        <div className={styles.brand}>
          <div className={styles.logo}>L</div>
          <div className={styles.name}>LabLink</div>
        </div>
        <div className={styles.sub}>Đăng nhập để tiếp tục</div>

        <div className={styles.field}>
          <label className={styles.label}>Tên tài khoản hoặc Email</label>
          <input
            className={styles.input}
            type="text"
            value={email}
            autoFocus
            placeholder="tài khoản hoặc ten@lablink.local"
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Mật khẩu</label>
          <input
            className={styles.input}
            type="password"
            value={password}
            placeholder="••••••••"
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
          />
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <button className={styles.submit} type="submit" disabled={busy}>
          {busy ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>

      </form>
    </div>
  );
}
