"use client";
import { useState } from "react";
import { Check, PlusCircle, Save, X } from "lucide-react";
import type { FollowUp, Policy } from "@/lib/types";
import { newId, todayISO } from "@/lib/build";
import { cleanEmail, cleanPhone, cleanText, makePolicyKey, normalizePolicyType, textKey, toISODate } from "@/lib/normalize";
import { FOLLOW_UP_LABEL } from "@/lib/analysis";

type Props = {
  editing: Policy | null; // null = add a new policy
  existing: Policy[];
  onSave: (p: Policy) => void;
  onClose: () => void;
};

const COMMON_TYPES = ["Motor", "Health", "Life", "Property", "Travel", "Marine", "Personal Accident"];

export default function PolicyForm({ editing, existing, onSave, onClose }: Props) {
  const [f, setF] = useState({
    customerName: editing?.customerName ?? "",
    phone: editing?.phone ?? "",
    email: editing?.email ?? "",
    policyNumber: editing?.policyNumber ?? "",
    insurer: editing && editing.insurer !== "Unassigned" ? editing.insurer : "",
    policyType: editing && editing.policyType !== "Other" ? editing.policyType : "",
    startDate: editing?.startDate ?? "",
    expiryDate: editing?.expiryDate ?? "",
    premium: editing?.premium ? String(editing.premium) : "",
    followUp: (editing?.followUp ?? "pending") as FollowUp,
    note: editing?.note ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const insurerOptions = Array.from(new Set(existing.map((p) => p.insurer).filter((i) => i !== "Unassigned")));
  const typeOptions = Array.from(new Set([...COMMON_TYPES, ...existing.map((p) => p.policyType).filter((t) => t !== "Other")]));

  function submit() {
    const e: Record<string, string> = {};
    const name = cleanText(f.customerName);
    const number = cleanText(f.policyNumber);
    const expiry = toISODate(f.expiryDate);
    const phone = cleanPhone(f.phone);
    const email = f.email.trim() ? cleanEmail(f.email) : "";
    const spelling = insurerOptions.find((i) => textKey(i) === textKey(f.insurer));
    const insurer = spelling ?? (cleanText(f.insurer) || "Unassigned");

    if (!name) e.customerName = "Enter the customer's name";
    if (!number) e.policyNumber = "Enter the policy number";
    if (!expiry) e.expiryDate = "Choose the expiry date";
    if (f.phone.trim() && !phone.valid) e.phone = "Enter a 10-digit Indian mobile number";
    if (f.email.trim() && !email) e.email = "That email address does not look right";
    if (f.startDate && f.expiryDate && f.startDate > f.expiryDate) e.startDate = "Start date is after the expiry date";
    if (f.premium.trim() && !(Number(f.premium) >= 0)) e.premium = "Enter a valid amount";
    if (number) {
      const key = makePolicyKey(insurer, number);
      const clash = existing.find((p) => p.id !== editing?.id && makePolicyKey(p.insurer, p.policyNumber) === key);
      if (clash) e.policyNumber = `Already saved for ${clash.customerName}. Edit that record instead.`;
    }
    setErrors(e);
    if (Object.keys(e).length) return;

    const base: Policy = editing ?? {
      id: newId("pol"), customerName: "", phone: "", email: "", policyNumber: "", insurer: "", policyType: "", startDate: "", expiryDate: "",
      premium: 0, sourceFile: "Added manually", sourceSheet: "Manual entry", sourceRow: 0, importedAt: todayISO(), importId: "manual", followUp: "pending", note: "",
    };
    onSave({
      ...base,
      customerName: name,
      phone: f.phone.trim() ? phone.display : "",
      email,
      policyNumber: number,
      insurer,
      policyType: normalizePolicyType(f.policyType) || "Other",
      startDate: toISODate(f.startDate),
      expiryDate: expiry,
      premium: f.premium.trim() ? Math.round(Number(f.premium) * 100) / 100 : 0,
      followUp: f.followUp,
      note: f.note.trim(),
    });
  }

  const err = (k: string) => (errors[k] ? <small className="field-error">{errors[k]}</small> : null);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">
            <div className="hero-icon">{editing ? <Save size={20} /> : <PlusCircle size={20} />}</div>
            <div><h2>{editing ? "Edit policy" : "Add a new policy"}</h2><p>{editing ? "Changes are saved straight away and included in your next Excel download." : "Enter one policy by hand. It joins your data and your analysis instantly."}</p></div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="form-grid">
          <label className={errors.customerName ? "has-error" : ""}>Customer name <b className="required">*</b>
            <input value={f.customerName} onChange={(e) => set("customerName", e.target.value)} placeholder="e.g. Rahul Sharma" autoFocus />{err("customerName")}</label>
          <label className={errors.phone ? "has-error" : ""}>Mobile number
            <input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="10-digit mobile" inputMode="tel" />{err("phone")}</label>
          <label className={errors.email ? "has-error" : ""}>Email
            <input value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="name@example.com" inputMode="email" />{err("email")}</label>
          <label className={errors.policyNumber ? "has-error" : ""}>Policy number <b className="required">*</b>
            <input value={f.policyNumber} onChange={(e) => set("policyNumber", e.target.value)} placeholder="e.g. POL-10234" />{err("policyNumber")}</label>
          <label>Insurance company
            <input list="pp-insurers" value={f.insurer} onChange={(e) => set("insurer", e.target.value)} placeholder="e.g. HDFC ERGO" />
            <datalist id="pp-insurers">{insurerOptions.map((i) => <option key={i} value={i} />)}</datalist></label>
          <label>Policy type
            <input list="pp-types" value={f.policyType} onChange={(e) => set("policyType", e.target.value)} placeholder="e.g. Motor" />
            <datalist id="pp-types">{typeOptions.map((t) => <option key={t} value={t} />)}</datalist></label>
          <label className={errors.startDate ? "has-error" : ""}>Start date
            <input type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} />{err("startDate")}</label>
          <label className={errors.expiryDate ? "has-error" : ""}>Expiry / renewal date <b className="required">*</b>
            <input type="date" value={f.expiryDate} onChange={(e) => set("expiryDate", e.target.value)} />{err("expiryDate")}</label>
          <label className={errors.premium ? "has-error" : ""}>Premium (₹)
            <input type="number" min="0" step="any" value={f.premium} onChange={(e) => set("premium", e.target.value)} placeholder="e.g. 18450" />{err("premium")}</label>
          <label>Follow-up status
            <select value={f.followUp} onChange={(e) => set("followUp", e.target.value)}>
              {(Object.keys(FOLLOW_UP_LABEL) as FollowUp[]).map((k) => <option key={k} value={k}>{FOLLOW_UP_LABEL[k]}</option>)}
            </select></label>
          <label className="wide">Notes
            <textarea rows={2} value={f.note} onChange={(e) => set("note", e.target.value)} placeholder="Anything worth remembering about this customer" /></label>
        </div>

        <div className="modal-footer">
          <span>Fields marked * are required</span>
          <div>
            <button className="btn secondary" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={submit}><Check size={14} /> {editing ? "Save changes" : "Add policy"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
