import type { GraphColor } from '../data';

// pastel fills (match PieChart MM_FILL / GraphStrip MM_COLOR)
const FILL: Record<GraphColor, string> = {
  yellow: '#f6dc72',
  blue: '#b0d9ff',
  green: '#61bc76',
  pink: '#eebed4',
};

export default function ProgressBar({
  color,
  progress,
  amount,
  date,
  reached = false,
  tall = false,
}: {
  color: GraphColor;
  progress: number;
  amount: string;
  date?: string;
  reached?: boolean;
  tall?: boolean;
}) {
  const p = Math.max(0, Math.min(1, progress));
  return (
    <div className={`pbar${tall ? ' pbar-tall' : ''}`}>
      <div className="pbar-track" />
      {p > 0.001 && (
        <div className="pbar-fill" style={{ width: `${p * 100}%`, background: FILL[color] }} />
      )}
      <span className="pbar-amount">{amount}</span>
      {date && <span className={`pbar-date${reached ? ' reached' : ''}`}>{date}</span>}
    </div>
  );
}
