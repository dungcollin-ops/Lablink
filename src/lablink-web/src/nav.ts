import type { Permission, Role } from "./auth/permissions";

export interface NavItem {
  view: string;
  label: string;
  /** quyền tối thiểu để thấy mục này (dùng để lọc menu theo permission) */
  perm: Permission;
  /** badge tùy chọn (vd số deal chờ duyệt / đơn mới) */
  badge?: number;
}

/** Menu theo nhóm (README · Roles & Navigation).
 * Nhóm quyết định workspace; từng mục vẫn gắn permission để lọc/ẩn-hiện. */
export const NAV: Record<Role, NavItem[]> = {
  doctor: [
    { view: "track", label: "Xem kết quả", perm: "result.read" },
    { view: "order", label: "Chỉ định xét nghiệm", perm: "order.create" },
    { view: "deal", label: "Quản lý danh mục xét nghiệm", perm: "deal.create" },
  ],
  nurse: [
    { view: "track", label: "Lấy mẫu & kết quả", perm: "result.read" },
  ],
  retail: [
    { view: "book", label: "Đặt xét nghiệm", perm: "order.create" },
    { view: "track", label: "Theo dõi kết quả", perm: "result.read" },
  ],
  lab: [
    { view: "catalog", label: "Danh mục & giá niêm yết", perm: "catalog.read" },
    { view: "deals", label: "Duyệt giá đề nghị", perm: "deal.approve" },
    { view: "orders", label: "Chỉ định & trả kết quả", perm: "sample.receive" },
  ],
  // Nội bộ FastLab — workspace xử lý mẫu/kết quả (thấy mọi phiếu qua order.read.all).
  fastlab_gather: [
    { view: "orders", label: "Gom & xử lý mẫu", perm: "order.read" },
  ],
  fastlab_receive: [
    { view: "orders", label: "Nhận mẫu & trả kết quả", perm: "order.read" },
  ],
  fastlab_hardcopy: [
    { view: "orders", label: "Giao bản cứng", perm: "order.read" },
  ],
  admin: [
    { view: "report", label: "Báo cáo & thống kê", perm: "report.read" },
    { view: "catalog", label: "Danh mục & giá niêm yết", perm: "catalog.read" },
    { view: "departments", label: "Danh mục phòng ban", perm: "department.manage" },
    { view: "employees", label: "Danh mục nhân viên", perm: "department.manage" },
    { view: "users", label: "Quản trị người dùng", perm: "user.manage" },
    { view: "roles", label: "Vai trò & phân quyền", perm: "role.manage" },
    { view: "audit", label: "Nhật ký hoạt động", perm: "audit.read" },
  ],
};
