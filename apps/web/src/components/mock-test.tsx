'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { QuestionType } from '@stc/types';

/**
 * A digitised paper taken as a timed test, the way the exam itself runs:
 * a countdown, subject tabs, a palette of question numbers, "mark for review",
 * an automatic submit when time runs out, then a scorecard with every
 * question linked to its worked solution.
 *
 * Everything is scored here, in the browser, from answers the page already
 * carries (they are public on each question's page anyway). Nothing is sent
 * anywhere: there is no account, and progress lives in this browser only,
 * so a refresh or a closed tab picks up where the student left off.
 *
 * Question and option bodies arrive as HTML typeset on the server, so the
 * maths renders on first paint and this component ships no KaTeX.
 */

export type MockTestQuestion = {
  publicId: string;
  path: string;
  number: number;
  type: QuestionType;
  marksRight: number;
  marksWrong: number;
  stemHtml: string;
  options: Array<{ label: string; html: string }>;
  correct: string[];
  numeric: { value: number; tolerance: number } | null;
  dropped: boolean;
};

export type MockTestSection = {
  subject: { slug: string; name: string };
  questions: MockTestQuestion[];
};

type Props = {
  storageKey: string;
  title: string;
  examName: string;
  /** Null when the paper does not say: the test then runs untimed. */
  durationMin: number | null;
  totalMarks: number;
  sections: MockTestSection[];
  paperPath: string;
};

type Phase = 'intro' | 'running' | 'done';

type Saved = {
  phase: Phase;
  startedAt: number | null;
  finishedAt: number | null;
  current: number;
  responses: Record<string, string>;
  marked: Record<string, true>;
  visited: Record<string, true>;
};

/** Site header (64px) + test bar + a little air: where a question's top should sit. */
const BAR_CLEARANCE = 148;

const EMPTY: Saved = {
  phase: 'intro',
  startedAt: null,
  finishedAt: null,
  current: 0,
  responses: {},
  marked: {},
  visited: {},
};

/** Browser storage can be missing or throw (private mode, blocked site data). */
function load(key: string): Saved | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? ({ ...EMPTY, ...(JSON.parse(raw) as Partial<Saved>) } satisfies Saved) : null;
  } catch {
    return null;
  }
}

function save(key: string, state: Saved): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // Progress simply is not kept across reloads; the test still works.
  }
}

function forget(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to clear.
  }
}

type Outcome = 'right' | 'wrong' | 'skipped' | 'dropped';

function outcomeOf(q: MockTestQuestion, response: string | undefined): Outcome {
  if (q.dropped) return 'dropped';
  if (response === undefined || response.trim() === '') return 'skipped';
  if (q.type === 'NUMERICAL') {
    const value = Number(response);
    if (!q.numeric || !Number.isFinite(value)) return 'wrong';
    return Math.abs(value - q.numeric.value) <= q.numeric.tolerance + 1e-9 ? 'right' : 'wrong';
  }
  return q.correct.includes(response) ? 'right' : 'wrong';
}

function marksFor(q: MockTestQuestion, outcome: Outcome): number {
  if (outcome === 'right' || outcome === 'dropped') return q.marksRight;
  if (outcome === 'wrong') return q.marksWrong;
  return 0;
}

function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function duration(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export function MockTest(props: Props) {
  const { storageKey, title, examName, durationMin, totalMarks, sections, paperPath } = props;

  // One flat list, so "next" and the palette never have to think in sections.
  const flat = useMemo(
    () =>
      sections.flatMap((section, sectionIndex) =>
        section.questions.map((question) => ({ question, sectionIndex })),
      ),
    [sections],
  );
  const sectionStart = useMemo(() => {
    const starts: number[] = [];
    let at = 0;
    for (const section of sections) {
      starts.push(at);
      at += section.questions.length;
    }
    return starts;
  }, [sections]);

  const [state, setState] = useState<Saved>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [confirming, setConfirming] = useState(false);
  const questionTop = useRef<HTMLDivElement>(null);

  // Restore after mount: the server render cannot know what this browser holds.
  useEffect(() => {
    const restored = load(storageKey);
    if (restored) setState(restored);
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (hydrated) save(storageKey, state);
  }, [hydrated, storageKey, state]);

  const limitMs = durationMin ? durationMin * 60_000 : null;
  const elapsedMs = state.startedAt ? (state.finishedAt ?? now) - state.startedAt : 0;
  const remainingMs = limitMs !== null ? limitMs - elapsedMs : null;

  const submit = useCallback(() => {
    setConfirming(false);
    setState((s) => (s.phase === 'running' ? { ...s, phase: 'done', finishedAt: Date.now() } : s));
    window.scrollTo({ top: 0 });
  }, []);

  // The clock. Ticks only while the test runs.
  useEffect(() => {
    if (state.phase !== 'running') return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [state.phase]);

  // Time up: submit, exactly as the exam does.
  useEffect(() => {
    if (state.phase === 'running' && remainingMs !== null && remainingMs <= 0) submit();
  }, [state.phase, remainingMs, submit]);

  const current = flat[state.current];

  const go = useCallback(
    (index: number) => {
      const target = flat[index];
      if (!target) return;
      setState((s) => ({ ...s, current: index, visited: { ...s.visited, [target.question.publicId]: true } }));
      // Bring the new question's top just under the sticky test bar. Plain
      // scrollIntoView puts it under the bar, hiding the start of the stem.
      const el = questionTop.current;
      if (el) {
        const top = el.getBoundingClientRect().top;
        if (top < BAR_CLEARANCE || top > window.innerHeight / 2) window.scrollBy({ top: top - BAR_CLEARANCE });
      }
    },
    [flat],
  );

  function start() {
    const first = flat[0];
    setNow(Date.now());
    setState({
      ...EMPTY,
      phase: 'running',
      startedAt: Date.now(),
      visited: first ? { [first.question.publicId]: true } : {},
    });
  }

  function retake() {
    forget(storageKey);
    setState(EMPTY);
    window.scrollTo({ top: 0 });
  }

  function respond(publicId: string, value: string) {
    setState((s) => ({ ...s, responses: { ...s.responses, [publicId]: value } }));
  }

  function clearResponse(publicId: string) {
    setState((s) => {
      const responses = { ...s.responses };
      delete responses[publicId];
      return { ...s, responses };
    });
  }

  function toggleMark(publicId: string, value: boolean) {
    setState((s) => {
      const marked = { ...s.marked };
      if (value) marked[publicId] = true;
      else delete marked[publicId];
      return { ...s, marked };
    });
  }

  const answeredCount = flat.filter(({ question }) => (state.responses[question.publicId] ?? '').trim() !== '').length;

  // ── Before the start ────────────────────────────────────────────────────
  if (!hydrated || state.phase === 'intro') {
    const marking = flat[0]?.question;
    return (
      <div className="mt-intro q-card">
        <h2 className="text-[22px] font-semibold text-ink">Before you start</h2>
        <ul className="mt-4 grid gap-2 text-[15.5px] text-ink-soft">
          <li>
            <strong className="text-ink">{flat.length} questions</strong> across{' '}
            {sections.map((s) => `${s.subject.name} (${s.questions.length})`).join(', ')}.
          </li>
          <li>
            {durationMin ? (
              <>
                <strong className="text-ink">{durationMin} minutes</strong>. The test submits itself when the
                time runs out.
              </>
            ) : (
              'Untimed: the paper does not state its duration, so the clock counts up instead.'
            )}
          </li>
          {marking ? (
            <li>
              Marking as in the exam: <strong className="text-ink">+{marking.marksRight}</strong> for a right
              answer,{' '}
              <strong className="text-ink">
                {marking.marksWrong < 0 ? marking.marksWrong : 'no negative'}
              </strong>{' '}
              for a wrong one, 0 for a question left blank. Maximum{' '}
              <strong className="text-ink">{totalMarks}</strong>.
            </li>
          ) : null}
          <li>Your answers stay in this browser. Nothing is sent anywhere, and no account is needed.</li>
          <li>After you submit you see your score, subject by subject, with a worked solution for every question.</li>
        </ul>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" className="qp-button qp-button-primary" onClick={start} disabled={!hydrated}>
            Start the test
          </button>
          <a href={paperPath} className="qp-button inline-flex items-center">
            Download the paper instead
          </a>
        </div>
      </div>
    );
  }

  // ── The scorecard ───────────────────────────────────────────────────────
  if (state.phase === 'done') {
    const scored = flat.map(({ question, sectionIndex }) => {
      const response = state.responses[question.publicId];
      const outcome = outcomeOf(question, response);
      return { question, sectionIndex, response, outcome, marks: marksFor(question, outcome) };
    });
    const total = scored.reduce((sum, row) => sum + row.marks, 0);
    const right = scored.filter((r) => r.outcome === 'right' || r.outcome === 'dropped').length;
    const wrong = scored.filter((r) => r.outcome === 'wrong').length;
    const attempted = right + wrong;

    return (
      <div className="grid gap-6">
        <section className="q-card" aria-labelledby="mt-score">
          <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-mute">Your score</p>
          <p id="mt-score" className="mt-1 font-display text-[44px] font-semibold leading-none text-ink">
            <span className="num">{total}</span>
            <span className="text-[22px] text-ink-mute"> / {totalMarks}</span>
          </p>
          <p className="mt-3 text-[15px] text-ink-soft">
            {right} right · {wrong} wrong · {flat.length - attempted} left blank
            {attempted > 0 ? ` · accuracy ${Math.round((right / attempted) * 100)}%` : ''}
            {state.startedAt && state.finishedAt ? ` · time ${duration(state.finishedAt - state.startedAt)}` : ''}
          </p>

          <div className="mt-5 overflow-x-auto">
            <table className="mt-table">
              <thead>
                <tr>
                  <th scope="col">Subject</th>
                  <th scope="col">Score</th>
                  <th scope="col">Right</th>
                  <th scope="col">Wrong</th>
                  <th scope="col">Blank</th>
                </tr>
              </thead>
              <tbody>
                {sections.map((section, index) => {
                  const rows = scored.filter((r) => r.sectionIndex === index);
                  const max = rows.reduce((sum, r) => sum + r.question.marksRight, 0);
                  return (
                    <tr key={section.subject.slug}>
                      <th scope="row">{section.subject.name}</th>
                      <td className="num">
                        {rows.reduce((sum, r) => sum + r.marks, 0)} / {max}
                      </td>
                      <td className="num">{rows.filter((r) => r.outcome === 'right' || r.outcome === 'dropped').length}</td>
                      <td className="num">{rows.filter((r) => r.outcome === 'wrong').length}</td>
                      <td className="num">{rows.filter((r) => r.outcome === 'skipped').length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#mt-review" className="qp-button qp-button-primary inline-flex items-center">
              Review every answer
            </a>
            <button type="button" className="qp-button" onClick={retake}>
              Take it again
            </button>
          </div>
        </section>

        <section id="mt-review" aria-label="Answer review" className="grid gap-6">
          {sections.map((section, index) => (
            <div key={section.subject.slug} className="q-card">
              <h2 className="text-[19px] font-semibold text-ink">{section.subject.name}</h2>
              <ol className="mt-3 border-t border-rule">
                {scored
                  .filter((r) => r.sectionIndex === index)
                  .map((r) => (
                    <li key={r.question.publicId} className="mt-review-row" data-outcome={r.outcome}>
                      <span className="num font-semibold text-ink">Q{r.question.number}</span>
                      <span className="text-[14px] text-ink-soft">
                        Yours: <strong className="text-ink">{r.response?.trim() ? r.response : '—'}</strong>
                        {' · '}Answer:{' '}
                        <strong className="text-ink">
                          {r.question.dropped
                            ? 'dropped'
                            : r.question.type === 'NUMERICAL'
                              ? (r.question.numeric?.value ?? '—')
                              : r.question.correct.join(' or ')}
                        </strong>
                      </span>
                      <span className="mt-outcome">
                        {r.outcome === 'right'
                          ? `Right, +${r.marks}`
                          : r.outcome === 'wrong'
                            ? `Wrong, ${r.marks}`
                            : r.outcome === 'dropped'
                              ? `Dropped, +${r.marks}`
                              : 'Blank, 0'}
                      </span>
                      <a href={r.question.path} target="_blank" rel="noopener" className="mt-solution-link">
                        Solution
                      </a>
                    </li>
                  ))}
              </ol>
            </div>
          ))}
        </section>
      </div>
    );
  }

  // ── The test ────────────────────────────────────────────────────────────
  if (!current) return null;
  const { question } = current;
  const response = state.responses[question.publicId] ?? '';
  const isMarked = Boolean(state.marked[question.publicId]);
  const isLast = state.current === flat.length - 1;
  const lowTime = remainingMs !== null && remainingMs < 5 * 60_000;

  return (
    <div className="mt-shell">
      <div className="mt-bar" role="region" aria-label="Test controls">
        <div className="min-w-0">
          <p className="truncate text-[13px] text-ink-mute">{examName} mock test</p>
          <p className="truncate text-[14.5px] font-semibold text-ink">{title}</p>
        </div>
        <p className="mt-clock num" data-low={lowTime || undefined} aria-live="off">
          <span className="sr-only">{remainingMs !== null ? 'Time left' : 'Time taken'}: </span>
          {remainingMs !== null ? clock(remainingMs / 1000) : clock(elapsedMs / 1000)}
        </p>
        <button type="button" className="qp-button qp-button-primary" onClick={() => setConfirming(true)}>
          Submit
        </button>
      </div>

      {confirming ? (
        <div className="mt-confirm q-card" role="alertdialog" aria-labelledby="mt-confirm-title">
          <p id="mt-confirm-title" className="font-semibold text-ink">
            Submit the test?
          </p>
          <p className="mt-1 text-[14.5px] text-ink-soft">
            You have answered {answeredCount} of {flat.length}.
            {remainingMs !== null ? ` ${clock(remainingMs / 1000)} is left on the clock.` : ''} You cannot change
            answers after submitting.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" className="qp-button qp-button-primary" onClick={submit}>
              Yes, submit
            </button>
            <button type="button" className="qp-button" onClick={() => setConfirming(false)}>
              Keep going
            </button>
          </div>
        </div>
      ) : null}

      <nav className="mt-tabs" aria-label="Subjects">
        {sections.map((section, index) => {
          const active = current.sectionIndex === index;
          const done = section.questions.filter((q) => (state.responses[q.publicId] ?? '').trim() !== '').length;
          return (
            <button
              key={section.subject.slug}
              type="button"
              className="mt-tab"
              aria-current={active || undefined}
              onClick={() => go(sectionStart[index]!)}
            >
              {section.subject.name}
              <span className="num text-[12.5px] text-ink-mute">
                {' '}
                {done}/{section.questions.length}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="mt-layout">
        <article className="q-card" ref={questionTop} aria-labelledby="mt-qno">
          <div className="q-meta mb-4">
            <span id="mt-qno" className="chip num">
              Question {state.current + 1} of {flat.length}
            </span>
            <span className="chip">{question.type === 'NUMERICAL' ? 'Numerical answer' : 'Single correct'}</span>
            <span className="chip num">
              +{question.marksRight} / {question.marksWrong < 0 ? question.marksWrong : '0'}
            </span>
          </div>

          <div className="rich" dangerouslySetInnerHTML={{ __html: question.stemHtml }} />

          <fieldset className="mt-6">
            <legend className="sr-only">{question.type === 'NUMERICAL' ? 'Your answer' : 'Choose one'}</legend>
            {question.type === 'NUMERICAL' ? (
              <label className="qp-numeric">
                <span className="text-[14px] text-ink-soft">Your answer</span>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  className="num"
                  value={response}
                  onChange={(event) => respond(question.publicId, event.target.value)}
                />
              </label>
            ) : (
              <ul className="grid gap-3">
                {question.options.map((option) => (
                  <li key={option.label}>
                    <label className="qp-option" data-picked={response === option.label || undefined}>
                      <input
                        type="radio"
                        name={`mt-${question.publicId}`}
                        value={option.label}
                        checked={response === option.label}
                        onChange={() => respond(question.publicId, option.label)}
                      />
                      <span className="qp-label num" aria-hidden="true">
                        {option.label}
                      </span>
                      <span className="qp-body" dangerouslySetInnerHTML={{ __html: option.html }} />
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>

          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" className="qp-button" onClick={() => go(state.current - 1)} disabled={state.current === 0}>
              Previous
            </button>
            <button
              type="button"
              className="qp-button"
              onClick={() => clearResponse(question.publicId)}
              disabled={response === ''}
            >
              Clear answer
            </button>
            <button
              type="button"
              className="qp-button"
              onClick={() => {
                toggleMark(question.publicId, !isMarked);
                if (!isMarked && !isLast) go(state.current + 1);
              }}
            >
              {isMarked ? 'Unmark review' : 'Mark for review & next'}
            </button>
            <button
              type="button"
              className="qp-button qp-button-primary"
              onClick={() => (isLast ? setConfirming(true) : go(state.current + 1))}
            >
              {isLast ? 'Save & submit' : 'Save & next'}
            </button>
          </div>
        </article>

        <aside className="mt-palette q-card" aria-label="Question palette">
          {sections.map((section, sectionIndex) => (
            <div key={section.subject.slug} className="mb-4 last:mb-0">
              <p className="mb-2 text-[13px] font-semibold text-ink">{section.subject.name}</p>
              <ol className="mt-grid">
                {section.questions.map((q, i) => {
                  const index = sectionStart[sectionIndex]! + i;
                  const answered = (state.responses[q.publicId] ?? '').trim() !== '';
                  const status = state.marked[q.publicId]
                    ? answered
                      ? 'marked-answered'
                      : 'marked'
                    : answered
                      ? 'answered'
                      : state.visited[q.publicId]
                        ? 'unanswered'
                        : 'unseen';
                  return (
                    <li key={q.publicId}>
                      <button
                        type="button"
                        className="mt-cell num"
                        data-status={status}
                        aria-current={index === state.current || undefined}
                        aria-label={`Question ${index + 1}, ${status.replace('-', ' and ')}`}
                        onClick={() => go(index)}
                      >
                        {index + 1}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
          <ul className="mt-legend">
            <li><span className="mt-cell" data-status="answered" aria-hidden="true" /> Answered</li>
            <li><span className="mt-cell" data-status="unanswered" aria-hidden="true" /> Not answered</li>
            <li><span className="mt-cell" data-status="marked" aria-hidden="true" /> For review</li>
            <li><span className="mt-cell" data-status="unseen" aria-hidden="true" /> Not seen</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
