import { useEffect, useMemo, useRef, useState } from 'react';
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

// How the GOALS section under the monthly split is represented:
//  • 'networth' — (default) the "Goals net worth over time" net-worth graph on top
//    with the year-grouped calendar list stacked UNDERNEATH it (Figma 1146:3465).
//    Selecting a goal on the graph smooth-scrolls to + highlights its row in the list.
//  • 'split'    — the "Like our income split" contribution-card waterfall (Figma 1079:12915).
export type GoalsView = 'networth' | 'split';

export default function MonthlySplit({
  dataset,
  onboarding = false,
  goalsView = 'networth',
  showDebtSeparately = false,
  transitionSeq = false,
  squeezeMs = 1200,
  exitSeq = false,
  exitMs = 1500,
}: {
  dataset: Dataset;
  onboarding?: boolean;
  goalsView?: GoalsView;
  // "Goals net worth over time" chart ONLY: when true, the debt goal is drawn as its
  // OWN peach line (declining from amount-owed today to zero at payoff) overlaid on
  // the unchanged net-worth line (Figma 1442:5214). Default false = today's behavior.
  showDebtSeparately?: boolean;
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
  // REVERSE (Monthly split → Full system): when exitSeq flips true the diagram plays
  // its choreography BACKWARDS — the phase-4 flows undraw goals→spend→bills, the
  // Fruitful logo reverses out, then the take-home text + trunk retract — before App
  // swaps to the full view and flies the bars back into the section bands. exitMs is
  // the window App gives this retract before the hand-off (keeps the clocks in sync).
  exitSeq?: boolean;
  exitMs?: number;
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
    // OVERLAPPING cadence: each phase STARTS while the previous element is still
    // mid-animation (its beat is SHORTER than the element's own CSS duration), so
    // velocity carries continuously from one chunk into the next — no phase ever
    // decelerates to a dead stop before the next begins. Paced comfortably (calmer
    // than the over-tightened version) but still fluid. See the matching, slightly
    // longer per-element durations in index.css (.msplit--seq …).
    const P2 = Math.max(0, squeezeMs - 150); // take-home text/trunk begin AS the squeeze lands (carry momentum, no stop)
    const P3 = P2 + 300; // Fruitful logo pops while the take-home text is still settling
    const P4b = P3 + 320; // bills flow starts during the logo pop
    const P4s = P4b + 340; // spend begins before bills finishes drawing
    const P4g = P4s + 340; // goals begins before spend finishes drawing
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
  // ---- reverse exit choreography (Monthly split → Full system) ----
  // exitStep counts DOWN through the same steps as the forward build, retracting each
  // element in reverse order: 6 goals → 5 spend → 4 bills → 3 logo → 2 text/trunk. An
  // element for step p plays its OUT animation once exitStep <= p (see `outAt`). We
  // fit the cascade inside App's `exitMs` window so the bars are bare at the hand-off.
  const EXIT_TOP = 99; // sentinel: nothing retracted yet
  const [exitStep, setExitStep] = useState<number>(EXIT_TOP);
  useEffect(() => {
    if (!exitSeq) return;
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    // spread five retract beats across the window, leaving room for the last OUT anim.
    const span = Math.max(0, exitMs - 360); // reserve ~1 out-anim of tail
    const beat = span / 5;
    at(beat * 0, () => setExitStep(6)); // goals flow + below fade out
    at(beat * 1, () => setExitStep(5)); // spend flow
    at(beat * 2, () => setExitStep(4)); // bills flow
    at(beat * 3, () => setExitStep(3)); // Fruitful logo out
    at(beat * 4, () => setExitStep(2)); // take-home text + trunk retract
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exitSeq]);
  const seq = transitionSeq; // choreography regime for this mount (gates legacy anims)
  // element for choreography step `p` is revealed (and animates in) once phase >= p
  const inAt = (p: number) => seq && phase >= p;
  // element for step `p` plays its reverse OUT animation once the exit cascade reaches it
  const outAt = (p: number) => exitSeq && exitStep <= p;

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

  // ---- goals waterfall (funding order) — a FLAT list per Figma 1288:17025 (no
  //      year-group headers); the graph's x-axis carries the year context instead. ----
  const steps = goalWaterfall(cfg, goals);

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
  // Which goal point is highlighted. Starts with NOTHING selected — no point or
  // calendar row is highlighted until the user taps a graph point. Reset to none when
  // the dataset OR goals-section view changes so a stale id never lingers.
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  useEffect(() => {
    setSelectedGoal(null);
  }, [dataset, goalsView]);

  // ---- FIXED net-worth-graph axes (independent of the live slider) ----
  // The x-axis (time) and y-axis (net worth) are frozen to the dataset's DEFAULT
  // allocation, so dragging the Spend↔Goals slider MOVES the goal points ALONG the
  // graph (as their completion timing changes) WITHOUT rescaling the axis. The furthest
  // default-funded goal's month + the total of all goal targets set the reference span;
  // points whose timing runs past it clamp to the right edge and bunch there.
  // We then pad BOTH axes with PROJECT_HEADROOM so the furthest goal sits comfortably
  // INSIDE the plot with room up-and-right — that headroom is where the net-worth line
  // continues as a dashed projection past the last goal (Figma 1146:3715), instead of
  // topping out at the last point and dropping off.
  const PROJECT_HEADROOM = 1.32;
  const axisRef = useMemo(() => {
    const dGoals = Math.max(0, cfg.income - cfg.coreMax - cfg.spendMax); // default Goals $/mo
    const dSteps = goalWaterfall(cfg, dGoals);
    const finite = dSteps.filter((s) => isFinite(s.months)).map((s) => s.months);
    const lastM = Math.max(1, ...finite);
    const totalNW = dSteps.reduce((sum, s) => sum + s.target, 0);
    return { maxM: lastM * PROJECT_HEADROOM, maxNW: Math.max(1, totalNW) * PROJECT_HEADROOM };
  }, [cfg]);

  // ---- selecting a graph goal smooth-scrolls to its calendar-list row ----
  const rowRefs = useRef<Record<string, HTMLElement | null>>({});
  useEffect(() => {
    if (!selectedGoal || goalsView !== 'networth') return;
    const el = rowRefs.current[selectedGoal];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [selectedGoal, goalsView]);

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
      <div className={`msplit-takehome${inAt(2) ? ' msplit-takehome--text-in' : ''}${outAt(2) ? ' msplit-takehome--text-out' : ''}`} data-morph="income" data-morph-color="#f7dd6f">
        <span className="msplit-takehome-lead">Take-home pay</span>
        <span className="msplit-takehome-amt">{money(takeHome)}</span>
      </div>
      {/* short yellow connector down to the circle — the "trunk" that draws out at phase 2 */}
      <div className={`msplit-stem${inAt(2) ? ' is-in' : ''}${outAt(2) ? ' is-out' : ''}`} />
      {/* green Fruitful node — pops in + waves at phase 3 */}
      <div className={`msplit-circle${inAt(3) ? ' is-in' : ''}${outAt(3) ? ' is-out' : ''}`} style={{ left: CIRCLE_CX - 22, top: CIRCLE_CY - 22 }}>
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
            className={`msplit-branch msplit-branch--${c.cls}${inAt(4 + i) ? ' is-in' : ''}${outAt(4 + i) ? ' is-out' : ''}`}
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
              <span className={`msplit-bar-amt${inAt(4 + i) ? ' is-in' : ''}${outAt(4 + i) ? ' is-out' : ''}`}>{money(c.amount)}</span>
            </div>
            <span className={`msplit-col-label${inAt(4 + i) ? ' is-in' : ''}${outAt(4 + i) ? ' is-out' : ''}`} style={{ left: c.cx - COL_W / 2, top: BASELINE + 8, width: COL_W }}>
              {c.label}
            </span>
          </div>
        );
      })}

      {/* ---- interactive Spend↔Goals calculator + goals waterfall (Figma 1082:15049) ---- */}
      {!onboarding && (
        <div className={`msplit-below${seq ? (inAt(6) ? ' is-in' : ' msplit-below--pending') : ''}${outAt(6) ? ' is-out' : ''}`}>
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

          {/* ---- (a) DEFAULT combined view — "Goals net worth over time" net-worth graph
               on top + the year-grouped calendar list stacked UNDERNEATH (Figma 1146:3465).
               The axes are FIXED (axisRef), so moving the Spend↔Goals slider slides the
               goal points ALONG the graph (and they bunch when close) without rescaling
               the axis. Clicking a graph goal smooth-scrolls to + highlights its list row. ---- */}
          {goalsView === 'networth' &&
            (() => {
              // GW spans the FULL card width (card has no horizontal padding) and the
              // horizontal plot padding is 0, so the net-worth line + its dashed
              // projection run EDGE-TO-EDGE with no inset gap (Figma 1146:3511): the
              // origin (TODAY) sits on the left card edge and the projection reaches the
              // right card edge. PADT/PADB keep room for the title / x-axis labels.
              const GW = 354;
              const GH = 246; // Figma 1288:17026 graph area is 246px tall
              const PADL = 0;
              const PADR = 0;
              const PADT = 24;
              const PADB = 44; // x-axis label band (Figma 1288:17029 ≈ 48px)
              const pts = flow.filter((f) => isFinite(f.months));
              // ---- x-axis — FROZEN by default; rescales ONLY once a goal reaches the
              //      right edge (Figma 1146:3797) ----
              // The time axis stays FROZEN to the dataset's default allocation, so dragging
              // the slider just slides the goals ALONG it. As goals get closer together the
              // FIRST response is spacing — the clustering/fan-out below tightens/clumps them
              // in place — NOT an axis change. The axis rescale is only a FALLBACK: once the
              // furthest goal would reach/cross the plot's RIGHT edge (dragging toward Spend
              // makes goals complete later, pushing the last one outward), the axis EXPANDS
              // just enough to hold that goal inside with a small marker-radius margin, so
              // nothing ever renders outside the plot. `liveLastM` moves continuously with
              // the slider, so `max(...)` ramps smoothly (points glide, no snap), and the ≤4
              // year labels update to the (possibly expanded) range.
              const frozenMaxM = axisRef.maxM;
              const liveLastM = pts.length ? Math.max(1, ...pts.map((p) => p.months)) : 1;
              // hold the furthest goal at ~1/EDGE_MARGIN of the plot once it reaches the edge
              // (leaving room for the marker circle so it stays fully on-chart).
              const EDGE_MARGIN = 1.1;
              const maxM = Math.max(frozenMaxM, liveLastM * EDGE_MARGIN);
              const maxNW = axisRef.maxNW;
              const xOf = (m: number) => PADL + (Math.min(m, maxM) / maxM) * (GW - PADL - PADR);
              const yOf = (nw: number) => GH - PADB - (Math.min(nw, maxNW) / maxNW) * (GH - PADT - PADB);
              // ---- gentle, near-linear net-worth line (Figma 1146:3465) ----
              // The line is drawn as ONE smooth function of x with an INSANELY SUBTLE
              // upward bow (interest/growth) — nowhere near an exaggerated exponential —
              // and the goal MARKERS RIDE this line at their x position. Deriving the line
              // from a single monotonic function (instead of a Catmull-Rom through each
              // goal's cumulative-networth point) means it never kinks or overshoots the
              // plot when goals bunch/clamp at the right edge at low goals $$ (the old
              // breakdown): the curve just rises gently and the markers cluster along it.
              const ARCH = 0.2; // 0 = perfectly straight; small = barely-there accelerating bow
              const shape = (u: number) => {
                const c = Math.max(0, Math.min(1, u));
                return (1 - ARCH) * c + ARCH * c * c; // monotonic, f(0)=0, f(1)=1, gently concave-up
              };
              const x0 = xOf(0);
              const y0 = yOf(0);
              const edgeX = GW - PADR; // == xOf(maxM); the plot's right edge
              // top of the SOLID line = the last funded goal's cumulative net worth, at its
              // (clamped) x. Everything to its right is the dashed projection.
              const topNW = pts.length ? pts[pts.length - 1].networth : 0;
              const yTop = yOf(topNW);
              const xLast = pts.length ? xOf(pts[pts.length - 1].months) : x0;
              const spanX = Math.max(1, xLast - x0);
              // ---- "Show debt separately": couple the debt + net-worth curves (Figma 1442:5214) ----
              // Detect the debt goal (Simple only) and the two shared inflection x's the debt
              // and net-worth lines pivot around: the FIRST goal completing (debt starts to
              // pay down) and the debt PAYOFF (debt hits $0 → net-worth growth accelerates).
              const debtRow = showDebtSeparately ? flow.find((f) => /debt/i.test(f.title) && isFinite(f.months)) : undefined;
              const debtId = debtRow?.id;
              const xFirstGoal = pts.length ? xOf(pts[0].months) : x0; // first goal completes here
              const xDebtPayoff = debtRow ? xOf(debtRow.months) : xLast; // debt reaches $0 here
              // Net-worth shape:
              //  • default (debt folded in): ONE gentle, barely-bowed climb (unchanged).
              //  • debt shown separately: a TWO-SLOPE climb that is GENTLER while the debt is
              //    still being paid off (up to the payoff x) and STEEPER after — the money
              //    freed by clearing the debt visibly accelerates net-worth growth. The slope
              //    change is pinned to the debt-payoff x so it lines up with the debt line.
              let curveY: (x: number) => number;
              let finalSlope: number; // dCurveY/dx at xLast → drives the dashed projection angle
              if (debtRow) {
                const uInf = Math.max(0.08, Math.min(0.92, (xDebtPayoff - x0) / spanX));
                const GENTLE = 0.5; // pre-payoff climb accrues at half its proportional share
                const nwMidFrac = uInf * GENTLE; // net-worth fraction reached at the payoff x
                const s2 = (1 - nwMidFrac) / (1 - uInf); // steeper post-payoff slope (per unit u)
                const g = (u: number) => {
                  const c = Math.max(0, Math.min(1, u));
                  return c <= uInf ? nwMidFrac * (c / uInf) : nwMidFrac + (1 - nwMidFrac) * ((c - uInf) / (1 - uInf));
                };
                curveY = (x: number) => y0 - (y0 - yTop) * g((x - x0) / spanX);
                finalSlope = -((y0 - yTop) / spanX) * s2;
              } else {
                curveY = (x: number) => y0 - (y0 - yTop) * shape((x - x0) / spanX);
                finalSlope = -((y0 - yTop) / spanX) * (1 + ARCH); // tangent slope at x = xLast
              }
              // sample the gentle curve densely so smoothPath stays overshoot-free
              const NSAMP = 40;
              const solid = pts.length
                ? Array.from({ length: NSAMP + 1 }, (_, i) => {
                    const x = x0 + spanX * (i / NSAMP);
                    return { x, y: curveY(x) };
                  })
                : [{ x: x0, y: y0 }];
              const linePath = smoothPath(solid);
              // ---- dashed PROJECTION past the last goal (Figma 1146:3715) ----
              // Continue the line's FINAL slope from the last goal to the right edge, drawn
              // DASHED so it reads as a forward projection rather than real, funded goals.
              // (When debt is shown separately this is the steeper post-payoff slope.)
              // Continue at the EXACT tangent slope of the solid line's final segment so
              // the dashed projection is a straight, tangent-continuous extension of the
              // goals line (same angle, not a shallower one). We do NOT clamp edgeY — an
              // earlier top/bottom clamp changed the endpoint's y while keeping its x, which
              // FLATTENED the drawn slope. If the projection would exit the top it simply
              // bleeds off and the card's overflow:hidden clips it, preserving the slope.
              const edgeY = yTop + finalSlope * (edgeX - xLast);
              const hasProj = pts.length > 0 && edgeX > xLast + 0.5;
              const projPath = hasProj ? `M ${xLast.toFixed(1)} ${yTop.toFixed(1)} L ${edgeX.toFixed(1)} ${edgeY.toFixed(1)}` : '';
              // area fill hugs the solid line, THEN the projection, then drops to the
              // baseline at the right edge — so the gray gradient sits under the whole
              // curve with no abrupt diagonal drop-off at the last goal (Figma 1404:5845).
              const areaPath = pts.length
                ? `${linePath}${hasProj ? ` L ${edgeX.toFixed(1)} ${edgeY.toFixed(1)}` : ''} L ${edgeX.toFixed(1)} ${(GH - PADB).toFixed(1)} L ${x0.toFixed(1)} ${(GH - PADB).toFixed(1)} Z`
                : '';
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
              // recomputed LIVE every render, so the clumping responds to the slider as
              // goals slide closer/further along the fixed axis (Figma 1146:3714).
              const CLUSTER_GAP = 26; // ~one marker diameter
              const based = pts.map((p) => { const bx = xOf(p.months); return { ...p, bx, by: curveY(bx) }; });
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
              // Final hard guarantee that NO marker (even a fanned-out cluster member near a
              // boundary) renders outside the plot: clamp each center so the marker body stays
              // fully inside the card (MARGIN ≈ marker radius). The axis recalibration above
              // already keeps goals inside with headroom, so this only ever nudges edge cases.
              const MARK_MARGIN = 14;
              const clampX = (x: number) => Math.max(MARK_MARGIN, Math.min(GW - MARK_MARGIN, x));
              const clampY = (y: number) => Math.max(MARK_MARGIN, Math.min(GH - MARK_MARGIN, y));
              const positioned = clusters.flatMap((cl) => {
                if (cl.length === 1) return [{ ...cl[0], x: clampX(cl[0].bx), y: clampY(cl[0].by), clustered: false }];
                const ax = cl.reduce((s, p) => s + p.bx, 0) / cl.length;
                const ay = cl.reduce((s, p) => s + p.by, 0) / cl.length;
                const offs = clusterOffsets(cl.length);
                return cl.map((p, i) => ({ ...p, x: clampX(ax + offs[i].dx), y: clampY(ay + offs[i].dy), clustered: true }));
              });
              // ---- separate "Debt over time" line (Figma 1442:5214) ----
              // When "Show debt separately" is ON the debt goal is lifted OUT of the
              // net-worth markers and drawn as its OWN peach line modelling a realistic
              // payoff: it HOLDS FLAT at the amount owed from today until the FIRST goal
              // completes (xFirstGoal), then slopes DOWN to $0 at its payoff (xDebtPayoff),
              // where its piggy-bank marker rides the line. The flat→decline hand-off and
              // the $0 arrival both ease (smoothstep) so the corner reads clean and lines
              // up with the net-worth line's payoff inflection on the shared $ axis.
              let debtLinePath = '';
              let debtMarker: { x: number; y: number; id: string; title: string } | null = null;
              if (debtRow) {
                const yOwed = yOf(debtRow.target); // amount owed today, on the shared $ axis
                const yZero = yOf(0); // == baseline (GH - PADB): debt fully paid off
                const xFlatEnd = Math.min(xFirstGoal, xDebtPayoff); // debt is held flat until here
                const declSpan = Math.max(1, xDebtPayoff - xFlatEnd);
                const smoothstep = (t: number) => { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c); };
                const DSAMP = 44;
                const dpts = Array.from({ length: DSAMP + 1 }, (_, i) => {
                  const x = x0 + (xDebtPayoff - x0) * (i / DSAMP);
                  if (x <= xFlatEnd) return { x, y: yOwed }; // flat: still owed in full
                  return { x, y: yOwed + (yZero - yOwed) * smoothstep((x - xFlatEnd) / declSpan) };
                });
                debtLinePath = smoothPath(dpts);
                debtMarker = { x: clampX(xDebtPayoff), y: clampY(yZero), id: debtRow.id, title: debtRow.title };
              }
              return (
                /* ONE unified card (Figma 1288:17025): the net-worth graph sits at the top,
                   a full-width divider separates it from the flat goals timeline list that
                   flows below — all inside a single rounded card boundary (no per-row cards). */
                <div className="msplit-nw">
                  {/* clicking anywhere in the plot that ISN'T a goal circle DESELECTS the
                      current goal (the point buttons stopPropagation, so they still select /
                      switch selection). */}
                  <div
                    className="msplit-nw-plot"
                    style={{ width: GW, height: GH }}
                    onClick={() => setSelectedGoal(null)}
                  >
                      {/* Figma 1387:5626: a flat GRAY 4px net-worth curve with a soft gray
                          gradient area fill fading from the line down to the baseline (Figma
                          1404:5845). The pink lives only in the goal markers riding the line. */}
                      <svg width={GW} height={GH} viewBox={`0 0 ${GW} ${GH}`} fill="none" className="msplit-nw-svg">
                        <defs>
                          <linearGradient id="nwfill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#d9d9d9" stopOpacity="0.6" />
                            <stop offset="100%" stopColor="#d9d9d9" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        {areaPath && <path d={areaPath} fill="url(#nwfill)" />}
                        <path d={linePath} stroke="#e4e4e4" strokeWidth={4} strokeLinecap="round" />
                        {projPath && (
                          <path
                            className="msplit-nw-proj"
                            d={projPath}
                            stroke="#e4e4e4"
                            strokeWidth={4}
                            strokeLinecap="round"
                            fill="none"
                          />
                        )}
                        {/* separate debt line — peach, solid, same 4px weight as the
                            net-worth rail (Figma 1442:5214 Secondary/Peach/Peach). */}
                        {debtLinePath && (
                          <path
                            className="msplit-nw-debtline"
                            d={debtLinePath}
                            stroke="#f2d8b8"
                            strokeWidth={4}
                            strokeLinecap="round"
                            fill="none"
                          />
                        )}
                      </svg>
                      {/* chart title INSIDE the card, top-left (Figma 1387:5639):
                          12px medium, secondary gray (#7d7d7d). When debt is shown
                          separately a peach "Debt over time" legend row sits beneath it. */}
                      <span className="msplit-nw-title">Goals net worth over time</span>
                      {debtRow && <span className="msplit-nw-title msplit-nw-title--debt">Debt over time</span>}
                      {/* x-axis labels: the ≤4 range labels (TODAY + the January years
                          within the — possibly rescaled — range) are laid out EVENLY across
                          the full width (Figma 1146:3513, justify-between + 16px inset), so
                          they never collide or clip at the edges while still reflecting the
                          current axis range. */}
                      <div className="msplit-nw-ticks" style={{ top: GH - PADB + 8 }}>
                        {ticks.map((t, i) => (
                          <span className="msplit-nw-tick" key={`${t.label}-${i}`}>
                            {t.label}
                          </span>
                        ))}
                      </div>
                      {positioned
                        .filter((p) => p.id !== debtId)
                        .map((p) => {
                        const PtIcon = goalIcon(p.title);
                        const on = p.id === selectedGoal;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            className={`msplit-nw-pt${p.clustered ? ' msplit-nw-pt--clustered' : ''}${on ? ' msplit-nw-pt--on' : ''}`}
                            style={{ left: p.x, top: p.y }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedGoal(p.id);
                            }}
                            aria-label={`${p.title} — ${p.date}`}
                            aria-pressed={on}
                          >
                            <PtIcon size={on ? 18 : 16} strokeWidth={2} color={on ? '#ffffff' : '#191919'} />
                          </button>
                        );
                      })}
                      {/* debt marker rides the separate debt line at payoff (peach) — still
                          tappable: selecting it highlights + scrolls to its calendar row. */}
                      {debtMarker && (() => {
                        const on = debtMarker.id === selectedGoal;
                        const PtIcon = goalIcon(debtMarker.title);
                        return (
                          <button
                            key={debtMarker.id}
                            type="button"
                            className={`msplit-nw-pt msplit-nw-pt--debt${on ? ' msplit-nw-pt--on' : ''}`}
                            style={{ left: debtMarker.x, top: debtMarker.y }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedGoal(debtMarker.id);
                            }}
                            aria-label={debtMarker.title}
                            aria-pressed={on}
                          >
                            <PtIcon size={on ? 18 : 16} strokeWidth={2} color={on ? '#ffffff' : '#191919'} />
                          </button>
                        );
                      })()}
                  </div>

                  {/* full-width divider between the graph and the calendar list (Figma
                      1288:17044) — one card, two stacked sections. */}
                  <div className="msplit-nw-divider" aria-hidden="true" />

                  {/* ---- goals timeline list, flowing UNDERNEATH the graph INSIDE the same
                       card (Figma 1387:5641). A FLAT list (no year headers): each row is a
                       gray icon "dot" on a connecting vertical rail (left); a center block
                       with the goal NAME (bold) above a date pill (completion month) + an
                       amount pill (goal value); and the time-to-fund on the right as a big
                       number + unit ("5" / "months"). The selected goal's row is tinted + its
                       dot turns pink, and it is smooth-scrolled into view. ---- */}
                  <div className="msplit-goals msplit-goals--under">
                    {flow.map((row) => {
                      const Icon = goalIcon(row.title);
                      const d = durParts(row.months);
                      const sel = row.id === selectedGoal;
                      const isDebt = row.id === debtId; // peach row echoing the debt line (ON only)
                      return (
                        <div
                          className={`msplit-goal${sel ? ' msplit-goal--sel' : ''}${isDebt ? ' msplit-goal--debt' : ''}`}
                          key={row.id}
                          ref={(el) => {
                            rowRefs.current[row.id] = el;
                          }}
                        >
                          <div className="msplit-goal-rail">
                            <span className="msplit-goal-railline" aria-hidden="true" />
                            <span className="msplit-goal-dot">
                              <Icon size={16} strokeWidth={2} color={sel ? '#ffffff' : '#191919'} />
                            </span>
                          </div>
                          <div className="msplit-goal-main">
                            <span className="msplit-goal-name">{row.title}</span>
                            <div className="msplit-goal-pills">
                              <span className="msplit-goal-pill msplit-goal-pill--date">{row.date}</span>
                              <span className="msplit-goal-pill msplit-goal-pill--amt">{money(row.target)}</span>
                            </div>
                          </div>
                          <div className="msplit-goal-dur">
                            <span className="msplit-goal-dur-val">{d.value}</span>
                            {d.unit && <span className="msplit-goal-dur-unit">{d.unit}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
        </div>
      )}
    </div>
  );
}
