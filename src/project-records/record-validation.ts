import { z } from 'zod';
import {
  BACKEND_SPINE_CONTRACT_VERSION,
  BackendSpineCoreRecordSchema,
  BackendSpineRecordValidationRequestSchema,
  type BackendSpineCoreRecord,
  type BackendSpineRecordValidationRequest,
} from '../backend-spine/contracts';

const IsoDateTimeSchema = z.string().datetime({ offset: true });
const IdSchema = z.string().trim().min(1).max(160);

export const ProjectRecordBundleSchema = z.object({
  contractVersion: z.literal(BACKEND_SPINE_CONTRACT_VERSION),
  workspaceId: IdSchema,
  projectId: IdSchema,
  generatedAt: IsoDateTimeSchema,
  records: z.array(BackendSpineCoreRecordSchema),
}).strict();
export type ProjectRecordBundle = z.infer<typeof ProjectRecordBundleSchema>;

export function buildProjectRecordBundle(input: {
  workspaceId: string;
  projectId: string;
  generatedAt: string;
  records: BackendSpineCoreRecord[];
}): ProjectRecordBundle {
  return ProjectRecordBundleSchema.parse({
    contractVersion: BACKEND_SPINE_CONTRACT_VERSION,
    ...input,
  });
}

export function parseProjectRecordBundle(input: unknown): ProjectRecordBundle {
  return ProjectRecordBundleSchema.parse(input);
}

export function buildRecordValidationRequest(
  records: BackendSpineCoreRecord[]
): BackendSpineRecordValidationRequest {
  return BackendSpineRecordValidationRequestSchema.parse({ records });
}

