import type { GraphColor } from '../data';

// pastel fills matching the Figma "progress bar, inside" design (node 792:8522):
// blue/water, green/leaf, pink for goals. Yellow kept for completeness.
const FILL: Record<GraphColor, string> = {
  yellow: '#f6dc72',
  blue: '#b0d9ff',
  green: '#61bc76',
  pink: '#eebed4',
};

// "Core/Spend refill visual" (Figma 907:13009): the base bar stays EXACTLY the
// same; we just lay a very light, subtle overlay on top whose right edge is a
// slightly darker shade of the bar color. This reads as the account "refilling"
// up to the fill front without noisily draining + redrawing the real progress.
// Edge color is a slightly darker version of each FILL, used only as a soft
// leading band inside the overlay.
const REFILL_EDGE: Record<GraphColor, string> = {
  yellow: 'rgba(214, 176, 40, 0.45)',
  blue: 'rgba(96, 170, 240, 0.55)',
  green: 'rgba(60, 158, 90, 0.5)',
  pink: 'rgba(214, 140, 178, 0.5)',
};

// "Progress bar, inside" (pbi) inner bar — a rounded gray track with a colored
// fill; the dollar amount label sits INSIDE the track at the left, and goal cards
// add an uppercase date pill pinned to the right. Fill width is driven by the
// per-frame eased progress value so it fills as money flows. With `refill` a
// subtle same-width overlay (faint white + slightly darker leading edge) is laid
// over the fill to hint at the monthly refill.
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
    <div className="pbi-bar">
      {p > 0.001 && (
        <div className="pbi-bar-fill" style={{ width: `${p * 100}%`, background: FILL[color] }} />
      )}
      {refill && p > 0.001 && (
        <div
          className="pbi-bar-refill"
          style={{
            width: `${p * 100}%`,
            background: `linear-gradient(to right, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.14) 84%, ${REFILL_EDGE[color]} 100%)`,
          }}
        />
      )}
      <span className="pbi-bar-amount">{amount}</span>
      {date && <span className={`pbi-bar-date${reached ? ' reached' : ''}`}>{date}</span>}
    </div>
  );
}
