import { API_BASE } from "./config";

export interface CatalogItem {
  id: string;
  code: string;
  name: string;
  group: string;
  provider: string;
  listPrice: number;
  samples: string[];
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
