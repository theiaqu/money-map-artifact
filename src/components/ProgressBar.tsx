import type { GraphColor } from '../data';

// pastel fills matching the Figma "progress bar, inside" design (node 792:8522):
// blue/water, green/leaf, pink for goals. Yellow kept for completeness.
const FILL: Record<GraphColor, string> = {
  yellow: '#f6dc72',
  blue: '#b0d9ff',
  green: '#61bc76',
  pink: '#eebed4',
};

// "Refill visual" (Figma 907:13009): the track becomes the LIGHT capacity color
// (always full width) and the moving fill is a DARKER shade, so each account
// reads as a balance that refills within its capacity rather than a plain bar.
const REFILL_TRACK: Record<GraphColor, string> = {
  yellow: '#fae6a6',
  blue: '#cfe8ff',
  green: '#a6dcb4',
  pink: '#f4d8e5',
};
const REFILL_FILL: Record<GraphColor, string> = {
  yellow: '#f0cf4e',
  blue: '#5aa9f0',
  green: '#3fae5f',
  pink: '#e29bc0',
};

// "Progress bar, inside" (pbi) inner bar — a rounded gray track with a colored
// fill; the dollar amount label sits INSIDE the track at the left, and goal cards
// add an uppercase date pill pinned to the right. Fill width is driven by the
// per-frame eased progress value so it fills as money flows. With `refill` the
// track carries the light capacity color and the fill is a darker balance segment.
export default function ProgressBar({
  color,
  progress,
  amount,
  date,
  reached = false,
  refill = false,
}: {
  color: GraphColor;
  progress: number;
  amount: string;
  date?: string;
  reached?: boolean;
  refill?: boolean;
}) {
  const p = Math.max(0, Math.min(1, progress));
  return (
    <div className="pbi-bar" style={refill ? { background: REFILL_TRACK[color] } : undefined}>
      {p > 0.001 && (
        <div
          className="pbi-bar-fill"
          style={{ width: `${p * 100}%`, background: refill ? REFILL_FILL[color] : FILL[color] }}
        />
      )}
      <span className="pbi-bar-amount">{amount}</span>
      {date && <span className={`pbi-bar-date${reached ? ' reached' : ''}`}>{date}</span>}
    </div>
  );
}
