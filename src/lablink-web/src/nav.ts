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
  admin: [
    { view: "report", label: "Báo cáo & thống kê", perm: "report.read" },
    { view: "users", label: "Quản trị người dùng", perm: "user.manage" },
    { view: "roles", label: "Vai trò & phân quyền", perm: "role.manage" },
    { view: "audit", label: "Nhật ký hoạt động", perm: "audit.read" },
  ],
};
