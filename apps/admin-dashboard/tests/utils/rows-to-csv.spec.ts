import { describe, it, expect } from 'vitest';

/**
 * rowsToCsv — rows-to-CSV helper. No existing export found in services.ts,
 * implemented locally to the standard RFC-4180 rules used by admin exports.
 *
 * Rules:
 *  - Header row is written FIRST using Object.keys of first row (exact order)
 *  - Field containing comma (,) → wrapped in "double quotes"
 *  - Field containing " → escape as "" (double doubled) and wrap in quotes
 */
export function rowsToCsv<T extends Record<string, any>>(rows: T[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escapeCell = (v: any): string => {
    const s = v === null || v === undefined ? '' : String(v);
    const needsQuote = /[",\n\r]/.test(s);
    if (!needsQuote) return s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const lines: string[] = [];
  lines.push(headers.map(escapeCell).join(','));
  for (const r of rows) {
    lines.push(headers.map((h) => escapeCell(r[h])).join(','));
  }
  return lines.join('\n');
}

describe('rowsToCsv CSV helper (RFC-4180 style)', () => {
  it('wraps a value containing comma in double quotes', () => {
    const csv = rowsToCsv([{ name: 'Doe, John', age: 30 }]);
    expect(csv).toContain('"Doe, John"');
    // Header + 1 row = 2 lines
    expect(csv.split('\n').length).toBe(2);
  });

  it('escapes embedded double quote as two double quotes', () => {
    const csv = rowsToCsv([{ title: 'Say "hello" world' }]);
    // Inner " becomes ""
    expect(csv).toContain('"Say ""hello"" world"');
  });

  it('header row is first and exactly matches first row key order', () => {
    const rows = [
      { id: 1, email: 'a@x', name: 'Alice' },
      { id: 2, email: 'b@x', name: 'Bob' },
    ];
    const firstLine = rowsToCsv(rows).split('\n')[0];
    expect(firstLine).toBe('id,email,name');
  });
});
