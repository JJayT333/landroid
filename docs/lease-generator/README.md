# Lease document generator (deferred feature) — DEF-LEASE-01

Goal: generate a filled oil-&-gas lease (starting from the blank **Producers 88**
form) populated with LANDroid project data — lessor/lessee, legal description,
royalty, term, etc. Was working at one point; broke. Parked as a future feature.

## Template

`Producers_88.docx` (saved here 2026-06-02) — the blank Producers 88 (Rev.) lease
form. Blank, so no PII. `Producers_88.pdf` (the flattened rendering) lives with
the source in `~/Documents/LANDroid/Landroid Stuff/` and can be copied here if a
reference render is wanted.

## Known failure mode (diagnosed 2026-06-02)

Symptom: **entering field data changed/reflowed the document formatting.**

Root cause: the Producers 88 `.docx` has **no Word content controls, no legacy
form fields (FORMTEXT), and no merge fields** — it is plain formatted paragraphs
with underscore blanks. A generator that does naive text insertion into the
existing paragraph runs therefore reflows the layout (shifted underscores,
broken spacing/line breaks).

## Recommended approach (for whoever builds it)

Fill a **structured** template, not raw runs:
- Add Word **content controls** (or merge fields) to a master template and fill
  those by tag, **or**
- Do **run-preserving** replacement (replace text within a run while keeping its
  formatting), e.g. via a docx-templating library or the `docx` skill.

Do not insert text into unstructured paragraph runs — that's what broke it.

See `docs/audit-backlog.md` → **DEF-LEASE-01**.
