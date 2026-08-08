import type { Request, Response } from 'express';

import { PAGINATION, REVALIDATE } from '@stc/constants';

import { sendCreated, sendNoContent, sendOk, setPrivateNoStore, setPublicCache } from '../../core/http/response.js';
import { getRequestId } from '../../core/context.js';
import { validBody, validQuery } from '../../middleware/validate.js';

import type { QuestionPaperService } from './question-paper.service.js';
import {
  questionPaperChangeSlugSchema,
  questionPaperCreateSchema,
  questionPaperFeedQuerySchema,
  questionPaperFileSchema,
  questionPaperListQuerySchema,
  questionPaperUpdateSchema,
} from './question-paper.validation.js';

export class QuestionPaperController {
  constructor(private readonly service: QuestionPaperService) {}

  /**
   * Faceted browse. The response carries `facets` alongside `data`, so the
   * filter panel and the results arrive in one round trip.
   */
  listPublic = async (req: Request, res: Response): Promise<void> => {
    const query = validQuery(req, questionPaperListQuerySchema);
    const result = await this.service.list(query, { publicOnly: true });
    setPublicCache(res, { sMaxAge: REVALIDATE.LONG_TAIL });
    res.status(200).json({
      ok: true,
      data: result.items,
      meta: { ...result.meta, facets: result.facets },
      requestId: getRequestId(),
    });
  };

  listFeed = async (req: Request, res: Response): Promise<void> => {
    const query = validQuery(req, questionPaperFeedQuerySchema);
    const page = await this.service.listCursor(query);
    setPublicCache(res, { sMaxAge: REVALIDATE.LONG_TAIL });
    res.status(200).json({ ok: true, data: page.items, meta: page.meta, requestId: getRequestId() });
  };

  getPublicBySlug = async (req: Request, res: Response): Promise<void> => {
    const { slug } = req.params as { slug: string };
    setPublicCache(res, { sMaxAge: REVALIDATE.LONG_TAIL });
    sendOk(res, await this.service.getPublicBySlug(slug));
  };

  search = async (req: Request, res: Response): Promise<void> => {
    const q = typeof req.query['q'] === 'string' ? req.query['q'] : '';
    const limit = Math.min(Number(req.query['limit'] ?? PAGINATION.SEARCH_PER_PAGE), 50);
    setPublicCache(res, { sMaxAge: 300 });
    sendOk(res, await this.service.search(q, limit));
  };

  listAdmin = async (req: Request, res: Response): Promise<void> => {
    const query = validQuery(req, questionPaperListQuerySchema);
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

  listFileVersions = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    setPrivateNoStore(res);
    sendOk(res, await this.service.listFileVersions(id));
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const paper = await this.service.create(validBody(req, questionPaperCreateSchema));
    sendCreated(res, paper, paper.path);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    sendOk(res, await this.service.update(id, validBody(req, questionPaperUpdateSchema)));
  };

  addFile = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const result = await this.service.addFile(id, validBody(req, questionPaperFileSchema));
    sendCreated(res, result);
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
    const input = validBody(req, questionPaperChangeSlugSchema);
    sendOk(res, await this.service.changeSlug(id, input.newSlug, input.reason ?? 'manual'));
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    await this.service.softDelete(id);
    sendNoContent(res);
  };
}