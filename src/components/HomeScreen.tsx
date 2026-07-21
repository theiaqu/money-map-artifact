import { useRef, useState } from 'react';
import { CreditCard, Receipt, MessageCircle, CircleUser, Waypoints } from 'lucide-react';
import { DATASETS, type Dataset } from '../scenario';

const money = (n: number) => `$${n.toLocaleString('en-US')}`;

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
const OPEN_PULL = 96; // pull the sheet this far below rest to trigger the money-map handoff
const REVEAL_PULL = 18; // affordance starts fading in after this much downward pull

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export default function HomeScreen({
  dataset,
  onOpenMap,
  onExit,
  cardsHidden = false,
  cardsReveal = false,
}: {
  dataset: Dataset;
  onOpenMap: () => void;
  onExit: () => void;
  cardsHidden?: boolean; // account cards are being morphed IN from the map (hide the real ones until they land)
  cardsReveal?: boolean; // tail crossfade: fade the real cards in as the flying ghosts arrive
}) {
  const [sheetTop, setSheetTop] = useState(SHEET_REST);
  const [dragging, setDragging] = useState(false);
  const [opening, setOpening] = useState(false); // hand-off to the money map in progress
  const drag = useRef<{ startY: number; startTop: number } | null>(null);
  const cfg = DATASETS[dataset];

  // account balances shown as the BIG number on each card. Static, home-page mock
  // values that sit above the same in-card bar the money-map card uses.
  const balances = { spend: 1820.39, core: 10640 };

  // full drag-release → hand straight off to the money map; the parent runs the
  // shared-element card morph (measures these cards, then flies them to the map).
  const beginOpen = () => {
    setOpening(true);
    onOpenMap();
  };

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
  };
  const endDrag = () => {
    if (!drag.current) return;
    const from = drag.current.startTop;
    const top = sheetTop;
    drag.current = null;
    setDragging(false);
    // full downward pull past the threshold → hand off to the money map
    if (top - SHEET_REST > OPEN_PULL) {
      beginOpen();
      return;
    }
    // otherwise snap to the nearest resting point (raised = accounts covered, rest = accounts shown)
    const raisedDist = Math.abs(top - SHEET_RAISED);
    const restDist = Math.abs(top - SHEET_REST);
    // bias toward the direction of travel so a small nudge still settles naturally
    const wentUp = top < from;
    if (wentUp && raisedDist < restDist + 40) setSheetTop(SHEET_RAISED);
    else setSheetTop(SHEET_REST);
  };

  const pull = clamp(sheetTop - SHEET_REST, 0, OPEN_PULL);
  const revealOpacity = clamp((pull - REVEAL_PULL) / (OPEN_PULL - REVEAL_PULL), 0, 1);
  const armed = sheetTop - SHEET_REST > OPEN_PULL; // affordance is "primed" to open on release

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
          <div className="pbi-card-balance">{`$${balances.spend.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}</div>
          <div className="pbi-bar">
            <div className="pbi-bar-fill" style={{ width: '45%', background: '#61bc76' }} />
            <span className="pbi-bar-amount">{money(cfg.spendMax)}</span>
          </div>
        </div>
        <div className="pbi-card pbi-card--home" data-morph-card="bills">
          <div className="pbi-card-head">
            <Receipt className="pbi-icon" size={16} strokeWidth={1.5} color="#191919" />
            <span className="pbi-card-name">Core Account</span>
          </div>
          <div className="pbi-card-balance">{`$${balances.core.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}</div>
          <div className="pbi-bar">
            <div className="pbi-bar-fill" style={{ width: '45%', background: '#b0d9ff' }} />
            <span className="pbi-bar-amount">{money(cfg.coreMax)}</span>
          </div>
        </div>
      </div>

      {/* "View Money Map" pull affordance (977:12099) — fades in as the sheet is dragged down */}
      <div
        className={`home-map-cue${armed ? ' is-armed' : ''}`}
        style={{ opacity: revealOpacity, top: clamp(sheetTop, SHEET_REST, SHEET_MAX) - 70 }}
      >
        <Waypoints size={22} strokeWidth={2} color="#111827" />
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
