import { CACHE_TAGS, REVALIDATE, ROUTES } from '@stc/constants';
import type { ChapterPageDto, PaperQuestionsDto, QuestionDetailDto } from '@stc/types';

import { NotFoundError } from '../../core/errors/app-error.js';
import { cacheKey, type ICacheProvider } from '../../providers/cache/cache.provider.js';

import { toChapterPage, toQuestionDetail, toQuestionLink } from './question.dto.js';
import type { QuestionRepository } from './question.repository.js';

export type QuestionRepositoryPort = Pick<
  QuestionRepository,
  'findPublicByPublicId' | 'listPublicInChapter' | 'findPublicChapter' | 'listPublicInPaper'
>;

export type QuestionServiceDeps = {
  repository: QuestionRepositoryPort;
  cache: ICacheProvider;
};

/**
 * The question bank's public read side.
 *
 * Every read is cached under tags the outbox already knows how to invalidate
 * (CACHE_TAGS.entity / entityList), so a re-import that publishes or corrects
 * a question reaches the page without a redeploy.
 */
export class QuestionService {
  constructor(private readonly deps: QuestionServiceDeps) {}

  async getPublic(publicId: string): Promise<QuestionDetailDto> {
    const key = cacheKey('question:detail', publicId);
    const cached = await this.deps.cache.get<QuestionDetailDto>(key);
    if (cached) return cached;

    const record = await this.deps.repository.findPublicByPublicId(publicId);
    // A question on a paper with no exam has no exam URL to live at. The
    // importer never creates one; refusing here keeps a stray row off the site.
    if (!record || !record.questionPaper.exam) throw new NotFoundError('Question', publicId);

    const examSlug = record.questionPaper.exam.slug;
    let previous = null;
    let next = null;
    if (record.chapter) {
      const rows = await this.deps.repository.listPublicInChapter(record.chapter.id);
      const at = rows.findIndex((row) => row.publicId === publicId);
      if (at > 0) previous = toQuestionLink(examSlug, rows[at - 1]!);
      if (at >= 0 && at < rows.length - 1) next = toQuestionLink(examSlug, rows[at + 1]!);
    }

    const dto = toQuestionDetail(record, { previous, next });
    await this.deps.cache.set(key, dto, {
      ttl: REVALIDATE.LONG_TAIL,
      tags: [CACHE_TAGS.entity('QUESTION', publicId), CACHE_TAGS.entityList('QUESTION')],
    });
    return dto;
  }

  async getChapter(exam: string, subject: string, chapter: string): Promise<ChapterPageDto> {
    const key = cacheKey('question:chapter', exam, subject, chapter);
    const cached = await this.deps.cache.get<ChapterPageDto>(key);
    if (cached) return cached;

    const record = await this.deps.repository.findPublicChapter(exam, subject, chapter);
    if (!record) throw new NotFoundError('Chapter', `${exam}/${subject}/${chapter}`);

    const rows = await this.deps.repository.listPublicInChapter(record.id);
    const dto = toChapterPage(record, rows);
    await this.deps.cache.set(key, dto, {
      ttl: REVALIDATE.LONG_TAIL,
      tags: [
        CACHE_TAGS.entity('EXAM_CHAPTER', `${exam}/${subject}/${chapter}`),
        CACHE_TAGS.entityList('QUESTION'),
      ],
    });
    return dto;
  }

  async getPaperQuestions(paperSlug: string): Promise<PaperQuestionsDto> {
    const key = cacheKey('question:paper', paperSlug);
    const cached = await this.deps.cache.get<PaperQuestionsDto>(key);
    if (cached) return cached;

    const found = await this.deps.repository.listPublicInPaper(paperSlug);
    if (!found) throw new NotFoundError('Question paper', paperSlug);

    const groups = new Map<string, PaperQuestionsDto['subjects'][number]>();
    for (const row of found.questions) {
      const subject = row.subject ?? { slug: 'other', name: 'Other' };
      const group = groups.get(subject.slug) ?? { subject, questions: [] };
      group.questions.push(toQuestionLink(found.examSlug, row));
      groups.set(subject.slug, group);
    }

    const dto: PaperQuestionsDto = {
      paper: {
        slug: found.paper.slug,
        title: found.paper.title,
        year: found.paper.year,
        shift: found.paper.shift,
        path: ROUTES.paper(found.paper.slug),
      },
      subjects: [...groups.values()],
    };
    await this.deps.cache.set(key, dto, {
      ttl: REVALIDATE.LONG_TAIL,
      tags: [CACHE_TAGS.entity('QUESTION_PAPER', paperSlug), CACHE_TAGS.entityList('QUESTION')],
    });
    return dto;
  }
}
