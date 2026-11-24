import { markdownMathToText } from '@stc/utils';

/**
 * A short, distinctive line describing one exam question, for its <title>,
 * meta description and link rows.
 *
 * Exam questions often open with the same words — "Match List - I with
 * List - II", "Given below are two statements" — so the opening alone gave
 * many pages the same title. This drops those openings and keeps the part
 * that differs: the statement, the substance, the formula.
 */
const OPENERS: ReadonlyArray<[RegExp, string]> = [
  [
    /^Match List\s*-?\s*I with List\s*-?\s*II\.?\s*(Choose the correct answer from the options given below:?)?\s*/i,
    '',
  ],
  [/^Given below are two statements( for| on| about| regarding)?\s*([^:]*):\s*/i, ''],
  [
    /^In the light of the above statements,? choose the (most appropriate|correct) answer[^.]*\.?\s*/i,
    '',
  ],
];

function cut(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max - 1);
  const space = slice.lastIndexOf(' ');
  return `${(space > max * 0.6 ? slice.slice(0, space) : slice).replace(/[\s,;:(–-]+$/, '')}…`;
}

export function questionHeadline(stem: string, chapter: string | null, max: number): string {
  let text = markdownMathToText(stem);
  let kind = '';
  if (/^Match List/i.test(text)) kind = 'Match the lists';
  else if (/^Given below are two statements/i.test(text)) kind = 'Two statements';
  for (const [pattern, replacement] of OPENERS) text = text.replace(pattern, replacement);
  // For a statements question, the first statement is the distinctive part.
  const first =
    kind === 'Two statements' ? /Statement I\s*:?\s*(.+?)(?=Statement II|$)/i.exec(text) : null;
  if (first?.[1]) text = first[1];
  text = text.replace(/^(Given|Statement I)\s*:?\s*/i, '').trim();

  // Nothing left but the instruction (the lists are a table): name the topic.
  if (text.length < 12 || /^Choose the correct answer/i.test(text)) {
    return cut(`${kind || 'Question'}${chapter ? ` on ${chapter}` : ''}`, max);
  }
  return cut(kind ? `${kind}: ${text}` : text, max);
}
