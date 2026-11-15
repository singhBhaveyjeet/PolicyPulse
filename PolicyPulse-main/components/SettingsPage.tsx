"use client";
import { useRef, useState } from "react";
import { Camera, Database, Download, LogOut, MessageCircle, Palette, Save, SlidersHorizontal, Trash2, Upload, UserRound } from "lucide-react";
import type { Policy, Profile, QueueWindow, Settings, Theme } from "@/lib/types";
import { DEFAULT_TEMPLATE, SPECIALITIES, TEMPLATE_TAGS, renderTemplate } from "@/lib/settings";
import { resizeImage } from "@/lib/image";
import { daysLeft } from "@/lib/analysis";
import { Avatar, PanelHead, ThemePicker } from "./ui";

type Props = {
  userEmail: string;
  profile: Profile;
  settings: Settings;
  policies: Policy[];
  onSaveProfileAction: (p: Profile) => void;
  onSaveSettingsAction: (s: Settings) => void;
  onThemeChangeAction: (t: Theme) => void;
  onDownloadExcelAction: () => void;
  onDownloadBackupAction: () => void;
  onRestoreBackupAction: (file: File) => void;
  onClearAllAction: () => void;
  onSignOutAction: () => void;
  notifyAction: (msg: string, tone?: "ok" | "error") => void;
};

const SAMPLE: Policy = {
  id: "sample", customerName: "Rahul Sharma", phone: "9876543210", email: "", policyNumber: "POL-10234", insurer: "HDFC ERGO", policyType: "Motor",
  startDate: "", expiryDate: new Date(Date.now() + 9 * 86400000).toISOString().slice(0, 10), premium: 18450, sourceFile: "", sourceSheet: "", sourceRow: 0,
  importedAt: "", importId: "", followUp: "pending", note: "",
};

export default function SettingsPage(props: Props) {
  const { userEmail, policies, notifyAction } = props;
  const [profile, setProfile] = useState<Profile>(props.profile);
  const [settings, setSettings] = useState<Settings>(props.settings);
  const photoRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLInputElement>(null);

  const profileDirty = JSON.stringify(profile) !== JSON.stringify(props.profile);
  const noTheme = (s: Settings) => JSON.stringify({ ...s, theme: "" });
  const settingsDirty = noTheme(settings) !== noTheme(props.settings);
  const sample = policies[0] ?? SAMPLE;
  const preview = renderTemplate(settings.whatsappTemplate, sample, profile.name, daysLeft(sample.expiryDate));
  const displayName = profile.name || userEmail.split("@")[0];

  async function pickPhoto(file?: File) {
    if (!file) return;
    try { setProfile((p) => ({ ...p, photo: "" })); const photo = await resizeImage(file); setProfile((p) => ({ ...p, photo })); }
    catch (e) { notifyAction(e instanceof Error ? e.message : "Could not use that photo.", "error"); }
    if (photoRef.current) photoRef.current.value = "";
  }

  return (
    <div className="settings">
      <section className="panel">
        <PanelHead title="Profile" subtitle="Shown in the sidebar, the top bar and in your messages to customers" action={<UserRound size={18} className="muted" />} />
        <div className="settings-body">
          <div className="photo-row">
            <Avatar photo={profile.photo} name={displayName} className="photo-preview" />
            <div>
              <div className="photo-actions">
                <button className="btn secondary" onClick={() => photoRef.current?.click()}><Camera size={14} /> {profile.photo ? "Change photo" : "Upload photo"}</button>
                {profile.photo && <button className="btn secondary danger" onClick={() => setProfile({ ...profile, photo: "" })}>Remove</button>}
              </div>
              <small>JPG or PNG. It is resized and stored in your Supabase workspace.</small>
            </div>
            <input ref={photoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => pickPhoto(e.target.files?.[0])} />
          </div>
          <div className="form-grid">
            <label>Your name<input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} placeholder="e.g. Rahul Sharma" /></label>
            <label>Agency / firm name<input value={profile.agency} onChange={(e) => setProfile({ ...profile, agency: e.target.value })} placeholder="e.g. Sharma Insurance Services" /></label>
            <label>Your phone number<input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="Optional" inputMode="tel" /></label>
            <label>City<input value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} placeholder="e.g. Kurukshetra" /></label>
            <label>Sign-in email<input value={userEmail} readOnly className="readonly" /></label>
          </div>
          <div className="onboard-block flush"><b>What you mostly sell</b>
            <div className="chip-select">{SPECIALITIES.map((sp) => <button key={sp} type="button" className={`pick ${profile.specialities.includes(sp) ? "on" : ""}`} aria-pressed={profile.specialities.includes(sp)} onClick={() => setProfile({ ...profile, specialities: profile.specialities.includes(sp) ? profile.specialities.filter((x) => x !== sp) : [...profile.specialities, sp] })}>{sp}</button>)}</div></div>
          <div className="settings-actions">
            <button className="btn primary" disabled={!profileDirty} onClick={() => props.onSaveProfileAction({ ...profile, name: profile.name.trim(), agency: profile.agency.trim(), phone: profile.phone.trim() })}><Save size={14} /> Save profile</button>
            {profileDirty && <button className="btn secondary" onClick={() => setProfile(props.profile)}>Discard changes</button>}
          </div>
        </div>
      </section>

      <section className="panel">
        <PanelHead title="Appearance" subtitle="Choose a dark or light look for the dashboard. It applies instantly." action={<Palette size={18} className="muted" />} />
        <div className="settings-body"><ThemePicker value={props.settings.theme} onChangeAction={props.onThemeChangeAction} /></div>
      </section>

      <section className="panel">
        <PanelHead title="Preferences" subtitle="How the queue, tables and customer messages behave" action={<SlidersHorizontal size={18} className="muted" />} />
        <div className="settings-body">
          <div className="form-grid">
            <label>Renewal queue opens on
              <select value={settings.defaultQueueWindow} onChange={(e) => setSettings({ ...settings, defaultQueueWindow: e.target.value as QueueWindow })}>
                <option value="overdue">Overdue</option><option value="7">Next 7 days</option><option value="14">Next 14 days</option><option value="30">Next 30 days</option><option value="60">Next 60 days</option>
              </select></label>
            <label>Rows per page in Policy records
              <select value={settings.pageSize} onChange={(e) => setSettings({ ...settings, pageSize: Number(e.target.value) as Settings["pageSize"] })}>
                <option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
              </select></label>
          </div>
          <label className="field-label wide-field"><span className="inline-title"><MessageCircle size={13} /> WhatsApp renewal message</span>
            <textarea rows={4} value={settings.whatsappTemplate} onChange={(e) => setSettings({ ...settings, whatsappTemplate: e.target.value })} />
          </label>
          <div className="tag-row">
            <span>Click to insert:</span>
            {TEMPLATE_TAGS.map((t) => <button key={t} className="tag" onClick={() => setSettings({ ...settings, whatsappTemplate: `${settings.whatsappTemplate} ${t}`.trim() })}>{t}</button>)}
            <button className="text-action" onClick={() => setSettings({ ...settings, whatsappTemplate: DEFAULT_TEMPLATE })}>Reset to default</button>
          </div>
          <div className="msg-preview"><small>PREVIEW{policies[0] ? "" : " (sample customer)"}</small><p>{preview}</p></div>
          <div className="settings-actions">
            <button className="btn primary" disabled={!settingsDirty} onClick={() => props.onSaveSettingsAction({ ...settings, whatsappTemplate: settings.whatsappTemplate.trim() || DEFAULT_TEMPLATE })}><Save size={14} /> Save preferences</button>
            {settingsDirty && <button className="btn secondary" onClick={() => setSettings(props.settings)}>Discard changes</button>}
          </div>
        </div>
      </section>

      <section className="panel">
        <PanelHead title="Data & backup" subtitle={`${policies.length.toLocaleString("en-IN")} policies are stored in your Supabase workspace`} action={<Database size={18} className="muted" />} />
        <div className="settings-body">
          <div className="data-row"><div><b>Download updated Excel</b><span>All policies, including entries you added or edited. The file can be imported again.</span></div>
            <button className="btn primary" disabled={!policies.length} onClick={props.onDownloadExcelAction}><Download size={14} /> Download .xlsx</button></div>
          <div className="data-row"><div><b>Full backup</b><span>Policies, import history, profile and preferences in one file you can restore later or on another computer.</span></div>
            <button className="btn secondary" onClick={props.onDownloadBackupAction}><Download size={14} /> Download backup</button></div>
          <div className="data-row"><div><b>Restore from backup</b><span>Replaces the records, imports, profile and preferences in your signed-in Supabase workspace.</span></div>
            <button className="btn secondary" onClick={() => restoreRef.current?.click()}><Upload size={14} /> Choose backup file</button>
            <input ref={restoreRef} type="file" accept=".json,application/json" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) props.onRestoreBackupAction(f); if (restoreRef.current) restoreRef.current.value = ""; }} /></div>
        </div>
      </section>

      <section className="panel">
        <PanelHead title="Account" subtitle="Session and danger zone" />
        <div className="settings-body">
          <div className="data-row"><div><b>Sign out</b><span>You can sign back in with the same email to see your data again.</span></div>
            <button className="btn secondary" onClick={props.onSignOutAction}><LogOut size={14} /> Sign out</button></div>
          <div className="data-row"><div><b>Delete all data</b><span>Removes every policy and import record from your workspace. Your profile and preferences stay. Download a backup first.</span></div>
            <button className="btn secondary danger" onClick={props.onClearAllAction}><Trash2 size={14} /> Delete everything</button></div>
        </div>
      </section>
    </div>
  );
}
