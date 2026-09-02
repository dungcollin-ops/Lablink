import { useState } from "react";
import { ROLE_LABEL } from "../auth/permissions";
import { DEMO_HINTS, mockLogin, type Session } from "../auth/session";
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
      if (!session) throw new Error("invalid");
      onLogin(session);
    } catch {
      setError("Email hoặc mật khẩu không đúng.");
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
          <label className={styles.label}>Email</label>
          <input
            className={styles.input}
            type="email"
            value={email}
            autoFocus
            placeholder="ten@lablink.local"
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

        <div className={styles.demo}>
          <div className={styles.demoTitle}>Tài khoản demo (mật khẩu: demo)</div>
          {DEMO_HINTS.map((d) => (
            <button
              type="button"
              key={d.email}
              className={styles.demoRow}
              onClick={() => {
                setEmail(d.email);
                setPassword("demo");
                setError("");
              }}
            >
              <span>{d.email}</span>
              <span className={styles.demoRole}>{ROLE_LABEL[d.role]}</span>
            </button>
          ))}
        </div>
      </form>
    </div>
  );
}
