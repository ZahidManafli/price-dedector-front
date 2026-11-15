import { useEffect } from 'react';

// Scroll-reveal for the landing page.
//
//   <div data-reveal>…</div>                     fade up (default)
//   <div data-reveal="left|right|zoom|fade">…    other entrances
//   <div data-reveal data-reveal-delay="150">    extra delay in ms
//   <div data-reveal-stagger>{cards}</div>       every child enters one after another
//
// Elements are hidden until they scroll into view, then play a one-off CSS
// animation. The "revealed" mark is a data attribute (not a class) so React
// re-renders that rewrite className never hide an element again. New nodes
// (plans loading, tab switches) are picked up through a MutationObserver.

export const SCROLL_REVEAL_CSS = `
@keyframes rvUp{from{opacity:0;translate:0 36px;filter:blur(6px)}to{opacity:1;translate:0 0;filter:blur(0)}}
@keyframes rvLeft{from{opacity:0;translate:-48px 0;filter:blur(6px)}to{opacity:1;translate:0 0;filter:blur(0)}}
@keyframes rvRight{from{opacity:0;translate:48px 0;filter:blur(6px)}to{opacity:1;translate:0 0;filter:blur(0)}}
@keyframes rvZoom{from{opacity:0;scale:.94;translate:0 24px}to{opacity:1;scale:1;translate:0 0}}
@keyframes rvFade{from{opacity:0}to{opacity:1}}
[data-reveal]:not([data-revealed]),[data-reveal-stagger]>:not([data-revealed]){opacity:0}
[data-revealed]{animation:rvUp .9s cubic-bezier(.16,1,.3,1) var(--rv-delay,0ms) backwards}
[data-revealed][data-reveal="left"]{animation-name:rvLeft}
[data-revealed][data-reveal="right"]{animation-name:rvRight}
[data-revealed][data-reveal="zoom"]{animation-name:rvZoom;animation-duration:1.1s}
[data-revealed][data-reveal="fade"]{animation-name:rvFade;animation-duration:1.2s}
@media (prefers-reduced-motion: reduce){[data-reveal]:not([data-revealed]),[data-reveal-stagger]>:not([data-revealed]){opacity:1}[data-revealed]{animation:none}}
`;

const STAGGER_STEP_MS = 90;
const STAGGER_MAX_STEPS = 5;

export function useScrollReveal(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const reveal = (el) => el.setAttribute('data-revealed', '');

    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced || typeof IntersectionObserver === 'undefined') {
      const all = () => root.querySelectorAll('[data-reveal], [data-reveal-stagger] > *').forEach(reveal);
      all();
      const mo = new MutationObserver(all);
      mo.observe(root, { childList: true, subtree: true });
      return () => mo.disconnect();
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Also reveal anything already above the viewport (anchor jumps, fast
          // scrolling) so nothing stays invisible when the user scrolls back up.
          const passed = entry.boundingClientRect.bottom < (entry.rootBounds?.top ?? 0);
          if (!entry.isIntersecting && !passed) return;
          reveal(entry.target);
          io.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
    );

    const seen = new WeakSet();
    const scan = () => {
      root.querySelectorAll('[data-reveal]').forEach((el) => {
        if (seen.has(el) || el.hasAttribute('data-revealed')) return;
        seen.add(el);
        const delay = Number(el.getAttribute('data-reveal-delay') || 0);
        if (delay) el.style.setProperty('--rv-delay', `${delay}ms`);
        io.observe(el);
      });
      root.querySelectorAll('[data-reveal-stagger]').forEach((parent) => {
        const variant = parent.getAttribute('data-reveal-stagger') || '';
        Array.from(parent.children).forEach((child, i) => {
          if (seen.has(child) || child.hasAttribute('data-revealed')) return;
          seen.add(child);
          if (variant && !child.hasAttribute('data-reveal')) child.setAttribute('data-reveal', variant);
          child.style.setProperty('--rv-delay', `${(i % STAGGER_MAX_STEPS) * STAGGER_STEP_MS}ms`);
          io.observe(child);
        });
      });
    };

    scan();
    let frame = 0;
    const mo = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(scan);
    });
    mo.observe(root, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(frame);
      mo.disconnect();
      io.disconnect();
    };
  }, [rootRef]);
}
