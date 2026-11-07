import type { Policy, Profile, Settings, Theme } from "./types";

export const DEFAULT_TEMPLATE =
  "Hello {customer}, your {type} insurance policy {policy_number} with {insurer} {due}. Please let me know if you would like me to arrange the renewal. - {agent}";

export const DEFAULT_SETTINGS: Settings = { defaultQueueWindow: "14", pageSize: 50, whatsappTemplate: DEFAULT_TEMPLATE, theme: "light" };
export const EMPTY_PROFILE: Profile = { name: "", agency: "", phone: "", city: "", specialities: [], photo: "", onboarded: false };
export const SPECIALITIES = ["Motor", "Health", "Life", "Property", "Travel", "Other"];
export const THEMES: { id: Theme; label: string; note: string }[] = [
  { id: "light", label: "Light", note: "Warm cream, easy on the eyes in daylight" },
  { id: "dark", label: "Dark", note: "Near-black with a green accent" },
];

export const TEMPLATE_TAGS = ["{customer}", "{type}", "{policy_number}", "{insurer}", "{expiry_date}", "{due}", "{agent}"];

export function mergeSettings(s?: Partial<Settings> | null): Settings {
  const windows = ["overdue", "7", "14", "30", "60"];
  const sizes = [25, 50, 100];
  return {
    defaultQueueWindow: windows.includes(String(s?.defaultQueueWindow)) ? (s!.defaultQueueWindow as Settings["defaultQueueWindow"]) : DEFAULT_SETTINGS.defaultQueueWindow,
    pageSize: sizes.includes(Number(s?.pageSize)) ? (Number(s!.pageSize) as Settings["pageSize"]) : DEFAULT_SETTINGS.pageSize,
    whatsappTemplate: typeof s?.whatsappTemplate === "string" && s.whatsappTemplate.trim() ? s.whatsappTemplate : DEFAULT_TEMPLATE,
    theme: s?.theme === "dark" ? "dark" : "light",
  };
}

export function mergeProfile(p?: Partial<Profile> | null): Profile {
  return {
    name: typeof p?.name === "string" ? p.name : "",
    agency: typeof p?.agency === "string" ? p.agency : "",
    phone: typeof p?.phone === "string" ? p.phone : "",
    city: typeof p?.city === "string" ? p.city : "",
    specialities: Array.isArray(p?.specialities) ? p.specialities.filter((x): x is string => SPECIALITIES.includes(x as string)) : [],
    onboarded: p?.onboarded === true,
    photo: typeof p?.photo === "string" && p.photo.startsWith("data:image/") ? p.photo : "",
  };
}

const fmtDate = (iso: string) => (iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");

/** Fills the placeholders of a message template for one policy. */
export function renderTemplate(template: string, p: Policy, agent: string, daysLeft: number): string {
  const due = daysLeft < 0 ? `expired on ${fmtDate(p.expiryDate)}` : `is due for renewal on ${fmtDate(p.expiryDate)}`;
  const map: Record<string, string> = {
    customer: p.customerName,
    type: p.policyType === "Other" ? "" : p.policyType,
    policy_number: p.policyNumber,
    insurer: p.insurer === "Unassigned" ? "your insurer" : p.insurer,
    expiry_date: fmtDate(p.expiryDate),
    due,
    agent: agent || "your insurance advisor",
  };
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in map ? map[k] : m)).replace(/ {2,}/g, " ").trim();
}
