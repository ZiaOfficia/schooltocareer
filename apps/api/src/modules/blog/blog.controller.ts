import type { Request, Response } from 'express';

import { PAGINATION, REVALIDATE } from '@stc/constants';

import { getRequestId } from '../../core/context.js';
import { sendCreated, sendNoContent, sendOk, setPrivateNoStore, setPublicCache } from '../../core/http/response.js';
import { validBody, validQuery } from '../../middleware/validate.js';

import type { BlogService } from './blog.service.js';
import {
  postAutosaveSchema,
  postChangeSlugSchema,
  postCreateSchema,
  postListQuerySchema,
  postPublishSchema,
  postRollbackSchema,
  postUpdateSchema,
} from './blog.validation.js';

export class BlogController {
  constructor(private readonly service: BlogService) {}

  listPublic = async (req: Request, res: Response): Promise<void> => {
    const query = validQuery(req, postListQuerySchema);
    const result = await this.service.list(query, { publicOnly: true });
    setPublicCache(res, { sMaxAge: REVALIDATE.ENTITY });
    res.status(200).json({
      ok: true,
      data: result.items,
      meta: { ...result.meta, facets: result.facets },
      requestId: getRequestId(),
    });
  };

  /** Public read by full canonical path, e.g. /blog/exam-prep/how-to-crack-jee. */
  getPublicByPath = async (req: Request, res: Response): Promise<void> => {
    const splat = req.params['splat'];
    const path = (Array.isArray(splat) ? splat.join('/') : String(splat ?? '')).replace(/\/+$/, '');
    setPublicCache(res, { sMaxAge: REVALIDATE.ENTITY });
    sendOk(res, await this.service.getPublicByPath(`/${path}`));
  };

  search = async (req: Request, res: Response): Promise<void> => {
    const q = typeof req.query['q'] === 'string' ? req.query['q'] : '';
    const limit = Math.min(Number(req.query['limit'] ?? PAGINATION.SEARCH_PER_PAGE), 50);
    setPublicCache(res, { sMaxAge: 300 });
    sendOk(res, await this.service.search(q, limit));
  };

  listAdmin = async (req: Request, res: Response): Promise<void> => {
    const query = validQuery(req, postListQuerySchema);
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

  /**
   * Preview of unpublished content.
   *
   * ALWAYS no-store. A previewed draft that lands in a shared cache becomes a
   * public page nobody meant to publish.
   */
  preview = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    setPrivateNoStore(res);
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    sendOk(res, await this.service.getPreview(id));
  };

  listRevisions = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    setPrivateNoStore(res);
    sendOk(res, await this.service.listRevisions(id));
  };

  listActiveDrafts = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    setPrivateNoStore(res);
    sendOk(res, await this.service.listActiveDrafts(id));
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const post = await this.service.create(validBody(req, postCreateSchema));
    sendCreated(res, post, post.path);
  };

  autosave = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    setPrivateNoStore(res);
    sendOk(res, await this.service.autosave(id, validBody(req, postAutosaveSchema)));
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    sendOk(res, await this.service.update(id, validBody(req, postUpdateSchema)));
  };

  publish = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    sendOk(res, await this.service.publish(id, validBody(req, postPublishSchema)));
  };

  unpublish = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    sendOk(res, await this.service.unpublish(id));
  };

  rollback = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    sendOk(res, await this.service.rollback(id, validBody(req, postRollbackSchema)));
  };

  changeSlug = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const input = validBody(req, postChangeSlugSchema);
    sendOk(res, await this.service.changeSlug(id, input.newSlug, input.reason ?? 'manual'));
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    await this.service.softDelete(id);
    sendNoContent(res);
  };
}