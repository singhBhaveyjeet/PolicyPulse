"use client";

import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, ShieldCheck, Wallet } from "lucide-react";
import type { Policy } from "@/lib/types";
import { buildBusinessAnalytics } from "@/lib/businessAnalytics";
import { dateLabel, daysLeft, FOLLOW_UP_LABEL, money } from "@/lib/analysis";
import { ColumnChart, PanelHead } from "./ui";
import { DonutChart, topSlices } from "./charts";

type Props = {
  policies: Policy[];
  today: Date;
  onSelectPolicyAction: (id: string) => void;
  onImportAction: () => void;
};

const percentage = (value: number | null) => value === null ? "—" : `${Math.round(value * 100)}%`;

export default function BusinessAnalyticsDashboard({ policies, today, onSelectPolicyAction, onImportAction }: Props) {
  const report = useMemo(() => buildBusinessAnalytics(policies, today), [policies, today]);

  if (!policies.length) {
    return (
      <section className="panel business-empty">
        <div className="business-empty-icon"><Wallet size={23} /></div>
        <h2>Start with your real portfolio</h2>
        <p>Upload your policy data to understand your portfolio, renewal opportunities, and business risks.</p>
        <button className="btn primary" onClick={onImportAction}>Upload policy data</button>
      </section>
    );
  }

  return (
    <div className="business-analytics">
      <section className="business-health">
        {[
          { title: "Total portfolio premium", value: money(report.totalPremium), note: `${report.totalPolicies.toLocaleString("en-IN")} policy records`, icon: <Wallet size={17} />, tone: "blue" },
          { title: "Total premium at risk", value: money(report.risk.totalPremium), note: "Expired open + open renewals due within 30 days", icon: <AlertTriangle size={17} />, tone: "amber" },
          { title: "Renewal success rate", value: percentage(report.renewalRate), note: report.renewalRate === null ? "No completed renewal outcomes yet" : `${report.renewedCount} renewed · ${report.lostCount} lost`, icon: <CheckCircle2 size={17} />, tone: "green" },
          { title: "High-value opportunities", value: report.highValueOpportunityCount.toLocaleString("en-IN"), note: report.highValueThreshold ? `At-risk policies ≥ ${money(report.highValueThreshold)} (portfolio 75th percentile)` : "No premium values available", icon: <ShieldCheck size={17} />, tone: "purple" },
        ].map((item) => (
          <article className={`business-kpi ${item.tone}`} key={item.title}>
            <div className="business-kpi-top"><span>{item.title}</span><i>{item.icon}</i></div>
            <b>{item.value}</b>
            <small>{item.note}</small>
          </article>
        ))}
      </section>

      <section className="panel business-risk">
        <PanelHead title="Revenue and premium at risk" subtitle="Renewal window: open policies due within 30 days; expired open policies are shown separately and included in total risk." />
        <div className="business-risk-grid">
          <div><small>Expiring within 7 days</small><b>{money(report.risk.due7Premium)}</b><span>{report.risk.due7Count} {report.risk.due7Count === 1 ? "policy" : "policies"}</span></div>
          <div><small>Expiring within 30 days</small><b>{money(report.risk.due30Premium)}</b><span>{report.risk.due30Count} {report.risk.due30Count === 1 ? "policy" : "policies"} · includes next 7 days</span></div>
          <div><small>Expired and still open</small><b>{money(report.risk.expiredPremium)}</b><span>{report.risk.expiredCount} {report.risk.expiredCount === 1 ? "policy" : "policies"}</span></div>
          <div className="business-risk-total"><small>Total premium at risk</small><b>{money(report.risk.totalPremium)}</b><span>{report.risk.totalCount} policies require attention</span></div>
        </div>
      </section>

      <section className="two-col business-panels">
        <div className="panel">
          <PanelHead title="Upcoming renewal opportunities" subtitle="Open policies by expiry month over the next 12 months. Hover a column for policy count and premium." />
          <div className="business-forecast-summary">
            <span>Largest opportunity</span>
            {(() => {
              const peak = [...report.forecast].sort((a, b) => b.premium - a.premium || b.count - a.count)[0];
              return peak?.count ? <b>{peak.full} · {money(peak.premium)}</b> : <b>No upcoming open renewals</b>;
            })()}
          </div>
          <ColumnChart buckets={report.forecast} />
        </div>
        <div className="panel">
          <PanelHead title="What Your Business Needs Attention On" subtitle="Up to five observations supported by your current records." />
          {report.insights.length ? (
            <ul className="business-insights">
              {report.insights.map((insight) => <li className={insight.tone} key={insight.id}><span>{insight.text}</span></li>)}
            </ul>
          ) : (
            <div className="business-no-insights"><CheckCircle2 size={18} /><span>No urgent concentration or renewal signals are present in the current data.</span></div>
          )}
        </div>
      </section>

      <section className="panel business-opportunities">
        <PanelHead title="Top business opportunities" subtitle="Open policies ranked using the existing renewal urgency, premium, and follow-up priority logic." />
        <div className="table-scroll">
          <table className="business-table">
            <thead><tr><th>Customer / policy</th><th>Expiry</th><th>Insurer</th><th>Policy type</th><th>Premium</th><th>Follow-up</th></tr></thead>
            <tbody>
              {report.priorityPolicies.map((policy) => {
                const days = daysLeft(policy.expiryDate, today);
                return (
                  <tr key={policy.id}>
                    <td><button className="business-customer-link" onClick={() => onSelectPolicyAction(policy.id)}><b>{policy.customerName || "Unnamed customer"}</b><small>Policy {policy.policyNumber || "number unavailable"}</small></button></td>
                    <td><b>{dateLabel(policy.expiryDate)}</b><small className={days < 0 ? "business-overdue" : ""}>{days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? "Due today" : `${days} days remaining`}</small></td>
                    <td>{policy.insurer || "Unassigned"}</td><td>{policy.policyType || "Unassigned"}</td>
                    <td><b>{policy.premium > 0 ? money(policy.premium) : "—"}</b></td><td>{FOLLOW_UP_LABEL[policy.followUp]}</td>
                  </tr>
                );
              })}
              {!report.priorityPolicies.length && <tr><td colSpan={6}><div className="empty">No open renewal opportunities. Renewed and lost policies are excluded.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="two-col business-panels">
        <div className="panel">
          <PanelHead title="Portfolio by insurer" subtitle="Premium share and policy count; concentration at or above 40% is called out in the insights." />
          <div className="business-donut"><DonutChart
            slices={topSlices(report.insurers.map((item) => ({ label: item.name, value: item.premium })))}
            centerValue={String(report.insurers.length)}
            centerLabel={report.insurers.length === 1 ? "insurer" : "insurers"}
            formatAction={money}
          /></div>
          <div className="business-distribution">
            {report.insurers.map((item) => <div key={item.name}><b>{item.name}</b><span>{item.count} {item.count === 1 ? "policy" : "policies"}</span><strong>{money(item.premium)}</strong><em>{Math.round(item.share * 100)}%</em></div>)}
          </div>
        </div>
        <div className="panel">
          <PanelHead title="Portfolio by policy type" subtitle="Distribution uses the policy categories present in your records." />
          <div className="business-donut"><DonutChart
            slices={topSlices(report.policyTypes.map((item) => ({ label: item.name, value: item.premium })))}
            centerValue={String(report.policyTypes.length)}
            centerLabel={report.policyTypes.length === 1 ? "type" : "types"}
            formatAction={money}
          /></div>
          <div className="business-distribution">
            {report.policyTypes.map((item) => <div key={item.name}><b>{item.name}</b><span>{item.count} {item.count === 1 ? "policy" : "policies"}</span><strong>{money(item.premium)}</strong><em>{Math.round(item.share * 100)}%</em></div>)}
          </div>
        </div>
      </section>

      <section className="two-col business-panels business-customer-panels">
        <div className="panel">
          <PanelHead title="Highest-value customers" subtitle={`${report.multiPolicyCustomers} customers have multiple policies, grouped using the existing phone/email/name matching rules.`} />
          <CustomerList customers={report.topCustomers} />
        </div>
        <div className="panel">
          <PanelHead title="Valuable customers with upcoming renewals" subtitle="Customers with open policies due today or later, ranked by their total recorded premium." />
          <CustomerList customers={report.customersWithRenewals} />
        </div>
      </section>
    </div>
  );
}

function CustomerList({ customers }: { customers: { name: string; count: number; premium: number; nextExpiry: string; upcomingRenewalCount: number }[] }) {
  if (!customers.length) return <div className="business-no-insights">No customer records match this view.</div>;
  return (
    <div className="business-customer-list">
      {customers.map((customer, index) => (
        <div key={`${customer.name}-${index}`}>
          <span className="business-customer-rank">{index + 1}</span>
          <span className="business-customer-name"><b>{customer.name}</b><small>{customer.count} {customer.count === 1 ? "policy" : "policies"}{customer.upcomingRenewalCount ? ` · ${customer.upcomingRenewalCount} upcoming renewals` : ""}</small></span>
          <span className="business-customer-value"><b>{money(customer.premium)}</b><small>{customer.nextExpiry ? `Next: ${dateLabel(customer.nextExpiry)}` : "No open upcoming renewal"}</small></span>
        </div>
      ))}
    </div>
  );
}
