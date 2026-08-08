import { prisma, type PrismaClient } from '@stc/database';
import { loadEnv, apiEnvSchema, type ApiEnv } from '@stc/config';

import { AuditHandler } from './core/events/handlers/audit.handler.js';
import { CacheInvalidationHandler } from './core/events/handlers/cache-invalidation.handler.js';
import { SearchIndexHandler, SitemapPingHandler } from './core/events/handlers/search-index.handler.js';
import { EventDispatcher } from './core/events/event-dispatcher.js';
import { createLogger, type AppLogger } from './core/logger.js';
import { SearchSourceRegistry } from './core/search/search-source.js';
import { ExamSearchSource } from './modules/exam/exam.search-source.js';
import { IndexNowHandler } from './workers/handlers/indexnow.handler.js';
import { CacheRevalidateHandler } from './workers/handlers/revalidate.handler.js';
import { SearchDeleteHandler, SearchUpsertHandler } from './workers/handlers/search.handlers.js';
import { DEFAULT_WORKER_OPTIONS, OutboxWorker } from './workers/outbox.worker.js';
import { SearchService } from './modules/search/search.service.js';
import { MediaRepository } from './modules/media/media.repository.js';
import { MediaService } from './modules/media/media.service.js';
import { reconcileMediaTask } from './workers/tasks/reconcile-media.task.js';
import { BlogRepository } from './modules/blog/blog.repository.js';
import { BlogSearchSource } from './modules/blog/blog.search-source.js';
import { BlogService } from './modules/blog/blog.service.js';
import { DraftRepository } from './modules/draft/draft.repository.js';
import { PeriodicTaskRunner } from './workers/periodic-task.js';
import { publishScheduledTask } from './workers/tasks/publish-scheduled.task.js';
import { ResultRepository } from './modules/result/result.repository.js';
import { ResultSearchSource } from './modules/result/result.search-source.js';
import { ResultService } from './modules/result/result.service.js';
import { QuestionPaperRepository } from './modules/question-paper/question-paper.repository.js';
import { QuestionPaperSearchSource } from './modules/question-paper/question-paper.search-source.js';
import { QuestionPaperService } from './modules/question-paper/question-paper.service.js';
import { CategoryRepository } from './modules/category/category.repository.js';
import { CategoryService } from './modules/category/category.service.js';
import { BoardRepository } from './modules/board/board.repository.js';
import { BoardSearchSource } from './modules/board/board.search-source.js';
import { BoardService } from './modules/board/board.service.js';
import { ExamRepository } from './modules/exam/exam.repository.js';
import { ExamService } from './modules/exam/exam.service.js';
import { RevisionRepository } from './modules/revision/revision.repository.js';
import { SlugRepository } from './modules/slug/slug.repository.js';
import { SlugService } from './modules/slug/slug.service.js';
import { HealthRepository } from './modules/health/health.repository.js';
import { HealthService } from './modules/health/health.service.js';
import { MemoryCacheProvider } from './providers/cache/memory.cache-provider.js';
import type { ICacheProvider } from './providers/cache/cache.provider.js';
import { OutboxQueueProvider } from './providers/queue/outbox.queue-provider.js';
import { OutboxRepository } from './providers/queue/outbox.repository.js';
import type { IQueueProvider } from './providers/queue/queue.provider.js';
import { PostgresSearchProvider } from './providers/search/postgres.search-provider.js';
import { SearchRepository } from './providers/search/search.repository.js';
import type { ISearchProvider } from './providers/search/search.provider.js';
import { CloudinaryStorageProvider } from './providers/storage/cloudinary.storage-provider.js';
import { UnavailableStorageProvider } from './providers/storage/unavailable.storage-provider.js';
import type { IStorageProvider } from './providers/storage/storage.provider.js';

/**
 * Composition root.
 *
 * Manual constructor injection, not a DI framework. At this size a framework
 * buys decorators and reflection metadata in exchange for a container you
 * cannot read — whereas this file IS the dependency graph, top to bottom, and a
 * test swaps any provider by passing a different implementation.
 *
 * Nothing else in the codebase constructs a provider or a repository.
 */
/** Reported by /health. Bumped with the release, not read from process.env. */
export const API_VERSION = '0.1.0';

export type AppContainer = {
  env: ApiEnv;
  logger: AppLogger;
  prisma: PrismaClient;
  providers: {
    cache: ICacheProvider;
    queue: IQueueProvider;
    storage: IStorageProvider;
    search: ISearchProvider;
  };
  services: {
    health: HealthService;
    exam: ExamService;
    board: BoardService;
    category: CategoryService;
    questionPaper: QuestionPaperService;
    result: ResultService;
    blog: BlogService;
    media: MediaService;
    search: SearchService;
  };
  searchSources: SearchSourceRegistry;
  startWorker: () => OutboxWorker;
  shutdown: () => Promise<void>;
};

export function createContainer(overrides: Partial<AppContainer> = {}): AppContainer {
  const env = overrides.env ?? loadEnv(apiEnvSchema);

  const logger =
    overrides.logger ??
    createLogger({
      level: env.LOG_LEVEL,
      pretty: env.NODE_ENV === 'development',
      service: 'api',
    });

  const db = overrides.prisma ?? prisma;

  // ── Providers ────────────────────────────────────────────────────────────
  // Each is swapped by changing exactly one line here:
  //   MemoryCacheProvider   → RedisCacheProvider
  //   OutboxQueueProvider   → BullMqQueueProvider (outbox stays as the source)
  //   PostgresSearchProvider→ MeilisearchProvider
  //   CloudinaryStorage     → S3Storage / R2Storage
  const cache: ICacheProvider = overrides.providers?.cache ?? new MemoryCacheProvider();

  const outboxRepository = new OutboxRepository(db);
  const queue: IQueueProvider =
    overrides.providers?.queue ?? new OutboxQueueProvider(outboxRepository);

  const searchRepository = new SearchRepository(db);
  const search: ISearchProvider =
    overrides.providers?.search ?? new PostgresSearchProvider(searchRepository);

  // All three or none — a partial Cloudinary config is a misconfiguration, not
  // a degraded mode, and silently half-enabling it would fail later and
  // further from the cause. Destructured into locals so the narrowing is real
  // rather than three non-null assertions.
  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  const apiKey = env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET;
  const cloudinaryConfigured = Boolean(cloudName && apiKey && apiSecret);

  const storage: IStorageProvider =
    overrides.providers?.storage ??
    (cloudName && apiKey && apiSecret
      ? new CloudinaryStorageProvider({ cloudName, apiKey, apiSecret })
      : new UnavailableStorageProvider());

  if (!cloudinaryConfigured) {
    logger.warn(
      'No Cloudinary credentials — uploads, deletes and media reconciliation are disabled. ' +
        'Every read path works; MediaAsset URLs are stored columns. Set CLOUDINARY_CLOUD_NAME, ' +
        'CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET before the admin needs to publish media.',
    );
  }

  if (!env.REDIS_URL && env.NODE_ENV === 'production') {
    logger.warn(
      'No REDIS_URL set — using the in-memory cache. With more than one instance, ' +
        'tag invalidation only clears the instance that handled the request. ' +
        'Keep memory TTLs short and let Next.js ISR revalidation be authoritative.',
    );
  }

  // ── Event handlers ───────────────────────────────────────────────────────
  // Registered once, here. Services emit events and know nothing about who
  // listens; adding webhooks or analytics later is one more `.register(...)`.
  const revisionRepository = new RevisionRepository(db);
  const events = new EventDispatcher(logger).register(
    new CacheInvalidationHandler(cache, queue),
    new SearchIndexHandler(queue),
    new SitemapPingHandler(queue),
    new AuditHandler(revisionRepository, logger),
  );

  // ── Services ─────────────────────────────────────────────────────────────
  const health = new HealthService(new HealthRepository(db), {
    search,
    queue,
    cache,
    version: API_VERSION,
  });

  const slugs = new SlugService(new SlugRepository(db));
  const examRepository = new ExamRepository(db);

  const exam = new ExamService({
    repository: examRepository,
    slugs,
    events,
    cache,
    search,
    siteId: env.SITE_ID,
  });

  const boardRepository = new BoardRepository(db);
  const board = new BoardService({
    repository: boardRepository,
    slugs,
    events,
    cache,
    search,
    siteId: env.SITE_ID,
  });

  const category = new CategoryService({
    repository: new CategoryRepository(db),
    slugs,
    events,
    cache,
    siteId: env.SITE_ID,
  });

  const paperRepository = new QuestionPaperRepository(db);
  const questionPaper = new QuestionPaperService({
    repository: paperRepository,
    slugs,
    events,
    cache,
    search,
    siteId: env.SITE_ID,
  });

  const resultRepository = new ResultRepository(db);
  const result = new ResultService({
    repository: resultRepository,
    slugs,
    events,
    cache,
    search,
    siteId: env.SITE_ID,
  });

  const blogRepository = new BlogRepository(db);
  const blog = new BlogService({
    repository: blogRepository,
    drafts: new DraftRepository(db),
    revisions: revisionRepository,
    slugs,
    events,
    cache,
    search,
    siteId: env.SITE_ID,
  });

  const media = new MediaService({
    repository: new MediaRepository(db),
    storage,
    events,
    cache,
    logger,
  });

  // Search sources
  // Each indexable module registers one. The outbox worker resolves the source
  // by ownerType, so adding a module to search is a single line here plus a
  // ~40-line source class — no worker changes.
  const searchSources = new SearchSourceRegistry().register(
    new ExamSearchSource(examRepository, env.SITE_ID),
    new BoardSearchSource(boardRepository, env.SITE_ID),
    new QuestionPaperSearchSource(paperRepository, env.SITE_ID),
    new ResultSearchSource(resultRepository, env.SITE_ID),
    new BlogSearchSource(blogRepository, env.SITE_ID),
  );

  const searchService = new SearchService({
    provider: search,
    registry: searchSources,
    repository: searchRepository,
    queue,
    cache,
    logger,
    siteId: env.SITE_ID,
  });

  return {
    env,
    logger,
    prisma: db,
    providers: { cache, queue, storage, search },
    services: { health, exam, board, category, questionPaper, result, blog, media, search: searchService },
    searchSources,

    /**
     * Builds and starts the outbox worker.
     *
     * Called by the dedicated worker process in production, and optionally
     * in-process during development so there is one thing to start.
     */
    startWorker: () => {
      const worker = new OutboxWorker(
        {
          queue,
          logger,
          reclaimStale: (olderThanMs) => outboxRepository.reclaimStale(olderThanMs),
        },
        DEFAULT_WORKER_OPTIONS,
      ).register(
        new SearchUpsertHandler(searchSources, search, logger),
        new SearchDeleteHandler(search),
        new CacheRevalidateHandler(
          { webBaseUrl: env.WEB_BASE_URL, secret: env.REVALIDATE_SECRET },
          logger,
        ),
        new IndexNowHandler({ webBaseUrl: env.WEB_BASE_URL, key: env.INDEXNOW_KEY }, logger),
      );

      worker.start();

      // Time-driven work the outbox cannot express: nothing emits an event
      // when a clock passes a scheduled publication time.
      const periodic = new PeriodicTaskRunner(logger).register(
        publishScheduledTask({ repository: blogRepository, service: blog, logger }),
        reconcileMediaTask({ service: media }),
      );
      periodic.start();

      return worker;
    },

    shutdown: async () => {
      await cache.clear();
      await db.$disconnect();
    },
  };
}
