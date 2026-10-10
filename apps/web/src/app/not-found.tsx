import Link from 'next/link';

import { ROUTES } from '@stc/constants';
import { Wrap } from '@stc/ui';

import { ArrowRightIcon } from '@/components/icons';

/**
 * The 404. Next sends the real 404 status and a `noindex` for this file on its
 * own; the job here is only to get the visitor back to something that exists.
 * Links ONLY to routes that resolve — same rule as the footer.
 */
export default function NotFound() {
  return (
    <div className="night hero-bg">
      <Wrap className="py-24 sm:py-32">
        <p className="num gradient-text text-[clamp(56px,12vw,112px)] font-bold leading-none">
          404
        </p>
        <h1 className="mt-4 text-[clamp(26px,4.5vw,40px)] leading-tight">
          This page does not exist.
        </h1>
        <p className="mt-4 max-w-[52ch] text-[16px] text-ink-soft">
          The address may be mistyped, or the page may not be built yet. Nothing was lost — start
          again from the exam list or the home page.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={ROUTES.exams()} className="btn btn-primary">
            Browse exams
            <ArrowRightIcon width={16} height={16} />
          </Link>
          <Link href={ROUTES.home()} className="btn btn-ghost">
            Go to home
          </Link>
        </div>
      </Wrap>
    </div>
  );
}
