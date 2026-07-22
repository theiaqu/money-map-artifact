import { useEffect, useRef, useState } from 'react';
import { CreditCard, Receipt, MessageCircle, CircleUser } from 'lucide-react';
import { type Dataset } from '../scenario';
import { HOME_BALANCES, HOME_ACCOUNTS, homeAccountFill } from '../data';

const money = (n: number) => `$${n.toLocaleString('en-US')}`;

// "Money Map" glyph — the exact icon used next to the "View Money Map" label in
// the Figma home screen (node 977:12237): three rounded account "bars" branching
// up to a single point. Reproduced as an inline stroke SVG (24×24, 1.5 stroke)
// so it matches the design pixel-for-pixel instead of the old lucide stand-in.
function MoneyMapIcon({ size = 22, color = '#111827' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M6 15H4C3.44772 15 3 15.4477 3 16V20C3 20.5523 3.44772 21 4 21H6C6.55228 21 7 20.5523 7 20V16C7 15.4477 6.55228 15 6 15Z" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 15H18C17.4477 15 17 15.4477 17 16V20C17 20.5523 17.4477 21 18 21H20C20.5523 21 21 20.5523 21 20V16C21 15.4477 20.5523 15 20 15Z" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.002 3C12.002 8 18.9609 6.625 18.9609 12" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 3C12 8 12 4.625 12 10" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 3.0332C12 8.0332 5 6.62427 5 11.9993" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 13H11C10.4477 13 10 13.4477 10 14V20C10 20.5523 10.4477 21 11 21H13C13.5523 21 14 20.5523 14 20V14C14 13.4477 13.5523 13 13 13Z" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Mock Fruitful home page (Figma 977:11967) used as the "Onboarding view" for the
// Progress-bar account style. A gradient header + horizontally-scrolling account
// cards live behind a draggable white SHEET (the "Weekly Spend" summary):
//   • drag the sheet UP  → it rises and covers the top-section account cards.
//   • drag the sheet DOWN → a "View Money Map" affordance (977:12099) fades in
//     between the accounts and the sheet; releasing a FULL drag seamlessly hands
//     off to the money-map screen (onOpenMap).
// The drag is pointer-driven with iOS-like snap points + a release threshold.

const SHEET_REST = 330; // sheet top at rest (account cards visible above)
const SHEET_RAISED = 150; // dragged up: sheet covers the account cards
const SHEET_MAX = 560; // dragged down: sheet floor (reveals the money-map affordance)
const OPEN_PULL = 96; // full downward pull: the card→map morph reaches 100% here
const COMMIT_PULL = OPEN_PULL * 0.55; // release past this → complete to the money map; before → snap back
const REVEAL_PULL = 18; // affordance starts fading in after this much downward pull

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export default function HomeScreen({
  dataset,
  onDragProgress,
  onDragRelease,
  onExit,
  cardsHidden = false,
  cardsReveal = false,
}: {
  dataset: Dataset;
  // drag-driven home→map morph: report how far (0..1) the sheet is pulled down so
  // the parent can interpolate the account-card morph, then whether the release
  // crossed the commit threshold (true = complete to the money map, false = snap back).
  onDragProgress: (fraction: number) => void;
  onDragRelease: (commit: boolean) => void;
  onExit: () => void;
  cardsHidden?: boolean; // account cards are being morphed IN from the map (hide the real ones until they land)
  cardsReveal?: boolean; // tail crossfade: fade the real cards in as the flying ghosts arrive
}) {
  const [sheetTop, setSheetTop] = useState(SHEET_REST);
  const [dragging, setDragging] = useState(false);
  const [opening, setOpening] = useState(false); // hand-off to the money map in progress
  const drag = useRef<{ startY: number; startTop: number } | null>(null);

  // while the sheet is being dragged, kill text selection across the whole document
  // (same protection the carousel scrub uses) so a drag never leaves highlighted
  // text behind; clear any existing selection when the drag starts.
  useEffect(() => {
    if (!dragging) return;
    document.body.classList.add('is-dragging-noselect');
    window.getSelection?.()?.removeAllRanges();
    return () => document.body.classList.remove('is-dragging-noselect');
  }, [dragging]);

  // account balances shown as the BIG number on each card (Figma 977:11967).
  // Static home-page mock values that sit above the same in-card bar the money-map
  // card uses — and are re-used as the map's Core/Spend amounts on the home→map
  // hand-off so the numbers stay continuous (see HOME_BALANCES in data.ts).

  // downward-pull fraction (0 at rest → 1 at OPEN_PULL) that drives the card morph.
  const pullFraction = (top: number) => clamp((top - SHEET_REST) / OPEN_PULL, 0, 1);

  const onPointerDown = (e: React.PointerEvent) => {
    if (opening) return;
    try {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      /* no active pointer (e.g. synthetic event) — capture is optional */
    }
    drag.current = { startY: e.clientY, startTop: sheetTop };
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dy = e.clientY - drag.current.startY;
    // rubber-band a touch past the floor so a hard pull feels springy, not walled
    let next = drag.current.startTop + dy;
    if (next > SHEET_MAX) next = SHEET_MAX + (next - SHEET_MAX) * 0.35;
    if (next < SHEET_RAISED) next = SHEET_RAISED + (next - SHEET_RAISED) * 0.35;
    setSheetTop(next);
    // drive the subtle damped account-card morph preview proportionally to the pull
    // (this also builds the morph ghosts on the first downward move).
    onDragProgress(pullFraction(next));
    // AUTO-FIRE: the instant the drag crosses the commit threshold, complete the
    // full morph to the money map immediately — no pointerup required. Detach the
    // drag so any further moves / the eventual release are ignored (endDrag no-ops).
    if (next - SHEET_REST >= COMMIT_PULL) {
      drag.current = null;
      setDragging(false);
      setOpening(true);
      onDragRelease(true);
    }
  };
  const endDrag = () => {
    // if the drag already auto-committed mid-move, drag.current is null → no-op.
    if (!drag.current) return;
    const from = drag.current.startTop;
    const top = sheetTop;
    drag.current = null;
    setDragging(false);
    // released BELOW the commit threshold → the morph snaps back; settle the sheet
    // at the nearest resting point (raised = accounts covered, rest = accounts shown).
    // (Crossing the threshold is handled live in onPointerMove, not here.)
    onDragRelease(false);
    const raisedDist = Math.abs(top - SHEET_RAISED);
    const restDist = Math.abs(top - SHEET_REST);
    // bias toward the direction of travel so a small nudge still settles naturally
    const wentUp = top < from;
    if (wentUp && raisedDist < restDist + 40) setSheetTop(SHEET_RAISED);
    else setSheetTop(SHEET_REST);
  };

  const pull = clamp(sheetTop - SHEET_REST, 0, OPEN_PULL);
  const revealOpacity = clamp((pull - REVEAL_PULL) / (OPEN_PULL - REVEAL_PULL), 0, 1);
  const armed = sheetTop - SHEET_REST >= COMMIT_PULL; // affordance is "primed" to open on release

  const sheetTransition = dragging ? 'none' : 'top 420ms cubic-bezier(0.22, 1, 0.36, 1)';

  return (
    <div className={`home-screen${opening ? ' home-screen--opening' : ''}`}>
      <div className="home-bg" />

      {/* greeting header */}
      <div className="home-top">
        <div className="home-greeting">
          <div className="home-hello">Good morning, Ray</div>
          <div className="home-date">Today is Wednesday, March 4th</div>
        </div>
        <div className="home-top-icons">
          <button className="home-icon-btn" aria-label="Messages" onClick={onExit}>
            <MessageCircle size={24} strokeWidth={1.9} color="#1f2937" />
            <span className="home-badge">4</span>
          </button>
          <button className="home-icon-btn" aria-label="Profile" onClick={onExit}>
            <CircleUser size={26} strokeWidth={1.7} color="#1f2937" />
          </button>
        </div>
      </div>

      {/* top-section account cards — the SAME pbi card the money map uses (icon +
          name + in-card bar), plus a BIG balance number above the bar and a touch
          more padding. Tagged data-morph-card so they FLIP into the map cards. */}
      <div className={`home-accounts${cardsHidden && !cardsReveal ? ' home-accounts--hidden' : ''}${cardsReveal ? ' home-accounts--reveal' : ''}`}>
        <div className="pbi-card pbi-card--home" data-morph-card="spend">
          <div className="pbi-card-head">
            <CreditCard className="pbi-icon" size={16} strokeWidth={1.5} color="#191919" />
            <span className="pbi-card-name">Spend Account</span>
          </div>
          <div className="pbi-card-balance">{HOME_BALANCES.spend}</div>
          <div className="pbi-bar">
            <div className="pbi-bar-fill" style={{ width: `${homeAccountFill('spend') * 100}%`, background: '#61bc76' }} />
            <span className="pbi-bar-amount">{money(HOME_ACCOUNTS.spend.cap)}</span>
          </div>
        </div>
        <div className="pbi-card pbi-card--home" data-morph-card="bills">
          <div className="pbi-card-head">
            <Receipt className="pbi-icon" size={16} strokeWidth={1.5} color="#191919" />
            <span className="pbi-card-name">Core Account</span>
          </div>
          <div className="pbi-card-balance">{HOME_BALANCES.core}</div>
          <div className="pbi-bar">
            <div className="pbi-bar-fill" style={{ width: `${homeAccountFill('core') * 100}%`, background: '#b0d9ff' }} />
            <span className="pbi-bar-amount">{money(HOME_ACCOUNTS.core.cap)}</span>
          </div>
        </div>
      </div>

      {/* "View Money Map" pull affordance (977:12099) — fades in as the sheet is dragged down */}
      <div
        className={`home-map-cue${armed ? ' is-armed' : ''}`}
        style={{ opacity: revealOpacity, top: clamp(sheetTop, SHEET_REST, SHEET_MAX) - 70 }}
      >
        <MoneyMapIcon size={22} color="#111827" />
        <span>View Money Map</span>
      </div>

      {/* draggable summary sheet */}
      <div
        className="home-sheet"
        style={{ top: sheetTop, transition: sheetTransition }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="home-sheet-grip" />
        <div className="home-card">
          <div className="home-card-top">
            <span className="home-card-title">Weekly Spend</span>
            <span className="home-pace">On pace ⓘ</span>
          </div>
          <div className="home-card-figures">
            <div>
              <div className="home-fig-label">Current spend this week</div>
              <div className="home-fig-amt">$156.81</div>
            </div>
            <div className="home-fig-right">
              <div className="home-fig-label">Budget</div>
              <div className="home-fig-amt">$460</div>
            </div>
          </div>
          <svg className="home-chart" viewBox="0 0 322 90" width="322" height="90" fill="none">
            <defs>
              <linearGradient id="home-chart-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#bfe3c9" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#bfe3c9" stopOpacity="0.05" />
              </linearGradient>
            </defs>
            <path d="M0 74 L46 70 L92 66 L138 44 L322 6 L322 90 L0 90 Z" fill="url(#home-chart-fill)" />
            <path d="M0 74 L46 70 L92 66 L138 44" stroke="#1f8f4e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="138" cy="44" r="5.5" fill="#ffffff" stroke="#1f8f4e" strokeWidth="2.5" />
          </svg>
          <div className="home-chart-axis">
            <span>MO</span><span>TU</span><span>WE</span><span>TH</span><span>FR</span><span>SA</span><span>SU</span>
          </div>
          <div className="home-card-rows">
            <div className="home-row"><span>Left in budget</span><span>$303.19</span></div>
            <div className="home-row"><span>Time left</span><span>4d</span></div>
            <div className="home-row"><span>Remaining per day</span><span>$75/day</span></div>
          </div>
        </div>
        <div className="home-card home-card--ghost" />
      </div>
    </div>
  );
}
