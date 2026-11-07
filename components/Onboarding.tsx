"use client";
import { useRef, useState } from "react";
import { ArrowRight, Camera, ShieldCheck } from "lucide-react";
import type { Profile, Theme } from "@/lib/types";
import { SPECIALITIES } from "@/lib/settings";
import { cleanPhone } from "@/lib/normalize";
import { resizeImage } from "@/lib/image";
import { Avatar, ThemePicker } from "./ui";

type Props = {
  userEmail: string;
  initial: Profile;
  theme: Theme;
  onThemeChange: (t: Theme) => void;
  onDone: (p: Profile) => void;
  onSkip: () => void;
};

export default function Onboarding({ userEmail, initial, theme, onThemeChange, onDone, onSkip }: Props) {
  const [f, setF] = useState<Profile>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const photoRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setF((p) => ({ ...p, [k]: v }));
  const toggle = (s: string) => set("specialities", f.specialities.includes(s) ? f.specialities.filter((x) => x !== s) : [...f.specialities, s]);

  async function pickPhoto(file?: File) {
    if (!file) return;
    try { set("photo", await resizeImage(file)); } catch (e) { setErrors((x) => ({ ...x, photo: e instanceof Error ? e.message : "Could not use that photo." })); }
    if (photoRef.current) photoRef.current.value = "";
  }

  function submit() {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = "Please tell us your name";
    if (f.phone.trim() && !cleanPhone(f.phone).valid) e.phone = "Enter a 10-digit Indian mobile number";
    setErrors(e);
    if (Object.keys(e).length) return;
    onDone({ ...f, name: f.name.trim(), agency: f.agency.trim(), city: f.city.trim(), phone: f.phone.trim() ? cleanPhone(f.phone).display : "", onboarded: true });
  }

  return (
    <div className="onboard" data-theme={theme}>
      <div className="onboard-card">
        <div className="onboard-brand"><div className="brand-icon"><ShieldCheck size={22} /></div><div><strong>PolicyPulse</strong><small>DATA INTELLIGENCE</small></div></div>
        <h1>Welcome! Let’s set up your workspace</h1>
        <p className="onboard-sub">A few quick details so PolicyPulse can personalise your messages and dashboard. You can change all of this later in Settings.</p>

        <div className="photo-row">
          <Avatar photo={f.photo} name={f.name || userEmail} className="photo-preview" />
          <div>
            <div className="photo-actions"><button type="button" className="btn secondary" onClick={() => photoRef.current?.click()}><Camera size={14} /> {f.photo ? "Change photo" : "Add a photo (optional)"}</button>
              {f.photo && <button type="button" className="btn secondary danger" onClick={() => set("photo", "")}>Remove</button>}</div>
            {errors.photo && <small className="field-error">{errors.photo}</small>}
          </div>
          <input ref={photoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => pickPhoto(e.target.files?.[0])} />
        </div>

        <div className="form-grid">
          <label className={errors.name ? "has-error" : ""}>Your name <b className="required">*</b>
            <input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Rahul Sharma" autoFocus />{errors.name && <small className="field-error">{errors.name}</small>}</label>
          <label>Agency / firm name
            <input value={f.agency} onChange={(e) => set("agency", e.target.value)} placeholder="e.g. Sharma Insurance Services" /></label>
          <label className={errors.phone ? "has-error" : ""}>Mobile number
            <input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="10-digit mobile" inputMode="tel" />{errors.phone && <small className="field-error">{errors.phone}</small>}</label>
          <label>City
            <input value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="e.g. Kurukshetra" /></label>
        </div>

        <div className="onboard-block">
          <b>What do you mostly sell?</b><small>Pick all that apply</small>
          <div className="chip-select">{SPECIALITIES.map((s) => <button key={s} type="button" className={`pick ${f.specialities.includes(s) ? "on" : ""}`} aria-pressed={f.specialities.includes(s)} onClick={() => toggle(s)}>{s}</button>)}</div>
        </div>

        <div className="onboard-block">
          <b>Choose your look</b><small>Applies to the dashboard. Change it any time in Settings.</small>
          <ThemePicker value={theme} onChange={onThemeChange} />
        </div>

        <div className="onboard-actions">
          <button type="button" className="text-action" onClick={onSkip}>Skip for now</button>
          <button type="button" className="btn primary" onClick={submit}>Continue to dashboard <ArrowRight size={15} /></button>
        </div>
        <p className="onboard-foot"><ShieldCheck size={12} /> Signed in as {userEmail}. Your details stay in this browser.</p>
      </div>
    </div>
  );
}
