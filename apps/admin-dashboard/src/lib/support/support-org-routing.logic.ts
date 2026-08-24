/**
 * Pure utility helpers for support routing, URL building, and workload math.
 */

export interface RouteRequest {
  departmentId?: string;
  teamId?: string;
  agentId?: string;
  reason?: string;
}

export interface ValidateRouteRequestError {
  valid: false;
  error: string;
}

export interface ValidateRouteRequestSuccess {
  valid: true;
}

export type ValidateRouteRequestResult = ValidateRouteRequestError | ValidateRouteRequestSuccess;

export interface TeamLike {
  id: string;
  departmentId: string;
}

export function validateRouteRequest(
  routing: RouteRequest,
  teams?: TeamLike[] | null,
): ValidateRouteRequestResult {
  const has = (s?: string) => typeof s === "string" && s.trim().length > 0;
  if (!has(routing.departmentId) && !has(routing.teamId) && !has(routing.agentId)) {
    return {
      valid: false,
      error: "Select at least one of department, team, or agent",
    };
  }
  // Cross-check that team belongs to department when both provided and team list available
  if (teams && has(routing.departmentId) && has(routing.teamId)) {
    const t = teams.find((x) => x.id === routing.teamId);
    if (t && t.departmentId !== routing.departmentId) {
      return {
        valid: false,
        error: `Team ${routing.teamId} does not belong to department ${routing.departmentId}`,
      };
    }
  }
  return { valid: true };
}

export interface ReportUrlParams {
  departmentId?: string;
  teamId?: string;
  agentId?: string;
  status?: string;
  priority?: string;
  categoryId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  format?: "csv" | "pdf";
  page?: number;
  limit?: number;
  orderBy?: string;
  orderDir?: string;
}

export function buildTicketsReportUrl(params: ReportUrlParams, base = "/support/reports/export"): string {
  const format = params.format ?? "csv";
  const url = new URL(`${base}/${format}`, "http://localhost");
  const excludeKeys = new Set<keyof ReportUrlParams>(["format"]);
  for (const [k, v] of Object.entries(params)) {
    if (excludeKeys.has(k as keyof ReportUrlParams)) continue;
    if (v === undefined || v === null || v === "") continue;
    url.searchParams.set(k, typeof v === "string" ? v : String(v));
  }
  const search = url.searchParams.toString();
  return `${base}/${format}${search ? `?${search}` : ""}`;
}

export function workloadPct(active: number | null | undefined, max: number | null | undefined): number {
  const a = typeof active === "number" && !Number.isNaN(active) ? active : 0;
  const m = typeof max === "number" && !Number.isNaN(max) ? max : 0;
  if (m <= 0) return 0;
  return a / m;
}
