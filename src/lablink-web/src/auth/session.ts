import {
  ROLE_PERMISSIONS,
  type Permission,
  type Role,
} from "./permissions";

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: Role;
}

export interface Session {
  user: User;
  role: Role;
  permissions: Permission[];
  /** JWT khi đăng nhập qua API thật; undefined ở chế độ mock. */
  token?: string;
}

/** can(perm) — kiểm tra quyền ở client (chỉ để ẩn/hiện UI).
 * LƯU Ý: server phải kiểm tra lại quyền trên MỖI endpoint. */
export function can(session: Session | null, perm: Permission): boolean {
  return !!session && session.permissions.includes(perm);
}

/* ------------------------------------------------------------------ *
 * MOCK AUTH — chỉ dùng khi chưa có backend.
 * Thay bằng: POST /api/auth/login  →  GET /api/me (user + role + permissions).
 * Danh sách dưới đây là tài khoản demo để chạy thử luồng theo từng nhóm.
 * ------------------------------------------------------------------ */
interface DemoAccount extends User {
  password: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  { id: "u-doctor", fullName: "BS. Trần Minh", email: "bacsi@lablink.local", role: "doctor", password: "demo" },
  { id: "u-retail", fullName: "Nguyễn Khách Lẻ", email: "khachle@lablink.local", role: "retail", password: "demo" },
  { id: "u-lab", fullName: "KTV. Lê Hoà Hảo", email: "lab@lablink.local", role: "lab", password: "demo" },
  { id: "u-admin", fullName: "Quản trị viên", email: "admin@lablink.local", role: "admin", password: "demo" },
];

export const DEMO_HINTS = DEMO_ACCOUNTS.map((a) => ({
  email: a.email,
  role: a.role,
}));

/** Trả về Session nếu đúng email+mật khẩu, ngược lại null. */
export function mockLogin(email: string, password: string): Session | null {
  const norm = email.trim().toLowerCase();
  const acc = DEMO_ACCOUNTS.find(
    (a) => a.email === norm && a.password === password,
  );
  if (!acc) return null;
  const { password: _pw, ...user } = acc;
  return { user, role: user.role, permissions: ROLE_PERMISSIONS[user.role] };
}
