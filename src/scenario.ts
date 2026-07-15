/* Deterministic multi-event scenario that drives every graph off one shared
   simulated clock measured in MONTHS.

   - Line charts (core/spend/goals) are a right-anchored time series: the newest
     value is pinned at the RIGHT edge and older points scroll LEFT over time,
     across a fixed WINDOW_MONTHS-wide window. A new income reads as a step-up at
     the right edge that then migrates left as its raised shelf widens.
   - Income is a bar chart: one bar per income event, bars subdivide the width,
     and past MAX_BARS the oldest drop off.
   - Income events step balances up; random withdrawals step core/spend down;
     goals only fill until "reached".

   Everything is parameterized by a DATASET (see DATASETS below): the income /
   expense caps and the goal definitions differ per dataset, so the scenario is
   computed per (dataset, mode) and memoized. */

// Real seconds per simulated month, PER TIME MODEL. Illustrative runs on a
// slower clock so the whole playback feels calm/relaxed for a first-time viewer.
export const MONTH_SECS_BY_MODE: Record<Mode, number> = {
  accurate: 0.65,
  illustrative: 1.35,
};
export const monthSecs = (mode: Mode) => MONTH_SECS_BY_MODE[mode];
export const EVENTS_PER_MONTH = 2; // each month's income arrives as two paychecks

export type Mode = 'accurate' | 'illustrative';
export type Dataset = 'simple' | 'optimizer';

/* ---------- per-dataset configuration ----------
   Each dataset fully reparameterizes the money model: monthly income, the two
   expense-account caps, and the goal waterfall (targets/levels/weights) plus the
   display strings each card shows. The goal SLOT ids (ef1 / debt / ef6) are
   fixed by the on-screen layout and reused across datasets — only their
   titles/targets/levels/weights/labels change. */
export interface DatasetGoal {
  id: string; // physical slot: 'ef1' | 'debt' | 'ef6'
  title: string;
  target: number;
  level: number;
  weight: number;
  amount: string; // display, e.g. '$6,000'
  suffix: string; // 'goal'
  badge: string; // fund-by date (cosmetic)
  pill: string; // money-map category label
  mapMain: string; // money-map (line variant) main text line
}

export interface DatasetConfig {
  income: number; // per month, split into two paychecks
  coreMax: number; // Core account monthly allocation cap
  spendMax: number; // Spend account monthly allocation cap
  incomeAmount: string; // income card display amount
  coreAmount: string; // core card display amount
  spendAmount: string; // spend card display amount
  goals: DatasetGoal[];
}

export const DATASETS: Record<Dataset, DatasetConfig> = {
  // DEFAULT — "Simple with debt". Two level-2 goals share the 2nd gate by weight
  // (debt 70% / ef6 30%), matching the original scenario with new numbers.
  simple: {
    income: 8000,
    coreMax: 4000,
    spendMax: 2000,
    incomeAmount: '$8,000',
    coreAmount: '$4,000',
    spendAmount: '$2,000',
    goals: [
      { id: 'ef1', title: '1 Month Emergency Fund', target: 6000, level: 1, weight: 1, amount: '$6,000', suffix: 'goal', badge: 'Oct 2026', pill: 'Emergency fund', mapMain: 'Oct 2026' },
      { id: 'debt', title: 'Pay off debt', target: 20000, level: 2, weight: 0.7, amount: '$20,000', suffix: 'goal', badge: 'Dec 2027', pill: 'Pay off debt', mapMain: 'Dec 2027' },
      { id: 'ef6', title: '6 Month Emergency Fund', target: 36000, level: 2, weight: 0.3, amount: '$36,000', suffix: 'goal', badge: 'Feb 2029', pill: 'Emergency fund', mapMain: 'Feb 2029' },
    ],
  },
  // "Optimizer". Goals fund across THREE weighted LAYERS held by three goal
  // gates. The 1st gate holds the 1-Mo EF alone (L1). The 2nd gate holds a
  // gate-paired layer (L2): 6-Mo EF 60% + House 40% — both fund simultaneously by
  // weight, the higher-share 6-Mo EF completes first, then House absorbs 100% of
  // the remaining money until the layer is complete. The 3rd gate holds the final
  // layer (L3): Travel/Slush 60% + Brokerage 40% — same grammar (Travel completes
  // fast, Brokerage absorbs the remainder). Only once a layer is fully funded does
  // the flow spill to the next. The final Brokerage bucket carries a concrete
  // target so the sim still terminates.
  optimizer: {
    income: 15000,
    coreMax: 6000,
    spendMax: 4000,
    incomeAmount: '$15,000',
    coreAmount: '$6,000',
    spendAmount: '$4,000',
    goals: [
      { id: 'ef1', title: '1 Month Emergency Fund', target: 10000, level: 1, weight: 1, amount: '$10,000', suffix: 'goal', badge: 'Sep 2026', pill: 'Emergency fund', mapMain: 'Sep 2026' },
      { id: 'debt', title: '6 Month Emergency Fund', target: 60000, level: 2, weight: 0.6, amount: '$60,000', suffix: 'goal', badge: 'Sep 2027', pill: 'Emergency fund', mapMain: 'Sep 2027' },
      { id: 'ef6', title: 'House', target: 100000, level: 2, weight: 0.4, amount: '$100,000', suffix: 'goal', badge: 'May 2029', pill: 'House', mapMain: 'May 2029' },
      { id: 'travel', title: 'Travel/Slush', target: 10000, level: 3, weight: 0.6, amount: '$10,000', suffix: 'goal', badge: 'Jul 2029', pill: 'Travel', mapMain: 'Jul 2029' },
      { id: 'brokerage', title: 'Brokerage', target: 200000, level: 3, weight: 0.4, amount: '$200,000', suffix: 'goal', badge: 'Nov 2032', pill: 'Brokerage', mapMain: 'Nov 2032' },
    ],
  },
};

/* ---------- goal fund-by date display ----------
   "Goal date" is a pure display toggle (not tied to the sim): every goal card can
   show its absolute fund-by badge ("Oct 2026") or a relative "{N} mo. from now".
   All styles measure "now" against ONE shared reference month so they agree. The
   badges are cosmetic future dates anchored to the artifact's "Last updated Jul
   2026", so the reference is Jul 2026. */
export type DateMode = 'date' | 'months';
const DATE_REF_YEAR = 2026;
const DATE_REF_MONTH = 6; // 0-based month index: 6 = July
const MONTH_ABBR = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// whole months between the reference month and a "Mon YYYY" fund-by badge,
// clamped at 0 so a reached/overdue goal never reads as negative months.
export function monthsFromNow(badge: string | undefined): number {
  const m = badge?.trim().toLowerCase().match(/^([a-z]{3})\s+(\d{4})$/);
  if (!m) return 0;
  const mi = MONTH_ABBR.indexOf(m[1]);
  if (mi < 0) return 0;
  const target = Number(m[2]) * 12 + mi;
  const base = DATE_REF_YEAR * 12 + DATE_REF_MONTH;
  return Math.max(0, target - base);
}

// the date token a goal card shows: the absolute badge ('date' mode) or a
// relative "{N} mo. from now" ('months' mode; 0 -> "now"). Callers keep their own
// surrounding phrasing ("Fund by", "By", pill, stacked, ...).
export function goalDateLabel(dateMode: DateMode, badge: string | undefined): string {
  if (!badge) return '';
  if (dateMode === 'date') return badge;
  const n = monthsFromNow(badge);
  return n <= 0 ? 'now' : `${n} mo. from now`;
}

export const WINDOW_MONTHS = 3; // squeeze -> scroll cutoff
export const MAX_BARS = 7;
// NOTE: the animation's total duration is derived PER (dataset, mode) from the
// month each model finishes funding its goals plus a short settle window — see
// goalsFundedMonth / animMonths / endSecs near the bottom of this file.

// chart geometry inside the 188 x 37 strip
export const CH_W = 188;
const Y_TOP = 8;
const Y_BOTTOM = 34;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);

// per-month income size (fraction of the baseline / dotted line).
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

/* A fully-computed scenario for one (dataset, mode). Carries not just the time
   series but the dataset's derived goal set / levels / month count so every
   downstream helper stays dataset-aware. */
interface ScenarioData {
  income: number[]; // income-event times (two per month)
  series: Record<string, Pt[]>;
  eventActive: Record<number, Set<string>>; // active branches per income event
  goals: DatasetGoal[];
  levels: number[];
  totalMonths: number;
}

const push = (pts: Pt[], t: number, v: number) => pts.push({ t, v });

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
const buildCore = (rng: () => number, totalMonths: number): Pt[] => {
  const pts: Pt[] = [{ t: 0, v: 0 }];
  let v = 0.15;
  for (let m = 1; m <= totalMonths; m++) {
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

const buildSpend = (rng: () => number, totalMonths: number): Pt[] => {
  const pts: Pt[] = [{ t: 0, v: 0 }];
  let v = 0.12;
  for (let m = 1; m <= totalMonths; m++) {
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

/* Two time-flow models. Every month delivers two paychecks:
   - paycheck 1 (t=m-0.5): fills most of the monthly expenses (Core + Spend).
   - paycheck 2 (t=m):     tops the accounts off, then the surplus overflows
                           into the goal waterfall.
   Modes:
   - accurate: core/spend are draining expense accounts refilled by both
     paychecks every month; the surplus feeds goals on paycheck 2.
   - illustrative: core/spend "complete" during month 1 (two steps, then held
     full); from month 2 both paychecks flow straight to the goal waterfall. */
/* Physical goal SLOT -> which section gate feeds it, the fan-out ARM connector
   that carries money into it, and the chain of SPINE segments a pulse must
   traverse to reach that gate. Fixed by the on-screen layout and shared across
   datasets (a dataset simply doesn't use the slots/gates it lacks): Simple stops
   at the 2nd gate; Optimizer adds the 3rd gate (travel + brokerage). */
const GOAL_GATE: Record<string, string> = {
  ef1: 'goals1',
  debt: 'goals2',
  ef6: 'goals2',
  travel: 'goals3',
  brokerage: 'goals3',
};
const GOAL_ARM: Record<string, string> = {
  ef1: 'c-goals1-ef1',
  debt: 'c-goals2-debt',
  ef6: 'c-goals2-ef6',
  travel: 'c-goals3-travel',
  brokerage: 'c-goals3-brokerage',
};
const GATE_SPINE: Record<string, string[]> = {
  goals1: ['c-monthly-goals1'],
  goals2: ['c-monthly-goals1', 'c-goals1-goals2'],
  goals3: ['c-monthly-goals1', 'c-goals1-goals2', 'c-goals2-goals3'],
};

function buildScenario(dataset: Dataset, mode: Mode): ScenarioData {
  const cfg = DATASETS[dataset];

  // --- income / monthly-expenses money model (dollars), per dataset ---
  const INCOME = cfg.income; // per month, split into two paychecks
  const EVENT_INCOME = INCOME / EVENTS_PER_MONTH; // per paycheck
  const CORE_MAX = cfg.coreMax; // monthly-expense allocation cap
  const SPEND_MAX = cfg.spendMax;
  const EXPENSES = CORE_MAX + SPEND_MAX; // monthly income that goes to expenses
  const SURPLUS = INCOME - EXPENSES; // flows to goals each month
  // the first paycheck covers this fraction of expenses; both accounts land here
  const FIRST_FILL = EVENT_INCOME / EXPENSES;

  const GOALS = cfg.goals;
  const LEVELS = [...new Set(GOALS.map((g) => g.level))].sort((a, b) => a - b);
  const GOAL_TOTAL = GOALS.reduce((s, g) => s + g.target, 0);

  // Simulate enough months for EVERY on-screen goal to fully fund. The surplus
  // reaches the goal waterfall at ~SURPLUS/month in accurate mode, so this many
  // months guarantees the last goal tops out; +1 gives a little headroom so the
  // final goal funds with an income event to spare.
  const FUND_MONTHS = Math.ceil(GOAL_TOTAL / SURPLUS);
  const TOTAL_MONTHS = FUND_MONTHS + 1;

  const target = (id: string) => GOALS.find((g) => g.id === id)!.target;
  const weight = (id: string) => GOALS.find((g) => g.id === id)!.weight;

  const rng = mulberry32(7);
  const income: number[] = [];
  for (let m = 1; m <= TOTAL_MONTHS; m++) {
    income.push(m - 0.5, m);
  }

  let coreRaw: Pt[];
  let spendRaw: Pt[];
  if (mode === 'accurate') {
    coreRaw = buildCore(rng, TOTAL_MONTHS);
    spendRaw = buildSpend(rng, TOTAL_MONTHS);
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

  // light the full spine chain down to a goal's gate, plus that goal's fan-out
  // arm — so a pulse visibly descends the trunk to whichever gate holds the goal
  // (1st / 2nd / 3rd) before branching into the specific card.
  const lightGoal = (active: Set<string>, id: string) => {
    for (const seg of GATE_SPINE[GOAL_GATE[id]]) active.add(seg);
    active.add(GOAL_ARM[id]);
  };

  const fundGoals = (active: Set<string>, amount: number) => {
    let rem = amount;
    for (const lvl of LEVELS) {
      if (rem <= 1e-6) break;
      const ids = GOALS.filter((g) => g.level === lvl).map((g) => g.id);
      const received = new Set<string>();
      rem = distribute(ids, rem, received);
      // light the spine + arm for every card that actually received money this
      // event (each card's gate chain includes the shared upper-trunk segments).
      received.forEach((id) => lightGoal(active, id));
    }
  };

  // Illustrative goal fill: teach the waterfall one LAYER at a time, but fund a
  // multi-goal layer the way accurate mode does — simultaneously, by weight, with
  // spillover. Each event pours HALF the current layer's total target through the
  // shared `distribute()`, so the layer completes over ~2 income events while its
  // higher-weight (or smaller) goal tops out first and the sibling absorbs the
  // remainder. A single-goal layer (level 1) still fills over 2 events (0 -> 50%
  // -> 100%). Only the current (first not-yet-complete) layer fires per event, so
  // deeper cards stay dark until their turn; leftover isn't spilled here (the next
  // event advances to the next layer), keeping the calm one-layer-per-step cadence.
  const fundGoalsIllustrative = (active: Set<string>) => {
    for (const lvl of LEVELS) {
      const ids = GOALS.filter((g) => g.level === lvl).map((g) => g.id);
      if (ids.every((id) => bal[id] >= target(id) - 1e-6)) continue; // level done
      const budget = ids.reduce((s, id) => s + target(id), 0) * 0.5;
      const received = new Set<string>();
      distribute(ids, budget, received);
      // light the spine + arm(s) only for cards that received money this event, so
      // a deeper-level card (e.g. Optimizer's House / Brokerage) stays dark until
      // its turn.
      received.forEach((id) => lightGoal(active, id));
      break; // only the current layer fills per event
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

  return {
    income,
    series: { core: coreRaw, spend: spendRaw, ...goalPts },
    eventActive,
    goals: GOALS,
    levels: LEVELS,
    totalMonths: TOTAL_MONTHS,
  };
}

// memoized per (dataset, mode) — building is cheap but this keeps the many
// per-frame helpers from recomputing the whole scenario on every call.
const scenarioCache = new Map<string, ScenarioData>();
function getScenario(dataset: Dataset, mode: Mode): ScenarioData {
  const key = `${dataset}:${mode}`;
  let s = scenarioCache.get(key);
  if (!s) {
    s = buildScenario(dataset, mode);
    scenarioCache.set(key, s);
  }
  return s;
}

// first income time — the chart stays flat/low until money actually reaches the
// card (eff >= ORIGIN); the first income then enters as a step at the right edge.
// (Income times are identical across datasets/modes: m-0.5, m for m>=1.)
const originOf = (sc: ScenarioData) => sc.income[0] ?? 0;

function lastIncome(times: number[], now: number): number | null {
  let li: number | null = null;
  for (const m of times) {
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
   - arrivalOffset = fillOffset + FILL_SPAN       → fill completes (reached lands).
   These are keyed off the physical slot ids (fixed across datasets), so they
   depend only on the time model, not the dataset. */

// Trunk + gate-handoff transit, in simulated months (still fast vs. the ARM,
// but deliberately NOT a blink): the spine is one long vertical pipe made of
// several chained hops, so giving each hop a visible travel lets a pulse be
// seen descending the trunk. Combined with the 0.5-mo income cadence, ~2-3
// consecutive income pulses are mid-descent on the spine at once (overlapping
// in the pipeline) instead of one instantaneous flash per event.
const SPINE_TRAVEL_BY_MODE: Record<Mode, number> = {
  accurate: 0.11,
  illustrative: 0.22,
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
  // Optimizer 3rd gate: the spine hops once more (goals2 -> goals3) then fans out
  // to the two deepest goals; goals3-down is the off-page continuation.
  'c-goals2-goals3': { gateDepth: 3, kind: 'spine' },
  'c-goals3-travel': { gateDepth: 4, kind: 'arm' },
  'c-goals3-brokerage': { gateDepth: 4, kind: 'arm' },
  'c-goals3-down': { gateDepth: 4, kind: 'spine' },
};

// # of near-instant spine hops before a card's incoming ARM departs its gate
const CARD_GATE: Record<string, number> = { core: 1, spend: 1, ef1: 2, debt: 3, ef6: 3, travel: 4, brokerage: 4 };

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
// (= fillOffset) plus the per-event fill span. The last funding event's eased
// ramp finishes exactly FILL_SPAN after it lands, so the check aligns exactly
// with the bar/line topping out.
export function arrivalOffset(mode: Mode, id: string): number {
  const gate = CARD_GATE[id];
  if (gate === undefined) return 0;
  return fillOffset(mode, id) + FILL_SPAN_BY_MODE[mode];
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
export function buildChart(dataset: Dataset, mode: Mode, id: string, now: number, topY: number = Y_TOP, easeSteps = false): ChartPaths {
  const yOf = (v: number) => Y_BOTTOM - v * (Y_BOTTOM - topY);
  const sc = getScenario(dataset, mode);
  const s = sc.series[id];
  const flat: ChartPaths = { line: `M 0 ${Y_BOTTOM} L ${CH_W} ${Y_BOTTOM}`, fill: '', hl: '', hlOn: 0 };
  if (!s) return flat;

  const ORIGIN = originOf(sc);
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
    const tr = FILL_SPAN_BY_MODE[mode];
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

  const li = lastIncome(sc.income, eff);
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

export function incomeBars(dataset: Dataset, mode: Mode, now: number): Bar[] {
  const sc = getScenario(dataset, mode);
  // income stops arriving once the goals are all funded (the sim's clean end),
  // so bars don't keep accumulating during the final settle/hold window.
  const cur = Math.min(now, goalsFundedMonth(dataset, mode));
  const count = sc.income.filter((m) => m <= cur + 1e-9).length;
  if (count === 0) return [];
  const shown = Math.min(count, MAX_BARS);
  const gap = 3;
  const bw = (CH_W - gap * (shown - 1)) / shown;
  const bars: Bar[] = [];
  for (let j = 0; j < shown; j++) {
    const eventIdx = count - shown + j;
    const m = sc.income[eventIdx];
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
// `travel` is a touch longer than before so each arm pulse has a longer visible
// life, and `fade` is extended so a pulse lingers well past its 0.5-mo spacing —
// together the arm's total life (travel + fade) now spans ~2-3 income intervals,
// so successive events OVERLAP on the arms (and adjacent goal levels light up at
// the same time) rather than reading as discrete, isolated whooshes.
const BRANCH_PACING: Record<Mode, Pacing> = {
  accurate: { travel: 0.34, fade: 0.55 },
  illustrative: { travel: 0.62, fade: 0.75 },
};

// quintic accel/decel — very fluid, no abrupt starts/stops (used for both modes)
const smootherstep = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);

// Gentle, mostly-linear ease-out used for the CARD FILL specifically (pie ring,
// progress-bar-inside, progress-pill, progress-bg, and the goal line top-out).
// The old fill easing (a symmetric easeInOut) had too pronounced an accel+decel; this has NO
// initial acceleration and only a mild deceleration, so the bar climbs promptly
// and settles softly. `pow 1.5` sits between linear and easeOutQuad.
const easeFill = (x: number) => 1 - Math.pow(1 - clamp(x), 1.5);

// How long ONE income event's contribution to a card's fill eases in, in
// simulated months, PER MODE. This is deliberately LONGER than the ~0.5-month
// income cadence (illustrative especially) so that consecutive events' ramps
// OVERLAP in time: a previous event is still easing up the balance when the next
// event's rise begins, producing a gentle, near-continuous climb instead of a
// fast growth-spurt-then-freeze per event. progressAt accumulates one eased ramp
// per event over this window (see progressAt); buildChart's goal/line top-out and
// arrivalOffset use the SAME span, so the reached-check still lands exactly when
// the fill visually completes (the last event's ramp finishing at t + this span).
const FILL_SPAN_BY_MODE: Record<Mode, number> = {
  accurate: 0.24,
  illustrative: 0.68,
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
export function branchFlow(dataset: Dataset, mode: Mode, now: number, branchId: string): Flow[] {
  const sc = getScenario(dataset, mode);
  const events = sc.eventActive;
  const pace = BRANCH_PACING[mode];
  const meta = BRANCH_TIMING[branchId] ?? { gateDepth: 0, kind: 'arm' as BranchKind };
  const spine = SPINE_TRAVEL_BY_MODE[mode];
  const dep = meta.gateDepth * spine; // departs when its gate is reached (near-instant)
  const tr = meta.kind === 'spine' ? spine : pace.travel; // spine zips; arm is paced
  const out: Flow[] = [];
  for (const t of sc.income) {
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

export function isReached(dataset: Dataset, mode: Mode, id: string, now: number): boolean {
  const s = getScenario(dataset, mode).series[id];
  if (!s) return false;
  // a goal only reads as "reached" once the flow has actually arrived at it
  return valueAt(s, now - arrivalOffset(mode, id)) >= 0.999;
}

/* Current fill fraction (0..1) of a series — drives the progress bars (inside /
   background), pie-chart rings, and progress pill. The raw series is a step
   function (income lands in discrete chunks), which on its own would make the
   fill jump. Rather than easing only the single latest step and then holding
   flat until the next event (a fast spurt, then a dead pause), we ACCUMULATE one
   smooth eased ramp PER income event: every upward step contributes its delta
   eased in over FILL_SPAN. Because FILL_SPAN is longer than the ~0.5-month income
   cadence, successive events' ramps OVERLAP — the rise from the previous event is
   still climbing when the next event's rise begins — so the balance creeps up
   continuously with no flat spots. The sum reaches the series' current value when
   the last event's ramp finishes (t_last + FILL_SPAN), so isReached / the
   reached-check (which fire at arrivalOffset = fillOffset + FILL_SPAN) still land
   exactly when the fill visually tops out. Downward steps (account drains, which
   only exist in the accurate expense series) apply instantly so the sawtooth
   stays crisp — matching buildChart. */
export function progressAt(dataset: Dataset, mode: Mode, id: string, now: number): number {
  const s = getScenario(dataset, mode).series[id];
  if (!s || s.length === 0) return 0;
  // fill only starts once the incoming arm comet ARRIVES at the card (fillOffset
  // includes the full arm travel) — nothing accumulates before that.
  const eff = now - fillOffset(mode, id);
  const span = FILL_SPAN_BY_MODE[mode]; // per-event ramp; overlaps the next event
  let p = s[0].v;
  for (let i = 1; i < s.length; i++) {
    if (s[i].t > eff + 1e-9) break;
    const delta = s[i].v - s[i - 1].v;
    // upward (income/fill) steps ease in gradually over `span` so consecutive
    // events overlap into a continuous climb; downward steps land instantly.
    p += delta > 0 ? delta * easeFill((eff - s[i].t) / span) : delta;
  }
  return clamp(p);
}

/* Which section node holds which goal-card SLOTS, and the percent badges that
   belong to each. Fixed by the on-screen layout (identical across datasets): the
   1st gate feeds ef1; the 2nd gate feeds debt + ef6. Only the goal LEVELS behind
   those slots differ per dataset (which is what drives greying). */
const SECTION_CHILDREN_BY_DATASET: Record<Dataset, Record<string, string[]>> = {
  simple: {
    goals1: ['ef1'],
    goals2: ['debt', 'ef6'],
  },
  // Optimizer adds the 3rd gate (travel + brokerage); the 1st/2nd gates are
  // unchanged. The deepest gate (goals3) is terminal, so it never greys.
  optimizer: {
    goals1: ['ef1'],
    goals2: ['debt', 'ef6'],
    goals3: ['travel', 'brokerage'],
  },
};
const SECTION_BADGES_BY_DATASET: Record<Dataset, Record<string, string[]>> = {
  simple: {
    goals1: ['p100'],
    goals2: ['p70b', 'p30b'],
  },
  optimizer: {
    goals1: ['p100'],
    goals2: ['p70b', 'p30b'],
    goals3: ['p100c', 'p100d'],
  },
};

/* A gate/section node greys once ALL of its child goal cards are reached AND it
   is NOT the deepest gate (the flow terminates at the deepest gate, so it stays
   lit). This is dataset-aware: for Optimizer the 2nd gate holds a level-2 (6-Mo
   EF) AND a level-3 (House) goal, so it's the deepest gate and never greys —
   greying would need BOTH reached anyway. Only its child CARDS keep their funded
   look; the illustrative model never greys nodes. */
export function dimmedNodes(dataset: Dataset, mode: Mode, now: number): Set<string> {
  const dimmed = new Set<string>();
  if (mode === 'illustrative') return dimmed;
  const sc = getScenario(dataset, mode);
  const maxLevel = Math.max(...sc.levels);
  const sectionChildren = SECTION_CHILDREN_BY_DATASET[dataset];
  const sectionBadges = SECTION_BADGES_BY_DATASET[dataset];
  for (const nodeId of Object.keys(sectionChildren)) {
    const childGoals = sc.goals.filter((g) => sectionChildren[nodeId].includes(g.id));
    if (childGoals.length === 0) continue;
    // the gate that contains the deepest goal is terminal — it never greys
    if (Math.max(...childGoals.map((g) => g.level)) >= maxLevel) continue;
    // grey only once EVERY child card of this gate has been reached
    if (childGoals.every((g) => isReached(dataset, mode, g.id, now))) {
      dimmed.add(nodeId);
      sectionBadges[nodeId]?.forEach((b) => dimmed.add(b));
    }
  }
  return dimmed;
}

/* ---------- per-(dataset, mode) animation duration ----------
   The sim ends when every on-screen goal is funded, plus a short settle so the
   final in-flight branch cascade drains, then the last frame is held (Restart).
   Illustrative funds its goals in a handful of months; accurate takes longer.
   Both then freeze — no more firing toward an off-page gate. */

// simulated month at which the LAST on-screen goal reaches 100%.
export function goalsFundedMonth(dataset: Dataset, mode: Mode): number {
  const sc = getScenario(dataset, mode);
  let latest = 0;
  for (const g of sc.goals) {
    const s = sc.series[g.id];
    let ft = sc.totalMonths;
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
// (gate*SPINE + travel), then eases over FILL_SPAN, completing at arrivalOffset;
// then the branch colour fades out — so the freeze must wait for all of that.
function settleMonths(dataset: Dataset, mode: Mode): number {
  const sc = getScenario(dataset, mode);
  const p = BRANCH_PACING[mode];
  // deepest goal's fill completes at arrivalOffset = gate reach + arm travel +
  // FILL_SPAN; the branch colour then fades — the freeze waits for all of that.
  // (The comet itself arrives one FILL_SPAN earlier and fades over `fade`, which
  // this comfortably covers.)
  const deepestArrival = Math.max(...sc.goals.map((g) => arrivalOffset(mode, g.id)));
  return deepestArrival + p.fade + 0.6;
}

// total simulated months before the frame freezes (per dataset + mode)
export function animMonths(dataset: Dataset, mode: Mode): number {
  return goalsFundedMonth(dataset, mode) + settleMonths(dataset, mode);
}

// wall-clock seconds for the whole run (per dataset + mode)
export const endSecs = (dataset: Dataset, mode: Mode) => animMonths(dataset, mode) * MONTH_SECS_BY_MODE[mode];

// simulated month of the FIRST income event (income[0], = 0.5). Used by the
// stocks/heart-monitor cards to gate their solid data line/fill/highlight so
// nothing but the dotted baseline shows during the pre-first-income idle period.
export const firstIncomeMonth = (dataset: Dataset, mode: Mode) => getScenario(dataset, mode).income[0];
