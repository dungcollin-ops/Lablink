/** Permission hạt nhỏ dạng "<đối tượng>.<hành động>" (README · RBAC).
 * Menu và nút hành động render theo permission — KHÔNG hard-code theo role. */
export type Permission =
  | "catalog.read"
  | "catalog.price.edit"
  | "deal.create"
  | "deal.read"
  | "deal.approve"
  | "order.create"
  | "order.read"
  | "sample.collect"
  | "sample.send"
  | "sample.gather"
  | "sample.receive"
  | "sample.qc"
  | "hardcopy.deliver"
  | "hardcopy.receive"
  | "sid.print"
  | "result.read"
  | "result.upload"
  | "result.verify"
  | "user.manage"
  | "role.manage"
  | "audit.read"
  | "report.read";

/** Nhóm (role) — user thuộc nhóm nào sẽ có tập permission tương ứng.
 * Bản thật: nạp từ server (GET /api/me). Đây là ánh xạ mẫu theo README. */
export type Role = "doctor" | "nurse" | "retail" | "lab" | "admin";

export const ROLE_LABEL: Record<Role, string> = {
  doctor: "Bác sĩ chỉ định",
  nurse: "Điều dưỡng",
  retail: "Khách lẻ",
  lab: "Trưởng phòng XN",
  admin: "Quản trị hệ thống",
};

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  doctor: ["catalog.read", "deal.create", "deal.read", "order.create", "order.read", "sample.collect", "hardcopy.receive", "sid.print", "result.read"],
  nurse: ["order.read", "result.read", "sample.collect", "hardcopy.receive", "sid.print"],
  retail: ["catalog.read", "order.create", "order.read", "result.read"],
  lab: [
    "catalog.read", "catalog.price.edit",
    "deal.read", "deal.approve",
    "order.read", "sample.collect", "sample.gather", "sample.receive", "sample.qc",
    "hardcopy.deliver",
    "sid.print", "result.read", "result.upload", "result.verify",
  ],
  admin: [
    "catalog.read", "catalog.price.edit",
    "deal.read", "deal.approve", "deal.create",
    "order.read", "order.create",
    "sample.collect", "sample.send", "sample.gather", "sample.receive", "sample.qc",
    "hardcopy.deliver", "hardcopy.receive",
    "sid.print", "result.read", "result.upload", "result.verify",
    "user.manage", "role.manage", "audit.read", "report.read",
  ],
};
