/**
 * Pure utility helpers for support organization analytics.
 * All functions are side-effect free for easy unit testing.
 */

export function formatPercent(value: number | null | undefined, fractionDigits = 1): string {
  if (value === null || value === undefined || typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }
  // Values <= 1 treated as fractions (0..1), values >1 treated as already-percent
  const pct = Math.abs(value) <= 1 ? value * 100 : value;
  return `${pct.toFixed(fractionDigits)}%`;
}

export function formatDurationMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || typeof ms !== "number" || Number.isNaN(ms)) {
    return "—";
  }
  const total = Math.max(0, Math.round(ms / 1000));
  if (total < 60) return `${total}s`;
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins < 60) return `${mins}:${secs.toString().padStart(2, "0")}`;
  const hours = Math.floor(mins / 60);
  const mm = mins % 60;
  if (hours < 24) return `${hours}:${mm.toString().padStart(2, "0")}h`;
  const days = Math.floor(hours / 24);
  const h = hours % 24;
  return h === 0 ? `${days}d` : `${days}d ${h}h`;
}

export interface CsatGrade {
  stars: number;
  label: "Excellent" | "Good" | "Average" | "Poor" | "Bad" | "N/A";
}

export function csatGrade(score: number | null | undefined): CsatGrade {
  if (score === null || score === undefined || typeof score !== "number" || Number.isNaN(score) || score <= 0) {
    return { stars: 0, label: "N/A" };
  }
  if (score >= 4.5) return { stars: 5, label: "Excellent" };
  if (score >= 3.8) return { stars: 4, label: "Good" };
  if (score >= 2.8) return { stars: 3, label: "Average" };
  if (score >= 1.8) return { stars: 2, label: "Poor" };
  return { stars: 1, label: "Bad" };
}

export type HealthGrade = "A" | "B" | "C" | "D" | "E" | "F";

export function healthGrade(compositeScore: number): HealthGrade {
  const s = Math.max(0, Math.min(100, compositeScore));
  if (s >= 90) return "A";
  if (s >= 80) return "B";
  if (s >= 70) return "C";
  if (s >= 60) return "D";
  if (s >= 50) return "E";
  return "F";
}

export interface ScorecardLike {
  id: string;
  name: string;
  compositeScore: number;
  [key: string]: unknown;
}

export interface RankedScorecard extends ScorecardLike {
  rank: number;
}

export function rankDepartmentScorecard<T extends ScorecardLike>(rows: T[]): Array<T & { rank: number }> {
  const sorted = [...rows].sort((a, b) => b.compositeScore - a.compositeScore);
  let rank = 0;
  let prevScore: number | null = null;
  return sorted.map((row) => {
    if (prevScore === null || row.compositeScore < prevScore) {
      rank = rank + 1;
      prevScore = row.compositeScore;
    }
    return { ...row, rank };
  });
}
