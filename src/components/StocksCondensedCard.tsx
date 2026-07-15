import { CircleCheck } from 'lucide-react';
import type { CardNode, GraphColor } from '../data';
import { CH_W, buildChart, incomeBars, isReached, progressAt, firstIncomeMonth, monthsFromNow, type Dataset, type Mode, type DateMode } from '../scenario';

// Condensed stocks (Figma 522:6440) — same heart-monitor hues as V1/V2 stocks.
const COLOR: Record<GraphColor, string> = {
  yellow: '#efc63e',
  blue: '#49c7ef',
  green: '#37d67a',
  pink: '#ff2d8e',
};

const CH_H = 37;

// the two stacked lines of the goal date block. In 'date' mode a "Mon YYYY" badge
// splits into an uppercase month over its year ("OCT" / "2026"); in 'months' mode
// it becomes the count stacked over the word "months" ("3" / "months"; singular
// "month" at 1; a reached/overdue goal clamps to "NOW" / "").
function dateLines(dateMode: DateMode, badge?: string): { top: string; bot: string } {
  if (!badge) return { top: '', bot: '' };
  if (dateMode === 'months') {
    const n = monthsFromNow(badge);
    return n <= 0 ? { top: 'NOW', bot: '' } : { top: `${n}`, bot: n === 1 ? 'month' : 'months' };
  }
  const m = badge.trim().match(/^([A-Za-z]{3})\s+(\d{4})$/);
  if (!m) return { top: badge.toUpperCase(), bot: '' };
  return { top: m[1].toUpperCase(), bot: m[2] };
}

function Dotted({ y = 5, w = CH_W }: { y?: number; w?: number }) {
  return (
    <line x1="0" y1={y} x2={w} y2={y} stroke="var(--graph-dotted)" strokeWidth="1.5" strokeDasharray="1.5 3.5" strokeLinecap="round" />
  );
}

// Income yellow-bar strip (identical treatment to V1: #fff08d -> transparent bars
// with a #ffea83 border and a dotted baseline).
function IncomeBars({ dataset, mode, now }: { dataset: Dataset; mode: Mode; now: number }) {
  const bars = incomeBars(dataset, mode, now);
  const BASE_Y = 9;
  const FLOOR = 35;
  return (
    <svg className="v1-bars" width={CH_W} height={CH_H} viewBox={`0 0 ${CH_W} ${CH_H}`} preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cond-income-bar" x1="0" y1="0" x2="0" y2="1">
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
            fill="url(#cond-income-bar)"
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

// tiny 50px heart-monitor chart (buildChart squashed from the 188-wide geometry)
function MiniChart({ node, now, mode, dataset }: { node: CardNode; now: number; mode: Mode; dataset: Dataset }) {
  const stroke = COLOR[node.graph];
  const isGoal = node.kind === 'goal';
  const { line, fill } = buildChart(dataset, mode, node.id, now, 5, isGoal);
  // hide the solid data line/fill until the first income event — only the dotted
  // baseline shows during the pre-income idle period
  const preIncome = now < firstIncomeMonth(dataset, mode);
  return (
    <svg className="condensed-chart" width={50} height={CH_H} viewBox={`0 0 ${CH_W} ${CH_H}`} preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`cond-fill-${node.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={stroke} stopOpacity="0.3" />
          <stop offset="1" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <Dotted y={5} />
      {!preIncome && fill && <path d={fill} fill={`url(#cond-fill-${node.id})`} />}
      {!preIncome && <path d={line} stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

// goal date ring: a pink progress arc that becomes a pink check when reached
const RING_R = 5.5;
const RING_C = 2 * Math.PI * RING_R;
function DateRing({ progress, reached }: { progress: number; reached: boolean }) {
  if (reached) {
    return <CircleCheck size={14} color="#ff2d8e" strokeWidth={2.5} />;
  }
  const p = Math.max(0, Math.min(1, progress));
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx={7} cy={7} r={RING_R} fill="none" stroke="#d5d5d5" strokeWidth={1.8} />
      <circle
        cx={7}
        cy={7}
        r={RING_R}
        fill="none"
        stroke="#ff2d8e"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeDasharray={RING_C}
        strokeDashoffset={RING_C * (1 - p)}
        transform="rotate(-90 7 7)"
      />
    </svg>
  );
}

export default function StocksCondensedCard({
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
  // income reuses the V1 income card look (centered, borderless)
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

  const isGoal = node.kind === 'goal';
  const reached = isGoal && isReached(dataset, mode, node.id, now);
  const prog = progressAt(dataset, mode, node.id, now);
  const { top: dateTop, bot: dateBot } = dateLines(dateMode, node.badge);
  return (
    <div className={`card condensed-card${reached ? ' condensed-reached' : ''}`}>
      <div className="condensed-left">
        <div className="condensed-title">{node.title}</div>
        <div className="condensed-amount">{node.amount}</div>
      </div>
      <MiniChart node={node} now={now} mode={mode} dataset={dataset} />
      {isGoal ? (
        <div className="condensed-date">
          <DateRing progress={prog} reached={reached} />
          <div className="condensed-date-stack">
            <div className="condensed-mon">{dateTop}</div>
            <div className="condensed-year">{dateBot}</div>
          </div>
        </div>
      ) : (
        <div className="condensed-every">
          <span>Every</span>
          <span>Month</span>
        </div>
      )}
    </div>
  );
}
