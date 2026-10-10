'use client';

import { useId, useState, type ReactNode } from 'react';

import type { QuestionType } from '@stc/types';

/**
 * Answer, check, read the solution — the one interactive piece of a question
 * page.
 *
 * Everything shown is rendered on the server and arrives as HTML: the option
 * bodies are typeset there, and the solution is passed in as `children`, so it
 * is in the page for crawlers and for a reader with JavaScript off (it simply
 * starts closed). This component only adds state: what was picked, whether it
 * was checked, and whether the solution is open.
 *
 * Real inputs (radio for one answer, checkbox for several, a number field for
 * numericals) inside a fieldset, so a keyboard and a screen reader work with
 * no extra wiring.
 */

export type PracticeOption = { label: string; html: string };

type Props = {
  type: QuestionType;
  options: PracticeOption[];
  /** Labels of the correct options. Empty for a numerical or a dropped question. */
  correct: string[];
  numeric: { value: number; tolerance: number } | null;
  dropped: boolean;
  /** The server-rendered solution. */
  children: ReactNode;
};

type Verdict = 'right' | 'wrong' | 'partial' | null;

function judge(props: Props, picked: string[], typed: string): Verdict {
  if (props.type === 'NUMERICAL') {
    if (!props.numeric || typed.trim() === '') return null;
    const value = Number(typed);
    if (!Number.isFinite(value)) return 'wrong';
    return Math.abs(value - props.numeric.value) <= props.numeric.tolerance + 1e-9 ? 'right' : 'wrong';
  }
  if (picked.length === 0) return null;
  const right = new Set(props.correct);
  // A single-answer question can still have two right options: when the
  // official key accepts either (a flawed question NTA did not drop), any one
  // of them scores, exactly as it did in the exam.
  if (props.type !== 'MCQ_MULTI') return picked.length === 1 && right.has(picked[0]!) ? 'right' : 'wrong';
  const allRight = picked.every((label) => right.has(label));
  if (allRight && picked.length === right.size) return 'right';
  // JEE Advanced-style partial credit: some correct, none wrong.
  if (allRight) return 'partial';
  return 'wrong';
}

const VERDICT_TEXT: Record<Exclude<Verdict, null>, string> = {
  right: 'Correct.',
  wrong: 'Not quite.',
  partial: 'Partly right: you have some of the correct options, but not all.',
};

export function QuestionPractice(props: Props) {
  const { type, options, correct, numeric, dropped, children } = props;
  const name = useId();
  const [picked, setPicked] = useState<string[]>([]);
  const [typed, setTyped] = useState('');
  const [checked, setChecked] = useState(false);
  const [open, setOpen] = useState(false);

  const verdict = checked ? judge(props, picked, typed) : null;
  const multi = type === 'MCQ_MULTI';
  const canCheck = !dropped && (type === 'NUMERICAL' ? typed.trim() !== '' : picked.length > 0);

  function toggle(label: string) {
    setChecked(false);
    setPicked((current) =>
      multi
        ? current.includes(label)
          ? current.filter((l) => l !== label)
          : [...current, label]
        : [label],
    );
  }

  function optionState(label: string): 'right' | 'wrong' | 'idle' {
    if (!checked) return 'idle';
    if (correct.includes(label)) return 'right';
    return picked.includes(label) ? 'wrong' : 'idle';
  }

  return (
    <div className="qp">
      <fieldset className="qp-options" disabled={dropped}>
        <legend className="sr-only">
          {type === 'NUMERICAL' ? 'Your answer' : multi ? 'Choose one or more' : 'Choose one'}
        </legend>

        {type === 'NUMERICAL' ? (
          <label className="qp-numeric">
            <span className="text-[14px] text-ink-soft">Your answer</span>
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={typed}
              onChange={(event) => {
                setChecked(false);
                setTyped(event.target.value);
              }}
              className="num"
            />
          </label>
        ) : (
          <ul className="grid gap-3">
            {options.map((option) => {
              const state = optionState(option.label);
              return (
                <li key={option.label}>
                  <label className="qp-option" data-state={state} data-picked={picked.includes(option.label) || undefined}>
                    <input
                      type={multi ? 'checkbox' : 'radio'}
                      name={name}
                      value={option.label}
                      checked={picked.includes(option.label)}
                      onChange={() => toggle(option.label)}
                    />
                    <span className="qp-label num" aria-hidden="true">
                      {option.label}
                    </span>
                    <span className="qp-body" dangerouslySetInnerHTML={{ __html: option.html }} />
                    {state === 'right' ? (
                      <span className="qp-mark">{!multi && correct.length > 1 ? 'Accepted answer' : 'Correct answer'}</span>
                    ) : null}
                    {state === 'wrong' ? <span className="qp-mark">Your answer</span> : null}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {!dropped ? (
          <button
            type="button"
            className="qp-button qp-button-primary"
            disabled={!canCheck}
            onClick={() => {
              setChecked(true);
              setOpen(true);
            }}
          >
            Check answer
          </button>
        ) : null}
        <button type="button" className="qp-button" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? 'Hide solution' : 'Show solution'}
        </button>
        <p aria-live="polite" className="qp-verdict" data-verdict={verdict ?? undefined}>
          {verdict ? VERDICT_TEXT[verdict] : ''}
          {verdict === 'wrong' && type === 'NUMERICAL' && numeric ? ` The answer is ${numeric.value}.` : ''}
        </p>
      </div>

      <details
        className="qp-solution"
        open={open}
        onToggle={(event) => setOpen((event.target as HTMLDetailsElement).open)}
      >
        <summary className="sr-only">Solution</summary>
        {children}
      </details>
    </div>
  );
}
