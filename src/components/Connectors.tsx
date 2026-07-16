import { useLayoutEffect, useRef, useState, type ReactElement } from 'react';
import { Check } from 'lucide-react';
import { connectorsFor, connectorsCompactFor, connectorsMoneyMapFor, connectorsSkinnyFor, connectorsIconFor, connectorsIconLabeledFor, connectorsConvoFor, connectorsV1For, connectorsCondensedFor, connectorsSheetFor, connectorsIlloFor, connectorsProgressFor, type BranchStyle, type Connector, type MapStyle } from '../data';
import { animMonths, branchFlow, firstIncomeMonth, isReached, progressAt, sheetGrowWindows, type Dataset, type Mode } from '../scenario';

// "Today's money map" — thick pastel ropes keyed by destination branch
const MM_ROPE = (id: string): string =>
  id === 'c-income-monthly' ? '#F6DC72'
  : id === 'c-monthly-core' ? '#B0D9FF'
  : id === 'c-monthly-spend' ? '#61BC76'
  : '#EEBED4'; // goal fan-outs + spine

// money-map idle pipe colour (neutral gray, per Figma node 432:5177)
const MM_IDLE = '#B0B0B0';

// "Progress pill" account style ONLY: the income pill is lowered but kept ABOVE
// the Core card (see Card.tsx PILL_INCOME_POS), left-anchored near the spine. Its
// rope to the gate is a STRAIGHT vertical drop down the left side (x=49, aligned to
// the money-map spine) into the spine top — so it never crosses the Core/Spend
// cards or their gray wishbone arms (which sit on the right). The drop starts a
// little BELOW the income pill (a small gap, not flush with the pill). Dataset-aware
// endpoint, though Optimizer now shares Simple's rows so both drop to the same
// money-map monthly spine top (49,322). Replaces the long shared money-map income
// S-curve for this style.
const PILL_INCOME_CONN: Record<Dataset, string> = {
  simple: 'M49 210 L 49 322', // gap below income pill (~y210) -> straight down to spine top 322
  optimizer: 'M49 210 L 49 322', // Optimizer shares Simple's layout -> same drop
};

interface FlowBranch {
  id: string;
  color: string;
  d: string;
}

const YELLOW = '#efc63e';
const BLUE = '#49c7ef';
const GREEN = '#37d67a';
const PINK = '#ff2d8e';

// branch id -> comet colour; `d` is resolved per branch style. Per-branch timing
// (spine vs arm, near-instant gate handoff) now lives in scenario's branchFlow.
const FLOW_META: { id: string; color: string }[] = [
  { id: 'c-income-monthly', color: YELLOW },
  { id: 'c-monthly-core', color: BLUE },
  { id: 'c-monthly-spend', color: GREEN },
  { id: 'c-monthly-goals1', color: PINK },
  { id: 'c-goals1-ef1', color: PINK },
  { id: 'c-goals1-goals2', color: PINK },
  { id: 'c-goals2-debt', color: PINK },
  { id: 'c-goals2-ef6', color: PINK },
  // spine continuing off the bottom edge toward the off-page 3rd-level goal gate
  { id: 'c-goals2-down', color: PINK },
  // Optimizer 3rd gate: extra spine hop (goals2 -> goals3) + the two deepest goal
  // arms, plus the off-page continuation past the 3rd gate. (Simple never lights
  // these — its scenario emits no such events — so they stay dark for Simple.)
  { id: 'c-goals2-goals3', color: PINK },
  { id: 'c-goals3-travel', color: PINK },
  { id: 'c-goals3-brokerage', color: PINK },
  { id: 'c-goals3-down', color: PINK },
];

// Each income event travels as a SHORT fixed-length pulse (a fraction of the
// branch), not a full-length wash — so several in-flight events read as separate
// pulses moving down the same pipe. `pulseDash` returns a [band, gap] dash where
// the gap is longer than the path (only ONE band ever shows) and the offset moves
// the band from just-before the source (p=0) to just-past the destination (p=1).
const BAND_FRAC = 0.5; // pulse length as a fraction of the branch length
const MIN_BAND = 22; // px floor so short goal arms still show a visible pulse
function pulseDash(len: number, p: number): { dashArray: string; dashOffset: number } {
  const band = Math.max(MIN_BAND, len * BAND_FRAC);
  return {
    dashArray: `${band.toFixed(2)} ${(len + band).toFixed(2)}`,
    dashOffset: band - p * (len + band),
  };
}

/* Layered strokes give the travelling pulse a soft glow -> bright core look.
   [stroke width, base opacity] */
const FILL_LAYERS: [number, number][] = [
  [7, 0.16], // soft outer glow
  [4, 0.5], // mid body
  [2.6, 0.95], // bright core
];

// Each fan-out ARM connector -> the card it feeds. Once that card is fully
// funded/decommissioned, a small check badge appears ON the arm (per Figma
// 496-5733). Spine segments are intentionally absent (no badge on the trunk).
const ARM_CARD: Record<string, string> = {
  'c-monthly-core': 'core',
  'c-monthly-spend': 'spend',
  'c-goals1-ef1': 'ef1',
  'c-goals2-debt': 'debt',
  'c-goals2-ef6': 'ef6',
  // Optimizer 3rd-gate arms (only present in the Optimizer connector sets)
  'c-goals3-travel': 'travel',
  'c-goals3-brokerage': 'brokerage',
};

// a branch's card counts as "filled/decommissioned" when: goals have been reached
// (arrival-aware), and the Core/Spend expense accounts have topped out (>= ~100%).
function cardDone(dataset: Dataset, mode: Mode, cardId: string, now: number): boolean {
  if (cardId === 'core' || cardId === 'spend') return progressAt(dataset, mode, cardId, now) >= 0.999;
  return isReached(dataset, mode, cardId, now);
}

// decommissioned-branch check badge (Figma 496-5733): a borderless disc whose
// fill MATCHES the idle branch colour it sits on (so it disappears into the rope
// and only the black check reads, cleanly breaking the branch). Thick money-map/
// text-only ropes are MM_IDLE (#B0B0B0); the thin flow/compact skeleton is
// var(--connector). Sits at the arm's ~midpoint.
const BADGE_R = 11; // ~22px diameter

export default function Connectors({
  now,
  mode,
  dataset,
  branch = 'standard',
  map = 'flow',
  v1 = false,
  condensed = false,
  pillIncome = false,
  iconTree = false,
  convoTree = false,
  sheetTree = false,
  illoTree = false,
  pbiTree = false,
}: {
  now: number;
  mode: Mode;
  dataset: Dataset;
  branch?: BranchStyle;
  map?: MapStyle;
  v1?: boolean; // stocks "Version" V1 sub-variant: thin spine + braces geometry
  condensed?: boolean; // stocks "Version" Condensed: same treatment, tighter rows
  pillIncome?: boolean; // "Progress pill" style: use the SHORT lowered-income rope
  iconTree?: boolean; // "Minimalist icons" style: use the icon-row thin tree set
  convoTree?: boolean; // "Conversational" style: use the convo-card thin tree set
  sheetTree?: boolean; // "Sheet" style: use the grouped-panel wishbone tree set
  illoTree?: boolean; // "Illustrated" style: 4px progress-track spine + branch->bar fill
  pbiTree?: boolean; // "Progress bar, inside" style: thin gray spine + curvy arms
}) {
  // Gate-style precedence (a gate choice can OVERRIDE the visual identity):
  //   compact     -> skinny-arrow connectors + % badges, REGARDLESS of identity
  //   text-only   -> money-map brace ropes (plain-text gates), no % badges
  //   skinny-line -> the super-thin slim tree (only used with the slim card)
  //   otherwise   -> map-based (money-map ropes vs. modern flow skeleton)
  const isCompact = branch === 'compact';
  const isSkinny = branch === 'skinny-line';
  // "Labeled" icon gate (Figma 738:7107): a labeled left spine + straight thin
  // brackets (same clean vocabulary as the "Bracket" icon gate) + a straight gray
  // income drop. Rendered by the SAME thin-tree renderer as skinny/icons, with its
  // own connector set (spine at x=49 + on-spine gate-label pills).
  const isIconLabeled = branch === 'icon-labeled';
  const thinTree = isSkinny || isIconLabeled;
  // colored money-map ropes: the "text only" gate always uses them, and the
  // money-map identity uses them UNLESS a gate style (compact/skinny) overrides.
  // the "sheet" style is self-contained (its own wishbone tree), so it never
  // uses the money ropes even though it keeps the default 'text-only' branch.
  const money = !sheetTree && !isCompact && !thinTree && (branch === 'text-only' || map === 'money-map');
  // active connector set. compact takes precedence over money-map so "Lines with
  // %" always shows its skinny arrows; skinny-line uses its own thin tree.
  // dataset-aware geometry: each set has a Simple and an Optimizer variant (the
  // Optimizer adds a 3rd goal gate on a compact rhythm). Simple returns its exact
  // original arrays.
  const baseConns: Connector[] = pbiTree
    ? connectorsProgressFor(dataset)
    : illoTree
    ? connectorsIlloFor(dataset)
    : sheetTree
    ? connectorsSheetFor(dataset)
    : condensed
    ? connectorsCondensedFor(dataset)
    : v1
      ? connectorsV1For(dataset)
      : isIconLabeled
        ? connectorsIconLabeledFor(dataset)
        : isSkinny
          ? iconTree
            ? connectorsIconFor(dataset)
            : convoTree
              ? connectorsConvoFor(dataset)
              : connectorsSkinnyFor(dataset)
          : money
            ? connectorsMoneyMapFor(dataset)
            : isCompact
              ? connectorsCompactFor(dataset)
              : connectorsFor(dataset);
  // "Progress pill" style: swap in the SHORT lowered-income rope for
  // c-income-monthly (base rope, length-probe, AND sweep all read from `conns`,
  // so geometry + measurement + animation stay in sync). Dataset-aware endpoint
  // matches each layout's spine top. Every other connector and every other style
  // is untouched.
  const conns: Connector[] = pillIncome
    ? baseConns.map((c) => (c.id === 'c-income-monthly' ? { ...c, d: PILL_INCOME_CONN[dataset] } : c))
    : baseConns;

  // Optimizer's appended 3rd gate extends the spine/braces past the 960px Simple
  // canvas, so the SVG (and its viewBox) grows to match the taller Optimizer board
  // — EXCEPT the compact "icons" tree, whose rows fit the 960px board for both
  // datasets (keeps the SVG matched to the App's compact board height).
  const boardH = dataset === 'optimizer' && !iconTree ? 1200 : 960;

  // Hooks always run (measure path lengths by id for the active set). Keeping
  // them above any early return avoids a Rules-of-Hooks violation when the map /
  // branch style is toggled at runtime.
  const geoRefs = useRef<Record<string, SVGPathElement | null>>({});
  const [lens, setLens] = useState<Record<string, number>>({});
  // arm midpoints (in 402x960 viewBox units) for placing the check badges — the
  // point at 50% of each arm, so a badge stays centered on the shortened arm.
  const [mids, setMids] = useState<Record<string, { x: number; y: number }>>({});
  useLayoutEffect(() => {
    const next: Record<string, number> = {};
    const nextMids: Record<string, { x: number; y: number }> = {};
    for (const c of conns) {
      const el = geoRefs.current[c.id];
      const len = el?.getTotalLength() ?? 0;
      next[c.id] = len;
      if (el && len > 0 && ARM_CARD[c.id]) {
        const pt = el.getPointAtLength(len * 0.5);
        nextMids[c.id] = { x: pt.x, y: pt.y };
      }
    }
    setLens(next);
    setMids(nextMids);
    // conns is derived purely from branch + map + v1 + condensed + dataset
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch, map, v1, condensed, dataset, pillIncome, iconTree, convoTree, sheetTree, illoTree, pbiTree]);

  // check badges on decommissioned (fully funded) branch arms — shared by both
  // the money-map and flow/compact renderers. Rendered last so it sits on top of
  // the pipes/comets. Opacity is CSS-transitioned so a badge fades in exactly when
  // its card finishes filling, and persists (incl. the frozen end frame).
  const checkBadges = Object.entries(ARM_CARD).map(([armId, cardId]) => {
    const m = mids[armId];
    if (!m) return null;
    const done = cardDone(dataset, mode, cardId, now);
    return (
      <g
        key={`chk-${armId}`}
        transform={`translate(${m.x} ${m.y})`}
        style={{ opacity: done ? 1 : 0, transition: 'opacity 0.45s ease' }}
      >
        <circle r={BADGE_R} fill={money ? MM_IDLE : 'var(--connector)'} />
        <Check x={-7} y={-7} width={14} height={14} color="#000" strokeWidth={3} />
      </g>
    );
  });

  // invisible probes to measure the active ropes' lengths
  const probes = conns.map((c) => (
    <path
      key={`geo-${c.id}`}
      ref={(el) => {
        geoRefs.current[c.id] = el;
      }}
      d={c.d}
      fill="none"
      stroke="none"
    />
  ));

  // ---------- progress bar, inside: thin gray spine + soft curvy arms ----------
  // A ~1.25px gray tree (Figma 792:8522): a left spine broken by gaps at each
  // white gate-label pill, with soft cubic-S wishbone arms into each card. Money
  // travels as thin colored pulses (income yellow / core blue / spend green /
  // goals pink), and a light-gray check disc lands on an arm the moment its card
  // finishes funding — mirroring the Figma "checkmark in a disc" badge.
  if (pbiTree) {
    const pbiById = (id: string) => conns.find((c) => c.id === id)?.d;
    const pbiBadges = Object.entries(ARM_CARD).map(([armId, cardId]) => {
      const m = mids[armId];
      if (!m) return null;
      const done = cardDone(dataset, mode, cardId, now);
      return (
        <g
          key={`pbi-chk-${armId}`}
          transform={`translate(${m.x} ${m.y})`}
          style={{ opacity: done ? 1 : 0, transition: 'opacity 0.45s ease' }}
        >
          <circle r={10} fill="#e6e7ea" />
          <Check x={-6.5} y={-6.5} width={13} height={13} color="#111" strokeWidth={2.6} />
        </g>
      );
    });
    return (
      <svg className="connectors" width="402" height={boardH} viewBox={`0 0 402 ${boardH}`} fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* thin static gray tree */}
        {conns.map((c) => (
          <path key={c.id} d={c.d} stroke="var(--connector)" strokeWidth={1.25} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {probes}
        {/* thin colored pulse per in-flight income event */}
        {FLOW_META.map((m) => {
          const d = pbiById(m.id);
          const len = lens[m.id];
          if (!d || !len || len <= 0) return null;
          const flows = branchFlow(dataset, mode, now, m.id);
          return flows.map((f, j) => {
            const { dashArray, dashOffset } = pulseDash(len, f.p);
            return (
              <path
                key={`pbi-${m.id}-${j}`}
                d={d}
                stroke={m.color}
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={f.alpha}
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
              />
            );
          });
        })}
        {pbiBadges}
      </svg>
    );
  }

  // ---------- illustrated: 4px rounded progress-track spine + branch->bar fill ----------
  // A gray (#e2e2e2) rounded track with a yellow (#fbedb8) income segment; the
  // colored fill is a monotonic dash-reveal driven by progressAt so the color
  // TRAVELS each branch (spine yellow->pink; arms core blue / spend green / goals
  // pink) and continues straight into the card's in-card progress bar — the arm +
  // bar behave as one continuous track (see illoSplit). Freezes fully colored.
  if (illoTree) {
    const ILLO_TRACK = '#e2e2e2';
    const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
    const armColor: Record<string, string> = {
      'c-monthly-core': BLUE,
      'c-monthly-spend': GREEN,
      'c-goals1-ef1': PINK,
      'c-goals2-debt': PINK,
      'c-goals2-ef6': PINK,
      'c-goals3-travel': PINK,
      'c-goals3-brokerage': PINK,
    };
    const T_INCOME = firstIncomeMonth(dataset, mode); // first income flows (~0.5mo)
    /* WATERFALL gate: the surplus wave (into the goals) must not pass the monthly
       gate until BOTH Core AND Spend are 100% funded. We find that release month by
       a monotonic binary search on cardDone(core) && cardDone(spend) (both progress
       curves are non-decreasing, so the predicate flips once and stays true), and
       back-solve wave 2's income entrance so its head lands on the monthly gate at
       exactly that moment (seamless hand-off — see the wave block below). */
    const releaseMonth = (): number => {
      const bothDone = (t: number) =>
        cardDone(dataset, mode, 'core', t) && cardDone(dataset, mode, 'spend', t);
      let hi = animMonths(dataset, mode);
      if (!bothDone(hi)) return Infinity; // never funds -> spine never releases
      let lo = 0;
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (bothDone(mid)) hi = mid;
        else lo = mid;
      }
      return hi;
    };
    const T_MONTHLY_DONE = releaseMonth();

    /* STRICT causal gate on the goal spine hand-offs (illo-only): a goal-gate's
       DESCENDING spine segment (and everything below it) must NOT begin flowing
       until the PREVIOUS goal level is TOTALLY filled AND its completion check
       has landed — the exact same cardDone/isReached source the on-arm check
       badge uses (so the branch unlock and the check appear together). We
       binary-search the month a gate's child cards are all done (each fill curve
       is non-decreasing, so cardDone flips once and stays true), mirroring
       releaseMonth. Per-gate (not one-off) so it generalizes to the Optimizer's
       2nd->3rd hop. Cards a dataset lacks resolve to Infinity, which just holds
       that (non-existent) segment gray — harmless. */
    const GATE_CARDS: Record<string, string[]> = {
      goals1: ['ef1'],
      goals2: ['debt', 'ef6'],
    };
    const gateDoneMonth = (cardIds: string[]): number => {
      const allDone = (t: number) => cardIds.every((c) => cardDone(dataset, mode, c, t));
      const hiCap = animMonths(dataset, mode);
      if (cardIds.length === 0 || !allDone(hiCap)) return Infinity;
      let lo = 0;
      let hi = hiCap;
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (allDone(mid)) hi = mid;
        else lo = mid;
      }
      return hi;
    };
    const T_GOAL1_DONE = gateDoneMonth(GATE_CARDS.goals1); // 1st goal fully filled + checked
    const T_GOAL2_DONE = gateDoneMonth(GATE_CARDS.goals2); // 2nd goal(s) fully filled + checked

    // per-branch flow colour: income/top-spine YELLOW, trunk hops PINK, arms by card
    const spineHops = new Set(['c-monthly-goals1', 'c-goals1-goals2', 'c-goals2-goals3']);
    const colorOf = (id: string): string =>
      id === 'c-income-monthly' ? YELLOW : spineHops.has(id) ? PINK : armColor[id] ?? PINK;
    const dOf: Record<string, string> = Object.fromEntries(conns.map((c) => [c.id, c.d]));

    /* ---- TWO long travelling WAVES of income (illo-local; other styles untouched) --
       The income arrives as TWO paycheque WAVES over the run. Each wave is a LONG
       luminous band (per-node colour) that sweeps a pipe from entrance to exit with a
       bright leading edge and a fading trailing tail; once the tail passes, the pipe
       drains back to the gray track (nothing lingers). Because the band is only ever
       a moving window, every pipe ends GRAY — the card bars / illustrations / checks
       (owned by IlloCard) keep their funded colour, unchanged.

       Constant-speed, geometry-timed head: a head travels SPEED viewBox-px per month,
       so a branch of measured length `len` is entered at `tIn` and fully drained by
       tIn + (len + band)/SPEED. Entrance times CHAIN down the tree (a child branch is
       entered exactly as the parent head reaches the shared gate) — that keeps the
       motion smooth/continuous and preserves causal order:
         wave 1  income -> monthly gate -> Core & Spend arms.
         wave 2  income -> (reaches the monthly gate the instant Core+Spend are 100%
                 funded) -> down the spine into the goal gates, in order, each goal
                 arm firing only as the head reaches its gate.
       Wave 2's income entrance is back-solved so its head lands on the monthly gate
       exactly at T_MONTHLY_DONE, so the hand-off past the monthly gate into the goals
       is seamless (no stall, no jump). */
    const SPEED = 460; // wave-head speed (viewBox px / month) — long sustained sweep
    const BAND_FRAC = 0.85; // band length as a big fraction of the pipe (a LONG wave)
    const BAND_MIN = 52; // px floor so the short goal arms still read as a band
    const TAIL_STEPS = 8; // sub-segments used to paint the fading trailing edge
    const segLen = (id: string) => lens[id] ?? 0;
    const bandOf = (len: number) => Math.max(BAND_MIN, len * BAND_FRAC);

    // entrance time of every branch for a wave whose income leg enters at `t0`; the
    // spine BELOW the monthly gate is clamped to the Core+Spend release (waterfall).
    const chainTimes = (t0: number): Record<string, number> => {
      const tIn: Record<string, number> = {};
      tIn['c-income-monthly'] = t0;
      const gMonthly = t0 + segLen('c-income-monthly') / SPEED;
      tIn['c-monthly-core'] = gMonthly;
      tIn['c-monthly-spend'] = gMonthly;
      const s1 = Math.max(gMonthly, T_MONTHLY_DONE); // waterfall release into goals
      tIn['c-monthly-goals1'] = s1;
      const gGoals1 = s1 + segLen('c-monthly-goals1') / SPEED;
      tIn['c-goals1-ef1'] = gGoals1; // 1st-goal arm still fires as the head reaches its gate
      // STRICT gate: the goals1 -> goals2 spine hop (and everything below it) can
      // only start once the 1st goal is TOTALLY filled + checked.
      const s2 = Math.max(gGoals1, T_GOAL1_DONE);
      tIn['c-goals1-goals2'] = s2;
      const gGoals2 = s2 + segLen('c-goals1-goals2') / SPEED;
      tIn['c-goals2-debt'] = gGoals2;
      tIn['c-goals2-ef6'] = gGoals2;
      // STRICT gate: the goals2 -> goals3 spine hop (Optimizer only) waits for the
      // 2nd goal level to be TOTALLY filled + checked.
      const s3 = Math.max(gGoals2, T_GOAL2_DONE);
      tIn['c-goals2-goals3'] = s3;
      const gGoals3 = s3 + segLen('c-goals2-goals3') / SPEED;
      tIn['c-goals3-travel'] = gGoals3;
      tIn['c-goals3-brokerage'] = gGoals3;
      return tIn;
    };
    // wave 1 (1st paycheque): funds the monthly section (income + Core/Spend arms)
    const WAVE1 = ['c-income-monthly', 'c-monthly-core', 'c-monthly-spend'];
    // wave 2 (2nd paycheque): sweeps income again, then surplus down into the goals
    const WAVE2 = [
      'c-income-monthly',
      'c-monthly-goals1', 'c-goals1-ef1',
      'c-goals1-goals2', 'c-goals2-debt', 'c-goals2-ef6',
      'c-goals2-goals3', 'c-goals3-travel', 'c-goals3-brokerage',
    ];
    const timesWave1 = chainTimes(T_INCOME);
    const timesWave2 = chainTimes(
      isFinite(T_MONTHLY_DONE) ? T_MONTHLY_DONE - segLen('c-income-monthly') / SPEED : Infinity,
    );

    // one long fading band (bright head -> transparent tail) for `id`, head entered
    // at `tIn`; null before it enters and after it fully drains back to gray.
    const waveBand = (id: string, tIn: number, key: string) => {
      const len = segLen(id);
      const d = dOf[id];
      if (!d || len <= 0 || !isFinite(tIn)) return null;
      const B = bandOf(len);
      const H = (now - tIn) * SPEED; // head position along the pipe (px)
      if (H <= 0 || H - B >= len) return null; // not entered yet / already drained
      const visA = Math.max(0, H - B);
      const visB = Math.min(len, H);
      if (visB - visA <= 0.5) return null;
      const color = colorOf(id);
      const parts: ReactElement[] = [];
      for (let i = 0; i < TAIL_STEPS; i++) {
        const a = visA + ((visB - visA) * i) / TAIL_STEPS;
        const b = visA + ((visB - visA) * (i + 1)) / TAIL_STEPS;
        const op = clamp01(1 - (H - (a + b) / 2) / B); // 1 at the head, ~0 at the tail
        if (op <= 0.02) continue;
        const da = `${(b - a).toFixed(2)} ${(len + B).toFixed(2)}`;
        const off = (-a).toFixed(2);
        parts.push(
          <path key={`g-${i}`} d={d} stroke={color} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={op * 0.16} strokeDasharray={da} strokeDashoffset={off} />,
        );
        parts.push(
          <path key={`c-${i}`} d={d} stroke={color} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={op} strokeDasharray={da} strokeDashoffset={off} />,
        );
      }
      return parts.length ? <g key={key}>{parts}</g> : null;
    };

    return (
      <svg className="connectors" width="402" height={boardH} viewBox={`0 0 402 ${boardH}`} fill="none" xmlns="http://www.w3.org/2000/svg">
        {probes}
        {/* permanent gray tracks — every pipe rests gray; the waves light it transiently */}
        {conns.map((c) => (
          <path key={`trk-${c.id}`} d={c.d} stroke={ILLO_TRACK} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {/* wave 1 then wave 2 — long fading bands that sweep each pipe and drain to gray */}
        {WAVE1.map((id) => waveBand(id, timesWave1[id], `w1-${id}`))}
        {WAVE2.map((id) => waveBand(id, timesWave2[id], `w2-${id}`))}
      </svg>
    );
  }

  // ---------- stocks V1 / Condensed: thin gray spine + braces + pink accents + colored pulses ----------
  // A clean 1.5px gray tree (Figma 519:6283 / 522:6440) with the branch-flow events
  // travelling as thin colored pulses (income yellow / core blue / spend green /
  // goals pink). No arrowheads, glow, or check badges (a minimal thin tree). V1
  // and Condensed share this renderer; only the `conns` set differs.
  if (v1 || condensed) {
    const v1ById = (id: string) => conns.find((c) => c.id === id)?.d;
    return (
      <svg className="connectors" width="402" height={boardH} viewBox={`0 0 402 ${boardH}`} fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* thin static gray tree */}
        {conns.map((c) => (
          <path key={c.id} d={c.d} stroke="var(--connector)" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {probes}
        {/* thin colored pulse per in-flight event */}
        {FLOW_META.map((m) => {
          const d = v1ById(m.id);
          const len = lens[m.id];
          if (!d || !len || len <= 0) return null;
          const flows = branchFlow(dataset, mode, now, m.id);
          return flows.map((f, j) => {
            const { dashArray, dashOffset } = pulseDash(len, f.p);
            return (
              <path
                key={`v1-${m.id}-${j}`}
                d={d}
                stroke={m.color}
                strokeWidth={3}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={f.alpha}
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
              />
            );
          });
        })}
      </svg>
    );
  }

  // ---------- sheet: near-black orthogonal tree that DRAWS IN progressively ----------
  // The "Sheet" style (Figma 753:7971) ASSEMBLES as it plays: each near-black
  // spine + elbow-arm segment draws on (SVG stroke reveal via dashoffset) over its
  // causal growth window (sheetGrowWindows), so the branch grows from Income down
  // the spine and out each elbow arm in causal order. The black $/% pills and the
  // account/goal cards POP in as the growing tip reaches them (SheetChrome + Card,
  // keyed to sheetRevealMonths). No travelling pulses — the draw-on + pop-in IS
  // the animation, and the fully drawn tree matches the Figma resting look. Kept
  // entirely separate from the other thin trees below so nothing else regresses.
  if (sheetTree) {
    const windows = sheetGrowWindows(dataset, mode);
    const growOf = (id: string): number => {
      const w = windows[id];
      if (!w) return now > 0 ? 1 : 0; // segment a dataset never lights: draw once playing
      const span = Math.max(1e-6, w.end - w.start);
      return Math.max(0, Math.min(1, (now - w.start) / span));
    };
    return (
      <svg className="connectors" width="402" height={boardH} viewBox={`0 0 402 ${boardH}`} fill="none" xmlns="http://www.w3.org/2000/svg">
        {probes}
        {conns.map((c) => {
          const len = lens[c.id];
          const g = growOf(c.id);
          if (!len || len <= 0 || g <= 0.0001) return null;
          return (
            <path
              key={c.id}
              d={c.d}
              stroke="#1a1a1a"
              strokeWidth={1.25}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={`${len.toFixed(2)} ${len.toFixed(2)}`}
              strokeDashoffset={(len * (1 - g)).toFixed(2)}
            />
          );
        })}
      </svg>
    );
  }

  // ---------- skinny line: super-thin static tree + thin travelling pulse ----------
  // A ~1px gray spine + thin elbows to each slim row's name pill. No arrowheads,
  // no rope/glow, and NO check badges (a money-map/standard concept that reads as
  // stray marks on the thin slim tree — Figma 496-5864 shows a clean thin tree).
  // The branch-flow pulse still runs, as a thin (2px) colored dash so causal
  // order stays legible without the heavy comet glow.
  if (thinTree) {
    const skById = (id: string) => conns.find((c) => c.id === id)?.d;
    // icons, slim, AND the "Labeled" icon gate (738:7107) share the clean thin tree
    // stroke (1px tree / 2px pulse) so Labeled's straight brackets read identically
    // to the Bracket gate. The conversational tree (738:7662) keeps the bolder
    // wishbone stroke (1.5px branches). Every branch is GRAY at rest; the causal
    // color only appears as the normal pulse travelling during play.
    const treeW = convoTree ? 1.5 : 1;
    const pulseW = convoTree ? 2.5 : 2;
    const treeStroke = 'var(--connector)';
    return (
      <svg className="connectors" width="402" height={boardH} viewBox={`0 0 402 ${boardH}`} fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* "Minimalist icons" (773:8879): thin arrowheads point into each tile.
            Only the branch ARMS (c.arrow) carry a head — the vertical spine hops
            don't. Sized in user space so it stays a small consistent chevron. */}
        {iconTree && (
          <defs>
            <marker id="icon-arrow" markerWidth="8" markerHeight="8" refX="1" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M1 1 L5 3.5 L1 6" fill="none" stroke={treeStroke} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
          </defs>
        )}
        {/* thin static skeleton (gray for most trees; near-black for the sheet) */}
        {conns.map((c) => (
          <path
            key={c.id}
            d={c.d}
            stroke={treeStroke}
            strokeWidth={treeW}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            markerEnd={iconTree && c.arrow ? 'url(#icon-arrow)' : undefined}
          />
        ))}
        {probes}
        {/* thin colored pulse per in-flight income event (no glow) */}
        {FLOW_META.map((m) => {
          const d = skById(m.id);
          const len = lens[m.id];
          if (!d || !len || len <= 0) return null;
          const flows = branchFlow(dataset, mode, now, m.id);
          return flows.map((f, j) => {
            const { dashArray, dashOffset } = pulseDash(len, f.p);
            return (
              <path
                key={`skinny-${m.id}-${j}`}
                d={d}
                stroke={m.color}
                strokeWidth={pulseW}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={f.alpha}
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
              />
            );
          });
        })}
      </svg>
    );
  }

  // ---------- money map: gray idle pipe + solid single-colour highlight sweep ----------
  // A SHORT band of the branch pastel travels source->dest once per event over a
  // gray idle pipe (no blur/glow/gradient). Because the band is only a fraction of
  // the rope, several in-flight events show up as distinct, separated pulses.
  if (money) {
    return (
      <svg className="connectors" width="402" height={boardH} viewBox={`0 0 402 ${boardH}`} fill="none" xmlns="http://www.w3.org/2000/svg">
        {probes}
        {conns.map((c) => (
          <path key={c.id} d={c.d} stroke={MM_IDLE} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        ))}
        {conns.map((c) => {
          const len = lens[c.id];
          if (!len) return null;
          const flows = branchFlow(dataset, mode, now, c.id);
          return flows.map((f, j) => {
            const { dashArray, dashOffset } = pulseDash(len, f.p);
            return (
              <path
                key={`sweep-${c.id}-${j}`}
                d={c.d}
                stroke={MM_ROPE(c.id)}
                strokeWidth={8}
                strokeLinecap="round"
                fill="none"
                opacity={f.alpha}
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
              />
            );
          });
        })}
        {checkBadges}
      </svg>
    );
  }

  // ---------- flow / compact: gray skeleton + soft travelling gradient comet ----------
  // Only animate branches that EXIST in the active connector set — the 3rd-gate
  // ids in FLOW_META are absent from the Simple sets, so skip them there.
  const FLOW: FlowBranch[] = FLOW_META.flatMap((m) => {
    const c = conns.find((cc) => cc.id === m.id);
    return c ? [{ ...m, d: c.d }] : [];
  });

  return (
    <svg className="connectors" width="402" height={boardH} viewBox={`0 0 402 ${boardH}`} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <marker id="flow-dot" markerWidth="8" markerHeight="8" refX="4" refY="4" markerUnits="userSpaceOnUse">
          <circle cx="4" cy="4" r="2.4" fill="var(--connector)" />
        </marker>
        <marker id="flow-arrow" markerWidth="9" markerHeight="9" refX="4.6" refY="4" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M1 1 L6 4 L1 7" fill="none" stroke="var(--connector)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </marker>
        {/* userSpaceOnUse so the filter region is the whole canvas — an
            objectBoundingBox region collapses to zero width on the perfectly
            vertical trunk paths (monthly->goals1, goals1->goals2) and clips
            their comets to nothing. */}
        <filter id="comet-glow" filterUnits="userSpaceOnUse" x="0" y="0" width="402" height={boardH}>
          <feGaussianBlur stdDeviation="1.7" />
        </filter>
      </defs>

      {/* base gray skeleton */}
      {conns.map((c) => (
        <path
          key={c.id}
          d={c.d}
          stroke="var(--connector)"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
          markerStart="url(#flow-dot)"
          markerEnd="url(#flow-arrow)"
        />
      ))}

      {/* geometry probes (invisible) used to measure length / sample points */}
      {probes}

      {/* a SHORT soft-glow comet travels the branch source->dest per income event.
          Because the coloured band is only a fraction of the pipe, a branch can
          show several distinct, separated pulses at once — one per in-flight
          event — instead of one long continuous fill. */}
      {FLOW.map((b) => {
        const flows = branchFlow(dataset, mode, now, b.id);
        const len = lens[b.id];
        if (!len || len <= 0 || flows.length === 0) return null;
        return flows.map((f, j) => {
          const { dashArray, dashOffset } = pulseDash(len, f.p);
          return (
            <g key={`comet-${b.id}-${j}`} style={{ mixBlendMode: 'multiply' }} filter="url(#comet-glow)">
              {FILL_LAYERS.map(([w, op], k) => (
                <path
                  key={k}
                  d={b.d}
                  stroke={b.color}
                  strokeWidth={w}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={op * f.alpha}
                  strokeDasharray={dashArray}
                  strokeDashoffset={dashOffset}
                />
              ))}
            </g>
          );
        });
      })}
      {checkBadges}
    </svg>
  );
}
