import { useEffect, useRef, useState } from 'react';
import { Umbrella, PiggyBank, Home, Plane, TrendingUp, type LucideIcon } from 'lucide-react';
import FruitfulLogo from './FruitfulLogo';
import { heroHeadline, goalWaterfall, waterfallDate, DATASETS, type Dataset } from '../scenario';

// "Monthly split" / "Income Split" in-prototype view (Figma 907:13144 + 1082:15049):
// a simplified single screen that shows how one month's take-home pay splits three
// ways — Bills (Core), Spend, and Goals (all goal buckets merged) — followed by an
// interactive Spend↔Goals calculator and a "goals waterfall" list that shows, in
// funding order, how long each goal takes to reach and when it completes. Rendered
// instead of the full tree when the "Full system / Monthly split" toggle is monthly.
//
// Amounts derive from the active dataset: take-home = income, Bills = coreMax. The
// remaining pool (income − Bills) is split between Spend and Goals by the slider
// (defaulting to the dataset's spendMax). The goals waterfall recomputes live from
// the current monthly Goals number so users can simulate different allocations.

const BOARD_W = 402;
// The whole split diagram (take-home card → stem → circle → branches → bars →
// labels) is shifted DOWN 30px vs the earlier layout so the take-home card clears
// the scrolling Full-system/Monthly-split toggle with a comfortable ~24px gap
// (was overlapping it by ~6px). Every y below (plus .msplit-takehome / .msplit-stem
// in index.css) carries the same +30 so the block moves as one.
const BASELINE = 782; // bars sit on this y; column labels just below
const MAX_BAR_H = 214; // the largest column's height

// column centers + width
const COL_W = 108;
const COL_X = { bills: 74, spend: 201, goals: 328 }; // centers
const CIRCLE_CX = 201;
const CIRCLE_CY = 482;
const CIRCLE_BOTTOM = 506;

function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

// goal-title → line icon, mirroring pbiIconFor in Card.tsx so the waterfall rows
// use the same glyphs as the tree cards.
function goalIcon(title: string): LucideIcon {
  const t = title.toLowerCase();
  if (/debt/.test(t)) return PiggyBank;
  if (/house/.test(t)) return Home;
  if (/travel|slush/.test(t)) return Plane;
  if (/brokerage|invest/.test(t)) return TrendingUp;
  return Umbrella; // emergency funds + default
}

// months-to-fund → a big value + unit ("5" / "months", "2.5" / "years"). Under two
// years reads in months; beyond that in years to one decimal (trailing .0 trimmed).
function durParts(months: number): { value: string; unit: string } {
  if (!isFinite(months)) return { value: '—', unit: '' };
  if (months < 24) {
    const m = Math.max(1, Math.round(months));
    return { value: String(m), unit: m === 1 ? 'month' : 'months' };
  }
  const yrs = Math.round((months / 12) * 10) / 10;
  const value = Number.isInteger(yrs) ? String(yrs) : yrs.toFixed(1);
  return { value, unit: yrs === 1 ? 'year' : 'years' };
}

export default function MonthlySplit({ dataset, onboarding = false }: { dataset: Dataset; onboarding?: boolean }) {
  const cfg = DATASETS[dataset];
  const hero = heroHeadline(dataset);
  const bills = cfg.coreMax;
  const pool = Math.max(0, cfg.income - cfg.coreMax); // splittable between Spend + Goals
  const takeHome = cfg.income;

  // LOCAL simulation state — the user drags the Spend↔Goals slider to try different
  // allocations. Resets to the dataset default whenever the dataset changes so the
  // base dataset numbers are never corrupted.
  const [spend, setSpend] = useState(cfg.spendMax);
  useEffect(() => {
    setSpend(DATASETS[dataset].spendMax);
  }, [dataset]);
  const spendVal = Math.max(0, Math.min(pool, spend));
  const goals = Math.max(0, pool - spendVal);

  const maxAmt = Math.max(bills, spendVal, goals, 1);
  const barH = (amt: number) => Math.round((amt / maxAmt) * MAX_BAR_H);

  const cols = [
    { id: 'bills', label: 'Bills', amount: bills, cx: COL_X.bills, cls: 'blue', hex: '#b0d9ff' },
    { id: 'spend', label: 'Spend', amount: spendVal, cx: COL_X.spend, cls: 'green', hex: '#61bc76' },
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

  // ---- slider drag (relative to the track; snaps to $50) ----
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const p = pool > 0 ? spendVal / pool : 0; // knob position (fraction allocated to Spend / green, from the left)
  const setFromClientX = (clientX: number) => {
    const el = trackRef.current;
    if (!el || pool <= 0) return;
    const r = el.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    setSpend(Math.round((frac * pool) / 50) * 50);
  };
  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    document.body.classList.add('is-scrubbing-noselect');
    setFromClientX(e.clientX);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      /* pointer capture is best-effort (e.g. synthetic events) */
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    setFromClientX(e.clientX);
  };
  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    document.body.classList.remove('is-scrubbing-noselect');
  };
  useEffect(() => () => document.body.classList.remove('is-scrubbing-noselect'), []);

  const pct = (amt: number) => (takeHome > 0 ? Math.round((amt / takeHome) * 100) : 0);

  // ---- goals waterfall (funding order + completion year grouping) ----
  const steps = goalWaterfall(cfg, goals);
  const yearGroups: { year: number; label: string; rows: typeof steps }[] = [];
  for (const s of steps) {
    const { year } = waterfallDate(s.months);
    let g = yearGroups.find((x) => x.year === year);
    if (!g) {
      g = { year, label: isFinite(year) ? String(year) : 'Someday', rows: [] };
      yearGroups.push(g);
    }
    g.rows.push(s);
  }

  return (
    <div className={`msplit${onboarding ? ' msplit--onboard' : ''}`} style={{ width: BOARD_W }}>
      {!onboarding && (
        <>
          <div className="pbi-hero-logo">
            {/* top hero sprout is STATIC across Full system ↔ Monthly split — it renders
                identically to the full-system header (no entrance animation). The only
                animated logo is the green circle node in the card below. */}
            <FruitfulLogo size={40} color="#2f8f4e" />
          </div>
          <p className="pbi-hero-sub">
            Your Money Map is ready!<br />
            Based on everything you&rsquo;ve told us, we estimate you could be&hellip;
          </p>
          <h1 className="pbi-hero-title">{`${hero.pre} ${hero.date}`}</h1>
        </>
      )}

      {/* Take-home pay pill (the active paycheck / income band morphs into this) */}
      <div className="msplit-takehome" data-morph="income" data-morph-color="#f7dd6f">
        <span className="msplit-takehome-lead">Take-home pay</span>
        <span className="msplit-takehome-amt">{money(takeHome)}</span>
      </div>
      {/* short yellow connector down to the circle */}
      <div className="msplit-stem" />
      {/* green Fruitful node */}
      <div className="msplit-circle" style={{ left: CIRCLE_CX - 22, top: CIRCLE_CY - 22 }}>
        <span className="msplit-logo-wave msplit-logo-wave--circle">
          <FruitfulLogo size={24} color="#ffffff" />
        </span>
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

      {/* ---- interactive Spend↔Goals calculator + goals waterfall (Figma 1082:15049) ---- */}
      {!onboarding && (
        <div className="msplit-below">
          <div className="msplit-slider">
            <div className="msplit-slider-head">
              <span className="msplit-slider-tag">
                <span className="msplit-slider-dot msplit-slider-dot--spend" />
                Spend
              </span>
              <span className="msplit-slider-tag">
                Goals
                <span className="msplit-slider-dot msplit-slider-dot--goals" />
              </span>
            </div>
            <div
              ref={trackRef}
              className="msplit-track"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              role="slider"
              aria-label="Adjust Spend vs Goals"
              aria-valuemin={0}
              aria-valuemax={pool}
              aria-valuenow={spendVal}
            >
              <div className="msplit-track-spend" style={{ width: `${p * 100}%` }} />
              <div className="msplit-track-goals" style={{ width: `${(1 - p) * 100}%` }} />
              <div className="msplit-knob" style={{ left: `${p * 100}%` }} />
            </div>
            <div className="msplit-slider-vals">
              <div className="msplit-slider-val">
                <span className="msplit-slider-amt">{money(spendVal)}</span>
                <span className="msplit-slider-sub">{pct(spendVal)}% of income</span>
              </div>
              <div className="msplit-slider-val msplit-slider-val--goals">
                <span className="msplit-slider-amt">{money(goals)}</span>
                <span className="msplit-slider-sub">{pct(goals)}% of income</span>
              </div>
            </div>
          </div>

          <div className="msplit-goals">
            {yearGroups.map((g) => (
              <div className="msplit-goals-group" key={g.label}>
                <div className="msplit-goals-year">{g.label}</div>
                {g.rows.map((row) => {
                  const Icon = goalIcon(row.title);
                  const d = durParts(row.months);
                  const date = waterfallDate(row.months).label;
                  return (
                    <div className="msplit-goal" key={row.id}>
                      <div className="msplit-goal-time">
                        <span className="msplit-goal-time-val">{d.value}</span>
                        {d.unit && <span className="msplit-goal-time-unit">{d.unit}</span>}
                      </div>
                      <div className="msplit-goal-main">
                        <div className="msplit-goal-info">
                          <div className="msplit-goal-name">
                            <Icon size={16} strokeWidth={1.75} color="#111" />
                            <span>{row.title}</span>
                          </div>
                          <span className="msplit-goal-amt">Goal: {money(row.target)}</span>
                        </div>
                        <span className="msplit-goal-date">{date}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
