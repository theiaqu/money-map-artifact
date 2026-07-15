import type { CardNode } from '../data';
import { progressAt, goalDateLabel, type Dataset, type Mode, type DateMode } from '../scenario';
import FruitfulLogo from './FruitfulLogo';

// LIGHT pastels — lighter than MM_FILL; the card background IS the bar.
const BAR_LIGHT: Record<string, string> = {
  yellow: '#fbedb8',
  blue: '#d7ecff',
  green: '#b0ddba',
  pink: '#f7dfe9',
};
// "darkest" on-color text (both accounts use the blue-darkest)
const TEXT_DARK: Record<string, string> = {
  yellow: '#706232',
  blue: '#232b33',
  green: '#232b33',
  pink: '#624b52',
};
// account avatar squircle tint (matches the money-map account avatars)
const AVATAR_BG: Record<string, string> = {
  yellow: '#f2e2a4',
  blue: '#b0d9ff',
  green: '#61bc76',
  pink: '#f4c1db',
};

const CARD_W = 216; // app card width
const PX_PER_DOLLAR = 0.045; // goal overflow scale (~$22/px)
const dollars = (s: string) => Number(s.replace(/[^0-9.]/g, '')) || 0;

// small 24px progress donut (same construction as PieChart), always 0..1 so the
// true fraction stays readable even after the background bar clips off-page
function Ring({ progress }: { progress: number }) {
  const p = Math.max(0, Math.min(1, progress));
  const BOX = 24;
  const sw = 3;
  const r = (BOX - sw) / 2;
  const c = BOX / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg className="pbg-ring" width={BOX} height={BOX} viewBox={`0 0 ${BOX} ${BOX}`} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx={c} cy={c} r={r} stroke="#ffffff" strokeWidth={sw} />
      {p > 0.001 && (
        <circle
          cx={c}
          cy={c}
          r={r}
          stroke="#eebed4"
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - p)}
          transform={`rotate(-90 ${c} ${c})`}
        />
      )}
    </svg>
  );
}

export default function ProgressBgCard({ node, now, mode, dataset, dateMode = 'date' }: { node: CardNode; now: number; mode: Mode; dataset: Dataset; dateMode?: DateMode }) {
  const fill = BAR_LIGHT[node.graph];
  const text = TEXT_DARK[node.graph];

  // true 0..1 progress fraction for this card (unclamped for goals so the width
  // can grow off-page, but the "has funding started?" gate only needs > 0.001)
  const p = node.kind === 'income' ? 0 : Math.max(0, progressAt(dataset, mode, node.id, now));
  // "funding has started" — the pastel bar and (for goals) the ring only appear
  // once the fraction begins rising. Income keeps its own gray->yellow toggle.
  const started = node.kind === 'income' ? now > 0 : p > 0.001;

  let width: number;
  let bg: string;
  if (node.kind === 'income') {
    width = CARD_W; // always full width; only the colour toggles
    bg = started ? fill : '#f5f5f5'; // gray idle -> yellow active
  } else if (node.kind === 'account') {
    // width encodes ABSOLUTE DOLLARS at the SAME scale goals use, so a larger
    // account (Core $5k) renders a visibly longer bar than a smaller one (Spend
    // $3k). The fill still animates via progressAt: animated = final * fraction.
    width = Math.min(1, p) * dollars(node.amount) * PX_PER_DOLLAR;
    bg = started ? fill : 'transparent'; // no pastel bar before funding starts
  } else {
    // goal: width encodes ABSOLUTE DOLLARS, so a big-target goal grows wider than
    // the card / page. Unclamped — the device frame's overflow:hidden clips it.
    width = p * dollars(node.amount) * PX_PER_DOLLAR;
    bg = started ? fill : 'transparent'; // no pastel bar before funding starts
  }

  // goals only show the ring once funding has started (no empty white circle)
  const showRing = node.kind === 'goal' && started;
  const label =
    node.kind === 'goal'
      ? dateMode === 'months'
        ? goalDateLabel(dateMode, node.badge)
        : `Fund by ${node.badge ?? ''}`
      : `${node.amount}/mo`;

  // before funding the bar is transparent, so collapse the sliver to 1px (it's
  // invisible) and let the labels spill onto the white canvas as usual
  const renderWidth = started ? Math.max(1, Math.round(width)) : 1;

  return (
    <div className="pbg" style={{ width: renderWidth, background: bg }}>
      <div className="pbg-row">
        {showRing && <Ring progress={p} />}
        {node.kind === 'account' && (
          <span className="pbg-avatar" style={{ background: AVATAR_BG[node.graph] }}>
            <FruitfulLogo size={14} />
          </span>
        )}
        <span className="pbg-title" style={{ color: text }}>
          {node.title}
        </span>
      </div>
      <span className="pbg-amount" style={{ color: text }}>
        {label}
      </span>
    </div>
  );
}
