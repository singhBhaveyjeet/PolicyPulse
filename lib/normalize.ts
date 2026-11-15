// Pure helpers that clean messy real-world spreadsheet values.
// No browser or xlsx dependencies, so they are easy to test.

export type FieldKey =
  | "customerName" | "phone" | "email" | "policyNumber" | "insurer"
  | "policyType" | "startDate" | "expiryDate" | "premium";

export const FIELD_KEYS: FieldKey[] = [
  "customerName", "phone", "email", "policyNumber", "insurer",
  "policyType", "startDate", "expiryDate", "premium",
];

export const FIELD_LABELS: Record<FieldKey, string> = {
  customerName: "Customer name",
  phone: "Phone number",
  email: "Email",
  policyNumber: "Policy number",
  insurer: "Insurance company",
  policyType: "Policy type",
  startDate: "Start date",
  expiryDate: "Expiry / renewal date",
  premium: "Premium",
};

export const REQUIRED_FIELDS: FieldKey[] = ["customerName", "policyNumber", "expiryDate"];

const ALIASES: Record<FieldKey, string[]> = {
  customerName: ["customer name", "customer", "name", "insured name", "insured", "client name", "client", "policy holder", "policyholder", "policy holder name", "proposer name", "proposer", "owner name", "holder name", "party name", "assured name", "member name"],
  phone: ["phone", "mobile", "mobile no", "mobile number", "phone number", "phone no", "contact", "contact no", "contact number", "cell", "mob", "mob no", "telephone", "whatsapp", "whatsapp number", "mobile phone"],
  email: ["email", "e mail", "email id", "email address", "mail id", "mail"],
  policyNumber: ["policy number", "policy no", "policy id", "policy", "policy num", "policyno", "pol no", "certificate number", "certificate no", "policy number or certificate"],
  insurer: ["insurer", "insurance company", "company", "insurance provider", "provider", "insurer name", "company name", "carrier", "insurance co"],
  policyType: ["policy type", "type", "product", "product name", "category", "line of business", "lob", "plan", "plan name", "class", "insurance type", "policy category", "business type"],
  startDate: ["start date", "policy start date", "inception date", "risk start date", "commencement date", "issue date", "from date", "effective date", "policy from", "date of issue", "risk commencement date"],
  expiryDate: ["expiry date", "expiry", "renewal date", "policy end date", "end date", "due date", "renewal due date", "expiration date", "valid till", "valid upto", "valid up to", "to date", "policy to", "maturity date", "next due date", "renewal due", "policy expiry date", "risk end date", "expiry on"],
  premium: ["premium", "premium amount", "annual premium", "total premium", "gross premium", "net premium", "premium amt", "premium paid", "renewal premium", "amount", "total amount"],
};

const GENERIC_SINGLE_WORDS = new Set(["name", "type", "company", "policy", "contact", "amount", "mail", "plan", "class", "category", "product", "provider", "cell", "mob", "client", "customer", "insured", "premium", "expiry", "phone", "mobile", "email", "insurer"]);

export function normalizeHeader(s: unknown): string {
  return String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Suggest which spreadsheet column feeds each PolicyPulse field. */
export function autoMapHeaders(headers: string[]): Record<FieldKey, string> {
  const result = Object.fromEntries(FIELD_KEYS.map((f) => [f, ""])) as Record<FieldKey, string>;
  const used = new Set<string>();
  const normalized = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) })).filter((h) => h.norm);

  // Pass 1: exact alias match.
  for (const field of FIELD_KEYS) {
    const aliasSet = new Set(ALIASES[field].map(normalizeHeader));
    const hit = normalized.find((h) => !used.has(h.raw) && aliasSet.has(h.norm));
    if (hit) { result[field] = hit.raw; used.add(hit.raw); }
  }

  // Pass 2: header contains all words of a multi-word alias ("Customer Mobile Number").
  for (const field of FIELD_KEYS) {
    if (result[field]) continue;
    let best: { raw: string; score: number } | null = null;
    for (const h of normalized) {
      if (used.has(h.raw)) continue;
      const tokens = new Set(h.norm.split(" "));
      for (const alias of ALIASES[field]) {
        const at = normalizeHeader(alias).split(" ");
        if (at.length === 1 && GENERIC_SINGLE_WORDS.has(at[0])) continue;
        if (at.every((t) => tokens.has(t)) && (!best || at.length > best.score)) best = { raw: h.raw, score: at.length };
      }
    }
    if (best) { result[field] = best.raw; used.add(best.raw); }
  }
  return result;
}

export function mappedCount(map: Record<string, string>): number {
  return Object.values(map).filter(Boolean).length;
}

// ---------- Dates ----------
const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

function validYMD(y: number, m: number, d: number): boolean {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}
const fmt = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const fullYear = (y: number) => (y < 100 ? y + (y <= 69 ? 2000 : 1900) : y);

function serialToISO(n: number): string {
  if (!Number.isFinite(n) || n < 20000 || n > 80000) return "";
  const dt = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000);
  return fmt(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/**
 * Converts Excel serials, Date objects and common Indian text formats
 * (20/10/2026, 20-Oct-2026, 2026-10-20 ...) to ISO yyyy-mm-dd. Returns "" if unreadable.
 * Ambiguous numeric dates are read day-first (dd/mm/yyyy).
 */
export function toISODate(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return "";
    return validYMD(v.getFullYear(), v.getMonth() + 1, v.getDate()) ? fmt(v.getFullYear(), v.getMonth() + 1, v.getDate()) : "";
  }
  if (typeof v === "number") return serialToISO(v);
  const s = String(v).trim();
  if (!s) return "";

  if (/^\d{8}$/.test(s)) {
    const a = Number(s.slice(0, 4)), b = Number(s.slice(4, 6)), c = Number(s.slice(6, 8));
    if (validYMD(a, b, c)) return fmt(a, b, c);
    const d = Number(s.slice(0, 2)), m = Number(s.slice(2, 4)), y = Number(s.slice(4, 8));
    return validYMD(y, m, d) ? fmt(y, m, d) : "";
  }
  if (/^\d{5}(\.\d+)?$/.test(s)) return serialToISO(Number(s));

  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/);
  if (m) { const y = +m[1], mo = +m[2], d = +m[3]; return validYMD(y, mo, d) ? fmt(y, mo, d) : ""; }

  m = s.match(/^(\d{1,2})[-/.\s](\d{1,2})[-/.\s](\d{2,4})(?:[T\s,].*)?$/);
  if (m) {
    const a = +m[1], b = +m[2], y = fullYear(+m[3]);
    let d = a, mo = b;
    if (a <= 12 && b > 12) { mo = a; d = b; } // clearly month-first
    return validYMD(y, mo, d) ? fmt(y, mo, d) : "";
  }

  m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?[-\s/.,]+([A-Za-z]{3,9})\.?[-\s/.,]+(\d{2,4})/);
  if (m) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    const d = +m[1], y = fullYear(+m[3]);
    return mo && validYMD(y, mo, d) ? fmt(y, mo, d) : "";
  }

  m = s.match(/^([A-Za-z]{3,9})\.?[-\s.]+(\d{1,2})(?:st|nd|rd|th)?,?[-\s.]+(\d{2,4})/);
  if (m) {
    const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
    const d = +m[2], y = fullYear(+m[3]);
    return mo && validYMD(y, mo, d) ? fmt(y, mo, d) : "";
  }
  return "";
}

// ---------- Phone / email / money ----------
export type CleanPhone = { display: string; key: string; valid: boolean };

export function cleanPhone(v: unknown): CleanPhone {
  let s = typeof v === "number" ? (Number.isFinite(v) ? v.toFixed(0) : "") : String(v ?? "").trim();
  if (/^\d+(\.\d+)?e\+?\d+$/i.test(s)) s = Number(s).toFixed(0); // 9.87654321E9
  const first = s.split(/[\/,;]|\bor\b/i)[0].trim(); // several numbers in one cell: use the first
  let digits = first.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  else if (digits.length === 13 && digits.startsWith("091")) digits = digits.slice(3);
  const valid = /^[6-9]\d{9}$/.test(digits);
  return { display: valid ? digits : first, key: digits.length >= 7 ? digits : "", valid };
}

export function cleanEmail(v: unknown): string {
  const s = String(v ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : "";
}

export function parsePremium(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : 0;
  const m = String(v ?? "").match(/\d[\d,]*(?:\.\d+)?/);
  if (!m) return 0;
  const n = parseFloat(m[0].replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

// ---------- Text normalisation ----------
export const textKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function cleanText(v: unknown): string {
  return String(v ?? "").replace(/\s+/g, " ").trim();
}

const TYPE_RULES: [RegExp, string][] = [
  [/motor|\bcar\b|two ?wheeler|\b2 ?w\b|\b4 ?w\b|\btw\b|\bpcv\b|\bgcv\b|bike|vehicle|scooter|truck|\bauto\b/i, "Motor"],
  [/health|mediclaim|medical|hospital|floater|critical illness|cancer/i, "Health"],
  [/life|\bterm\b|endowment|ulip|pension|annuity|money ?back/i, "Life"],
  [/personal accident|\bpa\b/i, "Personal Accident"],
  [/fire|property|home|house|burglary/i, "Property"],
  [/travel/i, "Travel"],
  [/marine/i, "Marine"],
];

export function normalizePolicyType(v: unknown): string {
  const s = cleanText(v);
  if (!s) return "";
  for (const [re, label] of TYPE_RULES) if (re.test(s)) return label;
  return s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

/** Same policy = same policy number at the same insurer, ignoring case, spaces and punctuation. */
export function makePolicyKey(insurer: string, policyNumber: string): string {
  const num = policyNumber.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const ins = insurer === "Unassigned" ? "" : textKey(insurer);
  return `${ins}|${num}`;
}

const KNOWN_INSURERS: [RegExp, string][] = [
  [/hdfc ?ergo|hdfc/i, "HDFC ERGO"], [/icici/i, "ICICI Lombard"], [/\blic\b/i, "LIC"],
  [/\bsbi/i, "SBI General"], [/\btata/i, "Tata AIG"], [/bajaj/i, "Bajaj Allianz"],
  [/\bstar\b/i, "Star Health"], [/new ?india/i, "New India Assurance"], [/united ?india/i, "United India"],
  [/oriental/i, "Oriental Insurance"], [/national ?ins/i, "National Insurance"], [/care ?health|\bcare\b/i, "Care Health"],
  [/\bniva|max ?bupa/i, "Niva Bupa"], [/max ?life/i, "Max Life"], [/kotak/i, "Kotak General"],
  [/reliance/i, "Reliance General"], [/\bdigit\b/i, "Go Digit"], [/\backo\b/i, "Acko"], [/iffco/i, "IFFCO Tokio"],
  [/chola/i, "Cholamandalam MS"], [/generali/i, "Future Generali"], [/royal ?sundaram/i, "Royal Sundaram"],
  [/aditya ?birla|abhi/i, "Aditya Birla Health"],
];

/** Best-effort guess of the insurer or policy type from a file name like "HDFC_Motor_Oct.xlsx". */
export function guessInsurerFromName(fileName: string): string {
  for (const [re, label] of KNOWN_INSURERS) if (re.test(fileName)) return label;
  return "";
}
export function guessTypeFromName(fileName: string): string {
  return normalizePolicyType(fileName.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").match(/motor|car|bike|two ?wheeler|health|mediclaim|life|term|travel|marine|fire|property/i)?.[0] ?? "");
}
