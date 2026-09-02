import { api, ApiError } from "./http";
import { API_BASE } from "./config";

export interface OrderItemDto {
  id: string;
  testCode: string;
  testName: string;
  sampleType: string;
  qty: number;
  unitPrice: number;
}
export interface SampleDto {
  id: string;
  sid: string;
  sampleType: string;
  tubeType?: string | null;
  quality: string;
}
export interface ProgressDto {
  collectPlace?: string | null;
  collectBy?: string | null;
  collectAt?: string | null;
  sendVia?: string | null;
  trackingNo?: string | null;
  shipper?: string | null;
  sendAt?: string | null;
  receivePlace?: string | null;
  receiveBy?: string | null;
  receiveAt?: string | null;
  expectedResultAt?: string | null;
}
export interface OrderDto {
  id: string;
  orderNo: string;
  source: string;
  stage: string;
  patientName: string;
  patientMaBN: string;
  diagnosis?: string | null;
  note?: string | null;
  total: number;
  createdAt: string;
  items: OrderItemDto[];
  samples: SampleDto[];
  hasResult: boolean;
  resultFileName?: string | null;
  progress: ProgressDto;
}
export interface OrderListItem {
  id: string;
  orderNo: string;
  source: string;
  stage: string;
  patientName: string;
  patientMaBN: string;
  itemCount: number;
  total: number;
  createdAt: string;
  hasResult: boolean;
}
export interface PatientSearch {
  id: string;
  maBN: string;
  fullName: string;
  dob?: string | null;
  gender?: string | null;
  phone?: string | null;
  address?: string | null;
}

export interface PatientInput {
  maBN?: string;
  fullName: string;
  dob?: string | null;
  gender?: string;
  phone?: string;
  email?: string;
  nationalId?: string;
  bhyt?: string;
  address?: string;
  note?: string;
}
export interface OrderItemInput {
  labTestId: string;
  sampleType?: string;
  qty: number;
}
export interface CreateOrderRequest {
  source: "doctor" | "retail";
  patient: PatientInput;
  clinicName?: string;
  doctorCode?: string;
  diagnosis?: string;
  note?: string;
  items: OrderItemInput[];
}

export const createOrder = (token: string | undefined, body: CreateOrderRequest) =>
  api<OrderDto>(token, "/api/orders", { method: "POST", body: JSON.stringify(body) });

export const listOrders = (token: string | undefined, query?: string, stage?: string) => {
  const qs = new URLSearchParams();
  if (query) qs.set("query", query);
  if (stage) qs.set("stage", stage);
  const s = qs.toString();
  return api<OrderListItem[]>(token, `/api/orders${s ? `?${s}` : ""}`);
};

export const getOrder = (token: string | undefined, id: string) =>
  api<OrderDto>(token, `/api/orders/${id}`);

export const searchPatients = (token: string | undefined, q: string) =>
  api<PatientSearch[]>(token, `/api/patients/search?q=${encodeURIComponent(q)}`);

export const setOrderStage = (token: string | undefined, id: string, stage: string) =>
  api<OrderDto>(token, `/api/orders/${id}/stage`, { method: "POST", body: JSON.stringify({ stage }) });

export const setSampleQuality = (token: string | undefined, sampleId: string, quality: string) =>
  api<OrderDto>(token, `/api/orders/samples/${sampleId}/quality`, { method: "POST", body: JSON.stringify({ quality }) });

export const setOrderProgress = (token: string | undefined, id: string, progress: ProgressDto) =>
  api<OrderDto>(token, `/api/orders/${id}/progress`, { method: "POST", body: JSON.stringify(progress) });

export const assignCollect = (
  token: string | undefined,
  id: string,
  body: { collector: string; appointmentAt?: string | null; place?: string | null },
) => api<OrderDto>(token, `/api/orders/${id}/assign-collect`, { method: "POST", body: JSON.stringify(body) });

export const sendSample = (
  token: string | undefined,
  id: string,
  body: { sendVia: string; trackingNo?: string | null; shipper?: string | null; sendAt?: string | null },
) => api<OrderDto>(token, `/api/orders/${id}/send`, { method: "POST", body: JSON.stringify(body) });

/** Upload file kết quả (multipart) — trả phiếu đã cập nhật. */
export async function uploadResult(token: string | undefined, id: string, file: File): Promise<OrderDto> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_BASE}/api/orders/${id}/result`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  if (!res.ok) {
    let msg = `Lỗi ${res.status}`;
    try { msg = (await res.json()).message ?? msg; } catch { /* ignore */ }
    throw new ApiError(res.status, msg);
  }
  return res.json();
}

/** Tải file kết quả về máy (đính kèm token, kích hoạt download). */
export async function downloadResult(token: string | undefined, id: string, fallbackName = "ketqua.pdf"): Promise<void> {
  const res = await fetch(`${API_BASE}/api/orders/${id}/result`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new ApiError(res.status, `Không tải được kết quả (${res.status})`);
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") ?? "";
  const m = /filename\*?=(?:UTF-8'')?"?([^;"]+)"?/i.exec(cd);
  const name = m ? decodeURIComponent(m[1]) : fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
