import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { CardNode } from '../data';
import type { Dataset, DateMode, Mode } from '../scenario';
import ConvoCard from './ConvoCard';

// concise, sensible "About your …" copy per tapped card (Figma 731:10358).
function modalCopy(node: CardNode): { heading: string; body: string } {
  if (node.id === 'core') {
    return {
      heading: 'About your Core Account',
      body: 'Covers your recurring bills and essentials, and is funded first each month so the must-pays are always handled.',
    };
  }
  if (node.id === 'spend') {
    return {
      heading: 'About your Spend Account',
      body: 'Everyday, no-guilt money for groceries, dining, and fun — funded after your bills are covered.',
    };
  }
  return {
    heading: `About your ${node.title}`,
    body: `A slice of your surplus flows here each month until it reaches ${node.amount}.`,
  };
}

// The tap-to-expand focus state for a convo card (Figma 731:10200 / 734:6294). The
// ACTUAL tapped card morphs IN PLACE into the enlarged focus card via a FLIP
// transition: the focus card is rendered at its final geometry, then transformed
// back to the resting card's measured rect and eased to identity — so it reads as
// the same card growing (no duplicate "pop"). Dismiss reverses the morph. Below it
// a white "About your {name}" sheet slides in with a "Got it" / scrim-tap dismiss.
const MORPH_MS = 340;
// one easing pair for the whole morph: decelerate on open (grow toward you),
// accelerate on close (shrink away). Scrim + sheet share these in CSS.
const EASE_OUT = 'cubic-bezier(0.22, 0.7, 0.16, 1)';
const EASE_IN = 'cubic-bezier(0.55, 0, 0.85, 0.35)';

export default function ConvoModal({
  node,
  now,
  mode,
  dataset,
  dateMode,
  restRect,
  onDismiss,
}: {
  node: CardNode;
  now: number;
  mode: Mode;
  dataset: Dataset;
  dateMode: DateMode;
  restRect: DOMRect | null;
  onDismiss: () => void;
}) {
  const { heading, body } = modalCopy(node);
  const cardRef = useRef<HTMLDivElement>(null);
  // the FLIP inverted transform (focus card mapped back onto the resting rect),
  // computed once at open and reused verbatim on close so the two are symmetric.
  const invertRef = useRef<string>('none');
  const [closing, setClosing] = useState(false);

  // OPEN — proper FLIP: the focus card is rendered at its final (last) geometry.
  // We clear any transform first so we always measure the NATURAL rect (this makes
  // it robust to React StrictMode running the layout effect twice — otherwise the
  // second run would measure the already-inverted element and snap), invert that
  // onto the resting card's rect, force a reflow to commit the start, then ease
  // the single container transform back to identity so it grows toward the user.
  useLayoutEffect(() => {
    const el = cardRef.current;
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

  // CLOSE — reverse the exact same morph back to the inverted transform, then
  // unmount once the card has shrunk into place (transitionend, with a timeout
  // fallback) so it never pops mid-shrink.
  const dismiss = useCallback(() => {
    if (closing) return;
    setClosing(true);
    const el = cardRef.current;
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
    <div className={`convo-modal${closing ? ' convo-modal--closing' : ''}`}>
      <div className="convo-scrim" onClick={dismiss} aria-hidden />
      <div ref={cardRef} className="convo-pop-card">
        <ConvoCard node={node} now={now} mode={mode} dataset={dataset} dateMode={dateMode} expanded />
      </div>
      <div className="convo-sheet" role="dialog" aria-modal="true" aria-label={heading}>
        <div className="convo-sheet-head">
          <div className="convo-sheet-title">{heading}</div>
          <p className="convo-sheet-body">{body}</p>
        </div>
        <button type="button" className="convo-sheet-btn" onClick={dismiss}>
          Got it
        </button>
      </div>
    </div>
  );
}
