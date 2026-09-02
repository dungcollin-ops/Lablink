import { api } from "./http";

export interface StageCount { stage: string; count: number; }
export interface SourceStat { source: string; count: number; revenue: number; }
export interface AgingStat { resulted: number; pendingToday: number; pending1To3: number; pendingOver3: number; }
export interface DayRevenue { date: string; revenue: number; orders: number; }
export interface ReportSummary {
  totalOrders: number;
  totalRevenue: number;
  byStage: StageCount[];
  bySource: SourceStat[];
  aging: AgingStat;
  revenueByDay: DayRevenue[];
}

export const reportSummary = (token: string | undefined) =>
  api<ReportSummary>(token, "/api/reports/summary");
