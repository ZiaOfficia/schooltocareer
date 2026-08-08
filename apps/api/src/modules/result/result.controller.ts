import type { Request, Response } from 'express';

import { PAGINATION, REVALIDATE } from '@stc/constants';

import { getRequestId } from '../../core/context.js';
import { sendCreated, sendNoContent, sendOk, setPrivateNoStore, setPublicCache } from '../../core/http/response.js';
import { validBody, validQuery } from '../../middleware/validate.js';

import { cacheTtlFor } from './result.service.js';
import type { ResultService } from './result.service.js';
import {
  resultChangeSlugSchema,
  resultCreateSchema,
  resultDeclareSchema,
  resultListQuerySchema,
  resultRetractSchema,
  resultUpdateSchema,
} from './result.validation.js';

export class ResultController {
  constructor(private readonly service: ResultService) {}

  listPublic = async (req: Request, res: Response): Promise<void> => {
    const query = validQuery(req, resultListQuerySchema);
    const result = await this.service.list(query, { publicOnly: true });
    setPublicCache(res, { sMaxAge: REVALIDATE.VOLATILE });
    res.status(200).json({
      ok: true,
      data: result.items,
      meta: { ...result.meta, facets: result.facets },
      requestId: getRequestId(),
    });
  };

  listUpcoming = async (req: Request, res: Response): Promise<void> => {
    const days = Math.min(Number(req.query['days'] ?? 30), 365);
    const limit = Math.min(Number(req.query['limit'] ?? 10), 50);
    setPublicCache(res, { sMaxAge: REVALIDATE.VOLATILE });
    sendOk(res, await this.service.listUpcoming(days, limit));
  };

  /**
   * The CDN TTL mirrors the application cache TTL, so a page in its
   * declaration window is not pinned stale at the edge for an hour.
   */
  getPublicBySlug = async (req: Request, res: Response): Promise<void> => {
    const { slug } = req.params as { slug: string };
    const result = await this.service.getPublicBySlug(slug);
    setPublicCache(res, {
      sMaxAge: cacheTtlFor({
        isDeclared: result.isDeclared,
        declaredAt: result.declaredAt ? new Date(result.declaredAt) : null,
        expectedAt: result.expectedAt ? new Date(result.expectedAt) : null,
      }),
    });
    sendOk(res, result);
  };

  search = async (req: Request, res: Response): Promise<void> => {
    const q = typeof req.query['q'] === 'string' ? req.query['q'] : '';
    const limit = Math.min(Number(req.query['limit'] ?? PAGINATION.SEARCH_PER_PAGE), 50);
    setPublicCache(res, { sMaxAge: 300 });
    sendOk(res, await this.service.search(q, limit));
  };

  listAdmin = async (req: Request, res: Response): Promise<void> => {
    const query = validQuery(req, resultListQuerySchema);
    const result = await this.service.list(query, { publicOnly: false });
    setPrivateNoStore(res);
    res.status(200).json({
      ok: true,
      data: result.items,
      meta: { ...result.meta, facets: result.facets },
      requestId: getRequestId(),
    });
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    setPrivateNoStore(res);
    sendOk(res, await this.service.getById(id));
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.create(validBody(req, resultCreateSchema));
    sendCreated(res, result, result.path);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    sendOk(res, await this.service.update(id, validBody(req, resultUpdateSchema)));
  };

  declare = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    sendOk(res, await this.service.declare(id, validBody(req, resultDeclareSchema)));
  };

  retract = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    sendOk(res, await this.service.retract(id, validBody(req, resultRetractSchema)));
  };

  publish = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    sendOk(res, await this.service.publish(id));
  };

  unpublish = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    sendOk(res, await this.service.unpublish(id));
  };

  changeSlug = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const input = validBody(req, resultChangeSlugSchema);
    sendOk(res, await this.service.changeSlug(id, input.newSlug, input.reason ?? 'manual'));
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    await this.service.softDelete(id);
    sendNoContent(res);
  };
}