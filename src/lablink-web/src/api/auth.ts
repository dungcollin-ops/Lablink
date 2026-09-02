import type { Role } from "../auth/permissions";
import type { Session } from "../auth/session";
import { API_BASE } from "./config";

interface ApiMe {
  id: string;
  fullName: string;
  email: string;
  roles: string[];
  permissions: string[];
}

interface ApiLoginResponse {
  token: string;
  expiresAt: string;
  user: ApiMe;
}

function toSession(data: ApiLoginResponse): Session {
  const u = data.user;
  return {
    user: { id: u.id, fullName: u.fullName, email: u.email, role: u.roles[0] as Role },
    role: u.roles[0] as Role,
    permissions: u.permissions as Session["permissions"],
    token: data.token,
  };
}

/** Đăng nhập qua API thật (POST /api/auth/login). Ném lỗi nếu sai. */
export async function apiLogin(email: string, password: string): Promise<Session> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("invalid-credentials");
  return toSession(await res.json());
}
