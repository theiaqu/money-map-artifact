import { useRef } from 'react';
import { CircleCheck } from 'lucide-react';
import type { CardNode } from '../data';
import { ILLO_CARD_ARM, illoSplit } from '../data';
import { CH_W, incomeBars, progressAt, type Dataset, type DateMode, type Mode } from '../scenario';
import FruitfulLogo from './FruitfulLogo';
import IlloCalendar from './IlloCalendar';
import IlloWallet from './IlloWallet';

// per-kind branch/bar color (matches the app COLOR map): core blue / spend green
// / goals pink / income yellow.
const COLOR: Record<string, string> = {
  blue: '#49c7ef',
  green: '#37d67a',
  pink: '#ff2d8e',
  yellow: '#f6dc72',
};

// abbreviate a "$8,000" display amount to "$8k" (goal/subtitle copy per Figma).
function abbrevK(amount: string): string {
  const n = Number(amount.replace(/[^0-9.]/g, ''));
  if (!n) return amount;
  const k = n / 1000;
  return `$${Number.isInteger(k) ? k : k.toFixed(1)}k`;
}

// account subtitle: "$Xk a month for bills" (core) / "…for daily use" (spend)
const ACCOUNT_SUB: Record<string, string> = {
  core: 'for bills',
  spend: 'for daily use',
};

// keep card titles to a single line (matches Figma's "1 mo. Emergency Fund")
function shortTitle(t: string): string {
  return t.replace(/(\d+)\s*Month/i, '$1 mo.');
}

// parse a "Mon YYYY" fund-by badge into an uppercase month + year
function parseBadge(badge: string | undefined): { mon: string; year: string } {
  const m = badge?.trim().match(/^([A-Za-z]{3})\s+(\d{4})$/);
  if (!m) return { mon: '', year: '' };
  return { mon: m[1].toUpperCase(), year: m[2] };
}

// whole months from the shared reference (mirrors scenario.monthsFromNow parsing)
const MONTH_ABBR = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function monthsFromNow(badge: string | undefined): number {
  const m = badge?.trim().toLowerCase().match(/^([a-z]{3})\s+(\d{4})$/);
  if (!m) return 0;
  const mi = MONTH_ABBR.indexOf(m[1]);
  if (mi < 0) return 0;
  return Math.max(0, Number(m[2]) * 12 + mi - (2026 * 12 + 6));
}

// a small celebratory confetti burst fired once when a goal's bar fills. Purely
// CSS/SVG particles (no dependency): a short pop, then settle to nothing.
const CONFETTI = [
  { x: -18, y: -10, c: '#ff2d8e', d: 0 },
  { x: -6, y: -22, c: '#49c7ef', d: 30 },
  { x: 8, y: -20, c: '#f6dc72', d: 10 },
  { x: 20, y: -12, c: '#37d67a', d: 40 },
  { x: -22, y: 6, c: '#f6dc72', d: 20 },
  { x: 24, y: 4, c: '#ff2d8e', d: 50 },
  { x: 0, y: -26, c: '#37d67a', d: 5 },
  { x: 14, y: -26, c: '#49c7ef', d: 35 },
];
function IlloConfetti() {
  return (
    <span className="illo-confetti" aria-hidden>
      {CONFETTI.map((p, i) => (
        <span
          key={i}
          style={{
            background: p.c,
            // travel offsets + per-particle delay feed the burst keyframe
            ['--cx' as string]: `${p.x}px`,
            ['--cy' as string]: `${p.y}px`,
            animationDelay: `${p.d}ms`,
          }}
        />
      ))}
    </span>
  );
}

// income as a small top-center card: "Income" / "$Xk a month" + a mini income
// bar chart (reuse incomeBars; two soft-yellow rounded bars at rest).
export function IlloIncome({ node, dataset, mode, now }: { node: CardNode; dataset: Dataset; mode: Mode; now: number }) {
  const dyn = incomeBars(dataset, mode, now);
  const gap = 6;
  const halfW = (CH_W - gap) / 2;
  const slotX = [0, halfW + gap];
  // Illustrated shows AT MOST 2 income bars (Figma 760:8522 / 763:8687): two
  // equal paycheck bars regardless of dataset. Take the two most-recent dynamic
  // bars (so the newest still animates its right-to-left reveal) and re-lay them
  // into the two fixed half-width slots; before any income has arrived, show two
  // full resting bars.
  // Force reveal:1 so the two bars are always solid (no right-to-left wipe) —
  // otherwise the newest bar's wipe can collapse it to <1 bar at the frozen end.
  const recent = dyn.slice(-2);
  const bars = recent.length
    ? recent.map((b, i) => ({ x: slotX[i], w: halfW, reveal: 1, scale: b.scale }))
    : slotX.map((x) => ({ x, w: halfW, reveal: 1, scale: 1 }));
  const TOP = 4;
  const FLOOR = 37;
  return (
    <div className="illo-income">
      <div className="illo-income-title">Income</div>
      <div className="illo-income-sub">{abbrevK(node.amount)} a month</div>
      <div className="illo-income-bars">
        <svg width={CH_W} height={FLOOR} viewBox={`0 0 ${CH_W} ${FLOOR}`} fill="none" xmlns="http://www.w3.org/2000/svg">
          {bars.map((b, i) => {
            const h = (FLOOR - TOP) * b.scale;
            const topY = Math.max(2, FLOOR - h);
            const revW = b.w * b.reveal;
            if (revW < 0.5) return null;
            const revX = b.x + b.w - revW;
            return (
              <rect
                key={i}
                x={revX.toFixed(2)}
                y={topY.toFixed(2)}
                width={revW.toFixed(2)}
                height={(FLOOR - topY).toFixed(2)}
                rx="6"
                fill="#fbedb8"
                stroke="#ebde9d"
                strokeWidth="2"
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// the green-bordered Fruitful root circle at the top of the spine (Figma 760:8540)
export function IlloCircle() {
  return (
    <div className="node illo-circle-node" style={{ left: 28, top: 256 }}>
      <div className="illo-circle">
        <FruitfulLogo size={22} color="#027a48" />
      </div>
    </div>
  );
}

// goal date block (right slot): a CircleCheck above a stacked MON/YEAR (or the
// relative "{N}/mo") date. On funding the check pops to filled pink.
function IlloDate({ node, dateMode, reached }: { node: CardNode; dateMode: DateMode; reached: boolean }) {
  const months = monthsFromNow(node.badge);
  const { mon, year } = parseBadge(node.badge);
  return (
    <div className="illo-slot illo-date">
      {reached ? (
        <span className="illo-check illo-check--pop">
          <CircleCheck size={14} strokeWidth={2.5} color="#ffffff" fill="#ff2d8e" />
        </span>
      ) : (
        <span className="illo-check">
          <CircleCheck size={12} strokeWidth={2} color="#c7c7c7" />
        </span>
      )}
      {dateMode === 'months' ? (
        months <= 0 ? (
          <span className={`illo-date-mon${reached ? ' on' : ''}`}>now</span>
        ) : (
          <span className="illo-date-stack">
            <span className={`illo-date-mon${reached ? ' on' : ''}`}>{months}</span>
            <span className="illo-date-year">mo.</span>
          </span>
        )
      ) : (
        <span className="illo-date-stack">
          <span className={`illo-date-mon${reached ? ' on' : ''}`}>{mon}</span>
          <span className="illo-date-year">{year}</span>
        </span>
      )}
      {reached && <IlloConfetti />}
    </div>
  );
}

export default function IlloCard({
  node,
  now,
  mode,
  dataset,
  dateMode = 'date',
  hidden = false,
  onTap,
}: {
  node: CardNode;
  now: number;
  mode: Mode;
  dataset: Dataset;
  dateMode?: DateMode;
  hidden?: boolean; // the resting card is hidden while its morph modal is open
  onTap?: (rect: DOMRect) => void; // account cards: tap-to-expand (ConvoModal morph)
}) {
  const isGoal = node.kind === 'goal';
  const isAccount = node.kind === 'account';
  const p = progressAt(dataset, mode, node.id, now);
  const armId = ILLO_CARD_ARM[node.id];
  // in-card bar fill continues where the branch arm ends (one continuous track)
  const barFill = armId ? illoSplit(p, armId).bar : p;
  // Fire the colorize / date+check EXACTLY when the in-card progress bar visually
  // completes — keyed off the SAME `barFill` the bar renders, so there's no
  // perceptible gap between the bar topping out and the payoff (no offset / early
  // 0.9 threshold that lagged behind the visible bar). 0.985 lands on the last
  // imperceptible sliver of the eased fill.
  const barDone = barFill >= 0.985;
  // goals: reached-state (check pop + pink date + confetti) is driven by the bar
  // completing; accounts colorize their illustration the same instant.
  const reached = isGoal && barDone;
  const colorized = isAccount ? barDone : reached;
  const barColor = COLOR[node.graph] ?? '#ff2d8e';

  const ref = useRef<HTMLDivElement>(null);
  // the account illustration element — its on-screen rect is the SOURCE for the
  // IlloModal shared-element FLIP (the small illustration grows into the modal's
  // big one), so we hand the modal this element's rect (not the whole card's).
  // Core renders the scalable <IlloCalendar> svg, Spend the wallet <img>; a
  // single callback ref points at whichever illustration is mounted so the FLIP
  // always measures the correct element (kept a pure uniform scale).
  const illoRef = useRef<HTMLElement | null>(null);
  const setIlloRef = (el: HTMLElement | null) => {
    illoRef.current = el;
  };
  const tappable = isAccount && !!onTap;
  const fire = () => {
    const el = illoRef.current ?? ref.current;
    if (el) onTap?.(el.getBoundingClientRect());
  };

  const sub = isGoal
    ? `${abbrevK(node.amount)} goal`
    : `${abbrevK(node.amount)} a month ${ACCOUNT_SUB[node.id] ?? ''}`.trim();

  return (
    <div
      ref={ref}
      className={`illo-card${tappable ? ' illo-card--tappable' : ''}${hidden ? ' illo-card--hidden' : ''}`}
      onClick={tappable ? fire : undefined}
      role={tappable ? 'button' : undefined}
      tabIndex={tappable ? 0 : undefined}
      onKeyDown={
        tappable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fire();
              }
            }
          : undefined
      }
    >
      <div className="illo-content">
        <div className="illo-title">{shortTitle(node.title)}</div>
        <div className="illo-bar">
          <div className="illo-bar-fill" style={{ width: `${barFill * 100}%`, background: barColor }} />
        </div>
        <div className="illo-sub">{sub}</div>
      </div>
      {isGoal ? (
        <IlloDate node={node} dateMode={dateMode} reached={reached} />
      ) : (
        <div className="illo-slot">
          <span className={`illo-figure${colorized ? ' illo-figure--on' : ''}`}>
            {node.id === 'spend' ? (
              <span ref={setIlloRef} className="illo-img illo-wallet">
                <IlloWallet />
              </span>
            ) : (
              <span ref={setIlloRef} className="illo-img illo-cal">
                <IlloCalendar />
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
