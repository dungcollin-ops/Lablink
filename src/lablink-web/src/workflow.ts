/** Luồng trạng thái phiếu (khớp backend OrderStage).
 * Giai đoạn đầu (Ordered) có 3 xác nhận SONG SONG: Nhận-đi-gom · Đã-lấy · Đã-gom (xem sampleSteps).
 * Sau khi "Đã gom mẫu" (cần đã lấy) → Gathered, rồi tuyến tính như cũ. */
export const STAGE_FLOW = [
  "Ordered", "Gathered", "Received", "Resulted", "HardCopySent", "HardCopyReceived",
] as const;

export const STAGE_LABEL: Record<string, string> = {
  Ordered: "Chờ lấy/gom mẫu",
  Collected: "Đã lấy mẫu",
  Gathered: "Đã gom mẫu",
  Received: "Đã nhận mẫu",
  Resulted: "Có kết quả",
  HardCopySent: "Đã giao bản cứng",
  HardCopyReceived: "Đã nhận bản cứng",
};

/** Nhãn hành động (nút) để chuyển VÀO một trạng thái (dùng cho bước tuyến tính từ Gathered trở đi). */
export const STAGE_ACTION: Record<string, string> = {
  Received: "Nhận mẫu",
  HardCopySent: "Giao bản cứng",
  HardCopyReceived: "Nhận bản cứng",
};

/** Quyền cần có để chuyển VÀO một trạng thái (Resulted đi qua upload → không có). */
export const PERM_FOR_STAGE: Record<string, string> = {
  Received: "sample.receive",
  HardCopySent: "hardcopy.deliver",
  HardCopyReceived: "hardcopy.receive",
};

// ---- Giai đoạn đầu: 3 xác nhận song song ----
export interface SampleProgress {
  collectBy?: string | null; collectAt?: string | null;
  gatherClaimBy?: string | null; gatherClaimAt?: string | null;
  gatherBy?: string | null; gatherAt?: string | null;
}
export interface SampleStep {
  key: "GatherClaim" | "Collected" | "Gathered";
  label: string;
  perm: string;
  done: boolean;
  by?: string | null;
  at?: string | null;
  /** true khi chưa đủ điều kiện (vd "Đã gom mẫu" khi chưa lấy mẫu). */
  blocked?: boolean;
  blockedReason?: string;
}

/** 3 xác nhận ở giai đoạn Ordered. Gọi khi stage === "Ordered". */
export function sampleSteps(p: SampleProgress): SampleStep[] {
  const collected = !!p.collectAt;
  return [
    { key: "GatherClaim", label: "Nhận đi gom mẫu", perm: "sample.gather", done: !!p.gatherClaimAt, by: p.gatherClaimBy, at: p.gatherClaimAt },
    { key: "Collected", label: "Đã lấy mẫu", perm: "sample.collect", done: collected, by: p.collectBy, at: p.collectAt },
    { key: "Gathered", label: "Đã gom mẫu", perm: "sample.gather", done: !!p.gatherAt, by: p.gatherBy, at: p.gatherAt, blocked: !collected, blockedReason: "Chưa lấy mẫu" },
  ];
}

/** Bước kế tiếp TUYẾN TÍNH (từ Gathered trở đi; bỏ qua Resulted vì đi qua upload). null nếu hết/đang ở Ordered. */
export function nextStage(stage: string): string | null {
  if (stage === "Ordered") return null; // giai đoạn đầu dùng sampleSteps, không phải bước tuyến tính
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

/** Bước kế tuyến tính mà user (theo perms) được phép bấm; null nếu không (Ordered luôn null → dùng sampleSteps). */
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
