import { useLayoutEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { connectorsFor, connectorsCompactFor, connectorsMoneyMapFor, connectorsSkinnyFor, connectorsIconFor, connectorsConvoFor, connectorsV1For, connectorsCondensedFor, type BranchStyle, type Connector, type MapStyle } from '../data';
import { branchFlow, isReached, progressAt, type Dataset, type Mode } from '../scenario';

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
}) {
  // Gate-style precedence (a gate choice can OVERRIDE the visual identity):
  //   compact     -> skinny-arrow connectors + % badges, REGARDLESS of identity
  //   text-only   -> money-map brace ropes (plain-text gates), no % badges
  //   skinny-line -> the super-thin slim tree (only used with the slim card)
  //   otherwise   -> map-based (money-map ropes vs. modern flow skeleton)
  const isCompact = branch === 'compact';
  const isSkinny = branch === 'skinny-line';
  // colored money-map ropes: the "text only" gate always uses them, and the
  // money-map identity uses them UNLESS a gate style (compact/skinny) overrides.
  const money = !isCompact && !isSkinny && (branch === 'text-only' || map === 'money-map');
  // active connector set. compact takes precedence over money-map so "Lines with
  // %" always shows its skinny arrows; skinny-line uses its own thin tree.
  // dataset-aware geometry: each set has a Simple and an Optimizer variant (the
  // Optimizer adds a 3rd goal gate on a compact rhythm). Simple returns its exact
  // original arrays.
  const baseConns: Connector[] = condensed
    ? connectorsCondensedFor(dataset)
    : v1
      ? connectorsV1For(dataset)
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
  }, [branch, map, v1, condensed, dataset, pillIncome, iconTree, convoTree]);

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

  // ---------- skinny line: super-thin static tree + thin travelling pulse ----------
  // A ~1px gray spine + thin elbows to each slim row's name pill. No arrowheads,
  // no rope/glow, and NO check badges (a money-map/standard concept that reads as
  // stray marks on the thin slim tree — Figma 496-5864 shows a clean thin tree).
  // The branch-flow pulse still runs, as a thin (2px) colored dash so causal
  // order stays legible without the heavy comet glow.
  if (isSkinny) {
    const skById = (id: string) => conns.find((c) => c.id === id)?.d;
    // convo, icons and slim all share the same clean thin tree stroke (1px tree /
    // 2px pulse) so the bracket geometry reads identically across the styles.
    const treeW = 1;
    const pulseW = 2;
    return (
      <svg className="connectors" width="402" height={boardH} viewBox={`0 0 402 ${boardH}`} fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* thin static skeleton */}
        {conns.map((c) => (
          <path key={c.id} d={c.d} stroke="var(--connector)" strokeWidth={treeW} fill="none" strokeLinecap="round" strokeLinejoin="round" />
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
