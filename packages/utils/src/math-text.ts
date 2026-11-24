/**
 * LaTeX maths as readable plain text, for page titles, descriptions and list
 * rows — places where the rendered maths cannot appear.
 *
 * WHY. Question previews used to replace every formula with "…". JEE
 * questions are mostly formulas, so dozens of pages got near-identical titles
 * such as "Let … and … . If … , then … equals:", and Google treated them as
 * duplicates ("Crawled – currently not indexed"). Students search for the
 * question as they read it — "x^2 + y^2 - 6x - 8y - 11 = 0" — so the text
 * should say that.
 *
 * Deliberately small: it handles what question stems actually use (fractions,
 * powers, roots, Greek letters, common operators, vectors, \text). Anything
 * it cannot make readable — a matrix, an unknown command with arguments —
 * becomes "…", the old behaviour, rather than leaking LaTeX source.
 */

const SUP: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '+': '⁺',
  '-': '⁻',
  '−': '⁻',
  '=': '⁼',
  '(': '⁽',
  ')': '⁾',
  n: 'ⁿ',
  i: 'ⁱ',
  x: 'ˣ',
};
const SUB: Record<string, string> = {
  '0': '₀',
  '1': '₁',
  '2': '₂',
  '3': '₃',
  '4': '₄',
  '5': '₅',
  '6': '₆',
  '7': '₇',
  '8': '₈',
  '9': '₉',
  '+': '₊',
  '-': '₋',
  '=': '₌',
  '(': '₍',
  ')': '₎',
  a: 'ₐ',
  e: 'ₑ',
  o: 'ₒ',
  x: 'ₓ',
  i: 'ᵢ',
  n: 'ₙ',
};

const SYMBOLS: Record<string, string> = {
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  epsilon: 'ε',
  varepsilon: 'ε',
  theta: 'θ',
  lambda: 'λ',
  mu: 'μ',
  nu: 'ν',
  pi: 'π',
  rho: 'ρ',
  sigma: 'σ',
  tau: 'τ',
  phi: 'φ',
  varphi: 'φ',
  omega: 'ω',
  Delta: 'Δ',
  Sigma: 'Σ',
  Omega: 'Ω',
  Phi: 'Φ',
  Lambda: 'Λ',
  Gamma: 'Γ',
  Theta: 'Θ',
  times: '×',
  cdot: '·',
  div: '÷',
  pm: '±',
  mp: '∓',
  le: '≤',
  leq: '≤',
  ge: '≥',
  geq: '≥',
  ne: '≠',
  neq: '≠',
  approx: '≈',
  equiv: '≡',
  infty: '∞',
  in: '∈',
  notin: '∉',
  subset: '⊂',
  subseteq: '⊆',
  cup: '∪',
  cap: '∩',
  to: '→',
  rightarrow: '→',
  Rightarrow: '⇒',
  leftarrow: '←',
  rightleftharpoons: '⇌',
  leftrightarrow: '↔',
  int: '∫',
  sum: 'Σ',
  prod: 'Π',
  partial: '∂',
  angle: '∠',
  circ: '°',
  degree: '°',
  perp: '⊥',
  parallel: '∥',
  therefore: '∴',
  cdots: '⋯',
  ldots: '…',
  dots: '…',
  forall: '∀',
  exists: '∃',
  nabla: '∇',
  hbar: 'ħ',
  ell: 'ℓ',
  sin: 'sin',
  cos: 'cos',
  tan: 'tan',
  cot: 'cot',
  sec: 'sec',
  csc: 'cosec',
  log: 'log',
  ln: 'ln',
  det: 'det',
  lim: 'lim',
  max: 'max',
  min: 'min',
  exp: 'exp',
};

/** Commands that only affect spacing or sizing: dropped. */
const DROP =
  /\\(?:left|right|big|Big|bigg|Bigg|displaystyle|textstyle|limits|nolimits|quad|qquad)(?![a-zA-Z])|\\[,;:!]/g;

/** Reads one {group} or single character starting at `i`; returns [content, next index]. */
function arg(s: string, i: number): [string, number] {
  while (s[i] === ' ') i++;
  if (s[i] !== '{') return [s[i] ?? '', i + 1];
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '{') depth++;
    else if (s[j] === '}' && --depth === 0) return [s.slice(i + 1, j), j + 1];
  }
  return [s.slice(i + 1), s.length];
}

function script(text: string, map: Record<string, string>, mark: string): string {
  const plain = convert(text).replace(/\s+/g, '');
  if (plain.length > 0 && [...plain].every((c) => map[c])) {
    return [...plain].map((c) => map[c]).join('');
  }
  return plain.length === 1 ? `${mark}${plain}` : `${mark}(${plain})`;
}

function wrap(text: string): string {
  return /^[\w.]+$/.test(text) ? text : `(${text})`;
}

function convert(input: string): string {
  if (/\\begin\{/.test(input)) return '…';
  const s = input.replace(DROP, ' ');
  let out = '';
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (c === '\\') {
      const m = /^\\([a-zA-Z]+|.)/.exec(s.slice(i));
      const name = m?.[1] ?? '';
      i += name.length + 1;
      if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
        const [num, a] = arg(s, i);
        const [den, b] = arg(s, a);
        i = b;
        out += `${wrap(convert(num))}/${wrap(convert(den))}`;
      } else if (name === 'sqrt') {
        const [body, a] = arg(s, i);
        i = a;
        out += `√${wrap(convert(body))}`;
      } else if (
        name === 'text' ||
        name === 'mathrm' ||
        name === 'mathbf' ||
        name === 'operatorname' ||
        name === 'mathit'
      ) {
        const [body, a] = arg(s, i);
        i = a;
        out += convert(body);
      } else if (name === 'hat' || name === 'vec' || name === 'overrightarrow' || name === 'bar') {
        const [body, a] = arg(s, i);
        i = a;
        const v = convert(body);
        out += name === 'hat' ? `${v}̂` : name === 'bar' ? `${v}̄` : `${v}⃗`;
      } else if (name === '{' || name === '}' || name === '%' || name === '$' || name === '_') {
        out += name;
      } else if (name === ' ' || name === '\\') {
        out += ' ';
      } else if (SYMBOLS[name] !== undefined) {
        out += SYMBOLS[name];
      } else {
        return '…';
      }
    } else if (c === '^' || c === '_') {
      const [body, a] = arg(s, i + 1);
      i = a;
      out += c === '^' ? script(body, SUP, '^') : script(body, SUB, '_');
    } else if (c === '{' || c === '}') {
      i++;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** One LaTeX expression (without its $ delimiters) as plain text. */
export function mathToText(latex: string): string {
  return convert(latex).replace(/\s+/g, ' ').trim();
}

/**
 * Markdown with $…$ / $$…$$ maths, as one line of plain text: maths
 * converted, markdown markers, tables and images dropped.
 */
export function markdownMathToText(markdown: string): string {
  return markdown
    .replace(/_{2,}/g, '⟦blank⟧')
    .replace(/\$\$([\s\S]*?)\$\$/g, (_, m: string) => ` ${mathToText(m)} `)
    .replace(/\$([^$\n]+)\$/g, (_, m: string) => mathToText(m))
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/^\s*\|.*$/gm, ' ')
    .replace(/^\s*>/gm, '')
    .replace(/[*_`#]/g, '')
    .replace(/⟦blank⟧/g, '____')
    .replace(/\s+/g, ' ')
    .replace(/(?:\s*…\s*)+/g, ' … ')
    .replace(/\s+([.,;:?])/g, '$1')
    .trim();
}
