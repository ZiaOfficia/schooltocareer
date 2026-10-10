import type { Request, Response } from 'express';

import { REVALIDATE } from '@stc/constants';

import { sendOk, setPublicCache } from '../../core/http/response.js';
import { validParams } from '../../middleware/validate.js';

import type { QuestionService } from './question.service.js';
import { examChapterParams, paperQuestionsParams, questionParams } from './question.validation.js';

export class QuestionController {
  constructor(private readonly service: QuestionService) {}

  getQuestion = async (req: Request, res: Response): Promise<void> => {
    const { publicId } = validParams(req, questionParams);
    setPublicCache(res, { sMaxAge: REVALIDATE.LONG_TAIL });
    sendOk(res, await this.service.getPublic(publicId));
  };

  getChapter = async (req: Request, res: Response): Promise<void> => {
    const { exam, subject, chapter } = validParams(req, examChapterParams);
    setPublicCache(res, { sMaxAge: REVALIDATE.LONG_TAIL });
    sendOk(res, await this.service.getChapter(exam, subject, chapter));
  };

  getPaperQuestions = async (req: Request, res: Response): Promise<void> => {
    const { paperSlug } = validParams(req, paperQuestionsParams);
    setPublicCache(res, { sMaxAge: REVALIDATE.LONG_TAIL });
    sendOk(res, await this.service.getPaperQuestions(paperSlug));
  };
}
