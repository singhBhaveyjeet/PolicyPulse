// Reads .xlsx / .xls / .csv files in the browser. Nothing is uploaded anywhere.
import * as XLSX from "xlsx";
import type { SourceRow } from "./build";
import type { Policy } from "./types";
import { autoMapHeaders, mappedCount } from "./normalize";

export type ParsedSheet = {
  name: string;
  headerRow: number; // Excel row number that holds the column titles
  headers: string[];
  rows: SourceRow[];
  truncated: boolean;
};

export const MAX_ROWS_PER_SHEET = 50000;
const HEADER_SCAN_ROWS = 25;

const cellText = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

function uniqueHeaders(raw: string[]): string[] {
  const seen = new Map<string, number>();
  return raw.map((h, i) => {
    const base = h || `Column ${i + 1}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base} (${n})`;
  });
}

/** Agents often put a title or logo above the table, so find the row that really holds the headers. */
function findHeaderIndex(aoa: unknown[][]): number {
  let best = -1;
  let bestScore = 0;
  const limit = Math.min(HEADER_SCAN_ROWS, aoa.length);
  for (let i = 0; i < limit; i++) {
    const cells = aoa[i].map(cellText).filter(Boolean);
    if (cells.length < 2) continue;
    const score = mappedCount(autoMapHeaders(cells));
    if (score > bestScore) { best = i; bestScore = score; }
  }
  if (best >= 0 && bestScore >= 2) return best;
  for (let i = 0; i < limit; i++) if (aoa[i].map(cellText).filter(Boolean).length >= 2) return i;
  return 0;
}

export async function readSpreadsheet(file: File): Promise<ParsedSheet[]> {
  const isCsv = /\.(csv|tsv|txt)$/i.test(file.name);
  const wb = isCsv
    ? XLSX.read(await file.text(), { type: "string", raw: true }) // raw: keep text exactly as typed
    : XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });

  const sheets: ParsedSheet[] = [];
  wb.SheetNames.forEach((name, idx) => {
    const hidden = wb.Workbook?.Sheets?.[idx]?.Hidden;
    if (hidden) return;
    const ws = wb.Sheets[name];
    if (!ws || !ws["!ref"]) return;
    const firstRow = XLSX.utils.decode_range(ws["!ref"]).s.r; // 0-based
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "", blankrows: true });
    if (!aoa.length) return;

    const hIdx = findHeaderIndex(aoa);
    const headers = uniqueHeaders((aoa[hIdx] ?? []).map(cellText));
    const rows: SourceRow[] = [];
    let truncated = false;
    for (let i = hIdx + 1; i < aoa.length; i++) {
      const line = aoa[i];
      if (!line.some((c) => cellText(c) !== "")) continue;
      if (rows.length >= MAX_ROWS_PER_SHEET) { truncated = true; break; }
      const values: Record<string, unknown> = {};
      headers.forEach((h, c) => { values[h] = line[c] ?? ""; });
      rows.push({ rowNumber: firstRow + i + 1, values });
    }
    sheets.push({ name, headerRow: firstRow + hIdx + 1, headers, rows, truncated });
  });
  return sheets;
}

export function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ["Customer Name", "Mobile No", "Email", "Policy No", "Insurance Company", "Policy Type", "Start Date", "Expiry Date", "Premium"],
    ["Example Customer", "9876500000", "customer@example.com", "POL-0001", "HDFC ERGO", "Motor", "15/03/2025", "14/03/2026", 15400],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Policies");
  XLSX.writeFile(wb, "policypulse-template.xlsx");
}

export function downloadRows(rows: Record<string, unknown>[], sheetName: string, fileName: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, fileName);
}

const serialOf = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
};

const FOLLOW_LABEL: Record<string, string> = { pending: "To contact", contacted: "Contacted", renewed: "Renewed", lost: "Lost" };

/**
 * Writes the current policies to an Excel file. The first columns use the same titles as the
 * import template, so the downloaded file can be imported again without any column matching.
 */
export function exportPolicies(policies: Policy[], statusOf: (p: Policy) => string, fileName: string) {
  const head = ["Customer Name", "Mobile No", "Email", "Policy No", "Insurance Company", "Policy Type", "Start Date", "Expiry Date", "Premium", "Status", "Follow-up", "Notes", "Source File", "Source Row"];
  const aoa: unknown[][] = [head, ...policies.map((p) => [
    p.customerName, p.phone, p.email, p.policyNumber, p.insurer, p.policyType, "", "", p.premium || "",
    statusOf(p), FOLLOW_LABEL[p.followUp] ?? p.followUp, p.note, p.sourceFile, p.sourceRow || "",
  ])];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  policies.forEach((p, i) => {
    const r = i + 1;
    const put = (col: number, iso: string) => {
      if (!iso) return;
      ws[XLSX.utils.encode_cell({ r, c: col })] = { t: "n", v: serialOf(iso), z: "dd-mmm-yyyy" };
    };
    put(6, p.startDate);
    put(7, p.expiryDate);
    if (p.premium) ws[XLSX.utils.encode_cell({ r, c: 8 })] = { t: "n", v: p.premium, z: "#,##0" };
  });
  ws["!cols"] = [26, 15, 26, 18, 22, 14, 13, 13, 12, 14, 13, 30, 24, 10].map((wch) => ({ wch }));
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(1, policies.length), c: head.length - 1 } }) };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Policies");
  XLSX.writeFile(wb, fileName);
}

export function downloadJSON(data: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
