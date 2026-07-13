import type { GraphColor, MapStyle } from '../data';
import FruitfulLogo from './FruitfulLogo';

// money-map ring: uniform gray track + pastel arc + pastel squircle badge
const MM_TRACK = '#E4E4E4';
const MM_FILL: Record<GraphColor, string> = {
  yellow: '#F6DC72',
  blue: '#B0D9FF',
  green: '#61BC76',
  pink: '#EEBED4',
};

// soft ring track (unfilled portion)
const TRACK: Record<GraphColor, string> = {
  yellow: '#f6ecc6',
  blue: '#d9edfb',
  green: '#d5f2e2',
  pink: '#fbd9ea',
};

// progress arc (filled portion) — soft, desaturated to match the design
const FILL: Record<GraphColor, string> = {
  yellow: '#ebcb4f',
  blue: '#7cc3ec',
  green: '#5fce94',
  pink: '#f27ab5',
};

// center squircle badge tint (matches the Fruitful account avatar backgrounds)
const BADGE_BG: Record<GraphColor, string> = {
  yellow: '#f2e2a4',
  blue: '#b0d9ff',
  green: '#a9e5c3',
  pink: '#f4c1db',
};

const BOX = 57;
const C = BOX / 2; // center

export default function PieChart({ color, progress, map = 'flow' }: { color: GraphColor; progress: number; map?: MapStyle }) {
  const p = Math.max(0, Math.min(1, progress));
  const money = map === 'money-map';
  const sw = money ? 7 : 5; // ring thickness
  const r = (BOX - sw) / 2;
  const circ = 2 * Math.PI * r;
  const track = money ? MM_TRACK : TRACK[color];
  const fill = money ? MM_FILL[color] : FILL[color];
  const badgeBg = money ? MM_FILL[color] : BADGE_BG[color];
  return (
    <div className="pie">
      <svg width={BOX} height={BOX} viewBox={`0 0 ${BOX} ${BOX}`} fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx={C} cy={C} r={r} stroke={track} strokeWidth={sw} />
        {p > 0.001 && (
          <circle
            cx={C}
            cy={C}
            r={r}
            stroke={fill}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - p)}
            transform={`rotate(-90 ${C} ${C})`}
          />
        )}
      </svg>
      <div className={`pie-badge${money ? ' pie-badge-mm' : ''}`} style={{ background: badgeBg }}>
        <FruitfulLogo size={money ? 15 : 16} />
      </div>
    </div>
  );
}
