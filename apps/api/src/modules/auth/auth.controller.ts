import type { Request, Response } from 'express';

import { loginSchema } from '@stc/validation';

import { sendOk, setPrivateNoStore } from '../../core/http/response.js';
import { getCurrentUser } from '../../core/context.js';
import { UnauthenticatedError } from '../../core/errors/app-error.js';
import { validBody } from '../../middleware/validate.js';

import type { AuthService } from './auth.service.js';

/**
 * HTTP layer only. Both responses are `private, no-store` — a bearer token in
 * any shared cache is a full account compromise, and `/me` is per-user by
 * definition.
 */
export class AuthController {
  constructor(private readonly service: AuthService) {}

  login = async (req: Request, res: Response): Promise<void> => {
    const input = validBody(req, loginSchema);
    setPrivateNoStore(res);
    sendOk(res, await this.service.login(input));
  };

  /**
   * Who the presented token says you are, and what it lets you do.
   *
   * Exists so an operator can confirm they hold a token with `fact:approve`
   * BEFORE attempting an approval — otherwise the first sign that a token is
   * under-privileged is a 403 on the request that was meant to publish an exam
   * date. Reads only what `authenticate()` already attached; no database call.
   */
  me = async (_req: Request, res: Response): Promise<void> => {
    const user = getCurrentUser();
    if (!user) throw new UnauthenticatedError();
    setPrivateNoStore(res);
    sendOk(res, user);
  };
}
