import type { Request, Response } from 'express';

import { REVALIDATE } from '@stc/constants';

import { sendCreated, sendOk, sendPaginated, setPrivateNoStore, setPublicCache } from '../../core/http/response.js';
import { validBody, validQuery } from '../../middleware/validate.js';

import type { CategoryService } from './category.service.js';
import {
  categoryChangeSlugSchema,
  categoryCreateSchema,
  categoryListQuerySchema,
  categoryMoveSchema,
  categoryUpdateSchema,
} from './category.validation.js';

export class CategoryController {
  constructor(private readonly service: CategoryService) {}

  getTree = async (req: Request, res: Response): Promise<void> => {
    const type = typeof req.query['type'] === 'string' ? req.query['type'] : undefined;
    setPublicCache(res, { sMaxAge: REVALIDATE.ENTITY });
    sendOk(res, await this.service.getTree(type));
  };

  getPublicBySlug = async (req: Request, res: Response): Promise<void> => {
    const { slug } = req.params as { slug: string };
    setPublicCache(res, { sMaxAge: REVALIDATE.ENTITY });
    sendOk(res, await this.service.getPublicBySlug(slug));
  };

  listAdmin = async (req: Request, res: Response): Promise<void> => {
    const page = await this.service.list(validQuery(req, categoryListQuerySchema));
    setPrivateNoStore(res);
    sendPaginated(res, page.items, page.meta);
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    setPrivateNoStore(res);
    sendOk(res, await this.service.getById(id));
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const category = await this.service.create(validBody(req, categoryCreateSchema));
    sendCreated(res, category, category.path);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    sendOk(res, await this.service.update(id, validBody(req, categoryUpdateSchema)));
  };

  move = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const input = validBody(req, categoryMoveSchema);
    sendOk(res, await this.service.move(id, input.parentId));
  };

  changeSlug = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const input = validBody(req, categoryChangeSlugSchema);
    sendOk(res, await this.service.changeSlug(id, input.newSlug, input.reason ?? 'manual'));
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    sendOk(res, await this.service.softDelete(id));
  };
}