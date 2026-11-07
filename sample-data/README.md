# Sample files (fictional)

Use these only to try PolicyPulse before importing your own data.

- `demo-insurer-a.csv` mimics a messy insurer report: a title line above the headers, dd/mm/yyyy and dd-Mon-yyyy dates,
  "Rs. 14,500/-" premiums, `+91` phone formats, a row with no customer name (it is skipped and listed), and no insurer column
  (the file name `demo-insurer-a` does not name an insurer, so type "HDFC ERGO" in the "Insurer for rows with no insurer column" box).
- `demo-insurer-b.csv` uses different column names and ISO dates. Importing both shows customer grouping
  (Aarav Demo and Nisha Test appear in both files) and duplicate handling (DEMO-MTR-0005 is in both: the newer expiry wins).

Dates are in late 2026. Delete the sample data from **Import center → Delete all data** before loading real records.
