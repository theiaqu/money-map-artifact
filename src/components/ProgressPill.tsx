import type { CardKind, GraphColor } from '../data';

// pastel fills (match PieChart MM_FILL / GraphStrip MM_COLOR)
const FILL: Record<GraphColor, string> = {
  yellow: '#f6dc72',
  blue: '#b0d9ff',
  green: '#61bc76',
  pink: '#eebed4',
};

// text color once the chip is "complete" (painted on the pastel fill)
const ON_FILL: Record<GraphColor, string> = {
  yellow: '#706232',
  blue: '#5e8dba',
  green: '#ffffff',
  pink: '#a17187',
};

const TRACK = '#f5f5f5';
const TRACK_TEXT = '#191919';

export default function ProgressPill({
  kind,
  color,
  progress,
  reached,
  title,
  amount,
  sub,
}: {
  kind: CardKind;
  color: GraphColor;
  progress: number; // 0..1
  reached: boolean;
  title: string;
  amount: string;
  sub?: string;
}) {
  const p = Math.max(0, Math.min(1, progress));

  const isIncome = kind === 'income';
  const isGoal = kind === 'goal';
  // income is always solid; accounts AND goals now get a gradual, left-anchored
  // fill that grows across the chip with progressAt (blue for core, green for
  // spend, pink for goals) — no more instant binary flip for accounts.
  const gradual = !isIncome;
  const filled = isIncome ? true : isGoal ? reached : p >= 0.999;

  // gradual chips keep the gray track (the fill rect draws the colour); income
  // is a solid pastel chip. The amount text recolours to its on-fill colour once
  // complete (goals when reached, accounts when the fill tops out).
  const chipBg = isIncome ? FILL[color] : TRACK;
  const textColor = filled ? ON_FILL[color] : TRACK_TEXT;

  const chip = (
    <div className="ppill-chip" style={{ background: chipBg }}>
      {gradual && p > 0.001 && (
        <div className="ppill-fill" style={{ width: `${p * 100}%`, background: FILL[color] }} />
      )}
      <span className="ppill-amount" style={{ color: textColor }}>
        {amount}
      </span>
    </div>
  );

  // income is a single inline pill: "Income" label + chip, no title, no suffix
  if (kind === 'income') {
    return (
      <div className="ppill-row ppill-row-income">
        <span className="ppill-income-label">{title}</span>
        {chip}
      </div>
    );
  }

  return (
    <div className="ppill-card">
      <div className="ppill-title">{title}</div>
      <div className="ppill-row">
        {chip}
        {sub && <span className="ppill-suffix">{sub}</span>}
      </div>
    </div>
  );
}
