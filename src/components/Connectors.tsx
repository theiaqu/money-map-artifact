import { useLayoutEffect, useRef, useState } from 'react';
import { connectors, connectorsCompact, connectorsMoneyMap, type BranchStyle, type Connector, type MapStyle } from '../data';
import { branchFlow, type Mode } from '../scenario';

// "Today's money map" — thick pastel ropes keyed by destination branch
const MM_ROPE = (id: string): string =>
  id === 'c-income-monthly' ? '#F6DC72'
  : id === 'c-monthly-core' ? '#B0D9FF'
  : id === 'c-monthly-spend' ? '#61BC76'
  : '#EEBED4'; // goal fan-outs + spine

// money-map idle pipe colour (neutral gray, per Figma node 432:5177)
const MM_IDLE = '#B0B0B0';

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

export default function Connectors({
  now,
  mode,
  branch = 'standard',
  map = 'flow',
}: {
  now: number;
  mode: Mode;
  branch?: BranchStyle;
  map?: MapStyle;
}) {
  // colored money-map ropes are used by BOTH the money-map visual identity AND the
  // "text only" gate style (which pairs plain-text gates with the same ropes).
  const money = map === 'money-map' || branch === 'text-only';
  // active connector set: rope styles share the money-map kink-free geometry; the
  // flow / compact sets are left untouched so their card attach heights don't shift.
  const conns: Connector[] = money ? connectorsMoneyMap : branch === 'compact' ? connectorsCompact : connectors;

  // Hooks always run (measure path lengths by id for the active set). Keeping
  // them above any early return avoids a Rules-of-Hooks violation when the map /
  // branch style is toggled at runtime.
  const geoRefs = useRef<Record<string, SVGPathElement | null>>({});
  const [lens, setLens] = useState<Record<string, number>>({});
  useLayoutEffect(() => {
    const next: Record<string, number> = {};
    for (const c of conns) next[c.id] = geoRefs.current[c.id]?.getTotalLength() ?? 0;
    setLens(next);
    // conns is derived purely from branch + map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch, map]);

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

  // ---------- money map: gray idle pipe + solid single-colour highlight sweep ----------
  // A SHORT band of the branch pastel travels source->dest once per event over a
  // gray idle pipe (no blur/glow/gradient). Because the band is only a fraction of
  // the rope, several in-flight events show up as distinct, separated pulses.
  if (money) {
    return (
      <svg className="connectors" width="402" height="960" viewBox="0 0 402 960" fill="none" xmlns="http://www.w3.org/2000/svg">
        {probes}
        {connectorsMoneyMap.map((c) => (
          <path key={c.id} d={c.d} stroke={MM_IDLE} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        ))}
        {connectorsMoneyMap.map((c) => {
          const len = lens[c.id];
          if (!len) return null;
          const flows = branchFlow(mode, now, c.id);
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
      </svg>
    );
  }

  // ---------- flow / compact: gray skeleton + soft travelling gradient comet ----------
  const byId = (id: string) => conns.find((c) => c.id === id)!.d;
  const FLOW: FlowBranch[] = FLOW_META.map((m) => ({ ...m, d: byId(m.id) }));

  return (
    <svg className="connectors" width="402" height="960" viewBox="0 0 402 960" fill="none" xmlns="http://www.w3.org/2000/svg">
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
        <filter id="comet-glow" filterUnits="userSpaceOnUse" x="0" y="0" width="402" height="960">
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
        const flows = branchFlow(mode, now, b.id);
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
    </svg>
  );
}
