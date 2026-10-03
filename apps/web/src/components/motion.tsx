'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

declare global {
  interface Window {
    /** Set once GSAP has loaded. The inline script in the root layout reads it. */
    __stcMotion?: boolean;
  }
}

/**
 * All GSAP motion on the site, driven by data attributes.
 *
 * Pages stay Server Components: they mark elements up (`data-reveal`,
 * `data-words`, `data-tilt`, `data-count`) and this one client component,
 * mounted once in the root layout, animates whatever it finds. GSAP itself is
 * imported inside the effect, so it is never part of the bundle that has to
 * load before the page is readable.
 *
 *   data-reveal     fades up when scrolled into view; neighbours stagger
 *   data-words      headline whose `.word-in` spans rise in one by one
 *   data-count      a number that counts up to its own text content
 *   data-tilt       a card that leans towards the pointer (mouse only)
 *   data-parallax   drifts slower than the scroll, inside its parent band
 *   data-header     the sticky header: hides scrolling down, returns scrolling up
 *   data-progress   the reading-progress bar
 *
 * The hidden starting states live in globals.css, not here — see the MOTION
 * block there for why that cannot leave content invisible.
 */
export function Motion() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let cancelled = false;
    let revert = () => {};

    void (async () => {
      try {
        const [{ gsap }, { ScrollTrigger }] = await Promise.all([
          import('gsap'),
          import('gsap/ScrollTrigger'),
        ]);
        if (cancelled) return;

        gsap.registerPlugin(ScrollTrigger);
        window.__stcMotion = true;

        const ctx = gsap.context(() => {
          // ── Headline words ──────────────────────────────────────────────
          gsap.utils.toArray<HTMLElement>('[data-words]:not([data-revealed])').forEach((el) => {
            el.setAttribute('data-revealed', '');
            gsap.fromTo(
              el.querySelectorAll('.word-in'),
              { yPercent: 110 },
              {
                yPercent: 0,
                duration: 0.95,
                ease: 'power4.out',
                stagger: 0.055,
                delay: 0.1,
              },
            );
          });

          // ── Scroll reveals ──────────────────────────────────────────────
          ScrollTrigger.batch('[data-reveal]:not([data-revealed])', {
            start: 'top 92%',
            once: true,
            onEnter: (batch) => {
              batch.forEach((el) => el.setAttribute('data-revealed', ''));
              gsap.fromTo(
                batch,
                { opacity: 0, y: 28 },
                {
                  opacity: 1,
                  y: 0,
                  duration: 0.8,
                  ease: 'power3.out',
                  stagger: 0.06,
                  // Leaves no inline transform behind, so a revealed card is
                  // free to be tilted by the pointer afterwards.
                  clearProps: 'opacity,transform',
                },
              );
            },
          });

          // ── Count-ups ───────────────────────────────────────────────────
          gsap.utils.toArray<HTMLElement>('[data-count]').forEach((el) => {
            const target = Number(el.dataset.count);
            if (!Number.isFinite(target) || target <= 0) return;
            const state = { value: 0 };
            gsap.to(state, {
              value: target,
              duration: 1.2,
              ease: 'power2.out',
              scrollTrigger: { trigger: el, start: 'top 95%', once: true },
              onUpdate: () => {
                el.textContent = Math.round(state.value).toLocaleString('en-IN');
              },
            });
          });

          // ── Parallax ────────────────────────────────────────────────────
          gsap.utils.toArray<HTMLElement>('[data-parallax]').forEach((el) => {
            gsap.to(el, {
              yPercent: 16,
              ease: 'none',
              scrollTrigger: {
                trigger: el.parentElement,
                start: 'top top',
                end: 'bottom top',
                scrub: true,
              },
            });
          });

          // ── Reading progress ────────────────────────────────────────────
          const bar = document.querySelector<HTMLElement>('[data-progress]');
          if (bar) {
            gsap.to(bar, {
              scaleX: 1,
              ease: 'none',
              scrollTrigger: { start: 0, end: 'max', scrub: 0.3 },
            });
          }

          // ── Header ──────────────────────────────────────────────────────
          const header = document.querySelector<HTMLElement>('[data-header]');
          if (header) {
            let hidden = false;
            const setHidden = (next: boolean) => {
              if (next === hidden) return;
              hidden = next;
              gsap.to(header, {
                yPercent: next ? -105 : 0,
                duration: 0.35,
                ease: 'power2.out',
                overwrite: true,
              });
            };
            ScrollTrigger.create({
              start: 0,
              end: 'max',
              onUpdate: (self) => {
                const y = self.scroll();
                header.toggleAttribute('data-scrolled', y > 8);
                // Never slide away from under someone who is using it.
                const inUse =
                  header.contains(document.activeElement) ||
                  header.querySelector('details[open]') !== null;
                setHidden(y > 320 && self.direction === 1 && !inUse);
              },
            });
          }
        });

        const unbindTilt = bindTilt(gsap);

        revert = () => {
          unbindTilt();
          ctx.revert();
        };
      } catch (error) {
        // Without GSAP nothing will ever reveal, so stop hiding things.
        root.classList.remove('js');
        console.warn('[motion] animation code failed to load', error);
      }
    })();

    return () => {
      cancelled = true;
      revert();
    };
  }, [pathname]);

  return null;
}

/**
 * Pointer tilt for `[data-tilt]` cards.
 *
 * Only where there is a real hover — on touch the lean would fire on tap and
 * stick. Returns the function that removes every listener it added.
 */
function bindTilt(gsap: typeof import('gsap').gsap): () => void {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return () => {};

  const MAX_DEG = 5;
  const unbinders: Array<() => void> = [];

  document.querySelectorAll<HTMLElement>('[data-tilt]').forEach((el) => {
    const onMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
      el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
      gsap.to(el, {
        rotationY: (px - 0.5) * 2 * MAX_DEG,
        rotationX: (0.5 - py) * 2 * MAX_DEG,
        y: -4,
        transformPerspective: 800,
        duration: 0.4,
        ease: 'power2.out',
        overwrite: true,
      });
    };
    const onLeave = () => {
      gsap.to(el, {
        rotationX: 0,
        rotationY: 0,
        y: 0,
        duration: 0.6,
        ease: 'power3.out',
        overwrite: true,
        clearProps: 'transform',
      });
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    unbinders.push(() => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      gsap.killTweensOf(el);
      gsap.set(el, { clearProps: 'transform' });
    });
  });

  return () => unbinders.forEach((unbind) => unbind());
}
