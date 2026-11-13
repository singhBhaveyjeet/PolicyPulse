import type { ImportRecord, Policy, Workspace } from "./types";
import { mergeProfile, mergeSettings } from "./settings";
import { getSupabaseClient } from "./supabase";

type PolicyRow = {
  id: string;
  customer_name: string;
  phone: string;
  email: string;
  policy_number: string;
  insurer: string;
  policy_type: string;
  start_date: string | null;
  expiry_date: string;
  premium: number | string;
  source_file: string;
  source_sheet: string;
  source_row: number;
  imported_at: string;
  import_id: string;
  follow_up: Policy["followUp"];
  note: string;
};

type ImportRow = {
  id: string;
  file_name: string;
  sheet_name: string;
  added: number;
  updated: number;
  unchanged: number;
  rejected: number;
  imported_at: string;
};

const snapshots = new Map<string, Workspace>();
const pendingSaves = new Map<string, Promise<void>>();
const BATCH_SIZE = 500;

const cloneWorkspace = (workspace: Workspace): Workspace => ({
  policies: workspace.policies.map((policy) => ({ ...policy })),
  imports: workspace.imports.map((record) => ({ ...record })),
  profile: workspace.profile ? { ...workspace.profile, specialities: [...workspace.profile.specialities] } : undefined,
  settings: workspace.settings ? { ...workspace.settings } : undefined,
});

function policyFromRow(row: PolicyRow): Policy {
  return {
    id: row.id,
    customerName: row.customer_name,
    phone: row.phone,
    email: row.email,
    policyNumber: row.policy_number,
    insurer: row.insurer,
    policyType: row.policy_type,
    startDate: row.start_date ?? "",
    expiryDate: row.expiry_date,
    premium: Number(row.premium),
    sourceFile: row.source_file,
    sourceSheet: row.source_sheet,
    sourceRow: row.source_row,
    importedAt: row.imported_at,
    importId: row.import_id,
    followUp: row.follow_up,
    note: row.note,
  };
}

function policyToRow(policy: Policy, userId: string) {
  return {
    user_id: userId,
    id: policy.id,
    customer_name: policy.customerName,
    phone: policy.phone,
    email: policy.email,
    policy_number: policy.policyNumber,
    insurer: policy.insurer,
    policy_type: policy.policyType,
    start_date: policy.startDate || null,
    expiry_date: policy.expiryDate,
    premium: policy.premium,
    source_file: policy.sourceFile,
    source_sheet: policy.sourceSheet,
    source_row: policy.sourceRow,
    imported_at: policy.importedAt || new Date().toISOString(),
    import_id: policy.importId,
    follow_up: policy.followUp,
    note: policy.note,
  };
}

function importFromRow(row: ImportRow): ImportRecord {
  return {
    id: row.id,
    fileName: row.file_name,
    sheetName: row.sheet_name,
    added: row.added,
    updated: row.updated,
    unchanged: row.unchanged,
    rejected: row.rejected,
    importedAt: row.imported_at,
  };
}

function importToRow(record: ImportRecord, userId: string) {
  return {
    user_id: userId,
    id: record.id,
    file_name: record.fileName,
    sheet_name: record.sheetName,
    added: record.added,
    updated: record.updated,
    unchanged: record.unchanged,
    rejected: record.rejected,
    imported_at: record.importedAt,
  };
}

async function loadPolicies(userId: string): Promise<Policy[]> {
  const client = getSupabaseClient();
  const policies: Policy[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client
      .from("policy_records")
      .select("*")
      .eq("user_id", userId)
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(`Could not load policy records: ${error.message}`);
    const rows = (data ?? []) as PolicyRow[];
    policies.push(...rows.map(policyFromRow));
    if (rows.length < 1000) return policies;
  }
}

async function loadImports(userId: string): Promise<ImportRecord[]> {
  const client = getSupabaseClient();
  const imports: ImportRecord[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client
      .from("policy_imports")
      .select("*")
      .eq("user_id", userId)
      .order("imported_at", { ascending: false })
      .range(from, from + 999);
    if (error) throw new Error(`Could not load import history: ${error.message}`);
    const rows = (data ?? []) as ImportRow[];
    imports.push(...rows.map(importFromRow));
    if (rows.length < 1000) return imports;
  }
}

export async function loadWorkspace(userId: string): Promise<Workspace> {
  const client = getSupabaseClient();
  const [policies, imports, result] = await Promise.all([
    loadPolicies(userId),
    loadImports(userId),
    client.from("agent_workspaces").select("profile,settings").eq("user_id", userId).maybeSingle(),
  ]);
  if (result.error) throw new Error(`Could not load your workspace settings: ${result.error.message}`);
  const workspace: Workspace = {
    policies,
    imports,
    profile: mergeProfile(result.data?.profile),
    settings: mergeSettings(result.data?.settings),
  };
  snapshots.set(userId, cloneWorkspace(workspace));
  return workspace;
}

function changedRows<T extends { id: string }>(previous: T[], next: T[]) {
  const oldById = new Map(previous.map((item) => [item.id, item]));
  const nextById = new Map(next.map((item) => [item.id, item]));
  return {
    upsert: next.filter((item) => JSON.stringify(oldById.get(item.id)) !== JSON.stringify(item)),
    remove: previous.filter((item) => !nextById.has(item.id)).map((item) => item.id),
  };
}

async function saveChanges(userId: string, workspace: Workspace): Promise<void> {
  const client = getSupabaseClient();
  const next = cloneWorkspace(workspace);
  const previous = snapshots.get(userId) ?? { policies: [], imports: [] };
  const policyChanges = changedRows(previous.policies, next.policies);
  const importChanges = changedRows(previous.imports, next.imports);

  for (let from = 0; from < policyChanges.upsert.length; from += BATCH_SIZE) {
    const rows = policyChanges.upsert.slice(from, from + BATCH_SIZE).map((policy) => policyToRow(policy, userId));
    const { error } = await client.from("policy_records").upsert(rows, { onConflict: "user_id,id" });
    if (error) throw new Error(`Could not save policy records: ${error.message}`);
  }
  for (let from = 0; from < importChanges.upsert.length; from += BATCH_SIZE) {
    const rows = importChanges.upsert.slice(from, from + BATCH_SIZE).map((record) => importToRow(record, userId));
    const { error } = await client.from("policy_imports").upsert(rows, { onConflict: "user_id,id" });
    if (error) throw new Error(`Could not save import history: ${error.message}`);
  }
  for (let from = 0; from < policyChanges.remove.length; from += BATCH_SIZE) {
    const ids = policyChanges.remove.slice(from, from + BATCH_SIZE);
    const { error } = await client.from("policy_records").delete().eq("user_id", userId).in("id", ids);
    if (error) throw new Error(`Could not delete policy records: ${error.message}`);
  }
  for (let from = 0; from < importChanges.remove.length; from += BATCH_SIZE) {
    const ids = importChanges.remove.slice(from, from + BATCH_SIZE);
    const { error } = await client.from("policy_imports").delete().eq("user_id", userId).in("id", ids);
    if (error) throw new Error(`Could not delete import history: ${error.message}`);
  }

  const { error } = await client.from("agent_workspaces").upsert({
    user_id: userId,
    profile: next.profile ?? {},
    settings: next.settings ?? {},
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) throw new Error(`Could not save workspace settings: ${error.message}`);
  snapshots.set(userId, next);
}

export function saveWorkspace(userId: string, workspace: Workspace): Promise<void> {
  const current = (pendingSaves.get(userId) ?? Promise.resolve())
    .catch(() => undefined)
    .then(() => saveChanges(userId, workspace));
  pendingSaves.set(userId, current);
  return current.finally(() => {
    if (pendingSaves.get(userId) === current) pendingSaves.delete(userId);
  });
}
