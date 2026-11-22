import Link from 'next/link';
import type { ReactNode } from 'react';

import { ScrollX, Section } from '@stc/ui';

import { AdSlot } from '@/components/ad-slot';
import type { ArticleBlock } from '@/lib/articles';

/**
 * Renders an article's blocks. Each `h2` opens a Section, so the table of
 * contents and the section ids come from the same headings.
 *
 * Inline markup is deliberately tiny: [label](href) and **bold**. A site path
 * becomes a <Link>; anything else opens as an external link.
 */

const INLINE = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g;

export function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > last) out.push(text.slice(last, index));
    const [, label, href, bold] = match;
    if (label && href) {
      out.push(
        href.startsWith('/') ? (
          <Link key={key++} href={href} className="underline">
            {label}
          </Link>
        ) : (
          <a key={key++} href={href} rel="noopener" className="underline">
            {label}
          </a>
        ),
      );
    } else if (bold) {
      out.push(
        <strong key={key++} className="font-semibold text-ink">
          {bold}
        </strong>,
      );
    }
    last = index + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Block({ block }: { block: Exclude<ArticleBlock, { kind: 'h2' }> }) {
  switch (block.kind) {
    case 'p':
      return <p>{inline(block.text)}</p>;
    case 'ul':
      return (
        <ul className="grid list-disc gap-2 pl-5">
          {block.items.map((item) => (
            <li key={item.slice(0, 48)}>{inline(item)}</li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol className="grid list-decimal gap-2 pl-5">
          {block.items.map((item) => (
            <li key={item.slice(0, 48)}>{inline(item)}</li>
          ))}
        </ol>
      );
    case 'tip':
      return (
        <p className="rounded-[14px] bg-hl-soft px-5 py-4 text-[16px] text-ink">
          {inline(block.text)}
        </p>
      );
    case 'table':
      return (
        <ScrollX>
          <table className="w-full min-w-[520px] border-collapse text-left text-[14.5px]">
            <caption className="sr-only">{block.caption}</caption>
            <thead>
              <tr className="bg-row-hover">
                {block.head.map((cell) => (
                  <th
                    key={cell}
                    scope="col"
                    className="whitespace-nowrap px-4 py-3 font-data text-[13px] font-semibold text-ink-mute"
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row.join('|')} className="border-t border-rule align-top">
                  {row.map((cell, i) =>
                    i === 0 ? (
                      <th key={i} scope="row" className="px-4 py-3 font-semibold text-ink">
                        {cell}
                      </th>
                    ) : (
                      <td key={i} className="px-4 py-3 text-ink-soft">
                        {cell}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollX>
      );
  }
}

type Group = { title: string | null; blocks: Array<Exclude<ArticleBlock, { kind: 'h2' }>> };

export function groupBlocks(blocks: readonly ArticleBlock[]): Group[] {
  const groups: Group[] = [{ title: null, blocks: [] }];
  for (const block of blocks) {
    if (block.kind === 'h2') groups.push({ title: block.text, blocks: [] });
    else groups[groups.length - 1]!.blocks.push(block);
  }
  return groups.filter((group) => group.title !== null || group.blocks.length > 0);
}

const PROSE =
  'grid max-w-[70ch] grid-cols-[minmax(0,1fr)] gap-5 text-[17px] leading-[1.75] text-ink-soft';

export function ArticleBody({
  blocks,
  adAfterSection,
}: {
  blocks: readonly ArticleBlock[];
  /** Places one in-content ad after this many headed sections (see AdSlot). */
  adAfterSection?: number;
}) {
  let headed = 0;
  return (
    <>
      {groupBlocks(blocks).map((group) => {
        if (group.title === null) {
          return (
            <div key="intro" className={PROSE}>
              {group.blocks.map((block, i) => (
                <Block key={i} block={block} />
              ))}
            </div>
          );
        }
        headed += 1;
        return (
          <div key={group.title}>
            <Section title={group.title}>
              <div className={PROSE}>
                {group.blocks.map((block, i) => (
                  <Block key={i} block={block} />
                ))}
              </div>
            </Section>
            {headed === adAfterSection ? <AdSlot kind="in-content" /> : null}
          </div>
        );
      })}
    </>
  );
}
