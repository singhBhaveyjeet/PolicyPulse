# PolicyPulse

Insurance agents work from spreadsheets sent by many insurers. PolicyPulse takes those Excel/CSV files, cleans them,
and turns them into one searchable, traceable view with live renewal analysis.

## Core workflow

1. **Create an account or sign in** with Supabase Auth. Each account gets an isolated workspace.
2. **Add files**: choose one or many `.xlsx`, `.xls` or `.csv` files. Every visible sheet is read.
3. **Match columns**: PolicyPulse finds the header row (even under a title row), suggests which column is which
   (`Insured Name`, `Mobile No`, `Policy Expiry Date`… dozens of aliases), and shows exactly how the first rows will be read.
4. **Import & analyse**: the Overview fills with insights, a Top 20 priority worklist, renewal demand by month, and insurer/type/premium analysis.
5. **Work the queue**: call, WhatsApp (message pre-filled) or email each customer and mark them
   *To contact / Contacted / Interested / Renewed / Lost*, with notes. Closed policies leave the active queue and "at risk" totals.
6. **Add or edit entries by hand**: **Add policy** opens a form (with duplicate checking); **Edit** in the policy drawer fixes any detail.
7. **Download the updated Excel** at any time (**Download Excel**). It includes new and edited entries, real date and number
   cells, and the same column titles as the import template, so it can be imported again.
8. **Analytics intelligence**: filter by expiry-date range, insurer, policy type, follow-up status and premium; review portfolio KPIs, the renewal funnel, expiry trend, insurer/category performance, rule-based business insights and a data-quality center.
9. **Settings**: profile name, agency, phone and photo, queue and table preferences, editable WhatsApp message template,
   full backup / restore (JSON), delete all data.
10. **Light and dark themes** for the dashboard (not the landing, login or signup pages). Light is a warm cream palette
    with a mauve accent; dark is near-black with a green accent. Chosen during first-time setup and in **Settings → Appearance**.
11. **First-time setup** after login: name, agency, mobile, city, what you sell, optional photo and theme. It can be skipped
    and edited later in Settings.
12. **Come back any time**: policies, imports, profile and preferences are saved to the signed-in Supabase workspace.
   Re-upload newer files and matching policies are **updated**, not duplicated.

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
Copy-Item .env.example .env.local
# Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local
npm run dev
```
Before starting the app:

1. Create a Supabase project and copy its project URL and publishable key into `.env.local`.
2. Run [`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL Editor. The tables have row-level security enabled;
   each authenticated user can only read or modify their own workspace.
   Existing projects must also run [`supabase/migrations/20261114_interested_follow_up.sql`](./supabase/migrations/20261114_interested_follow_up.sql)
   before using the **Interested / follow-up** status. This migration only extends the allowed follow-up values; it does not change policy data or access rules.
3. Configure the Supabase Auth email provider and set the local site URL to `http://localhost:3000`. Add
   `http://localhost:3000/dashboard` and `http://localhost:3000/auth/reset-password` to the allowed redirect URLs.
4. To enable **Continue with Google**, create a Google OAuth client of type **Web application**. Add your app origin
   (for example `http://localhost:3000`) to its authorized JavaScript origins and
   `https://<project-ref>.supabase.co/auth/v1/callback` to its authorized redirect URIs. Enable Google under
   **Supabase → Authentication → Sign In / Providers** and enter the Google client ID and secret there. Do not put
   Google's client secret in `.env.local` or browser code.
5. Open http://localhost:3000, choose **Create account** or **Continue with Google**, then **Add files**.

`sample-data/` has fictional files for a first try.

## Project structure
```text
app/                      Next.js pages (landing, login, signup, dashboard)
components/
  PolicyPulseApp.tsx      Workspace: pages, filters, renewal queue, drawer
  AnalyticsDashboard.tsx  Filterable portfolio, renewal, performance and quality reporting
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
  analysis.ts             Priority scoring, analytics, data-quality checks, customer grouping
  storage.ts              Supabase workspace persistence for the authenticated user
  supabase.ts             Supabase client configuration
  settings.ts             Defaults and the WhatsApp message template engine
  image.ts                Profile photo resizing
sample-data/              Fictional CSV files
supabase/schema.sql       Workspace table, grants and row-level security
supabase/migrations/      Additive database upgrades for existing projects
```

## Operational and privacy notes
- Supabase is now the source of truth. Use a Supabase project you control and keep its database backups enabled.
- Only the public/publishable key belongs in this browser app. Never add a Supabase service-role key to `NEXT_PUBLIC_*` or
  commit credentials. Access control depends on applying the included RLS policies; do not expose client records before
  confirming they are active.
- Existing records in the previous local-browser version are not uploaded automatically. Export a backup from that
  version and restore it from **Settings → Restore from backup** after signing in. This requires an intentional user action.
- Analytics use the current policy records and follow-up states. The app does not store historical status snapshots, so it avoids claiming month-over-month conversion changes. Renewal rates are calculated only from records marked Renewed or Lost.
- There is no multi-agent organization sharing, scheduled reminder delivery, or AI assistant yet.
- Uses `xlsx@0.18.5` from npm, which has known advisories for untrusted files. For files only you provide this is low risk;
  before a hosted release switch to the maintained SheetJS build.
- Premium/expiry accuracy depends on your source files — always check the preview step.

Renewal tracking, customer records, cross-file search, data-quality reporting and source provenance are included as
practical daily tools. Based on the supplied roadmap, future work is human-reviewed customer matching, team roles and
tenant sharing, server-side import processing, audit/retention controls, scheduled reminders and optional AI querying.

Before using real client data, review applicable privacy, consent, retention, access and breach-response requirements with
your firm and legal/compliance adviser. This application does not itself certify regulatory compliance.

## Themes (how they work)
Every colour in `app/globals.css` and `app/dashboard/dashboard.css` is a variable such as `var(--c-3568e8)`.
`app/theme.css` defines the original values on `:root` (so the landing and login pages are unchanged) and overrides them
inside `[data-theme="light"]` and `[data-theme="dark"]`, which the dashboard sets on its root element.
To tune a colour, edit its `--c-xxxxxx` line in the matching block of `theme.css`. When writing new CSS for the dashboard,
use an existing `var(--c-...)` instead of a raw hex value so the new styles follow the theme too.
