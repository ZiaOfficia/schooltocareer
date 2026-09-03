import { z } from 'zod';

import { FACT_REVIEW_STATUS, FACT_RISK, FACT_TYPE } from '@stc/types';

import { cuidSchema, offsetPaginationSchema } from './common.js';

/**
 * Fact-review contracts.
 *
 * The one non-obvious shape here is the decision body. `reason` is OPTIONAL on
 * approve and REQUIRED on reject/ignore, which looks backwards until you read
 * why: an approval of a clean, unambiguous extraction needs no justification —
 * the evidence is the justification — whereas overruling the official source
 * always does. The service adds a second condition on top of this schema and
 * requires a reason for LOW-confidence approvals too; that check cannot live
 * here because it depends on the stored row, not the request.
 */

export const factChangeListQuerySchema = offsetPaginationSchema.extend({
  status: z.enum(FACT_REVIEW_STATUS).optional(),
  risk: z.enum(FACT_RISK).optional(),
  factType: z.enum(FACT_TYPE).optional(),
  ownerId: cuidSchema.optional(),
});

export const factApproveSchema = z.object({
  /**
   * Why this value was accepted. Optional in general, mandatory when the
   * extraction was ambiguous — enforced in the service, which can see the
   * change's confidence.
   */
  reason: z.string().trim().max(1_000).optional(),
});

export const factDecisionSchema = z.object({
  /**
   * Required. A rejected change with no recorded reason is indistinguishable
   * from one nobody looked at, and the next reviewer re-does the work.
   */
  reason: z.string().trim().min(3).max(1_000),
});

export type FactChangeListQuery = z.infer<typeof factChangeListQuerySchema>;
export type FactApproveInput = z.infer<typeof factApproveSchema>;
export type FactDecisionInput = z.infer<typeof factDecisionSchema>;
