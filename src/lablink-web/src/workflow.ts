/** Luồng 7 trạng thái phiếu + quyền theo bước (khớp backend OrderStage). */
export const STAGE_FLOW = [
  "Ordered", "Collected", "Gathered", "Received", "Resulted", "HardCopySent", "HardCopyReceived",
] as const;

export const STAGE_LABEL: Record<string, string> = {
  Ordered: "Chờ lấy mẫu",
  Collected: "Đã lấy mẫu",
  Gathered: "Đã gom mẫu",
  Received: "Đã nhận mẫu",
  Resulted: "Có kết quả",
  HardCopySent: "Đã giao bản cứng",
  HardCopyReceived: "Đã nhận bản cứng",
};

/** Nhãn hành động (nút) để chuyển VÀO một trạng thái. */
export const STAGE_ACTION: Record<string, string> = {
  Collected: "Đã lấy mẫu",
  Gathered: "Gom mẫu",
  Received: "Nhận mẫu",
  HardCopySent: "Giao bản cứng",
  HardCopyReceived: "Nhận bản cứng",
};

/** Quyền cần có để chuyển VÀO một trạng thái (Resulted đi qua upload → không có). */
export const PERM_FOR_STAGE: Record<string, string> = {
  Collected: "sample.collect",
  Gathered: "sample.gather",
  Received: "sample.receive",
  HardCopySent: "hardcopy.deliver",
  HardCopyReceived: "hardcopy.receive",
};

/** Bước kế tiếp trong luồng (bỏ qua Resulted vì đi qua upload). null nếu hết. */
export function nextStage(stage: string): string | null {
  const i = STAGE_FLOW.indexOf(stage as (typeof STAGE_FLOW)[number]);
  if (i < 0 || i >= STAGE_FLOW.length - 1) return null;
  const next = STAGE_FLOW[i + 1];
  return next === "Resulted" ? null : next;
}

/** Các bước bản cứng — chỉ áp dụng khi phòng khám nhận bản cứng. */
const HARDCOPY_STAGES = ["HardCopySent", "HardCopyReceived"];

/** Chuỗi trạng thái hiển thị cho 1 phiếu (bỏ B6/B7 nếu phòng khám không nhận bản cứng). */
export function visibleFlow(hardCopyRequired: boolean): string[] {
  return hardCopyRequired ? [...STAGE_FLOW] : STAGE_FLOW.filter((s) => !HARDCOPY_STAGES.includes(s));
}

/** Bước kế mà user (theo perms) được phép bấm; null nếu không.
 * hardCopyRequired=false → không cho tiến vào B6/B7 (phiếu xong ở "Có kết quả"). */
export function allowedNext(
  stage: string,
  perms: string[],
  hardCopyRequired = true,
): { stage: string; perm: string } | null {
  const next = nextStage(stage);
  if (!next) return null;
  if (!hardCopyRequired && HARDCOPY_STAGES.includes(next)) return null;
  const perm = PERM_FOR_STAGE[next];
  return perm && perms.includes(perm) ? { stage: next, perm } : null;
}
