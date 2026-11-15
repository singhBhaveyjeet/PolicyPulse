import type { Policy } from "./types";
import {
  daysLeft,
  groupCustomers,
  isOpen,
  isValidISODate,
  money,
  rankPriorityRenewals,
  type MonthBucket,
} from "./analysis";
import { normalizePolicyType } from "./normalize";

type Distribution = {
  name: string;
  count: number;
  premium: number;
  share: number;
};

type BusinessCustomer = {
  name: string;
  count: number;
  premium: number;
  nextExpiry: string;
  upcomingRenewalCount: number;
};

export type BusinessInsight = {
  id: string;
  text: string;
  tone: "critical" | "warning" | "info" | "positive";
};

export type BusinessAnalyticsReport = {
  totalPolicies: number;
  totalPremium: number;
  renewalRate: number | null;
  renewedCount: number;
  lostCount: number;
  risk: {
    due7Count: number;
    due7Premium: number;
    due30Count: number;
    due30Premium: number;
    expiredCount: number;
    expiredPremium: number;
    totalCount: number;
    totalPremium: number;
  };
  highValueThreshold: number;
  highValueOpportunityCount: number;
  forecast: MonthBucket[];
  insurers: Distribution[];
  policyTypes: Distribution[];
  priorityPolicies: Policy[];
  multiPolicyCustomers: number;
  topCustomers: BusinessCustomer[];
  customersWithRenewals: BusinessCustomer[];
  insights: BusinessInsight[];
};

function safePremium(policy: Policy): number {
  return Number.isFinite(policy.premium) && policy.premium > 0 ? policy.premium : 0;
}

function groupBy(policies: Policy[], selectName: (policy: Policy) => string, totalPremium: number): Distribution[] {
  const groups = new Map<string, { count: number; premium: number }>();
  for (const policy of policies) {
    const name = selectName(policy).trim() || "Unassigned";
    const group = groups.get(name) ?? { count: 0, premium: 0 };
    group.count++;
    group.premium += safePremium(policy);
    groups.set(name, group);
  }
  return [...groups.entries()]
    .map(([name, group]) => ({
      name,
      ...group,
      share: totalPremium ? group.premium / totalPremium : 0,
    }))
    .sort((a, b) => b.premium - a.premium || b.count - a.count || a.name.localeCompare(b.name));
}

function buildForecast(policies: Policy[], today: Date): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  for (let offset = 0; offset < 12; offset++) {
    const date = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    buckets.push({
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: date.toLocaleDateString("en-IN", { month: "short" }),
      full: date.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
      count: 0,
      premium: 0,
    });
  }
  const byMonth = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  for (const policy of policies) {
    if (!isOpen(policy) || !isValidISODate(policy.expiryDate) || daysLeft(policy.expiryDate, today) < 0) continue;
    const bucket = byMonth.get(policy.expiryDate.slice(0, 7));
    if (!bucket) continue;
    bucket.count++;
    bucket.premium += safePremium(policy);
  }
  return buckets;
}

function buildCustomers(policies: Policy[], today: Date) {
  return groupCustomers(policies).map((customer) => {
    const activePolicies = customer.policies.filter(isOpen);
    const upcoming = activePolicies
      .filter((policy) => isValidISODate(policy.expiryDate) && daysLeft(policy.expiryDate, today) >= 0)
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
    return {
      name: customer.name || "Unnamed customer",
      count: customer.policies.length,
      premium: customer.policies.reduce((sum, policy) => sum + safePremium(policy), 0),
      nextExpiry: upcoming[0]?.expiryDate ?? "",
      upcomingRenewalCount: upcoming.length,
    };
  });
}

export function buildBusinessAnalytics(policies: Policy[], today: Date = new Date()): BusinessAnalyticsReport {
  const totalPremium = policies.reduce((sum, policy) => sum + safePremium(policy), 0);
  const renewedCount = policies.filter((policy) => policy.followUp === "renewed").length;
  const lostCount = policies.filter((policy) => policy.followUp === "lost").length;
  const completedCount = renewedCount + lostCount;
  const openPolicies = policies.filter(isOpen);
  const expired = openPolicies.filter((policy) => isValidISODate(policy.expiryDate) && daysLeft(policy.expiryDate, today) < 0);
  const due7 = openPolicies.filter((policy) => isValidISODate(policy.expiryDate) && daysLeft(policy.expiryDate, today) >= 0 && daysLeft(policy.expiryDate, today) <= 7);
  const due30 = openPolicies.filter((policy) => isValidISODate(policy.expiryDate) && daysLeft(policy.expiryDate, today) >= 0 && daysLeft(policy.expiryDate, today) <= 30);
  const riskPolicies = new Set([...expired, ...due30]);
  const riskPremium = [...riskPolicies].reduce((sum, policy) => sum + safePremium(policy), 0);
  const premiums = policies.map(safePremium).filter((premium) => premium > 0).sort((a, b) => a - b);
  const highValueThreshold = premiums.length ? premiums[Math.floor((premiums.length - 1) * 0.75)] : 0;
  const highValueOpportunityCount = highValueThreshold
    ? [...riskPolicies].filter((policy) => safePremium(policy) >= highValueThreshold).length
    : 0;
  const insurers = groupBy(policies, (policy) => policy.insurer, totalPremium);
  const policyTypes = groupBy(policies, (policy) => normalizePolicyType(policy.policyType) || "Unassigned", totalPremium);
  const customers = buildCustomers(policies, today);
  const multiPolicyCustomers = customers.filter((customer) => customer.count > 1).length;
  const topCustomers = [...customers].sort((a, b) => b.premium - a.premium || b.count - a.count).slice(0, 5);
  const customersWithRenewals = customers
    .filter((customer) => customer.upcomingRenewalCount > 0)
    .sort((a, b) => b.premium - a.premium || a.nextExpiry.localeCompare(b.nextExpiry))
    .slice(0, 5);
  const forecast = buildForecast(policies, today);
  const insights: BusinessInsight[] = [];

  if (due7.length) {
    insights.push({
      id: "due-soon",
      tone: "critical",
      text: `${due7.length} open ${due7.length === 1 ? "policy expires" : "policies expire"} within 7 days, representing ${money(due7.reduce((sum, policy) => sum + safePremium(policy), 0))}.`,
    });
  }
  if (expired.length) {
    insights.push({
      id: "expired-open",
      tone: "warning",
      text: `${expired.length} open ${expired.length === 1 ? "policy has" : "policies have"} expired; ${money(expired.reduce((sum, policy) => sum + safePremium(policy), 0))} in premium needs follow-up.`,
    });
  }
  const peakMonth = [...forecast].sort((a, b) => b.premium - a.premium || b.count - a.count)[0];
  if (peakMonth && peakMonth.count > 0) {
    insights.push({
      id: "peak-month",
      tone: "info",
      text: `${peakMonth.full} is your largest upcoming renewal opportunity: ${peakMonth.count} ${peakMonth.count === 1 ? "policy" : "policies"} worth ${money(peakMonth.premium)}.`,
    });
  }
  if (multiPolicyCustomers) {
    insights.push({
      id: "multiple-policies",
      tone: "positive",
      text: `${multiPolicyCustomers} ${multiPolicyCustomers === 1 ? "customer has" : "customers have"} multiple policies with you; review these relationships for coordinated renewals.`,
    });
  }
  const leadingInsurer = insurers[0];
  if (leadingInsurer && leadingInsurer.share >= 0.4) {
    insights.push({
      id: "insurer-concentration",
      tone: "warning",
      text: `${Math.round(leadingInsurer.share * 100)}% of your portfolio premium is with ${leadingInsurer.name}. Consider how a change at this insurer could affect your book.`,
    });
  }
  if (customersWithRenewals.length) {
    const highValueCustomers = customersWithRenewals.filter((customer) => (
      customer.premium >= (topCustomers[0]?.premium ?? 0) * 0.5
    ));
    if (highValueCustomers.length) {
      insights.push({
        id: "valuable-customers",
        tone: "info",
        text: `${highValueCustomers.length} of your highest-premium customer relationships have upcoming open renewals. Prioritize a personal follow-up.`,
      });
    }
  }

  return {
    totalPolicies: policies.length,
    totalPremium,
    renewalRate: completedCount ? renewedCount / completedCount : null,
    renewedCount,
    lostCount,
    risk: {
      due7Count: due7.length,
      due7Premium: due7.reduce((sum, policy) => sum + safePremium(policy), 0),
      due30Count: due30.length,
      due30Premium: due30.reduce((sum, policy) => sum + safePremium(policy), 0),
      expiredCount: expired.length,
      expiredPremium: expired.reduce((sum, policy) => sum + safePremium(policy), 0),
      totalCount: riskPolicies.size,
      totalPremium: riskPremium,
    },
    highValueThreshold,
    highValueOpportunityCount,
    forecast,
    insurers,
    policyTypes,
    priorityPolicies: rankPriorityRenewals(policies, today).slice(0, 10),
    multiPolicyCustomers,
    topCustomers,
    customersWithRenewals,
    insights: insights.slice(0, 5),
  };
}
