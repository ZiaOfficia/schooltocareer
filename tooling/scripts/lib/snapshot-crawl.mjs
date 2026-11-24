/**
 * Reads every public record the website shows, through the public API, and
 * returns it as one plain object: the content snapshot.
 *
 * Plain JavaScript with no imports, so the same function runs in Node
 * (tooling/scripts/snapshot-content.ts) and, pasted, in a browser console.
 *
 * `get(path)` must resolve to the parsed JSON body for a 200, null for a 404,
 * and throw for anything else — a failed read must stop the snapshot rather
 * than quietly drop pages from the site.
 */
export async function crawlSnapshot(get, log = () => {}) {
  const P = '/api/v1';

  /** Every page of a list endpoint. */
  async function all(path) {
    const rows = [];
    for (let page = 1; page <= 50; page += 1) {
      const sep = path.includes('?') ? '&' : '?';
      const body = await get(`${path}${sep}perPage=100&page=${page}`);
      if (!body) break;
      rows.push(...(body.data ?? []));
      if (!body.meta?.hasNext) break;
    }
    return rows;
  }

  async function one(path) {
    const body = await get(path);
    return body ? body.data : null;
  }

  log('exams');
  const exams = await all(`${P}/exams`);
  const examDetails = {};
  for (const exam of exams) examDetails[exam.slug] = await one(`${P}/exams/${exam.slug}`);

  log('papers');
  const papers = await all(`${P}/question-papers`);
  const paperDetails = {};
  const paperQuestions = {};
  for (const paper of papers) {
    paperDetails[paper.slug] = await one(`${P}/question-papers/${paper.slug}`);
    paperQuestions[paper.slug] = await one(`${P}/questions/by-paper/${paper.slug}`);
  }

  log('results and boards');
  const results = await all(`${P}/results`);
  const boards = await all(`${P}/boards`);

  log('practice');
  const practice = (await one(`${P}/questions/practice`)) ?? [];
  const examPractice = {};
  const mockTests = {};
  const chapters = {};
  for (const entry of practice) {
    const hub = await one(`${P}/questions/exams/${entry.exam.slug}`);
    examPractice[entry.exam.slug] = hub;
    for (const ref of entry.mockTests) {
      mockTests[ref.paper.slug] = await one(`${P}/questions/mock-test/${ref.paper.slug}`);
    }
    for (const subject of hub?.subjects ?? []) {
      for (const chapter of subject.chapters) {
        const key = `${entry.exam.slug}/${subject.subject.slug}/${chapter.slug}`;
        chapters[key] = await one(`${P}/questions/chapters/${key}`);
      }
    }
  }

  log('questions');
  const questions = {};
  for (const set of Object.values(paperQuestions)) {
    for (const subject of set?.subjects ?? []) {
      for (const question of subject.questions) {
        if (!questions[question.publicId]) {
          questions[question.publicId] = await one(`${P}/questions/${question.publicId}`);
        }
      }
    }
  }

  return {
    exams,
    examDetails,
    papers,
    paperDetails,
    paperQuestions,
    results,
    boards,
    practice,
    examPractice,
    mockTests,
    chapters,
    questions,
  };
}
