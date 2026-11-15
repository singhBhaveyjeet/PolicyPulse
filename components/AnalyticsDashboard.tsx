"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle, CalendarClock, CheckCircle2, FileText, Gauge, RotateCcw, ShieldCheck, Users, Wallet,
} from "lucide-react";
import type { FollowUp, Policy } from "@/lib/types";
import {
  buildAnalyticsReport, daysLeft, FOLLOW_UP_LABEL, FOLLOW_UP_ORDER, isOpen, isValidISODate, money,
  type AnalyticsFilters, type AnalyticsInsight, type AnalyticsPerformance,
} from "@/lib/analysis";
import { normalizePolicyType } from "@/lib/normalize";
import { AreaChart, DonutChart, topSlices } from "./charts";
import { PanelHead } from "./ui";

type Props = {
  policies: Policy[];
  today: Date;
  insurers: string[];
  policyTypes: string[];
  onSelectPolicyAction: (id: string) => void;
};

const EMPTY_FILTERS: AnalyticsFilters = {
  fromDate: "",
  toDate: "",
  insurer: "all",
  policyType: "all",
  followUp: "all",
  minimumPremium: "",
  maximumPremium: "",
};

const percent = (value: number | null) => value === null ? "—" : `${Math.round(value * 100)}%`;

function InsightCard({ insight }: { insight: AnalyticsInsight }) {
  return (
    <article className={`analytics-insight ${insight.severity}`}>
      <div><small>{insight.category}</small><b>{insight.title}</b><span>{insight.description}</span></div>
      {insight.metric && <strong>{insight.metric}</strong>}
    </article>
  );
}

function PerformanceTable({ rows, onSelectAction }: { rows: AnalyticsPerformance[]; onSelectAction: (name: string) => void }) {
  return (
    <div className="table-scroll">
      <table className="analytics-table">
        <thead><tr><th>Company / category</th><th>Policies</th><th>Total premium</th><th>Average premium</th><th>Due in 30d</th><th>Renewal rate*</th><th /></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <td><b>{row.name}</b></td>
              <td>{row.policyCount.toLocaleString("en-IN")}</td>
              <td>{money(row.premium)}</td>
              <td>{money(row.averagePremium)}</td>
              <td>{row.due30.toLocaleString("en-IN")} <small>{row.premiumAtRisk ? `· ${money(row.premiumAtRisk)}` : ""}</small></td>
              <td>{percent(row.renewalRate)}</td>
              <td><button className="analytics-link" onClick={() => onSelectAction(row.name)}>View records</button></td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={7}><div className="empty">No records match these filters.</div></td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export default function AnalyticsDashboard({ policies, today, insurers, policyTypes, onSelectPolicyAction }: Props) {
  const [filters, setFilters] = useState<AnalyticsFilters>(EMPTY_FILTERS);
  const [trendMetric, setTrendMetric] = useState<"count" | "premium">("count");
  const report = useMemo(() => buildAnalyticsReport(policies, filters, today), [policies, filters, today]);
  const invalidDateRange = Boolean(filters.fromDate && filters.toDate && filters.fromDate > filters.toDate);
  const minimum = filters.minimumPremium.trim() ? Number(filters.minimumPremium) : null;
  const maximum = filters.maximumPremium.trim() ? Number(filters.maximumPremium) : null;
  const invalidPremiumRange = minimum !== null && maximum !== null && minimum > maximum;
  const dateRangeError = invalidDateRange ? "The start date must be on or before the end date." : "";
  const premiumRangeError = invalidPremiumRange ? "The minimum premium cannot exceed the maximum." : "";

  const setFilter = <K extends keyof AnalyticsFilters>(key: K, value: AnalyticsFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };
  const selectRecords = (field: "insurer" | "policyType", value: string) => {
    const policy = report.policies.find((record) => (
      field === "policyType"
        ? (normalizePolicyType(record.policyType) || "Unassigned") === value
        : (record.insurer.trim() || "Unassigned") === value
    ));
    if (policy) onSelectPolicyAction(policy.id);
  };
  const premiumDueWithin = (windowDays: number) => report.policies
    .filter((policy) => {
      if (!isOpen(policy) || !isValidISODate(policy.expiryDate)) return false;
      const days = daysLeft(policy.expiryDate, today);
      return days >= 0 && days <= windowDays;
    })
    .reduce((sum, policy) => sum + (Number.isFinite(policy.premium) && policy.premium > 0 ? policy.premium : 0), 0);
  const kpis = report.kpis;
  const resolvedOutcomes = report.policies.filter((policy) => policy.followUp === "renewed" || policy.followUp === "lost").length;
  const premiumShare = (row: AnalyticsPerformance) => report.kpis.totalPremium ? `${Math.round((row.premium / report.kpis.totalPremium) * 100)}% of premium` : "No premium recorded";

  return (
    <>
      <section className="panel analytics-filter-panel">
        <PanelHead title="Analytics intelligence" subtitle="Filter every metric and insight by policy expiry date, insurer, category, follow-up status, and premium." tag="LIVE DATA" />
        <div className="analytics-filters">
          <label>Expiry from<input type="date" value={filters.fromDate} onChange={(event) => setFilter("fromDate", event.target.value)} /></label>
          <label>Expiry to<input type="date" value={filters.toDate} onChange={(event) => setFilter("toDate", event.target.value)} /></label>
          <label>Insurance company<select value={filters.insurer} onChange={(event) => setFilter("insurer", event.target.value)}><option value="all">All companies</option>{insurers.map((insurer) => <option key={insurer}>{insurer}</option>)}</select></label>
          <label>Insurance type<select value={filters.policyType} onChange={(event) => setFilter("policyType", event.target.value)}><option value="all">All types</option>{policyTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
          <label>Follow-up status<select value={filters.followUp} onChange={(event) => setFilter("followUp", event.target.value as FollowUp | "all")}><option value="all">All statuses</option>{FOLLOW_UP_ORDER.map((status) => <option key={status} value={status}>{FOLLOW_UP_LABEL[status]}</option>)}</select></label>
          <label>Minimum premium<input type="number" min="0" value={filters.minimumPremium} onChange={(event) => setFilter("minimumPremium", event.target.value)} placeholder="No minimum" /></label>
          <label>Maximum premium<input type="number" min="0" value={filters.maximumPremium} onChange={(event) => setFilter("maximumPremium", event.target.value)} placeholder="No maximum" /></label>
          <button className="btn secondary analytics-reset" onClick={() => setFilters(EMPTY_FILTERS)}><RotateCcw size={13} /> Reset filters</button>
        </div>
        {(dateRangeError || premiumRangeError) && <div className="analytics-filter-error" role="alert">{dateRangeError || premiumRangeError}</div>}
      </section>

      <div className="analytics-history-note">
        <AlertTriangle size={14} />
        <span>Renewal rates use currently recorded Renewed/Lost statuses. Historical status snapshots are not stored, so month-over-month conversion comparisons are intentionally omitted.</span>
      </div>

      <section className="analytics-kpis">
        {[
          { title: "Total policies", value: kpis.totalPolicies.toLocaleString("en-IN"), note: "In selected expiry range", icon: <FileText size={17} /> },
          { title: "Active policies", value: kpis.activePolicies.toLocaleString("en-IN"), note: "Open and not yet expired", icon: <ShieldCheck size={17} /> },
          { title: "Expiring this month", value: kpis.expiringThisMonth.toLocaleString("en-IN"), note: "Still marked open", icon: <CalendarClock size={17} /> },
          { title: "Premium portfolio", value: money(kpis.totalPremium), note: "Filtered policy records", icon: <Wallet size={17} /> },
          { title: "Average premium", value: money(kpis.averagePremium), note: "Per filtered policy", icon: <Gauge size={17} /> },
          { title: "Unique customers", value: kpis.uniqueCustomers.toLocaleString("en-IN"), note: "Grouped by phone, email, or name", icon: <Users size={17} /> },
          { title: "Renewal rate", value: percent(kpis.renewalRate), note: `${resolvedOutcomes.toLocaleString("en-IN")} resolved outcomes`, icon: <CheckCircle2 size={17} /> },
          { title: "Upcoming renewal value", value: money(kpis.upcomingRenewalValue), note: `Next 30 days · ${kpis.due30} open policies`, icon: <CalendarClock size={17} /> },
        ].map((item) => (
          <article className="analytics-kpi" key={item.title}>
            <div className="analytics-kpi-top"><span>{item.title}</span><i>{item.icon}</i></div>
            <b className={item.value.startsWith("₹") ? "currency" : ""}>{item.value}</b>
            <small>{item.note}</small>
          </article>
        ))}
      </section>

      <section className="two-col analytics-panels">
        <div className="panel">
          <PanelHead title="Renewal trend" subtitle="Policies and premium by expiry month, not historical renewal events." action={
            <div className="seg"><button className={trendMetric === "count" ? "on" : ""} onClick={() => setTrendMetric("count")}>Policies</button><button className={trendMetric === "premium" ? "on" : ""} onClick={() => setTrendMetric("premium")}>Premium</button></div>
          } />
          {report.timelineLimited && <p className="analytics-hint">Showing the most recent 36 months of the selected date range.</p>}
          <div className="chart-pad"><AreaChart buckets={report.timeline} metric={trendMetric} /></div>
        </div>
        <div className="panel">
          <PanelHead title="Renewal funnel" subtitle="Current follow-up snapshot for the filtered expiry cohort." />
          <div className="analytics-funnel">
            {report.funnel.map((step) => (
              <div className="analytics-funnel-step" key={step.key}>
                <div><b>{step.label}</b><span>{step.count.toLocaleString("en-IN")}</span></div>
                <div className="analytics-funnel-track"><i style={{ width: `${kpis.totalPolicies ? (step.count / kpis.totalPolicies) * 100 : 0}%` }} /></div>
                {step.conversion !== null && <small>{percent(step.conversion)} from previous stage</small>}
              </div>
            ))}
            {!kpis.totalPolicies && <div className="empty">No policies match the selected filters.</div>}
          </div>
        </div>
      </section>

      <section className="panel analytics-upcoming">
        <PanelHead title="Upcoming renewal analysis" subtitle="Open policies only; premium at risk is the sum due within each window." />
        <div className="analytics-upcoming-grid">
          {[
            { label: "Next 7 days", count: kpis.due7, days: 7 },
            { label: "Next 15 days", count: kpis.due15, days: 15 },
            { label: "Next 30 days", count: kpis.due30, days: 30 },
          ].map((window) => <div key={window.label}><small>{window.label}</small><b>{window.count.toLocaleString("en-IN")}</b><span>{money(premiumDueWithin(window.days))} premium</span></div>)}
          <div className="risk-total"><small>Total premium at risk</small><b>{money(kpis.upcomingRenewalValue)}</b><span>Within the next 30 days</span></div>
        </div>
      </section>

      <section className="panel analytics-performance">
        <PanelHead title="Insurance company performance" subtitle="Compare insurer contribution, renewal exposure, and recorded outcomes." />
        <div className="analytics-performance-chart"><div className="chart-pad"><div className="analytics-share-list">
          {report.insurers.slice(0, 6).map((insurer) => (
            <div key={insurer.name}><div><b>{insurer.name}</b><span>{premiumShare(insurer)}</span></div><i><em style={{ width: `${report.kpis.totalPremium ? (insurer.premium / report.kpis.totalPremium) * 100 : 0}%` }} /></i></div>
          ))}
          {!report.insurers.length && <div className="empty">No insurer data matches these filters.</div>}
        </div></div></div>
        <PerformanceTable rows={report.insurers} onSelectAction={(name) => selectRecords("insurer", name)} />
        <p className="analytics-footnote">* Renewal rate is Renewed ÷ (Renewed + Lost); it is unavailable until at least one outcome is recorded.</p>
      </section>

      <section className="two-col analytics-panels">
        <div className="panel">
          <PanelHead title="Insurance category mix" subtitle="Premium contribution by normalized policy category." />
          <div className="chart-pad"><DonutChart
            slices={topSlices(report.categories.map((category) => ({ label: category.name, value: category.premium })))}
            centerValue={String(report.categories.length)}
            centerLabel={report.categories.length === 1 ? "category" : "categories"}
            formatAction={money}
          /></div>
        </div>
        <div className="panel">
          <PanelHead title="Category performance" subtitle="Upcoming renewals and recorded renewal outcomes by category." />
          <PerformanceTable rows={report.categories} onSelectAction={(name) => selectRecords("policyType", name)} />
          <p className="analytics-footnote">Category names are normalized for comparison; renewal rate uses only policies marked Renewed or Lost.</p>
        </div>
      </section>

      <section className="panel analytics-insights-panel">
        <PanelHead title="Business insights" subtitle="Rule-based observations based on the filtered portfolio. No external AI or unsupported trend claims." />
        {report.insights.length ? <div className="analytics-insights">{report.insights.map((insight) => <InsightCard key={insight.id} insight={insight} />)}</div> : (
          <div className="empty"><CheckCircle2 size={19} /><b>No actionable insights in this filtered portfolio.</b><span>Add or adjust records and filters to reveal renewal, concentration, or data-quality opportunities.</span></div>
        )}
      </section>

      <section className="panel analytics-quality">
        <PanelHead title="Data Quality Center" subtitle="Find incomplete, inconsistent, invalid, and duplicate records and open an affected policy to fix it." tag={`${report.quality.recordsWithIssues} records need review`} />
        <div className="analytics-quality-kpis">
          {[
            ["Total records", report.quality.totalRecords],
            ["Valid records", report.quality.validRecords],
            ["Records with issues", report.quality.recordsWithIssues],
            ["Duplicate records", report.quality.duplicateRecords],
            ["Missing values", report.quality.missingValues],
            ["Invalid dates", report.quality.invalidDates],
          ].map(([label, count]) => <div key={label as string}><b>{Number(count).toLocaleString("en-IN")}</b><span>{label}</span></div>)}
        </div>
        {report.quality.issues.length ? (
          <>
            <div className="analytics-quality-issues">
              {report.quality.issues.map((issue) => (
                <button key={issue.code} onClick={() => issue.policyIds[0] && onSelectPolicyAction(issue.policyIds[0])} disabled={!issue.policyIds.length}>
                  <span>{issue.label}</span><b>{issue.count.toLocaleString("en-IN")}</b><small>Open an affected record</small>
                </button>
              ))}
            </div>
            <div className="analytics-quality-records">
              {report.quality.affectedRecords.slice(0, 5).map((record) => (
                <button key={record.policy.id} onClick={() => onSelectPolicyAction(record.policy.id)}>
                  <span><b>{record.policy.customerName || "Unnamed customer"}</b><small>Policy {record.policy.policyNumber || "number missing"}</small></span>
                  <em>{record.issues.join(" · ")}</em>
                </button>
              ))}
            </div>
          </>
        ) : <div className="empty"><CheckCircle2 size={19} /><b>No data-quality issues found in this filtered set.</b></div>}
      </section>
    </>
  );
}
