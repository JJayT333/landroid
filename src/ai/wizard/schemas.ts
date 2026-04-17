/**
 * Structured-output schemas for the AI wizard.
 *
 * The AI emits a `WorkspaceImportProposal` describing how each sheet maps to
 * LANDroid concepts. NO writes happen from this — it is a preview the user
 * confirms before commit 4 wires the validated apply step.
 */
import { z } from 'zod';

export const SHEET_ROLE_OPTIONS = [
  'leasehold-runsheet',
  'mineral-title',
  'npri-title',
  'document-list',
  'status-summary',
  'tract-map',
  'ignore',
  'unknown',
] as const;
export type SheetRole = (typeof SHEET_ROLE_OPTIONS)[number];

export const sheetMappingSchema = z.object({
  sheetName: z.string(),
  role: z.enum(SHEET_ROLE_OPTIONS),
  /** Tract code if this sheet covers exactly one tract (e.g. "T2"). */
  tractCode: z.string().optional(),
  /** Tract codes if the sheet spans multiple tracts (e.g. NPR-on-many-tracts). */
  tractCodes: z.array(z.string()).optional(),
  /** Confidence in this classification. */
  confidence: z.enum(['high', 'medium', 'low']),
  /**
   * Column-letter -> LANDroid field name mapping. Values use the canonical
   * field names from src/types/node.ts (grantor, grantee, instrument, docNo,
   * date, fileDate, landDesc, remarks, fraction, royaltyKind) plus a few
   * leasehold/title-specific roles ("lessor", "lessee", "leaseStatus",
   * "royaltyRate", "mineralInterest", "grossAcres", "mineralAcres", "nri").
   */
  columnMap: z.record(z.string(), z.string()).optional(),
  /** Plain-English notes — assumptions, ambiguities, things the user should verify. */
  notes: z.string().optional(),
});
export type SheetMapping = z.infer<typeof sheetMappingSchema>;

export const projectHeaderSchema = z.object({
  unitName: z.string().optional(),
  operator: z.string().optional(),
  county: z.string().optional(),
  state: z.string().optional(),
  totalAcres: z.string().optional(),
  effectiveDate: z.string().optional(),
});
export type ProjectHeader = z.infer<typeof projectHeaderSchema>;

export const workspaceImportProposalSchema = z.object({
  /** Best-guess project header derived from sheet titles, headers, and well-name strings. */
  project: projectHeaderSchema,
  /** Per-sheet classification + column mapping. */
  sheets: z.array(sheetMappingSchema),
  /**
   * Top-level tract roster the AI inferred (tract code, gross acres if known,
   * NPR membership). Empty if the AI cannot tell.
   */
  tracts: z
    .array(
      z.object({
        code: z.string(),
        grossAcres: z.string().optional(),
        nprGroups: z.array(z.string()).optional(),
        notes: z.string().optional(),
      })
    )
    .default([]),
  /** Clarifying questions the AI wants the user to answer before applying. */
  clarifyingQuestions: z.array(z.string()).default([]),
  /** Anything the user should know — texas-active vs federal-reference, fixed/floating ambiguity, etc. */
  warnings: z.array(z.string()).default([]),
});
export type WorkspaceImportProposal = z.infer<typeof workspaceImportProposalSchema>;
