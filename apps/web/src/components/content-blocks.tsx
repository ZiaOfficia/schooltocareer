import { ScrollX } from '@stc/ui';

import type { ContentBlock } from '@/lib/exam-content';

/**
 * Renders the written blocks of an exam section.
 *
 * Tables are the reason this exists. A pattern or a syllabus is a grid of
 * small facts, and a student reads a grid far faster than the paragraph it
 * would otherwise be. Every table goes inside ScrollX, so a six-column table
 * scrolls inside itself on a phone instead of pushing the page sideways.
 *
 * The first column is a row header (`th scope="row"`): on a wide table that
 * has scrolled, it is what tells a screen reader which row a number is in.
 */
export function ContentBlocks({ blocks }: { blocks: readonly ContentBlock[] }) {
  return (
    <div className="grid gap-5">
      {blocks.map((block, index) => {
        if (block.kind === 'text') {
          return (
            <p key={index} data-reveal className="max-w-[72ch] text-[15.5px] text-ink-soft">
              {block.text}
            </p>
          );
        }

        if (block.kind === 'list') {
          return (
            <ul
              key={index}
              data-reveal
              className="grid max-w-[72ch] list-disc gap-2 pl-5 text-[15.5px] text-ink-soft"
            >
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          );
        }

        return (
          <figure key={index} data-reveal className="m-0">
            <ScrollX>
              <table className="w-full border-collapse text-left text-[14.5px]">
                <caption className="sr-only">{block.caption}</caption>
                <thead>
                  <tr className="bg-row-hover">
                    {block.head.map((cell) => (
                      <th
                        key={cell}
                        scope="col"
                        className="whitespace-nowrap px-4 py-3 font-data text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-mute"
                      >
                        {cell}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row) => (
                    <tr key={row.join('|')} className="border-t border-rule align-top">
                      {row.map((cell, column) =>
                        column === 0 ? (
                          <th key={column} scope="row" className="px-4 py-3 font-semibold text-ink">
                            {cell}
                          </th>
                        ) : (
                          <td key={column} className="px-4 py-3 text-ink-soft">
                            {cell}
                          </td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
                {block.foot ? (
                  <tfoot>
                    <tr className="border-t-2 border-rule bg-row-hover">
                      {block.foot.map((cell, column) =>
                        column === 0 ? (
                          <th key={column} scope="row" className="px-4 py-3 font-semibold text-ink">
                            {cell}
                          </th>
                        ) : (
                          <td key={column} className="num px-4 py-3 font-semibold text-ink">
                            {cell}
                          </td>
                        ),
                      )}
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </ScrollX>
            {block.note ? (
              <figcaption className="mt-2 max-w-[72ch] text-[13.5px] text-ink-mute">
                {block.note}
              </figcaption>
            ) : null}
          </figure>
        );
      })}
    </div>
  );
}
