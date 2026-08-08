import type { Request, Response } from 'express';

import { sendCreated, sendNoContent, sendOk, sendPaginated, setPrivateNoStore } from '../../core/http/response.js';
import { validBody, validQuery } from '../../middleware/validate.js';

import type { MediaService } from './media.service.js';
import {
  mediaListQuerySchema,
  mediaReplaceSchema,
  mediaUpdateSchema,
  uploadConfirmSchema,
  uploadSignSchema,
} from './media.validation.js';

/**
 * Media is admin-only. Assets are served by the storage CDN directly - the API
 * never proxies bytes, so there is no public read endpoint here.
 */
export class MediaController {
  constructor(private readonly service: MediaService) {}

  sign = async (req: Request, res: Response): Promise<void> => {
    setPrivateNoStore(res);
    sendOk(res, await this.service.signUpload(validBody(req, uploadSignSchema)));
  };

  confirm = async (req: Request, res: Response): Promise<void> => {
    const asset = await this.service.confirmUpload(validBody(req, uploadConfirmSchema));
    sendCreated(res, asset);
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const page = await this.service.list(validQuery(req, mediaListQuerySchema));
    setPrivateNoStore(res);
    sendPaginated(res, page.items, page.meta);
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    setPrivateNoStore(res);
    sendOk(res, await this.service.getById(id));
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    sendOk(res, await this.service.updateMetadata(id, validBody(req, mediaUpdateSchema)));
  };

  replace = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const input = validBody(req, mediaReplaceSchema);
    sendOk(res, await this.service.replace(id, input.publicId, input.changeNote));
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    await this.service.softDelete(id);
    sendNoContent(res);
  };

  /** The cleanup queue: registered assets nothing references. */
  listAbandoned = async (_req: Request, res: Response): Promise<void> => {
    setPrivateNoStore(res);
    sendOk(res, await this.service.findAbandoned());
  };
}