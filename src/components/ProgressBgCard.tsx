import type { CardNode } from '../data';
import { progressAt, type Mode } from '../scenario';
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

export default function ProgressBgCard({ node, now, mode }: { node: CardNode; now: number; mode: Mode }) {
  const fill = BAR_LIGHT[node.graph];
  const text = TEXT_DARK[node.graph];

  let width: number;
  let bg: string;
  if (node.kind === 'income') {
    width = CARD_W; // always full width; only the colour toggles
    bg = now > 0 ? fill : '#f5f5f5'; // gray idle -> yellow active
  } else if (node.kind === 'account') {
    // width encodes ABSOLUTE DOLLARS at the SAME scale goals use, so a larger
    // account (Core $5k) renders a visibly longer bar than a smaller one (Spend
    // $3k). The fill still animates via progressAt: animated = final * fraction.
    const p = Math.max(0, Math.min(1, progressAt(mode, node.id, now)));
    width = p * dollars(node.amount) * PX_PER_DOLLAR;
    bg = fill;
  } else {
    // goal: width encodes ABSOLUTE DOLLARS, so a big-target goal grows wider than
    // the card / page. Unclamped — the device frame's overflow:hidden clips it.
    const p = Math.max(0, progressAt(mode, node.id, now));
    width = p * dollars(node.amount) * PX_PER_DOLLAR;
    bg = fill;
  }

  // ring mirrors the true 0..1 fraction (never clipped); income has no ring
  const ringP = node.kind === 'income' ? 0 : progressAt(mode, node.id, now);
  const label = node.kind === 'goal' ? `Fund by ${node.badge ?? ''}` : `${node.amount}/mo`;

  return (
    <div className="pbg" style={{ width: Math.max(1, Math.round(width)), background: bg }}>
      <div className="pbg-row">
        {node.kind === 'goal' && <Ring progress={ringP} />}
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
