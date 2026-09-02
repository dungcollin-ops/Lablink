import { api } from "./http";

export interface DealItem {
  id: string;
  labTestId: string;
  code: string;
  name: string;
  group: string;
  listPrice: number;
  proposedPrice: number;
  status: string; // Pending | Approved | Rejected
  diffPercent: number;
}

export interface DealBatch {
  id: string;
  proposedById: string;
  proposedByName: string;
  note?: string | null;
  createdAt: string;
  items: DealItem[];
}

export interface DealLineInput {
  labTestId: string;
  proposedPrice: number;
}

export const createDealBatch = (
  token: string | undefined,
  body: { note?: string; items: DealLineInput[] },
) => api<{ id: string }>(token, "/api/deals", { method: "POST", body: JSON.stringify(body) });

export const myDeals = (token: string | undefined) =>
  api<DealBatch[]>(token, "/api/deals/mine");

export const pendingDeals = (token: string | undefined) =>
  api<DealBatch[]>(token, "/api/deals/pending");

export const pendingDealCount = (token: string | undefined) =>
  api<number>(token, "/api/deals/pending-count");

export const approveDealItem = (token: string | undefined, id: string) =>
  api(token, `/api/deals/items/${id}/approve`, { method: "POST" });
export const rejectDealItem = (token: string | undefined, id: string) =>
  api(token, `/api/deals/items/${id}/reject`, { method: "POST" });
export const approveDealBatch = (token: string | undefined, batchId: string) =>
  api(token, `/api/deals/${batchId}/approve-all`, { method: "POST" });
export const rejectDealBatch = (token: string | undefined, batchId: string) =>
  api(token, `/api/deals/${batchId}/reject-all`, { method: "POST" });
