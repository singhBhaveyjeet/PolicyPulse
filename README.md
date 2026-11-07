# PolicyPulse

Insurance agents work from spreadsheets sent by many insurers. PolicyPulse takes those Excel/CSV files, cleans them,
and turns them into one searchable, traceable view with live renewal analysis.

## How it works now

1. **Sign in** (local gate, see limitations) and the workspace opens **empty** — there is no built-in demo data.
2. **Add files**: choose one or many `.xlsx`, `.xls` or `.csv` files. Every visible sheet is read.
3. **Match columns**: PolicyPulse finds the header row (even under a title row), suggests which column is which
   (`Insured Name`, `Mobile No`, `Policy Expiry Date`… dozens of aliases), and shows exactly how the first rows will be read.
4. **Import & analyse**: the Overview fills with insights, renewals by month, insurer/type/premium analysis, a renewal
   queue and a data-quality report.
5. **Work the queue**: call, WhatsApp (message pre-filled) or email each customer and mark them
   *To contact / Contacted / Renewed / Lost*, with notes. Closed policies leave the queue and the "at risk" totals.
6. **Add or edit entries by hand**: **Add policy** opens a form (with duplicate checking); **Edit** in the policy drawer fixes any detail.
7. **Download the updated Excel** at any time (**Download Excel**). It includes new and edited entries, real date and number
   cells, and the same column titles as the import template, so it can be imported again.
8. **Analytics charts**: renewals over time (6/12/24 months, policies or premium), donuts for insurer, policy type,
   urgency and follow-up progress, premium bars, top customers and data quality.
9. **Settings**: profile name, agency, phone and photo, queue and table preferences, editable WhatsApp message template,
   full backup / restore (JSON), delete all data.
10. **Light and dark themes** for the dashboard (not the landing, login or signup pages). Light is a warm cream palette
    with a mauve accent; dark is near-black with a green accent. Chosen during first-time setup and in **Settings → Appearance**.
11. **First-time setup** after login: name, agency, mobile, city, what you sell, optional photo and theme. It can be skipped
    and edited later in Settings.
12. **Come back any time**: data is saved in the browser (IndexedDB) under the email you sign in with. Re-upload newer
   files and matching policies are **updated**, not duplicated.

## What it cleans automatically
- Dates: Excel serials, `20/10/2026`, `20-Oct-2026`, `2026-10-20`, `Oct 20, 2026` (ambiguous numeric dates are read day-first)
- Phones: `+91`, spaces, dashes, scientific notation (`9.87E9`), several numbers in one cell, validity check
- Premium: `Rs. 18,450/-`, `₹1,23,456`
- Policy type: `Two Wheeler`, `Car` → Motor; `Mediclaim` → Health; `Term` → Life
- Insurer spelling: `hdfc ergo` and `HDFC  Ergo` are one insurer
- Same policy = same policy number + insurer, ignoring case/spaces/punctuation
- Rows that cannot be used (no name, no policy number, unreadable expiry) are skipped, listed with row numbers, and can be
  downloaded as a "fix these" sheet

## Run locally
Node.js 20+ required.

```bash
npm install
npm run dev
```
Open http://localhost:3000, choose **Get started**, then **Add files**.
`sample-data/` has fictional files for a first try.

## Project structure
```text
app/                      Next.js pages (landing, login, signup, dashboard)
components/
  PolicyPulseApp.tsx      Workspace: pages, filters, renewal queue, drawer
  ImportModal.tsx         Multi-file import with column matching and preview
  PolicyForm.tsx          Add / edit a single policy
  SettingsPage.tsx        Profile, preferences, backup and restore
  charts.tsx              SVG donut, area and ring charts
  Onboarding.tsx          First-time questions shown after login
  ui.tsx                  Tables, stat cards, bar and column charts
lib/
  normalize.ts            Date/phone/premium/type cleaning, column auto-mapping
  build.ts                Rows → policies, duplicate detection, merge on re-import
  importer.ts             Reads Excel/CSV in the browser (SheetJS), header-row detection
  analysis.ts             Status tiers, stats, insights, customer grouping, WhatsApp link
  storage.ts              IndexedDB persistence per signed-in email (policies, profile, settings)
  settings.ts             Defaults and the WhatsApp message template engine
  image.ts                Profile photo resizing
  demo-auth.ts            Local session flag
sample-data/              Fictional CSV files
```

## Limitations (read before using real client data)
- **Data lives only in this browser on this device.** Clearing site data or changing browser/computer loses it. Use
  **Settings → Download backup** regularly.
- **Sign-in is not real security.** Any password of 8+ characters works; the email only decides which local workspace opens.
  Do not use on a shared computer. A real version needs a backend with proper authentication and encrypted storage.
- No multi-user sharing, no server-side processing, no automatic reminders or AI yet.
- Uses `xlsx@0.18.5` from npm, which has known advisories for untrusted files. For files only you provide this is low risk;
  before a hosted release switch to the maintained SheetJS build.
- Premium/expiry accuracy depends on your source files — always check the preview step.

## Next steps
PostgreSQL + real authentication, server-side imports, scheduled reminder emails/WhatsApp, AI assistant over the
portfolio, multi-agent tenancy, automated tests.

## Themes (how they work)
Every colour in `app/globals.css` and `app/dashboard/dashboard.css` is a variable such as `var(--c-3568e8)`.
`app/theme.css` defines the original values on `:root` (so the landing and login pages are unchanged) and overrides them
inside `[data-theme="light"]` and `[data-theme="dark"]`, which the dashboard sets on its root element.
To tune a colour, edit its `--c-xxxxxx` line in the matching block of `theme.css`. When writing new CSS for the dashboard,
use an existing `var(--c-...)` instead of a raw hex value so the new styles follow the theme too.
