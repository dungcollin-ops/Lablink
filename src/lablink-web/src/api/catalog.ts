import { API_BASE } from "./config";

export interface CatalogItem {
  id: string;
  code: string;
  name: string;
  group: string;
  provider: string;
  listPrice: number;
  samples: string[];
  tatMinHours?: number | null;
  tatMaxHours?: number | null;
}

export interface CatalogPage {
  total: number;
  page: number;
  pageSize: number;
  items: CatalogItem[];
}

export interface CatalogFacets {
  groups: string[];
  providers: string[];
}

function authHeaders(token?: string): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface CatalogParams {
  query?: string;
  group?: string;
  provider?: string;
  page?: number;
  pageSize?: number;
}

export async function fetchCatalog(token: string | undefined, p: CatalogParams): Promise<CatalogPage> {
  const qs = new URLSearchParams();
  if (p.query) qs.set("query", p.query);
  if (p.group) qs.set("group", p.group);
  if (p.provider) qs.set("provider", p.provider);
  qs.set("page", String(p.page ?? 1));
  qs.set("pageSize", String(p.pageSize ?? 50));
  const res = await fetch(`${API_BASE}/api/catalog?${qs}`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`catalog ${res.status}`);
  return res.json();
}

export async function fetchFacets(token?: string): Promise<CatalogFacets> {
  const res = await fetch(`${API_BASE}/api/catalog/facets`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`facets ${res.status}`);
  return res.json();
}

export interface CatalogItemInput {
  code: string;
  name: string;
  group: string;
  provider: string;
  listPrice: number;
  samples: string[];
  tatMinHours?: number | null;
  tatMaxHours?: number | null;
}

async function jsonOrThrow(res: Response): Promise<Response> {
  if (!res.ok) {
    let msg = `Lỗi ${res.status}`;
    try { msg = (await res.json()).message ?? msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res;
}

/** Thêm 1 xét nghiệm (admin). */
export async function createCatalog(token: string | undefined, body: CatalogItemInput): Promise<CatalogItem> {
  const res = await jsonOrThrow(await fetch(`${API_BASE}/api/catalog`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(body),
  }));
  return res.json();
}

/** Sửa đầy đủ 1 xét nghiệm (admin). */
export async function updateCatalog(token: string | undefined, id: string, body: CatalogItemInput): Promise<CatalogItem> {
  const res = await jsonOrThrow(await fetch(`${API_BASE}/api/catalog/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(body),
  }));
  return res.json();
}

/** Xóa hẳn 1 xét nghiệm (admin). */
export async function deleteCatalog(token: string | undefined, id: string): Promise<void> {
  await jsonOrThrow(await fetch(`${API_BASE}/api/catalog/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  }));
}

/** Sửa TG Min/Max (giờ) của 1 xét nghiệm. */
export async function updateCatalogTat(
  token: string | undefined, id: string, tatMinHours: number | null, tatMaxHours: number | null,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/catalog/${id}/tat`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ tatMinHours, tatMaxHours }),
  });
  if (!res.ok) throw new Error(`Lưu TG thất bại (${res.status})`);
}
