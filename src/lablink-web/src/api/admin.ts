import { api } from "./http";

export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  department?: string | null;
  status: string; // Active | Suspended | Left
  roles: string[];
  lastLoginAt?: string | null;
  createdAt: string;
}

export interface AdminRole {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  permissions: string[];
  userCount: number;
}

export interface AuditItem {
  id: number;
  userId?: string | null;
  userName?: string | null;
  action: string;
  objectType?: string | null;
  objectId?: string | null;
  detail?: string | null;
  at: string;
}
export interface AuditPage {
  total: number;
  page: number;
  pageSize: number;
  items: AuditItem[];
}

// ---- Users ----
export const listUsers = (token: string | undefined, q?: string) =>
  api<AdminUser[]>(token, `/api/admin/users${q ? `?query=${encodeURIComponent(q)}` : ""}`);

export const createUser = (
  token: string | undefined,
  body: { fullName: string; email: string; password: string; roleCodes: string[]; department?: string },
) => api<{ id: string }>(token, "/api/admin/users", { method: "POST", body: JSON.stringify(body) });

export const setUserRoles = (token: string | undefined, id: string, roleCodes: string[]) =>
  api(token, `/api/admin/users/${id}/roles`, { method: "PUT", body: JSON.stringify({ roleCodes }) });

export const setUserStatus = (token: string | undefined, id: string, status: string) =>
  api(token, `/api/admin/users/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) });

export const resetPassword = (token: string | undefined, id: string, newPassword: string) =>
  api(token, `/api/admin/users/${id}/reset-password`, { method: "POST", body: JSON.stringify({ newPassword }) });

// ---- Roles ----
export const listRoles = (token: string | undefined) => api<AdminRole[]>(token, "/api/admin/roles");
export const listPermissions = (token: string | undefined) => api<string[]>(token, "/api/admin/permissions");
export const setRolePermissions = (token: string | undefined, roleId: string, permissionKeys: string[]) =>
  api(token, `/api/admin/roles/${roleId}/permissions`, { method: "PUT", body: JSON.stringify({ permissionKeys }) });

// ---- Audit ----
export const listAudit = (token: string | undefined, page = 1, pageSize = 50) =>
  api<AuditPage>(token, `/api/admin/audit?page=${page}&pageSize=${pageSize}`);
