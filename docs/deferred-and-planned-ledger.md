# LANDroid — Master Deferred + Planned Ledger
*Generated 2026-06-26 · main @ 65c9243*

> ## ⚠️ STATUS CORRECTION (2026-06-26)
> The per-item **status** below OVER-STATES openness. This ledger was mined from the
> raw deep-audit reports (DA-*/DA2-*) and weighted them over the reconciled
> `docs/audit-backlog.md`, so several already-shipped items read as "Open."
> **For accurate status, defer to `docs/audit-backlog.md` — that file is the source
> of truth.** A code re-verification of the HIGH-severity shortlist found ~8 of 11
> already shipped:
> - **Verified shipped, do NOT re-fix:** DA-H2, DA-H3, DA-H4/H5 (#185 — only the
>   `lastFlushedHeadHash` truncate-to-legacy pin remains), LLA-H04, the DA-M14
>   write-lock heartbeat, the federal `stipulations` field, the DA-M1
>   over-conveyance warning, ACT-H01.
> - **Genuinely open from that list:** DA-M2/LLA-H03 (raw `addNode` skips
>   `validateCalcGraph`), federal-lease-term persistence (in-memory `Map`),
>   DEF-AI-01 (`CitationVerifier` not wired through the answer UI), the dbKey legacy
>   migration, the DA-M1 generic-clamp residual, and `lastFlushedHeadHash`.
>
> The breadth here (memories, roadmap, ideas, code-TODOs) is still useful for
> discovery; just cross-check the backlog before trusting any status.

## How to read this
This is the deduplicated, area-organized backlog mined from every memory file, ROADMAP, IDEAS, rebuild-plan, ADRs, the two deep-audit reports + part 2, the feature-interaction map, the archived audits, and in-code TODO hooks. Each open item carries its **kind**, severity (H/M/L where the source rated it), all ref IDs (DA-*, DA2-*, LLA-*, ACT-*, P*-*, F*, Phase gates, PR#s), and a tight why-deferred. Items confirmed landed against the shipped reference are pulled out into **Already Shipped** at the bottom and struck through — when a ref ID's status conflicted across sources, it stays **Open** and the conflict is flagged. Use the DO-NOT-RE-PROPOSE box first; it lists decisions already made so the audit doesn't relitigate them.

**Counts:** ~210 distinct open items. By area (open): Title-math ~48 · Ledger/Audit ~34 · Documents ~30 · AI ~28 · Persistence/Storage ~26 · Maps ~22 · Research ~20 · Federal ~14 · Curative ~10 · Leasehold ~7 · Backend-spine ~12 · Infra/Deploy ~12 · Docs ~9 · Demo-polish ~8. **Shipped & retired:** ~70 items across DA-H1/H4/H5/H6/H7/H9/H10, DA-M1/M2/M3/M5/M7/M10/M11/M12/M16, DA-L6/L7/L8, DA2-M/C/R1, and the lease-instrument model (#180, #185, #200–223 range).

---

> ## ⛔ DO NOT RE-PROPOSE — deliberate operator decisions
> These are settled. Do not spend audit time re-litigating them.
> - **Research-imports metadata-first conversion = "bloat"** — owner+map done (#88/#89); research conversion deferred, low ROI / high risk (3 RRC decode pipelines). `DEF-SHARD-01`
> - **Duplicate genesis ledger NOT copied on project-duplicate** — operator ratified "ledger-not-copied"; copies canvas+GeoJSON only. **Shipped #204/#210.** Don't re-propose carry-history.
> - **Lease duplicate-records: "Full model fix" chosen** — collapse dup records + fix Springhill generator + fix AttachLeaseModal all **SHIPPED #220/#221/#222** (+ display collapse #211/#212).
> - **Demo renamed to Vulcan Mesa** — resolved sharing-gate; stray "Crackbaby" refs in old docs = cleanup not a gate. Do not re-flag.
> - **Over-100% / multi-root coverage allowed as working "Title Theory"** — warn-don't-cap is policy; gates block computation, not saving. Any fix must warn, never hard-block. `LLA-H03`/`DA-M2`
> - **No speculative .landroid migration layer for LPR** — normalize-on-load is the chosen mechanism. Don't build a versioned migrator.
> - **SSN/TIN deferred out of LPR** — zero SSN/TIN fields exist by design; future separate tax-packet/privacy workstream only. Only cleanup = fix the misleading comment. `DA-L9`
> - **DA-H1 fixed-NPRI excess rule + Van Dyke double-fraction presumption = counsel-APPROVED 2026-06-15** — reliance permitted. **Shipped #180/#182.** Don't re-open as "pending sign-off."
> - **Federal/private/tribal math = reference-only until explicit Phase 2 gate** — `ADR-0002`. Tribal math out of scope unless requested.
> - **GIS: raw packages stay local-only/uncommitted; no bulk BLOB import, no ArcGIS REST sync, no auto-title-updates** — each needs a separate explicit ask.
> - **DA-U6 positive findings to PRESERVE through refactors** (conservation-checked ops, strict-parse warning sinks, named clamps, full-precision toString, approval-gating-by-construction, counts-only hosted context). Guidance, not an action item.
> - **ACT-H01 already fixed** (ensureTitleBaseline) — inherited summaries twice over-stated its openness. Verify before building on it.

---

## Title-math
| Item | Kind / Sev | Refs | Detail · why-deferred |
|---|---|---|---|
| Silent over-conveyance fraction cap hides Duhig | deferred-finding **M** | DA-M1, C1, #167 | `calculateShare` Decimal.min cap silently rewrites over-conveyance instead of stop-and-ask. **Partial:** over-100% warned in coverage card (#167) but the fraction-mode silent cap itself is still unsurfaced. |
| Add Root / updateNode bypass engine validation | deferred-finding **M** | DA-M2, LLA-H03, C2 | Raw `addNode` admits negative fractions, dup ids, cycles — journaled as invalid. #167 added Add-Root warning but structural invalids (negative/dup/cycle) still not stopped; route through `createRootNode`. |
| NPRI "unratified" → tract-basis payout math (held, not computed) | human-gated **M** | DA-M5 | Tri-state shipped as transfer-order HOLD (#180); the actual tract-basis production-payout math deferred pending counsel per-instrument. Default "unknown". |
| Fixed-NPRI excess rule rests on treatise consensus, not statute | product-decision | DA-H1 | Excess-to-WI is counsel-approved on Smith & Weaver, not on-point SCOTX; Springhill TR2 is the live test. A reversal/cap-at-0 instruction would re-gate all three layers. Watch, don't rebuild. |
| Stacked fixed NPRIs senior-first ordering — flag if it matters | code-todo | DA-H1 | Ordered senior-first by instrument date; surface only if ordering ever materially changes a result. |
| Texas-math completeness gap matrix — staged 11-scenario build order | phase-gate | DEF-TXMATH-01, DA-M1, DA-M5 | Order: Duhig/silent-cap → double-fraction → ratification flag → unleased co-tenant → DO rounding → probate/estate → depth/term → WI/JOA. Each behind new goldens; most rows wait for real units. |
| Double-fraction: never auto-multiply antique fractions (Van Dyke) | research-followup | TXM-002 | Capture verbatim clause, compute BOTH readings, stop-and-ask. **Engine-level shipped #180**; remaining = broader intake-flag wiring + chosenBasis cascade (below). |
| Van Dyke chosenBasis captured at entry, no cascade | deferred-finding | TXM-002 | Stored on node, never re-derived; changing it later leaves siblings/descendants on old basis. Relies on user vigilance. |
| Duhig / warranty-shortfall suggested-correction card | planned **M** | DA-M1 | Per-branch shortfall math → suggested (never auto) Duhig allocation card. Needs DA-M1 silent-cap fix first. |
| Unleased mineral owner cost-bearing payout row | planned **S-M** | TXM-028 | Add `unleased_mineral` row (unitParticipation × unleasedFraction) so unit-focus sheet proves to 1.0. |
| DO rounding-profile on the unit (transfer-order projection only) | planned **S** | TXM-019 | Per-company decimals/round-half-up vs truncate/balance-to-whom, applied at projection only, never stored. 8-decimal industry DOI. |
| Probate/estate vectors: estate-split macro-op + life-estate node class | planned **L** | DA-M5 | High value for heirship-heavy work; estate-split expands to N per-stirpes conveyances; life estate = new InterestClass. Own design gate + goldens. |
| Depth severance / term & defeasible (Phase 8) | phase-gate / planned **L** | Phase 8, CL-09, DA-M5 | `DepthRange` union is `'all_depths'` stub only; every math entry asserts it. Hard guardrail: touching engine/leasehold/coverage beyond a comment → split into dedicated Phase 8. |
| WI flow-through: assignment chains as a tree; JOA deferred | planned **L** | — | Single-level WI today; make assignments a tree like title. JOA/carries/BIAPO stay out until a real use case. Blocks operator-side DOI. |
| Severed executive rights / NPRI consent | planned **S** | — | Owner-level flag + curative template; affects who can lease, not decimals. (row 10) |
| Reconcile coverage inclusion vs engine root-total guard on 'unlinked' | deferred-finding **M** | DA-M8 | coverage counts any positive non-NPRI node; engine excludes `parentId==='unlinked'`. Adopt engine exclusion, surface "Unattached" line; regen coverage goldens. |
| `isTitleCountedNode` hardcodes `parentId !== 'unlinked'` | deferred-finding | DA-M8 | Sentinel shared across two layers; DA-M8 unified them but future paths could re-diverge. |
| Jurisdiction isolation bypassable by direct store reads | deferred-finding | — | `buildJurisdictionIsolationPrecondition` gates only the projection; any direct `store.nodes` consumer leaks non-Texas leases into display. |
| ORRI/lease ordering tuples vulnerable to date/timestamp backfills | deferred-finding | — | `dateText||'9999-12-31'` and effectiveDate→createdAt fallbacks; a future date-backfill silently changes burden stack / allocation order. Suggest system-stable lease ID first in tuple. |
| Floating-NPRI over-carve warning is owner-level not slice-level | idea | — | `overFloatingNpriBurdened` set per-slice but surfaced per-owner; slice-level would break summary shape. |
| Per-tract acreage display-only; future pooling math may need sync | idea | #221 | `leaseTractGrossAcres` never read by math; tight sync only if per-tract pooling math is built. |
| `leaseTractLeasedInterest` override not nullified when cleared | code-todo | #221 | Stale value can persist (byte-identity preserved); needs explicit storage-side nullification. |
| `rootOwnershipTotal` dead + misleading comment | deferred-finding **L** | DA-L1 | No prod caller; comment describes initialFraction but sums remaining. Delete or fix; live twin is `calcRootMineralTotal`. |
| `toCalc`/`d()` silently coerce malformed fractions to 0 | deferred-finding **L** | DA-L2 | Corrupted Dexie row → silent zero in math. Use strict parse + surface a validation issue (defense-in-depth). |
| `normalizeInterestString` must never gate a save (comment-only guard) | deferred-finding / code-todo | DA-U5, DA-L2, #170 | Lenient parser+serialize coerces garbage→0. #170 added doc-comment only; no structural guard against a future save path adopting it. |
| `validateCalcGraph` doesn't enforce root total ≤ 1 | product-decision **L** | L-5 | Intentional ("do not worsen", not "must be ≤1"); imports can leave 1.5-total. Worth a coverage warning when total>1. |
| `parseStrictInterestString` returns 0 for empty/null | deferred-finding **L** | L-4 | By design ("no value yet"); stricter branching between missing-key vs explicit-empty is optional polish. |
| Degenerate `oldRootInitial = max(...,1e-9)` edge hardening | deferred-finding **L** | — | Downstream validation catches it; clearer precondition wanted, not a blocker. |
| Title-opinion-as-root / SourceAttestation feature | idea / planned | rebuild-plan:395-455, DEF-REC-01, Phase 5 | Project-start step asking where the chain begins (patent/opinion/DO/probate/prior-chain). Lets pre-start reserved NPRIs sit as sibling burdens off the root. Designed, not built. |
| Depth-severance / multi-formation title model | idea | — | What the unified-engine rewrite was designed to enable; feature itself not built. |
| Math Engine Revisit (parked design-pass set) | parked | — | NMA+DI first-class outputs, pooled-unit allocation, substance severance, depth severance, term/defeasible/life-estate, probate cascade, estate-vector decomposition, recording-date/priority, Hysaw/Luckel/Bath flags, Spanish/Mexican grant pack, vacancy/gap/strip-and-gore markers, deeds-as-reversible-source, WI flow-through, JOA. All parked for a dedicated design pass = rebuild **Phase 7** (14-item order). |
| Texas-math expansion Wave 5 / Phase 7 | phase-gate | DEF-TXMATH-01, Phase 7 | Has human-decision gates; one design pass then one golden-mastered slice at a time. |
| B+C internal-cleanliness pass (firewall allocatedFraction / make-live) | deferred-finding | DA-M1 | Stage B 9dp shipped; B0 firewall, C1 byte-identical graph-share, C2 round-trip removal spec'd but low-value/review-bloating. |
| C2 round-trip removal + Stage G shim teardown | deferred-finding | — | **Stage G shim teardown SHIPPED #183**; C2 cosmetic removal + C1 graph-share remain deferred (moot perf, Stage D 42.8ms ≪ 100ms gate). |
| Real main-frozen oracle + confined-divergence + over-conveyance fixtures | deferred-finding | #180 | Differential is now self-consistency lock (green ≠ correctness proof); optional hardening, anchors delivered in springhill-sample.test.ts instead. |
| Confidence/source statuses for nodes (Working Theory/Verified/Conflict…) | idea | — | Manual source labels (clerk/appraisal/court/RRC/heirship-clue). Do NOT add clerk/court integrations yet. |
| Dual decimal+fraction display for calculated values | product-decision | — | Edit popup shows decimal+fraction; calculated remaining/card values are fraction-only. Small polish after verify. |
| Title Theory concept — visual iterative working title model | product-decision | LLA-H03 | Represent unresolved/conflicting facts without pretending final; warn/red/blocked-from-reliance. Informs LLA-H03 handling. |
| `setActiveDeskMap` hosted read-only leak (autosaved focus mutation) | deferred-finding **P1** | F2 | Excluded from MUTATING set yet writes `activeDeskMapId`+autosaves with no undo-snapshot. Treat as mutating in hosted or move focus to non-persisted UI state. |
| Strict input boundaries: jurisdiction/decimal correctness holes | deferred-finding **P0** | MAIN_READINESS | Explicit-unknown jurisdiction → `tx_fee`; bad decimals → 0 via `d()`. Bad imports become plausible Texas math instead of review-blocking errors. |
| Leasehold summary still uses lenient parser for royalty/ORRI/WI | deferred-finding **P2→P1** | F3, M-2 | Desk Map coverage path fixed (M-2); broader leasehold-summary lenient call sites remain → imported malformed strings silently become 0 with no warning. |
| Routing helpers gated below — see Ledger/Maps for `Add Root` validated-op (DA-M2) cross-ref. | — | — | — |

## Leasehold
| Item | Kind / Sev | Refs | Detail |
|---|---|---|---|
| Null-unit unit-wide ORRI/WI records disappear from coded units | deferred-finding **M** | LLA-M06, P1-MATH-1 | Legacy null-`unitCode` records excluded from all coded units silently. Surface as excluded-with-reason; require assignment before transfer-order reliance. |
| Focused leasehold rows can include wrong unit-wide ORRI/WI | deferred-finding | P1-MATH-1, LLA-M06 | Focused filtering includes any `scope==='unit'`; coded wrong-unit fixed, null-unit repair visibility remains. Needs failing multi-unit test. |
| Formula tooltips: pass staged intermediates + exact formatAsFraction | deferred-finding **M** | DA-M6 | Over-burdened pre-WI tooltip recomputes flat, omits clamps; `asFraction` lacks 3/6/7/12 denominators → 1/6 shows as 0.1666667. Display-only, no goldens. |
| Formula/audit-sheet tooltips = hand-rolled parallel math | deferred-finding | DA-M6, #205 | DA-M6: tooltips "lie exactly when they matter." Audit-sheet builder rewritten to mirror engine (#205); broader tooltip recompute-drift class not structurally eliminated. |
| Lease over-allocation: add explicit `topLease` flag | planned **S** | — | First-effective-wins clipping + overlap warnings are honest; flag silences intentional top leases. |
| Extract LeaseholdView (4,601 lines) + AttachLeaseModal (1,069) | deferred-finding | DA-U3, DA2-U3 | Highest-stakes, least-reviewable files; mechanical sibling extraction cuts review cost on every math PR. No behavior change. |
| Mirror: ORRI duplicate-derivation 3rd copy in LeaseholdView | deferred-finding **M** | DA-M7, DA-H9 | **DA-M7/DA-H9 ORRI fixes SHIPPED #158/#168**; verify the view-copy recompute is fully gone (depended on exposing `orriBurdenRateByTractId`). |

## Owners / Leases
| Item | Kind / Sev | Refs | Detail |
|---|---|---|---|
| "Lease Records" quick-stat drops count under unit focus | product-decision **S** | — | Counts unit-scoped not ALL owner leases; needs count-semantics decision. |
| Desk Map Lease Node per-node green buttons | human-gated | #211, #212 | `getOwnerLeaseDeskMapTargets` emits one button/owner-linked node; dedupe-to-one-per-tract vs per-node labels decision. Named bug turned out to be the whole card (#212) — possibly moot, still flagged. |
| Carry netAcres onto repointed lease nodes when per-tract acreage varies | code-todo | #221, #222 | Follow-up after AttachLeaseModal fans one record to N nodes. |
| LPR SSN/W-9 fields | parked / human-gated | DA-L9, #134 | Deferred to future tax-packet/privacy workstream; only cleanup = fix comment at lease-purchase-report.ts:17-20. |
| Invalid explicit `deskMapId` falls back to active map | deferred-finding **M** | M2, HG-9 | createRootNode places ownership in wrong tract. **Status conflict:** PATCH_PLAN Open vs 2026-04-25 remediated — re-verify. |
| Cross-project party canonical identity | parked | Phase 5 | After per-project externalPartyId hooks + review-gated dedup field-tested. |

## Maps / GIS
| Item | Kind / Sev | Refs | Detail |
|---|---|---|---|
| Flowchart drawing tools are dead UI (wire pane-click shape creation) | deferred-finding **H** | DA2-F1 | ShapeNode built+registered; `addNodes` has zero call sites. Keystone of F-Phase 1; can run as a parallel Codex lane. |
| Re-import wipes annotations once drawing tools wired | deferred-finding **M** | DA2-F3, G2 | `importGraph` replaces whole canvas while `applySpacingFactors` preserves non-ownership nodes — contradictory. Latent until F1 ships. Merge-import by id. |
| Select-tool lasso can never trigger | deferred-finding **M** | DA2-F2 | One-line: `panOnDrag={[1,2]}` while select tool active. |
| Print breaks for non-ownership nodes | deferred-finding **M** | DA2-F4, G2 | PrintOverlay force-casts all to OwnershipNodeData. Print-renderer registry keyed by node type; unify duplicated screen/print card markup. |
| Flowchart bundle F5–F11 | deferred-finding L-M | DA2-F5…F11 | ELK x discarded; unvalidated node load bricks canvas (F6); viewport not restored (F7); selection rewrites IndexedDB (F8); scale-floor desync (F9); print-fidelity edges (F10); growth blockers (F11). |
| Flowchart F-Phase 1 remainder (shape tools, lasso, merge-import, viewport restore, PNG export) | planned | #159 | Wire built-but-dead tools; confirm what's left after #159, implement only genuinely-missing pieces. Touches no math files. |
| Re-importing same GeoJSON shows every tract twice | product-decision **M** | map-store.ts:189 | New assetId per upload, no cross-asset dedup. **Likely addressed by #218 (warn-and-choose on re-import)** — verify. |
| Orphan map regions/references survive import unvalidated | deferred-finding **M** | DA2-M5, E3 | `assetId` never checked → invisible, undeletable, exported forever. |
| Bulk-import ArcGIS attachments after vault fixes | deferred-finding **H** | DA2-M1, DA-H6, DA-H7 | 2.9GB Raven Forest layer-attached PDFs belong in vault. Sequence: vault fixes → hash map assets (**M2 shipped #184**) → bulk import. |
| ArcGIS per-tract CSV/GeoJSON-attributes export | planned **M** | DA2-M3 | **SHIPPED #188** (keyed LAND_TRACT_ID) — verify scope covers status+decimals. |
| GeoJSON feature→tract matcher (import) | planned **M** | DA2-M4 | **SHIPPED #187** (ExternalRef writer + ingest UI) — RRC shapefiles route through it; confirm CRS-verbatim + duplicate-stacked-polygon warning. |
| Maps bundle M6–M11 | deferred-finding L-M | DA2-M6…M11 | Dangling map→research pointers (M6); read-only-tab write-fence throw (M7); 20MB GeoJSON DOM perf (M8); O(N²) featured-flags (M9); garbage region geometry accepted (M10); PDF maps can't carry regions (M11). |
| Plat PDF still uses old palette | code-todo | #214 | **Likely SHIPPED #217** (match plat PDF to on-screen) — verify plat-pdf.ts palette. |
| Full multi-designation tract crosswalk UI | parked | #186,#190,#191,#213,#214 | Name-per-system + label switch + export columns. ACREAGE crosswalk (#213) + aesthetic (#214) shipped; full feature PARKED until map look approved. His unit = tracts 1,22,2,3,4,4a,5. |
| Unit-plat 3D flip feature (CSS-3D, SVG GeoJSON) | idea | M5 | **Chooser SVG flip SHIPPED #190**; full center-stage flip sequenced after shell redesign; operator ambivalent (may demote to opt-in). |
| Desk Map looks empty on real demo data (fit/center) | deferred-finding **P1** | MAIN_READINESS | Auto-fit/center after load/import/tract change. (Maps lane largely landed per memory — verify.) |
| Desk Map over-100 coverage wording bug (negative missing) | deferred-finding **P1** | MAIN_READINESS | `missing = 1 - current` goes negative >100%, shows 0/1. Track missing vs excess as separate non-negative values. |
| Canvas viewport persistence across reload | deferred-finding | FC-027, Phase 0.5 | Saved in store but not persisted to IndexedDB; assigned Phase 0.5. |
| LLA-L02 warning dots infer from description text | deferred-finding **L** | LLA-L02, P2-FRONTEND-1 | Derive from shared validation/coverage helper. W1 small defects. |
| OwnershipEdge.tsx React DOM-prop console warnings | deferred-finding | — | Recorded as current behavior. |
| Automated Flowchart print visual-diff guard | deferred-finding | FC-012, CL-25 | Later hardening; manual print proof accepted Phase 0. |
| Map/research text previews read large blobs on main thread | deferred-finding **P3** | P3-PERF-3, AI20-P3-PERF-3 | Move behind workers/streaming/size-limit. |
| ELK layout cost partly discarded | deferred-finding **P3** | P3-PERF-4 | Trust ELK fully or drop from hot path. |
| Desk Map Fit ignores content-size changes | deferred-finding **P3** | P3-PERF-5 | Add content-size-aware fit triggers. |
| 3D Desk Map exploration | idea / parked | — | After 2D document/GIS traceability stable; premature today. |
| Canonical ArcGIS layer map / traverse-export design | research-followup | ARC_REVIEW_PROMPT, gis-data-catalog.md | Design-only: source layers, stable IDs, attachment tables, import priority. PrivateLeases_Export ≠ one row/tract (stacked interest rows). |
| Clean GIS geometry before spatial joins | deferred-finding | gis-data-catalog.md | Known invalid counts (merged_landparcels=25 etc.); expirations mix dates/blanks/HBP. |
| Full GIS-native shapefile/DBF parsing | parked | — | GeoJSON-first; shapefile/DBF later only if repeated real use justifies. |

## Documents
| Item | Kind / Sev | Refs | Detail |
|---|---|---|---|
| Multi-entity document attachments (export scope decision) | product-decision **H** | LLA-M04, DA2-R2, DEF-DOC-02, P2-DOCS-4, #96 | v8 export serializes node links only; export-all-workspace-scoped vs version-gate. Blocks owner/lease/curative/research/map doc attachments. Design-first. |
| Document audit events / chain-of-custody + tombstoned deletes | planned | §6 step 2 | Reuse action-layer event shape; who-did-what history. |
| Registry Upload button + dedup-on-ingest by content hash | planned | §6 step 3 | **Warn-and-choose dedup SHIPPED #195/#196** — verify Upload-button + create-time coverage; contentHash recorded but dedup consumer was dormant. |
| Three-pane Documents workflow (folders/list/preview rail) | planned | DEF-DOCUX-01, §6 step 5 | **Left view-nav rail SHIPPED #194**; full folders-tree + sortable virtualized list + persistent preview rail remains. Awaits operator reaction. |
| Bates / load-files / families / redaction | planned | — | **Bates production set SHIPPED #197**; load-files/families/redaction stay roadmap behind real need. Bates only at packet export, never originals. |
| Recompute/verify SHA-256 + full-workspace export | deferred-finding **H** | DA-H6, DA-H7, #152, #153, #155 | **All SHIPPED** (#152 export-all, #153 re-hash, #155 backfill). Residual: stale doc import-badges linger until re-export (DA-H7). |
| Document attachment scoping & detach-vs-delete semantics | deferred-finding **P1** | P2-DOCS-3, MAIN_READINESS | `DocumentAttachment` lacks workspaceId; same entity id across workspaces pollutes positions; shared-doc delete cascade-deletes all attachments. Separate detach-from-entity vs delete-everywhere. |
| Drop ignored `_legacyNodes` param from DA-H6 callers | code-todo | DA-H6, #152 | Cleanup optional, kept for call-site stability. |
| Map uploads bypass document PDF hardening | deferred-finding **P2** | P2-DOCS-2(map), HG-6 | accept-hint + size-cap only; renamed files save unsupported content. Magic-byte validation + sandboxed preview. |
| Imported blobs previewable as same-origin iframe (XSS) | deferred-finding **P0** | MAIN_READINESS | Arbitrary-MIME blob in unsandboxed iframe. **Partial:** magic-byte+sandbox landed for registry path per 05-20 audit; verify all preview paths. |
| Upload limits inconsistent (owner docs / research) | deferred-finding **P1** | MAIN_READINESS, HG-6 | OwnerDocsTab + ResearchView accept arbitrary files; reuse size/extension policy at every entry point. |
| Document OCR text extraction (registry metadata-only) | planned | Phase 7A/7D, document.ts | `ocrStatus` is a hook only; no extraction wired. |
| Document blob dedup logic (hash recorded, no consumer) | idea | ADR-0004, document.ts | `contentHash` stored for future dedup; delete-coordination problem (which entity owns blob at zero refs) is why deferred. |
| Subsume OwnerDoc into documents table | deferred-finding | ADR-0004 | Migration surface ~doubles, no current UI need. |
| Remove legacy `pdfs` table after one rollback version | code-todo | ADR-0004 | Kept read-only for rollback path. |
| Owner/lease/curative/research attachment UI (entityKind reserved) | planned | ADR-0004 | Rows write `entityKind:'node'` only this pass; kinds reserved so future UI needs no migration. |
| Node PDF attachments keyed by nodeId only (not workspaceId) | deferred-finding **P2** | F5 | Stale blobs/collisions on reused node IDs. Prereq for document-DB; Phase 5 v8 may have addressed — verify. |
| Phase 7B entity-link expansion | planned | Phase 7B | Attach docs to owners/leases/curative/research; SourceCitation[] only when first consumer needs page support. |
| Phase 7C import manifests (ArcGIS/Dropbox/folders) | planned | Phase 7C | Preview counts/sizes/dup-hashes/missing-metadata before import; selected import, not bulk BLOB. |
| Phase 7D OCR/text index | planned | Phase 7D | Status table, page text, keyword search, review queue. Auto-title-updates explicitly out of scope. |
| Phase 7E AI document query with citations | planned | Phase 7E | Read-only by default; depends on OCR index; mutation/portal workflows out of scope. |
| Packet manifest JSON-only — PDF packaging deferred | deferred-finding | Phase 7A | **Attorney-packet ZIP wired #193**; verify PDF assembly vs manifest-only. |
| Source-citation hook — no record carries citations[] | planned | Phase 5, source-citation.ts | Shape-only ride-along; future consumers (fraction-from-deed, royalty-from-page, issue-from-paragraph). |
| Import-manifest previews + persistent import ledger | planned | DEF-DOC-03, DEF-AI-03 | After vault model explicit / action-layer persistence decisions. |
| Expand entity document links beyond Desk Map nodes | planned | DEF-DOC-02, DA-H6 | Gated on full-workspace export. |
| Title-opinion-as-root / SourceAttestation workflows | planned | DEF-REC-01 | After document vault + import-session foundations reviewed. |
| OpinionDraft/ObligationCalendar/AbstractorPackage projections | planned | DEF-REC-02 | After record schema/vault/action layer explicit. |
| Dropbox integration stores externalRefs + indexes selected | idea | — | Conditional future; Dropbox as external storage not the DB. |
| eDiscovery-compatible attorney packet sidecar | idea | — | Concordance/Opticon load files, checksums, families. |
| Saved named packet selections / tokenized DMS search | idea | — | area:leasehold, party names, instrument numbers, saved filters. |
| Runsheet named ordering-mode goldens | planned | RS-019, RS-020 | global-instrument-date / global-file-date / per-tract / grouped-by-tract / manual; name goldens by mode. |
| Packet manifest named-source goldens (Filter/Selected/Runsheet) | planned | DOC-015/017/019 | Source-mode-specific manifest fixtures before export behavior changes. |
| Runsheet export legacy `TORS_Documents` naming | deferred-finding **P3** | MAIN_READINESS | Align with registry vocabulary. |
| Document export scans attachments inefficiently (O(n)) | deferred-finding **P3** | P3-PERF-2 | Workspace-scoped index + Set membership. |
| DEF-LEASE-01 lease document generator (Producers 88 reflow) | parked / deferred-finding | DEF-LEASE-01, I1 | Naive run insertion reflows .docx (no content controls). Needs structured-template / run-preserving replacement. Do NOT insert into raw runs. |

## Curative
| Item | Kind / Sev | Refs | Detail |
|---|---|---|---|
| Curative model can't represent a title requirement (structural) | deferred-finding **H** | DA2-C1 | No opinion/examiner entity; sourceDocNo free text; one tract/node/owner/lease per issue. Additive: requirementNo, opinionDocId, affectedDeskMapIds[], curativeDocIds[]. Design-first. |
| Open Critical issues hold nothing → transfer-order holds + dots | deferred-finding **H** | DA2-C2 | **Partially SHIPPED #200** (holds + Desk Map dots). Confirm coverage matches `buildLeaseholdTransferOrderHoldReasons` integration. Cheap, golden-safe. |
| No printable requirement-list export | deferred-finding **M** | DA2-C3 | **Title Requirement Report SHIPPED #201**; verify it wires the dead buildOpinionDraft/packet exports. |
| Silent edit loss + stale-form resurrection | deferred-finding **M** | DA2-C4, F3 | Unsaved edits discarded on filter change; stale form re-writes deleted link on Save. Dirty guard + merge-on-save. |
| Curative bundle C5–C10 | deferred-finding L-M | DA2-C5…C10 | Fire-and-forget cascade no-catch (C5); no audit events though command kinds exist (C6); adapter drops sourceDocNo/responsibleParty (C7); save wedge no try/finally (C8); blank persists immediately (C9); hardcoded marketing block (C10). |
| Curative upgrade Part 2 §2 (structural model + requirement report + dirty-form guard) | planned | DA2-C1/C2/C3/C4 | Sequenced Next; DA2-C remaining (opinion entity, multi-tract scope, dirty-form guard) is product-directional — wanted operator direction. |

## Research
| Item | Kind / Sev | Refs | Detail |
|---|---|---|---|
| Research optimistic updates with no rollback | deferred-finding **H** | DA2-R1 | **SHIPPED #165** (revert on persist failure). Verify all update*/unlink paths catch. Prereq for TXM catalog import. |
| Research records: add document link (entityKind:'research') | deferred-finding **H** | DA2-R2 | No docId to registry though area label exists; statute/case PDF can't be filed. Additive `documentId`. Must land with R1 before catalog import. |
| Research catalog schema gaps + file-driven CSV importer | deferred-finding **M** / planned | DA2-R5 | No stable ID, no authorityYear, status enum lacks SETTLED/SPLIT, no temporal fields. CSV importer reuses parseStrictInterestString-style normalizers + dedup-by-title. Gates canonical TX-math index. |
| Research one-way link rot on owner/lease/node/map delete | deferred-finding **M** | DA2-R3, F2 | Deleting never clears `research.links.*`; add unlink calls to existing cascade sites. |
| Sanitize reverse map→research pointers on import/delete | deferred-finding **M** | DA2-R4, DA2-M6 | `mapAssets.researchSourceId` unvalidated on import, uncleaned on delete. |
| Research questions cannot link to app objects | deferred-finding **M** | DA2-R10 | No ResearchObjectLinks on ResearchQuestion; dead-end for attorney-question workflow. |
| Research bundle R6–R9, R11 | deferred-finding L-M | DA2-R6…R11 | Invisible catalog search filter (R6); queue count/filter mismatch (R7); O(n·links) per-keystroke rebuild (R8); staged RRC blobs ride .landroid toward 500MB cap unwarned (R9); ResearchView 3,326 lines (R11). |
| Research 'Used By' LinkedSummary key collision | deferred-finding **S** | #215 | **Likely SHIPPED #215** (key by index). Verify this is the same item (ResearchView.tsx:~3299). |
| Canonical in-repo TXM master index (3 id schemes) | research-followup | TXM-002/004/007/050/061, DA2-R5 | Build Spec v1 canonical; CSVs must NOT import before R1→v1 reconciliation table exists. No more research rounds needed. |
| TXM CSV import appendix (sources/formulas/questions) | research-followup | DA2-R1, DA2-R2, IMPORT APPENDIX | Gated on research-workspace hardening landing first + master index. |
| TXM attorney/primary-source verification queue | research-followup | TXM-010, TXM-041, TXM-079, TXM-066, TXM-065, TXM-070 | [UNVERIFIED]: Small Bill riverbed, PBEX II v Dorchester, NM double-fraction authority, highway-ROW pin cite, EOI-fee removal pinpoint, post-cutoff Clifton/Eastland. Stay STOP-AND-ASK until confirmed. |
| Round-1 vs round-2 Van Dyke-rebuttal discrepancy | research-followup | TXM-002, TXM-004 | Clifton v Johnson (R1) vs Eastland remand affirmance (R2); both post-cutoff; needs primary-source. |
| Round-2 numeric corrections to verify | deferred-finding | TXM-036, TXM-022, TXM-052 | NRC 91.403 interest = NY Fed + **2** (not 4); PSF royalty statute = **52.022** (not 52.0161). Re-confirm at build + annually. |
| Texas descent & distribution QUICK REFERENCE card | research-followup | — | Human-readable by death-date era (9/1/1993 fork, community vs separate; NM 1959/1973). Explicit operator directive. |
| RRC decoders: layout tests self-referential | deferred-finding **H** | DA2-X1 | Fixtures built from spec's own offsets → transposed field map passes. Need real-file golden excerpts before widening coverage. |
| RRC decoders bundle X2–X6 | deferred-finding M-L | DA2-X2…X6 | 25MB cap (X2); silent sign/overpunch strip + hardcoded coord split (X3); Preview-Ready conflation, }-splitter can't parse CSV commas (X4 — fix first); no 510 length assert (X5); horizontal-decoder header/dup heuristics (X6). |
| RRC ingestion 5-tier plan + size lane | phase-gate | DA2-X1, DA2-X4, DA2-M4 | ASCII fixed-width → CSV/JSON → .dbf → EBCDIC(CP037) → shapefiles-via-GIS-lane. Streaming Web-Worker size lane. Sequence: nightly permits → production CSV → statewide .dbf → P-5/P-4 EBCDIC → district ledgers. |
| RRC import Phases 1-5 (raw-import-all → CSV/JSON → ASCII parser → EBCDIC → GIS) | planned | RRC Phase 1-5 | **Phase 3 partially live** (Master/Trailer/Pending/Horizontal permit families); deeper segments + generic spec-driven parser pending. Node `ibm037` decoder unsupported → EBCDIC needs raw-import+convert. |
| RRC "Structured Later"/"Needs Decoder" backlog | research-followup | rrc-datasets.ts | Large catalog raw-import-capable; EBCDIC/fixed-width decoding deferred pending value/layout understanding. |
| Research links wired into AI grounding | idea | ResearchView.tsx | Saved questions/formulas shaped for later AI retrieval; consumer not built. |
| Deferred git-history scrub of federal-project acreage figure | human-gated | — | Figure in 4 committed files on unpushed branch; scrub BEFORE any push. Keep repo refs generic. |

## Federal-Leasing
| Item | Kind / Sev | Refs | Detail |
|---|---|---|---|
| Rich lease-document fields demo-only/volatile (persist them) | deferred-finding **H** | DA2-FED1 | Royalty/bonus/rental/stipulations in module-level in-memory Map; "View Lease Document" disabled for real records, dies after reload. Promote to persisted side-store. Strings/dates only, safe pre-Phase 2. |
| No stipulations/COA entry anywhere (BLM-critical) | deferred-finding **H** | DA2-FED2 | Single most load-bearing BLM field, read-only from seed. Add `stipulations:string[]` + COA notes with FED1. |
| Federal royalty branch by lease ISSUE date (3 regimes) | planned **P0** | TXM-070, Phase 2 | pre-8/16/2022=12.5% / IRA 16.67% (kept by contract) / OBBB ≥7/4/2025=12.5%. One wrong rate compounds across the federal checkerboard. Add lease ISSUE DATE as first-class field. |
| Gate fed/fee allocation: force CA surface-acreage, block lateral-length | human-gated | TXM-072/074/032 | For federal-mineral units force CA surface-acreage path; fee-only defaults lateral-length but STOP-AND-ASK on anti-pooling/unratified-NPRI (Opiela). SPLIT/FACT-SPECIFIC, no SCOTX. |
| Isolate New Mexico code paths | planned | TXM-076/077/078/079 | NMSA 70-2-17 risk-charge (≤200% cap, 300% recoupment, payout flip), community-property descent, NM double-fraction stays STOP-AND-ASK pending controlling NM authority. |
| No structure for CA links / rental schedule / sale-EOI / assignment / bonds | planned **M** | DA2-FED3 | Reference fields, not math; safe pre-Phase 2. |
| Federal bundle FED4–FED9 | deferred-finding L-M | DA2-FED4…FED9 | Weak serial register no NMNM/TXNM validation (FED4); jurisdiction-unknown throw aborts whole import (FED5); editable jurisdiction silently removes from register (FED6); expiration buckets frozen at mount (FED7); zero tests on 1,091-line view (FED8); Texas-flavored "federal" seed (FED9). |
| 43 CFR 3103.31(a) direct-final-rule status (eff 6/29/2026) | research-followup | TXM-070 | Confirm not withdrawn; statutory 12.5% governs regardless so branch logic stays. |
| ONRR royalty valuation = Phase 2 boundary | phase-gate | TXM-075, Phase 2 | Gross-proceeds-less-allowances/unbundling/Form 2014 out of scope Phase 1 (decimals only). |
| Federal/private Phase 2 math gate | phase-gate | DEF-FED-01, Phase 2, ADR-0002 | Only opens when operator explicitly opens the jurisdiction gate. Anchored on real ~60k-acre CA documents; supplement Addition 1 items become goldens. |
| Indian/tribal lands math hard-flagged unsupported | parked | — | 25 CFR 211/212, IMDA, BIA — outside TX/NM scope; route to specialized counsel. Do not compute. |
| Wire state-lands + federal-overlay flags into intake (East TX) | idea | TXM-050…054 | Walker/Montgomery/San Jacinto etc. carry PSF/RA + riverbed; Sam Houston NF overlay doesn't change private fractions. |
| Phase 2 `tx_state` GLO payment tracking | planned | Phase 2 | Same Texas math today; slot reserved for GLO-specific work. |
| Temporal date-routing layer (1993/1931 forks P0, 1961 P1) | planned | Phase 7 | Instrument/death/lease/production dates select rule version. |

## AI
| Item | Kind / Sev | Refs | Detail |
|---|---|---|---|
| AI undo fails open if document export fails (data-loss) | deferred-finding **P1** | P1-AI-1 | `captureSnapshot` substitutes empty {documents,attachments} on export failure → later undo wipes doc store. Fail closed. AI Phase 1 #1. |
| Approved tool outputs not preserved as model context | deferred-finding | P1-AI-2 | Next call maps only role+text, dropping IDs; breaks createOwner→createRootNode chains. Action/result journal. |
| Approval UI too thin for title/math (typed diffs) | planned | P1-AI-3, LLA-H04 | Card shows only summary; can't verify parent/tract/fraction/NPRI/lease/source. **P1-AI-3 narrowed; residual = LLA-H04.** |
| AI createRootNode/createNpri default legally-material NPRI unknowns | deferred-finding **H** | LLA-H04, P1-AI-5 | royaltyKind→fixed, basis→burdened_branch. CSV staging fixed earlier; direct AI tools were not. Blocks private-beta title reliance. |
| Runsheet assistant not built end-to-end (import session) | planned | P1-AI-4, Phase 2/3 | Full import-session model: immutable source rows, staged candidates+confidence, clarifying questions, typed action plans, batch apply+undo, per-row status ledger. |
| Thread origin (user/ai/import) through journalTitleMutation | deferred-finding **M** | DA-M3, ACT-M01, H2 | **DA-M3 origin/payload hashing SHIPPED #185**; ACT-M01 provenance flattening confirmed still open post-merge — every mutation recorded `origin:'user'`. Verify withMutationOrigin wired. |
| AI app-context whole-project (beyond active desk map) | planned | DEF-AI-04, LLA-M09 | `buildAIAppContext` capped 40 nodes / desk-map-scoped. Compact whole-project summary, local-AI-first; full = DEF-AI-01 retrieval. Hosted gated by LLA-M09 privacy. |
| Hybrid retrieval + CitationVerifier UI contract | planned **H** | DEF-AI-01, ADR-0006 | Reject unsupported claims before display. Doc Q&A stays disabled until verifier wired through UI. After OCR/vault stable. |
| Deterministic math tools (computeOwnerUnitDecimal/explainTractBurdens/traceChain) | planned | §7c | Model must call instead of prose arithmetic; prompt forbids model arithmetic. |
| AI approval-preview staleness / TOCTOU | deferred-finding **M** | DA-M12, H3, #172, #211 | **#172 keeps previews live + re-checks; #211 re-entrancy-safe.** Render-vs-recheck window narrowed not closed. |
| Teach-once project vocabulary (party_alias schema, no UI) | planned / product-decision | — | Schema in contracts.ts, no UI/AI wiring. Operator asked twice ("ARTI"). Ties to user-directed desk-map reconstruction idea. |
| Proactive stop-and-ask surface at ambiguous deeds | product-decision | — | In-project AI surfaces stop-and-ask rather than fabricate fractions. Awaiting product direction. |
| System-prompt register tuning | product-decision | #209 | Tone tuning; awaiting operator. |
| Approach B — wire mutating tools through hosted proxy | product-decision | #209 | Hosted `runHostedProxyChatTurn` sends no tools (advisory only). ~20 mutating tools through Cognito Lambda + product call on whether hosted users should mutate. |
| Runsheet staging two-row/multi-row headers under-modeled | deferred-finding | P2-AI-2 | Picks one best header row; multi-row combiner before alias mapping, tested on real formats. |
| AI prompt-injection: cap remarks in context, label imported-text proposals | deferred-finding | §7b, LLA-M10 | Imported CSV text re-enters model via tool results untruncated; LLA-M10 staging covers heavy half. Cap remarks (one line) + label cards from imported-text turns. |
| Guided CSV import injects untrusted rows into tool-capable chat | deferred-finding | LLA-M10, H1, P2-AI-1 | Route through source-row staging, selected rows, capped proposals, typed action plans. |
| AI delete previews O(n²) | deferred-finding **P3** | P3-PERF-1, AI20-P3-PERF-1 | Parent-to-children index before descendant walk. |
| AI chat entries keyed by array index (AIPanel ~352) | deferred-finding **S** | — | Cosmetic/fragile; correct today (append-only). |
| AI snapshots orphan earlier snapshots on mid-chain rejection | deferred-finding | — | Bounded memory leak (TITLE_UNDO_STACK_LIMIT=20). |
| AI settings comment claims keys in localStorage (stale) | code-todo **P3** | P3-COMMENT-1, MI-4 | Policy is session-only memory. |
| AI panel hardcodes hosted model name in UI copy | deferred-finding **L** | L-9 | Drift if Lambda HARDCODED_MODEL changes; need /api/ai/meta or shared const. |
| AI client treats any /api/ai 401 as session-invalid | deferred-finding | AUDIT_COMPARISON | Upstream OpenAI 401 forwarded as 401 signs user out. Distinguish auth-401 from upstream-401. |
| Hosted Demo Data overwrites signed-in workspace one click | deferred-finding **P1** | AUDIT_COMPARISON | Navbar Demo Data → seedCombinatorialData→loadWorkspace, no hosted gate/confirm. Hide or strong-confirm in hosted. |
| Hosted-mode 401 mid-stream session handling | research-followup | AI-024 | Destructive logout kills mid-stream; Phase 0.75 decides refresh/re-auth UI. |
| AI app-context 40-node cap → backend-shaped assembly | research-followup | AI-021, CL-13 | Define context-envelope limits before server retrieval. |
| UNDO_MUTATING_TOOL_NAMES ↔ tools.ts compile-time drift guard | deferred-finding | AI-027, CL-12 | TS keyof guard + test exist; stronger discriminated-union check deferred to Phase 1. |
| M&B extraction as reviewed workflow | planned | MAIN_READINESS | Extract verbatim legal descriptions, propose parsed calls/acreage, confidence+source snippet, landman approval before linking. Never auto-mutate title math. |
| Review-first OCR/text indexing with citations | idea | — | Separate from title-math mutation paths. |
| Local OCR/PDF toolchain for Mac (ocrmypdf/tesseract/etc.) | idea | — | Not committed scope. |
| Hybrid AI search (keyword+vector+traversal+math, rank fusion, verifier) | idea | — | Promising; CitationVerifier rejects unsupported before display. |
| Inline "Ask AI about this" entry points | idea | — | On cards/chips/fractions/rows/issues; entity context preloaded + citation-verified. |
| Persistent workspace chat history | idea | — | Local IndexedDB, exportable with workspace. |
| Hosted-AI hardening lane | phase-gate | LLA-M07/M09/M10, AI20-HOSTED-3, P2-HOSTED-1/2/3, HG-3 | **Partial:** tools rejected (P2-HOSTED-1-tools), but broader generic OpenAI body still accepted (LLA-M07); error-leak (P2-HOSTED-2); daily-ceiling-only, no per-minute/concurrency (P2-HOSTED-3/HG-3); workspace context sent by default (LLA-M09). Needs hosted/privacy design. |
| AI-specific hosted blockers (10-item checklist) | phase-gate | CB-4, CB-5, HG-3, HG-4 | tool-execution boundary, prompt-injection isolation, Secrets-Manager creds, rate/budget, server-side output validation, streaming abort, safety_identifier, PII handling, audit log, model allowlist. |
| Workbook .xlsx/.xls import disabled | parked | — | Excel parser had unresolved advisories; CSV-only until safe parser (exceljs / server-side). |
| MCP server connectors (county/OCR/ArcGIS/storage) | idea | — | After native approval-gated import workflow; preserve approval/undo/audit/provenance. |
| AI Next Architecture phases 1-5 | phase-gate | P1-AI-1…5 | Safety → import session → walkthrough → hosted protocol → document intelligence. |

## Persistence / Storage
| Item | Kind / Sev | Refs | Detail |
|---|---|---|---|
| Collapse-duplicate-leases migration UNWIRED to load/import | code-todo | #221 | `src/storage/collapse-duplicate-leases.ts` only applied to Springhill sample; wire to load/import so existing IndexedDB self-heals. |
| Hosted user isolation collision (shards/side-stores by workspaceId) | deferred-finding **H** | LLA-H01, M07/M08/M09/M11 | **Partial (v11):** manifest rows carry dbKey; child shard rows + many side stores still key by workspaceId. Hosted prod NO-GO until fixed + migration from legacy 'default'. |
| Write-lease is advisory not atomic fence | deferred-finding **H** | LLA-H02, DA-M14, DA-M15 | **Status conflict** (header says Fixed via scope-b-hardening; table says Open). Side-store writes bypass gate; no heartbeat loop (TTL 15s, idle writer silently loses lease). Add compare-and-set + heartbeat. |
| .landroid import not atomic across core + side stores | deferred-finding | P1-STORAGE-1, M3, HG-2 | Parallel replacement leaves mixed state on failure. Stage into validated data; snapshot/restore on failure. **Status conflict** (PATCH_PLAN Open vs 2026-04-25 remediated). |
| Imported workspaces keep stale node attachment badges | deferred-finding | P1-STORAGE-2 | `hydrateNodeAttachments` early-returns, leaving in-memory `node.attachments[]`; UI shows chips with no blobs. Clear summaries for nodes with no persisted attachments. |
| Storage quota error surfacing in storage health | planned | DA-M11 | **SHIPPED #175** (surface write failures) + #177 (health popover). Verify quota-denied path. |
| Streaming/chunked .landroid import beyond ~512MB | planned | — | Hard ceiling: `file.text()` + JSON.parse one string. Cap raised 50→500MB. Streaming rewrite deferred until >512MB projects. |
| Hosted multi-user IndexedDB collision (WORKSPACE_ID='default') | deferred-finding **M/HG** | M-1, HG-1, CB-2 | **Partial:** user-<sub> keys wired, but no migration from legacy 'default' row + no operator warning that pre-namespacing data goes invisible. |
| Existing 'default' workspace data invisible after sub-namespacing | deferred-finding | AUDIT_VERIFICATION, M-1 | No auto-migration (would merge wrong data); fix migration/warning before hosted deploy. |
| Hosted null-sub fallback returns 'default' key | deferred-finding | AUDIT_COMPARISON | LoginGate normally prevents, but persistence helpers don't reject hosted null-sub writes. (Phase 6 guard noted as later landed.) |
| workspace-id.ts uses Date.now()+Math.random() no test | deferred-finding | AUDIT_COMPARISON | Collision-prone. (crypto.randomUUID noted landed Phase 6 — verify.) |
| .landroid version field exported but not dispatched on import | deferred-finding | AUDIT_COMPARISON | Import checks shape, normalizes without reading `parsed.version`. Add dispatch before format evolves. (Partly superseded by v8.) |
| Reject non-numeric/missing .landroid version on v8+ | deferred-finding **L** | DA-L8 | **SHIPPED #174/#178** — verify raw-spread side-store field-by-field normalization. |
| Wrap v7→v8 migration foreign promises in Dexie.waitFor; orphan cleanup | deferred-finding **M** | DA-M10 | **SHIPPED #171** — verify orphan-attachment cleanup in same pass. |
| Drop retained v7 pdfs blobs + stream/compact export JSON | deferred-finding **L** | DA-L7 | **base64 chunking SHIPPED #176**; v7 blob drop deferred behind next backup-gated schema bump. |
| Side-store metadata-first conversion (research blobs) | deferred-finding | DEF-SHARD-01, Phase 0.5 | Owner+map done (#88/#89); research = **DO NOT RE-PROPOSE** (bloat). Async preview/parse refactor across 4 views; no measured regression. |
| Per-view edit-control disabling for read-only tabs | planned | DEF-SHARD-02 | After LLA-H02 write-fence settled; readers can still reach edit controls. |
| Storage health + Backup Now UX | planned | DEF-STOR-01, DA-M11 | **Popover SHIPPED #177**; quota-denied half + Backup Now after LLA-H01/H02/import-rollback. |
| Rolling auto-export retention (keep-last-N) | deferred-finding | DA-M16 | **SHIPPED #157.** Residual deferrals: configurable N (needs settings surface), prune old-project-name files, total-bytes cap. |
| Project picker / multi-workspace saved-project index | planned | DEF-STOR-03 | Single-autosave-slot today → accidental-replacement risk. After namespace/write-fence cleanup. |
| Rolling auto-export where platform supports it | planned | DEF-STOR-02 | File-System-Access behind explicit user selection. |
| Attachment ordering not fully workspace-scoped | deferred-finding | P2-DOCS-3 | Count by [entityKind+entityId]; use [workspaceId+entityKind+entityId]. |
| Document/PDF storage IndexedDB → S3 | planned **HG** | HG-5 | Cloud: S3 under workspaces/{id}/pdfs via presigned PUT/GET, IndexedDB as cache. Backend phase. |
| File uploads: no MIME-sniff/type/virus scan | deferred-finding **HG** | HG-6 | 5 entry points inspect no magic bytes. Server-side sniff + allowlist + ClamAV + content-disposition. |
| Rebuild Phase 0.5 sharding (side-store conversion still deferred) | phase-gate | Phase 0.5, PER-018/024 | Shard reader/writer + write-lease UI + Dexie v10-v12 landed; side-store metadata + per-view read-only still deferred, evidence-gated. |
| Phase 0.5 node shard split is compatibility-only | deferred-finding | Phase 0.5, Phase 1 | Not the final Phase 1 InstrumentRecord/InterestReference semantic split. |
| Multi-tab pessimistic single-writer | deferred-finding | PER-024, Phase 0.5 | Write-lease + banner landed; per-view read-only disabling deferred. |
| Orphaned-PDF discovery/recovery UI | deferred-finding | DOC-039, PER-009, Phase 0.6 | v7→v8 records orphan IDs + fallback path; no user-facing UI. Phase 0.6. |
| Export readiness gating before real-use storage | deferred-finding | PER-010, DOC-033, CL-17 | Immediate post-demo export produced 0 docs. Readiness-gate normal export before real-use storage/backup; add deterministic race test. |
| ADR 0005 storage-format trajectory = Proposed not Accepted | product-decision | ADR-0005 | Stages changes, not ratified. |
| Evaluate SQLite WASM in OPFS / cloud object storage / Tauri 2 | idea / phase-gate | ADR-0005, DEF-NATIVE-01 | Only at documented decision gates, never defaults. |
| Rolling auto-export + storage health UX (broad) | idea | — | Backup folder, timestamped snapshots, last-saved/exported status, overdue warnings. |
| W2 Raven Forest rebuild stress fixture | parked | PERF-01 | Don't freeze today's export; generate fresh deterministic project; commit full .landroid only if reviewable. |
| Server snapshot persistence (S3 versioned + Postgres metadata) | planned | Phase 1/3, HG-1 | Replaces WORKSPACE_ID='default'; optimistic locking; IndexedDB as cache. |

## Backend-spine
| Item | Kind / Sev | Refs | Detail |
|---|---|---|---|
| Codex line-by-line audit backlog (4H/14M/6L) | deferred-finding | #88, #89 | 2026-05-31, branch chore/codex-audit; treat as LEADS to verify. None block local-first. |
| Codex audit mediums M01–M14 | deferred-finding | M01…M14 | Hosted AI proxy schema/error/context; CSP blob-frame PDF; .landroid rollback race; stale node-attachment badges; cross-workspace attach ordering; node-only export; AttachLeaseModal bypasses Texas gate; null-unit ORRI/WI exclusion; CI no e2e; no aggregate backend validation. M07/08/09/11 = hosted-prod gates. |
| Codex audit lows L01–L06 | deferred-finding | L01…L06 | Ollama wildcard CORS; DeskMapTabs warning-dot from description; stale audit-sheet.md; PATCH_PLAN vs TESTING e2e contradiction; misleading AISettingsPanel comment; stray test-csv generator. |
| Phase 0.75 minimal backend spine (contracts + proof points) | phase-gate | ADR-0008, Phase 0.75 | Shared TS/Zod schemas, RecordEnvelope, adapter boundary, health/session/validation endpoints. Deployed 2026-05-26. Must not become source of truth. |
| Full backend responsibilities | phase-gate | DEF-BE-01, ADR-0008 | Durable storage, object storage, signed URLs, OCR/index jobs, search, RAG, sync, sharing, cross-project identity. Only on hard trigger; no SaaS rewrite. |
| Backend skeleton from scratch | phase-gate | CB-1 | **Partial:** Lambda ai-proxy + Cognito landed; App Runner backend / project persistence / S3 per DEPLOYMENT_PLAN. |
| No auth/authz / multi-tenant model | phase-gate | CB-2, HG-1 | **Partial:** Cognito + sub-namespacing landed; full per-user server authorization/migration owed. |
| Browser direct cloud-AI calls removed from hosted bundle | phase-gate | CB-3 | Proxy landed; removing browser createOpenAI/createAnthropic from hosted bundle is remaining gate. |
| Rebuild Phase 1 record schema (some bodies await surfaces) | phase-gate | Phase 1 | Schemas/projections/MathInputView/AI-mutation-guard landed; wellbore/lease-obligation/packet schemas defined, produce rows only when a surface supplies data. |
| Phase 1 stub record bodies → full body schemas | code-todo | Phase 1, Phase 0.5 | Envelope-only stubs sharded against; Phase 1 replaces. |
| Server-side provider router (OpenAI/Anthropic/Bedrock) | planned | Phase 1/2 | Backend decides model/timeout/budget/redaction/fallback. Bedrock recommended for AWS-native governance; decision deferred to product owner. |
| Background-job workers (workbook parse / PDF extract / export / AV) | planned | Phase 2 | SQS+App Runner/Lambda; prefer queue over heavy parsing in web request. |
| Daily token ceiling resets on Lambda cold start | deferred-finding **M** | M-4, HG-3 | **Partial:** DynamoDbUsageStore exists with atomic ADD + 48h TTL but OPTIONAL (only when USAGE_TABLE_NAME set). Mandatory-before-deploy is a deferred human decision. |
| Lambda token estimator over-counts | deferred-finding **L** | L-6 | Assumes 2048 output even at 50 tokens; parse final SSE usage event. |
| No Cognito JWT verification test | deferred-finding **L** | L-8 | **Partial:** request-policy helpers tested; JWT-verify + streaming handler paths untested. |
| Frontend Cognito OIDC issuer/JWKS point at Hosted UI domain | deferred-finding **P1** | F1 | Hosted UI .well-known 404s; CSP lacks cognito-idp host. Hosted sign-in can fail while root smoke passes. Top hosted blocker. |
| FederalLeaseDocument metadata in-memory only | research-followup | FED-003, Phase 0.75 | Re-seeded each boot; decide backend-shaped Document/SourceAttestation record so Phase 0.5 can persist. |
| RRC dataset catalog client-bundled vs server-fed | research-followup | RES-022 | Decide before backend retrieval. |
| Incremental rebuild target / Phase 0 ultra-review / Phase 0.75 decision | phase-gate / idea | Phase 0/0.5/0.75 | Behavior inventory → sharding → backend decision → schema. Source: rebuild-plan.md. |

## Ledger / Audit
| Item | Kind / Sev | Refs | Detail |
|---|---|---|---|
| Journal clearDeskMapNodes/deleteDeskMap + coverage test; flip auto-cutover off | deferred-finding **Critical** | DA-C1, ACT-H05 | Two live actions delete title nodes unjournaled → "store is ledger's projection" false; flip self-arms. **Partial:** journal extended to 8 actions + CI invariant test; `createDeskMap(initialNodeIds:[])` remains journal-free (pinned by test). |
| Make Undo/loadWorkspace hydrate-then-append (don't erase ledger) | deferred-finding **H** | DA-H2 | "Undo last AI change" + loadWorkspace destroy the durable hash-chained ledger; append-only machinery has zero non-test callers. Re-hydrate + append "undone". |
| Make cutover rollback complete (gate cascades, fail mutations, throwing hook) | deferred-finding **H** | DA-H3 | After rollback, cascades still fire, mutators report success, throwing parity hook skips rollback. Return {rolledBack}, gate cascades, rollback in catch. ~30 lines. |
| Ledger flush ordering / stale-chain hydration / quarantine-vs-erase | deferred-finding **H** | DA-H4, ACT-H03, B4 | **Partial:** DA-H5 payload hashing + DA-H4 quarantine SHIPPED #185; flush-ordering + stale-chain hydration half still open. Invalid chains console.warn-then-rewrite destroys tamper evidence. Needs lastFlushedHeadHash marker. |
| Hash ActionRecord payloads (DA-H5) | deferred-finding **H** | DA-H5 | **SHIPPED #185** (hashes result not whole record). Backlog rows that still list "hash chain excludes payloads" refer to the whole-record gap — verify scope. |
| Reader tab can clobber writer's title ledger (no lease check) | deferred-finding | DA-M15, DA-H4 | `replaceTitleLedgerWorkspaceRows` delete+bulkPut no fence, reachable from reader tab. Multi-tab amplification of DA-H4. Contradicts SECURITY.md. |
| Production read-flip enablement (the headline decision) | human-gated | Phase 4, ACT-H01/H03/H04, DA-C1 | Built, governed, default-off, **ARMED** (main.tsx setTitleCutoverArmed(true), 2026-06-10). Arming only permits; needs 5 gates green + manual banner click. Irreversible-class; run STOPS at the gate. |
| ACT-M01 provenance flattening (AI/import tagged user-origin) | deferred-finding | ACT-M01, DA-M3, H2 | Confirmed live; audit can't distinguish hand edit from AI/import. (DA-M3 origin threading shipped #185 — verify ACT-M01 closed.) |
| ACT-H05 divergence console-only after commit | deferred-finding | ACT-H05 | **Partial:** banner exists, no auto-revert, console-only in shadow. Block cutover candidacy until cleared. |
| ACT-H01 title replay no initial baseline | deferred-finding | ACT-H01 | **Status conflict:** Current-Findings row Open vs reconciliation "Fixed (ensureTitleBaseline)". Verify before building. |
| ACT-H03 live ledger not durable | deferred-finding | ACT-H03 | **Partial (v9):** manual save/import carries validated actionLedger; refresh-time Dexie persistence/hydration deferred (records in-memory between exports). |
| ACT-M02 replay ordering not persisted canonical order | deferred-finding | ACT-M02 | Folds in input order; array order may not prove application order, esp. equal timestamps. Define canonical order + tied/shuffled tests. |
| ACT-M04 full node snapshots → memory/package growth | deferred-finding | ACT-M04 | Measure at W2 scale; full vs math-relevant snapshot + checkpointing before v9. D5 = ship full, measure, compact later. |
| Address ledger scale (append-only flush, debounced gates) | deferred-finding **M** | DA-M4, ACT-M04 | O(N) verify + delete-all/bulkPut every autosave; O(N²) readiness recompute; full snapshots. Append-only flush, requestIdleCallback debounce. Measure at Raven Forest first. |
| Count only session-recorded parities toward cutover threshold | deferred-finding | DA-U2 | **SHIPPED #173.** |
| Named-tool gate-consistency LOW (title-command-sourcing.ts) | deferred-finding | — | Deliberately not changed — not live-exploitable (aiToolName always == approved tool); real fix risks breaking live AI ops. Flagged. |
| DA-H4(b) stale-but-valid head warning | deferred-finding | DA-H4 | Needs persisted lastFlushedHeadHash shard field; window mostly closed by (a). Envelope pin to reject full-chain truncation→legacy. |
| Cascade cleanup async with data-integrity risk on storage failure | deferred-finding | DA-H4, DA-H5 | `cascadeDeleteDocsForRemovedNodes` fires after removeNode; Dexie failure → node gone, docs linger. Tied to ledger-hydration work. |
| Title-soak harness (scripts/title-soak.ts) untracked | code-todo | ACT-H01 | Read-only real-data soak; commit on own branch off main when wanted. |
| Keep createDeskMap-with-initialNodeIds journal-free path pinned by test | code-todo | DA-C1 | One journal-free path an AI tool touches with []; pin so it doesn't regress. |
| DEF-ACT-01/02/03/05 cutover-decision set | phase-gate / product-decision | DEF-ACT-01/02/03/05 | First-workflow order (owner/curative low-risk vs title_tree high-value); full-effect persistence per surface; audit-chain scope (project-wide D3); maintain no-PII synthetic-fixture rule. |
| DEF-IMP-01/02/03/04 import-session decisions | phase-gate | Phase 3/4 | ActionRecord-draft schema vs durable rows; source rows first-class vs sidecar; canonical runsheet identifiers; answered-question representation. |
| DEF-ACT-04 v9 record-bearing package | phase-gate | DEF-ACT-04 | **SHIPPED** (v9 optional actionLedger, validates, drops bad with warning). Full projected-bundle/read-cutover stays deferred; read path stays shadow. |
| Title UNDO | held-PR | — | **SHIPPED #147** (journaled inverse restores + cascade bundles + navbar button/Cmd+Z). |
| PR #185 ledger-trust lane held-for-ultra | held-PR | #185, DA-M3/H5/H4 | **MERGED #185** (operator said merge, lifting hold). Conflicting earlier "held" note — treat as shipped. |
| ADR 0007 action-layer/audit schema Proposed (staged) | product-decision | ADR-0007, Phase 1/3/4 | Phase 1 schema → Phase 3 imports → Phase 4 cutover after parity. AuditEvent "can support hash continuity". |
| No observability / audit logging | deferred-finding **HG** | HG-4 | No structured logger/CloudWatch/Sentry; append-only audit events for auth/AI-mutation/upload/export/permission. |
| Rebuild Phase 4 action-layer cutover (shadow only) | phase-gate | Phase 4, #97 | Shadow build complete; title_tree wrapper + journal recording-only; read-flip built default-off. NO production read flip. |
| Title-cutover branch merge blocked until ACT-* fixed | phase-gate | ACT-H01…H05, #97 | Do not merge until findings fixed or branch narrowed to mechanism-only. |

## Docs
| Item | Kind / Sev | Refs | Detail |
|---|---|---|---|
| SECURITY.md divergences (5 items) | deferred-finding | DA-L8, DA-M14, DA-M15 | write-lease "only pure evaluator" (now wired+fenced); Dexie "v10" (now v14); "hosted gets readOnlyLandroidTools" (sends no tools, export dead); "future versions rejected" (numeric-only); "heartbeat/expiry/takeover" (no heartbeat loop). Code ahead of doc. |
| Documentation drift (ROADMAP/PATCH_PLAN, proxy README, cap/dedup comments) | deferred-finding **L** | DA-L5 | ROADMAP refs archived PATCH_PLAN; "Later" lists deployed proxy; README curl omits model; 50MB cap comment (actual 500MB); blob-hash "no dedup caller" (registry reads it). |
| Handoff/roadmap/math-ref stale line refs | deferred-finding **P3** | F7, M6, P2-DOCS-2 | CONTINUATION stale branch; ROADMAP puts proxy in "Later" though deployed; LANDMAN-MATH-REFERENCE stale line refs. |
| LPR SSN comment documents nonexistent field | deferred-finding **L** | DA-L9 | lease-purchase-report.ts:17-20 claims SSN masking/exclusion that doesn't exist. Rewrite to "deferred & unimplemented". |
| LLA-L03 stale root handoff material | deferred-finding | LLA-L03 | **Status conflict:** table Needs-verification vs reconciliation "verified no-op (CONTINUATION actively referenced)". |
| Active docs/root clutter (archive point-in-time files) | deferred-finding **P3** | P3-STRUCTURE-1 | **Partial:** moving into docs/archive ongoing. |
| Document cleanup pass — archive audit/prompt files | idea | — | After branch checkpoint; shorten root doc list. |
| Roadmap change suggestions (7 edits) | product-decision | ACT-H03/H05/M01, LLA-H02 | Scope-B hardening lane at top of Now; promote doc fixes above three-pane; precision migration to Now; open Texas-math gate narrowly; mark reality; demote three-pane/Cmd+K/OCR; design-token consolidation line. |
| Backend work must update security/deploy/testing/arch docs same phase | code-todo | ADR-0008 | Documentation obligation on future backend phase. |
| ADR 0001/0002/0003 standing decisions | product-decision | ADR-0001/0002/0003 | Local-first current phase; Texas-only active math (federal reference-only); AI keys behind proxy for hosted. |

## Infra / Deploy
| Item | Kind / Sev | Refs | Detail |
|---|---|---|---|
| CI does not run Playwright e2e (biggest unguarded structural gap) | deferred-finding | LLA-M12, P2-CI-1, F4, I2 | 5 high-value workflows skipped (export/import w/PDFs, branch-scoped lease delete, curative+research linkage). Add e2e CI or document as local release gate. |
| No CSP / security headers for hosted mode | deferred-finding **L/Critical-deploy** | L1, CB-7, F1 | **Partial:** customHttp.yml CSP landed (worker-src self blob:); still missing cognito-idp host (F1). +HSTS/Referrer-Policy/nosniff. |
| Lambda Function URL no code-side origin/referer check | deferred-finding **P2** | AUDIT_COMPARISON, P2-HOSTED-1 | JWT verified, Origin/Referer never read; CORS console-only. AWS_IAM/SigV4 or token hardening + body-key allowlist. |
| xlsx high-risk dependency (no patch) | deferred-finding | H2, CB-6, F6, P0#2 | **Containment shipped** (caps, CSV-only AI import, worker isolation); dependency remains in package.json. Backend fast-xml-builder fix is AVAILABLE + deferred. Document residual in SECURITY.md. |
| Numeric performance drift gate in CI | deferred-finding | PERF-01…08 | Baselines captured; numeric drift comparison is later policy/harness. |
| Root validation doesn't aggregate backend validation | deferred-finding | P2-CI-2 | **Narrowed/Fixed** (CI includes backend spine + AI proxy jobs; LLA-M14 local aggregate fixed). Captured for traceability. |
| Lambda zip stale (missing usage-store/request-policy/dynamodb) | deferred-finding | AUDIT_VERIFICATION | Deploying existing zip crashes proxy on first request; operator must rerun npm run bundle. Make guide wording explicit. |
| DynamoDB IAM grant + TTL for usage store | human-gated | AUDIT_VERIFICATION, M-4 | Grant dynamodb:UpdateItem, set USAGE_TABLE_NAME, enable TTL. Manual AWS config. |
| Amplify rewrite placeholder requires manual swap | human-gated | L-1 | REPLACE_WITH_FUNCTION_URL_HOST; paste real Lambda URL host post-deploy or AI calls NXDOMAIN. |
| Tracked generated artifact dist/assets/xlsx-*.js | deferred-finding **P3** | MAIN_READINESS, HG-8 | Confirm dist tracking intent; remove generated artifacts in cleanup branch. |
| Fixture generator writes outside repo | deferred-finding **P3** | P3-STRUCTURE-2 | generate-test-csv.ts resolves via process.cwd()/.. |
| Hosted rollout phases 0-3 + Go/No-Go (12 of 13 boxes unchecked) | phase-gate | Phase 0/1/2/3 | Phase 0 + AI proxy landed; later phases gated on backend + product decisions. Only xlsx box checked. |
| Keep PWA-first; native shells deferred | product-decision | — | Tauri 2 only on hard trigger. |
| Field/iPad mode (PWA offline, Ollama) | idea | — | Read-heavy/light-edit courthouse/field. |
| AWS performance lane AI20-P3-PERF-1..5 | parked | — | Profile-first. |

## Demo-polish
| Item | Kind / Sev | Refs | Detail |
|---|---|---|---|
| Aesthetics consolidation ("lean professional", §5) | planned | DA-U1, #161 | **§5 lane SHIPPED #161** (token repair, shared Button, focus discipline). Remaining: numeric typography mono+tabular for overflowing fractions, pill/tab+table kit, skeletons, SVG icon module, view-header pattern, wide AttachLeaseModal shell. |
| Broken design-token references (live UI bugs) + token-lint grep | deferred-finding | DA-U1 | **Fixed** (#148/#161 token repair + theme-tokens.test.ts guard). |
| "What needs attention?" workspace dashboard | idea | MAIN_READINESS | Morning-triage counts: unlinked docs, missing legal descriptions/metadata, unresolved curative, lease expirations, unleased owners, rows awaiting review. |
| A11y batch (native confirm/alert, labels, tab/aria, modal focus) | deferred-finding | AUDIT_COMPARISON, F8 | **Partial** (Phase 6 confirmation modal + focus trap + labels + tab ARIA landed per ARC_REVIEW). AI panel fixed-width overflow + textarea accessible name remain. |
| Five critical e2e workflows skipped (Playwright) | deferred-finding | M7, HG-7, L-7, F4 | Tied to retired leasehold fixture; ARC_REVIEW notes Phase-5 restoration — verify. |
| AI settings persistence-semantics tests | deferred-finding **L** | L2, MI-4 | **Fixed** (in-memory fallback); residual stale-comment/warning-noise. |
| Audit Sheet export (one-page-per-tract printable) | planned | audit-sheet-export-brief | **SHIPPED #198** (printable per-tract Audit Sheet) + #205 (pre-WI charges fixed-NPRI excess). Verify against brief. |
| Springhill real-data .landroid build — local-only never commit | parked | — | 250MB Dr. Elmore #1 (357 nodes→714 records) holds SSNs/EIN/deeds. De-identified sample shipped instead. |

## Other / Cross-cutting
| Item | Kind / Sev | Refs | Detail |
|---|---|---|---|
| Run the 5-wave "do it all" backlog program | planned | #180, DA-H4/H5/M3, ACT-H01 | W1 hygiene+DA-H1+Stage-G; **W2 ledger trust (#185)**; W3 Documents/Maps/Curative/Audit-sheet; W4 research/intake; W5 Texas-math long-tail. Plan: make-a-plan-to-glistening-lantern.md. |
| Question — Inbox label semantics (triage vs Needs Review) | research-followup | — | Open question to revisit. |
| Question — when is a packet "ready enough" to export | research-followup | — | Metadata complete / entity-linked / deduped / all three. |
| Question — smallest useful ArcGIS handoff artifact | research-followup | — | Before native GIS import. |
| Open Source Lookup Workbench / FamilySearch / heirship-clue agents | idea | — | Later Product/AI; return leads + confidence, **never title conclusions**. No FamilySearch integration today. |
| Export LANDroid → runsheet/NRI/title-sheet xlsx | planned | — | EXPORT back to deliverable spreadsheet formats (DOTO runsheet, NRI status, per-tract title sheets). Stated big-picture round-trip goal. |
| Tract 3/5/6 Harman 80%-joint→Donald-alone flag | human-gated | — | 2009 DOTO lists 80%×25/420 jointly; NRI books to Donald alone, no recorded conveyance. Built per NRI, flagged. Operator confirmation. |
| Phase 0 manual smoke-check runbook (full run pending) | parked | — | Only lightweight Vulcan Mesa smokes captured. |

---

## ✅ Already shipped (do not re-audit)
*Conservative — anything with a status conflict stayed Open above.*

**Title-math / Leasehold:**
- ~~Unified title-math engine + DA-H1/M1/M5/Van-Dyke/unleased-rows/Stage-B 9dp~~ **#180**; DA-H1 counsel-approved **#182**; Stage-G shim teardown **#183**
- ~~Over-conveyance warn + Add Root validate (DA-M1/M2 application layer)~~ **#167** *(engine-level silent-cap + raw-addNode structural guard remain Open above)*
- ~~ORRI branch-card total (DA-H9)~~ **#158**; ~~ORRI/WI duplicate derivation (DA-M7)~~ **#168**
- ~~O(n) child index in branch-allocation validation (DA-208)~~ **#208**
- ~~CSV fraction precision strict Decimal (DA-H10)~~ **#156**
- ~~Printable Audit Sheet~~ **#198**; ~~pre-WI fixed-NPRI excess~~ **#205**

**Lease-instrument model:** ~~One record per instrument~~ **#221**; ~~AttachLeaseModal one record/instrument~~ **#222**; ~~test-lock dup records don't inflate math~~ **#220**; ~~display collapse dup lease cards~~ **#212**; ~~idempotent store mutations~~ **#211**

**Storage:** ~~Export all workspace docs (DA-H6)~~ **#152**; ~~re-verify hashes import/export (DA-H7)~~ **#153** + ~~backfill~~ **#155**; ~~prune auto-export (DA-M16)~~ **#157**; ~~v7→v8 migration txn + drop dangling (DA-M10)~~ **#171**; ~~quota write failures (DA-M11)~~ **#175**; ~~storage-health popover (DEF-STOR-01 part)~~ **#177**; ~~reject version-bypass (DA-L8)~~ **#174**/**#178**; ~~base64 chunking (DA-L7)~~ **#176**; ~~hash map assets (DA2-M2)~~ **#184**; ~~seal dup chain-of-custody (DA-210)~~ **#210**; ~~duplicate copies canvas+GeoJSON not ledger (DA-204)~~ **#204**

**Ledger/Audit:** ~~Trust lane DA-M3/H5/H4 (origin + payload-result hash + quarantine)~~ **#185**; ~~session-only parities (DA-U2)~~ **#173**; ~~arm cutover flip~~ **#144**; ~~title undo button~~ **#147**; ~~exclude lastModified from round-trip gate~~ **#149**; ~~v9 durable format (DEF-ACT-04)~~

**Maps/GIS:** ~~GeoJSON side-store (M1)~~ **#186**; ~~feature→tract matcher + ExternalRef (M2)~~ **#187**; ~~per-tract CSV+GeoJSON export (M3)~~ **#188**; ~~render real polygons (M4)~~ **#189**; ~~SVG 3D flip chooser (M5)~~ **#190**; ~~per-tract remove~~ **#191**; ~~unit-plat PDF (M6)~~ **#192**; ~~mapTractFeatures round-trip~~ **#202**; ~~acreage crosswalk~~ **#213**; ~~land-plat reskin~~ **#214**; ~~load-sample-tracts~~ **#216**; ~~plat PDF match~~ **#217**; ~~warn-and-choose re-import GeoJSON~~ **#218**

**Documents:** ~~attorney-packet ZIP~~ **#193**; ~~three-pane nav rail~~ **#194**; ~~dedup-on-ingest~~ **#195**/**#196**; ~~Bates production set~~ **#197**

**Curative:** ~~open Critical/High → holds + dots~~ **#200**; ~~Title Requirement Report~~ **#201**

**AI:** ~~mode-accurate prompt (DA-209)~~ **#209**; ~~reject ambiguous fractions + drop empty turns (DA-207)~~ **#207**; ~~clear AI state on switch + guard cross-workspace undo (DA-203)~~ **#203**; ~~live previews + re-check (DA-M12)~~ **#172**; ~~undo only matching label (DA-L6)~~ **#166**; ~~H3 keys session-only~~

**Research:** ~~Used-By rows keyed by index (#215)~~; ~~revert optimistic edits on persist failure (DA2-R1)~~ **#165**

**Flowchart:** ~~Miro-class rebuild~~ **#159**; ~~Fit-to-Grid/Resize scale (DA-206)~~ **#206**; ~~stop text spillover~~ **#169**; ~~visible non-collapsing boxes~~ **#179**

**UI:** ~~display-format precision migration + grep guard~~ **#163**; ~~aesthetics §5 (DA-U1)~~ **#161**; ~~Ledger Refined shell~~ **#150**/**#151**; ~~aesthetics round 1~~ **#148**; ~~quick-wins hosted wizard/auth/doc drift~~ **#164**

**Shipped audit findings (matched to refs):** DA-H1, DA-H4(a), DA-H5, DA-H6, DA-H7, DA-H9, DA-H10 · DA-M1(app), DA-M2(app), DA-M3, DA-M5, DA-M7, DA-M10, DA-M11, DA-M12, DA-M16 · DA-L6, DA-L7, DA-L8 · DA-U1, DA-U2 · DA2-M1…M6, DA2-C2, DA2-C3, DA2-R1 · M-2, M-4(partial), M-5, M4, M5, L-2, L-3 · H2(contained), H3, H4, H5

---

**Verify-before-trusting flags** (status conflicted across sources — kept Open): ACT-H01, ACT-H05, LLA-H02, LLA-L03, M1/M2/M3 (PATCH_PLAN vs 2026-04-25), workspace-id crypto.randomUUID, hosted null-sub guard, #103 Springhill sample, #147 title-undo, #200/#201/#215 scope. Pull the named source file/PR before building on any of these.

Source files (absolute): `/Users/abstractmapping/projects/landroid/CHANGELOG.md`, `/Users/abstractmapping/projects/landroid/ROADMAP.md`, `/Users/abstractmapping/projects/landroid/docs/audit-backlog.md`, `/Users/abstractmapping/projects/landroid/docs/deep-audit-2026-06-10.md` (+ `-part2.md`), `/Users/abstractmapping/projects/landroid/docs/feature-interaction-map.md`, `/Users/abstractmapping/projects/landroid/docs/rebuild-plan.md`, `/Users/abstractmapping/projects/landroid/docs/adr/`, `/Users/abstractmapping/projects/landroid/docs/archive/audits/`.
