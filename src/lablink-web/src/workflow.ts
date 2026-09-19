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

/** Nhãn trạng thái ĐỘNG theo tiến độ lấy/gom ở giai đoạn đầu (badge phải khớp thực tế).
 * Ordered: chưa lấy → "Chờ lấy/gom mẫu"; đã lấy (chưa gom) → "Đã lấy mẫu". */
export function stageLabel(stage: string, p?: { collectAt?: string | null; gatherAt?: string | null }): string {
  if (stage === "Ordered") return p?.collectAt ? "Đã lấy mẫu" : "Chờ lấy/gom mẫu";
  if (stage === "Collected") return "Đã lấy mẫu"; // khách lẻ đã lấy, chờ gom
  return STAGE_LABEL[stage] ?? stage;
}

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

// ---- Danh sách phiếu: lọc / lọc nhanh / sắp xếp / tô đỏ quá hạn (dùng chung Track + LabOrders) ----
export interface OrderRowLike {
  stage: string;
  createdAt: string;
  resultAt?: string | null;
  expectedMaxAt?: string | null;
}

/** Phiếu quá hạn: chưa trả KQ và đã trôi qua mốc dự kiến KQ tối đa. */
export function isOverdue(o: OrderRowLike, now = Date.now()): boolean {
  return !o.resultAt && !!o.expectedMaxAt && new Date(o.expectedMaxAt).getTime() < now;
}

/** Chip trạng thái rút gọn cho danh sách (khớp model gom mẫu song song). */
export const LIST_STAGES: { key: string; label: string }[] = [
  { key: "", label: "Tất cả" },
  { key: "Ordered", label: "Chờ lấy/gom" },
  { key: "Gathered", label: "Đã gom" },
  { key: "Received", label: "Đã nhận" },
  { key: "Resulted", label: "Có KQ" },
];

/** Các quyền hành động — người có 1 trong số này thì có "hàng đợi việc của mình". */
export const MY_WORK_PERMS = [
  "sample.collect", "sample.gather", "sample.receive",
  "result.upload", "hardcopy.deliver", "hardcopy.receive",
];
export function hasMyWorkRole(perms: string[]): boolean {
  return MY_WORK_PERMS.some((p) => perms.includes(p));
}

/** Phiếu có đang chờ ĐÚNG việc của role đang đăng nhập không (theo quyền → stage tương ứng). */
export function isMyWork(
  perms: string[],
  o: { stage: string; collectedAt?: string | null; gatheredAt?: string | null },
): boolean {
  if (perms.includes("sample.collect") && o.stage === "Ordered" && !o.collectedAt) return true; // điều dưỡng: chưa lấy
  if (perms.includes("sample.gather") && o.stage === "Ordered" && !o.gatheredAt) return true;    // NV gom: chưa gom xong
  if (perms.includes("sample.receive") && o.stage === "Gathered") return true;                    // NV nhận: đã gom, chờ nhận
  if (perms.includes("result.upload") && o.stage === "Received") return true;                      // KTV: đã nhận, chờ trả KQ
  if (perms.includes("hardcopy.deliver") && o.stage === "Resulted") return true;                   // giao bản cứng
  if (perms.includes("hardcopy.receive") && o.stage === "HardCopySent") return true;               // nhận bản cứng
  return false;
}

/** Chip lọc trạng thái khớp phiếu (gộp Ordered+Collected và cả hai bước bản cứng).
 * "Có KQ" lấy MỌI phiếu đã có kết quả (kể cả đã sang bước bản cứng), dựa vào resultAt. */
export function matchStage(stageFilter: string, o: { stage: string; resultAt?: string | null }): boolean {
  if (!stageFilter) return true;
  if (stageFilter === "Ordered") return o.stage === "Ordered" || o.stage === "Collected";
  if (stageFilter === "HardCopy") return o.stage === "HardCopySent" || o.stage === "HardCopyReceived";
  if (stageFilter === "Resulted") return !!o.resultAt;
  return o.stage === stageFilter;
}

export type QuickFilter = "" | "today" | "noresult" | "overdue";
export const LIST_QUICK: { key: Exclude<QuickFilter, "">; label: string }[] = [
  { key: "today", label: "Hôm nay" },
  { key: "noresult", label: "Chưa trả KQ" },
  { key: "overdue", label: "Quá hạn" },
];

export function matchQuick(q: QuickFilter, o: OrderRowLike, now = Date.now()): boolean {
  if (!q) return true;
  if (q === "today") {
    const d = new Date(o.createdAt);
    const n = new Date(now);
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  }
  if (q === "noresult") return !o.resultAt;
  if (q === "overdue") return isOverdue(o, now);
  return true;
}

/** Sắp xếp theo ETA: quá hạn / gần hạn lên đầu, phiếu đã có KQ xuống cuối (KQ mới nhất trước). */
export function etaCompare(a: OrderRowLike, b: OrderRowLike): number {
  const rank = (o: OrderRowLike): [number, number] => {
    if (!o.resultAt) {
      const t = o.expectedMaxAt ? new Date(o.expectedMaxAt).getTime() : Number.POSITIVE_INFINITY;
      return [0, t];
    }
    return [1, -new Date(o.resultAt).getTime()];
  };
  const [ga, ta] = rank(a);
  const [gb, tb] = rank(b);
  return ga !== gb ? ga - gb : ta - tb;
}

// ---- Kiểu sắp xếp danh sách (người dùng tự chọn) ----
export type SortMode = "eta" | "orderNo" | "newest";
export const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: "eta", label: "Dự kiến KQ" },
  { key: "orderNo", label: "Mã phiếu" },
  { key: "newest", label: "Mới nhất" },
];
type SortRow = OrderRowLike & { orderNo: string };
const orderNoNum = (s: string): number => {
  const m = /(\d+)/.exec(s || "");
  return m ? parseInt(m[1], 10) : 0;
};
/** Trả comparator theo kiểu sort đang chọn (dùng với Array.sort). */
export function orderCompare(mode: SortMode): (a: SortRow, b: SortRow) => number {
  if (mode === "orderNo") return (a, b) => orderNoNum(a.orderNo) - orderNoNum(b.orderNo);
  if (mode === "newest") return (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  return etaCompare;
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
