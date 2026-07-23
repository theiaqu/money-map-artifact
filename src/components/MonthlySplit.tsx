import { useEffect, useRef, useState } from 'react';
import { Umbrella, PiggyBank, Home, Plane, TrendingUp, ArrowDown, type LucideIcon } from 'lucide-react';
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

// funding-level index → ordinal badge ("1st", "2nd", "3rd", …) for the income-split
// goal cards (Figma 1079:12915 shows the layer/tier number in a pink circle badge).
function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
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

// Smooth (Catmull-Rom → cubic-bezier) path through a series of points — used to
// draw the rising net-worth curve so it eases through each goal point instead of
// reading as straight segments.
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export type GoalsView = 'list' | 'split' | 'networth';

export default function MonthlySplit({
  dataset,
  onboarding = false,
  goalsView = 'list',
  transitionSeq = false,
  squeezeMs = 1200,
}: {
  dataset: Dataset;
  onboarding?: boolean;
  goalsView?: GoalsView;
  // When true, this mount was entered via the "Sections" Full→Monthly morph, so the
  // diagram builds itself in a 4-phase choreography off the shared morph clock:
  //   1 SQUEEZE   — the section-band ghosts fly into the take-home card + bars (owned
  //                 by App; here we just keep text/branches/logo hidden meanwhile),
  //   2 TAKE-HOME — the "Take-home pay" text pops in + the yellow trunk/stem draws,
  //   3 LOGO      — the Fruitful circle pops in and waves,
  //   4→6 FLOWS   — the bills, then spend, then goals branch each draws out in turn
  //                 (with its bar amount + label fading in as the flow lands).
  // squeezeMs is the App squeeze (ghost) duration so phase 2 starts right as it settles.
  transitionSeq?: boolean;
  squeezeMs?: number;
}) {
  const cfg = DATASETS[dataset];
  const hero = heroHeadline(dataset);
  const bills = cfg.coreMax;
  const pool = Math.max(0, cfg.income - cfg.coreMax); // splittable between Spend + Goals
  const takeHome = cfg.income;

  // ---- 4-phase entrance choreography (Sections Full→Monthly morph) ----
  // phase 0 = "off" (not a sequenced entry → render immediately with the legacy mount
  // animations). 1..6 = live phases; 7 = "rest" (everything shown, no further motion).
  // Runs ONCE per mount (MonthlySplit remounts on every monthly entry), so slider /
  // dataset re-renders never replay it, and it stays sticky at rest afterwards.
  const [phase, setPhase] = useState<number>(transitionSeq ? 1 : 0);
  useEffect(() => {
    if (!transitionSeq) return;
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    const P2 = squeezeMs + 140; // take-home text + trunk, just after the squeeze settles
    const P3 = P2 + 540; // Fruitful logo pop + wave
    const P4b = P3 + 620; // bills flow
    const P4s = P4b + 560; // spend flow
    const P4g = P4s + 560; // goals flow
    const DONE = P4g + 620; // settle into the resting Monthly split
    at(P2, () => setPhase(2));
    at(P3, () => setPhase(3));
    at(P4b, () => setPhase(4));
    at(P4s, () => setPhase(5));
    at(P4g, () => setPhase(6));
    at(DONE, () => setPhase(7));
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const seq = transitionSeq; // choreography regime for this mount (gates legacy anims)
  // element for choreography step `p` is revealed (and animates in) once phase >= p
  const inAt = (p: number) => seq && phase >= p;

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

  // ---- enriched waterfall for the "income-split" + "net worth" goals views ----
  // Each step gains: its contribution % (the goal's weight WITHIN its funding level,
  // mirroring how the income split shows each bucket's % share), its destination
  // account label + icon, its completion date, and the cumulative net worth once it
  // funds. All derive from the SAME live `goals` number, so they recompute as the
  // Spend↔Goals slider moves.
  const levelWeight = new Map<number, number>();
  cfg.goals.forEach((g) => levelWeight.set(g.level, (levelWeight.get(g.level) ?? 0) + g.weight));
  let cumulative = 0;
  const flow = steps.map((s) => {
    const g = cfg.goals.find((x) => x.id === s.id)!;
    const pct = Math.round((g.weight / (levelWeight.get(s.level) || 1)) * 100);
    cumulative += s.target;
    return {
      ...s,
      pct,
      account: g.pill,
      date: waterfallDate(s.months).label,
      networth: cumulative,
    };
  });

  // ---- interactive net-worth graph selection ----
  // Which goal point is highlighted (defaults to the FIRST-funding goal). Reset when
  // the dataset changes so a stale id from the other dataset never lingers.
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  useEffect(() => {
    setSelectedGoal(null);
  }, [dataset]);
  const activeGoalId = selectedGoal ?? (flow[0]?.id ?? null);
  const activeGoal = flow.find((f) => f.id === activeGoalId) ?? flow[0];

  return (
    <div className={`msplit${onboarding ? ' msplit--onboard' : ''}${seq ? ' msplit--seq' : ''}`} style={{ width: BOARD_W }}>
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

      {/* Take-home pay pill (the active paycheck / income band morphs into this). In
          the choreography the yellow CARD lands during the squeeze (App ghost), then
          its TEXT pops in at phase 2. */}
      <div className={`msplit-takehome${inAt(2) ? ' msplit-takehome--text-in' : ''}`} data-morph="income" data-morph-color="#f7dd6f">
        <span className="msplit-takehome-lead">Take-home pay</span>
        <span className="msplit-takehome-amt">{money(takeHome)}</span>
      </div>
      {/* short yellow connector down to the circle — the "trunk" that draws out at phase 2 */}
      <div className={`msplit-stem${inAt(2) ? ' is-in' : ''}`} />
      {/* green Fruitful node — pops in + waves at phase 3 */}
      <div className={`msplit-circle${inAt(3) ? ' is-in' : ''}`} style={{ left: CIRCLE_CX - 22, top: CIRCLE_CY - 22 }}>
        <span className="msplit-logo-wave msplit-logo-wave--circle">
          <FruitfulLogo size={24} color="#ffffff" />
        </span>
      </div>

      {/* curvy fan-out branches — each draws out (stroke-dashoffset) in phase 4: bills
          (i=0) → spend (i=1) → goals (i=2). pathLength normalizes every path to 1 so a
          single dash covers it regardless of its real length. */}
      <svg className="msplit-branches" width={BOARD_W} height={BASELINE} viewBox={`0 0 ${BOARD_W} ${BASELINE}`} fill="none">
        {cols.map((c, i) => (
          <path
            key={c.id}
            className={`msplit-branch msplit-branch--${c.cls}${inAt(4 + i) ? ' is-in' : ''}`}
            d={path(c.cx, barTopY(c.amount))}
            strokeWidth={11}
            strokeLinecap="round"
            pathLength={1}
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
              {/* amount fades in as this bar's flow lands (phase 4+i), not during the squeeze */}
              <span className={`msplit-bar-amt${inAt(4 + i) ? ' is-in' : ''}`}>{money(c.amount)}</span>
            </div>
            <span className={`msplit-col-label${inAt(4 + i) ? ' is-in' : ''}`} style={{ left: c.cx - COL_W / 2, top: BASELINE + 8, width: COL_W }}>
              {c.label}
            </span>
          </div>
        );
      })}

      {/* ---- interactive Spend↔Goals calculator + goals waterfall (Figma 1082:15049) ---- */}
      {!onboarding && (
        <div className={`msplit-below${seq ? (inAt(6) ? ' is-in' : ' msplit-below--pending') : ''}`}>
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

          {/* ---- (a) Calendar list — year-grouped goals waterfall (default) ---- */}
          {goalsView === 'list' && (
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
          )}

          {/* ---- (b) "Like our income split" — a waterfall of contribution cards
               (Figma 1079:12915). Each goal shows its % share of the goals money, its
               destination account, and the balance it funds up to — mirroring how the
               Spend/Goals split reads. ---- */}
          {goalsView === 'split' && (
            <div className="msplit-wf">
              <h2 className="msplit-goals-h">Goals waterfall</h2>
              {flow.map((row, i) => {
                const Icon = goalIcon(row.title);
                return (
                  <div key={row.id}>
                    <div className="msplit-wf-card">
                      <div className="msplit-wf-head">
                        <span className="msplit-wf-badge">{ordinal(row.level)}</span>
                        <span className="msplit-wf-title">{row.title}</span>
                        <span className="msplit-wf-date">{row.date}</span>
                      </div>
                      <div className="msplit-wf-rule">
                        <div className="msplit-wf-line">
                          Contribute <span className="msplit-wf-strong">{isFinite(row.months) ? `${row.pct}%` : '—'}</span>
                        </div>
                        <div className="msplit-wf-line">
                          to
                          <span className="msplit-wf-avatar-sm">
                            <Icon size={13} strokeWidth={1.75} color="#7a4a5f" />
                          </span>
                          <span className="msplit-wf-strong">{row.account}</span>
                        </div>
                        <div className="msplit-wf-line">
                          until available balance = <span className="msplit-wf-strong">{money(row.target)}</span>
                        </div>
                      </div>
                    </div>
                    {i < flow.length - 1 && (
                      <div className="msplit-wf-arrow" aria-hidden="true">
                        <ArrowDown size={18} strokeWidth={2} color="#c2c2c2" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ---- (c) Net worth graph — an interactive timeline (Figma 1099:15988).
               The rising curve plots cumulative net worth; each goal is a clickable
               point that highlights the goal + shows its detail card below. ---- */}
          {goalsView === 'networth' &&
            (() => {
              const GW = 330;
              const GH = 188;
              const PADL = 16;
              const PADR = 26;
              const PADT = 20;
              const PADB = 30;
              const pts = flow.filter((f) => isFinite(f.months));
              const maxM = Math.max(1, ...pts.map((p) => p.months));
              const maxNW = Math.max(1, ...pts.map((p) => p.networth));
              const xOf = (m: number) => PADL + (m / maxM) * (GW - PADL - PADR);
              const yOf = (nw: number) => GH - PADB - (nw / maxNW) * (GH - PADT - PADB);
              const curve = [{ x: xOf(0), y: yOf(0) }, ...pts.map((p) => ({ x: xOf(p.months), y: yOf(p.networth) }))];
              const linePath = smoothPath(curve);
              const areaPath = pts.length ? `${linePath} L ${xOf(maxM).toFixed(1)} ${(GH - PADB).toFixed(1)} L ${xOf(0).toFixed(1)} ${(GH - PADB).toFixed(1)} Z` : '';
              // x-axis ticks: TODAY at the origin + each January boundary within range
              const allTicks: { x: number; label: string }[] = [{ x: xOf(0), label: 'TODAY' }];
              for (let m = 1; m <= Math.ceil(maxM); m++) {
                const d = waterfallDate(m);
                if (d.label.startsWith('JAN')) allTicks.push({ x: xOf(m), label: String(d.year) });
              }
              // Cap at 4 labels so a long range (e.g. Optimizer → 2032) doesn't crowd
              // the axis: keep first + last and evenly subsample a couple in between.
              const MAX_TICKS = 4;
              let ticks = allTicks;
              if (allTicks.length > MAX_TICKS) {
                const idxs = new Set<number>();
                for (let i = 0; i < MAX_TICKS; i++) idxs.add(Math.round((i * (allTicks.length - 1)) / (MAX_TICKS - 1)));
                ticks = [...idxs].sort((a, b) => a - b).map((i) => allTicks[i]);
              }
              // ---- clump close-together goals (Figma 1099:15988) ----
              // Goals landing near each other in time would overlap into a cramped
              // pile. Instead, chain neighbours whose markers would collide (2D gap <
              // CLUSTER_GAP) into a cluster, then fan each member out on a small ring
              // around the cluster's centroid so they read as an intentional overlapping
              // clump — every circle stays individually clickable/selectable.
              const CLUSTER_GAP = 26; // ~one marker diameter
              const based = pts.map((p) => ({ ...p, bx: xOf(p.months), by: yOf(p.networth) }));
              const clusters: (typeof based)[] = [];
              for (const p of based) {
                const cl = clusters[clusters.length - 1];
                const prev = cl?.[cl.length - 1];
                if (cl && prev && Math.hypot(p.bx - prev.bx, p.by - prev.by) < CLUSTER_GAP) cl.push(p);
                else clusters.push([p]);
              }
              const clusterOffsets = (n: number): { dx: number; dy: number }[] => {
                if (n <= 1) return [{ dx: 0, dy: 0 }];
                if (n === 2) return [{ dx: -8, dy: -9 }, { dx: 8, dy: 9 }];
                const R = 12 + Math.max(0, n - 3) * 3;
                return Array.from({ length: n }, (_, i) => {
                  const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; // start at top, go round
                  return { dx: R * Math.cos(a), dy: R * Math.sin(a) };
                });
              };
              const positioned = clusters.flatMap((cl) => {
                if (cl.length === 1) return [{ ...cl[0], x: cl[0].bx, y: cl[0].by, clustered: false }];
                const ax = cl.reduce((s, p) => s + p.bx, 0) / cl.length;
                const ay = cl.reduce((s, p) => s + p.by, 0) / cl.length;
                const offs = clusterOffsets(cl.length);
                return cl.map((p, i) => ({ ...p, x: ax + offs[i].dx, y: ay + offs[i].dy, clustered: true }));
              });
              const detailParts = activeGoal ? activeGoal.date.split(' ') : ['', ''];
              const DetailIcon = activeGoal ? goalIcon(activeGoal.title) : Umbrella;
              return (
                <div className="msplit-nw">
                  <h2 className="msplit-goals-h">Your goals timeline</h2>
                  <div className="msplit-nw-card">
                    <div className="msplit-nw-plot" style={{ width: GW, height: GH }}>
                      <svg width={GW} height={GH} viewBox={`0 0 ${GW} ${GH}`} fill="none" className="msplit-nw-svg">
                        {areaPath && <path d={areaPath} fill="url(#nwfill)" />}
                        <defs>
                          <linearGradient id="nwfill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#eebed4" stopOpacity="0.28" />
                            <stop offset="100%" stopColor="#eebed4" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <path d={linePath} stroke="#c9c9c9" strokeWidth={2} strokeLinecap="round" />
                      </svg>
                      {ticks.map((t, i) => (
                        <span className="msplit-nw-tick" key={`${t.label}-${i}`} style={{ left: t.x, top: GH - PADB + 8 }}>
                          {t.label}
                        </span>
                      ))}
                      {positioned.map((p) => {
                        const PtIcon = goalIcon(p.title);
                        const on = p.id === activeGoalId;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            className={`msplit-nw-pt${p.clustered ? ' msplit-nw-pt--clustered' : ''}${on ? ' msplit-nw-pt--on' : ''}`}
                            style={{ left: p.x, top: p.y }}
                            onClick={() => setSelectedGoal(p.id)}
                            aria-label={`${p.title} — ${p.date}`}
                            aria-pressed={on}
                          >
                            <PtIcon size={on ? 16 : 13} strokeWidth={2} color={on ? '#ffffff' : '#7a4a5f'} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {activeGoal && (
                    <div className="msplit-nw-detail">
                      <div className="msplit-nw-detail-date">
                        <span className="msplit-nw-detail-mo">{detailParts[0]}</span>
                        <span className="msplit-nw-detail-yr">{detailParts[1]}</span>
                      </div>
                      <div className="msplit-nw-detail-main">
                        <div className="msplit-nw-detail-name">
                          <DetailIcon size={16} strokeWidth={1.75} color="#111" />
                          <span>{activeGoal.title}</span>
                        </div>
                        <span className="msplit-nw-detail-amt">Goal: {money(activeGoal.target)}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
        </div>
      )}
    </div>
  );
}
