import { useLayoutEffect, useRef, useState, type ReactElement } from 'react';
import { Check, Lock, LockOpen } from 'lucide-react';
import { connectorsFor, connectorsCompactFor, connectorsMoneyMapFor, connectorsSkinnyFor, connectorsIconFor, connectorsIconLabeledFor, connectorsConvoFor, connectorsV1For, connectorsCondensedFor, connectorsSheetFor, connectorsIlloFor, connectorsProgressFor, connectorsProgressLockedFor, connectorsProgressGroupedFor, connectorsProgressGrouped2For, connectorsProgressIndentedFor, pbiIndentedPillsFor, PBI_INDENTED_PILL_X, pbiLockDiscsFor, pbiGroupedLockDiscsFor, pbiGrouped2LockDiscsFor, PBI_LOCK_SPINE_X, PBI_GROUPED_SPINE_X, PBI_GROUPED2_RISER_X, connectorsPotsFor, connectorsGridFor, gridValuePillsFor, sheetRevealStyle, badgesFor, type BranchStyle, type Connector, type MapStyle } from '../data';
import { animMonths, branchFlow, firstIncomeMonth, isReached, progressAt, sheetGrowWindows, spineTravelMonths, type Dataset, type Mode } from '../scenario';

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
  potsTree = false,
  gridTree = false,
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
  potsTree?: boolean; // "Pots" style: thin gray spine + curvy arms + check discs (mirrors pbi)
  gridTree?: boolean; // "Grid" style: black spine + black square-corner branches + black value pills
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
  // "Locked path": bold white spine + heavy white curvy branches + animated
  // padlock discs (Figma 802:10378). pbi-scoped, so it's offered only for pbi.
  const isPbiLocked = pbiTree && branch === 'pbi-locked';
  // "Grouped": thin light spine + white curvy branches + padlock discs + colored
  // section panels behind the cards (Figma 802:10601). pbi-scoped.
  // "Sections incl. income" (Figma 977:10048) renders the SAME white tree as "In
  // sections" — it only adds a yellow Income panel (drawn by PbiIncomeSectionPanels).
  const isPbiGrouped = pbiTree && (branch === 'pbi-grouped' || branch === 'pbi-income-section');
  // "Grouped 2": gray section panels + offset-riser branch routing (Figma 802:10838).
  const isPbiGrouped2 = pbiTree && branch === 'pbi-grouped2';
  // "Section plus label" (Figma 977:10830): the "In sections" teal/pink panels + white
  // tree, PLUS the % allocation pills on the arms and a circle (not a text pill) for
  // the Monthly gate. Uses the DEFAULT pbi connector geometry (like In sections).
  const isPbiSectionLabel = pbiTree && branch === 'pbi-sectionlabel';
  // "Indented" (Figma 886:12513): far-left spine + indented risers + amount pills.
  const isPbiIndented = pbiTree && branch === 'pbi-indented';
  const baseConns: Connector[] = gridTree
    ? connectorsGridFor(dataset)
    : potsTree
    ? connectorsPotsFor(dataset)
    : pbiTree
    ? (isPbiLocked ? connectorsProgressLockedFor(dataset) : isPbiGrouped2 ? connectorsProgressGrouped2For(dataset) : isPbiIndented ? connectorsProgressIndentedFor(dataset) : connectorsProgressFor(dataset))
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
  }, [branch, map, v1, condensed, dataset, pillIncome, iconTree, convoTree, sheetTree, illoTree, pbiTree, potsTree, gridTree]);

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

  // ---------- grid: black spine + black square-corner branches + black value pills ----------
  // A schematic black-line tree on the faint graph-paper board (the grid
  // background is board-level chrome — see App). One thin BLACK vertical spine, a
  // plain horizontal stub into each individually-branched card (Core / Spend / 1st
  // goal), and a square-cornered WISHBONE per grouped goal pair. BLACK rounded-pill
  // labels with WHITE value text sit at the individual junctions. STATIC (no
  // travelling pulses) — cards are stand-ins. Gated strictly to the grid style so
  // nothing else can render this tree. Square corners: butt caps + miter joins.
  if (gridTree) {
    const pills = gridValuePillsFor(dataset);
    // Reveal like the Sheet: the grid ASSEMBLES as it plays. Each spine/branch
    // segment DRAWS ON (stroke dashoffset reveal) over a causal grow window taken
    // from the shared income-driven timing (sheetGrowWindows), and the value pills
    // POP in the instant the growing tip reaches their junction. Same causal order
    // the sheet uses: spine down → monthly bracket + Core/Spend arms → 1st goal →
    // lower spine → goal pairs. The grid cards + income marker pop in Card.tsx.
    const sw = sheetGrowWindows(dataset, mode);
    const s = (id: string) => sw[id]?.start;
    const e = (id: string) => sw[id]?.end;
    const isOpt = dataset === 'optimizer';
    // composite grid connectors map to a [start,end] window from representative
    // causal segments (grid ids aren't in the standard BRANCH_TIMING set).
    const gwin: Record<string, { start: number; end: number }> = {
      'grid-spine': { start: s('c-income-monthly') ?? 0, end: e('c-monthly-goals1') ?? e('c-monthly-core') ?? 0 },
      'grid-monthly': { start: s('c-monthly-core') ?? 0, end: e('c-monthly-core') ?? 0 },
      'grid-core': { start: s('c-monthly-core') ?? 0, end: e('c-monthly-core') ?? 0 },
      'grid-spend': { start: s('c-monthly-spend') ?? 0, end: e('c-monthly-spend') ?? 0 },
      'grid-ef1': { start: s('c-goals1-ef1') ?? 0, end: e('c-goals1-ef1') ?? 0 },
      'grid-lower-spine': { start: s('c-goals1-goals2') ?? 0, end: (isOpt ? e('c-goals2-goals3') : e('c-goals1-goals2')) ?? 0 },
      'grid-goals2': { start: s('c-goals2-debt') ?? 0, end: e('c-goals2-ef6') ?? 0 },
      'grid-goals3': { start: s('c-goals3-travel') ?? 0, end: e('c-goals3-brokerage') ?? 0 },
    };
    const growOf = (id: string): number => {
      const w = gwin[id];
      if (!w) return now > 0 ? 1 : 0;
      const span = Math.max(1e-6, w.end - w.start);
      return Math.max(0, Math.min(1, (now - w.start) / span));
    };
    // a value pill reveals when the tip reaches its junction (= the row arm start)
    const pillReveal: Record<string, number> = {
      core: gwin['grid-core'].start,
      spend: gwin['grid-spend'].start,
      ef1: gwin['grid-ef1'].start,
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
              stroke="#c3c6cc"
              strokeWidth={1.5}
              fill="none"
              strokeLinecap="butt"
              strokeLinejoin="miter"
              strokeDasharray={`${len.toFixed(2)} ${len.toFixed(2)}`}
              strokeDashoffset={(len * (1 - g)).toFixed(2)}
            />
          );
        })}
        {pills.map((p) => {
          const rs = sheetRevealStyle(now, pillReveal[p.id] ?? 0);
          return (
            <foreignObject key={`grid-pill-${p.id}`} x={p.x} y={p.y - 12} width={160} height={24} style={{ overflow: 'visible' }}>
              <span className="grid-pill" style={{ opacity: rs.opacity, transform: `scale(${rs.scale})` }}>{p.text}</span>
            </foreignObject>
          );
        })}
      </svg>
    );
  }

  // ---------- progress bar, inside: thin gray spine + soft curvy arms ----------
  // A ~1.25px gray tree (Figma 792:8522): a left spine broken by gaps at each
  // white gate-label pill, with soft cubic-S wishbone arms into each card. Money
  // travels as thin colored pulses (income yellow / core blue / spend green /
  // goals pink), and a light-gray check disc lands on an arm the moment its card
  // finishes funding — mirroring the Figma "checkmark in a disc" badge.
  // ---------- pots: thin gray spine + soft curvy arms + landing check discs ----------
  // Same clean tree family as the pbi tree (Figma 802:9336): a left spine broken by
  // gaps at each white gate-label pill, soft cubic-S wishbone arms into each pot,
  // thin colored pulses (income yellow / core blue / spend green / goals pink), and
  // a light-gray check disc that lands on an arm the instant its pot finishes
  // funding (= plants span the pot's full width).
  if (potsTree) {
    const potById = (id: string) => conns.find((c) => c.id === id)?.d;
    // "Lines with %" (compact) gate for pots: each goal/account arm's percentage
    // pill sits EXACTLY at the check-disc location (the arm midpoint = `mids`),
    // and a small check disc appears NEXT TO the pill the instant its card funds.
    // The percentages reuse the same values every other style's % badges use
    // (badgesFor), mapped from each arm to its badge id.
    const POT_PCT_BADGE: Record<string, string> = {
      'c-monthly-core': 'p70a',
      'c-monthly-spend': 'p30a',
      'c-goals1-ef1': 'p100',
      'c-goals2-debt': 'p70b',
      'c-goals2-ef6': 'p30b',
      'c-goals3-travel': 'p100c',
      'c-goals3-brokerage': 'p100d',
    };
    const pctText: Record<string, string> = Object.fromEntries(badgesFor(dataset).map((b) => [b.id, b.text]));
    const potBadges = Object.entries(ARM_CARD).map(([armId, cardId]) => {
      const m = mids[armId];
      if (!m) return null;
      const done = cardDone(dataset, mode, cardId, now);
      if (isCompact) {
        const txt = pctText[POT_PCT_BADGE[armId]];
        if (!txt) return null;
        return (
          <foreignObject key={`pot-pct-${armId}`} x={m.x - 48} y={m.y - 12} width={96} height={24} style={{ overflow: 'visible' }}>
            <div className="pot-pct-wrap">
              <span className="pct-badge pot-pct">{txt}</span>
              <span className={`pot-pct-check${done ? ' done' : ''}`}>
                <Check width={11} height={11} color="#111" strokeWidth={2.8} />
              </span>
            </div>
          </foreignObject>
        );
      }
      return (
        <g
          key={`pot-chk-${armId}`}
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
        {conns.map((c) => (
          <path key={c.id} d={c.d} stroke="var(--connector)" strokeWidth={1.25} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {probes}
        {FLOW_META.map((m) => {
          const d = potById(m.id);
          const len = lens[m.id];
          if (!d || !len || len <= 0) return null;
          const flows = branchFlow(dataset, mode, now, m.id);
          return flows.map((f, j) => {
            const { dashArray, dashOffset } = pulseDash(len, f.p);
            return (
              <path
                key={`pot-${m.id}-${j}`}
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
        {potBadges}
      </svg>
    );
  }

  /* STRICT sequential gate shared by ALL "Progress bar, inside" gate styles: a
     branch that flows into the NEXT section must not fire until EVERY card in the
     current section has its progress bar 100% full (cardDone). We binary-search
     the month each section completes (fill curves are non-decreasing, so cardDone
     flips once and stays true) and floor each downstream branch's pulse departure
     at it — spine hops release at the section-done month, card arms one near-instant
     spine hop later. Sections a dataset lacks resolve to Infinity (branch stays
     gray), which is harmless. Computed once here, used by every pbi renderer. */
  const pbiGate: Record<string, number> = ((): Record<string, number> => {
    if (!pbiTree) return {};
    const doneMonth = (cardIds: string[]): number => {
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
    const monthlyDone = doneMonth(['core', 'spend']);
    const goal1Done = doneMonth(['ef1']);
    const goal2Done = doneMonth(['debt', 'ef6']);
    const hop = spineTravelMonths(mode); // one gate hop, added for card arms
    return {
      'c-monthly-goals1': monthlyDone,
      'c-goals1-ef1': monthlyDone + hop,
      'c-goals1-goals2': goal1Done,
      'c-goals2-debt': goal1Done + hop,
      'c-goals2-ef6': goal1Done + hop,
      'c-goals2-down': goal1Done,
      'c-goals2-goals3': goal2Done,
      'c-goals3-travel': goal2Done + hop,
      'c-goals3-brokerage': goal2Done + hop,
      'c-goals3-down': goal2Done,
    };
  })();

  // ---------- pbi "Locked path": bold WHITE spine + heavy white curvy branches + animated padlock discs ----------
  // (Figma 802:10378) A thick rounded WHITE track spine with heavy organic white
  // wishbone branches into the cards, plain gray gate labels to the left (rendered
  // by SectionNodeView), and gray PADLOCK discs sitting ON the spine at each level
  // boundary. A lock UNLOCKS (closed Lock -> open LockOpen, cross-faded) the moment
  // every card of the level above it finishes funding — using the SAME cardDone
  // source the check discs use, so a lock opens exactly when its level unlocks.
  // Money still travels as thin colored pulses over the white track.
  if (isPbiLocked) {
    const lockById = (id: string) => conns.find((c) => c.id === id)?.d;
    const lockDiscs = pbiLockDiscsFor(dataset).map((d) => {
      const unlocked = d.cards.every((c) => cardDone(dataset, mode, c, now));
      return (
        <g key={d.id} transform={`translate(${PBI_LOCK_SPINE_X} ${d.y})`}>
          <circle r={12} fill="#e6e7ea" stroke="#ffffff" strokeWidth={2} />
          <g style={{ opacity: unlocked ? 0 : 1, transition: 'opacity 0.45s ease' }}>
            <Lock x={-7} y={-7} width={14} height={14} color="#6b7280" strokeWidth={2.2} />
          </g>
          <g style={{ opacity: unlocked ? 1 : 0, transition: 'opacity 0.45s ease' }}>
            <LockOpen x={-7} y={-7} width={14} height={14} color="#2f8f57" strokeWidth={2.2} />
          </g>
        </g>
      );
    });
    return (
      <svg className="connectors" width="402" height={boardH} viewBox={`0 0 402 ${boardH}`} fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* bold rounded WHITE spine + branches (Figma 4px vectors, drawn a touch
            heavier so they read as a bold track) — no drop shadow */}
        <g>
          {conns.map((c) => (
            <path key={c.id} d={c.d} stroke="#ffffff" strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </g>
        {probes}
        {/* colored pulse per in-flight income event (over the white track) */}
        {FLOW_META.map((m) => {
          const d = lockById(m.id);
          const len = lens[m.id];
          if (!d || !len || len <= 0) return null;
          const flows = branchFlow(dataset, mode, now, m.id, pbiGate[m.id] ?? -Infinity);
          return flows.map((f, j) => {
            const { dashArray, dashOffset } = pulseDash(len, f.p);
            return (
              <path
                key={`lock-${m.id}-${j}`}
                d={d}
                stroke={m.color}
                strokeWidth={3.5}
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
        {lockDiscs}
      </svg>
    );
  }

  // ---------- pbi "Text gates + backgrounds": uniform white tree over colored panels ----------
  // (Figma 885:11940) Reuses the DEFAULT (text-only) pbi tree geometry — thin spine
  // at x=50, on-spine text gate pills (rendered by SectionNodeView), white wishbone
  // arms into the pbi cards on their default rows — and lets the colored section
  // panels (board-level chrome, see PbiGroupedPanels in App) sit behind everything.
  // The spine, section stems, and wishbone arms are ONE uniform white 4px stroke.
  // No padlock discs — the panels + text pills carry the hierarchy. Money still
  // travels as thin colored pulses over the white branches.
  if (isPbiGrouped) {
    const grpById = (id: string) => conns.find((c) => c.id === id)?.d;
    return (
      <svg className="connectors" width="402" height={boardH} viewBox={`0 0 402 ${boardH}`} fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* uniform white tree — spine + stems + wishbone arms, one color + weight
            (no drop shadow) */}
        <g>
          {conns.map((c) => (
            <path key={`grp-tree-${c.id}`} d={c.d} stroke="#ffffff" strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </g>
        {probes}
        {/* colored pulse per in-flight income event (over the white branches) */}
        {FLOW_META.map((m) => {
          const d = grpById(m.id);
          const len = lens[m.id];
          if (!d || !len || len <= 0) return null;
          const flows = branchFlow(dataset, mode, now, m.id, pbiGate[m.id] ?? -Infinity);
          return flows.map((f, j) => {
            const { dashArray, dashOffset } = pulseDash(len, f.p);
            return (
              <path
                key={`grp-${m.id}-${j}`}
                d={d}
                stroke={m.color}
                strokeWidth={2.5}
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

  // ---------- pbi "Grouped 2": gray panels + offset-riser routing + padlock discs ----------
  // (Figma 802:10838) A variant of "Grouped": same uniform white tree (spine + arms),
  // same white pulses, but the MAIN spine (x=40) carries only the Monthly wishbone
  // (no lock), then BENDS into the goals panel to an OFFSET riser (x=97). The padlock
  // discs sit at that offset riser at each goal junction and fork the goal arms off
  // it (not the spine); they unlock the moment every card in their section funds.
  if (isPbiGrouped2) {
    const grp2ById = (id: string) => conns.find((c) => c.id === id)?.d;
    const lockDiscs = pbiGrouped2LockDiscsFor(dataset).map((d) => {
      const unlocked = d.cards.every((c) => cardDone(dataset, mode, c, now));
      return (
        <g key={d.id} transform={`translate(${PBI_GROUPED2_RISER_X} ${d.y})`}>
          <circle r={12} fill="#ffffff" stroke="#e6e7ea" strokeWidth={1} />
          <g style={{ opacity: unlocked ? 0 : 1, transition: 'opacity 0.45s ease' }}>
            <Lock x={-7} y={-7} width={14} height={14} color="#6b7280" strokeWidth={2.2} />
          </g>
          <g style={{ opacity: unlocked ? 1 : 0, transition: 'opacity 0.45s ease' }}>
            <LockOpen x={-7} y={-7} width={14} height={14} color="#2f8f57" strokeWidth={2.2} />
          </g>
        </g>
      );
    });
    return (
      <svg className="connectors" width="402" height={boardH} viewBox={`0 0 402 ${boardH}`} fill="none" xmlns="http://www.w3.org/2000/svg">
        <g>
          {conns.map((c) => (
            <path key={`grp2-tree-${c.id}`} d={c.d} stroke="#ffffff" strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </g>
        {probes}
        {/* colored pulse per in-flight income event (over the white branches) */}
        {FLOW_META.map((m) => {
          const d = grp2ById(m.id);
          const len = lens[m.id];
          if (!d || !len || len <= 0) return null;
          const flows = branchFlow(dataset, mode, now, m.id, pbiGate[m.id] ?? -Infinity);
          return flows.map((f, j) => {
            const { dashArray, dashOffset } = pulseDash(len, f.p);
            return (
              <path
                key={`grp2-${m.id}-${j}`}
                d={d}
                stroke={m.color}
                strokeWidth={2.5}
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
        {lockDiscs}
      </svg>
    );
  }

  // ---------- pbi "Indented": far-left spine + indented risers + amount pills ----------
  // (Figma 886:12513) A nested tree: a thin gray MAIN spine at x=41 with horizontal
  // elbow arms into the monthly (Core/Spend) + 1st-goal cards — each tagged with a
  // small AMOUNT PILL near the spine — and the deeper goal levels hanging off
  // indented risers (x=78 / x=115). No section labels; the indentation IS the
  // hierarchy. Money travels as the shared colored pulses over the gray branches.
  if (isPbiIndented) {
    const indById = (id: string) => conns.find((c) => c.id === id)?.d;
    return (
      <svg className="connectors" width="402" height={boardH} viewBox={`0 0 402 ${boardH}`} fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* thin gray indented tree (spine + risers + elbow/wishbone arms) */}
        {conns.map((c) => (
          <path key={`ind-tree-${c.id}`} d={c.d} stroke="#d3d6db" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {probes}
        {/* colored pulse per in-flight income event */}
        {FLOW_META.map((m) => {
          const d = indById(m.id);
          const len = lens[m.id];
          if (!d || !len || len <= 0) return null;
          const flows = branchFlow(dataset, mode, now, m.id, pbiGate[m.id] ?? -Infinity);
          return flows.map((f, j) => {
            const { dashArray, dashOffset } = pulseDash(len, f.p);
            return (
              <path
                key={`ind-${m.id}-${j}`}
                d={d}
                stroke={m.color}
                strokeWidth={2.5}
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
        {/* amount pills tagging the monthly + 1st-goal arms near the spine */}
        {pbiIndentedPillsFor(dataset).map((p) => (
          <g key={`ind-pill-${p.id}`}>
            <rect x={PBI_INDENTED_PILL_X} y={p.y - 9.5} width={54} height={19} rx={4} fill="#ffffff" stroke="#e6e7ea" strokeWidth={1} />
            <text
              x={PBI_INDENTED_PILL_X + 27}
              y={p.y + 3.5}
              textAnchor="middle"
              style={{ fontFamily: 'var(--font-family)', fontSize: 10, fontWeight: 600 }}
              fill="#111827"
            >
              {p.amount}
            </text>
          </g>
        ))}
      </svg>
    );
  }

  // ---------- pbi "Section plus label": In-sections panels + % pills + monthly circle ----------
  // (Figma 977:10830) The same WHITE raised tree over the teal/pink section panels as
  // "In sections", but each arm carries its % allocation pill (reusing badgesFor, like
  // the compact "Lines with %" gate) and the Monthly gate is a spine circle instead of
  // a text pill (rendered by SectionNodeView). Goal gates keep their text pills.
  if (isPbiSectionLabel) {
    const slById = (id: string) => conns.find((c) => c.id === id)?.d;
    // arm -> % badge id (same pairing the pots "Lines with %" gate uses), text from badgesFor
    const SL_PCT_BADGE: Record<string, string> = {
      'c-monthly-core': 'p70a',
      'c-monthly-spend': 'p30a',
      'c-goals1-ef1': 'p100',
      'c-goals2-debt': 'p70b',
      'c-goals2-ef6': 'p30b',
      'c-goals3-travel': 'p100c',
      'c-goals3-brokerage': 'p100d',
    };
    const pctText: Record<string, string> = Object.fromEntries(badgesFor(dataset).map((b) => [b.id, b.text]));
    const pctPills = Object.entries(SL_PCT_BADGE).map(([armId, badgeId]) => {
      const m = mids[armId];
      const txt = pctText[badgeId];
      if (!m || !txt) return null;
      return (
        <foreignObject key={`sl-pct-${armId}`} x={m.x - 26} y={m.y - 11} width={52} height={22} style={{ overflow: 'visible' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <span className="pct-badge" style={{ color: '#111' }}>{txt}</span>
          </div>
        </foreignObject>
      );
    });
    return (
      <svg className="connectors" width="402" height={boardH} viewBox={`0 0 402 ${boardH}`} fill="none" xmlns="http://www.w3.org/2000/svg">
        <g>
          {conns.map((c) => (
            <path key={`sl-tree-${c.id}`} d={c.d} stroke="#ffffff" strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </g>
        {probes}
        {FLOW_META.map((m) => {
          const d = slById(m.id);
          const len = lens[m.id];
          if (!d || !len || len <= 0) return null;
          const flows = branchFlow(dataset, mode, now, m.id, pbiGate[m.id] ?? -Infinity);
          return flows.map((f, j) => {
            const { dashArray, dashOffset } = pulseDash(len, f.p);
            return (
              <path
                key={`sl-${m.id}-${j}`}
                d={d}
                stroke={m.color}
                strokeWidth={2.5}
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
        {pctPills}
      </svg>
    );
  }

  if (pbiTree) {
    const pbiById = (id: string) => conns.find((c) => c.id === id)?.d;
    // Figma 804:8385: the branches are WHITE and 4px (raised off the light-gray
    // board with a soft drop shadow), not thin gray.
    const pbiTreeW = 4;
    const pbiPulseW = 4;
    const pbiTreeStroke = '#ffffff';
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
        {/* static WHITE raised tree (Figma 804:8385) — flat white branches, no
            drop shadow. */}
        <g>
          {conns.map((c) => (
            <path key={c.id} d={c.d} stroke={pbiTreeStroke} strokeWidth={pbiTreeW} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </g>
        {probes}
        {/* colored pulse per in-flight income event */}
        {FLOW_META.map((m) => {
          const d = pbiById(m.id);
          const len = lens[m.id];
          if (!d || !len || len <= 0) return null;
          const flows = branchFlow(dataset, mode, now, m.id, pbiGate[m.id] ?? -Infinity);
          return flows.map((f, j) => {
            const { dashArray, dashOffset } = pulseDash(len, f.p);
            return (
              <path
                key={`pbi-${m.id}-${j}`}
                d={d}
                stroke={m.color}
                strokeWidth={pbiPulseW}
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
