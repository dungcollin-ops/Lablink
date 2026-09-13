import { api } from "./http";

export interface Department {
  id: string;
  name: string;
  type: string;
  address?: string | null;
  phone?: string | null;
  hardCopyRequired: boolean;
  isActive: boolean;
}
export interface DepartmentInput {
  name: string;
  type: string;
  address?: string;
  phone?: string;
  hardCopyRequired: boolean;
  isActive: boolean;
}

/** Loại phòng ban — danh sách cố định (mở rộng được ở đây). */
export const DEPT_TYPES = [
  "Phòng khám",
  "Phòng mạch",
  "Phòng xét nghiệm",
  "Phòng CĐHA",
  "Nội bộ",
  "Khác",
];

export const listDepartments = (token: string | undefined, includeInactive = true) =>
  api<Department[]>(token, `/api/departments?includeInactive=${includeInactive}`);

export const createDepartment = (token: string | undefined, body: DepartmentInput) =>
  api<Department>(token, "/api/departments", { method: "POST", body: JSON.stringify(body) });

export const updateDepartment = (token: string | undefined, id: string, body: DepartmentInput) =>
  api<Department>(token, `/api/departments/${id}`, { method: "PUT", body: JSON.stringify(body) });
