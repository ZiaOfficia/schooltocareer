import type { Request, Response } from 'express';

import { PAGINATION, REVALIDATE } from '@stc/constants';
import {
  examChangeSlugSchema,
  examCreateSchema,
  examListQuerySchema,
  examUpdateSchema,
} from '@stc/validation';

import {
  sendCreated,
  sendNoContent,
  sendOk,
  sendPaginated,
  setPrivateNoStore,
  setPublicCache,
} from '../../core/http/response.js';
import { validBody, validQuery } from '../../middleware/validate.js';

import type { ExamService } from './exam.service.js';

/**
 * HTTP layer only: read validated input, call one service method, shape the
 * response. No business logic, no conditionals about domain rules, no database.
 *
 * If a controller method grows past ~10 lines, the logic belongs in the service.
 */
export class ExamController {
  constructor(private readonly service: ExamService) {}

  // ── Public ───────────────────────────────────────────────────────────────

  listPublic = async (req: Request, res: Response): Promise<void> => {
    const query = validQuery(req, examListQuerySchema);
    const page = await this.service.list(query, { publicOnly: true });
    setPublicCache(res, { sMaxAge: REVALIDATE.ENTITY });
    sendPaginated(res, page.items, page.meta);
  };

  listFeed = async (req: Request, res: Response): Promise<void> => {
    const query = validQuery(req, examListQuerySchema);
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
    const exam = await this.service.getPublicBySlug(slug);
    setPublicCache(res, { sMaxAge: REVALIDATE.ENTITY });
    sendOk(res, exam);
  };

  search = async (req: Request, res: Response): Promise<void> => {
    const q = typeof req.query['q'] === 'string' ? req.query['q'] : '';
    const limit = Math.min(Number(req.query['limit'] ?? PAGINATION.SEARCH_PER_PAGE), 50);
    const results = await this.service.search(q, limit);
    setPublicCache(res, { sMaxAge: 300 });
    sendOk(res, results);
  };

  /** Consumed by the web app's generateStaticParams at build time. */
  listPopularSlugs = async (_req: Request, res: Response): Promise<void> => {
    const slugs = await this.service.listPopularSlugs();
    setPublicCache(res, { sMaxAge: REVALIDATE.SITEMAP });
    sendOk(res, slugs);
  };

  // ── Admin ────────────────────────────────────────────────────────────────

  listAdmin = async (req: Request, res: Response): Promise<void> => {
    const query = validQuery(req, examListQuerySchema);
    const page = await this.service.list(query, { publicOnly: false });
    setPrivateNoStore(res);
    sendPaginated(res, page.items, page.meta);
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const exam = await this.service.getById(id, { includeDeleted: true });
    setPrivateNoStore(res);
    sendOk(res, exam);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const input = validBody(req, examCreateSchema);
    const exam = await this.service.create(input);
    sendCreated(res, exam, `/api/v1/exams/${exam.slug}`);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const input = validBody(req, examUpdateSchema);
    sendOk(res, await this.service.update(id, input));
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
    const input = validBody(req, examChangeSlugSchema);
    sendOk(res, await this.service.changeSlug(id, input.newSlug, input.reason ?? 'manual'));
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    await this.service.softDelete(id);
    sendNoContent(res);
  };

  restore = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    sendOk(res, await this.service.restore(id));
  };
}

