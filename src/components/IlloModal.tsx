import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CardNode } from '../data';
import IlloCalendar, { CAL_MARKERS, CAL_VIEW } from './IlloCalendar';
import IlloWallet from './IlloWallet';

// concise, sensible copy per tapped account (Figma 731:10520 / 734:6520).
function modalCopy(node: CardNode): { heading: string; body: string } {
  if (node.id === 'core') {
    return {
      heading: 'Bills and expenses',
      body: 'The money set aside for your rent, utilities, and recurring monthly bills.',
    };
  }
  if (node.id === 'spend') {
    return {
      heading: 'Daily spend',
      body: 'Your day-to-day money for groceries, coffee, and everyday purchases.',
    };
  }
  return {
    heading: node.title,
    body: `A slice of your surplus flows here each month until it reaches ${node.amount}.`,
  };
}

// The Illustrated style's OWN account modal (Figma 731:10520 Core/calendar,
// 734:6520 Spend/credit-card). A centered white card with a GIANT illustration,
// title, description and a dark "Got it" button, floating over a blurred/darkened
// scrim. The DEFINING behaviour: the tapped card's small 64px illustration
// SEAMLESSLY GROWS into the modal's big illustration via a shared-element FLIP —
// the SAME svg asset scaled, so the morph is truly continuous — and shrinks back
// into the card on dismiss.
const MORPH_MS = 340;
// one easing pair for the whole morph: decelerate on open (grow toward you),
// accelerate on close (shrink away). Scrim + card share these in CSS.
const EASE_OUT = 'cubic-bezier(0.22, 0.7, 0.16, 1)';
const EASE_IN = 'cubic-bezier(0.55, 0, 0.85, 0.35)';

// The modal calendar chrome is scaled up (bigger than the card's small calendar);
// the bill-sticker discs are drawn as a SEPARATE fixed-px overlay so they stay a
// constant size (reading smaller relative to the bigger chrome). These px must
// match `.illo-modal-illo--cal { width }` in the CSS so the discs land on the
// right grid cells. Height follows the calendar's 55×51 aspect.
const MODAL_CAL_W = 248;
const MODAL_CAL_H = (MODAL_CAL_W * CAL_VIEW.h) / CAL_VIEW.w;
const STICKER_PX = 32; // fixed disc diameter (independent of the chrome scale)

export default function IlloModal({
  node,
  restRect,
  onDismiss,
}: {
  node: CardNode;
  restRect: DOMRect | null; // on-screen rect of the tapped card's small illustration
  onDismiss: () => void;
}) {
  const { heading, body } = modalCopy(node);
  const isSpend = node.id === 'spend';
  const illoRef = useRef<HTMLDivElement>(null);
  // the FLIP inverted transform (big illustration mapped back onto the card's
  // small illustration rect), computed once at open and reused verbatim on close
  // so the grow and shrink are perfectly symmetric.
  const invertRef = useRef<string>('none');
  const [closing, setClosing] = useState(false);
  // becomes true once the shared-element GROW has settled — the handoff cue for
  // the post-grow beats: Core's bill stickers pop in one-by-one, Spend's credit
  // card rises out of the pocket. Kept false during the grow so the growing
  // element is JUST the calendar chrome / tucked wallet.
  const [settled, setSettled] = useState(false);

  // OPEN — proper FLIP on the illustration alone: it's rendered at its final
  // (big/centered) geometry. Clear any transform first so we always measure the
  // NATURAL rect (idempotent under React StrictMode's double-invoked layout
  // effect — otherwise the second run would measure the already-inverted element
  // and snap), invert that onto the card's small illustration rect, force a
  // reflow to commit the start, then ease the transform back to identity so the
  // illustration grows toward the user.
  useLayoutEffect(() => {
    const el = illoRef.current;
    if (!el || !restRect) return;
    el.style.transition = 'none';
    el.style.transform = 'none';
    const last = el.getBoundingClientRect();
    if (!last.width || !last.height) return;
    const dx = restRect.left - last.left;
    const dy = restRect.top - last.top;
    const sx = restRect.width / last.width;
    const sy = restRect.height / last.height;
    const invert = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
    invertRef.current = invert;
    el.style.transform = invert;
    // force reflow so the inverted start is committed before we animate to identity
    void el.getBoundingClientRect();
    requestAnimationFrame(() => {
      el.style.transition = `transform ${MORPH_MS}ms ${EASE_OUT}`;
      el.style.transform = 'none';
    });
  }, [restRect]);

  // once the grow lands, kick off the post-grow beat (sticker stagger / card
  // rise). A small buffer past MORPH_MS guarantees the FLIP has fully settled so
  // the handoff reads as a distinct, intentional second step.
  useEffect(() => {
    const id = window.setTimeout(() => setSettled(true), MORPH_MS + 60);
    return () => window.clearTimeout(id);
  }, []);

  // CLOSE — reverse the exact same morph back to the inverted transform (the
  // illustration shrinks into the card), then unmount once it lands
  // (transitionend, with a timeout fallback) so nothing pops mid-shrink.
  const dismiss = useCallback(() => {
    if (closing) return;
    setClosing(true);
    const el = illoRef.current;
    if (!el || invertRef.current === 'none') {
      onDismiss();
      return;
    }
    el.style.transition = `transform ${MORPH_MS}ms ${EASE_IN}`;
    el.style.transform = invertRef.current;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      onDismiss();
    };
    el.addEventListener('transitionend', finish, { once: true });
    window.setTimeout(finish, MORPH_MS + 80); // fallback if transitionend is missed
  }, [closing, onDismiss]);

  return (
    <div className={`illo-modal${closing ? ' illo-modal--closing' : ''}`}>
      <div className="illo-scrim" onClick={dismiss} aria-hidden />
      <div className="illo-modal-card" role="dialog" aria-modal="true" aria-label={heading}>
        <div className="illo-modal-head">
          <div className="illo-modal-title">{heading}</div>
          <p className="illo-modal-body">{body}</p>
        </div>
        <button type="button" className="illo-modal-btn" onClick={dismiss}>
          Got it
        </button>
      </div>
      {/* the hero illustration: ONE element that FLIP-grows from the card's small
          slot to this big centered slot (and shrinks back on close). Rendered on
          top of the white card chrome.
          - Spend: the layered wallet; the whole thing grows as one, then the
            credit card rises out of the pocket (see `.illo-wallet-card`).
          - Core: the calendar CHROME grows (bigger than the card's), then the four
            fixed-size bill stickers pop in one-by-one as a separate overlay. */}
      {isSpend ? (
        <div
          ref={illoRef}
          className={`illo-modal-illo illo-modal-illo--wallet${settled ? ' risen' : ''}`}
          aria-hidden
        >
          <IlloWallet />
        </div>
      ) : (
        <div ref={illoRef} className="illo-modal-illo illo-modal-illo--cal" aria-hidden>
          <IlloCalendar markers={false} />
          <div className={`illo-cal-stickers${settled ? ' on' : ''}`}>
            {CAL_MARKERS.map(({ Icon, cx, cy }, i) => (
              <span
                key={i}
                className="illo-cal-sticker"
                style={{
                  left: (cx / CAL_VIEW.w) * MODAL_CAL_W - STICKER_PX / 2,
                  top: (cy / CAL_VIEW.h) * MODAL_CAL_H - STICKER_PX / 2,
                  width: STICKER_PX,
                  height: STICKER_PX,
                  animationDelay: `${i * 95}ms`,
                }}
              >
                <Icon size={STICKER_PX * 0.62} color="#ffffff" strokeWidth={2.4} absoluteStrokeWidth />
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
