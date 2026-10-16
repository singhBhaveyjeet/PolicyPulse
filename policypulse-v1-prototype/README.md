# PolicyPulse V1 Prototype

A local, presentation-ready prototype for an insurance data intelligence dashboard.

## What works
- Dashboard with sample portfolio metrics and expiry watchlist.
- Search policy number, customer name, phone, email and insurer.
- Filter policy records by insurer and expiry status.
- Upload `.xlsx`, `.xls` and `.csv` files in the browser.
- Preview imported rows and auto-suggest column mappings.
- Map spreadsheet headers to PolicyPulse canonical fields and import rows into the current browser session.
- Open policy details and see source file, worksheet and row provenance.
- Customer directory, import history, export filtered results to Excel, responsive layout.

## Important limitations
- Imported rows exist only in browser memory. Refreshing resets them.
- No login, backend, PostgreSQL, multi-user sharing, messaging or AI integration yet.
- Use synthetic data only. Never upload real policyholder personal, financial, health, Aadhaar or PAN data to this demo.
- This is a prototype for demonstration, not a production insurance system.

## Requirements
- Node.js 20+ (Node.js 22 LTS recommended)
- npm and VS Code

## Run locally
1. Extract the ZIP.
2. Open the `policypulse-v1-prototype` folder in VS Code.
3. Open Terminal → New Terminal.
4. Run:

```bash
npm install
npm run dev
```

5. Open `http://localhost:3000` (or the URL shown in the terminal).

Build check: `npm run build`

## Demo flow
1. Search `Rahul Sharma`, `9876543210`, or `PP-MTR-2026-1042`.
2. Click a row to view policy details and source provenance.
3. Click **Import data**, choose `sample-data/demo-insurer-a.csv`, verify mappings and import.
4. Export the filtered view to an Excel file.

## Canonical fields
`customer_name`, `phone`, `email`, `policy_number`, `insurer`, `policy_type`, `start_date`, `expiry_date`, `premium`.

## Project structure
```text
policypulse-v1-prototype/
├── app/ (Next.js app shell, page, global styles)
├── components/PolicyPulseApp.tsx
├── lib/ (types and synthetic demo records)
├── sample-data/ (fictional CSV files)
├── public/policypulse-mark.svg
├── package.json, tsconfig.json, next.config.ts
└── README.md
```

## Next version
Add PostgreSQL, authentication, server-side import processing, durable import history, robust duplicate detection, tenant isolation, security controls and tests.
