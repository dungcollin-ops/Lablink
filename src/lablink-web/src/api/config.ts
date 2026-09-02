/** Base URL của backend API.
 * - Production (build): API_BASE rỗng → gọi CÙNG ORIGIN (API phục vụ luôn SPA).
 * - Dev: đặt VITE_API_BASE (vd http://localhost:5100) trong .env.development.
 * - Dev không đặt VITE_API_BASE → chế độ MOCK (không cần backend). */
export const API_BASE = import.meta.env.VITE_API_BASE ?? "";

/** Dùng API thật khi: bản build production, HOẶC dev có đặt VITE_API_BASE. */
export const USE_API = import.meta.env.PROD || API_BASE.length > 0;
