# Elmore #1 Unit — AI Wizard Test Fixture

Real-world landman unit used to regression-test the AI wizard and Q&A features.

## Files

- `Status_Elmore_Unit_NRI.xlsx` — per-lessor × per-tract NRI status matrix (ground truth)
- `DOTO_Runsheet_Elmore_Unit.xlsx` — chain-of-title + leasehold + NPR runsheets (wizard input)
- `Elmore_Tract_Map.tif` — tract map (not in git; fetch locally if needed)
- `TORS_Documents.zip` — 70+ recorded instruments referenced by the runsheet (not in git)

## Project shape

- **Project:** Elmore #1 Unit, Magnolia Petroleum Company, LLC
- **Location:** Vital Flores Svy A-14 & T. Webb Svy A-300, San Jacinto Co., TX
- **Unit size:** 276.12 acres across 7 tracts
- **Tracts (gross ac.):** T1=55.5016, T2=106.19, T3=28.223, T4=14.64, T5=8.44, T6=42.581, T7=20.546
- **NPRs:** NPR 1 covers Tracts 2,3,5,6 · NPR 2 covers Tracts 4,7
- **Mix:** mineral title, fixed NPRIs, floating NPRIs, partial leases, stacked fractional interests

## Why this fixture

Exercises the hardest real cases at once: multi-tract unit grouping, fixed + floating NPRI math,
chain-of-title parsing, mixed mineral/leasehold sheets, partial coverage, and irregular xlsx
headers (two-row headers, merged cells, per-tract column groups).

If the wizard can ingest this correctly, confidence is high for difficult
landman runsheets. It is still a regression fixture, not proof that every
spreadsheet format is covered.
