#!/usr/bin/env tsx
/**
 * Imports an exam's previous-year papers from a verified manifest.
 *
 *   pnpm papers:import -- --dir <folder of PDFs>            # report only
 *   pnpm papers:import -- --dir <folder> --apply            # upload and publish
 *   pnpm papers:import -- --dir <folder> --apply --draft    # upload, leave as drafts
 *   pnpm papers:import -- --dir <folder> --apply --only 3   # first 3 papers only
 *
 * THE MANIFEST (tooling/scripts/data/<exam>-papers.json) is the reviewed list:
 * each paper's date, shift and course as printed in the PDF itself, with the
 * MD5 of the exact file that was checked. It also records what was left out
 * and why. This script decides nothing — it carries out the manifest.
 *
 * WHAT --apply WRITES. Per paper: the PDF (and its answer key, where one is
 * listed) uploaded to Cloudinary under papers/<exam>/<year>/, one MediaAsset
 * per file, one QuestionPaper, one QuestionPaperFile per file. Then a single
 * CACHE_REVALIDATE outbox row. Nothing is updated or deleted.
 *
 * WHAT IT REFUSES. A file whose MD5 differs from the manifest is not the file
 * that was reviewed, so it is skipped rather than published under a name it
 * was never checked against. A paper already present (same slug or dedupe key)
 * is skipped, which makes a re-run after a partial failure safe.
 *
 * WHY NOT THE ADMIN API. Create, attach and publish each need an authenticated
 * editor, and there is no editor to act as: the only account is the seed
 * admin. Writing rows directly is the same choice roll-exam-cycle.ts makes.
 * The publish rules of assertPublishable still hold by construction — every
 * row has a PAPER file, an exam, a real id and a real URL.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CACHE_TAGS } from '@stc/constants/cache-tags';
import { buildPaperDedupeKey } from '@stc/utils/slug';
import { PrismaClient } from '@prisma/client';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');
const DRAFT = process.argv.includes('--draft');

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

type ManifestFile = {
  file: string;
  md5: string;
  bytes: number;
  pages: number;
};

type ManifestPaper = {
  year: number;
  title: string;
  slug: string;
  shift: string;
  setCode: string;
  durationMin: number | null;
  totalMarks: number | null;
  verifiedBy: 'document' | 'document-date';
  paper: ManifestFile;
  answerKey: ManifestFile | null;
};

type Manifest = { exam: string; papers: ManifestPaper[] };

type Uploaded = {
  publicId: string;
  version: string | null;
  secureUrl: string;
  bytes: number;
};

/** Cloudinary's free plan caps a raw file at 10 MB; the dry run flags these. */
const RAW_LIMIT_BYTES = 10 * 1024 * 1024;

/**
 * Only the three Cloudinary keys are read from the API's env file. Loading the
 * whole file would also bring in its DATABASE_URL, and which database this
 * script writes to must stay the one Prisma resolves from the root .env.
 */
function cloudinaryConfig(): {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
} {
  const values: Record<string, string> = {};
  const envPath = join(ROOT, 'apps/api/.env');
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*(CLOUDINARY_[A-Z_]+)\s*=\s*(.*)$/);
      if (match?.[1]) values[match[1]] = (match[2] ?? '').trim().replace(/^["']|["']$/g, '');
    }
  }
  const read = (key: string): string => {
    const value = process.env[key] ?? values[key];
    if (!value) throw new Error(`${key} is not set (looked in the environment and apps/api/.env).`);
    return value;
  };
  return {
    cloudName: read('CLOUDINARY_CLOUD_NAME'),
    apiKey: read('CLOUDINARY_API_KEY'),
    apiSecret: read('CLOUDINARY_API_SECRET'),
  };
}

/**
 * A signed raw upload over the REST API — no SDK, so this workspace does not
 * take on the API's cloudinary dependency for one call.
 *
 * `overwrite=false` with a fixed public id is what makes a re-run cheap: an
 * object that is already there comes back as it is instead of being sent again.
 */
async function upload(
  config: ReturnType<typeof cloudinaryConfig>,
  buffer: Buffer,
  publicId: string,
): Promise<Uploaded> {
  const params: Record<string, string> = {
    overwrite: 'false',
    public_id: publicId,
    timestamp: String(Math.round(Date.now() / 1000)),
  };
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  const signature = createHash('sha1').update(`${toSign}${config.apiSecret}`).digest('hex');

  const form = new FormData();
  for (const [key, value] of Object.entries(params)) form.append(key, value);
  form.append('api_key', config.apiKey);
  form.append('signature', signature);
  form.append('file', new Blob([new Uint8Array(buffer)], { type: 'application/pdf' }), 'paper.pdf');

  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/raw/upload`, {
    method: 'POST',
    body: form,
    // fetch has no timeout of its own; a stalled upload would hang the run.
    signal: AbortSignal.timeout(180_000),
  });
  const body = (await response.json()) as {
    public_id?: string;
    version?: number;
    secure_url?: string;
    bytes?: number;
    error?: { message?: string };
  };
  if (!response.ok || !body.secure_url || !body.public_id) {
    throw new Error(`Cloudinary refused ${publicId}: ${body.error?.message ?? response.status}`);
  }
  return {
    publicId: body.public_id,
    version: body.version ? String(body.version) : null,
    secureUrl: body.secure_url,
    bytes: body.bytes ?? buffer.length,
  };
}

/**
 * Cloudinary accepts a PDF and then, on accounts where PDF delivery is switched
 * off, serves it as 401. Publishing 144 download buttons that all fail is the
 * exact page this site exists not to be — so the first upload is fetched back
 * before anything is written to the database.
 */
async function assertDeliverable(url: string): Promise<void> {
  const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(30_000) });
  if (!response.ok) {
    throw new Error(
      `Uploaded, but ${url} answers ${response.status}. On Cloudinary this usually means ` +
        '"Allow delivery of PDF and ZIP files" is off (Settings > Security). ' +
        'Nothing was written to the database.',
    );
  }
}

async function main(): Promise<void> {
  const dir = arg('--dir');
  if (!dir) {
    console.error('Pass --dir <folder holding the PDFs named in the manifest>.');
    process.exit(1);
  }
  const only = Number(arg('--only') ?? Number.POSITIVE_INFINITY);
  const manifestPath = join(HERE, 'data', `${arg('--exam') ?? 'jee-main'}-papers.json`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;

  const exam = await prisma.exam.findFirst({
    where: { slug: manifest.exam, deletedAt: null },
    select: { id: true, slug: true, name: true },
  });
  if (!exam) throw new Error(`No exam with slug "${manifest.exam}".`);

  console.log(
    `\n${APPLY ? (DRAFT ? 'APPLYING (as drafts)' : 'APPLYING (publishing)') : 'DRY RUN'} — ` +
      `${manifest.papers.length} papers for ${exam.name}\n`,
  );

  const config = APPLY ? cloudinaryConfig() : null;
  const now = new Date();
  let created = 0;
  let present = 0;
  let skipped = 0;
  let checkedDelivery = false;

  for (const paper of manifest.papers) {
    if (created >= only) break;

    // The service passes the exam ID where the helper says slug; matching it
    // exactly is what keeps the API's own duplicate check working afterwards.
    const dedupeKey = buildPaperDedupeKey({
      examSlug: exam.id,
      year: paper.year,
      shift: paper.shift,
      setCode: paper.setCode,
      locale: 'EN',
      paperType: 'PREVIOUS_YEAR',
    });

    const existing = await prisma.questionPaper.findFirst({
      where: { OR: [{ slug: paper.slug }, { dedupeKey }] },
      select: { slug: true },
    });
    if (existing) {
      present += 1;
      continue;
    }

    const files = [
      { role: 'PAPER' as const, entry: paper.paper, suffix: '' },
      ...(paper.answerKey
        ? [
            {
              role: 'ANSWER_KEY' as const,
              entry: paper.answerKey,
              suffix: '-answer-key',
            },
          ]
        : []),
    ];

    // Check every file BEFORE uploading any: a paper whose key fails the check
    // must not be left half-created with only its question paper.
    const problems: string[] = [];
    const loaded = files.map((file) => {
      const path = join(dir, file.entry.file);
      if (!existsSync(path)) {
        problems.push(`${file.entry.file} is missing`);
        return { ...file, buffer: Buffer.alloc(0) };
      }
      const buffer = readFileSync(path);
      if (createHash('md5').update(buffer).digest('hex') !== file.entry.md5) {
        problems.push(`${file.entry.file} is not the file that was reviewed (MD5 differs)`);
      }
      return { ...file, buffer };
    });

    if (problems.length > 0) {
      skipped += 1;
      console.log(`  SKIP  ${paper.slug}\n        ${problems.join('\n        ')}`);
      continue;
    }

    if (!APPLY || !config) {
      created += 1;
      console.log(
        `  would add  ${paper.shift.padEnd(22)} ${paper.setCode.padEnd(20)} ` +
          `${loaded.map((f) => `${f.role} ${(f.buffer.length / 1048576).toFixed(1)}MB`).join(' + ')}` +
          (loaded.some((f) => f.buffer.length > RAW_LIMIT_BYTES)
            ? '   (over 10 MB: a free Cloudinary plan will refuse it)'
            : ''),
      );
      continue;
    }

    // One refused file (too large for the plan, say) costs that paper, not the
    // run. An object uploaded before the refusal is an orphan, not a broken page.
    const uploaded: Array<(typeof loaded)[number] & { stored: Uploaded }> = [];
    try {
      for (const file of loaded) {
        const publicId = `papers/${exam.slug}/${paper.year}/${paper.slug}${file.suffix}.pdf`;
        uploaded.push({
          ...file,
          stored: await upload(config, file.buffer, publicId),
        });
      }
    } catch (error) {
      // Until one upload has worked, a refusal is the account (wrong keys, no
      // access), not the file — and it will refuse every file after it too.
      // Stopping here avoids sending 144 PDFs to learn the same thing.
      if (!checkedDelivery) throw error;
      skipped += 1;
      console.log(
        `  SKIP  ${paper.slug}\n        ${error instanceof Error ? error.message : error}`,
      );
      continue;
    }

    if (!checkedDelivery && uploaded[0]) {
      await assertDeliverable(uploaded[0].stored.secureUrl);
      checkedDelivery = true;
    }

    await prisma.$transaction(async (tx) => {
      const row = await tx.questionPaper.create({
        data: {
          slug: paper.slug,
          dedupeKey,
          title: paper.title,
          paperType: 'PREVIOUS_YEAR',
          year: paper.year,
          shift: paper.shift,
          setCode: paper.setCode,
          locale: 'EN',
          examId: exam.id,
          totalMarks: paper.totalMarks,
          durationMin: paper.durationMin,
          status: DRAFT ? 'DRAFT' : 'PUBLISHED',
          publishedAt: DRAFT ? null : now,
        },
        select: { id: true },
      });

      for (const file of uploaded) {
        // Reuse the asset on a re-run: publicId is unique, and an upload that
        // succeeded before a crash must not block the paper it belongs to.
        const media = await tx.mediaAsset.upsert({
          where: { publicId: file.stored.publicId },
          update: {},
          create: {
            provider: 'cloudinary',
            publicId: file.stored.publicId,
            version: file.stored.version,
            secureUrl: file.stored.secureUrl,
            folderPath: `papers/${exam.slug}/${paper.year}`,
            type: 'PDF',
            mimeType: 'application/pdf',
            format: 'pdf',
            bytes: BigInt(file.stored.bytes),
            pageCount: file.entry.pages,
            originalFilename: `${paper.slug}${file.suffix}.pdf`,
            checksum: createHash('sha256').update(file.buffer).digest('hex'),
            credit: 'National Testing Agency',
            usageCount: 1,
          },
          select: { id: true },
        });

        await tx.questionPaperFile.create({
          data: {
            questionPaperId: row.id,
            mediaId: media.id,
            fileRole: file.role,
            locale: 'EN',
            version: 1,
            isCurrent: true,
            publishedAt: DRAFT ? null : now,
            changeNote:
              paper.verifiedBy === 'document'
                ? 'Date and shift checked against the paper itself.'
                : 'Date checked against the paper; the shift is not printed in it.',
          },
        });
      }
    });

    created += 1;
    console.log(`  added  ${paper.slug}`);
  }

  if (APPLY && created > 0 && !DRAFT) {
    await prisma.outboxEvent.create({
      data: {
        eventType: 'CACHE_REVALIDATE',
        ownerType: 'EXAM',
        ownerId: exam.id,
        payload: {
          tags: [
            CACHE_TAGS.entityList('QUESTION_PAPER'),
            CACHE_TAGS.entity('EXAM', exam.slug),
            CACHE_TAGS.sitemap(),
          ],
          paths: ['/previous-year-papers', `/exam/${exam.slug}/previous-year-papers`],
          reason: `papers:import:${exam.slug}`,
        },
      },
    });
  }

  console.log(
    APPLY
      ? `\n  added ${created}, already present ${present}, skipped ${skipped}\n`
      : `\n  would add ${created}, already present ${present}, would skip ${skipped}.` +
          `\n  Nothing was uploaded or written. Re-run with --apply to import.\n`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
