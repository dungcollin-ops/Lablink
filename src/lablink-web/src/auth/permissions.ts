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
  | "order.read.all"
  | "sample.collect"
  | "sample.gather"
  | "sample.receive"
  | "sample.qc"
  | "hardcopy.deliver"
  | "hardcopy.receive"
  | "sid.print"
  | "result.read"
  | "result.upload"
  | "user.manage"
  | "role.manage"
  | "department.manage"
  | "audit.read"
  | "report.read";

/** Nhóm (role) — user thuộc nhóm nào sẽ có tập permission tương ứng.
 * Bản thật: nạp từ server (GET /api/me). Đây là ánh xạ mẫu theo README. */
export type Role =
  | "doctor" | "nurse" | "retail" | "lab"
  | "fastlab_gather" | "fastlab_receive" | "fastlab_hardcopy"
  | "admin";

export const ROLE_LABEL: Record<Role, string> = {
  doctor: "Bác sĩ chỉ định",
  nurse: "Điều dưỡng",
  retail: "Khách lẻ",
  lab: "Trưởng phòng XN",
  fastlab_gather: "FastLab · Gom mẫu",
  fastlab_receive: "FastLab · KTV nhận mẫu",
  fastlab_hardcopy: "FastLab · Giao bản cứng",
  admin: "Quản trị hệ thống",
};

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  doctor: ["catalog.read", "deal.create", "deal.read", "order.create", "order.read", "sample.collect", "hardcopy.receive", "sid.print", "result.read"],
  nurse: ["order.read", "result.read", "sample.collect", "hardcopy.receive", "sid.print"],
  retail: ["catalog.read", "order.create", "order.read", "result.read"],
  lab: [
    "catalog.read", "catalog.price.edit",
    "deal.read", "deal.approve",
    "order.read", "order.read.all", "sample.collect", "sample.gather", "sample.receive", "sample.qc",
    "hardcopy.deliver",
    "sid.print", "result.read", "result.upload",
  ],
  fastlab_gather: ["order.read", "order.read.all", "sample.gather"],
  fastlab_receive: ["order.read", "order.read.all", "sample.receive", "sample.qc", "sid.print", "result.read", "result.upload"],
  fastlab_hardcopy: ["order.read", "order.read.all", "hardcopy.deliver"],
  admin: [
    "catalog.read", "catalog.price.edit",
    "deal.read", "deal.approve", "deal.create",
    "order.read", "order.read.all", "order.create",
    "sample.collect", "sample.gather", "sample.receive", "sample.qc",
    "hardcopy.deliver", "hardcopy.receive",
    "sid.print", "result.read", "result.upload",
    "user.manage", "role.manage", "department.manage", "audit.read", "report.read",
  ],
};
