"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, ArrowRight, Bell, CalendarClock, Check, CheckCircle2, ChevronRight, CloudUpload, Download,
  FileSpreadsheet, FileText, Gauge, LayoutDashboard, LifeBuoy, Lightbulb, LogOut, Mail, MessageCircle, Phone,
  Pencil, Plus, PlusCircle, Search, Settings as SettingsIcon, ShieldCheck, SlidersHorizontal, Trash2, Upload, Users, X, AlertTriangle,
} from "lucide-react";
import type { FollowUp, ImportRecord, Policy, Profile, QueueWindow, Settings, Theme } from "@/lib/types";
import { loadWorkspace, saveWorkspace } from "@/lib/storage";
import { downloadJSON, downloadTemplate, exportPolicies } from "@/lib/importer";
import { DEFAULT_SETTINGS, EMPTY_PROFILE, mergeProfile, mergeSettings } from "@/lib/settings";
import {
  FOLLOW_UP_LABEL, FOLLOW_UP_ORDER, buildInsights, computeStats, dateLabel, daysLeft, dueText, groupCustomers, initials, isOpen, money, rankPriorityRenewals,
  customerKey, statusOf, whatsappLink, STATUS_ORDER,
} from "@/lib/analysis";
import { cleanPhone, textKey } from "@/lib/normalize";
import ImportModal, { type ImportSummary } from "./ImportModal";
import { AreaChart } from "./charts";
import AnalyticsDashboard from "./AnalyticsDashboard";
import PolicyForm from "./PolicyForm";
import Onboarding from "./Onboarding";
import SettingsPage from "./SettingsPage";
import { Avatar, ColumnChart, Pair, PanelHead, PolicyTable, Stat, StatusPill } from "./ui";

type Page = "Overview" | "Policy records" | "Customers" | "Import center" | "Renewal action center" | "Analytics" | "Settings";
const nav: { label: Page; icon: typeof Activity; group: string }[] = [
  { label: "Overview", icon: LayoutDashboard, group: "WORKSPACE" },
  { label: "Policy records", icon: FileText, group: "WORKSPACE" },
  { label: "Customers", icon: Users, group: "WORKSPACE" },
  { label: "Import center", icon: CloudUpload, group: "DATA INTELLIGENCE" },
  { label: "Renewal action center", icon: CalendarClock, group: "DATA INTELLIGENCE" },
  { label: "Analytics", icon: Activity, group: "INSIGHTS" },
  { label: "Settings", icon: SettingsIcon, group: "ACCOUNT" },
];

type SortKey = "urgent" | "latest" | "premium" | "name" | "imported";
type Window = QueueWindow;
type Toast = { id: number; msg: string; tone: "ok" | "error" };

const prettyName = (email: string) =>
  (email.split("@")[0] || "there").replace(/[._-]+/g, " ").replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1));

export default function PolicyPulseApp({ userId, userEmail, onSignOutAction }: { userId: string; userEmail: string; onSignOutAction: () => void }) {
  // ---- workspace (saved to the signed-in Supabase account) ----
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const userName = profile.name.trim() || prettyName(userEmail);
  const PAGE_SIZE = settings.pageSize;
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [savedAt, setSavedAt] = useState("");
  const [priorityToday, setPriorityToday] = useState(() => new Date());

  // ---- view state ----
  const [page, setPage] = useState<Page>("Overview");
  const [search, setSearch] = useState("");
  const [insurerF, setInsurerF] = useState("All insurers");
  const [typeF, setTypeF] = useState("All types");
  const [statusF, setStatusF] = useState("All statuses");
  const [followF, setFollowF] = useState("All follow-ups");
  const [sortBy, setSortBy] = useState<SortKey>("urgent");
  const [pageNum, setPageNum] = useState(1);
  const [windowF, setWindowF] = useState<Window>("14");
  const [customerLimit, setCustomerLimit] = useState(60);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState<{ editing: Policy | null } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [banner, setBanner] = useState<ImportSummary | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    loadWorkspace(userId)
      .then((ws) => {
        if (!alive) return;
        const st = mergeSettings(ws.settings);
        setPolicies(ws.policies); setImports(ws.imports); setProfile(mergeProfile(ws.profile)); setSettings(st); setWindowF(st.defaultQueueWindow);
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setLoadError(error instanceof Error ? error.message : "Could not load your Supabase workspace.");
      })
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [userId]);

  useEffect(() => {
    if (!loaded || loadError) return;
    const t = setTimeout(() => {
      saveWorkspace(userId, { policies, imports, profile, settings })
        .then(() => { setSaveError(""); setSavedAt(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })); })
        .catch((error: unknown) => setSaveError(error instanceof Error ? error.message : "Could not save your Supabase workspace. Export a backup to keep a copy."));
    }, 400);
    return () => clearTimeout(t);
  }, [policies, imports, profile, settings, loaded, loadError, userId]);

  useEffect(() => { setPageNum(1); }, [search, insurerF, typeF, statusF, followF, sortBy, page]);
  useEffect(() => { setCustomerLimit(60); }, [search, page]);
  useEffect(() => {
    document.documentElement.dataset.appTheme = settings.theme;
    return () => { delete document.documentElement.dataset.appTheme; };
  }, [settings.theme]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refreshAtMidnight = () => {
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(() => {
        setPriorityToday(new Date());
        refreshAtMidnight();
      }, midnight.getTime() - now.getTime());
    };
    refreshAtMidnight();
    return () => clearTimeout(timer);
  }, []);

  // ---- analysis ----
  const stats = useMemo(() => computeStats(policies, priorityToday), [policies, priorityToday]);
  const insights = useMemo(() => buildInsights(policies, stats), [policies, stats]);
  const customers = useMemo(() => groupCustomers(policies), [policies]);
  const insurerNames = useMemo(() => stats.byInsurer.map((b) => b.name), [stats]);
  const typeNames = useMemo(() => stats.byType.map((b) => b.name), [stats]);
  const selected = policies.find((p) => p.id === selectedId) ?? null;

  const matchesSearch = (p: Policy, q: string) => {
    if (!q) return true;
    const digits = q.replace(/\D/g, "");
    if (digits.length >= 3 && p.phone.replace(/\D/g, "").includes(digits)) return true;
    return [p.customerName, p.email, p.policyNumber, p.insurer, p.policyType, p.phone].some((v) => v.toLowerCase().includes(q));
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = policies.filter((p) =>
      matchesSearch(p, q) &&
      (insurerF === "All insurers" || p.insurer === insurerF) &&
      (typeF === "All types" || p.policyType === typeF) &&
      (statusF === "All statuses" || (statusF === "Renewed" ? p.followUp === "renewed" : statusF === "Lost" ? p.followUp === "lost" : isOpen(p) && statusOf(p) === statusF)) &&
      (followF === "All follow-ups" || p.followUp === followF),
    );
    const byExpiry = (a: Policy, b: Policy) => a.expiryDate.localeCompare(b.expiryDate);
    const sorters: Record<SortKey, (a: Policy, b: Policy) => number> = {
      urgent: (a, b) => Number(!isOpen(a)) - Number(!isOpen(b)) || byExpiry(a, b),
      latest: (a, b) => byExpiry(b, a),
      premium: (a, b) => b.premium - a.premium,
      name: (a, b) => a.customerName.localeCompare(b.customerName),
      imported: (a, b) => b.importedAt.localeCompare(a.importedAt) || a.sourceRow - b.sourceRow,
    };
    return list.sort(sorters[sortBy]);
  }, [policies, search, insurerF, typeF, statusF, followF, sortBy]); // eslint-disable-line react-hooks/exhaustive-deps

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(pageNum, pages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const open = useMemo(() => policies.filter(isOpen), [policies]);
  const queueCounts = useMemo(() => ({
    overdue: open.filter((p) => daysLeft(p.expiryDate) < 0).length,
    "7": open.filter((p) => { const d = daysLeft(p.expiryDate); return d >= 0 && d <= 7; }).length,
    "14": open.filter((p) => { const d = daysLeft(p.expiryDate); return d >= 0 && d <= 14; }).length,
    "30": open.filter((p) => { const d = daysLeft(p.expiryDate); return d >= 0 && d <= 30; }).length,
    "60": open.filter((p) => { const d = daysLeft(p.expiryDate); return d >= 0 && d <= 60; }).length,
  }), [open]);

  const queue = useMemo(() => {
    const q = search.trim().toLowerCase();
    return open
      .filter((p) => {
        const d = daysLeft(p.expiryDate);
        return (windowF === "overdue" ? d < 0 : d >= 0 && d <= Number(windowF)) &&
          matchesSearch(p, q) && (insurerF === "All insurers" || p.insurer === insurerF);
      })
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate) || b.premium - a.premium);
  }, [open, windowF, search, insurerF]); // eslint-disable-line react-hooks/exhaustive-deps

  const priorityRenewals = useMemo(() => rankPriorityRenewals(open, priorityToday).slice(0, 20), [open, priorityToday]);
  const urgentCount = open.filter((p) => daysLeft(p.expiryDate, priorityToday) <= 5).length;

  // ---- actions ----
  function patchPolicy(id: string, change: Partial<Policy>) {
    setPolicies((prev) => prev.map((p) => (p.id === id ? { ...p, ...change } : p)));
  }
  function setFollowUp(id: string, v: FollowUp) { patchPolicy(id, { followUp: v }); }
  function saveNote(id: string, note: string) {
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => patchPolicy(id, { note }), 300);
  }
  function deletePolicy(p: Policy) {
    if (!window.confirm(`Delete ${p.customerName}'s policy ${p.policyNumber}? This cannot be undone.`)) return;
    setPolicies((prev) => prev.filter((x) => x.id !== p.id));
    setSelectedId(null);
  }
    function deleteCustomer(name: string, ids: string[]) {
    const n = ids.length;
    if (!window.confirm(`Delete ${name} and ${n === 1 ? "their 1 policy" : `all ${n} of their policies`}? This cannot be undone.`)) return;
    const gone = new Set(ids);
    setPolicies((prev) => prev.filter((p) => !gone.has(p.id)));
    setSelectedId(null);
    notify(`Deleted ${name} and ${n} ${n === 1 ? "policy" : "policies"}.`);
  }
  function removeImport(rec: ImportRecord) {
    const n = policies.filter((p) => p.importId === rec.id).length;
    if (!window.confirm(`Remove the ${n} records last imported from ${rec.fileName} (${rec.sheetName})? This cannot be undone.`)) return;
    setPolicies((prev) => prev.filter((p) => p.importId !== rec.id));
    setImports((prev) => prev.filter((r) => r.id !== rec.id));
  }
  function clearAll() {
    if (!window.confirm("Delete ALL policies and import history from this browser? Download a backup or Excel file first if you need one.")) return;
    setPolicies([]); setImports([]); setBanner(null); setPage("Overview"); notify("All data deleted from this browser.");
  }
  function onImported(next: Policy[], records: ImportRecord[], summary: ImportSummary) {
    setPolicies(next);
    setImports((prev) => [...records.reverse(), ...prev]);
    setBanner(summary);
    setShowImport(false);
    setPage("Overview");
    setSearch(""); setInsurerF("All insurers"); setTypeF("All types"); setStatusF("All statuses"); setFollowF("All follow-ups");
  }
  function notify(msg: string, tone: "ok" | "error" = "ok") {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }
  async function saveOnboardingProfile(nextProfile: Profile) {
    try {
      await saveWorkspace(userId, { policies, imports, profile: nextProfile, settings });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save your workspace.";
      setSaveError(message);
      throw new Error(message);
    }
    setProfile(nextProfile);
    setSaveError("");
    setSavedAt(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
  }
  const stamp = () => new Date().toISOString().slice(0, 10);
  const fileBase = () => `PolicyPulse_${(profile.agency || profile.name || "policies").trim().replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") || "policies"}`;
  function exportRows(list: Policy[], name?: string) {
    if (!list.length) { notify("There are no policies to download yet.", "error"); return; }
    exportPolicies(list, (p) => (isOpen(p) ? statusOf(p) : FOLLOW_UP_LABEL[p.followUp]), name ?? `${fileBase()}_${stamp()}.xlsx`);
    notify(`Downloaded ${list.length.toLocaleString("en-IN")} policies as Excel.`);
  }
  function savePolicy(p: Policy) {
    const isEdit = policies.some((x) => x.id === p.id);
    setPolicies((prev) => (isEdit ? prev.map((x) => (x.id === p.id ? p : x)) : [p, ...prev]));
    setForm(null);
    notify(isEdit ? `Saved changes to ${p.customerName}'s policy.` : `Added ${p.customerName}'s policy. Your analysis is updated.`);
    if (!isEdit) { setBanner(null); setSelectedId(p.id); }
  }
  function downloadBackup() {
    downloadJSON({ app: "PolicyPulse", version: 2, exportedAt: new Date().toISOString(), policies, imports, profile, settings }, `${fileBase()}_backup_${stamp()}.json`);
    notify("Backup downloaded. Keep the file somewhere safe.");
  }
  async function restoreBackup(file: File) {
    try {
      const data = JSON.parse(await file.text());
      const ok = data && data.app === "PolicyPulse" && Array.isArray(data.policies) &&
        data.policies.every((p: Policy) => p && typeof p.id === "string" && typeof p.customerName === "string" && typeof p.policyNumber === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.expiryDate));
      if (!ok) { notify("That does not look like a PolicyPulse backup file.", "error"); return; }
      if (!window.confirm(`Replace your Supabase workspace with this backup (${data.policies.length} policies)?`)) return;
      setPolicies(data.policies);
      setImports(Array.isArray(data.imports) ? data.imports : []);
      setProfile({ ...mergeProfile(data.profile), onboarded: true });
      const st = mergeSettings(data.settings);
      setSettings(st); setWindowF(st.defaultQueueWindow);
      notify(`Restored ${data.policies.length.toLocaleString("en-IN")} policies from backup.`);
    } catch { notify("That file could not be read as a backup.", "error"); }
  }
  const resetFilters = () => { setSearch(""); setInsurerF("All insurers"); setTypeF("All types"); setStatusF("All statuses"); setFollowF("All follow-ups"); };
  const openCustomer = (name: string, phone: string) => { setSearch(phone || name); setPage("Policy records"); };

  if (loadError) return <main className="auth-loading" role="alert">{loadError} Apply the Supabase setup in the project README, then reload. Your existing cloud data has not been overwritten.</main>;
  if (!loaded) return <main className="auth-loading" aria-live="polite">Opening your workspace…</main>;

  if (!profile.onboarded) {
    return (
      <Onboarding
        userEmail={userEmail}
        initial={{ ...profile, name: profile.name || prettyName(userEmail) }}
        theme={settings.theme}
        onThemeChangeAction={(t: Theme) => setSettings((s) => ({ ...s, theme: t }))}
        onDoneAction={async (p) => {
          await saveOnboardingProfile(p);
          notify(`Welcome, ${p.name.split(" ")[0]}! Add your first Excel or CSV file to get started.`);
        }}
        onSkipAction={async () => {
          await saveOnboardingProfile({ ...profile, onboarded: true });
          notify("Setup skipped. You can complete your profile later in Settings.");
        }}
      />
    );
  }

  const empty = policies.length === 0;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const todayLabel = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase();
  const subtitle: Record<Page, string> = {
    Overview: empty ? "Add your Excel or CSV files and PolicyPulse will analyse them for you." : "Here’s what your data says about your portfolio today.",
    "Policy records": "Search, filter and inspect every policy from every file.",
    Customers: "Customers grouped by phone number, with all of their policies.",
    "Import center": "Bring your spreadsheets into one searchable, traceable data layer.",
    "Renewal action center": "Work through renewals from most to least urgent and track each follow-up.",
    Analytics: "Understand premium, exposure and data quality across your book.",
    Settings: "Edit your profile, set preferences and back up your data.",
  };
  const startImport = () => setShowImport(true);

  const emptyState = (
    <section className="panel empty-hero">
      <div className="hero-icon big"><CloudUpload size={28} /></div>
      <h2>Start with your own spreadsheets</h2>
      <p>Add the Excel or CSV files you already use. PolicyPulse cleans the data, finds duplicates, ranks renewals by urgency and builds your analysis in seconds. Imported records are saved to your private Supabase workspace.</p>
      <div className="empty-actions">
        <button className="btn primary" onClick={startImport}><Upload size={15} /> Add Excel / CSV files</button>
        <button className="btn secondary" onClick={() => setForm({ editing: null })}><PlusCircle size={14} /> Add a policy manually</button>
        <button className="btn secondary" onClick={downloadTemplate}><Download size={14} /> Download sample format</button>
      </div>
      <div className="steps">
        <div><b>01</b><strong>Add files</strong><small>Any insurer, any column order</small></div><ArrowRight size={17} />
        <div><b>02</b><strong>Check the match</strong><small>Confirm column suggestions</small></div><ArrowRight size={17} />
        <div><b>03</b><strong>Act on insights</strong><small>Renewals ranked by urgency</small></div>
      </div>
    </section>
  );

  return (
    <div className="shell" data-theme={settings.theme}>
      <aside className="sidebar">
        <div className="brand"><div className="brand-icon"><ShieldCheck size={22} /></div><div><strong>PolicyPulse</strong><small>DATA INTELLIGENCE</small></div></div>
        <div className="workspace" role="button" tabIndex={0} title="Open settings" onClick={() => setPage("Settings")} onKeyDown={(e) => { if (e.key === "Enter") setPage("Settings"); }}><Avatar photo={profile.photo} name={userName} className="workspace-avatar" /><div><b>{userName}</b><small>{profile.agency || `${policies.length.toLocaleString("en-IN")} policies`}</small></div><SettingsIcon size={15} /></div>
        {["WORKSPACE", "DATA INTELLIGENCE", "INSIGHTS", "ACCOUNT"].map((group) => (
          <div className="nav-group" key={group}>
            <label>{group}</label>
            {nav.filter((n) => n.group === group).map((n) => {
              const I = n.icon;
              return (
                <button key={n.label} className={`nav-item ${page === n.label ? "active" : ""}`} onClick={() => setPage(n.label)}>
                  <I size={17} /><span>{n.label}</span>
                  {n.label === "Renewal action center" && queueCounts["14"] + queueCounts.overdue > 0 && <em>{Math.min(99, queueCounts["14"] + queueCounts.overdue)}</em>}
                </button>
              );
            })}
          </div>
        ))}
        <div className="side-bottom">
          <div className="help-card"><LifeBuoy size={18} /><b>Add or refresh data</b><p>Upload new files any time. Existing policies are matched by policy number, not duplicated.</p><button onClick={startImport}>Add files <ArrowRight size={13} /></button></div>
          <div className="profile" role="button" tabIndex={0} title="Open settings" onClick={() => setPage("Settings")} onKeyDown={(e) => { if (e.key === "Enter") setPage("Settings"); }}><Avatar photo={profile.photo} name={userName} className="profile-avatar" /><div><b>{userName}</b><small>{userEmail}</small></div><button className="sign-out" onClick={(e) => { e.stopPropagation(); onSignOutAction(); }} aria-label="Sign out"><LogOut size={16} /></button></div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="crumb">Workspace <ChevronRight size={14} /><b>{page}</b></div>
          <div className="top-actions">
            <span className="demo-tag" title="Your records are saved to your authenticated Supabase workspace"><i /> {saveError ? "NOT SAVED" : savedAt ? `SYNCED · ${savedAt}` : "SUPABASE WORKSPACE"}</span>
            <button className="icon-button" aria-label="Urgent renewals" onClick={() => setPage("Renewal action center")}><Bell size={17} />{urgentCount > 0 && <i />}</button>
            <button className="avatar-btn" onClick={() => setPage("Settings")} aria-label="Open settings"><Avatar photo={profile.photo} name={userName} className="top-avatar" /></button>
            <button className="sign-out top-sign-out" onClick={onSignOutAction} aria-label="Sign out"><LogOut size={15} /></button>
          </div>
        </header>

        <div className="content">
          <section className="welcome">
            <div>
              <div className="eyebrow"><span /> {todayLabel}</div>
              <h1>{page === "Overview" ? `${greeting}, ${userName.split(" ")[0]}` : page}</h1>
              <p>{subtitle[page]}</p>
            </div>
            <div className="welcome-actions">
              {!empty && <button className="btn secondary" onClick={() => exportRows(page === "Policy records" ? filtered : policies)}><Download size={15} /> {page === "Policy records" ? "Download view (Excel)" : "Download Excel"}</button>}
              <button className="btn secondary" onClick={() => setForm({ editing: null })}><PlusCircle size={15} /> Add policy</button>
              <button className="btn primary" onClick={startImport}><Plus size={16} /> Add files</button>
            </div>
          </section>

          {saveError && <div className="import-warning"><AlertTriangle size={15} />{saveError}</div>}

          {banner && (
            <div className="success-banner">
              <CheckCircle2 size={18} />
              <div>
                <b>Import complete — your analysis is ready below.</b>
                <span>
                  {banner.added.toLocaleString("en-IN")} new {banner.added === 1 ? "policy" : "policies"}
                  {banner.updated ? ` · ${banner.updated} updated` : ""}{banner.unchanged ? ` · ${banner.unchanged} already up to date` : ""}
                  {banner.rejected ? ` · ${banner.rejected} rows skipped (see Import center)` : ""}
                </span>
              </div>
              <button className="icon-button small" onClick={() => setBanner(null)} aria-label="Dismiss"><X size={14} /></button>
            </div>
          )}

          {/* ---------------- OVERVIEW ---------------- */}
          {page === "Overview" && empty && emptyState}
          {page === "Overview" && !empty && (
            <>
              {insights.length > 0 && (
                <section className="panel insights">
                  <PanelHead title="What your data says" subtitle="Generated from your files, updated as you work" tag="AUTO ANALYSIS" />
                  <ul>{insights.map((i, k) => <li key={k} className={`insight ${i.tone}`}><Lightbulb size={14} /><span>{i.text}</span></li>)}</ul>
                </section>
              )}
              <section className="stats">
                <Stat title="Total policies" value={stats.total.toLocaleString("en-IN")} icon={<FileText size={18} />} tone="blue" foot={`Across ${stats.byInsurer.length} insurer${stats.byInsurer.length === 1 ? "" : "s"}`} />
                <Stat title="Unique customers" value={stats.customers.toLocaleString("en-IN")} icon={<Users size={18} />} tone="purple" foot={`${stats.multiPolicyCustomers} with multiple policies`} />
                <Stat title="Expiring in 30 days" value={stats.due30.length.toLocaleString("en-IN")} icon={<CalendarClock size={18} />} tone="amber" foot={stats.expiredOpen.length ? `${stats.expiredOpen.length} already expired` : "Requires follow-up"} />
                <Stat title="Premium at risk" value={money(stats.premiumAtRisk)} icon={<Gauge size={18} />} tone="green" foot="Due within 30 days" />
              </section>
              <section className="panel priority-panel">
                <PanelHead
                  title="Top 20 Priority Renewals"
                  subtitle="Expiry urgency first, then premium and follow-up status. Renewed and lost policies are excluded."
                  action={<button className="text-action" onClick={() => setPage("Renewal action center")}>Open action center <ArrowRight size={13} /></button>}
                />
                <div className="priority-list">
                  {priorityRenewals.map((policy, index) => {
                    const days = daysLeft(policy.expiryDate, priorityToday);
                    const band = days < 0 ? "expired" : days <= 5 ? "critical" : days <= 14 ? "urgent" : days <= 30 ? "attention" : "upcoming";
                    const bandLabel = band === "expired" ? "Expired" : band[0].toUpperCase() + band.slice(1);
                    const phoneKey = cleanPhone(policy.phone).key;
                    const wa = whatsappLink(policy, settings.whatsappTemplate, userName);
                    return (
                      <div className="priority-row" key={policy.id}>
                        <span className="priority-rank">{String(index + 1).padStart(2, "0")}</span>
                        <button className="priority-customer" onClick={() => setSelectedId(policy.id)}>
                          <b>{policy.customerName}</b><small>Policy {policy.policyNumber}</small>
                        </button>
                        <div className="priority-company"><b>{policy.insurer}</b><small>{policy.policyType}</small></div>
                        <div className="priority-expiry">
                          <span className={`priority-band ${band}`}>{bandLabel}</span>
                          <b>{dateLabel(policy.expiryDate)}</b>
                          <small>{days < 0 ? `${Math.abs(days)} day${days === -1 ? "" : "s"} overdue` : days === 0 ? "Due today" : `${days} day${days === 1 ? "" : "s"} remaining`}</small>
                        </div>
                        <div className="priority-premium"><small>Premium</small><b>{policy.premium ? money(policy.premium) : "—"}</b></div>
                        <div className="priority-followup">
                          <span className={`priority-followup-status ${policy.followUp}`}>{FOLLOW_UP_LABEL[policy.followUp]}</span>
                          {policy.followUp === "pending" && <button className="priority-contact" onClick={() => setFollowUp(policy.id, "contacted")}>Mark contacted</button>}
                        </div>
                        <div className="priority-actions">
                          {phoneKey ? <a className="action-btn" href={`tel:${phoneKey}`} title="Call customer" aria-label={`Call ${policy.customerName}`}><Phone size={14} /></a> : <span className="action-btn off" title="No phone number"><Phone size={14} /></span>}
                          {wa ? <a className="action-btn" href={wa} target="_blank" rel="noreferrer" title="Send WhatsApp" aria-label={`WhatsApp ${policy.customerName}`}><MessageCircle size={14} /></a> : <span className="action-btn off" title="No valid mobile number"><MessageCircle size={14} /></span>}
                          {policy.email ? <a className="action-btn" href={`mailto:${policy.email}?subject=${encodeURIComponent(`Policy ${policy.policyNumber} renewal`)}`} title="Email customer" aria-label={`Email ${policy.customerName}`}><Mail size={14} /></a> : <span className="action-btn off" title="No email address"><Mail size={14} /></span>}
                          <button className="action-btn" onClick={() => setSelectedId(policy.id)} title="View details and follow-up notes" aria-label={`View ${policy.customerName} details and notes`}><Pencil size={14} /></button>
                        </div>
                      </div>
                    );
                  })}
                  {!priorityRenewals.length && <div className="priority-empty"><CheckCircle2 size={21} /><b>You’re all caught up!</b><span>There are no policies requiring immediate renewal action.</span></div>}
                </div>
              </section>
              <section className="two-col">
                <div className="panel">
                  <PanelHead title="Portfolio by insurer" subtitle="Policies and renewals due in 30 days" />
                  <div className="insurer-list">
                    {stats.byInsurer.slice(0, 8).map((x, i) => (
                      <button className="insurer-row" key={x.name} onClick={() => { resetFilters(); setInsurerF(x.name); setPage("Policy records"); }}>
                        <div className={`insurer-mark mark-${i % 5}`}>{x.name.split(" ").map((s) => s[0]).join("").slice(0, 3).toUpperCase()}</div>
                        <div className="insurer-main"><div className="between"><b>{x.name}</b><span>{x.count.toLocaleString("en-IN")} policies</span></div><div className="track"><i style={{ width: `${Math.max(5, (x.count / stats.total) * 100)}%` }} /></div></div>
                        <div className="due-count"><b>{x.due30}</b><small>due in 30d</small></div><ChevronRight size={15} />
                      </button>
                    ))}
                  </div>
                  <button className="panel-link" onClick={() => setPage("Analytics")}>See full analytics <ArrowRight size={14} /></button>
                </div>
                <div className="panel">
                  <PanelHead title="Renewal snapshot" subtitle="Your next workload at a glance" tag="LIVE" />
                  <div className="renewal-snapshot">
                    <div><b>{stats.expiredOpen.length}</b><span>Expired and still open</span></div>
                    <div><b>{stats.due7.length}</b><span>Expiring in 7 days</span></div>
                    <div><b>{stats.due30.length}</b><span>Expiring in 30 days</span></div>
                    <div><b>{money(stats.premiumAtRisk)}</b><span>Premium at risk</span></div>
                  </div>
                  <button className="panel-link" onClick={() => setPage("Renewal action center")}>Open action center <ArrowRight size={14} /></button>
                </div>
              </section>
              <section className="panel" style={{ marginBottom: 17 }}>
                <PanelHead title="Renewals by month" subtitle="Open policies expiring over the next 12 months" />
                <ColumnChart buckets={stats.timeline} />
              </section>
              <section className="lower">
                <div className="panel table-panel">
                  <PanelHead title="Most recently imported" subtitle="Latest records from your files" action={<button className="text-action" onClick={() => { setSortBy("imported"); setPage("Policy records"); }}>View all <ArrowRight size={13} /></button>} />
                  <PolicyTable policies={[...policies].sort((a, b) => b.importedAt.localeCompare(a.importedAt)).slice(0, 5)} onSelectAction={(p) => setSelectedId(p.id)} />
                </div>
                <div className="panel">
                  <PanelHead title="Recent imports" subtitle="Files you have added" />
                  <div className="recent-imports">
                    {imports.slice(0, 4).map((x) => (
                      <div className="import-item" key={x.id}><div className="file-icon"><FileSpreadsheet size={17} /></div><div className="import-copy"><b>{x.fileName}</b><span>{(x.added + x.updated).toLocaleString("en-IN")} records · {new Date(x.importedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span></div><span className="check"><Check size={13} /></span></div>
                    ))}
                  </div>
                  <button className="panel-link" onClick={() => setPage("Import center")}>View import history <ArrowRight size={14} /></button>
                </div>
              </section>
            </>
          )}

          {/* ---------------- ANALYTICS ---------------- */}
          {page === "Analytics" && (
            <AnalyticsDashboard
              policies={policies}
              today={priorityToday}
              insurers={insurerNames}
              policyTypes={typeNames}
              onSelectPolicyAction={setSelectedId}
            />
          )}

          {/* ---------------- SETTINGS ---------------- */}
          {page === "Settings" && (
            <SettingsPage
              key={JSON.stringify([profile, { ...settings, theme: "" }])}
              userEmail={userEmail} profile={profile} settings={settings} policies={policies}
              onSaveProfileAction={(p) => { setProfile(p); notify("Profile saved."); }}
              onSaveSettingsAction={(st) => { setSettings((prev) => ({ ...st, theme: prev.theme })); setWindowF(st.defaultQueueWindow); notify("Preferences saved."); }}
              onThemeChangeAction={(t) => setSettings((prev) => ({ ...prev, theme: t }))}
              onDownloadExcelAction={() => exportRows(policies)} onDownloadBackupAction={downloadBackup} onRestoreBackupAction={restoreBackup}
              onClearAllAction={clearAll} onSignOutAction={onSignOutAction} notifyAction={notify}
            />
          )}

          {/* ---------------- CUSTOMERS ---------------- */}
          {page === "Customers" && (empty ? emptyState : (
            <section className="panel directory">
              <PanelHead title="Customer directory" subtitle="Policies are grouped by mobile number (or email, then name)" tag={`${customers.length.toLocaleString("en-IN")} customers`} />
              <div className="toolbar"><div className="search"><Search size={15} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers…" /></div></div>
              {(() => {
                const q = search.trim().toLowerCase();
                const list = customers.filter((c) => !q || c.policies.some((p) => matchesSearch(p, q))).sort((a, b) => b.policies.length - a.policies.length || a.name.localeCompare(b.name));
                return (
                  <>
                    <div className="customer-grid">
                      {list.slice(0, customerLimit).map((c, i) => (
                        <div className="customer-card-wrap" key={c.key}>
                          <button className="customer-card" onClick={() => openCustomer(c.name, c.phone)}>
                            <div className={`customer-avatar avatar-${i % 5}`}>{initials(c.name)}</div>
                            <div><b>{c.name}</b><span>{c.phone || c.email || "No contact details"}</span><small>{c.policies.length} polic{c.policies.length === 1 ? "y" : "ies"} · {money(c.premium)}{c.nextExpiry ? ` · next ${dateLabel(c.nextExpiry)}` : ""}</small></div>
                            <ArrowRight size={15} />
                          </button>
                          <button className="customer-delete" onClick={() => deleteCustomer(c.name, c.policies.map((p) => p.id))} aria-label={`Delete ${c.name}`} title="Delete customer and all their policies"><Trash2 size={14} /></button>
                        </div>
                      ))}
                    </div>
                    {list.length > customerLimit && <button className="panel-link" onClick={() => setCustomerLimit((n) => n + 60)}>Show more ({list.length - customerLimit} remaining)</button>}
                    {!list.length && <div className="empty"><Search size={20} /><b>No matching customers</b></div>}
                  </>
                );
              })()}
            </section>
          ))}

          {/* ---------------- IMPORT CENTER ---------------- */}
          {page === "Import center" && (
            <section className="panel import-center">
              <div className="import-hero">
                <div className="hero-icon"><CloudUpload size={25} /></div>
                <div><h2>Add insurance data</h2><p>Upload XLSX, XLS or CSV files from any insurer. Re-upload whenever you get fresh sheets — matching policies are updated, not duplicated.</p></div>
                <button className="btn secondary" onClick={downloadTemplate}><Download size={14} /> Sample format</button>
                <button className="btn primary" onClick={startImport}><Upload size={15} /> Add files</button>
              </div>
              <div className="steps">
                <div><b>01</b><strong>Add files</strong><small>Several at once</small></div><ArrowRight size={17} />
                <div><b>02</b><strong>Match columns</strong><small>Auto-suggested</small></div><ArrowRight size={17} />
                <div><b>03</b><strong>Analyse</strong><small>Instant insights</small></div>
              </div>
              <PanelHead title="Import history" subtitle="Files imported into your Supabase workspace" />
              {!imports.length && <div className="empty"><FileSpreadsheet size={20} /><b>No files imported yet</b><span>Your imports will be listed here.</span></div>}
              {imports.map((x) => {
                const live = policies.filter((p) => p.importId === x.id).length;
                return (
                  <div className="history-row" key={x.id}>
                    <div className="file-icon"><FileSpreadsheet size={17} /></div>
                    <div className="import-copy"><b>{x.fileName} <small>· {x.sheetName}</small></b><span>{x.added} new · {x.updated} updated · {x.unchanged} unchanged{x.rejected ? ` · ${x.rejected} skipped` : ""} · {new Date(x.importedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span></div>
                    <button className="btn secondary small-btn" disabled={!live} onClick={() => removeImport(x)}><Trash2 size={13} /> Remove {live} records</button>
                  </div>
                );
              })}
              <div className="danger-zone">
                <div><b>Your data</b><span>Policies and import history are stored in your signed-in Supabase workspace. Download a backup before deleting records or switching projects.</span></div>
                <button className="btn secondary" disabled={empty} onClick={() => exportRows(policies)}><Download size={14} /> Download Excel</button>
                <button className="btn secondary danger" disabled={empty} onClick={clearAll}><Trash2 size={14} /> Delete all data</button>
              </div>
            </section>
          )}

          {/* ---------------- RENEWAL ACTION CENTER ---------------- */}
          {page === "Renewal action center" && (empty ? emptyState : (
            <section className="panel directory">
              <PanelHead title="Priority renewal queue" subtitle="Call, message and mark each renewal as you go. Closed items leave the queue." action={<button className="btn secondary" onClick={() => exportRows(queue, "renewal-queue.xlsx")}><Download size={14} /> Export</button>} />
              <div className="chips queue-chips">
                {([["overdue", "Overdue"], ["7", "Next 7 days"], ["14", "Next 14 days"], ["30", "Next 30 days"], ["60", "Next 60 days"]] as [Window, string][]).map(([k, label]) => (
                  <button key={k} className={`chip-btn ${windowF === k ? "active" : ""} ${k === "overdue" ? "late" : ""}`} onClick={() => setWindowF(k)}>{label} <b>{queueCounts[k]}</b></button>
                ))}
              </div>
              <div className="toolbar">
                <div className="search"><Search size={15} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone, policy number…" /></div>
                <select value={insurerF} onChange={(e) => setInsurerF(e.target.value)}><option>All insurers</option>{insurerNames.map((i) => <option key={i}>{i}</option>)}</select>
              </div>
              <div className="queue">
                {queue.slice(0, 100).map((p) => {
                  const d = daysLeft(p.expiryDate);
                  const wa = whatsappLink(p, settings.whatsappTemplate, userName);
                  const phoneKey = cleanPhone(p.phone).key;
                  return (
                    <div className="queue-row" key={p.id}>
                      <div className={`days-badge ${d <= 5 ? "critical" : d <= 14 ? "urgent" : "attention"}`}><b>{Math.abs(d)}</b><small>{d < 0 ? "LATE" : d === 1 ? "DAY" : "DAYS"}</small></div>
                      <button className="queue-main" onClick={() => setSelectedId(p.id)}>
                        <b>{p.customerName}</b>
                        <span>{p.policyType} · {p.insurer} · <code>{p.policyNumber}</code></span>
                        <small>{dateLabel(p.expiryDate)} · {dueText(p.expiryDate)}{p.premium ? ` · ${money(p.premium)}` : ""}</small>
                      </button>
                      <div className="queue-actions">
                        {phoneKey ? <a className="action-btn" href={`tel:${phoneKey}`} title="Call"><Phone size={14} /></a> : <span className="action-btn off" title="No phone"><Phone size={14} /></span>}
                        {wa ? <a className="action-btn" href={wa} target="_blank" rel="noreferrer" title="WhatsApp"><MessageCircle size={14} /></a> : <span className="action-btn off" title="No valid mobile"><MessageCircle size={14} /></span>}
                        {p.email ? <a className="action-btn" href={`mailto:${p.email}?subject=${encodeURIComponent(`Policy ${p.policyNumber} renewal`)}`} title="Email"><Mail size={14} /></a> : <span className="action-btn off" title="No email"><Mail size={14} /></span>}
                        <select className="followup-select" value={p.followUp} onChange={(e) => setFollowUp(p.id, e.target.value as FollowUp)} aria-label="Follow-up status">
                          {FOLLOW_UP_ORDER.map((k) => <option key={k} value={k}>{FOLLOW_UP_LABEL[k]}</option>)}
                        </select>
                      </div>
                    </div>
                  );
                })}
                {!queue.length && <div className="empty"><CheckCircle2 size={22} /><b>All clear</b><span>No open renewals in this window.</span></div>}
              </div>
              <div className="table-footer">Showing <b>{Math.min(queue.length, 100)}</b> of <b>{queue.length}</b>{queue.length > 100 ? " — narrow the window or search to see the rest" : ""}</div>
            </section>
          ))}

          {/* ---------------- POLICY RECORDS ---------------- */}
          {page === "Policy records" && (empty ? emptyState : (
            <section className="panel directory">
              <PanelHead title="All policy records" subtitle="Search, filter and inspect source records across your files." action={<button className="btn secondary" onClick={() => exportRows(filtered)}><Download size={14} /> Export</button>} />
              <div className="toolbar">
                <div className="search"><Search size={15} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone, policy number…" /></div>
                <select value={insurerF} onChange={(e) => setInsurerF(e.target.value)}><option>All insurers</option>{insurerNames.map((i) => <option key={i}>{i}</option>)}</select>
                <select value={typeF} onChange={(e) => setTypeF(e.target.value)}><option>All types</option>{typeNames.map((t) => <option key={t}>{t}</option>)}</select>
                <select value={statusF} onChange={(e) => setStatusF(e.target.value)}><option>All statuses</option>{STATUS_ORDER.map((s) => <option key={s}>{s}</option>)}<option>Renewed</option><option>Lost</option></select>
                <select value={followF} onChange={(e) => setFollowF(e.target.value)}><option>All follow-ups</option>{FOLLOW_UP_ORDER.map((k) => <option key={k} value={k}>{FOLLOW_UP_LABEL[k]}</option>)}</select>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)} aria-label="Sort">
                  <option value="urgent">Most urgent first</option><option value="latest">Latest expiry first</option><option value="premium">Highest premium</option><option value="name">Customer A–Z</option><option value="imported">Recently imported</option>
                </select>
                <button className="btn secondary" onClick={resetFilters}><SlidersHorizontal size={14} /> Reset</button>
              </div>
              <PolicyTable policies={pageRows} onSelectAction={(p) => setSelectedId(p.id)} />
              <div className="table-footer">
                Showing <b>{filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(filtered.length, safePage * PAGE_SIZE)}</b> of <b>{filtered.length.toLocaleString("en-IN")}</b> matching ({policies.length.toLocaleString("en-IN")} total)
                <span className="pager">
                  <button className="btn secondary small-btn" disabled={safePage <= 1} onClick={() => setPageNum(safePage - 1)}>Previous</button>
                  <em>Page {safePage} of {pages}</em>
                  <button className="btn secondary small-btn" disabled={safePage >= pages} onClick={() => setPageNum(safePage + 1)}>Next</button>
                </span>
              </div>
            </section>
          ))}

          <footer className="footer"><span>© 2026 PolicyPulse · Insurance data intelligence</span><span><i /> Private Supabase workspace</span></footer>
        </div>
      </main>

      {/* ---------------- POLICY DRAWER ---------------- */}
      {selected && (
        <div className="overlay" onClick={() => setSelectedId(null)}>
          <aside className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head"><div><small>POLICY RECORD</small><h2>Policy details</h2></div><button className="icon-button" onClick={() => setSelectedId(null)} aria-label="Close"><X size={18} /></button></div>
            <div className="customer-summary"><div className="large-avatar">{initials(selected.customerName)}</div><div><h3>{selected.customerName}</h3><p>{selected.phone || "No phone number"}</p><span>{selected.email || "No email provided"}</span></div></div>
            <div className="status-row"><StatusPill policy={selected} /><span>{isOpen(selected) ? dueText(selected.expiryDate) : FOLLOW_UP_LABEL[selected.followUp]}</span></div>

            <div className="drawer-section">
              <h4>FOLLOW-UP</h4>
              <div className="contact-row">
                {cleanPhone(selected.phone).key ? <a className="btn secondary" href={`tel:${cleanPhone(selected.phone).key}`}><Phone size={13} /> Call</a> : null}
                {whatsappLink(selected, settings.whatsappTemplate, userName) ? <a className="btn secondary" href={whatsappLink(selected, settings.whatsappTemplate, userName)} target="_blank" rel="noreferrer"><MessageCircle size={13} /> WhatsApp</a> : null}
                {selected.email ? <a className="btn secondary" href={`mailto:${selected.email}`}><Mail size={13} /> Email</a> : null}
              </div>
              <label className="field-label">Status
                <select value={selected.followUp} onChange={(e) => setFollowUp(selected.id, e.target.value as FollowUp)}>
                  {FOLLOW_UP_ORDER.map((k) => <option key={k} value={k}>{FOLLOW_UP_LABEL[k]}</option>)}
                </select>
              </label>
              <label className="field-label">Notes
                <textarea key={selected.id} defaultValue={selected.note} rows={3} placeholder="e.g. Asked to call back after Diwali" onChange={(e) => saveNote(selected.id, e.target.value)} />
              </label>
            </div>

            <div className="drawer-section">
              <h4>POLICY INFORMATION</h4>
              <Pair label="Policy number" value={selected.policyNumber} />
              <Pair label="Insurance company" value={selected.insurer} />
              <Pair label="Policy type" value={selected.policyType} />
              <Pair label="Annual premium" value={selected.premium ? money(selected.premium) : "—"} />
              <Pair label="Start date" value={dateLabel(selected.startDate)} />
              <Pair label="Expiry date" value={dateLabel(selected.expiryDate)} />
            </div>

            <div className="drawer-section">
              <div className="source-title"><h4>SOURCE PROVENANCE</h4><span><ShieldCheck size={12} /> TRACEABLE</span></div>
              <div className="source-card"><div className="file-icon"><FileSpreadsheet size={18} /></div>{selected.sourceSheet === "Manual entry" ? <div><b>Entered manually</b><span>Added inside PolicyPulse</span></div> : <div><b>{selected.sourceFile}</b><span>Worksheet: {selected.sourceSheet}</span><span>Excel row: {selected.sourceRow}</span></div>}</div>
              <p className="source-note">{selected.sourceSheet === "Manual entry" ? "You typed this record in yourself. Use Edit to correct any detail." : "This record came from the file above. If a number looks wrong, open that file at the row shown, or use Edit to fix it here."}</p>
            </div>

            {(() => {
              const others = policies.filter((p) => p.id !== selected.id && textKey(p.customerName) === textKey(selected.customerName) && p.phone === selected.phone);
              return others.length > 0 && (
                <div className="drawer-section">
                  <h4>OTHER POLICIES OF THIS CUSTOMER</h4>
                  {others.slice(0, 5).map((o) => <button key={o.id} className="mini-link" onClick={() => setSelectedId(o.id)}><span>{o.policyType} · {o.insurer}</span><small>{dateLabel(o.expiryDate)}</small></button>)}
                </div>
              );
            })()}

            <div className="drawer-actions">
              <button className="btn secondary danger" onClick={() => deletePolicy(selected)}><Trash2 size={14} /> Delete policy</button>
              <button className="btn secondary danger" onClick={() => deleteCustomer(selected.customerName, policies.filter((p) => customerKey(p) === customerKey(selected)).map((p) => p.id))}><Trash2 size={14} /> Delete customer</button>
              <button className="btn secondary" onClick={() => setForm({ editing: selected })}><Pencil size={14} /> Edit</button>
              <button className="btn primary" onClick={() => setSelectedId(null)}>Done</button>
            </div>
          </aside>
        </div>
      )}

      {showImport && <ImportModal existing={policies} onDoneAction={onImported} onCloseAction={() => setShowImport(false)} />}
      {form && <PolicyForm editing={form.editing} existing={policies} onSaveAction={savePolicy} onCloseAction={() => setForm(null)} />}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast ${t.tone}`}>{t.tone === "ok" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}<span>{t.msg}</span></div>)}
      </div>
    </div>
  );
}
