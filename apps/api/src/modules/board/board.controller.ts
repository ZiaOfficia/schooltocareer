import type { Request, Response } from 'express';

import { PAGINATION, REVALIDATE } from '@stc/constants';

import {
  sendCreated,
  sendOk,
  sendPaginated,
  setPrivateNoStore,
  setPublicCache,
} from '../../core/http/response.js';
import { validBody, validQuery } from '../../middleware/validate.js';

import type { BoardService } from './board.service.js';
import {
  boardChangeSlugSchema,
  boardCreateSchema,
  boardListQuerySchema,
  boardUpdateSchema,
} from './board.validation.js';

/** HTTP only. Same shape as ExamController - read input, call one method, respond. */
export class BoardController {
  constructor(private readonly service: BoardService) {}

  listPublic = async (req: Request, res: Response): Promise<void> => {
    const query = validQuery(req, boardListQuerySchema);
    const page = await this.service.list(query, { publicOnly: true });
    setPublicCache(res, { sMaxAge: REVALIDATE.ENTITY });
    sendPaginated(res, page.items, page.meta);
  };

  listFeed = async (req: Request, res: Response): Promise<void> => {
    const query = validQuery(req, boardListQuerySchema);
    const page = await this.service.listCursor({
      ...(typeof req.query['cursor'] === 'string' ? { cursor: req.query['cursor'] } : {}),
      perPage: query.perPage,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
    });
    setPublicCache(res, { sMaxAge: REVALIDATE.ENTITY });
    sendPaginated(res, page.items, page.meta);
  };

  getPublicBySlug = async (req: Request, res: Response): Promise<void> => {
    const { slug } = req.params as { slug: string };
    setPublicCache(res, { sMaxAge: REVALIDATE.ENTITY });
    sendOk(res, await this.service.getPublicBySlug(slug));
  };

  search = async (req: Request, res: Response): Promise<void> => {
    const q = typeof req.query['q'] === 'string' ? req.query['q'] : '';
    const limit = Math.min(Number(req.query['limit'] ?? PAGINATION.SEARCH_PER_PAGE), 50);
    setPublicCache(res, { sMaxAge: 300 });
    sendOk(res, await this.service.search(q, limit));
  };

  listPopularSlugs = async (_req: Request, res: Response): Promise<void> => {
    setPublicCache(res, { sMaxAge: REVALIDATE.SITEMAP });
    sendOk(res, await this.service.listPopularSlugs());
  };

  listAdmin = async (req: Request, res: Response): Promise<void> => {
    const query = validQuery(req, boardListQuerySchema);
    const page = await this.service.list(query, { publicOnly: false });
    setPrivateNoStore(res);
    sendPaginated(res, page.items, page.meta);
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    setPrivateNoStore(res);
    sendOk(res, await this.service.getById(id, { includeDeleted: true }));
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const board = await this.service.create(validBody(req, boardCreateSchema));
    sendCreated(res, board, `/api/v1/boards/${board.slug}`);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    sendOk(res, await this.service.update(id, validBody(req, boardUpdateSchema)));
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
    const input = validBody(req, boardChangeSlugSchema);
    sendOk(res, await this.service.changeSlug(id, input.newSlug, input.reason ?? 'manual'));
  };

  /**
   * Returns the cascade counts rather than 204, so the admin can report
   * "deleted 12 classes, 96 subjects, 1,240 chapters" instead of silently
   * removing a thousand pages.
   */
  remove = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    sendOk(res, { deleted: await this.service.softDelete(id) });
  };

  restore = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    sendOk(res, await this.service.restore(id));
  };
}