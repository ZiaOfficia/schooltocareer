import katex from 'katex';
import { Marked, type Tokens } from 'marked';

/**
 * Question-bank text to HTML, on the server. Server Components only: KaTeX
 * is ~280 KB and has no business in the client bundle.
 *
 * Stems, options and solutions are stored as Markdown with $…$ (inline) and
 * $$…$$ (display) LaTeX. Rendering here, not in the browser, means a reader
 * sees typeset maths on first paint with no client JavaScript, and a crawler
 * reads the same text a student does.
 *
 * SAFETY. Content is written by our own editors, but the renderer still
 * treats it as untrusted: raw HTML in the Markdown is escaped, never passed
 * through; link targets are limited to http(s) and site paths; KaTeX runs
 * with `trust: false`, so \href, \url and friends cannot inject anything.
 *
 * HOW MATHS SURVIVES MARKDOWN. Markdown would otherwise read `_` and `*`
 * inside a formula as emphasis. Every formula is swapped for an opaque
 * placeholder before Markdown runs and swapped back, typeset, afterwards.
 */

const PLACEHOLDER = (i: number) => `\u0000M${i}\u0000`;
const PLACEHOLDER_RE = /\u0000M(\d+)\u0000/g;

/** $$…$$ first (display), then $…$ (inline, single line, not "\$"). */
const MATH_RE = /\$\$([\s\S]+?)\$\$|(?<!\\)\$((?:\\\$|[^$\n])+?)\$/g;

function typeset(tex: string, display: boolean): string {
  return katex.renderToString(tex.trim(), {
    displayMode: display,
    throwOnError: false, // a typo shows red source, not a broken page
    trust: false,
    strict: 'ignore',
    output: 'htmlAndMathml', // MathML keeps it readable to screen readers
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const SAFE_HREF = /^(https?:\/\/|\/(?!\/))/i;

const marked = new Marked({
  gfm: true, // tables: "Match List-I with List-II" questions are tables
  breaks: true, // a line break in a stem is a line break on the page
  renderer: {
    html({ text }: Tokens.HTML | Tokens.Tag): string {
      return escapeHtml(text);
    },
    link({ href, tokens }: Tokens.Link): string {
      const label = this.parser.parseInline(tokens);
      if (!SAFE_HREF.test(href)) return label;
      const external = /^https?:\/\//i.test(href);
      return `<a href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`;
    },
    image({ href, text }: Tokens.Image): string {
      if (!SAFE_HREF.test(href)) return '';
      return `<img src="${escapeHtml(href)}" alt="${escapeHtml(text)}" loading="lazy" decoding="async">`;
    },
  },
});

/** Block content: stems, solutions. Paragraphs, lists, tables, display maths. */
export function renderRich(markdown: string): string {
  const formulas: Array<{ tex: string; display: boolean }> = [];
  const shielded = markdown.replace(MATH_RE, (_match, display?: string, inline?: string) => {
    formulas.push(display !== undefined ? { tex: display, display: true } : { tex: inline!, display: false });
    return PLACEHOLDER(formulas.length - 1);
  });

  const html = marked.parse(shielded, { async: false }) as string;

  return html.replace(PLACEHOLDER_RE, (_m, index: string) => {
    const formula = formulas[Number(index)];
    return formula ? typeset(formula.tex, formula.display) : '';
  });
}

/** Inline content: an option's text. No surrounding paragraph. */
export function renderRichInline(markdown: string): string {
  const html = renderRich(markdown).trim();
  const single = /^<p>([\s\S]*)<\/p>$/.exec(html);
  return single && !single[1]!.includes('<p>') ? single[1]! : html;
}
