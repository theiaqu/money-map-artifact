import type { GraphColor } from '../data';

// pastel fills matching the Figma "progress bar, inside" design (node 792:8522):
// blue/water, green/leaf, pink for goals. Yellow kept for completeness.
const FILL: Record<GraphColor, string> = {
  yellow: '#f6dc72',
  blue: '#b0d9ff',
  green: '#61bc76',
  pink: '#eebed4',
};

// "Progress bar, inside" (pbi) inner bar — a rounded gray track with a colored
// fill; the dollar amount label sits INSIDE the track at the left, and goal cards
// add an uppercase date pill pinned to the right. Fill width is driven by the
// per-frame eased progress value so it fills as money flows.
export default function ProgressBar({
  color,
  progress,
  amount,
  date,
  reached = false,
}: {
  color: GraphColor;
  progress: number;
  amount: string;
  date?: string;
  reached?: boolean;
}) {
  const p = Math.max(0, Math.min(1, progress));
  return (
    <div className="pbi-bar">
      {p > 0.001 && (
        <div className="pbi-bar-fill" style={{ width: `${p * 100}%`, background: FILL[color] }} />
      )}
      <span className="pbi-bar-amount">{amount}</span>
      {date && <span className={`pbi-bar-date${reached ? ' reached' : ''}`}>{date}</span>}
    </div>
  );
}
