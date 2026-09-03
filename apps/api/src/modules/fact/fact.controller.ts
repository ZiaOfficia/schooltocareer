import type { Request, Response } from 'express';

import {
  factApproveSchema,
  factChangeListQuerySchema,
  factDecisionSchema,
} from '@stc/validation';

import { sendOk, sendPaginated, setPrivateNoStore } from '../../core/http/response.js';
import { validBody, validQuery } from '../../middleware/validate.js';

import type { FactService } from './fact.service.js';

/**
 * HTTP layer only — read validated input, call one service method, shape the
 * response. Every route here is admin-only, so every response is
 * `private, no-store`: a review queue must never be cached by a proxy, and a
 * proposed exam date is not public information until someone approves it.
 */
export class FactController {
  constructor(private readonly service: FactService) {}

  listChanges = async (req: Request, res: Response): Promise<void> => {
    const query = validQuery(req, factChangeListQuerySchema);
    const page = await this.service.listChanges({
      page: query.page,
      perPage: query.perPage,
      status: query.status,
      risk: query.risk,
      ownerId: query.ownerId,
      factType: query.factType,
    });
    setPrivateNoStore(res);
    sendPaginated(res, page.items, page.meta);
  };

  getChange = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    setPrivateNoStore(res);
    sendOk(res, await this.service.getChange(id));
  };

  approve = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const input = validBody(req, factApproveSchema);
    setPrivateNoStore(res);
    sendOk(res, await this.service.approve(id, input));
  };

  reject = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const input = validBody(req, factDecisionSchema);
    setPrivateNoStore(res);
    sendOk(res, await this.service.reject(id, input));
  };

  ignore = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const input = validBody(req, factDecisionSchema);
    setPrivateNoStore(res);
    sendOk(res, await this.service.ignore(id, input));
  };

  /** Fact metrics, kept separate from the Phase 0 source metrics. */
  metrics = async (_req: Request, res: Response): Promise<void> => {
    setPrivateNoStore(res);
    sendOk(res, await this.service.metrics());
  };
}
