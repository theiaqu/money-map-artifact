import type { GraphColor } from '../data';

// pastel fills matching the Figma "progress bar, inside" design (node 792:8522):
// blue/water, green/leaf, pink for goals. Yellow kept for completeness.
const FILL: Record<GraphColor, string> = {
  yellow: '#f6dc72',
  blue: '#b0d9ff',
  green: '#61bc76',
  pink: '#eebed4',
};

// "Core/Spend refill visual" (Figma 907:13009): the base bar is IDENTICAL to the
// off state. The only addition is a subtle SOLID-color overlay bar that, each
// month after the first, sweeps left→right on top of the base fill (the monthly
// "refill"), then fades out once it reaches the end — and repeats the next month.
const REFILL_SOLID: Record<GraphColor, string> = {
  yellow: '#e9c744',
  blue: '#6bb2f2',
  green: '#46a862',
  pink: '#e0a2c3',
};

const easeOutCubic = (x: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);

// Peak opacity of the refill overlay — deliberately faint (roughly half of the
// earlier attempt) so it reads as a soft second bar sweeping over the real fill.
const REFILL_PEAK_OPACITY = 0.3;
const REFILL_FILL_PORTION = 0.6; // fraction of each month spent sweeping; rest fades
// HOME flow driven overlay: a touch stronger than the faint standard sweep so the
// "refill leading the base bar to full" reads clearly as you scrub.
const REFILL_DRIVEN_OPACITY = 0.5;

// Per-month refill sweep: given whole-months-elapsed `now`, returns the overlay's
// width fraction and opacity for the CURRENT month's refill. Sweeps 0→1 over the
// first REFILL_FILL_PORTION of the month, then holds full width while fading to 0.
// Only active after the first month (monthIdx >= 1).
function refillSweep(now: number): { w: number; op: number } {
  const monthIdx = Math.floor(now);
  if (now <= 0 || monthIdx < 1) return { w: 0, op: 0 };
  const phase = now - monthIdx; // 0..1 within the current month
  if (phase <= REFILL_FILL_PORTION) {
    return { w: easeOutCubic(phase / REFILL_FILL_PORTION), op: REFILL_PEAK_OPACITY };
  }
  const fade = (phase - REFILL_FILL_PORTION) / (1 - REFILL_FILL_PORTION); // 0..1
  return { w: 1, op: REFILL_PEAK_OPACITY * (1 - fade) };
}

// "Progress bar, inside" (pbi) inner bar — a rounded gray track with a colored
// fill; the dollar amount label sits INSIDE the track at the left, and goal cards
// add an uppercase date pill pinned to the right. Fill width is driven by the
// per-frame eased progress value so it fills as money flows. With `refill` a faint
// solid overlay sweeps across each month (then fades) to show the monthly refill.
export default function ProgressBar({
  color,
  progress,
  amount,
  date,
  reached = false,
  refill = false,
  now = 0,
  refillOverride,
  morphRole,
  perMonth = false,
}: {
  color: GraphColor;
  progress: number;
  amount: string;
  date?: string;
  reached?: boolean;
  refill?: boolean;
  now?: number;
  refillOverride?: number; // HOME flow: drive the refill OVERLAY width (0..1 of the whole bar) from the scrub position instead of the time-based monthly sweep. The overlay leads and the base fill (driven separately) trails it up to 100%.
  morphRole?: string; // "bills" | "spend" | "goals" — tags the bar for the Monthly-split shared-element morph
  perMonth?: boolean; // account cards (Core/Spend) append a small secondary "per month" after the amount
}) {
  const p = Math.max(0, Math.min(1, progress));
  // HOME flow: the overlay width is driven by the scrub (refillOverride), held at a
  // steady visible opacity, and spans the WHOLE bar (0..1) so it can sweep up to
  // full and lead the base fill. Standard app: the faint per-month time sweep.
  const driven = refillOverride !== undefined;
  const overlayW = driven ? Math.max(0, Math.min(1, refillOverride)) : refillSweep(now).w * p;
  const overlayOp = driven ? REFILL_DRIVEN_OPACITY : refillSweep(now).op;
  return (
    <div className="pbi-bar" {...(morphRole ? { 'data-morph': morphRole, 'data-morph-color': FILL[color] } : {})}>
      {p > 0.001 && (
        <div className="pbi-bar-fill" style={{ width: `${p * 100}%`, background: FILL[color] }} />
      )}
      {refill && overlayOp > 0.001 && overlayW > 0.001 && (
        <div
          className="pbi-bar-refill"
          style={{ width: `${overlayW * 100}%`, background: REFILL_SOLID[color], opacity: overlayOp }}
        />
      )}
      <span className="pbi-bar-amount">{amount}{perMonth && <span className="pbi-bar-amount-suffix"> per month</span>}</span>
      {date && <span className={`pbi-bar-date${reached ? ' reached' : ''}`}>{date}</span>}
    </div>
  );
}
