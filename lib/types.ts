export type FollowUp = "pending" | "contacted" | "renewed" | "lost";

export type Policy = {
  id: string;
  customerName: string;
  phone: string;
  email: string;
  policyNumber: string;
  insurer: string;
  policyType: string;
  startDate: string; // ISO yyyy-mm-dd, "" when unknown
  expiryDate: string; // ISO yyyy-mm-dd
  premium: number;
  sourceFile: string;
  sourceSheet: string;
  sourceRow: number; // row number as seen in Excel
  importedAt: string; // ISO date
  importId: string;
  followUp: FollowUp;
  note: string;
};

export type ImportRecord = {
  id: string;
  fileName: string;
  sheetName: string;
  added: number;
  updated: number;
  unchanged: number;
  rejected: number;
  importedAt: string; // ISO timestamp
};

export type Workspace = {
  policies: Policy[];
  imports: ImportRecord[];
  profile?: Profile;
  settings?: Settings;
};

export type QueueWindow = "overdue" | "7" | "14" | "30" | "60";

export type Theme = "light" | "dark";

export type Profile = {
  name: string;
  agency: string;
  phone: string;
  city: string;
  specialities: string[]; // kinds of insurance the agent mainly sells
  photo: string; // small JPEG data URL, "" when none
  onboarded: boolean; // false until the first-time questions are answered or skipped
};

export type Settings = {
  defaultQueueWindow: QueueWindow;
  pageSize: 25 | 50 | 100;
  whatsappTemplate: string;
  theme: Theme;
};
