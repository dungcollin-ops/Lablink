import t from "../pages/Track.module.css";

/** Màu badge theo trạng thái phiếu (dùng chung cho danh sách + chi tiết). */
export const STAGE_CLS: Record<string, string> = {
  Ordered: t.stageOrdered, Collected: t.stageCollected, Gathered: t.stageSent,
  Received: t.stageReceived, Resulted: t.stageResulted,
  HardCopySent: t.stageRunning, HardCopyReceived: t.stageResulted,
};
