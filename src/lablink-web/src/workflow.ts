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

/** Bước kế mà user (theo perms) được phép bấm; null nếu không. */
export function allowedNext(stage: string, perms: string[]): { stage: string; perm: string } | null {
  const next = nextStage(stage);
  if (!next) return null;
  const perm = PERM_FOR_STAGE[next];
  return perm && perms.includes(perm) ? { stage: next, perm } : null;
}
