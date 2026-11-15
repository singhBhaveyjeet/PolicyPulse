"use client";
// Lightweight SVG charts in the PolicyPulse palette. No chart library needed.
import { compactMoney, money } from "@/lib/analysis";
import type { MonthBucket } from "@/lib/analysis";

export const PALETTE = ["#3568e8", "#7c5cf0", "#22a37a", "#e6a23c", "#e0627a", "#4aa8d8", "#b4bfd0"];

export type Slice = { label: string; value: number; color?: string };

/** Keeps the biggest slices and folds the rest into "Others". */
export function topSlices(items: Slice[], keep = 5): Slice[] {
  const sorted = [...items].filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const head = sorted.slice(0, keep);
  const rest = sorted.slice(keep).reduce((s, i) => s + i.value, 0);
  const out = rest > 0 ? [...head, { label: "Others", value: rest }] : head;
  return out.map((s, i) => ({ ...s, color: s.color ?? PALETTE[i % PALETTE.length] }));
}

export function DonutChart({ slices, centerValue, centerLabel, formatAction }: { slices: Slice[]; centerValue: string; centerLabel: string; formatAction?: (n: number) => string }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (!total) return <div className="empty">Nothing to show yet.</div>;
  let acc = 0;
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 42 42" className="donut" role="img" aria-label={`${centerLabel}: ${centerValue}`}>
        <circle cx="21" cy="21" r="15.9155" fill="none" className="donut-track" strokeWidth="5.5" />
        {slices.map((s) => {
          const pct = (s.value / total) * 100;
          const el = (
            <circle key={s.label} cx="21" cy="21" r="15.9155" fill="none" stroke={s.color} strokeWidth="5.5"
              strokeDasharray={`${Math.max(0, pct - 0.6)} ${100 - Math.max(0, pct - 0.6)}`} strokeDashoffset={25 - acc}>
              <title>{`${s.label}: ${formatAction ? formatAction(s.value) : s.value} (${Math.round(pct)}%)`}</title>
            </circle>
          );
          acc += pct;
          return el;
        })}
        <text x="21" y="20.6" textAnchor="middle" className="donut-value">{centerValue}</text>
        <text x="21" y="26" textAnchor="middle" className="donut-label">{centerLabel}</text>
      </svg>
      <ul className="legend">
        {slices.map((s) => (
          <li key={s.label}><i style={{ background: s.color }} /><span>{s.label}</span><b>{formatAction ? formatAction(s.value) : s.value.toLocaleString("en-IN")}</b><em>{Math.round((s.value / total) * 100)}%</em></li>
        ))}
      </ul>
    </div>
  );
}

/** Smooth-ish line with soft area fill, used for renewals over time. */
export function AreaChart({ buckets, metric }: { buckets: MonthBucket[]; metric: "count" | "premium" }) {
  const W = 640, H = 220, L = 44, R = 14, T = 16, B = 30;
  const vals = buckets.map((b) => (metric === "count" ? b.count : b.premium));
  const max = Math.max(1, ...vals);
  const niceMax = metric === "count" ? Math.max(4, Math.ceil(max / 4) * 4) : max * 1.15;
  const x = (i: number) => L + (buckets.length === 1 ? 0 : (i / (buckets.length - 1)) * (W - L - R));
  const y = (v: number) => T + (1 - v / niceMax) * (H - T - B);
  const pts = vals.map((v, i) => [x(i), y(v)] as const);
  const line = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const area = `${line} L${x(vals.length - 1).toFixed(1)},${H - B} L${x(0).toFixed(1)},${H - B} Z`;
  const fmt = (v: number) => (metric === "count" ? String(Math.round(v)) : compactMoney(v));
  const step = buckets.length > 14 ? 3 : buckets.length > 8 ? 2 : 1;
  const grid = [0, 0.25, 0.5, 0.75, 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="area-chart" role="img" aria-label="Renewals by month">
      <defs><linearGradient id={`ag-${metric}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" className="ag-top" /><stop offset="100%" className="ag-bot" /></linearGradient></defs>
      {grid.map((g) => (
        <g key={g}>
          <line x1={L} x2={W - R} y1={y(niceMax * g)} y2={y(niceMax * g)} className="grid-line" />
          <text x={L - 8} y={y(niceMax * g) + 3} textAnchor="end" className="axis">{fmt(niceMax * g)}</text>
        </g>
      ))}
      <path d={area} fill={`url(#ag-${metric})`} />
      <path d={line} fill="none" className="area-line" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map(([px, py], i) => (
        <g key={buckets[i].key}>
          <circle cx={px} cy={py} r="3.6" className="area-pt" strokeWidth="2"><title>{`${buckets[i].full}: ${buckets[i].count} policies, ${money(buckets[i].premium)}`}</title></circle>
          {i % step === 0 && <text x={px} y={H - 10} textAnchor="middle" className="axis">{buckets[i].label}</text>}
        </g>
      ))}
    </svg>
  );
}

export function ProgressRing({ value, total, label }: { value: number; total: number; label: string }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="ring-wrap">
      <svg viewBox="0 0 42 42" className="ring" role="img" aria-label={`${label}: ${pct}%`}>
        <circle cx="21" cy="21" r="15.9155" fill="none" className="ring-track" strokeWidth="4.5" />
        <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#22a37a" strokeWidth="4.5" strokeLinecap="round" strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset="25" />
        <text x="21" y="23.5" textAnchor="middle" className="donut-value">{pct}%</text>
      </svg>
      <div><b>{label}</b><span>{value} of {total} closed renewals</span></div>
    </div>
  );
}
