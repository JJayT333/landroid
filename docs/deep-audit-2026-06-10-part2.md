# LANDroid Deep Audit, Part 2 — Secondary Surfaces (2026-06-10)

Companion to `docs/deep-audit-2026-06-10.md` (Part 1: math, precision, ledger,
documents, AI, security). Part 2 covers the surfaces Part 1 deliberately
skipped: Research, Curative, Flowchart/canvas, Maps/GIS, Federal Leasing, and
the RRC decoders — plus direction plans for the operator's stated goals
(Miro-class flowchart, ArcGIS Pro interchange, BLM-heavy 60k-acre project, RRC
dataset ingestion). Method as Part 1: six scoped full-read sweeps; High
findings spot-verified by direct read (`[V]`); finding IDs are `DA2-*`.
Severity calibration note: these are reference/visualization surfaces, not the
math/ledger core — a "High" here means "blocks the area's stated purpose,"
not "wrong payout decimals."

One cross-cutting verdict up front: every secondary area repeats the same
pattern — a well-designed type-level seam exists, and nothing consumes it.
Research has the catalog-shaped records but no importer; Curative has the
spine record with `sourceCitationIds` but no opinion/instrument links live;
the canvas has a finished shape-node component no tool can create; Maps has
the ArcGIS `ExternalRef` contract nothing reads; Federal has `mlrsSerial` but
its rich fields live in a non-persisted demo Map; RRC has a generalizable
fixed-width engine wired to exactly three families. The work ahead is mostly
*connecting built seams*, not inventing new architecture.

---

## 1. Research workspace

Verdict: structurally ready to become the home of the title-math law catalog;
operationally not ready to receive it. CRUD, scoping, write-fencing,
`.landroid` round-trip with link sanitation, and the formula-starter batch
pattern are solid. The gaps are write-integrity and evidence links.

- **DA2-R1 (High) — Optimistic updates with no rollback.** Every `update*`
  mutates Zustand first, then awaits the Dexie save with no catch
  (`research-store.ts:134-150` and siblings); inline edits are `void`-fired.
  A fence-lost or failed write leaves the screen showing an edit the DB never
  took — the silent-data-loss illusion, on the surface that will hold legal
  research. Fix: shared `applyPersistedUpdate` helper that reverts state and
  surfaces a banner on save failure (one pattern, five stores' worth of call
  sites in this file).
- **DA2-R2 (High) — No document link on research records.** Sources can only
  attach evidence via `links.importId` (an RRC staging blob); there is no
  `docId` to the document registry even though the registry has a research
  area label (`document-registry.ts:18,35`) and the vault already ingests
  research imports. A statute/case PDF cannot be filed properly. Fix: add
  `documentId: string | null` to `ResearchObjectLinks` (additive, normalizer
  defaults null), write `entityKind: 'research'` attachments (the enum exists,
  `types/document.ts:51-58`).
- **DA2-R3 (Medium) — One-way link rot.** Deleting owners/leases/nodes/maps
  never clears research `links.*` (cleanup exists only research→research and
  on import). Mirror of Part 1's cascade pattern: add research unlink calls to
  the same store cascade sites that already clear curative/map links
  (`workspace-store.ts:792-807,1187-1215`; `owner-store.ts:195-247`).
- **DA2-R4 (Medium) — Reverse map→research pointers never sanitized**
  (`mapAssets.researchSourceId/...ProjectRecordId` unvalidated on import,
  uncleaned on delete).
- **DA2-R5 (Medium) — Catalog-readiness schema gaps.** For the TXM corpus:
  no stable human-readable ID field, no authority-year, status enum lacks the
  SETTLED/SPLIT/FACT-SPECIFIC distinction, no temporal-applicability fields,
  no source↔source interactions. All additive string fields. The import
  itself: no file-driven ingestion exists (only compiled-in batch builders) —
  a small CSV importer reusing `parseStrictInterestString`-style normalizers +
  `createBlankResearchSource/Formula/Question` + dedup-by-title (the
  formula-starter pattern, `formula-starters.ts:453-517`) is the planned
  landing path for `docs/title-math-research-supplement.md`'s three CSVs.
- DA2-R6 (Low-Med) global search filters the dataset catalog invisibly;
  DA2-R7 (Low) review-queue count/filter mismatch for questions; DA2-R8 (Low)
  per-render option-array rebuild → O(n·links) re-search per keystroke (will
  bite at catalog scale); DA2-R9 (Low-Med) staged RRC blobs ride `.landroid`
  as base64 toward the 500MB cap with no warning; DA2-R10 (Medium) questions
  cannot link to app objects (no `ResearchObjectLinks` on `ResearchQuestion`)
  and no link navigates anywhere — dead-end for the attorney-question workflow
  the catalog will create; DA2-R11 (Low) ResearchView is 3,326 lines.

## 2. Curative

Verdict: a competent personal issue tickler; structurally unable to express
professional curative practice, and invisible to every output that matters.
Scoping/fencing/import-sanitation are clean (verified).

- **DA2-C1 (High, structural) — The model cannot represent a title
  requirement.** No opinion/examiner entity; `sourceDocNo` is free text, not a
  document link; one tract/node/owner/lease per issue (no multi-scope; the
  spine record's `affectedRecordIds` array shows the intended shape); no link
  from issue → curing instrument(s) → evidence documents — `resolutionNotes`
  placeholder literally says "what document cured it" and is prose. Fix
  sketch (additive): `requirementNo: string`, `opinionDocId: string | null`,
  `affectedDeskMapIds: string[]` (keep singular fields as legacy),
  `curativeDocIds: string[]`; write `entityKind: 'curative'` document
  attachments (enum exists, never written).
- **DA2-C2 (High, integration) — Open Critical issues hold nothing.**
  Transfer-order hold reasons derive only from unit-assignment warnings
  (`leasehold-summary.ts:1652-1664`); no Desk Map badge on affected nodes; the
  runsheet ignores curative. The view's own footer promises "payout
  readiness." Fix: extend `buildLeaseholdTransferOrderHoldReasons` to count
  open Critical/High issues whose `affectedDeskMapId` is in the focused unit
  (pure function, golden-safe — new hold reason, no decimal change), and add
  a warning-dot input to the existing Desk Map dot derivation.
- **DA2-C3 (Medium) — No way out.** The only curative-bearing exports
  (`buildOpinionDraft`, attorney-packet `unresolvedIssues`) are dead code; no
  printable requirement list exists. The Audit-Sheet-export pattern (render
  `FormulaContent`-style blocks to print HTML) is the cheap path to a
  curative report.
- **DA2-C4 (Medium) — Silent edit loss + stale-form resurrection.** Unsaved
  form edits are discarded on selection/filter change with no dirty check
  (`CurativeView.tsx:414-431`), and a form held open across an external change
  (AI deleteNode → unlinkNode) re-writes the stale link on Save. Fix: dirty
  guard + merge-on-save of link fields.
- DA2-C5 (Medium) unlink cascades are fire-and-forget with no catch inside a
  reducer (`curative-store.ts:137-186`) — memory/DB divergence on fence loss;
  DA2-C6 (Medium) curative writes emit no audit events while the action layer
  already declares `curative.create/update/resolve` command kinds — the risk
  ledger has no tamper-evident history; DA2-C7 (Medium, latent) spine adapter
  drops `sourceDocNo`/`responsibleParty`; DA2-C8 (Low) Save can wedge
  (`setSaving(true)` with no try/finally); DA2-C9 (Low) `+ New Issue`
  persists blanks immediately; DA2-C10 (Low) hardcoded "Company readiness
  list" marketing block inside the detail panel.

## 3. Flowchart / canvas

Verdict: the Miro ambition is closer than expected — the data model is
already element-kind agnostic (store holds raw React Flow nodes/edges; undo,
selection, autosave, `.landroid` all generalize), a complete shape-node
component ships dead, and React Flow v12.10 has the needed primitives unused.
The print pipeline is the one true constraint: a parallel hand-rolled
renderer that only knows ownership cards.

- **DA2-F1 (High) [V] — Drawing tools are dead UI.** Toolbar offers
  rect/round/ellipse/diamond/note tools; `ShapeNode.tsx` is fully built and
  registered; `addNodes` has zero call sites (verified) and no pane-click
  handler exists. Selecting a tool highlights a button and does nothing.
- **DA2-F2 (Medium) — Select-tool lasso can never trigger** —
  `panOnDrag={!resizeMode}` neutralizes `selectionOnDrag` (RF semantics
  verified in the installed bundle). One-line fix: `panOnDrag={[1,2]}` while
  the select tool is active (Miro-style: left-drag lasso, middle/right pan).
- **DA2-F3 (Medium) — Re-import wipes annotations.** `importGraph` replaces
  the whole canvas while `applySpacingFactors` deliberately preserves
  non-ownership nodes — contradictory policies; the moment F1 is fixed,
  re-import destroys user drawings. Fix: merge-import (replace ownership
  nodes/edges by id, preserve other kinds), matching the spacing path.
- **DA2-F4 (Medium) — Print breaks for any non-ownership node.** PrintOverlay
  force-casts all nodes to `OwnershipNodeData` and would print bogus cards
  for shapes. Fix with F1: a print renderer registry keyed by node type
  (ownership card, shape, text), and longer-term unify the duplicated
  screen/print card markup (colors are maintained twice today, hardcoded hex
  in print).
- DA2-F5 (Low-Med) ELK's x-output discarded — RT layout always runs too, ELK
  contributes only depth×gap y-coordinates obtainable in O(n); either trust
  ELK fully or drop it (the operator's giant printable trees pay double
  layout for nothing). DA2-F6 (Medium) persisted node arrays are unvalidated
  on load — one corrupt entry bricks the canvas; add per-element shape checks
  and strip transient RF fields (`selected/dragging/measured`) before save.
  DA2-F7 (Low) viewport persisted but never restored (`defaultViewport`
  unused — context lost every visit). DA2-F8 (Low) selection toggles queue
  full-canvas IndexedDB rewrites. DA2-F9 (Low-Med) ResizeOverlay scale-floor
  clamp divergence can desync positions from card sizes. DA2-F10 (Low) print
  fidelity edges: `@page margin:0` vs printer hardware margins, fixed-height
  print cards vs min-height screen cards, background-graphics dependency.
  DA2-F11 (info) growth blockers inventory: fixed 288×160 card footprint,
  chart scale inferred from first node, no z-order facility, gridSize setter
  missing, ≤26 page rows.

### Miro-direction plan (staged, print-safe)

- **F-Phase 1 (days, mostly wiring):** pane-click shape creation (F1) +
  lasso fix (F2) + merge-import (F3) + viewport restore (F7) + PNG export
  (React Flow's documented `getNodesBounds`/`getViewportForBounds` +
  html-to-image recipe — one new dev-dep) + Delete-key guard polish.
- **F-Phase 2:** print-renderer registry for shapes/text (F4) + edge labels
  (`EdgeLabelRenderer`) + copy/paste/duplicate + bring-front/send-back
  (per-node `zIndex`) + per-node resize for ownership cards (NodeResizer is
  already imported in ShapeNode) + `NodeToolbar` quick actions.
- **F-Phase 3:** frames/groups via `parentId`+`extent:'parent'` (map frames
  to print pages — the natural evolution of the page grid), image nodes
  (blob-backed, content-hashed through the document vault, not a new silo),
  alignment guides, `onlyRenderVisibleElements` for 1k+ node trees,
  templates (title-tree exhibit, unit exhibit).
- Explicitly out: real-time multiplayer, freehand ink. The multi-page
  printable-giant-tree system is a genuine differentiator Miro doesn't have —
  every phase above must keep `print-overlay.test.tsx` green and add a print
  golden per new element kind.

## 4. Maps / ArcGIS

Verdict: presentation-map binder today; the ArcGIS seam is designed but
unwired. Regions are image-fraction rectangles (no CRS anywhere); GeoJSON is
an opaque blob with a display summary; no export of any kind; map assets are
the only blob store with no content hashes. Meanwhile `ExternalRef` already
encodes the exactly-right GlobalID↔UUID identity rule, and
`docs/gis-data-catalog.md` already inventories the real target: the Raven
Forest package — 134 layers, EPSG:3664/2277 ftUS, `PrivateLeases_Export`
(466 features, 205 PDF attachments ≈2.9GB), federal lease + unleased-federal
tract layers, with documented pitfalls (stacked one-row-per-interest
polygons, truncated DBF names, `HBP` in date fields).

- **DA2-M1 (High, direction) — Your instinct is right: ArcGIS should not be
  document storage, and LANDroid isn't ready to take the job either.** The
  2.9GB of layer-attached lease PDFs belong in the vault (hashed, deduped,
  linked) — but map assets carry no `contentHash` (verified
  `evidence-vault.ts:397` projects null) and Part 1's DA-H6/H7 export/fixity
  holes apply. Sequencing: vault fixes first (Part 1 Top-5 #4), then hash map
  assets (DA2-M2), then bulk-import the ArcGIS attachments as registry
  documents linked to tracts.
- **DA2-M2 (Medium) — Add `contentHash`/`byteLength` to MapAsset** (compute
  on save like `saveDoc`; one-time backfill) — enables dedup against the
  registry and closes the dual-home ambiguity (`'gis_map_support'` registry
  area vs unhashed map asset for the same plat).
- **DA2-M3 (Medium) — Interchange increment 1 (export-only, no GIS dep):**
  per-tract CSV/GeoJSON-attributes export keyed `LAND_TRACT_ID` (DeskMap
  `tractId`/`code`) carrying tract status + ownership/leased decimals, for
  joining onto his polygons in ArcGIS Pro. This is a projection like the
  runsheet CSV — small, golden-testable, instantly useful for coloring maps.
- **DA2-M4 (Medium) — Interchange increment 2 (import):** GeoJSON feature →
  tract matcher: parse uploaded GeoJSON (parser exists as summary code),
  match features to DeskMaps by tract code/name with a review list, store
  `ExternalRef{globalId, layerName}` on the DeskMap (`externalRefs` field
  already exists, nothing writes it), and warn on the catalog's known traps
  (duplicate stacked polygons → one tract, many interest rows). CRS handling:
  store coordinates verbatim + the declared CRS string; LANDroid renders
  nothing geographic yet, so no projection math is needed for either
  increment.
- DA2-M5 (Medium) orphan regions/references survive import unvalidated
  (`assetId` never checked against imported assets — invisible, undeletable,
  exported forever); DA2-M6 (Low-Med) deleting research records leaves
  dangling map→research pointers (mirror of DA2-R4); DA2-M7 (Low) map
  hydration can throw a write-fence error in a read-only tab
  (`persistFeaturedFlags` during `setWorkspace`); DA2-M8 (Medium, perf) full
  pretty-printed GeoJSON rendered into the DOM (20MB cap → ~40-60MB text
  node); DA2-M9 (Low) featured-flag persistence is O(N²) on multi-upload and
  only the last file's metadata modal survives; DA2-M10 (Low) region geometry
  form accepts garbage silently (NaN→0 snap, region becomes unclickable);
  DA2-M11 (info) `rect.page` dead → PDF maps can't carry regions (the
  operator's maps are mostly PDFs; regions require PNG re-exports today).

## 5. Federal Leasing

Verdict: honest, well-isolated, thin. Isolation verified at six independent
layers (jurisdiction discriminator → coverage gate → MathInputView
precondition → AttachLeaseModal block → store backstop → AI tool/preview
blocks), each cited and tested — the Texas-math boundary holds, and the
docs about this area are accurate. As a 60k-acre BLM register: 2 of 10
needed capabilities exist, 4 partial, 4 missing.

- **DA2-FED1 (High) [V] — The rich federal fields are demo-only and
  volatile.** Royalty/bonus/rental/stipulations live on `FederalLeaseDocument`
  in a module-level in-memory Map (verified `federal-lease-seed.ts:254`),
  populated only by the demo seed, not persisted, not user-creatable; "View
  Lease Document" is permanently disabled for real records and goes dead for
  seeded ones after reload. Fix: promote `FederalLeaseDocument` to a persisted
  side-store row (or fold its fields onto `ResearchProjectRecord`), with the
  reference-only banner intact.
- **DA2-FED2 (High, use-case) — No stipulations entry anywhere** — the
  single most load-bearing field for BLM work; the modal renders them
  read-only from the seed. Include in FED1's fix as `stipulations: string[]`
  plus a free-text COA notes field.
- **DA2-FED3 (Medium) — No structure for the program-level objects:** no
  lease↔Unit/CA membership link (the 'Unit / CA' record type is a standalone
  card), no rental-deadline schedule (one `nextAction`+date per record), no
  sale/EOI tracking, no assignment chain, no bond fields. These are reference
  fields, not math — safe to add ahead of the Phase 2 gate.
- DA2-FED4 (Medium) three overlapping serial fields, no format validation
  (NMNM…/TXNM…), no dedupe — weak for a serial register; DA2-FED5 (Low-Med)
  `normalizeLeaseJurisdiction` throws on unknown values, so one corrupted
  lease jurisdiction aborts a whole `.landroid` import instead of
  quarantining the record (every other normalizer coerces; fail-closed is
  right, whole-file abort is not); DA2-FED6 (Low) jurisdiction freely
  editable in ResearchView silently removes records from the federal
  register; DA2-FED7 (Low) expiration buckets frozen at view mount
  (`new Date()` in mount-memo); DA2-FED8 (Medium) zero component tests on the
  1,091-line view; DA2-FED9 (info) demo data is Texas-flavored "federal" —
  no NM/BLM-realistic exemplar for the operator's actual program.

### Federal direction (answering "not sure what to do with it")

Keep it. The decision that matters is what it is FOR in each horizon:
- **Now (reference register, no gate needed):** DA2-FED1/2/3 — persist the
  lease-document fields, stipulations, rental schedule with tickler dates
  (reuse the expiration-bucket machinery), lease↔CA membership links, serial
  validation, an NM-realistic seed. This makes it the working register for
  the 60k-acre program's land side — all strings and dates, zero math.
- **Phase 2 design (when the gate opens):** the math contract is now
  precisely known from the use case — CA tract-participation factors,
  post-IRA royalty by lease vintage, fed/fee allocation along laterals
  (the research supplement's Addition 1 items 3-5 produce the worked
  examples that become its golden fixtures). Design doc first, anchored on
  the real CA documents from the project, exactly like the Texas engine was
  anchored on Springhill.
- **Wells:** the lateral-allocation use case eventually needs wellbore
  records (surface/bottom hole, lateral path) — that's rebuild-plan Phase 6,
  and it's also the natural join to RRC well data and the ArcGIS well layers.
  Don't build early; note the convergence.

## 6. RRC decoders

Verdict: a sound seed, three families deep, honestly labeled. The fixed-width
engine (1-indexed spec slices, record-id dispatch, warnings) and the
`}`-delimited parser are exactly the right shape for a manifest registry; the
catalog (36 entries with status labels) is the registry spine. Nothing
decodes EBCDIC or .dbf; everything is preview-only, main-thread, ≤25MB.

- **DA2-X1 (High, trust) — Layout tests are self-referential.** Fixtures are
  built from the spec's own offsets, so a transposed field map passes every
  test; no real RRC excerpt exists in the repo. Fix before widening coverage:
  for each decoded family, check in a small real-file excerpt (public data)
  with hand-verified expected values — the RRC equivalent of golden masters.
- **DA2-X2 (Medium) — 25MB de-facto cap** on RRC text via the
  `limitForExtension` fallback labeled "file" with a PDF-sized number; real
  master/statewide files are 10x+. DA2-X3 (Medium) numeric helpers strip
  signs/overpunch silently (`replace(/[^\d]/g,'')`) and the coordinate
  decoder hardcodes a 5/7 digit split + forced negative longitude — wrong
  answers instead of failures if assumptions miss. DA2-X4 (Medium) `'Preview
  Ready'` conflates "structured decoder live" with "browser can display it"
  (CSV actually has no table preview at all — the `}`-splitter can't parse
  commas). DA2-X5 (Low-Med) over-length lines never warn (layout drift to the
  right is invisible; no record-length assertion against the documented 510).
  DA2-X6 (Low) horizontal decoder treats any non-blank line as a permit row;
  header heuristic can swallow an all-caps data row; duplicate-key policy
  inconsistent between families (drop vs merge); dead `.ebc` detection branch
  (extension not uploadable).

### RRC ingestion plan (answering "can you read all the datasets?")

Yes — every format on the RRC download page is decodable in this stack, and
the page inventory maps to five engineering tiers:

1. **ASCII fixed-width** (drilling permits incl. nightly lat/long file,
   completions, wellbore query, field tables, P5 ASCII, UIC ASCII, high-cost
   gas): the existing engine handles these today; work = layout manifests per
   family + real-excerpt goldens (DA2-X1) + the size lane below.
2. **CSV/JSON** (production query dump, pending-lease production, ST-1, P-18,
   R3): trivial parsing (PapaParse is already a dependency); work = same
   manifest/golden pattern. Fix DA2-X4's missing CSV preview first.
3. **dBase .dbf** (statewide API data): small well-specified binary format —
   a ~200-line TS parser (header + field descriptors + records), no
   dependency needed; reads `ArrayBuffer`, not text.
4. **EBCDIC fixed-length** (production ledgers per district, P-4, P-5, full
   wellbore, well databases, statewide files, UIC): needs three pieces the
   repo lacks — a CP037/CP500 byte→char table (~256-entry array), byte-count
   record framing (no newlines in tape format — the current line-splitter
   cannot frame them), and zoned/packed-decimal numeric decoding (overpunch
   signs — DA2-X3's helpers must not touch these). All pure TS, no deps;
   the published RRC record layouts become the manifests.
5. **Shapefiles** (county well/survey/pipeline layers, twice-weekly): do NOT
   write a .shp parser — route through the Maps/GIS lane (DA2-M4) as
   GeoJSON (converted in ArcGIS Pro, which the operator already runs) and
   join RRC wells to tracts there.

Cross-cutting size lane (one design, all tiers): raise the cap for RRC
formats, parse via `blob.stream()` + chunked line/record framing in a Web
Worker, aggregate results incrementally, and persist decoded rows (typed,
per dataset family) instead of recompute-per-view — which also unlocks
"promote decoded permits to Research project records / map joins," the
actual point of ingestion. Sequence the families by workflow value, per the
existing roadmap rule ("workflow-proven file families"): nightly permits
w/ lat-long → production query dump (CSV) → statewide API (.dbf) → P-5/P-4
organization (EBCDIC pilot) → district production ledgers.

---

## Does Part 2 change Part 1's priorities?

No re-ordering of the Top 5 — the math/ledger/evidence core still outranks
everything here. Three additions to the plan:

1. The **Research hardening pair (DA2-R1 + DA2-R2)** must land before the
   title-math catalog import does — it is the receiving surface. Slot it
   into the "Now" lane right behind the precision work; it is small.
2. **Curative holds (DA2-C2)** joins the existing leasehold-warning family —
   cheap, golden-safe, and it makes the curative area mean something to the
   payout workflow. The structural upgrade (DA2-C1) is a design-first item.
3. The **flowchart F-Phase 1 wiring** is days of work for the most visible
   capability jump in the app (the components are already built); it can run
   as a Codex lane parallel to the math work without touching math files.

Everything else (GIS increments, RRC tiers, federal register fields) enters
"Next" as staged lanes with the same rule as the math: design note → ticket
→ fixture → review.
