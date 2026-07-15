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
  const [closing, setClosing] = useState(false);

  // FLIP: map the focus card back onto the resting rect, then ease to identity.
  const restTransform = useCallback((): string => {
    const el = cardRef.current;
    if (!el || !restRect) return 'none';
    const focus = el.getBoundingClientRect();
    if (!focus.width || !focus.height) return 'none';
    const dx = restRect.left - focus.left;
    const dy = restRect.top - focus.top;
    const sx = restRect.width / focus.width;
    const sy = restRect.height / focus.height;
    return `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
  }, [restRect]);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const start = restTransform();
    el.style.transition = 'none';
    el.style.transform = start;
    // force reflow so the start transform is committed before we animate to identity
    void el.getBoundingClientRect();
    requestAnimationFrame(() => {
      el.style.transition = `transform ${MORPH_MS}ms cubic-bezier(0.22, 0.7, 0.16, 1)`;
      el.style.transform = 'none';
    });
  }, [restTransform]);

  // reverse the morph, then unmount once the card has shrunk back into place
  const dismiss = useCallback(() => {
    if (closing) return;
    setClosing(true);
    const el = cardRef.current;
    if (!el) {
      onDismiss();
      return;
    }
    const back = restTransform();
    el.style.transition = `transform ${MORPH_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`;
    el.style.transform = back;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      onDismiss();
    };
    el.addEventListener('transitionend', finish, { once: true });
    window.setTimeout(finish, MORPH_MS + 80); // fallback if transitionend is missed
  }, [closing, restTransform, onDismiss]);

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
