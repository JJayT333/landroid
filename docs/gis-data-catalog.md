# GIS Data Catalog

Status: reference inventory only. Raw GIS packages and extracted geodata stay
local-only and should not be committed.

This catalog was created from a read-only inspection of
`Raven_Forest_Master_2025_11_25.ppkx copy.zip` on May 15, 2026. The outer zip is
about 3.5 GB and contains one ArcGIS Pro project package:
`Raven_Forest_Master_2025_11_25.ppkx`. The `.ppkx` is a 7-Zip archive; expanded
locally it is about 4.4 GB.

## Package Contents

- ArcGIS Pro projects: `p20/Raven_Forest_Master.aprx` and
  `p30/Raven_Forest_Master.aprx`.
- File geodatabases:
  - `commondata/raven_forest_xfer.gdb`
  - `commondata/raven_forest_xfer1.gdb`
  - `commondata/raven_forest_xfer2.gdb`
- Standalone shapefiles:
  - `commondata/commondata/Navarro_Development_Sticks.shp`
  - `commondata/commondata/Pecan_Gap_Development.shp`
  - `commondata/commondata/Upper_Taylor_Development.shp`
  - `commondata/gibbs/Gibbs_Min_Ownership.shp`
  - `commondata/onedrive_1_11-9-2025/well339b.shp`
  - `commondata/onedrive_1_11-9-2025/well339l.shp`
  - `commondata/onedrive_1_11-9-2025/well339s.shp`
- Rasters: three georeferenced PNG image sets under `commondata/raster_data`.
- ArcGIS styles/toolboxes: bundled `.stylx`, `.tbx`, and `.atbx` files.

GDAL/OGR found 134 readable layers across 10 GIS data sources:

| Geometry | Layer Count |
| --- | ---: |
| MultiPolygon | 54 |
| MultiPolygonZ | 28 |
| None / attachment table | 19 |
| MultiLineStringZ | 11 |
| MultiLineString | 8 |
| Point | 6 |
| LineString | 4 |
| PointZ | 2 |
| MultiPolygonZM | 1 |
| Polygon | 1 |

Most LANDroid-relevant geodatabase layers use
`NAD83(NSRS2007) / Texas Central (ftUS)`, EPSG:3664. The standalone
`Gibbs_Min_Ownership.shp` uses EPSG:2277.

## High-Value Layers

| Layer | Source | Count | Notes |
| --- | --- | ---: | --- |
| `PrivateLeases_ExportFeatures` | `raven_forest_xfer.gdb` | 466 | Private lease/lessor-interest polygons. Fields include `ProspectTract`, `Lessor`, `Acreage`, `LessorsInterest`, `NetAcres`, `LeaseDate`, `Expiration`, `Royalty`, and `TotalBonus`. Has 205 PDF attachments totaling about 2.9 GB. |
| `FederalLeases_ExportFeatures1` | `raven_forest_xfer.gdb` | 26 | Federal/current lease layer. Fields include `ProspectTract`, `ProspectTractLegacy`, `RecordTitle`, `OperatingRights`, `OriginalLessee`, `Lessor`, `EDUTract`, `Acreage`, `LeaseDate`, `Expiration`, and `Royalty`. Has 20 PDF attachments totaling about 106.7 MB. One invalid geometry was reported. |
| `federal_merge` | `raven_forest_xfer.gdb` | 19 | Federal lease merge subset with the same lease-style fields. Has 13 PDF attachments totaling about 66 MB. |
| `federal_merge` | `raven_forest_xfer2.gdb` | 26 | Second copy/version of the federal merge layer, closer to the exported `Fwed` shapefile count. |
| `unleased_federal` | `raven_forest_xfer.gdb` | 37 | Unleased federal polygons with lease-style fields. One invalid geometry was reported. |
| `Unleased_Federal_Tracts` | `raven_forest_xfer.gdb` | 43 | Federal tract/deed layer with `Tract`, `DeedToUS`, `SurveyName`, `SurveyNumber`, `Volume`, `Page`, `Acreage`, and lease-style fields. One invalid geometry was reported. |
| `UnleasedFederalTractWithExpired` | `raven_forest_xfer.gdb` | 48 | Combined unleased/expired federal tract layer with deed and lease-style fields. |
| `merged_landparcels` | `raven_forest_xfer.gdb` | 193,541 | Large multi-county parcel base. Useful as reference/context, not as active title math input. OGR reported 25 invalid geometries. |
| `surveys` | `raven_forest_xfer.gdb` | 4,844 | Survey boundary reference layer. |
| `selected_surveys` | `raven_forest_xfer.gdb` | 1,466 | Focused survey boundary subset. |
| `Sam_Houston_Ownership` | `raven_forest_xfer.gdb` | 119 | Surface/forest ownership reference. Fields include `ORG_TYPE`, `UnitName`, and `Acres`. One invalid geometry was reported. |
| `Gibbs_Min_Ownership` | standalone shapefile | 88 | Gibbs mineral ownership source with tract, survey, deed acres, mineral interest, royalty interest, grantor/grantee, and comments fields. |
| `Surface_Holes`, `Bottom_Holes`, `Horizontal_Wells` | `raven_forest_xfer.gdb` | 6 / 10 / 5 | Focused well layers. The package also includes larger standalone well shapefiles. |
| `pipeline_12_inch`, `pipeline_3half_inch` | `raven_forest_xfer.gdb` | 5 / 5 | Infrastructure line layers with PDF attachments on related export layers. |
| `drill_pads`, `PotentialDrillSite`, `EDU_Merge` | `raven_forest_xfer.gdb` | 3 / 8 / 15 | Development planning/context layers. |

## Attachment Tables

The geodatabase contains ArcGIS attachment relationship tables. This maps well
to LANDroid's Phase 5 document model, but the raw BLOBs are too large to import
blindly.

Notable attachment totals:

| Attachment Table | Count | Total Size |
| --- | ---: | ---: |
| `PrivateLeases_ExportFeatures__ATTACH` | 205 | ~2.90 GB |
| `FederalLeases_ExportFeatures1__ATTACH` | 20 | ~106.7 MB |
| `federal_merge__ATTACH` | 13 | ~66.0 MB |
| `CA_Agreement__ATTACH` | 10 | ~60.1 MB |
| `R_and_R_Leases__ATTACH` | 7 | ~32.0 MB |
| `pipeline_12_inch__ATTACH` | 40 | ~73.4 MB |
| `pipeline_3half_inch__ATTACH` | 15 | ~78.8 MB |

## Data Quality Notes

- The ArcGIS package is a better source than shapefile exports when field names
  matter. The shapefiles truncate names such as `ProspectTract`,
  `RecordTitle`, `OperatingRights`, and `Description`.
- Several concepts exist in multiple versions, especially federal leases,
  unleased federal tracts, parcels, annotations, and exported feature copies.
  A future importer needs an explicit canonical-source choice per concept.
- Lease/business fields are mostly strings. Import code should preserve raw
  text and add normalized values for acreage, interest, royalty, dates, and
  expiration status.
- `PrivateLeases_ExportFeatures` is intentionally not one row per tract. The
  source map modeled multiple undivided mineral/lease interests by stacking
  identical tract polygons, one row per owner/interest line, so each row could
  carry its own attributes and PDF attachments. `ProspectTract` alone should
  not be treated as a primary key.
- Federal lease records have strong source identifiers in `ProspectTract` and
  `ProspectTractLegacy`, but there are blanks and special cases.
- Expiration values mix date strings, blanks, and `HBP`; model those as status
  plus optional date rather than a single date field.
- Geometry should be cleaned before spatial indexing or automated joins. Known
  invalid geometry counts from spot checks include:
  - `FederalLeases_ExportFeatures1`: 1
  - `unleased_federal`: 1
  - `Unleased_Federal_Tracts`: 1
  - `CA_Agreement`: 1
  - `Sam_Houston_Ownership`: 1
  - `merged_landparcels`: 25

## LANDroid Implications

- Treat this package as source/reference GIS material for now, not as active
  Texas title math input.
- A repo-safe next step is a small canonical layer map: concept, chosen source
  layer, stable id fields, key attributes, attachment relationship, and import
  priority.
- The desired LANDroid shape is likely normalized: one tract geometry, many
  related owner/interest rows, and attachments linked to the specific row or
  tract they support. That would preserve the source information without
  requiring stacked duplicate polygons for day-to-day use.
- The attachment model already aligns with Phase 5 multi-document persistence.
  A future GIS import should import or link selected attachment PDFs explicitly,
  not pull every ArcGIS BLOB by default.
- ArcGIS REST sync, automated spatial joins, OCR/AI extraction, and automatic
  title updates should remain separate scoped projects.

## ArcGIS Review Scope

The next checker can safely add Arc planning notes, field maps, or a canonical
layer shortlist. That review should stay design-only unless explicitly scoped
otherwise.

Good review outputs:

- Canonical layer map for federal leases, private leases, unleased federal
  tracts, surveys, parcels, wells, and development-planning context.
- Stable ID strategy, including which fields should map to LANDroid IDs,
  external references, or ArcGIS GlobalID/ObjectID convenience fields.
- Attribute normalization notes for acres, interest, royalty, lease dates,
  expiration status, tract names, lessee/lessor names, and attachment metadata.
- Attachment relationship map showing which ArcGIS attachment tables should be
  considered first and how they would map to LANDroid documents.
- Warning list for invalid geometry, missing IDs, duplicate stacked-interest
  rows, truncated shapefile fields, and mixed date/status values.

Still out of scope without a separate ask:

- Copying raw GIS packages into the repo.
- Bulk importing BLOB attachments.
- ArcGIS REST synchronization.
- Federal/private math.
- OCR/AI extraction.
- Automatic title updates from GIS or documents.
