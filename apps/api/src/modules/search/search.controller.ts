import type { Request, Response } from 'express';

import { REVALIDATE } from '@stc/constants';

import { sendOk, setPrivateNoStore, setPublicCache } from '../../core/http/response.js';
import { validBody, validQuery } from '../../middleware/validate.js';

import type { SearchService } from './search.service.js';
import {
  reindexSchema,
  searchAnalyticsQuerySchema,
  searchQuerySchema,
  suggestQuerySchema,
} from './search.validation.js';

export class SearchController {
  constructor(private readonly service: SearchService) {}

  /**
   * Search results are cached briefly at the edge.
   *
   * Popular queries repeat constantly, and a 60-second window turns a spike of
   * identical searches into one database hit - without which a trending exam
   * name is a self-inflicted load test.
   */
  search = async (req: Request, res: Response): Promise<void> => {
    const query = validQuery(req, searchQuerySchema);
    setPublicCache(res, { sMaxAge: REVALIDATE.VOLATILE, staleWhileRevalidate: 300 });
    // A search results page must never be indexed - it is the classic source of
    // thin, near-duplicate URLs.
    res.setHeader('X-Robots-Tag', 'noindex, follow');
    sendOk(res, await this.service.search(query));
  };

  suggest = async (req: Request, res: Response): Promise<void> => {
    const query = validQuery(req, suggestQuerySchema);
    setPublicCache(res, { sMaxAge: 60, staleWhileRevalidate: 600 });
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    sendOk(res, await this.service.suggest(query));
  };

  health = async (_req: Request, res: Response): Promise<void> => {
    setPrivateNoStore(res);
    sendOk(res, await this.service.health());
  };

  analytics = async (req: Request, res: Response): Promise<void> => {
    const { days } = validQuery(req, searchAnalyticsQuerySchema);
    setPrivateNoStore(res);
    sendOk(res, await this.service.analytics(days));
  };

  reindex = async (req: Request, res: Response): Promise<void> => {
    const input = validBody(req, reindexSchema);
    setPrivateNoStore(res);
    sendOk(res, await this.service.reindex(input.ownerType ? { ownerType: input.ownerType } : {}));
  };
}