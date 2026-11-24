import boardsData from '@/data/snapshot/boards.json';
import chaptersData from '@/data/snapshot/chapters.json';
import examDetailsData from '@/data/snapshot/examDetails.json';
import examPracticeData from '@/data/snapshot/examPractice.json';
import examsData from '@/data/snapshot/exams.json';
import mockTestsData from '@/data/snapshot/mockTests.json';
import paperDetailsData from '@/data/snapshot/paperDetails.json';
import paperQuestionsData from '@/data/snapshot/paperQuestions.json';
import papersData from '@/data/snapshot/papers.json';
import practiceData from '@/data/snapshot/practice.json';
import questionsData from '@/data/snapshot/questions.json';
import resultsData from '@/data/snapshot/results.json';

/**
 * The website's data, read from the content snapshot — never from a server.
 *
 * The snapshot (apps/web/src/data/snapshot/*.json) is a copy of every public
 * record the API serves, taken by `pnpm content:snapshot` and committed. Every
 * page is built from it at deploy time, so no visitor and no crawler ever
 * waits on the API, which runs on a free instance that sleeps when idle.
 *
 * The functions keep the names and return shapes of the old HTTP client, so
 * pages did not change: a missing record is still `null` (and the page's
 * notFound()), a list is still an array.
 *
 * To publish a change made through the API: run `pnpm content:snapshot`,
 * commit the JSON, push.
 */

type Row = Record<string, unknown> & {
  id?: string;
  year?: number;
  popularityScore?: number;
  exam?: { id: string } | null;
};
type Lookup = Record<string, unknown>;

const exams = examsData as unknown as Row[];
const examDetails = examDetailsData as unknown as Lookup;
const papers = papersData as unknown as Row[];
const paperDetails = paperDetailsData as unknown as Lookup;
const paperQuestions = paperQuestionsData as unknown as Lookup;
const results = resultsData as unknown as Row[];
const boards = boardsData as unknown as Row[];
const practice = practiceData as unknown as Row[];
const examPractice = examPracticeData as unknown as Lookup;
const mockTests = mockTestsData as unknown as Lookup;
const chapters = chaptersData as unknown as Lookup;
const questions = questionsData as unknown as Lookup;

/**
 * Kept so existing `catch (error) { if (error instanceof ApiError) … }`
 * blocks still compile. Reading a file cannot fail the way a request could,
 * so nothing here throws it any more.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get unreachable(): boolean {
    return this.status === 503;
  }
}

/** The query-string options pages pass: filter by exam, sort, cap. */
function applyQuery(rows: Row[], query: string): Row[] {
  const params = new URLSearchParams(query);
  let out = [...rows];
  const examId = params.get('examId');
  if (examId) out = out.filter((row) => row.exam?.id === examId);
  const sortBy = params.get('sortBy') ?? params.get('sort');
  const desc = (params.get('sortDir') ?? params.get('dir')) === 'desc';
  if (sortBy === 'year' || sortBy === 'popularityScore') {
    const key = sortBy;
    out.sort((a, b) => ((a[key] as number) ?? 0) - ((b[key] as number) ?? 0));
    if (desc) out.reverse();
  }
  const cap = Number(params.get('perPage') ?? params.get('limit'));
  return cap > 0 ? out.slice(0, cap) : out;
}

function pick<T>(lookup: Lookup, key: string): T | null {
  return (lookup[key] as T | undefined) ?? null;
}

export async function getExam<T>(slug: string): Promise<T | null> {
  return pick<T>(examDetails, slug);
}

export async function listExams<T>(query = ''): Promise<T[]> {
  return applyQuery(exams, query) as T[];
}

export async function listPapers<T>(query = ''): Promise<T[]> {
  return applyQuery(papers, query) as T[];
}

/** Every paper matching `query`. `perPage` is ignored here: all rows are wanted. */
export async function listAllPapers<T>(query = ''): Promise<T[]> {
  const params = new URLSearchParams(query);
  params.delete('perPage');
  params.delete('page');
  return applyQuery(papers, params.toString()) as T[];
}

/** How many papers and results exist for one exam. */
export async function examHoldings(examId: string): Promise<{ papers: number; results: number }> {
  return {
    papers: papers.filter((row) => row.exam?.id === examId).length,
    results: results.filter((row) => row.exam?.id === examId).length,
  };
}

export async function getPaper<T>(slug: string): Promise<T | null> {
  return pick<T>(paperDetails, slug);
}

// ── Question bank ──────────────────────────────────────────────────────────

export async function getQuestion<T>(publicId: string): Promise<T | null> {
  return pick<T>(questions, publicId);
}

export async function getExamChapter<T>(
  exam: string,
  subject: string,
  chapter: string,
): Promise<T | null> {
  return pick<T>(chapters, `${exam}/${subject}/${chapter}`);
}

export async function getPaperQuestions<T>(paperSlug: string): Promise<T | null> {
  return pick<T>(paperQuestions, paperSlug);
}

export async function listPractice<T>(): Promise<T[]> {
  return practice as T[];
}

export async function getExamPractice<T>(exam: string): Promise<T | null> {
  return pick<T>(examPractice, exam);
}

export async function getMockTest<T>(paperSlug: string): Promise<T | null> {
  return pick<T>(mockTests, paperSlug);
}

export async function listBoards<T>(query = ''): Promise<T[]> {
  return applyQuery(boards, query) as T[];
}

export async function listResults<T>(query = ''): Promise<T[]> {
  return applyQuery(results, query) as T[];
}

/** Articles are files in lib/articles; the API's posts are not published. */
export async function listPosts<T>(_query = ''): Promise<T[]> {
  return [];
}

/** Site search is off (LIVE.search) and needs a server; nothing to return. */
export async function search<T>(_query: string): Promise<T | null> {
  return null;
}

// ── For generateStaticParams: every record that gets a page ────────────────

export const SNAPSHOT_KEYS = {
  exams: () => Object.keys(examDetails).filter((slug) => examDetails[slug] !== null),
  papers: () => Object.keys(paperDetails).filter((slug) => paperDetails[slug] !== null),
  mockTests: () => Object.keys(mockTests).filter((slug) => mockTests[slug] !== null),
  mockTestParams: () =>
    Object.entries(mockTests)
      .filter(([, test]) => test !== null)
      .map(([paper, test]) => ({ slug: (test as { exam: { slug: string } }).exam.slug, paper })),
  questions: () =>
    Object.values(questions).filter(Boolean) as Array<{ path: string; exam: { slug: string } }>,
  chapters: () => Object.keys(chapters).filter((key) => chapters[key] !== null),
  examPractice: () => Object.keys(examPractice).filter((slug) => examPractice[slug] !== null),
};
