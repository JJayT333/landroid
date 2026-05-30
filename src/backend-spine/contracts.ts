import { z } from 'zod';

export const BACKEND_SPINE_CONTRACT_VERSION = 1;

export const BackendSpineRecordTypeSchema = z.enum([
  'project',
  'workspace_manifest',
  'party',
  'party_alias',
  'document',
  'document_version',
  'vault_object',
  'document_link',
  'source_citation',
  'citation_anchor',
  'source_attestation',
  'instrument_record',
  'tract',
  'desk_map',
  'lease',
  'unit',
  'wellbore',
  'interest_reference',
  'curative_issue',
  'lease_obligation',
  'obligation_event',
  'import_session',
  'action_plan',
  'action_record',
  'audit_event',
  'packet',
  'packet_item',
  'packet_export',
]);
export type BackendSpineRecordType = z.infer<typeof BackendSpineRecordTypeSchema>;

export const BackendSpineRecordSourceSchema = z.enum([
  'local',
  'backend',
  'import',
  'migration',
  'system',
]);
export type BackendSpineRecordSource = z.infer<typeof BackendSpineRecordSourceSchema>;

export const BackendSpineSyncStateSchema = z.enum([
  'local_only',
  'clean',
  'dirty',
  'pending_delete',
  'conflict',
]);
export type BackendSpineSyncState = z.infer<typeof BackendSpineSyncStateSchema>;

const IsoDateTimeSchema = z.string().datetime({ offset: true });
const IsoDateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const NonEmptyStringSchema = z.string().trim().min(1);
const IdSchema = NonEmptyStringSchema.max(160);
const ContentHashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const UnknownJsonObjectSchema = z.record(z.string(), z.unknown());

export const RecordEnvelopeSchema = z.object({
  recordId: IdSchema,
  recordType: BackendSpineRecordTypeSchema,
  workspaceId: IdSchema,
  projectId: IdSchema,
  schemaVersion: z.literal(BACKEND_SPINE_CONTRACT_VERSION),
  lastModified: IsoDateTimeSchema,
  revision: z.number().int().nonnegative(),
  deletedAt: IsoDateTimeSchema.nullable().optional(),
  source: BackendSpineRecordSourceSchema,
  syncState: BackendSpineSyncStateSchema.optional(),
}).strict();
export type RecordEnvelope = z.infer<typeof RecordEnvelopeSchema>;

export const ProjectRecordSchema = RecordEnvelopeSchema.extend({
  recordType: z.literal('project'),
  name: NonEmptyStringSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
}).strict();
export type ProjectRecord = z.infer<typeof ProjectRecordSchema>;

export const WorkspaceManifestRecordSchema = RecordEnvelopeSchema.extend({
  recordType: z.literal('workspace_manifest'),
  landroidFileVersion: z.number().int().positive(),
  projectName: NonEmptyStringSchema,
  generatedAt: IsoDateTimeSchema,
  recordCounts: z.partialRecord(BackendSpineRecordTypeSchema, z.number().int().nonnegative()),
  packageHash: ContentHashSchema.optional(),
}).strict();
export type WorkspaceManifestRecord = z.infer<typeof WorkspaceManifestRecordSchema>;

export const PartyRecordSchema = RecordEnvelopeSchema.extend({
  recordType: z.literal('party'),
  displayName: NonEmptyStringSchema,
  partyType: z.enum(['person', 'company', 'trust', 'estate', 'government', 'unknown']),
  externalPartyId: IdSchema.nullable().optional(),
}).strict();
export type PartyRecord = z.infer<typeof PartyRecordSchema>;

export const PartyAliasRecordSchema = RecordEnvelopeSchema.extend({
  recordType: z.literal('party_alias'),
  partyId: IdSchema,
  alias: NonEmptyStringSchema,
  sourceRecordId: IdSchema.optional(),
}).strict();
export type PartyAliasRecord = z.infer<typeof PartyAliasRecordSchema>;

export const BackendDocumentRecordSchema = RecordEnvelopeSchema.extend({
  recordType: z.literal('document'),
  documentId: IdSchema,
  displayTitle: NonEmptyStringSchema,
  fileName: NonEmptyStringSchema,
  mimeType: NonEmptyStringSchema,
  byteLength: z.number().int().nonnegative(),
  contentHash: ContentHashSchema,
  originalVaultObjectId: IdSchema.optional(),
}).strict();
export type BackendDocumentRecord = z.infer<typeof BackendDocumentRecordSchema>;

export const DocumentVersionRecordSchema = RecordEnvelopeSchema.extend({
  recordType: z.literal('document_version'),
  documentId: IdSchema,
  versionLabel: NonEmptyStringSchema,
  vaultObjectId: IdSchema,
  contentHash: ContentHashSchema,
  createdAt: IsoDateTimeSchema,
}).strict();
export type DocumentVersionRecord = z.infer<typeof DocumentVersionRecordSchema>;

export const VaultObjectRecordSchema = RecordEnvelopeSchema.extend({
  recordType: z.literal('vault_object'),
  objectId: IdSchema,
  objectKind: z.enum(['original', 'derivative', 'text', 'packet_copy', 'index']),
  contentHash: ContentHashSchema,
  byteLength: z.number().int().nonnegative(),
  storageRef: NonEmptyStringSchema,
  localOnly: z.boolean().default(false),
}).strict();
export type VaultObjectRecord = z.infer<typeof VaultObjectRecordSchema>;

export const DocumentLinkRecordSchema = RecordEnvelopeSchema.extend({
  recordType: z.literal('document_link'),
  documentId: IdSchema,
  entityKind: z.enum([
    'node',
    'owner',
    'lease',
    'curative',
    'research',
    'tract',
    'unit',
    'source_attestation',
    'import_row',
    'packet',
  ]),
  entityId: IdSchema,
  position: z.number().int().nonnegative(),
}).strict();
export type DocumentLinkRecord = z.infer<typeof DocumentLinkRecordSchema>;

export const SourceCitationRecordSchema = RecordEnvelopeSchema.extend({
  recordType: z.literal('source_citation'),
  documentId: IdSchema.optional(),
  documentVersionId: IdSchema.optional(),
  extractionRunId: IdSchema.optional(),
  citedRecordId: IdSchema.optional(),
  pageNumber: z.number().int().positive().optional(),
  quotedText: z.string().optional(),
  quotedTextHash: ContentHashSchema.optional(),
  confidence: z.enum(['supported', 'partial', 'conflicting', 'insufficient']),
}).strict();
export type SourceCitationRecord = z.infer<typeof SourceCitationRecordSchema>;

export const CitationAnchorRecordSchema = RecordEnvelopeSchema.extend({
  recordType: z.literal('citation_anchor'),
  sourceCitationId: IdSchema,
  pageNumber: z.number().int().positive().optional(),
  charStart: z.number().int().nonnegative().optional(),
  charEnd: z.number().int().nonnegative().optional(),
  bbox: z.array(z.number().finite()).length(4).optional(),
}).strict();
export type CitationAnchorRecord = z.infer<typeof CitationAnchorRecordSchema>;

export const SourceAttestationRecordSchema = RecordEnvelopeSchema.extend({
  recordType: z.literal('source_attestation'),
  sourceType: z.enum([
    'patent',
    'spanish_grant',
    'title_opinion',
    'division_order',
    'probate_inventory',
    'prior_chain',
    'working_assumption',
    'other',
  ]),
  documentId: IdSchema.optional(),
  effectiveDate: IsoDateOnlySchema.optional(),
  attestor: z.string().optional(),
  scope: z.string().optional(),
  status: z.enum(['draft', 'active', 'superseded', 'rejected']),
}).strict();
export type SourceAttestationRecord = z.infer<typeof SourceAttestationRecordSchema>;

export const InstrumentRecordSchema = RecordEnvelopeSchema.extend({
  recordType: z.literal('instrument_record'),
}).strict();
export type InstrumentRecord = z.infer<typeof InstrumentRecordSchema>;

export const TractRecordSchema = RecordEnvelopeSchema.extend({
  recordType: z.literal('tract'),
}).strict();
export type TractRecord = z.infer<typeof TractRecordSchema>;

export const DeskMapRecordSchema = RecordEnvelopeSchema.extend({
  recordType: z.literal('desk_map'),
}).strict();
export type DeskMapRecord = z.infer<typeof DeskMapRecordSchema>;

export const LeaseRecordSchema = RecordEnvelopeSchema.extend({
  recordType: z.literal('lease'),
}).strict();
export type LeaseRecord = z.infer<typeof LeaseRecordSchema>;

export const UnitRecordSchema = RecordEnvelopeSchema.extend({
  recordType: z.literal('unit'),
}).strict();
export type UnitRecord = z.infer<typeof UnitRecordSchema>;

export const WellboreRecordSchema = RecordEnvelopeSchema.extend({
  recordType: z.literal('wellbore'),
}).strict();
export type WellboreRecord = z.infer<typeof WellboreRecordSchema>;

export const InterestReferenceRecordSchema = RecordEnvelopeSchema.extend({
  recordType: z.literal('interest_reference'),
}).strict();
export type InterestReferenceRecord = z.infer<typeof InterestReferenceRecordSchema>;

export const CurativeIssueRecordSchema = RecordEnvelopeSchema.extend({
  recordType: z.literal('curative_issue'),
}).strict();
export type CurativeIssueRecord = z.infer<typeof CurativeIssueRecordSchema>;

export const LeaseObligationRecordSchema = RecordEnvelopeSchema.extend({
  recordType: z.literal('lease_obligation'),
}).strict();
export type LeaseObligationRecord = z.infer<typeof LeaseObligationRecordSchema>;

export const ObligationEventRecordSchema = RecordEnvelopeSchema.extend({
  recordType: z.literal('obligation_event'),
}).strict();
export type ObligationEventRecord = z.infer<typeof ObligationEventRecordSchema>;

export const ImportSessionRecordSchema = RecordEnvelopeSchema.extend({
  recordType: z.literal('import_session'),
  importKind: z.enum(['runsheet', 'title_opinion', 'document_folder', 'rrc', 'other']),
  status: z.enum(['draft', 'parsed', 'staged', 'approved', 'applied', 'rejected', 'failed']),
  sourceDocumentIds: z.array(IdSchema).default([]),
  createdAt: IsoDateTimeSchema,
}).strict();
export type ImportSessionRecord = z.infer<typeof ImportSessionRecordSchema>;

export const ActionPlanRecordSchema = RecordEnvelopeSchema.extend({
  recordType: z.literal('action_plan'),
  actionKind: NonEmptyStringSchema,
  status: z.enum(['draft', 'needs_review', 'approved', 'rejected', 'applied', 'failed']),
  proposedBy: z.enum(['user', 'ai', 'import', 'system']),
  summary: NonEmptyStringSchema,
  input: UnknownJsonObjectSchema,
}).strict();
export type ActionPlanRecord = z.infer<typeof ActionPlanRecordSchema>;

export const ActionRecordSchema = RecordEnvelopeSchema.extend({
  recordType: z.literal('action_record'),
  actionPlanId: IdSchema.optional(),
  actionKind: NonEmptyStringSchema,
  status: z.enum(['applied', 'failed', 'undone']),
  approvedBy: z.enum(['user', 'system']),
  appliedAt: IsoDateTimeSchema,
  result: UnknownJsonObjectSchema,
}).strict();
export type ActionRecord = z.infer<typeof ActionRecordSchema>;

export const AuditEventRecordSchema = RecordEnvelopeSchema.extend({
  recordType: z.literal('audit_event'),
  eventKind: NonEmptyStringSchema,
  actorKind: z.enum(['user', 'system', 'ai', 'import']),
  actorId: z.string().optional(),
  subjectRecordIds: z.array(IdSchema).default([]),
  occurredAt: IsoDateTimeSchema,
  previousHash: ContentHashSchema.optional(),
  eventHash: ContentHashSchema.optional(),
  details: UnknownJsonObjectSchema,
}).strict();
export type AuditEventRecord = z.infer<typeof AuditEventRecordSchema>;

export const PacketRecordSchema = RecordEnvelopeSchema.extend({
  recordType: z.literal('packet'),
}).strict();
export type PacketRecord = z.infer<typeof PacketRecordSchema>;

export const PacketItemRecordSchema = RecordEnvelopeSchema.extend({
  recordType: z.literal('packet_item'),
}).strict();
export type PacketItemRecord = z.infer<typeof PacketItemRecordSchema>;

export const PacketExportRecordSchema = RecordEnvelopeSchema.extend({
  recordType: z.literal('packet_export'),
}).strict();
export type PacketExportRecord = z.infer<typeof PacketExportRecordSchema>;

export const BackendSpineCoreRecordSchema = z.discriminatedUnion('recordType', [
  ProjectRecordSchema,
  WorkspaceManifestRecordSchema,
  PartyRecordSchema,
  PartyAliasRecordSchema,
  BackendDocumentRecordSchema,
  DocumentVersionRecordSchema,
  VaultObjectRecordSchema,
  DocumentLinkRecordSchema,
  SourceCitationRecordSchema,
  CitationAnchorRecordSchema,
  SourceAttestationRecordSchema,
  InstrumentRecordSchema,
  TractRecordSchema,
  DeskMapRecordSchema,
  LeaseRecordSchema,
  UnitRecordSchema,
  WellboreRecordSchema,
  InterestReferenceRecordSchema,
  CurativeIssueRecordSchema,
  LeaseObligationRecordSchema,
  ObligationEventRecordSchema,
  ImportSessionRecordSchema,
  ActionPlanRecordSchema,
  ActionRecordSchema,
  AuditEventRecordSchema,
  PacketRecordSchema,
  PacketItemRecordSchema,
  PacketExportRecordSchema,
]);
export type BackendSpineCoreRecord = z.infer<typeof BackendSpineCoreRecordSchema>;

export const BackendSpineHealthResponseSchema = z.object({
  ok: z.boolean(),
  service: z.literal('landroid-backend-spine'),
  contractVersion: z.literal(BACKEND_SPINE_CONTRACT_VERSION),
  mode: z.enum(['local-only', 'mock', 'hosted']),
  serverTime: IsoDateTimeSchema,
}).strict();
export type BackendSpineHealthResponse = z.infer<typeof BackendSpineHealthResponseSchema>;

export const BackendSpineSessionResponseSchema = BackendSpineHealthResponseSchema.extend({
  authenticated: z.boolean(),
  userSub: z.string().nullable(),
}).strict();
export type BackendSpineSessionResponse = z.infer<typeof BackendSpineSessionResponseSchema>;

export const BackendSpineRecordValidationRequestSchema = z.object({
  records: z.array(BackendSpineCoreRecordSchema).max(500),
}).strict();
export type BackendSpineRecordValidationRequest = z.infer<
  typeof BackendSpineRecordValidationRequestSchema
>;

export const BackendSpineValidationIssueSchema = z.object({
  index: z.number().int().nonnegative(),
  path: z.array(z.union([z.string(), z.number()])),
  message: z.string(),
}).strict();
export type BackendSpineValidationIssue = z.infer<typeof BackendSpineValidationIssueSchema>;

export const BackendSpineRecordValidationResponseSchema = BackendSpineHealthResponseSchema.extend({
  valid: z.boolean(),
  acceptedCount: z.number().int().nonnegative(),
  issues: z.array(BackendSpineValidationIssueSchema),
}).strict();
export type BackendSpineRecordValidationResponse = z.infer<
  typeof BackendSpineRecordValidationResponseSchema
>;

export function parseBackendSpineCoreRecord(input: unknown): BackendSpineCoreRecord {
  return BackendSpineCoreRecordSchema.parse(input);
}

export function parseBackendSpineValidationRequest(
  input: unknown
): BackendSpineRecordValidationRequest {
  return BackendSpineRecordValidationRequestSchema.parse(input);
}
