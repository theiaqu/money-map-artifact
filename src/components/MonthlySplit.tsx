import FruitfulLogo from './FruitfulLogo';
import { heroHeadline, DATASETS, type Dataset } from '../scenario';

// "Monthly split" in-prototype view (Figma 907:13144): a simplified single screen
// that shows how one month's take-home pay splits three ways — Bills (Core), Spend,
// and Goals (all goal buckets merged into one). Rendered instead of the full tree
// when the in-prototype "Full system / Monthly split" toggle is set to monthly.
//
// Amounts derive from the active dataset: take-home = income, Bills = coreMax,
// Spend = spendMax, Goals = the monthly surplus (income − core − spend).

const BOARD_W = 402;
const BASELINE = 792; // bars sit on this y; column labels just below
const MAX_BAR_H = 214; // the largest column's height

// column centers + width
const COL_W = 108;
const COL_X = { bills: 74, spend: 201, goals: 328 }; // centers
const CIRCLE_CX = 201;
const CIRCLE_CY = 452;
const CIRCLE_BOTTOM = 476;

function money(n: number): string {
  return `$${n.toLocaleString('en-US')}`;
}

export default function MonthlySplit({ dataset }: { dataset: Dataset }) {
  const cfg = DATASETS[dataset];
  const hero = heroHeadline(dataset);
  const bills = cfg.coreMax;
  const spend = cfg.spendMax;
  const goals = Math.max(0, cfg.income - cfg.coreMax - cfg.spendMax);
  const takeHome = cfg.income;
  const maxAmt = Math.max(bills, spend, goals);
  const barH = (amt: number) => Math.round((amt / maxAmt) * MAX_BAR_H);

  const cols = [
    { id: 'bills', label: 'Bills', amount: bills, cx: COL_X.bills, cls: 'blue', hex: '#b0d9ff' },
    { id: 'spend', label: 'Spend', amount: spend, cx: COL_X.spend, cls: 'green', hex: '#61bc76' },
    { id: 'goals', label: 'Goals', amount: goals, cx: COL_X.goals, cls: 'pink', hex: '#eebed4' },
  ] as const;

  // curvy branches from the circle bottom to each column's top-center
  const barTopY = (amt: number) => BASELINE - barH(amt);
  const path = (cx: number, topY: number) => {
    const sx = CIRCLE_CX;
    const sy = CIRCLE_BOTTOM;
    const midY = (sy + topY) / 2;
    return `M${sx} ${sy} C ${sx} ${midY}, ${cx} ${sy + 8}, ${cx} ${topY}`;
  };

  return (
    <div className="msplit" style={{ width: BOARD_W }}>
      <div className="pbi-hero-logo">
        <FruitfulLogo size={40} color="#2f8f4e" />
      </div>
      <p className="pbi-hero-sub">
        Your Money Map is ready!<br />
        Based on everything you&rsquo;ve told us, we estimate you could be&hellip;
      </p>
      <h1 className="pbi-hero-title">{`${hero.pre} ${hero.date}`}</h1>

      {/* Take-home pay pill (the active paycheck morphs into this) */}
      <div className="msplit-takehome" data-morph="income" data-morph-color="#f7dd6f">
        <span className="msplit-takehome-lead">Take-home pay</span>
        <span className="msplit-takehome-amt">{money(takeHome)}</span>
      </div>
      {/* short yellow connector down to the circle */}
      <div className="msplit-stem" />
      {/* green Fruitful node */}
      <div className="msplit-circle" style={{ left: CIRCLE_CX - 22, top: CIRCLE_CY - 22 }}>
        <FruitfulLogo size={24} color="#ffffff" />
      </div>

      {/* curvy fan-out branches */}
      <svg className="msplit-branches" width={BOARD_W} height={BASELINE} viewBox={`0 0 ${BOARD_W} ${BASELINE}`} fill="none">
        {cols.map((c) => (
          <path
            key={c.id}
            className={`msplit-branch msplit-branch--${c.cls}`}
            d={path(c.cx, barTopY(c.amount))}
            strokeWidth={11}
            strokeLinecap="round"
          />
        ))}
      </svg>

      {/* the three split bars */}
      {cols.map((c, i) => {
        const h = barH(c.amount);
        return (
          <div key={c.id}>
            <div
              className={`msplit-bar msplit-bar--${c.cls}`}
              data-morph={c.id}
              data-morph-color={c.hex}
              style={{ left: c.cx - COL_W / 2, top: BASELINE - h, width: COL_W, height: h, animationDelay: `${140 + i * 90}ms` }}
            >
              <span className="msplit-bar-amt">{money(c.amount)}</span>
            </div>
            <span className="msplit-col-label" style={{ left: c.cx - COL_W / 2, top: BASELINE + 8, width: COL_W }}>
              {c.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
