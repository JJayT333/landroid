# RRC Import Readability Notes

This note captures what the official Railroad Commission of Texas (RRC) download page
is actually offering, how those files can be imported into LANDroid, and what it would
take to make them readable in-app.

Primary source:
- <https://www.rrc.texas.gov/resource-center/research/data-sets-available-for-download/>

Representative official manuals reviewed for this note:
- Drilling Permit manual: <https://www.rrc.texas.gov/media/ezxjqdmn/oga049.pdf>
- UIC manual: <https://www.rrc.texas.gov/media/v3onmigl/uic_manual_uia010_3116.pdf>
- P-5 manual: <https://www.rrc.texas.gov/media/jtqfynn3/ora001_p5_manual_october-2014.pdf>
- P-18 user guide: <https://www.rrc.texas.gov/media/j20f30cs/p-18_user_guide.pdf>

## Core conclusion

The RRC page is not one import problem. It is at least four different import/readability
problems:

1. `Readable now`
   - CSV
   - JSON
   - TXT
   - PDF
   - JPG / PNG

2. `Readable with a fixed-width parser`
   - many ASCII datasets

3. `Readable only after encoding conversion plus parsing`
   - many EBCDIC datasets

4. `Readable only after GIS/archive handling`
   - shapefiles / DBF / SHX / PRJ
   - ZIP bundles
   - TIFF-heavy image bundles

This means LANDroid should support every dataset as:
- a catalog item
- an imported raw file
- notes + manual pairing

before it claims every dataset is fully decoded.

## What the manuals tell us

### ASCII fixed-width families are realistic

The official drilling permit manual describes classic tape/file attributes and segment
layouts, including explicit record lengths and segment definitions.

Verified from the official drilling permit manual:
- dataset names are listed for master/tape files
- record length is listed as `510`
- the manual includes segment names and key-driven record structures

This means these files are practical candidates for:
- raw import now
- a fixed-width parser later
- segment-aware decoding once record keys are mapped

### EBCDIC families are a harder but still solvable path

The official UIC and P-5 manuals are explicit about tape-era characteristics such as:
- physical tape characteristics
- dataset names
- record lengths
- blocking factors
- segment dictionaries / field dictionaries

Examples verified from official manuals:
- P-5 manual lists record length `350`
- UIC manual includes segment dictionaries like `UIENF` / `UIENFRMK`

Important local validation:
- `node -e "new TextDecoder('ibm037')"` fails in the current runtime with
  `ERR_ENCODING_NOT_SUPPORTED`

So EBCDIC families are not just a parser problem. In LANDroid they need:
1. raw file import
2. EBCDIC-to-text conversion
3. record parser
4. field dictionary mapping

### GIS downloads are useful, but not a “plain file preview” problem

The official RRC page states that:
- users are responsible for choosing a compatible GIS export format
- county shape files include an associated `.prj` file

This confirms that shapefile-style downloads are real GIS assets, not normal office
documents. The best LANDroid path is:
- import raw ZIP / shapefile bundles now
- prefer GeoJSON conversion for immediate app readability
- add actual shapefile/DBF parsing only if it proves worth the complexity

### Visual document families are immediate wins

Some RRC families are already presentation-friendly:
- Drilling Permit (W-1) Imaged Files
- Directional Survey Applications
- Imaged Completion Files

These are already valuable with:
- raw import
- inline preview when the file is PDF
- tagging and notes
- attachment to tract / map / owner workflows

## Import/readability matrix

### Best first-class imports now

These are the easiest to make useful quickly:

- `Production Data Query Dump`
  - format: CSV
  - import now: yes
  - readable now: yes
  - structured parse: straightforward

- `Production Report for Pending Leases`
  - format: CSV
  - import now: yes
  - readable now: yes
  - structured parse: straightforward

- `P-18 Skim Oil/Condensate Report`
  - format: JSON
  - import now: yes
  - readable now: yes
  - structured parse: straightforward

- `R3 Gas Processing Plants`
  - format: JSON
  - import now: yes
  - readable now: yes
  - structured parse: straightforward

- `RRC Oil / ICE data`
  - format: TXT
  - import now: yes
  - readable now: yes
  - structured parse: moderate, depends on line structure

- `Drilling Permits Pending Approval`
  - format: ASCII-delimited TXT
  - import now: yes
  - readable now: core permit/wellbore/lat-long files yes
  - structured parse: first decoder path now live; remaining companion files still staged-only

- `Drilling Permit Master`
  - format: ASCII
  - import now: yes
  - readable now: core fixed-width status/permit records yes
  - structured parse: first fixed-width decoder path now live; deeper companion segments still staged-only

- `Drilling Permit Master and Trailer`
  - format: ASCII
  - import now: yes
  - readable now: core fixed-width permit records yes; lat/long companion records yes when present
  - structured parse: first fixed-width decoder path now live; deeper trailer segments still staged-only

- `Horizontal Drilling Permits`
  - format: ASCII
  - import now: yes
  - readable now: core fixed-width row layout yes
  - structured parse: first row-based fixed-width decoder path now live

- `W-1 Imaged Files`
  - format: PDF/TIFF/ZIP family
  - import now: yes
  - readable now: PDFs yes, TIFF/ZIP partial
  - structured parse: not the priority; document staging matters more

- `Directional Survey Applications`
  - format: PDF
  - import now: yes
  - readable now: yes

- `Imaged Completion Files`
  - format: PDF
  - import now: yes
  - readable now: yes

### Strong next-wave imports

These are worth doing after the current first-class readable files:

- `Completion Information in Data Format`
- `Wellbore Query Data`
- `High Cost Gas`
- `High Cost Gas (Tight Sands Only)`
- `Natural Gas Policy Act`
- `UIC Database ASCII`
- `P5 Organization ASCII`
- `PR(P1/P2) Gas Disposition ASCII`
- `Oil & Gas Field Name & Numbers`
- `Gas Annual Report Field Table`
- `Oil Annual Report Field Table`
- `Oil & Gas Field Rules`

Recommended handling:
- import raw file
- attach the official PDF manual
- implement a generic fixed-width parser where field widths come from a dataset spec

### Raw archive first, decode later

These are valuable, but not realistic to fully decode immediately:

- `Full Wellbore EBCDIC`
- `Statewide Oil Well Database`
- `Statewide Gas Well Database`
- `Oil Detail Well`
- `Oil Well Status (26 Month W-10)`
- `Gas Well Status (26 Month G-10)`
- `Statewide Production Data Oil`
- `Statewide Production Data Gas`
- `Gas Ledger` families
- `Oil Ledger` families
- `Historical Ledger – Statewide Gas`
- `Historical Ledger – Statewide Oil`
- `Certificate of Authorization P-4 Database`
- `UIC Database EBCDIC`
- `P5 Organization EBCDIC`

Recommended handling:
- support import and storage immediately
- encourage attaching the manual alongside the file
- mark them clearly as `Needs Decoder`
- only build decoders for the families that prove high-value in real workflow

### GIS-heavy / spatial families

- `Pipeline Layers by County`
- `Survey Layers by County`
- `Well Layers by County`
- `Base Layers by County`
- `All Layers by County`
- `Statewide API Data ASCII`
- `Statewide API Data dBase`

Recommended handling:
- import raw files now
- prefer county exports converted to GeoJSON for immediate LANDroid map use
- defer native shapefile/DBF parsing unless it becomes a clear priority

## Practical implementation recommendation

### Phase 1: support every dataset as a managed raw import

For every RRC family:
- catalog it in LANDroid
- import the raw downloaded file
- store notes
- pair it with the official PDF manual
- mark its readability status honestly

### Phase 2: fully decode the easy modern formats

Target:
- CSV
- JSON
- TXT

This is where LANDroid becomes genuinely useful fastest.

### Phase 3: add a reusable fixed-width ASCII parser

Use dataset-specific specs to describe:
- record length
- record type key
- field start / end
- field name
- optional transforms

This parser can unlock many ASCII families without one-off custom code every time.

### Phase 4: add EBCDIC conversion only for proven high-value families

Best likely candidates:
- Full Wellbore
- Statewide Production
- selected ledger families

Do not build EBCDIC support “for everything” first.

### Phase 5: add GIS-native ingestion only if it proves worth the complexity

Best path:
- GeoJSON first
- raw shapefile archive support second
- native shapefile/DBF parsing only if repeated real use justifies it

## Recommended priority order for LANDroid

1. `CSV / JSON / TXT / PDF` families
2. `ASCII fixed-width` families with high business value
3. `EBCDIC` families with clear user demand
4. `GIS-native shapefile` support

## Product implication

If LANDroid tries to “fully decode every RRC dataset” in one pass, the project will bog
down in legacy parsing work.

If LANDroid instead becomes:
- the place where every official file can be imported
- the place where manuals and notes stay attached
- the place where the easiest modern datasets become readable first

then it will feel powerful quickly while still leaving room for the deeper Ferrari-engine
version later.
