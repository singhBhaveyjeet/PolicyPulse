"use client";
import type { ReactNode } from "react";
import { Activity, AlertTriangle, ChevronRight, Database, MoreHorizontal, Search } from "lucide-react";
import type { Policy, Theme } from "@/lib/types";
import { THEMES } from "@/lib/settings";
import { FOLLOW_UP_LABEL, compactMoney, dateLabel, dueText, initials, money, statusOf } from "@/lib/analysis";
import type { MonthBucket } from "@/lib/analysis";

export function Avatar({ photo, name, className = "" }: { photo?: string; name: string; className?: string }) {
  return (
    <div className={`${className} ${photo ? "has-photo" : ""}`}>
      {photo ? <img src={photo} alt={name || "Profile photo"} /> : initials(name)}
    </div>
  );
}

export function Stat({ title, value, icon, tone, foot }: { title: string; value: string | number; icon: ReactNode; tone: string; foot: string }) {
  return (
    <div className="stat-card">
      <div className="stat-top"><span>{title}</span><div className={`stat-icon ${tone}`}>{icon}</div></div>
      <div className={`stat-value ${String(value).startsWith("₹") ? "currency" : ""}`}>{value}</div>
      <div className="stat-foot">
        <span>{tone === "amber" ? <AlertTriangle size={12} /> : tone === "green" ? <Activity size={12} /> : <Database size={12} />} {foot}</span>
        <div className={`spark ${tone}`}><i /><i /><i /><i /><i /><i /></div>
      </div>
    </div>
  );
}

export function PanelHead({ title, subtitle, tag, action }: { title: string; subtitle: string; tag?: string; action?: ReactNode }) {
  return (
    <div className="panel-head">
      <div><h2>{title}</h2><p>{subtitle}</p></div>
      {action || (tag ? <span className="soft-tag">{tag}</span> : <MoreHorizontal size={18} className="muted" />)}
    </div>
  );
}

export function Pair({ label, value }: { label: string; value: string }) {
  return <div className="pair"><span>{label}</span><b>{value}</b></div>;
}

export function StatusPill({ policy }: { policy: Policy }) {
  if (policy.followUp === "renewed") return <span className="status status-renewed">Renewed</span>;
  if (policy.followUp === "lost") return <span className="status status-lost">Lost</span>;
  const st = statusOf(policy);
  return <span className={`status status-${st.toLowerCase().replace(/ /g, "-")}`}>{st}</span>;
}

export function PolicyTable({ policies, onSelect }: { policies: Policy[]; onSelect: (p: Policy) => void }) {
  return (
    <div className="table-scroll">
      <table className="policy-table">
        <thead><tr><th>CUSTOMER</th><th>POLICY NUMBER</th><th>INSURER</th><th>TYPE</th><th>EXPIRY DATE</th><th>PREMIUM</th><th>STATUS</th><th /></tr></thead>
        <tbody>
          {policies.map((p, i) => (
            <tr key={p.id} onClick={() => onSelect(p)}>
              <td><div className="table-customer"><div className={`mini-avatar avatar-${i % 5}`}>{initials(p.customerName)}</div><div><b>{p.customerName}</b><span>{p.phone || p.email || "No contact details"}</span></div></div></td>
              <td><code>{p.policyNumber}</code></td>
              <td>{p.insurer}</td>
              <td><span className="type-pill">{p.policyType}</span></td>
              <td><div className="expiry"><b>{dateLabel(p.expiryDate)}</b><span>{dueText(p.expiryDate)}</span></div></td>
              <td><b>{p.premium ? money(p.premium) : "—"}</b></td>
              <td><StatusPill policy={p} />{p.followUp === "contacted" && <small className="sub-note">{FOLLOW_UP_LABEL.contacted}</small>}</td>
              <td><ChevronRight size={15} /></td>
            </tr>
          ))}
          {!policies.length && <tr><td colSpan={8}><div className="empty"><Search size={20} /><b>No matching policies</b><span>Try changing the search or filters.</span></div></td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export type BarItem = { label: string; value: number; display: string; hint?: string };

export function BarList({ items }: { items: BarItem[] }) {
  const max = Math.max(0, ...items.map((i) => i.value));
  if (!items.length) return <div className="empty">Nothing to show yet.</div>;
  return (
    <div className="bar-list">
      {items.map((i) => (
        <div className="bar-row" key={i.label}>
          <div className="bar-top"><b>{i.label}</b><span>{i.display}</span></div>
          <div className="track"><i style={{ width: `${max ? Math.max(3, (i.value / max) * 100) : 0}%` }} /></div>
          {i.hint && <small>{i.hint}</small>}
        </div>
      ))}
    </div>
  );
}

export function ColumnChart({ buckets, metric = "count" }: { buckets: MonthBucket[]; metric?: "count" | "premium" }) {
  const val = (b: MonthBucket) => (metric === "count" ? b.count : b.premium);
  const max = Math.max(1, ...buckets.map(val));
  return (
    <div className="col-chart">
      {buckets.map((b) => (
        <div className="col" key={b.key} title={`${b.count} policies · ${money(b.premium)}`}>
          <span className="col-count">{val(b) ? (metric === "count" ? val(b) : compactMoney(val(b))) : ""}</span>
          <div className="col-bar"><i style={{ height: `${val(b) ? Math.max(6, (val(b) / max) * 100) : 0}%` }} /></div>
          <span className="col-label">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

export function ThemePicker({ value, onChange }: { value: Theme; onChange: (t: Theme) => void }) {
  return (
    <div className="theme-picker" role="radiogroup" aria-label="Theme">
      {THEMES.map((t) => (
        <button key={t.id} type="button" role="radio" aria-checked={value === t.id} className={`theme-option ${value === t.id ? "on" : ""}`} onClick={() => onChange(t.id)}>
          <div className="theme-card" data-theme={t.id} aria-hidden="true">
            <i className="tc-side" />
            <div className="tc-main"><b className="tc-title" /><span className="tc-cards"><u /><u /><u /></span><b className="tc-bar" /><b className="tc-bar short" /></div>
          </div>
          <div className="theme-meta"><strong>{t.label}</strong><small>{t.note}</small></div>
        </button>
      ))}
    </div>
  );
}
