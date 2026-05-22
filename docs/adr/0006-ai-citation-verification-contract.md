# ADR 0006: AI Citation Verification Contract

## Status

Proposed for rebuild planning.

## Context

LANDroid's AI layer should help answer title questions and propose work, but
title answers are only useful when they can be proven. The rebuild plan also
keeps OCR/text extraction staged after the evidence vault, which means LANDroid
cannot honestly cite document text until page/span anchors exist.

## Decision

AI answers must pass a structural citation-verification boundary before display.

The target contract is:

- every material claim traces to a source citation, record ID, deterministic
  math result, approved action record, or explicit curative issue
- pre-OCR AI may cite structured records, source attestations, import rows,
  explicit open issues, and deterministic calculations, but not nonexistent
  document text spans
- `CitationVerifier` rejects unsupported claims or converts the answer to an
  insufficient-evidence result
- confidence is a discrete enum such as `supported`, `partial`, `conflicting`,
  or `insufficient`
- open issues point to existing `CurativeIssue` records or typed proposed
  records awaiting approval
- suggested next actions are typed `ActionPlan` proposals or navigation hints
- retrieval is hybrid: exact/keyword search, vector recall, record traversal
  tools, deterministic math tools, and rank fusion before answer generation

## Consequences

- AI document Q&A cannot be fully enabled until OCR/text extraction creates
  citation anchors.
- Prompt wording alone is not considered adequate proof control.
- The hosted and local AI surfaces must preserve approval, undo, and citation
  boundaries as capabilities expand.
