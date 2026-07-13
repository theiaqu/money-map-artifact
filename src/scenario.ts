/* Deterministic multi-event scenario that drives every graph off one shared
   simulated clock measured in MONTHS.

   - Line charts (core/spend/goals) are a right-anchored time series: the newest
     value is pinned at the RIGHT edge and older points scroll LEFT over time,
     across a fixed WINDOW_MONTHS-wide window. A new income reads as a step-up at
     the right edge that then migrates left as its raised shelf widens.
   - Income is a bar chart: one bar per income event, bars subdivide the width,
     and past MAX_BARS the oldest drop off.
   - Income events step balances up; random withdrawals step core/spend down;
     goals only fill until "reached". */

// Real seconds per simulated month, PER TIME MODEL. Illustrative runs on a
// slower clock so the whole playback feels calm/relaxed for a first-time viewer.
export const MONTH_SECS_BY_MODE: Record<Mode, number> = {
  accurate: 0.65,
  illustrative: 1.35,
};
export const monthSecs = (mode: Mode) => MONTH_SECS_BY_MODE[mode];
export const EVENTS_PER_MONTH = 2; // each month's $10k income arrives as two $5k paychecks

// --- income / monthly-expenses money model (dollars) ---
const INCOME = 10000; // per month, split into two paychecks
const EVENT_INCOME = INCOME / EVENTS_PER_MONTH; // 5000 per paycheck
const CORE_MAX = 5000; // monthly-expense allocation cap
const SPEND_MAX = 3000;
const EXPENSES = CORE_MAX + SPEND_MAX; // 8000 of monthly income goes to expenses
const SURPLUS = INCOME - EXPENSES; // 2000 -> flows to goals each month
// the first $5k paycheck covers 5/8 of expenses; both accounts land at this fraction
const FIRST_FILL = EVENT_INCOME / EXPENSES; // 0.625

interface GoalDef {
  id: string;
  target: number;
  level: number;
  weight: number;
}

const GOALS: GoalDef[] = [
  { id: 'ef1', target: 5000, level: 1, weight: 1 },
  { id: 'debt', target: 20000, level: 2, weight: 0.7 },
  { id: 'ef6', target: 18000, level: 2, weight: 0.3 },
];

const LEVELS: number[] = [...new Set(GOALS.map((g) => g.level))].sort((a, b) => a - b);
const GOAL_TOTAL = GOALS.reduce((s, g) => s + g.target, 0); // 43000

// Simulate enough months for EVERY on-screen goal to fully fund. The surplus
// reaches the goal waterfall at ~SURPLUS/month in accurate mode, so this many
// months guarantees the last goal tops out; +1 gives a little headroom so the
// final goal funds with an income event to spare.
const FUND_MONTHS = Math.ceil(GOAL_TOTAL / SURPLUS); // ~22
export const TOTAL_MONTHS = FUND_MONTHS + 1; // 23
export const WINDOW_MONTHS = 3; // squeeze -> scroll cutoff
export const MAX_BARS = 7;
// NOTE: the animation's total duration is now derived PER MODE from the month
// each model finishes funding its goals plus a short settle window — see
// goalsFundedMonth / animMonths / endSecs near the bottom of this file.

// chart geometry inside the 188 x 37 strip
export const CH_W = 188;
const Y_TOP = 8;
const Y_BOTTOM = 34;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);

// per-month income size (fraction of the $10k baseline / dotted line).
// most months land on the line; a few are smaller or larger.
const INCOME_SCALE = [1, 1, 0.8, 1, 1.22, 1, 1, 0.87, 1.15];

interface Pt {
  t: number;
  v: number;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function valueAt(pts: Pt[], tt: number) {
  let v = pts[0].v;
  for (const p of pts) {
    if (p.t <= tt + 1e-9) v = p.v;
    else break;
  }
  return v;
}

export type Mode = 'accurate' | 'illustrative';

interface ScenarioData {
  income: number[]; // income-event times (two per month)
  series: Record<string, Pt[]>;
  eventActive: Record<number, Set<string>>; // active branches per income event
}

const push = (pts: Pt[], t: number, v: number) => pts.push({ t, v });
const target = (id: string) => GOALS.find((g) => g.id === id)!.target;
const weight = (id: string) => GOALS.find((g) => g.id === id)!.weight;

/* Accurate core/spend: expense accounts as a fraction of their max (0..1). Each
   month brings TWO paychecks — the first (t=m-0.5) refills partway, the second
   (t=m) tops off toward the top — then the balance drains over the month: Core
   in a few LARGE chunks (rent is the biggest), Spend as many small daily steps.
   The result is a two-step-refill sawtooth that cycles within its band. */
/* Each month owns the window [m-0.5, m+0.5): paycheck 1 lands at m-0.5, a bill
   before m, paycheck 2 at m, then the big drains happen strictly before the next
   month's paycheck at m+0.5. Keeping every timestamp in order is essential —
   the chart connects points in array order, so out-of-order times draw backward
   segments (which is what made the accurate charts look scrambled). */
const buildCore = (rng: () => number): Pt[] => {
  const pts: Pt[] = [{ t: 0, v: 0 }];
  let v = 0.15;
  for (let m = 1; m <= TOTAL_MONTHS; m++) {
    v = 0.55 + rng() * 0.05; // paycheck 1 refills partway
    push(pts, m - 0.5, v);
    v = Math.max(0.4, v - (0.05 + rng() * 0.04)); // a bill between paychecks
    push(pts, m - 0.25, v);
    v = 0.9 + rng() * 0.05; // paycheck 2 tops off (peaks stay under the max line)
    push(pts, m, v);
    v = Math.max(0.34, v - (0.46 + rng() * 0.06)); // rent — the single largest hit
    push(pts, m + 0.14, v);
    v = Math.max(0.24, v - (0.08 + rng() * 0.04)); // a smaller bill
    push(pts, m + 0.28, v);
    v = Math.max(0.14, v - (0.07 + rng() * 0.04)); // another smaller bill
    push(pts, m + 0.42, v);
  }
  return pts;
};

const buildSpend = (rng: () => number): Pt[] => {
  const pts: Pt[] = [{ t: 0, v: 0 }];
  let v = 0.12;
  for (let m = 1; m <= TOTAL_MONTHS; m++) {
    v = 0.5 + rng() * 0.05; // paycheck 1
    push(pts, m - 0.5, v);
    const pre = 3; // a few daily uses between paychecks (all before m)
    for (let i = 0; i < pre; i++) {
      v = Math.max(0.12, v - (0.03 + rng() * 0.03));
      push(pts, m - 0.5 + ((i + 1) / (pre + 1)) * 0.5, v);
    }
    v = 0.9 + rng() * 0.04; // paycheck 2 tops off
    push(pts, m, v);
    const days = 8; // many small daily uses, all before the next paycheck (m+0.5)
    for (let i = 0; i < days; i++) {
      v = Math.max(0.08, v - (0.04 + rng() * 0.04));
      push(pts, m + ((i + 1) / (days + 1)) * 0.48, v);
    }
  }
  return pts;
};

/* Two time-flow models. Every month delivers two $5k paychecks:
   - paycheck 1 (t=m-0.5): fills most of the monthly expenses (Core + Spend).
   - paycheck 2 (t=m):     tops the accounts off, then the $2k surplus overflows
                           into the goal waterfall.
   Modes:
   - accurate: core/spend are draining expense accounts refilled by both
     paychecks every month; the surplus feeds goals on paycheck 2.
   - illustrative: core/spend "complete" during month 1 (two steps, then held
     full); from month 2 both paychecks flow straight to the goal waterfall. */
function buildScenario(mode: Mode): ScenarioData {
  const rng = mulberry32(7);
  const income: number[] = [];
  for (let m = 1; m <= TOTAL_MONTHS; m++) {
    income.push(m - 0.5, m);
  }

  let coreRaw: Pt[];
  let spendRaw: Pt[];
  if (mode === 'accurate') {
    coreRaw = buildCore(rng);
    spendRaw = buildSpend(rng);
  } else {
    // fill in two steps during month 1, then stay complete
    coreRaw = [{ t: 0, v: 0 }, { t: 0.5, v: FIRST_FILL }, { t: 1, v: 1 }];
    spendRaw = [{ t: 0, v: 0 }, { t: 0.5, v: FIRST_FILL }, { t: 1, v: 1 }];
  }

  const bal: Record<string, number> = {};
  const goalPts: Record<string, Pt[]> = {};
  for (const g of GOALS) {
    bal[g.id] = 0;
    goalPts[g.id] = [{ t: 0, v: 0 }];
  }
  const eventActive: Record<number, Set<string>> = {};

  // distribute `amount` across a level's not-yet-full goals by weight,
  // redistributing a filled goal's share to the rest; returns leftover.
  const distribute = (ids: string[], amount: number, received: Set<string>): number => {
    let pool = amount;
    let open = ids.filter((id) => bal[id] < target(id) - 1e-6);
    while (pool > 1e-6 && open.length > 0) {
      const totalW = open.reduce((s, id) => s + weight(id), 0);
      let used = 0;
      let filled = false;
      for (const id of open) {
        const give = Math.min((pool * weight(id)) / totalW, target(id) - bal[id]);
        if (give > 1e-6) {
          bal[id] += give;
          used += give;
          received.add(id);
        }
        if (bal[id] >= target(id) - 1e-6) filled = true;
      }
      pool -= used;
      open = ids.filter((id) => bal[id] < target(id) - 1e-6);
      if (!filled) break;
    }
    return pool;
  };

  const fundGoals = (active: Set<string>, amount: number) => {
    let rem = amount;
    for (const lvl of LEVELS) {
      if (rem <= 1e-6) break;
      const ids = GOALS.filter((g) => g.level === lvl).map((g) => g.id);
      const received = new Set<string>();
      rem = distribute(ids, rem, received);
      if (received.size > 0) {
        active.add('c-monthly-goals1'); // surplus reached the goals region
        if (lvl === 1) active.add('c-goals1-ef1');
        if (lvl >= 2) {
          active.add('c-goals1-goals2');
          if (received.has('debt')) active.add('c-goals2-debt');
          if (received.has('ef6')) active.add('c-goals2-ef6');
        }
      }
    }
  };

  // Illustrative goal fill: teach the waterfall one level at a time. Each event
  // adds half a goal, so every goal fills over exactly 2 income events (0 -> 50%
  // -> 100%), rather than snapping full instantly. Level 1 fills first, then the
  // flow moves down the spine to fill level 2, etc.
  const fundGoalsIllustrative = (active: Set<string>) => {
    for (const lvl of LEVELS) {
      const ids = GOALS.filter((g) => g.level === lvl).map((g) => g.id);
      if (ids.every((id) => bal[id] >= target(id) - 1e-6)) continue; // level done
      active.add('c-monthly-goals1');
      if (lvl === 1) {
        active.add('c-goals1-ef1');
      } else if (lvl >= 2) {
        active.add('c-goals1-goals2');
        active.add('c-goals2-debt');
        active.add('c-goals2-ef6');
      }
      for (const id of ids) bal[id] = Math.min(target(id), bal[id] + target(id) * 0.5);
      break; // only the current level fills per event
    }
  };

  for (let m = 1; m <= TOTAL_MONTHS; m++) {
    for (let e = 0; e < EVENTS_PER_MONTH; e++) {
      const first = e === 0;
      const t = first ? m - 0.5 : m;

      // Clean end: once every on-screen goal is ALREADY funded, later income
      // events fire NOTHING (no pipes light up). The last in-flight cascade
      // drains out and the frame freezes, rather than the flow continuing on
      // toward an off-page gate. The off-page spine connector stays drawn (as a
      // static skeleton) but no longer keeps the animation running.
      if (GOALS.every((g) => bal[g.id] >= g.target - 1e-6)) {
        eventActive[t] = new Set<string>();
        for (const g of GOALS) goalPts[g.id].push({ t, v: 1 });
        continue;
      }

      const active = new Set<string>(['c-income-monthly']);

      // accounts still being funded? accurate: always; illustrative: month 1 only
      const accountsOpen = mode === 'accurate' || m === 1;

      if (accountsOpen) {
        // both paychecks flow into the expense accounts (fill / top-off)
        active.add('c-monthly-core');
        active.add('c-monthly-spend');
        // accurate: only the 2nd paycheck overflows into goals via the $ waterfall.
        // illustrative: month 1 just fills the accounts — goals start (and fill
        // cleanly over 2 events) from month 2 in the else branch below.
        if (!first && mode === 'accurate') fundGoals(active, SURPLUS);
      } else {
        // illustrative, accounts complete: each event fills half of the current
        // goal level, so every goal fills over 2 income events (not instantly)
        fundGoalsIllustrative(active);
      }

      eventActive[t] = active;
      for (const g of GOALS) goalPts[g.id].push({ t, v: Math.min(1, bal[g.id] / g.target) });
    }
  }

  return { income, series: { core: coreRaw, spend: spendRaw, ...goalPts }, eventActive };
}

const SCENARIOS: Record<Mode, ScenarioData> = {
  accurate: buildScenario('accurate'),
  illustrative: buildScenario('illustrative'),
};

// income timeline is identical across modes
const INCOME_TIMES = SCENARIOS.accurate.income;

// first income time — the chart stays flat/low until money actually reaches the
// card (eff >= ORIGIN); the first income then enters as a step at the right edge.
const ORIGIN = INCOME_TIMES[0] ?? 0;

function lastIncome(now: number): number | null {
  let li: number | null = null;
  for (const m of INCOME_TIMES) {
    if (m <= now + 1e-9) li = m;
    else break;
  }
  return li;
}

const xOf = (t: number, ws: number, we: number) => ((t - ws) / (we - ws)) * CH_W;

/* ---------- causal branch chaining (gated spine + paced card arms) ----------
   Money still moves as a STRICT causal chain — a level can't start before its
   parent GATE (section node) is reached — but the two kinds of branch traverse
   at very different speeds:
   - SPINE / trunk segments (income->monthly, monthly->goals1, goals1->goals2,
     goals2->down) and the gate handoff are NEAR-INSTANT: the pulse zips down the
     trunk in `SPINE_TRAVEL` months, so each gate is reached almost immediately.
   - CARD ARMS (monthly->core/spend, goals->each goal card) keep the visible,
     paced travel `BRANCH_PACING.travel` (= ARM travel). The card's chart/ring
     fill WAITS for the comet to finish crossing this arm — it only starts once
     the pulse ARRIVES at (touches) the card, then eases up from there.

   `BRANCH_TIMING[id]` gives each branch a `gateDepth` (how many near-instant
   spine hops happen BEFORE it departs — so its departure = gateDepth * SPINE) and
   a `kind` (spine = fast, arm = paced). A card's gate is reached at
   CARD_GATE[id] * SPINE (near-instant) and its arm comet touches the card one
   ARM travel later — which is when the fill starts.

   Two offsets:
   - fillOffset    = gate * SPINE + ARM          → comet touches card (fill starts).
   - arrivalOffset = fillOffset + RING_FILL       → fill completes (reached lands). */

// near-instant trunk + gate-handoff transit, in simulated months (tiny vs. ARM)
const SPINE_TRAVEL_BY_MODE: Record<Mode, number> = {
  accurate: 0.06,
  illustrative: 0.12,
};

type BranchKind = 'spine' | 'arm';
// gateDepth = # of near-instant spine hops before this branch departs its event.
// kind = spine (zips at SPINE_TRAVEL) vs arm (paced at BRANCH_PACING.travel).
const BRANCH_TIMING: Record<string, { gateDepth: number; kind: BranchKind }> = {
  'c-income-monthly': { gateDepth: 0, kind: 'spine' },
  'c-monthly-core': { gateDepth: 1, kind: 'arm' },
  'c-monthly-spend': { gateDepth: 1, kind: 'arm' },
  'c-monthly-goals1': { gateDepth: 1, kind: 'spine' },
  'c-goals1-ef1': { gateDepth: 2, kind: 'arm' },
  'c-goals1-goals2': { gateDepth: 2, kind: 'spine' },
  'c-goals2-debt': { gateDepth: 3, kind: 'arm' },
  'c-goals2-ef6': { gateDepth: 3, kind: 'arm' },
  'c-goals2-down': { gateDepth: 3, kind: 'spine' },
};

// # of near-instant spine hops before a card's incoming ARM departs its gate
const CARD_GATE: Record<string, number> = { core: 1, spend: 1, ef1: 2, debt: 3, ef6: 3 };

// when the card's incoming ARM comet ARRIVES at (touches) the card — the chart
// fill starts HERE, not when the arm departs the gate. So the fill only begins
// once the pulse has finished traversing the gate->card arm: near-instant spine
// transit to the gate (gate*SPINE) PLUS the full paced arm travel.
export function fillOffset(mode: Mode, id: string): number {
  const gate = CARD_GATE[id];
  if (gate === undefined) return 0;
  return gate * SPINE_TRAVEL_BY_MODE[mode] + BRANCH_PACING[mode].travel;
}

// when the card's FILL completes (and the reached-check lands): the arm-arrival
// (= fillOffset) plus the fill duration. Tied to RING_FILL after arrival, so the
// check aligns exactly with the bar topping out.
export function arrivalOffset(mode: Mode, id: string): number {
  const gate = CARD_GATE[id];
  if (gate === undefined) return 0;
  return fillOffset(mode, id) + RING_FILL_BY_MODE[mode];
}

export interface ChartPaths {
  line: string;
  fill: string;
  hl: string;
  hlOn: number;
}

// `topY` sets the pixel row that a full (v=1) series maps to. It defaults to
// Y_TOP, but goal charts pass their dotted-baseline y so a fully-funded goal's
// line/fill rises to EXACTLY the dotted line (no gap above the filled area).
//
// `easeSteps` (goal charts) eases each step's rise over the branch travel time —
// the same easing the pie ring uses — so the line climbs smoothly and tops out
// exactly at arrivalOffset (= when the incoming comet lands and the "reached"
// check appears), instead of snapping full at fillOffset a whole travel early.
export function buildChart(mode: Mode, id: string, now: number, topY: number = Y_TOP, easeSteps = false): ChartPaths {
  const yOf = (v: number) => Y_BOTTOM - v * (Y_BOTTOM - topY);
  const s = SCENARIOS[mode].series[id];
  const flat: ChartPaths = { line: `M 0 ${Y_BOTTOM} L ${CH_W} ${Y_BOTTOM}`, fill: '', hl: '', hlOn: 0 };
  if (!s) return flat;

  // start filling the moment this card's incoming arm comet ARRIVES at (touches)
  // the card — fillOffset now includes the full arm travel, so nothing fills
  // while the comet is still crossing the gate->card arm
  const eff = now - fillOffset(mode, id);
  const sinceStart = eff - ORIGIN;
  // before the branch departs / first value: flat baseline at 0 (no jump on Start)
  if (sinceStart <= 1e-9) return flat;

  // Right-anchored time-series scroll (matches Figma 411:10048): the newest value
  // is pinned at the RIGHT edge (x = CH_W = eff) and older points scroll LEFT as
  // time advances, across a fixed WINDOW_MONTHS-wide window. Before the first
  // income the left of the window sits at the flat-low base value (v0), so the
  // first income reads as a small STEP-UP at the RIGHT EDGE over a flat line, and
  // that step then migrates left as the raised shelf widens from the right — no
  // full-width squeeze and no horizontal "slide" (the old reveal/squeeze produced
  // the slidey artifact).
  const we = eff;
  const ws = eff - WINDOW_MONTHS;

  const v0 = valueAt(s, ws);
  const pts: Pt[] = [{ t: ws, v: v0 }];
  for (const p of s) if (p.t > ws + 1e-9 && p.t <= we + 1e-9) pts.push(p);
  let vEnd = valueAt(s, we);
  if (pts[pts.length - 1].t < we - 1e-9) pts.push({ t: we, v: vEnd });

  // ease each step's rise over the branch travel so goal lines climb smoothly and
  // top out exactly when the incoming comet arrives (= the reached check appears)
  if (easeSteps) {
    const tr = RING_FILL_BY_MODE[mode];
    let prevRaw = v0;
    for (let i = 1; i < pts.length; i++) {
      const raw = pts[i].v;
      // Ease only UPWARD (income / fill) steps over the fill window (same gentle
      // ease-out as the pie ring / progress bars) so the rise tracks its comet
      // and tops out exactly at arrivalOffset (= when the reached-check appears).
      // Downward steps (account withdrawals / usage) are NOT driven by a comet,
      // so they land instantly — keeping the sawtooth drain crisp, not smeared.
      const f = raw > prevRaw ? easeFill((eff - pts[i].t) / tr) : 1;
      pts[i] = { t: pts[i].t, v: prevRaw + (raw - prevRaw) * f };
      prevRaw = raw;
    }
    vEnd = pts[pts.length - 1].v;
  }

  let line = `M ${xOf(ws, ws, we).toFixed(2)} ${yOf(v0).toFixed(2)}`;
  let prev = v0;
  for (let i = 1; i < pts.length; i++) {
    const xi = xOf(pts[i].t, ws, we);
    line += ` L ${xi.toFixed(2)} ${yOf(prev).toFixed(2)} L ${xi.toFixed(2)} ${yOf(pts[i].v).toFixed(2)}`;
    prev = pts[i].v;
  }
  const fill = `${line} L ${CH_W} ${Y_BOTTOM} L 0 ${Y_BOTTOM} Z`;

  const li = lastIncome(eff);
  const hlOn = li == null ? 0 : clamp(1 - (eff - li) / 0.45);
  const lastBpT = pts.length >= 2 ? pts[pts.length - 2].t : ws;
  const hlx = xOf(Math.max(lastBpT, ws), ws, we);
  const hl = `M ${hlx.toFixed(2)} ${yOf(vEnd).toFixed(2)} L ${CH_W} ${yOf(vEnd).toFixed(2)}`;

  return { line, fill, hl, hlOn };
}

export interface Bar {
  x: number;
  w: number;
  reveal: number; // right-to-left wipe progress 0..1
  scale: number; // height vs the baseline / dotted line
}

export function incomeBars(mode: Mode, now: number): Bar[] {
  // income stops arriving once the goals are all funded (the sim's clean end),
  // so bars don't keep accumulating during the final settle/hold window.
  const cur = Math.min(now, goalsFundedMonth(mode));
  const count = INCOME_TIMES.filter((m) => m <= cur + 1e-9).length;
  if (count === 0) return [];
  const shown = Math.min(count, MAX_BARS);
  const gap = 3;
  const bw = (CH_W - gap * (shown - 1)) / shown;
  const bars: Bar[] = [];
  for (let j = 0; j < shown; j++) {
    const eventIdx = count - shown + j;
    const m = INCOME_TIMES[eventIdx];
    const isNewest = eventIdx === count - 1;
    const reveal = isNewest ? easeOutCubic(clamp((cur - m) / 0.4)) : 1;
    // both paychecks in a month share that month's size
    const scale = INCOME_SCALE[Math.floor(eventIdx / EVENTS_PER_MONTH)] ?? 1;
    bars.push({ x: j * (bw + gap), w: bw, reveal, scale });
  }
  return bars;
}

export interface Flow {
  p: number; // travel progress along the pipe 0..1
  alpha: number; // overall opacity 0..1
}

/* Branch-pulse pacing, in simulated months, PER TIME MODEL. `travel` is how long
   one branch takes to fill end-to-end; the depth stagger is now travel itself
   (strict causal chaining — a child branch only departs once its parent has
   fully arrived), so there's no separate `step` constant. Illustrative is calmer
   (longer travel/fade); accurate stays snappier. */
interface Pacing {
  travel: number; // months for one branch's comet to traverse end-to-end
  fade: number; // months to fade back to gray after the branch is fully coloured
}
// `travel` (ARM travel) is deliberately kept SNAPPY — the spine/trunk between
// gates is near-instant (SPINE_TRAVEL) and the gate->card arms are the visible
// motion, so they should still zip into the cards quickly rather than crawl.
// The card's chart/ring fill eases over exactly this same `travel` window
// (starting when the arm departs its gate, finishing when the comet arrives),
// so the fill always tracks the comet down the arm and lands with it.
const BRANCH_PACING: Record<Mode, Pacing> = {
  accurate: { travel: 0.28, fade: 0.3 },
  illustrative: { travel: 0.5, fade: 0.45 },
};

// quintic accel/decel — very fluid, no abrupt starts/stops (used for both modes)
const smootherstep = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);

// Gentle, mostly-linear ease-out used for the CARD FILL specifically (pie ring,
// progress-bar-inside, progress-pill, progress-bg, and the goal line top-out).
// The old fill easing (a symmetric easeInOut) had too pronounced an accel+decel; this has NO
// initial acceleration and only a mild deceleration, so the bar climbs promptly
// and settles softly. `pow 1.5` sits between linear and easeOutQuad.
const easeFill = (x: number) => 1 - Math.pow(1 - clamp(x), 1.5);

// How long a card's chart/ring FILL takes, in simulated months, PER MODE.
// Deliberately SHORTER than the comet arm travel (BRANCH_PACING.travel) so the
// fill reaches its target a bit quicker; arrivalOffset + the goal-line top-out
// are re-aligned to THIS same duration so the reached-check still lands exactly
// when the fill completes (which is now slightly before the comet fully lands).
const RING_FILL_BY_MODE: Record<Mode, number> = {
  accurate: 0.2,
  illustrative: 0.34,
};

/* A colour sweep flows along each active branch once per income event, as a
   STRICT causal chain, but with the gated-spine timing: a branch departs at
   `gateDepth * SPINE` after the event (its parent gate is reached near-instantly)
   and then traverses in SPINE months if it's a trunk/spine segment, or the full
   paced ARM travel if it's a card arm. So the trunk zips between gates while the
   card arms carry the visible, paced motion. Travel and fade are eased with
   smootherstep for fluid, continuous motion.

   Because income arrives as two paychecks a month and the goal branches only
   fire on the 2nd (overflow) paycheck, we emit ONE pulse per firing event that
   is still within its travel + fade window, so overlapping pulses STACK and
   blend on the same branch rather than the old one snapping away. */
export function branchFlow(mode: Mode, now: number, branchId: string): Flow[] {
  const events = SCENARIOS[mode].eventActive;
  const pace = BRANCH_PACING[mode];
  const meta = BRANCH_TIMING[branchId] ?? { gateDepth: 0, kind: 'arm' as BranchKind };
  const spine = SPINE_TRAVEL_BY_MODE[mode];
  const dep = meta.gateDepth * spine; // departs when its gate is reached (near-instant)
  const tr = meta.kind === 'spine' ? spine : pace.travel; // spine zips; arm is paced
  const out: Flow[] = [];
  for (const t of INCOME_TIMES) {
    if (t > now + 1e-9) break;
    if (!events[t]?.has(branchId)) continue;
    const local = now - t - dep;
    if (local < 0) continue;
    if (local <= tr) {
      out.push({ p: smootherstep(clamp(local / tr)), alpha: 1 });
    } else {
      // smooth (eased) fade-out so pulses don't stop abruptly
      const alpha = smootherstep(clamp(1 - (local - tr) / pace.fade));
      if (alpha > 0.001) out.push({ p: 1, alpha });
    }
  }
  return out;
}

export function isReached(mode: Mode, id: string, now: number): boolean {
  const s = SCENARIOS[mode].series[id];
  if (!s) return false;
  // a goal only reads as "reached" once the flow has actually arrived at it
  return valueAt(s, now - arrivalOffset(mode, id)) >= 0.999;
}

/* Current fill fraction (0..1) of a series — drives the pie-chart rings.
   The raw series is a step function (income lands in discrete chunks), which
   would make the ring jump. The ring starts easing the moment the incoming
   branch departs (fillOffset) and glides over the branch travel time, so it
   fills concurrently with the comet and completes about when it arrives. */
export function progressAt(mode: Mode, id: string, now: number): number {
  const s = SCENARIOS[mode].series[id];
  if (!s || s.length === 0) return 0;
  // begin filling when the incoming arm comet ARRIVES at the card (fillOffset
  // now includes the full arm travel), then ease up over RING_FILL from there
  const eff = now - fillOffset(mode, id);
  const ringFill = RING_FILL_BY_MODE[mode]; // quick, gentle fill window
  let k = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i].t <= eff + 1e-9) k = i;
    else break;
  }
  const cur = s[k];
  const prev = k > 0 ? s[k - 1].v : cur.v;
  const e = easeFill((eff - cur.t) / ringFill);
  return clamp(prev + (cur.v - prev) * e);
}

// nodes belonging to each goal level. Only the section node + percent badges
// grey out when a level is skipped — the goal CARDS keep their funded look.
const LEVEL_NODES: Record<number, string[]> = {
  1: ['goals1', 'p100'],
  2: ['goals2', 'p70b', 'p30b'],
};

function levelFunded(mode: Mode, level: number, now: number): boolean {
  const ids = GOALS.filter((g) => g.level === level).map((g) => g.id);
  // arrival-aware: a level only counts as funded (and its node greys) once the
  // flow has actually reached every goal card in that level
  return ids.length > 0 && ids.every((id) => isReached(mode, id, now));
}

/* Once a goal level is fully funded AND a deeper level exists to fund next,
   the flow skips that level — so its section node + badges grey out (the goal
   cards themselves stay lit). The illustrative model never greys nodes. */
export function dimmedNodes(mode: Mode, now: number): Set<string> {
  const dimmed = new Set<string>();
  if (mode === 'illustrative') return dimmed;
  const maxLevel = Math.max(...LEVELS);
  for (const lvl of LEVELS) {
    if (lvl < maxLevel && levelFunded(mode, lvl, now)) LEVEL_NODES[lvl]?.forEach((id) => dimmed.add(id));
  }
  return dimmed;
}

/* ---------- per-mode animation duration ----------
   The sim ends when every on-screen goal is funded, plus a short settle so the
   final in-flight branch cascade drains, then the last frame is held (Restart).
   Illustrative funds its goals in a handful of months; accurate takes ~22. Both
   then freeze — no more firing toward an off-page gate. */

// simulated month at which the LAST on-screen goal reaches 100%.
export function goalsFundedMonth(mode: Mode): number {
  let latest = 0;
  for (const g of GOALS) {
    const s = SCENARIOS[mode].series[g.id];
    let ft = TOTAL_MONTHS;
    for (const p of s) {
      if (p.v >= 0.999) {
        ft = p.t;
        break;
      }
    }
    latest = Math.max(latest, ft);
  }
  return latest;
}

// months to let the deepest branch cascade drain after the final funding event.
// The deepest goal card (depth 3) only STARTS filling once its arm comet ARRIVES
// (gate*SPINE + travel), then eases over RING_FILL, completing at arrivalOffset;
// then the branch colour fades out — so the freeze must wait for all of that.
function settleMonths(mode: Mode): number {
  const p = BRANCH_PACING[mode];
  // deepest goal's fill completes at arrivalOffset = gate reach + arm travel +
  // RING_FILL; the branch colour then fades — the freeze waits for all of that.
  // (The comet itself arrives one RING_FILL earlier and fades over `fade`, which
  // this comfortably covers.)
  const deepestArrival = Math.max(...GOALS.map((g) => arrivalOffset(mode, g.id)));
  return deepestArrival + p.fade + 0.6;
}

// total simulated months before the frame freezes (per mode)
export function animMonths(mode: Mode): number {
  return goalsFundedMonth(mode) + settleMonths(mode);
}

// wall-clock seconds for the whole run (per mode)
export const endSecs = (mode: Mode) => animMonths(mode) * MONTH_SECS_BY_MODE[mode];
