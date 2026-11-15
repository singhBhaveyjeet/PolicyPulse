# PolicyPulse

### Insurance Renewal Management & Business Analytics Platform

PolicyPulse is a web-based platform designed to help independent insurance agents manage policy records, track renewals, analyse their insurance portfolio, and make better business decisions.

Insurance agents often receive policy data from multiple insurance companies in different Excel and CSV formats. Managing these scattered records manually makes it difficult to track upcoming expiries, follow up with customers, identify renewal opportunities, and understand overall business performance.

**PolicyPulse brings these workflows together in one workspace.**

Import policy data from multiple insurers, automatically clean and organise records, monitor renewal deadlines, manage customer follow-ups, and gain actionable insights through dedicated analytics dashboards.

---

## Table of Contents

- [Key Features](#key-features)
- [How It Works](#how-it-works)
- [Analytics & Business Intelligence](#analytics--business-intelligence)
- [Data Import & Processing](#data-import--processing)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Supabase Configuration](#supabase-configuration)
- [Security & Data Privacy](#security--data-privacy)
- [Current Limitations](#current-limitations)
- [Future Scope](#future-scope)
- [Contributing](#contributing)
- [License](#license)

---

## Key Features

### 1. Authentication & Personal Workspace

- Secure authentication powered by Supabase Auth.
- Email-based account registration and login.
- Google Sign-In integration.
- Individual workspaces for authenticated users.
- Persistent user-specific policy records and preferences.
- First-time onboarding to configure agent and agency details.

### 2. Centralised Policy Management

Manage insurance records from different insurance providers in one place.

- Add new policies manually.
- Edit existing policy information.
- View detailed customer and policy records.
- Search and filter policies.
- Identify duplicate policy entries.
- Organise records by insurer and policy category.
- Track policy expiry dates and premium amounts.

### 3. Renewal Management

A dedicated workflow to help agents prioritise and manage upcoming renewals.

- Identify policies approaching their expiry dates.
- Prioritise customers based on renewal urgency.
- Maintain a structured renewal follow-up queue.
- Track customer communication and follow-up notes.
- Contact customers through WhatsApp, phone, or email.
- Update renewal statuses:
  - To Contact
  - Contacted
  - Interested
  - Renewed
  - Lost
- Separate completed and lost policies from the active renewal queue.

### 4. Advanced Excel & CSV Import

Import policy records from multiple insurance companies simultaneously.

- Support for `.xlsx`, `.xls`, and `.csv` files.
- Read multiple worksheets from uploaded Excel files.
- Automatic header-row detection.
- Intelligent column identification and mapping.
- Preview imported records before processing.
- Automatic data normalisation.
- Duplicate detection and record matching.
- Downloadable reports for rejected or invalid rows.
- Re-import updated files without unnecessarily duplicating existing policies.

### 5. Analytics Dashboard

Understand portfolio performance through interactive analytics.

- Portfolio overview and key performance indicators.
- Upcoming and expired policy analysis.
- Renewal funnel visualisation.
- Monthly policy expiry trends.
- Insurance provider performance.
- Policy category distribution.
- Premium analysis.
- Follow-up status analysis.
- Data quality monitoring.
- Filterable analytics based on insurer, policy type, expiry date, premium, and follow-up status.

### 6. Business Analytics

Go beyond basic policy tracking and understand the overall health of an insurance portfolio.

- Portfolio premium analysis.
- Renewal exposure monitoring.
- Monthly renewal forecasting.
- High-priority policy identification.
- Insurer concentration analysis.
- Insurance category distribution.
- Customer value grouping.
- Business insights generated from existing policy records.

The objective is to help insurance agents identify opportunities, understand renewal risks, and prioritise their business activities.

### 7. Data Export & Backup

- Export updated policy records to Excel.
- Preserve original column titles and structured data.
- Backup workspace data in JSON format.
- Restore data from previously generated backups.
- Maintain control over stored policy records.

### 8. Personalisation

- Customisable agent profile.
- Agency information and contact details.
- Profile photo support.
- Editable WhatsApp message templates.
- Dashboard preferences.
- Light and dark dashboard themes.

---

## How It Works

The primary workflow of PolicyPulse is designed around an insurance agent's daily operations.

1. **Sign In:** Create an account or authenticate using Google.
2. **Set Up Workspace:** Enter basic agent and agency information.
3. **Import Data:** Upload Excel or CSV files received from different insurance providers.
4. **Review Data:** Check automatically detected columns and preview the imported records.
5. **Process Records:** Clean, normalise, validate, and organise the policy information.
6. **Monitor Renewals:** Identify upcoming expiries and prioritise customer follow-ups.
7. **Manage Customers:** Update policy information, communicate with customers, and maintain follow-up statuses.
8. **Analyse Performance:** Use Analytics and Business Analytics to understand portfolio performance.
9. **Export & Backup:** Download updated records or create a workspace backup.

---

## Analytics & Business Intelligence

PolicyPulse separates operational policy management from business-level analysis.

| Analytics Dashboard | Business Analytics |
|---|---|
| Policy-level insights | Portfolio-level insights |
| Renewal tracking | Renewal exposure |
| Expiry trends | Monthly renewal forecast |
| Insurer distribution | Insurer concentration |
| Premium analysis | Portfolio premium analysis |
| Follow-up performance | Customer value grouping |
| Data quality checks | Business observations |

Both dashboards work with the available policy records and provide different perspectives on the same portfolio.

---

## Data Import & Processing

PolicyPulse includes a data-processing pipeline designed to handle inconsistent spreadsheets received from multiple insurers.

### Automatic Data Normalisation

| Data Type | Processing |
|---|---|
| Dates | Handles Excel serial dates and multiple date formats |
| Phone Numbers | Normalises country codes, spaces, dashes, and scientific notation |
| Premium | Handles formats such as `Rs. 18,450/-` and `₹1,23,456` |
| Policy Type | Maps variations such as Car and Two Wheeler to Motor |
| Insurer Names | Normalises inconsistent insurer naming |
| Duplicate Records | Matches policies using policy number and insurer |

### Data Validation

Records missing essential information, such as customer name, policy number, or a readable expiry date, are excluded from normal processing.

Invalid rows are identified with their source row numbers and can be downloaded for correction.

The import preview allows users to review the data before adding it to their workspace.

---

## Technology Stack

PolicyPulse is built using a modern web development stack.

| Technology | Purpose |
|---|---|
| Next.js 15 | Application framework |
| React 19 | User interface |
| TypeScript | Type-safe development |
| Tailwind CSS | Utility-first styling |
| Supabase | Backend services and database |
| Supabase Auth | Authentication and session management |
| PostgreSQL | Persistent data storage |
| SheetJS (xlsx) | Excel and CSV processing |
| Lucide React | Interface icons |

### Architecture

- **Frontend:** Next.js App Router with React and TypeScript.
- **Backend Services:** Supabase.
- **Database:** PostgreSQL.
- **Authentication:** Supabase Auth.
- **Data Processing:** Client-side spreadsheet parsing and normalisation.
- **Data Security:** PostgreSQL Row Level Security (RLS).

---

## Project Structure

```text
PolicyPulse/
│
├── app/
│   ├── dashboard/
│   ├── auth/
│   ├── login/
│   ├── signup/
│   ├── globals.css
│   ├── theme.css
│   └── ...
│
├── components/
│   ├── PolicyPulseApp.tsx
│   ├── AnalyticsDashboard.tsx
│   ├── BusinessAnalyticsDashboard.tsx
│   ├── ImportModal.tsx
│   ├── PolicyForm.tsx
│   ├── SettingsPage.tsx
│   ├── Onboarding.tsx
│   ├── charts.tsx
│   └── ui.tsx
│
├── lib/
│   ├── normalize.ts
│   ├── build.ts
│   ├── importer.ts
│   ├── analysis.ts
│   ├── businessAnalytics.ts
│   ├── storage.ts
│   ├── supabase.ts
│   ├── settings.ts
│   └── image.ts
│
├── public/
│
├── sample-data/
│
├── supabase/
│   ├── schema.sql
│   └── migrations/
│
├── .env.example
├── .gitignore
├── next.config.ts
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

---

## Getting Started

Follow these steps to run PolicyPulse locally.

### Prerequisites

Make sure you have installed:

- Node.js 20 or later
- npm
- Git
- A Supabase account

### 1. Clone the Repository

```bash
git clone https://github.com/singhBhaveyjeet/PolicyPulse.git
```

Navigate to the project directory:

```bash
cd PolicyPulse
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a local environment file:

**Windows PowerShell:**

```powershell
Copy-Item .env.example .env.local
```

**macOS / Linux:**

```bash
cp .env.example .env.local
```

Add your Supabase credentials to `.env.local`.

Refer to the Environment Variables section below.

### 4. Configure Supabase

1. Create a new project on Supabase.
2. Copy the project URL and publishable key.
3. Add them to `.env.local`.
4. Open the Supabase SQL Editor.
5. Execute `supabase/schema.sql`.
6. Apply the required migrations if you are using an existing database.

### 5. Configure Authentication

In your Supabase dashboard:

- Enable Email authentication.
- Configure your local site URL as `http://localhost:3000`.
- Add the required authentication redirect URLs.
- Configure Google OAuth if you want to use Google Sign-In.

For Google OAuth, configure the Google client ID and secret inside Supabase Authentication Providers. Never expose the Google client secret in frontend code.

### 6. Start the Development Server

```bash
npm run dev
```

Open the application:

```text
http://localhost:3000
```

The application should now be running locally.

### 7. Build for Production

```bash
npm run build
```

Start the production server:

```bash
npm run start
```

---

## Environment Variables

Create a `.env.local` file in the root directory.

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url

NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Replace the placeholder values with your actual Supabase project credentials.

**Important:** Never commit `.env.local` or expose Supabase service-role keys in client-side code.

---

## Supabase Configuration

PolicyPulse uses Supabase as its persistent backend.

The database configuration and migrations are maintained inside the `supabase/` directory.

### Database Setup

For a fresh project:

```text
supabase/schema.sql
```

Run the SQL file in the Supabase SQL Editor.

For an existing database, apply the relevant migrations in the `supabase/migrations/` directory.

For example:

```text
supabase/migrations/20261114_interested_follow_up.sql
```

This migration extends the supported follow-up statuses.

### Row Level Security

Database tables use Row Level Security policies to restrict access to records belonging to the authenticated user.

Each user should only be able to access and modify their own workspace data.

Always verify that the database schema, grants, and RLS policies are correctly configured before using real customer information.

---

## Security & Data Privacy

PolicyPulse is designed around individual user workspaces.

Important considerations:

- Supabase handles authentication and persistent storage.
- Database access is restricted through Row Level Security.
- Public frontend credentials must not be confused with privileged service-role credentials.
- Sensitive credentials should never be committed to GitHub.
- Imported insurance records should be handled responsibly.
- Users should maintain regular backups of their workspace.

**Note:** PolicyPulse is a software tool and does not independently certify regulatory compliance. Before using real customer data, review applicable privacy, consent, data-retention, and security requirements.

---

## Current Limitations

The following considerations are important when evaluating the current implementation:

- Analytics are based on currently stored policy records rather than historical snapshots.
- Historical month-over-month conversion tracking is not currently available.
- Scheduled renewal reminder delivery is not currently implemented.
- Multi-agent organisation sharing and team-level permissions are not currently implemented.
- Spreadsheet processing currently happens in the browser.
- Import accuracy depends on the quality and correctness of the source spreadsheets.

---

## Future Scope

PolicyPulse is intended to evolve into a more comprehensive insurance operations platform.

Potential future improvements include:

- Automated renewal notifications through WhatsApp and email.
- AI-powered insurance portfolio assistance.
- Advanced customer matching across different insurer spreadsheets.
- Multi-agent workspaces and role-based access control.
- Historical business performance tracking.
- Advanced renewal forecasting.
- Server-side spreadsheet processing.
- Detailed activity logs and audit trails.
- More advanced business intelligence and reporting.
- Integrations with external insurance management systems.

These are planned areas of development, not claims about currently available functionality.

---

## Contributing

Contributions, suggestions, and improvements are welcome.

If you would like to contribute:

1. Fork the repository.
2. Create a new feature branch.
3. Make your changes.
4. Test your implementation.
5. Submit a pull request with a clear description of the changes.

```bash
git checkout -b feature/your-feature-name
```

---

## License

A formal open-source license has not yet been specified.

Please contact the repository owner before redistributing or using this project commercially.

---

## About PolicyPulse

PolicyPulse aims to simplify the way independent insurance agents manage their portfolios.

Instead of switching between multiple spreadsheets and manually tracking renewal dates, agents can manage policies, organise customer follow-ups, monitor renewal opportunities, and understand their business performance from one centralised platform.

**One workspace. Better visibility. Smarter renewal management.**

Repository: https://github.com/singhBhaveyjeet/PolicyPulse
