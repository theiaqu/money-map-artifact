import { Check } from 'lucide-react';
import type { GraphColor, MapStyle } from '../data';
import { CH_W, buildChart, incomeBars, isReached, firstIncomeMonth, type Dataset, type Mode } from '../scenario';

const COLOR: Record<GraphColor, string> = {
  yellow: '#efc63e',
  blue: '#49c7ef',
  green: '#37d67a',
  pink: '#ff2d8e',
};

// money-map pastel palette: line/pie stroke + fill-gradient top stop
const MM_COLOR: Record<GraphColor, string> = {
  yellow: '#F6DC72',
  blue: '#B0D9FF',
  green: '#61BC76',
  pink: '#EEBED4',
};
const MM_FILL: Record<GraphColor, string> = {
  yellow: '#FFF08D',
  blue: '#C6E5FF',
  green: '#A6FFB3',
  pink: '#FFBCE5',
};

const BOTTOM = 37;

export type GraphVariant = 'income' | 'flow' | 'goal';

// money-map category pill overlaid on the top-left of the graph
function CategoryPill({ text, color }: { text: string; color: GraphColor }) {
  return (
    <div className="card-pill" style={{ background: MM_COLOR[color], color: color === 'pink' ? '#111' : '#000' }}>
      {text}
    </div>
  );
}

function Dotted({ y = 5 }: { y?: number }) {
  return (
    <line x1="0" y1={y} x2={CH_W} y2={y} stroke="var(--graph-dotted)" strokeWidth="1.5" strokeDasharray="1.5 3.5" strokeLinecap="round" />
  );
}

export default function GraphStrip({
  id,
  color,
  variant,
  now,
  mode,
  dataset,
  badge,
  tertiary,
  pill,
  map = 'flow',
}: {
  id: string;
  color: GraphColor;
  variant: GraphVariant;
  now: number;
  mode: Mode;
  dataset: Dataset;
  badge?: string;
  tertiary?: boolean; // "Title tertiary" card style: show a title pill, hide the date pill
  pill?: string;
  map?: MapStyle;
}) {
  const money = map === 'money-map';
  const stroke = money ? MM_COLOR[color] : COLOR[color];
  const lineW = money ? 4 : 2;
  const fillStop = money ? MM_FILL[color] : stroke;
  const fillOp = money ? (color === 'pink' ? 0.5 : 0.7) : 0.3;

  if (variant === 'income') {
    const bars = incomeBars(dataset, mode, now);
    const BASE_Y = 9; // dotted baseline ($10k) — most bars top out here
    const FLOOR = 35;
    return (
      <div className="graph-strip">
        <svg width={CH_W} height={BOTTOM} viewBox={`0 0 ${CH_W} ${BOTTOM}`} fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id={money ? 'incomeBarMM' : 'incomeBar'} x1="0" y1="0" x2="0" y2="1">
              {money ? (
                <>
                  <stop offset="0" stopColor="#FFF08D" />
                  <stop offset="1" stopColor="#FFF08D" stopOpacity="0" />
                </>
              ) : (
                <>
                  <stop offset="0" stopColor="#ffe483" />
                  <stop offset="1" stopColor="#fff8d4" />
                </>
              )}
            </linearGradient>
          </defs>
          {bars.map((b, i) => {
            const h = (FLOOR - BASE_Y) * b.scale;
            const topY = Math.max(2, FLOOR - h);
            const revW = b.w * b.reveal;
            if (revW < 0.5) return null;
            const revX = b.x + b.w - revW; // wipe in from the right edge
            return (
              <rect
                key={i}
                x={revX.toFixed(2)}
                y={topY.toFixed(2)}
                width={revW.toFixed(2)}
                height={(FLOOR - topY).toFixed(2)}
                rx="3"
                fill={money ? 'url(#incomeBarMM)' : 'url(#incomeBar)'}
                stroke={money ? '#FFEA83' : undefined}
                strokeWidth={money ? 1.5 : undefined}
              />
            );
          })}
          <Dotted y={BASE_Y} />
        </svg>
      </div>
    );
  }

  // stocks/heart-monitor gate: before the first income event nothing but the
  // dotted baseline shows — the solid data line/fill/highlight stay hidden.
  const preIncome = now < firstIncomeMonth(dataset, mode);

  if (variant === 'goal') {
    const reached = isReached(dataset, mode, id, now);
    // map a full goal (v=1) to the dotted baseline y, so a completed goal's
    // line/fill rises to EXACTLY the dotted line instead of stopping below it
    const dottedY = money ? 9 : 5;
    // easeSteps: goal line climbs smoothly and tops out at arrivalOffset (when the
    // comet lands + the reached check appears), rather than snapping full early
    const { line, fill } = buildChart(dataset, mode, id, now, dottedY, true);
    const showFill = money || reached; // money map shows the soft fill throughout
    return (
      <div className="graph-strip">
        <svg width={CH_W} height={BOTTOM} viewBox={`0 0 ${CH_W} ${BOTTOM}`} fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={fillStop} stopOpacity={fillOp} />
              <stop offset="1" stopColor={fillStop} stopOpacity="0" />
            </linearGradient>
          </defs>
          <Dotted y={money ? 9 : 5} />
          {!preIncome && showFill && fill && <path d={fill} fill={`url(#fill-${id})`} />}
          {!preIncome && <path d={line} stroke={stroke} strokeWidth={lineW} strokeLinecap="round" strokeLinejoin="round" />}
        </svg>
        {money
          ? pill && <CategoryPill text={pill} color={color} />
          : tertiary
            ? pill && (
                <div className="graph-title-pill" style={{ background: COLOR[color] }}>
                  {pill}
                </div>
              )
            : badge && (
                <div className={`fund-pill${reached ? ' reached' : ''}`}>
                  {reached && <Check size={11} strokeWidth={3} color="#fff" />}
                  <span>{badge}</span>
                </div>
              )}
      </div>
    );
  }

  // variant === 'flow' (core / spend)
  // map a full account (v=1) to the dotted baseline y so a Funded/full account
  // chart's top edge coincides exactly with the dotted line (no gap)
  const flowDottedY = money ? 9 : 5;
  // easeSteps: each income refill rises in step with its incoming comet and tops
  // out exactly when the comet arrives (arrivalOffset) — so the account no longer
  // snaps full the instant the arm departs. Downward withdrawal steps stay instant
  // (see buildChart) so the sawtooth drain is preserved.
  const { line, fill, hl, hlOn } = buildChart(dataset, mode, id, now, flowDottedY, true);
  // illustrative: once an account takes its first paycheck it is "complete"
  const funded = !money && mode === 'illustrative' && isReached(dataset, mode, id, now);
  return (
    <div className="graph-strip">
      <svg width={CH_W} height={BOTTOM} viewBox={`0 0 ${CH_W} ${BOTTOM}`} fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={fillStop} stopOpacity={fillOp} />
            <stop offset="1" stopColor={fillStop} stopOpacity="0" />
          </linearGradient>
        </defs>
        <Dotted y={money ? 9 : 5} />
        {!preIncome && fill && <path d={fill} fill={`url(#fill-${id})`} />}
        {!preIncome && !money && hlOn > 0.01 && <path d={hl} stroke={stroke} strokeWidth="5.5" strokeLinecap="round" opacity={hlOn * 0.28} />}
        {!preIncome && <path d={line} stroke={stroke} strokeWidth={lineW} strokeLinecap="round" strokeLinejoin="round" />}
        {!preIncome && !money && hlOn > 0.01 && <path d={hl} stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity={hlOn * 0.4} />}
      </svg>
      {money
        ? pill && <CategoryPill text={pill} color={color} />
        : tertiary
          ? pill && (
              <div className="graph-title-pill" style={{ background: COLOR[color] }}>
                {pill}
              </div>
            )
          : funded && (
              <div className="fund-pill reached" style={{ background: stroke }}>
                <Check size={11} strokeWidth={3} color="#fff" />
                <span>Funded</span>
              </div>
            )}
    </div>
  );
}
