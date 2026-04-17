/**
 * Ask the configured model to classify every sheet and propose column mappings.
 *
 * Uses Vercel AI SDK's `generateObject` for schema-enforced output. Keep the
 * prompt compact — spreadsheet content dominates the token budget. Nothing
 * here mutates workspace state; the caller treats the result as a preview.
 */
import { generateObject } from 'ai';
import { resolveModel } from '../client';
import { useAISettingsStore } from '../settings-store';
import {
  workspaceImportProposalSchema,
  type WorkspaceImportProposal,
} from './schemas';
import {
  renderWorkbookForPrompt,
  type ParsedWorkbook,
} from './parse-workbook';

const WIZARD_SYSTEM_PROMPT = `You are the LANDroid spreadsheet-import wizard.

Your job: classify each sheet in the uploaded workbook and propose a column mapping. You DO NOT apply changes — your output is a preview the landman will review and approve.

# Ground rules

1. Texas-only active math. If a sheet looks federal/BLM, mark it "ignore" and note it in warnings — never treat it as an active-math source.
2. Distinguish interest types precisely:
   - mineral-title — chain-of-title for mineral ownership (grantor/grantee deeds)
   - npri-title — non-participating royalty title chain (NPR 1, NPR 2)
   - leasehold-runsheet — lease chain: lessors, lessees, ratifications, assignments
   - status-summary — final per-lessor x per-tract matrix (output, not raw input)
   - document-list — index of source instruments
   - tract-map — tract legend / map metadata
   - ignore — unrelated or federal/BLM
   - unknown — cannot classify
3. Recognise per-tract sheets. Sheet names like "Title-Tr.2-(1)-106.19 ac." or "NPR 1-Title-Tr.2,3,5&6" encode the tract code and acreage. Extract them into tractCode/tractCodes and tracts[].
4. Runsheet sheets frequently have two-row headers (first row has categories, second row has column labels like "Grantor", "Grantee", "Instrument No."). Read both rows when detecting column labels.
5. Column-map values must be canonical LANDroid field names:
   - title/mineral: grantor, grantee, instrument, docNo, vol, page, date, fileDate, landDesc, remarks, fraction, royaltyKind
   - leasehold: lessor, lessee, royaltyRate, leaseStatus, effectiveDate, expirationDate
   - status matrix: mineralInterest, grossAcres, mineralAcres, nri, leaseStatus, royaltyRate, bonus
6. Preserve exact instrument language — don't rewrite "1/3 x 17/84 MI" into modern notation in your notes.
7. Flag fixed-vs-floating NPRI ambiguity as a clarifying question rather than guessing.
8. Flag branch-vs-whole-tract fraction ambiguity as a clarifying question.
9. If a sheet's header looks like it's the user's final status/output rather than raw input, mark it "status-summary" and warn that LANDroid should not ingest it as source data.

# Output

Return the full proposal object. If a field is genuinely unknowable from the data, omit it rather than guessing.`;

export async function analyzeWorkbook(
  parsed: ParsedWorkbook
): Promise<WorkspaceImportProposal> {
  const settings = useAISettingsStore.getState();
  const model = resolveModel(settings);

  const rendered = renderWorkbookForPrompt(parsed);

  const { object } = await generateObject({
    model,
    system: WIZARD_SYSTEM_PROMPT,
    schema: workspaceImportProposalSchema,
    prompt: `Classify every sheet in this workbook and propose column mappings.

${rendered}`,
  });

  return object;
}
