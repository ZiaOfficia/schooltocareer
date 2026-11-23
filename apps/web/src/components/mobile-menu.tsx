'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { ArrowRightIcon, MenuIcon } from '@/components/icons';

export type MenuLink = { label: string; href: string; note?: string };
export type MenuGroup = { title: string; links: readonly MenuLink[] };

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The phone and tablet menu: a panel that slides in from the right over a
 * dimmed page.
 *
 * - Closes on the close button, a tap outside, the Escape key, and on every
 *   page change, so it never stays open over the page a link opened.
 * - The page behind does not scroll while it is open (body[data-menu-open]).
 * - Focus moves into the panel when it opens and back to the menu button
 *   when it closes; the panel is `inert` while hidden, so keyboard and
 *   screen-reader users never land on links they cannot see.
 * - Only `transform` and `opacity` animate, so the slide stays smooth on
 *   low-end phones; reduced-motion users get no animation (globals.css).
 *
 * It sits at the top of the page, never the bottom: the bottom edge of a
 * phone screen is kept free for an AdSense anchor ad.
 */
export function MobileMenu({
  groups,
  cta,
}: {
  groups: readonly MenuGroup[];
  cta: MenuLink | null;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  const close = useCallback(() => setOpen(false), []);

  // A link was followed: close.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (open) {
      document.body.setAttribute('data-menu-open', '');
      closeRef.current?.focus();
    } else {
      document.body.removeAttribute('data-menu-open');
      if (wasOpen.current) buttonRef.current?.focus();
    }
    wasOpen.current = open;
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Never leave the page locked if the component unmounts while open.
  useEffect(() => () => document.body.removeAttribute('data-menu-open'), []);

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(true)}
        className="grid h-11 w-11 place-items-center rounded-full border border-rule bg-surface text-ink transition-colors active:bg-row-hover"
      >
        <MenuIcon />
      </button>

      {/* A fixed, clipping layer: the panel waits off-screen to the right,
          and without this clip a phone browser counts it as page width and
          zooms the whole page out. */}
      <div
        className={`fixed inset-0 z-50 overflow-hidden transition-[visibility] duration-0 ${open ? 'visible' : 'pointer-events-none invisible delay-300'}`}
      >
        <div
          aria-hidden="true"
          onClick={close}
          className={`absolute inset-0 bg-[rgb(22_19_58/0.45)] transition-opacity duration-300 ${
            open ? 'opacity-100' : 'opacity-0'
          }`}
        />

        <div
          id={panelId}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          inert={!open}
          className={`absolute inset-y-0 right-0 flex w-[min(86vw,360px)] flex-col bg-surface shadow-[-24px_0_60px_-20px_rgb(22_19_58/0.35)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            open ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-rule px-5">
            <span className="font-display text-[19px] font-extrabold text-ink">Menu</span>
            <button
              ref={closeRef}
              type="button"
              aria-label="Close menu"
              onClick={close}
              className="grid h-11 w-11 place-items-center rounded-full text-ink transition-colors active:bg-row-hover"
            >
              <CloseIcon />
            </button>
          </div>

          <nav
            aria-label="Primary"
            className="flex-1 overflow-y-auto overscroll-contain px-3 pb-6 pt-2"
          >
            {groups.map((group) => (
              <div key={group.title} className="pt-4">
                <p className="px-3 pb-1 text-[13px] font-bold text-ink-mute">{group.title}</p>
                <ul>
                  {group.links.map((link) => {
                    const current = pathname === link.href;
                    return (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          onClick={close}
                          aria-current={current ? 'page' : undefined}
                          className={`flex min-h-[48px] items-center justify-between gap-3 rounded-[14px] px-3 py-2.5 no-underline transition-colors active:bg-row-hover ${
                            current ? 'bg-row-hover' : ''
                          }`}
                        >
                          <span>
                            <span className="block text-[16px] font-semibold text-ink">
                              {link.label}
                            </span>
                            {link.note ? (
                              <span className="block text-[13.5px] text-ink-mute">{link.note}</span>
                            ) : null}
                          </span>
                          <ArrowRightIcon
                            width={16}
                            height={16}
                            className="shrink-0 text-ink-mute"
                          />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          {cta ? (
            <div className="shrink-0 border-t border-rule p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Link href={cta.href} onClick={close} className="btn btn-primary w-full">
                {cta.label}
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
