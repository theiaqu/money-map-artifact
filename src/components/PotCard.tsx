import { POT_BODY_W, POT_CONTAINER_W, POT_PLANT_BAND_H, type CardNode, type GraphColor } from '../data';

/* "Pots" account style (Figma 802:9336). Each account/goal card is a colored POT:
   a rounded body with a slightly-lighter, wider RIM band near its top and the
   account NAME in white inside. Along the pot's TOP edge, PLANTS grow left→right
   as the card funds — the plant band IS the progress bar. At progress 0 the pot is
   bare soil; as `progress` (progressAt) climbs, plant clusters pop in one-by-one
   across the top (a staggered spring/pop grow-in) until, at 1, plants span the
   full width. Species is per category: Core = rounded shrubs, Spend = spiky grass,
   goals = curling sprout-vines. Driven entirely off the shared sim clock so
   pause / scrub / restart stay in sync. */

// Pot body + rim colors per graph color (sampled from the Figma frame). Bodies are
// the saturated pot fills; rims are a lighter tint of the same hue.
const POT_BODY: Record<GraphColor, string> = {
  yellow: '#f6dc72',
  blue: '#5e8dba',
  green: '#61bc76',
  pink: '#eebfd4',
};
const POT_RIM: Record<GraphColor, string> = {
  yellow: '#f9e79a',
  blue: '#7ba3c6',
  green: '#83cb93',
  pink: '#f4d6e3',
};

// plant greens (deep base + two highlights) — matches the Figma foliage
const LEAF_DARK = '#22592f';
const LEAF_MID = '#357a45';
const LEAF_LIGHT = '#4e9e63';

type Species = 'shrub' | 'grass' | 'vine';
function speciesFor(node: CardNode): Species {
  if (node.id === 'core') return 'shrub';
  if (node.id === 'spend') return 'grass';
  return 'vine'; // every goal (incl. Optimizer's extra goals)
}

const N_SEG = 6; // plant clusters spread across the pot's top edge
const GROW_WINDOW = 0.34; // fraction of progress over which one cluster pops in
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
// ease-out-back — a quick spring "pop" with a small overshoot as a cluster grows
const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

// One plant sprite (drawn in a 34×46 box, rooted at the bottom). `index` adds
// subtle per-cluster variation (mirror + shade shuffle) so the band isn't uniform.
function PlantSprite({ species, index }: { species: Species; index: number }) {
  const flip = index % 2 === 1;
  const t = flip ? 'scale(-1,1) translate(-34,0)' : undefined;
  if (species === 'shrub') {
    // overlapping rounded bushes (a hedge cluster)
    return (
      <svg viewBox="0 0 34 46" width="100%" height="100%" preserveAspectRatio="xMidYMax meet" style={{ overflow: 'visible' }}>
        <g transform={t}>
          <circle cx="9" cy="34" r="10" fill={LEAF_DARK} />
          <circle cx="24" cy="33" r="11" fill={LEAF_MID} />
          <circle cx="16" cy="25" r="9.5" fill={LEAF_DARK} />
          <circle cx="26" cy="24" r="7.5" fill={LEAF_LIGHT} />
          <circle cx="12" cy="20" r="6.5" fill={LEAF_MID} />
        </g>
      </svg>
    );
  }
  if (species === 'grass') {
    // spiky grass blades fanning up from the soil
    return (
      <svg viewBox="0 0 34 46" width="100%" height="100%" preserveAspectRatio="xMidYMax meet" style={{ overflow: 'visible' }}>
        <g transform={t}>
          <path d="M6 46 C 4 32 3 22 8 8 C 10 22 11 34 11 46 Z" fill={LEAF_DARK} />
          <path d="M14 46 C 13 30 14 18 18 4 C 20 20 20 34 19 46 Z" fill={LEAF_MID} />
          <path d="M22 46 C 22 32 24 22 28 12 C 28 26 28 36 27 46 Z" fill={LEAF_DARK} />
          <path d="M18 46 C 18 34 20 26 25 20 C 24 30 24 40 23 46 Z" fill={LEAF_LIGHT} />
        </g>
      </svg>
    );
  }
  // vine — a curling sprout stem with small leaves
  return (
    <svg viewBox="0 0 34 46" width="100%" height="100%" preserveAspectRatio="xMidYMax meet" style={{ overflow: 'visible' }}>
      <g transform={t}>
        <path d="M16 46 C 16 34 10 30 12 20 C 13 12 20 12 21 6" fill="none" stroke={LEAF_MID} strokeWidth="2.4" strokeLinecap="round" />
        <ellipse cx="10" cy="26" rx="6" ry="3.4" transform="rotate(-30 10 26)" fill={LEAF_DARK} />
        <ellipse cx="22" cy="18" rx="5.5" ry="3.2" transform="rotate(35 22 18)" fill={LEAF_LIGHT} />
        <ellipse cx="21" cy="5" rx="4.6" ry="3" transform="rotate(-12 21 5)" fill={LEAF_MID} />
        <circle cx="21" cy="5" r="1.8" fill={LEAF_DARK} />
      </g>
    </svg>
  );
}

// The plant band spanning the pot's top edge. `progress` (0..1) reveals clusters
// left→right; each pops in over GROW_WINDOW with a spring overshoot, so a pot is
// bare at 0 and fully planted (across the whole width) at 1.
function PlantBand({ species, progress }: { species: Species; progress: number }) {
  const segW = POT_BODY_W / N_SEG;
  const denom = N_SEG - 1;
  return (
    <div className="pot-plants" style={{ width: POT_BODY_W, height: POT_PLANT_BAND_H }}>
      {Array.from({ length: N_SEG }).map((_, i) => {
        // stagger the cluster start thresholds over [0, 1 − GROW_WINDOW] so the
        // last cluster finishes exactly at progress 1 (pot full when funded).
        const start = (i / denom) * (1 - GROW_WINDOW);
        const g = clamp01((progress - start) / GROW_WINDOW);
        if (g <= 0) return null;
        const scale = easeOutBack(g);
        return (
          <div
            key={i}
            className="pot-plant"
            style={{
              left: i * segW,
              width: segW,
              opacity: Math.min(1, g * 2.2),
              transform: `scale(${scale.toFixed(3)})`,
            }}
          >
            <PlantSprite species={species} index={i} />
          </div>
        );
      })}
    </div>
  );
}

export default function PotCard({ node, progress }: { node: CardNode; progress: number }) {
  const body = POT_BODY[node.graph];
  const rim = POT_RIM[node.graph];
  return (
    <div className="pot-card" style={{ width: POT_CONTAINER_W }}>
      <div className="pot-rim" style={{ background: rim }} />
      <div className="pot-body" style={{ background: body }}>
        <span className="pot-name">{node.title}</span>
      </div>
      <PlantBand species={speciesFor(node)} progress={clamp01(progress)} />
    </div>
  );
}
