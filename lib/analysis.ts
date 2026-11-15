// All analysis is computed live from the agent's own records.
import type { FollowUp, Policy } from "./types";
import { cleanPhone, makePolicyKey, normalizePolicyType, textKey } from "./normalize";
import { renderTemplate } from "./settings";

export type Status = "Expired" | "Expires Today" | "Critical" | "Urgent" | "Attention" | "Upcoming";
export const STATUS_ORDER: Status[] = ["Expired", "Expires Today", "Critical", "Urgent", "Attention", "Upcoming"];

export const FOLLOW_UP_LABEL: Record<FollowUp, string> = {
  pending: "To contact", contacted: "Contacted", interested: "Interested / follow-up",
  renewed: "Renewed", lost: "Lost / not renewing",
};
export const FOLLOW_UP_ORDER: FollowUp[] = ["pending", "contacted", "interested", "renewed", "lost"];

export function daysLeft(iso: string, today: Date = new Date()): number {
  const a = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round((new Date(y, m - 1, d).getTime() - a) / 86400000);
}

export function statusOf(p: Policy, today?: Date): Status {
  const d = daysLeft(p.expiryDate, today);
  return d < 0 ? "Expired" : d === 0 ? "Expires Today" : d <= 5 ? "Critical" : d <= 14 ? "Urgent" : d <= 30 ? "Attention" : "Upcoming";
}

/** A policy is "open" until the agent marks it renewed or lost. */
export const isOpen = (p: Policy) => p.followUp !== "renewed" && p.followUp !== "lost";

const PRIORITY_URGENCY_POINTS = { expired: 500, critical: 400, urgent: 300, attention: 200, upcoming: 100 } as const;
const MAX_PREMIUM_PRIORITY_POINTS = 99;

function priorityUrgencyPoints(days: number): number {
  if (days < 0) return PRIORITY_URGENCY_POINTS.expired;
  if (days <= 5) return PRIORITY_URGENCY_POINTS.critical;
  if (days <= 14) return PRIORITY_URGENCY_POINTS.urgent;
  if (days <= 30) return PRIORITY_URGENCY_POINTS.attention;
  return PRIORITY_URGENCY_POINTS.upcoming;
}

/** Ranks open renewals by urgency, premium, then the least-contacted workflow state. */
export function rankPriorityRenewals(policies: Policy[], today: Date = new Date()): Policy[] {
  const open = policies.filter(isOpen);
  const maxPremium = open.reduce((max, policy) => (
    Number.isFinite(policy.premium) ? Math.max(max, policy.premium, 0) : max
  ), 0);

  const followUpRank: Record<FollowUp, number> = { pending: 2, interested: 1, contacted: 0, renewed: -1, lost: -1 };
  return open
    .map((policy) => {
      const days = daysLeft(policy.expiryDate, today);
      const premium = Number.isFinite(policy.premium) ? Math.max(0, policy.premium) : 0;
      const premiumPoints = maxPremium ? Math.round((premium / maxPremium) * MAX_PREMIUM_PRIORITY_POINTS) : 0;
      return {
        policy,
        days,
        score: priorityUrgencyPoints(days) + premiumPoints,
        followUpRank: followUpRank[policy.followUp],
      };
    })
    .sort((a, b) => b.score - a.score || b.followUpRank - a.followUpRank || a.days - b.days || a.policy.id.localeCompare(b.policy.id))
    .map(({ policy }) => policy);
}

export const customerKey = (p: Policy): string => {
  const k = cleanPhone(p.phone).key;
  if (k) return `ph:${k.slice(-10)}`;
  const email = textKey(p.email);
  if (email) return `em:${email}`;
  const name = textKey(p.customerName);
  return name ? `nm:${name}` : `id:${p.id}`;
};

export type Customer = { key: string; name: string; phone: string; email: string; policies: Policy[]; premium: number; nextExpiry: string };

export function groupCustomers(policies: Policy[]): Customer[] {
  const map = new Map<string, Customer>();
  for (const p of policies) {
    const k = customerKey(p);
    let c = map.get(k);
    if (!c) { c = { key: k, name: p.customerName, phone: p.phone, email: p.email, policies: [], premium: 0, nextExpiry: "" }; map.set(k, c); }
    c.policies.push(p);
    c.premium += p.premium;
    if (!c.phone && p.phone) c.phone = p.phone;
    if (!c.email && p.email) c.email = p.email;
  }
  const today = new Date();
  for (const c of map.values()) {
    const upcoming = c.policies.filter((p) => isOpen(p) && daysLeft(p.expiryDate, today) >= 0).map((p) => p.expiryDate).sort();
    c.nextExpiry = upcoming[0] ?? "";
  }
  return [...map.values()];
}

export type Breakdown = { name: string; count: number; premium: number; due30: number; expired: number };

function breakdownBy(policies: Policy[], pick: (p: Policy) => string, today: Date): Breakdown[] {
  const map = new Map<string, Breakdown>();
  for (const p of policies) {
    const name = pick(p) || "Unassigned";
    const b = map.get(name) ?? { name, count: 0, premium: 0, due30: 0, expired: 0 };
    const d = daysLeft(p.expiryDate, today);
    b.count++;
    b.premium += p.premium;
    if (isOpen(p) && d >= 0 && d <= 30) b.due30++;
    if (isOpen(p) && d < 0) b.expired++;
    map.set(name, b);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.premium - a.premium);
}

export type MonthBucket = { key: string; label: string; full: string; count: number; premium: number };

export function expiryTimeline(policies: Policy[], today: Date, months: number): MonthBucket[] {
  const out: MonthBucket[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: `${d.toLocaleDateString("en-IN", { month: "short" })} ’${String(d.getFullYear()).slice(2)}`,
      full: d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
      count: 0, premium: 0,
    });
  }
  const idx = new Map(out.map((b, i) => [b.key, i]));
  for (const p of policies) {
    if (!isOpen(p)) continue;
    const i = idx.get(p.expiryDate.slice(0, 7));
    if (i === undefined || daysLeft(p.expiryDate, today) < 0) continue;
    out[i].count++;
    out[i].premium += p.premium;
  }
  return out;
}

export type DataQuality = {
  noPhone: number; invalidPhone: number; noEmail: number; noInsurer: number; noPremium: number; noContact: number;
};

export type Stats = {
  total: number;
  customers: number;
  multiPolicyCustomers: number;
  openTotal: number;
  due7: Policy[];
  due30: Policy[];
  expiredOpen: Policy[];
  premiumTotal: number;
  premiumAtRisk: number;
  premiumLapsed: number;
  renewed: number;
  lost: number;
  byInsurer: Breakdown[];
  byType: Breakdown[];
  byStatus: Record<Status, number>;
  timeline: MonthBucket[];
  quality: DataQuality;
};

export function computeStats(policies: Policy[], today: Date = new Date()): Stats {
  const open = policies.filter(isOpen);
  const dl = (p: Policy) => daysLeft(p.expiryDate, today);
  const due7 = open.filter((p) => dl(p) >= 0 && dl(p) <= 7);
  const due30 = open.filter((p) => dl(p) >= 0 && dl(p) <= 30);
  const expiredOpen = open.filter((p) => dl(p) < 0);
  const customers = groupCustomers(policies);
  const byStatus = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<Status, number>;
  for (const p of open) byStatus[statusOf(p, today)]++;

  const quality: DataQuality = { noPhone: 0, invalidPhone: 0, noEmail: 0, noInsurer: 0, noPremium: 0, noContact: 0 };
  for (const p of policies) {
    const ph = cleanPhone(p.phone);
    if (!p.phone) quality.noPhone++; else if (!ph.valid) quality.invalidPhone++;
    if (!p.email) quality.noEmail++;
    if (!p.phone && !p.email) quality.noContact++;
    if (p.insurer === "Unassigned") quality.noInsurer++;
    if (!p.premium) quality.noPremium++;
  }

  return {
    total: policies.length,
    customers: customers.length,
    multiPolicyCustomers: customers.filter((c) => c.policies.length > 1).length,
    openTotal: open.length,
    due7, due30, expiredOpen,
    premiumTotal: policies.reduce((s, p) => s + p.premium, 0),
    premiumAtRisk: due30.reduce((s, p) => s + p.premium, 0),
    premiumLapsed: expiredOpen.reduce((s, p) => s + p.premium, 0),
    renewed: policies.filter((p) => p.followUp === "renewed").length,
    lost: policies.filter((p) => p.followUp === "lost").length,
    byInsurer: breakdownBy(policies, (p) => p.insurer, today),
    byType: breakdownBy(policies, (p) => p.policyType, today),
    byStatus,
    timeline: expiryTimeline(policies, today, 12),
    quality,
  };
}

export type Insight = { tone: "critical" | "warn" | "info" | "good"; text: string };

const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
const plural = (n: number, one: string, many = one + "s") => `${n.toLocaleString("en-IN")} ${n === 1 ? one : many}`;
const verb = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function buildInsights(policies: Policy[], s: Stats): Insight[] {
  const out: Insight[] = [];
  if (!policies.length) return out;

  if (s.expiredOpen.length)
    out.push({ tone: "critical", text: `${plural(s.expiredOpen.length, "policy", "policies")} ${verb(s.expiredOpen.length, "has", "have")} already expired and not been marked renewed or lost${s.premiumLapsed ? ` — ${inr(s.premiumLapsed)} of premium may lapse` : ""}. Follow up first.` });
  if (s.due7.length)
    out.push({ tone: "critical", text: `${plural(s.due7.length, "policy", "policies")} ${verb(s.due7.length, "expires", "expire")} within 7 days${s.due7.reduce((a, p) => a + p.premium, 0) ? ` (${inr(s.due7.reduce((a, p) => a + p.premium, 0))})` : ""}.` });
  else if (s.due30.length)
    out.push({ tone: "warn", text: `${plural(s.due30.length, "policy", "policies")} ${verb(s.due30.length, "expires", "expire")} in the next 30 days, worth ${inr(s.premiumAtRisk)}.` });

  const peak = [...s.timeline].sort((a, b) => b.count - a.count)[0];
  if (peak && peak.count > 0 && s.timeline.filter((b) => b.count > 0).length > 1)
    out.push({ tone: "info", text: `${peak.full} is your busiest renewal month: ${plural(peak.count, "policy", "policies")}${peak.premium ? `, ${inr(peak.premium)}` : ""}.` });

  const top = s.byInsurer[0];
  if (top && s.byInsurer.length > 1) {
    const share = Math.round((top.count / s.total) * 100);
    if (share >= 40) out.push({ tone: "info", text: `${share}% of your policies are with ${top.name}. A change there would affect much of your book.` });
  }
  if (s.multiPolicyCustomers)
    out.push({ tone: "good", text: `${plural(s.multiPolicyCustomers, "customer")} ${verb(s.multiPolicyCustomers, "holds", "hold")} more than one policy with you — good cross-sell and bundling candidates.` });
  if (s.quality.noContact)
    out.push({ tone: "warn", text: `${plural(s.quality.noContact, "policy", "policies")} ${verb(s.quality.noContact, "has", "have")} no phone or email, so ${verb(s.quality.noContact, "it", "they")} cannot be contacted for renewal.` });
  else if (s.quality.invalidPhone)
    out.push({ tone: "warn", text: `${plural(s.quality.invalidPhone, "policy", "policies")} ${verb(s.quality.invalidPhone, "has", "have")} a phone number that does not look like a valid mobile number.` });
  if (s.renewed + s.lost > 0)
    out.push({ tone: "good", text: `You have closed ${s.renewed + s.lost} renewals so far: ${s.renewed} renewed, ${s.lost} lost.` });
  return out;
}

// ---------- Filterable analytics ----------
export type AnalyticsFilters = {
  fromDate: string;
  toDate: string;
  insurer: string;
  policyType: string;
  followUp: FollowUp | "all";
  minimumPremium: string;
  maximumPremium: string;
};

export type AnalyticsKpis = {
  totalPolicies: number;
  activePolicies: number;
  expiringThisMonth: number;
  totalPremium: number;
  averagePremium: number;
  uniqueCustomers: number;
  renewalRate: number | null;
  upcomingRenewalValue: number;
  due7: number;
  due15: number;
  due30: number;
};

export type AnalyticsPerformance = {
  name: string;
  policyCount: number;
  premium: number;
  averagePremium: number;
  due30: number;
  premiumAtRisk: number;
  renewed: number;
  lost: number;
  renewalRate: number | null;
};

export type AnalyticsFunnelStep = {
  key: "due" | "contacted" | "interested" | "renewed";
  label: string;
  count: number;
  conversion: number | null;
};

export type AnalyticsInsight = {
  id: string;
  title: string;
  category: "renewal" | "portfolio" | "opportunity" | "data quality";
  severity: "critical" | "warning" | "info" | "positive";
  description: string;
  metric?: string;
};

export type DataQualityIssue = {
  code: string;
  label: string;
  count: number;
  policyIds: string[];
};

export type DataQualityRecord = {
  policy: Policy;
  issues: string[];
};

export type DataQualityReport = {
  totalRecords: number;
  validRecords: number;
  recordsWithIssues: number;
  duplicateRecords: number;
  missingValues: number;
  invalidDates: number;
  issues: DataQualityIssue[];
  affectedRecords: DataQualityRecord[];
};

export type AnalyticsReport = {
  policies: Policy[];
  kpis: AnalyticsKpis;
  funnel: AnalyticsFunnelStep[];
  insurers: AnalyticsPerformance[];
  categories: AnalyticsPerformance[];
  timeline: MonthBucket[];
  timelineLimited: boolean;
  quality: DataQualityReport;
  insights: AnalyticsInsight[];
};

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function filterAnalyticsPolicies(policies: Policy[], filters: AnalyticsFilters): Policy[] {
  if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) return [];
  const minimum = filters.minimumPremium.trim() ? Number(filters.minimumPremium) : null;
  const maximum = filters.maximumPremium.trim() ? Number(filters.maximumPremium) : null;
  if ((minimum !== null && !Number.isFinite(minimum)) || (maximum !== null && !Number.isFinite(maximum))) return [];

  return policies.filter((policy) => {
    if (filters.fromDate && (!isValidISODate(policy.expiryDate) || policy.expiryDate < filters.fromDate)) return false;
    if (filters.toDate && (!isValidISODate(policy.expiryDate) || policy.expiryDate > filters.toDate)) return false;
    if (filters.insurer !== "all" && policy.insurer !== filters.insurer) return false;
    if (filters.policyType !== "all" && policy.policyType !== filters.policyType) return false;
    if (filters.followUp !== "all" && policy.followUp !== filters.followUp) return false;
    const premium = Number.isFinite(policy.premium) && policy.premium >= 0 ? policy.premium : 0;
    if (minimum !== null && premium < minimum) return false;
    if (maximum !== null && premium > maximum) return false;
    return true;
  });
}

function safePremium(policy: Policy): number {
  return Number.isFinite(policy.premium) && policy.premium > 0 ? policy.premium : 0;
}

function renewalRate(renewed: number, lost: number): number | null {
  const resolved = renewed + lost;
  return resolved ? renewed / resolved : null;
}

function performanceBy(policies: Policy[], selectName: (policy: Policy) => string, today: Date): AnalyticsPerformance[] {
  const groups = new Map<string, AnalyticsPerformance>();
  for (const policy of policies) {
    const name = selectName(policy).trim() || "Unassigned";
    const item = groups.get(name) ?? {
      name, policyCount: 0, premium: 0, averagePremium: 0, due30: 0, premiumAtRisk: 0, renewed: 0, lost: 0, renewalRate: null,
    };
    const premium = safePremium(policy);
    const days = isValidISODate(policy.expiryDate) ? daysLeft(policy.expiryDate, today) : Number.NaN;
    item.policyCount++;
    item.premium += premium;
    if (isOpen(policy) && days >= 0 && days <= 30) {
      item.due30++;
      item.premiumAtRisk += premium;
    }
    if (policy.followUp === "renewed") item.renewed++;
    if (policy.followUp === "lost") item.lost++;
    groups.set(name, item);
  }
  return [...groups.values()]
    .map((item) => ({
      ...item,
      averagePremium: item.policyCount ? item.premium / item.policyCount : 0,
      renewalRate: renewalRate(item.renewed, item.lost),
    }))
    .sort((a, b) => b.premium - a.premium || b.policyCount - a.policyCount || a.name.localeCompare(b.name));
}

function renewalDemandTimeline(
  policies: Policy[],
  filters: AnalyticsFilters,
  today: Date,
): { buckets: MonthBucket[]; limited: boolean } {
  const monthIndex = (year: number, month: number) => year * 12 + month - 1;
  const parts = (iso: string) => iso.split("-").map(Number);
  let start: number;
  let end: number;
  if (filters.fromDate && filters.toDate) {
    const [fromYear, fromMonth] = parts(filters.fromDate);
    const [toYear, toMonth] = parts(filters.toDate);
    start = monthIndex(fromYear, fromMonth);
    end = monthIndex(toYear, toMonth);
  } else if (filters.fromDate) {
    const [year, month] = parts(filters.fromDate);
    start = monthIndex(year, month);
    end = start + 11;
  } else if (filters.toDate) {
    const [year, month] = parts(filters.toDate);
    end = monthIndex(year, month);
    start = end - 11;
  } else {
    start = monthIndex(today.getFullYear(), today.getMonth() + 1) - 5;
    end = start + 11;
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return { buckets: [], limited: false };
  const limited = end - start + 1 > 36;
  if (limited) start = end - 35;
  const buckets: MonthBucket[] = [];
  const index = new Map<number, number>();
  for (let value = start; value <= end; value++) {
    const date = new Date(Math.floor(value / 12), value % 12, 1);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    index.set(value, buckets.length);
    buckets.push({
      key: `${year}-${String(month).padStart(2, "0")}`,
      label: `${date.toLocaleDateString("en-IN", { month: "short" })} ’${String(year).slice(2)}`,
      full: date.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
      count: 0,
      premium: 0,
    });
  }
  for (const policy of policies) {
    if (!isValidISODate(policy.expiryDate)) continue;
    const [year, month] = parts(policy.expiryDate);
    const bucket = index.get(monthIndex(year, month));
    if (bucket === undefined) continue;
    buckets[bucket].count++;
    buckets[bucket].premium += safePremium(policy);
  }
  return { buckets, limited };
}

const QUALITY_LABELS: Record<string, string> = {
  duplicate: "Duplicate policy number",
  customer: "Missing customer name",
  policyNumber: "Missing policy number",
  phone: "Missing phone number",
  invalidPhone: "Invalid phone number",
  email: "Missing or invalid email",
  contact: "No phone or email",
  insurer: "Missing insurer",
  policyType: "Missing policy category",
  inconsistentType: "Inconsistent policy category",
  premium: "Missing or zero premium",
  expiryDate: "Missing or invalid expiry date",
  startDate: "Missing start date",
  invalidStartDate: "Invalid start date",
};

export function analyzeDataQuality(policies: Policy[]): DataQualityReport {
  const issuePolicyIds = new Map<string, Set<string>>();
  const recordIssues = new Map<string, Set<string>>();
  const policyById = new Map(policies.map((policy) => [policy.id, policy]));
  const duplicateCandidates = new Map<string, Policy[]>();
  let missingValues = 0;

  const addIssue = (policy: Policy, code: string) => {
    if (!issuePolicyIds.has(code)) issuePolicyIds.set(code, new Set());
    issuePolicyIds.get(code)?.add(policy.id);
    if (!recordIssues.has(policy.id)) recordIssues.set(policy.id, new Set());
    recordIssues.get(policy.id)?.add(code);
  };

  for (const policy of policies) {
    if (!policy.customerName.trim()) { addIssue(policy, "customer"); missingValues++; }
    if (!policy.policyNumber.trim()) { addIssue(policy, "policyNumber"); missingValues++; }
    if (!policy.phone.trim()) { addIssue(policy, "phone"); missingValues++; }
    else if (!cleanPhone(policy.phone).valid) addIssue(policy, "invalidPhone");
    if (!policy.email.trim()) { addIssue(policy, "email"); missingValues++; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(policy.email.trim())) addIssue(policy, "email");
    if (!policy.phone.trim() && !policy.email.trim()) addIssue(policy, "contact");
    if (!policy.insurer.trim() || policy.insurer.trim().toLowerCase() === "unassigned") { addIssue(policy, "insurer"); missingValues++; }
    if (!policy.policyType.trim()) { addIssue(policy, "policyType"); missingValues++; }
    else if (textKey(normalizePolicyType(policy.policyType)) !== textKey(policy.policyType)) addIssue(policy, "inconsistentType");
    if (!Number.isFinite(policy.premium) || policy.premium <= 0) { addIssue(policy, "premium"); missingValues++; }
    if (!policy.expiryDate) { addIssue(policy, "expiryDate"); missingValues++; }
    else if (!isValidISODate(policy.expiryDate)) addIssue(policy, "expiryDate");
    if (!policy.startDate) { addIssue(policy, "startDate"); missingValues++; }
    else if (!isValidISODate(policy.startDate)) addIssue(policy, "invalidStartDate");
    if (policy.policyNumber.trim()) {
      const key = makePolicyKey(policy.insurer, policy.policyNumber);
      if (!key.endsWith("|")) duplicateCandidates.set(key, [...(duplicateCandidates.get(key) ?? []), policy]);
    }
  }

  const duplicateIds = new Set<string>();
  for (const records of duplicateCandidates.values()) {
    if (records.length < 2) continue;
    for (const policy of records.slice(1)) {
      duplicateIds.add(policy.id);
      addIssue(policy, "duplicate");
    }
  }

  const invalidDateIds = new Set([
    ...(issuePolicyIds.get("expiryDate") ?? []),
    ...(issuePolicyIds.get("startDate") ?? []),
    ...(issuePolicyIds.get("invalidStartDate") ?? []),
  ]);
  const issues = [...issuePolicyIds.entries()].map(([code, ids]) => ({
    code,
    label: QUALITY_LABELS[code] ?? code,
    count: ids.size,
    policyIds: [...ids],
  })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const affectedRecords: DataQualityRecord[] = [];
  for (const [id, codes] of recordIssues) {
    const policy = policyById.get(id);
    if (policy) affectedRecords.push({ policy, issues: [...codes].map((code) => QUALITY_LABELS[code] ?? code) });
  }

  return {
    totalRecords: policies.length,
    validRecords: policies.length - affectedRecords.length,
    recordsWithIssues: affectedRecords.length,
    duplicateRecords: duplicateIds.size,
    missingValues,
    invalidDates: invalidDateIds.size,
    issues,
    affectedRecords,
  };
}

function funnelFor(policies: Policy[]): AnalyticsFunnelStep[] {
  const due = policies.length;
  const contacted = policies.filter((policy) => ["contacted", "interested", "renewed"].includes(policy.followUp)).length;
  const interested = policies.filter((policy) => ["interested", "renewed"].includes(policy.followUp)).length;
  const renewed = policies.filter((policy) => policy.followUp === "renewed").length;
  const stages = [
    { key: "due" as const, label: "Policies due", count: due },
    { key: "contacted" as const, label: "Customers contacted", count: contacted },
    { key: "interested" as const, label: "Interested / follow-up", count: interested },
    { key: "renewed" as const, label: "Renewed", count: renewed },
  ];
  return stages.map((stage, index) => ({
    ...stage,
    conversion: index === 0 ? null : stages[index - 1].count ? stage.count / stages[index - 1].count : null,
  }));
}

function analyticsInsights(
  policies: Policy[],
  kpis: AnalyticsKpis,
  insurers: AnalyticsPerformance[],
  categories: AnalyticsPerformance[],
  quality: DataQualityReport,
  today: Date,
): AnalyticsInsight[] {
  const out: AnalyticsInsight[] = [];
  if (!policies.length) return out;
  const due15 = policies.filter((policy) => isOpen(policy) && isValidISODate(policy.expiryDate) && daysLeft(policy.expiryDate, today) >= 0 && daysLeft(policy.expiryDate, today) <= 15);
  if (due15.length) {
    const premium = due15.reduce((sum, policy) => sum + safePremium(policy), 0);
    out.push({
      id: "renewals-due-15",
      title: "Renewals need attention",
      category: "renewal",
      severity: due15.some((policy) => daysLeft(policy.expiryDate, today) <= 5) ? "critical" : "warning",
      description: `${due15.length} open polic${due15.length === 1 ? "y" : "ies"} expire within 15 days.`,
      metric: money(premium),
    });
  }
  const topInsurer = insurers[0];
  if (topInsurer && insurers.length > 1 && kpis.totalPremium > 0) {
    const share = topInsurer.premium / kpis.totalPremium;
    if (share >= 0.4) {
      out.push({
        id: "insurer-concentration",
        title: "Premium is concentrated",
        category: "portfolio",
        severity: "warning",
        description: `${topInsurer.name} accounts for ${Math.round(share * 100)}% of premium in the filtered portfolio.`,
        metric: money(topInsurer.premium),
      });
    }
  }
  const underperforming = categories.find((category) => (
    category.renewed + category.lost >= 3 &&
    kpis.renewalRate !== null &&
    category.renewalRate !== null &&
    category.renewalRate < kpis.renewalRate - 0.1
  ));
  if (underperforming) {
    out.push({
      id: "category-renewal-opportunity",
      title: "Review category renewal outcomes",
      category: "opportunity",
      severity: "info",
      description: `${underperforming.name} is at least 10 percentage points below the portfolio renewal rate, based on recorded renewed/lost outcomes.`,
      metric: `${Math.round((underperforming.renewalRate ?? 0) * 100)}% renewal rate`,
    });
  }
  if (quality.recordsWithIssues) {
    out.push({
      id: "data-quality",
      title: "Improve record quality",
      category: "data quality",
      severity: "warning",
      description: `${quality.recordsWithIssues} of ${quality.totalRecords} filtered records have at least one data issue.`,
      metric: `${quality.duplicateRecords} duplicate records`,
    });
  }
  return out;
}

export function buildAnalyticsReport(
  policies: Policy[],
  filters: AnalyticsFilters,
  today: Date = new Date(),
): AnalyticsReport {
  const filtered = filterAnalyticsPolicies(policies, filters);
  const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const active = filtered.filter((policy) => isOpen(policy) && isValidISODate(policy.expiryDate) && daysLeft(policy.expiryDate, today) >= 0);
  const due7 = filtered.filter((policy) => isOpen(policy) && isValidISODate(policy.expiryDate) && daysLeft(policy.expiryDate, today) >= 0 && daysLeft(policy.expiryDate, today) <= 7);
  const due15 = filtered.filter((policy) => isOpen(policy) && isValidISODate(policy.expiryDate) && daysLeft(policy.expiryDate, today) >= 0 && daysLeft(policy.expiryDate, today) <= 15);
  const due30 = filtered.filter((policy) => isOpen(policy) && isValidISODate(policy.expiryDate) && daysLeft(policy.expiryDate, today) >= 0 && daysLeft(policy.expiryDate, today) <= 30);
  const renewed = filtered.filter((policy) => policy.followUp === "renewed").length;
  const lost = filtered.filter((policy) => policy.followUp === "lost").length;
  const totalPremium = filtered.reduce((sum, policy) => sum + safePremium(policy), 0);
  const insurers = performanceBy(filtered, (policy) => policy.insurer, today);
  const categories = performanceBy(filtered, (policy) => normalizePolicyType(policy.policyType) || "Unassigned", today);
  const quality = analyzeDataQuality(filtered);
  const timeline = renewalDemandTimeline(filtered, filters, today);
  const kpis: AnalyticsKpis = {
    totalPolicies: filtered.length,
    activePolicies: active.length,
    expiringThisMonth: filtered.filter((policy) => isOpen(policy) && isValidISODate(policy.expiryDate) && daysLeft(policy.expiryDate, today) >= 0 && policy.expiryDate.startsWith(monthKey)).length,
    totalPremium,
    averagePremium: filtered.length ? totalPremium / filtered.length : 0,
    uniqueCustomers: groupCustomers(filtered).length,
    renewalRate: renewalRate(renewed, lost),
    upcomingRenewalValue: due30.reduce((sum, policy) => sum + safePremium(policy), 0),
    due7: due7.length,
    due15: due15.length,
    due30: due30.length,
  };

  return {
    policies: filtered,
    kpis,
    funnel: funnelFor(filtered),
    insurers,
    categories,
    timeline: timeline.buckets,
    timelineLimited: timeline.limited,
    quality,
    insights: analyticsInsights(filtered, kpis, insurers, categories, quality, today),
  };
}

// ---------- Formatting ----------
export const money = (n: number) => inr(n);
export const dateLabel = (s: string) => (s ? new Date(s + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
export const initials = (s: string) => s.split(" ").filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase() || "?";
export const dueText = (iso: string) => { const d = daysLeft(iso); return d < 0 ? `${Math.abs(d)} day${d === -1 ? "" : "s"} overdue` : d === 0 ? "Today" : `${d} day${d === 1 ? "" : "s"} left`; };

export function whatsappLink(p: Policy, template: string, agent: string): string {
  const ph = cleanPhone(p.phone);
  if (!ph.valid) return "";
  return `https://wa.me/91${ph.key}?text=${encodeURIComponent(renderTemplate(template, p, agent, daysLeft(p.expiryDate)))}`;
}

export const compactMoney = (n: number) =>
  n >= 10000000 ? `₹${(n / 10000000).toFixed(1)}Cr` : n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : n >= 1000 ? `₹${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : `₹${Math.round(n)}`;
