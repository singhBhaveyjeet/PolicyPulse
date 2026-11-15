// Turns raw spreadsheet rows into clean Policy records and merges them into the workspace.
import type { ImportRecord, Policy } from "./types";
import {
  REQUIRED_FIELDS, cleanEmail, cleanPhone, cleanText, makePolicyKey,
  normalizePolicyType, parsePremium, textKey, toISODate,
} from "./normalize";

export type SourceRow = { rowNumber: number; values: Record<string, unknown> };
export type RejectedRow = { rowNumber: number; reason: string; values: Record<string, unknown> };

export type BuildOptions = {
  mapping: Record<string, string>;
  fileName: string;
  sheetName: string;
  defaultInsurer: string;
  defaultType: string;
  existing: Policy[]; // current workspace, used to match spelling and find duplicates
};

export type Match = { existing: Policy; incoming: Policy };

export type BuildResult = {
  fresh: Policy[];
  matches: Match[];
  rejected: RejectedRow[];
  repeatedInFile: number;
  missingRequired: string[];
};

let counter = 0;
export const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function buildPolicies(rows: SourceRow[], opts: BuildOptions): BuildResult {
  const { mapping } = opts;
  const missingRequired = REQUIRED_FIELDS.filter((f) => !mapping[f]);
  const result: BuildResult = { fresh: [], matches: [], rejected: [], repeatedInFile: 0, missingRequired };
  if (missingRequired.length) return result;

  // Reuse the spelling already in the workspace so "hdfc ergo" and "HDFC ERGO" stay one insurer.
  const insurerSpelling = new Map<string, string>();
  for (const p of opts.existing) if (!insurerSpelling.has(textKey(p.insurer))) insurerSpelling.set(textKey(p.insurer), p.insurer);
  const canonicalInsurer = (raw: string) => {
    const name = cleanText(raw);
    if (!name) return "";
    const k = textKey(name);
    if (!insurerSpelling.has(k)) insurerSpelling.set(k, name);
    return insurerSpelling.get(k) as string;
  };

  const existingByKey = new Map<string, Policy>();
  for (const p of opts.existing) existingByKey.set(makePolicyKey(p.insurer, p.policyNumber), p);

  const get = (r: SourceRow, f: string) => (mapping[f] ? r.values[mapping[f]] : "");
  const incomingByKey = new Map<string, Policy>();
  const now = todayISO();

  for (const r of rows) {
    const customerName = cleanText(get(r, "customerName"));
    const policyNumber = cleanText(get(r, "policyNumber"));
    const expiryRaw = get(r, "expiryDate");
    const expiryDate = toISODate(expiryRaw);

    let reason = "";
    if (!customerName) reason = "Missing customer name";
    else if (!policyNumber) reason = "Missing policy number";
    else if (!expiryDate) reason = cleanText(expiryRaw) ? `Unreadable expiry date "${cleanText(expiryRaw)}"` : "Missing expiry date";
    if (reason) { result.rejected.push({ rowNumber: r.rowNumber, reason, values: r.values }); continue; }

    const insurer = canonicalInsurer(String(get(r, "insurer") ?? "")) || canonicalInsurer(opts.defaultInsurer) || "Unassigned";
    const phone = cleanPhone(get(r, "phone"));
    const policy: Policy = {
      id: newId("pol"),
      customerName,
      phone: phone.display,
      email: cleanEmail(get(r, "email")),
      policyNumber,
      insurer,
      policyType: normalizePolicyType(get(r, "policyType")) || normalizePolicyType(opts.defaultType) || "Other",
      startDate: toISODate(get(r, "startDate")),
      expiryDate,
      premium: parsePremium(get(r, "premium")),
      sourceFile: opts.fileName,
      sourceSheet: opts.sheetName,
      sourceRow: r.rowNumber,
      importedAt: now,
      importId: "",
      followUp: "pending",
      note: "",
    };

    const key = makePolicyKey(insurer, policyNumber);
    const seen = incomingByKey.get(key);
    if (seen) {
      result.repeatedInFile++;
      if (policy.expiryDate > seen.expiryDate) incomingByKey.set(key, policy); // keep the newest term
      continue;
    }
    incomingByKey.set(key, policy);
  }

  for (const [key, incoming] of incomingByKey) {
    const existing = existingByKey.get(key);
    if (existing) result.matches.push({ existing, incoming });
    else result.fresh.push(incoming);
  }
  return result;
}

export type DuplicateMode = "update" | "skip";

export type ApplyOutcome = { policies: Policy[]; record: ImportRecord };

const COMPARE: (keyof Policy)[] = ["customerName", "phone", "email", "insurer", "policyType", "startDate", "expiryDate", "premium"];

/** Merge one built sheet into the workspace and describe what happened. */
export function applyBuild(current: Policy[], built: BuildResult, mode: DuplicateMode, fileName: string, sheetName: string): ApplyOutcome {
  const importId = newId("imp");
  const updatedById = new Map<string, Policy>();
  let updated = 0;
  let unchanged = 0;

  for (const { existing, incoming } of built.matches) {
    if (mode === "skip") { unchanged++; continue; }
    const merged: Policy = {
      ...existing,
      customerName: incoming.customerName || existing.customerName,
      phone: incoming.phone || existing.phone,
      email: incoming.email || existing.email,
      insurer: incoming.insurer !== "Unassigned" ? incoming.insurer : existing.insurer,
      policyType: incoming.policyType !== "Other" ? incoming.policyType : existing.policyType,
      startDate: incoming.startDate || existing.startDate,
      expiryDate: incoming.expiryDate,
      premium: incoming.premium || existing.premium,
    };
    const changed = COMPARE.some((k) => merged[k] !== existing[k]);
    if (!changed) { unchanged++; continue; }
    // A new expiry date means a new term: the renewal conversation starts again.
    if (merged.expiryDate !== existing.expiryDate) merged.followUp = "pending";
    merged.sourceFile = fileName;
    merged.sourceSheet = sheetName;
    merged.sourceRow = incoming.sourceRow;
    merged.importedAt = incoming.importedAt;
    merged.importId = importId;
    updatedById.set(existing.id, merged);
    updated++;
  }

  const fresh = built.fresh.map((p) => ({ ...p, importId }));
  const policies = [...fresh, ...current.map((p) => updatedById.get(p.id) ?? p)];
  return {
    policies,
    record: {
      id: importId, fileName, sheetName,
      added: fresh.length, updated, unchanged,
      rejected: built.rejected.length,
      importedAt: new Date().toISOString(),
    },
  };
}
