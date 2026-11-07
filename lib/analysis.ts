// All analysis is computed live from the agent's own records.
import type { FollowUp, Policy } from "./types";
import { cleanPhone, textKey } from "./normalize";
import { renderTemplate } from "./settings";

export type Status = "Expired" | "Expires Today" | "Critical" | "Urgent" | "Attention" | "Upcoming";
export const STATUS_ORDER: Status[] = ["Expired", "Expires Today", "Critical", "Urgent", "Attention", "Upcoming"];

export const FOLLOW_UP_LABEL: Record<FollowUp, string> = {
  pending: "To contact", contacted: "Contacted", renewed: "Renewed", lost: "Lost / not renewing",
};

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

export const customerKey = (p: Policy): string => {
  const k = cleanPhone(p.phone).key;
  return k ? `ph:${k.slice(-10)}` : p.email ? `em:${p.email}` : `nm:${textKey(p.customerName)}`;
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
