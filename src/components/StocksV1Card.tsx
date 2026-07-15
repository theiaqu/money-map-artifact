import type { CardNode, GraphColor } from '../data';
import { CH_W, buildChart, incomeBars, isReached, firstIncomeMonth, monthsFromNow, goalDateLabel, type Dataset, type Mode, type DateMode } from '../scenario';

// Stocks-V1 (Figma 519:6283) heart-monitor palette — same hues as V2 stocks.
const COLOR: Record<GraphColor, string> = {
  yellow: '#efc63e',
  blue: '#49c7ef',
  green: '#37d67a',
  pink: '#ff2d8e',
};

const CH_H = 37;

// V1 dotted baseline over a mini chart / bar strip
function Dotted({ y = 5, w = CH_W }: { y?: number; w?: number }) {
  return (
    <line x1="0" y1={y} x2={w} y2={y} stroke="var(--graph-dotted)" strokeWidth="1.5" strokeDasharray="1.5 3.5" strokeLinecap="round" />
  );
}

// Income yellow-bar strip — same data as V2 (incomeBars) with the money-map bar
// look requested for V1 (#fff08d -> transparent gradient, #ffea83 border).
function IncomeBars({ dataset, mode, now }: { dataset: Dataset; mode: Mode; now: number }) {
  const bars = incomeBars(dataset, mode, now);
  const BASE_Y = 9;
  const FLOOR = 35;
  return (
    <svg className="v1-bars" width={CH_W} height={CH_H} viewBox={`0 0 ${CH_W} ${CH_H}`} preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="v1-income-bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFF08D" />
          <stop offset="1" stopColor="#FFF08D" stopOpacity="0" />
        </linearGradient>
      </defs>
      {bars.map((b, i) => {
        const h = (FLOOR - BASE_Y) * b.scale;
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
            rx="3"
            fill="url(#v1-income-bar)"
            stroke="#FFEA83"
            strokeWidth="1.5"
          />
        );
      })}
      <g style={{ mixBlendMode: 'multiply' }}>
        <Dotted y={BASE_Y} />
      </g>
    </svg>
  );
}

// Mini heart-monitor line chart (accounts/goals) — reuses buildChart at a compact
// 140x37 footprint (the 188-wide chart geometry squashed via preserveAspectRatio).
function MiniChart({ node, now, mode, dataset }: { node: CardNode; now: number; mode: Mode; dataset: Dataset }) {
  const stroke = COLOR[node.graph];
  const isGoal = node.kind === 'goal';
  const { line, fill } = buildChart(dataset, mode, node.id, now, 5, isGoal);
  // hide the solid data line/fill until the first income event — only the dotted
  // baseline shows during the pre-income idle period
  const preIncome = now < firstIncomeMonth(dataset, mode);
  return (
    <svg className="v1-chart" width={140} height={CH_H} viewBox={`0 0 ${CH_W} ${CH_H}`} preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`v1-fill-${node.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={stroke} stopOpacity="0.3" />
          <stop offset="1" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <Dotted y={5} />
      {!preIncome && fill && <path d={fill} fill={`url(#v1-fill-${node.id})`} />}
      {!preIncome && <path d={line} stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

export default function StocksV1Card({
  node,
  now,
  mode,
  dataset,
  dateMode = 'date',
}: {
  node: CardNode;
  now: number;
  mode: Mode;
  dataset: Dataset;
  dateMode?: DateMode;
}) {
  if (node.kind === 'income') {
    return (
      <div className="card v1-card">
        <div className="v1-strip">
          <IncomeBars dataset={dataset} mode={mode} now={now} />
        </div>
        <div className="v1-income-label">Income</div>
        <div className="v1-income-amount">
          <span className="v1-amt-value">{node.amount} </span>
          <span className="v1-amt-suffix">per month</span>
        </div>
      </div>
    );
  }

  const reached = isReached(dataset, mode, node.id, now);
  const sub =
    node.kind === 'goal'
      ? dateMode === 'months'
        ? goalDateLabel(dateMode, node.badge)
        : `Fund by ${node.badge ?? ''} • ${monthsFromNow(node.badge)} months to go`
      : 'For bills and subscriptions';
  return (
    <div className={`card v1-card${reached ? ' v1-reached' : ''}`}>
      <div className="v1-title">{node.title}</div>
      <div className="v1-row">
        <MiniChart node={node} now={now} mode={mode} dataset={dataset} />
        <span className="v1-amount">{node.amount}</span>
      </div>
      <div className="v1-sub">{sub}</div>
    </div>
  );
}
