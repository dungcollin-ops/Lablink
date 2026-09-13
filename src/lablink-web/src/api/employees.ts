import { api } from "./http";

export interface Employee {
  id: string;
  departmentId: string;
  departmentName: string;
  fullName: string;
  code?: string | null;
  position: string;
  phone?: string | null;
  isActive: boolean;
}
export interface EmployeeInput {
  departmentId: string;
  fullName: string;
  code?: string;
  position: string;
  phone?: string;
  isActive: boolean;
}

/** Chức danh — danh sách cố định. */
export const POSITIONS = ["Bác sĩ", "Điều dưỡng", "KTV", "Giao nhận", "Khác"];

export const listEmployees = (token: string | undefined, departmentId?: string, includeInactive = true) => {
  const qs = new URLSearchParams();
  if (departmentId) qs.set("departmentId", departmentId);
  qs.set("includeInactive", String(includeInactive));
  return api<Employee[]>(token, `/api/employees?${qs}`);
};

/** Bác sĩ cho ô "Bác sĩ chỉ định" khi tạo phiếu (quyền order.create; theo phòng người tạo). */
export const listDoctorsForOrder = (token: string | undefined) =>
  api<Employee[]>(token, "/api/employees/doctors");

export const createEmployee = (token: string | undefined, body: EmployeeInput) =>
  api<Employee>(token, "/api/employees", { method: "POST", body: JSON.stringify(body) });

export const updateEmployee = (token: string | undefined, id: string, body: EmployeeInput) =>
  api<Employee>(token, `/api/employees/${id}`, { method: "PUT", body: JSON.stringify(body) });
