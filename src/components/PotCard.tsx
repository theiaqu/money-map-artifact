import { POT_BODY_W, POT_CONTAINER_W, POT_PLANT_BAND_H, type CardNode, type GraphColor } from '../data';
import { goalDateLabel, type DateMode } from '../scenario';

/* "Pots" account style (Figma 802:9336). Each account/goal card is a colored POT:
   a rounded body with a slightly-lighter, wider RIM/LIP band that overlays the
   FRONT of the body's top edge (the lip is drawn IN FRONT of the body, per the
   Figma layer order) and the account NAME + amount in white inside. Along the
   pot's TOP edge, PLANTS grow left→right as the card funds — the plant band IS
   the progress bar. At progress 0 the pot is bare soil; as `progress`
   (progressAt) climbs, plant clusters pop in one-by-one across the top (a
   staggered spring/pop grow-in) until, at 1, plants span the full width.
   Species is per category: Core = layered rounded shrubs (hedge with depth),
   Spend = varied spiky grass blades, goals = curling sprout-vines with round
   leaves. Driven entirely off the shared sim clock so pause / scrub / restart
   stay in sync. */

// Pot body + rim colors per graph color (sampled from the Figma frame). Bodies
// are the saturated pot fills; rims are a lighter tint of the same hue.
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

/* ---- plant sprites (each drawn in a 34×46 box, rooted at the bottom) ----
   Every species has THREE hand-drawn variants; `index` picks the variant, a
   mirror, and a small base rotation so no two adjacent clusters look identical
   (real planting, not one repeated blob). Shades are shuffled per cluster too. */

// deterministic shade triple rotation so clusters vary in their dark/mid/light mix
const SHADES: [string, string, string][] = [
  [LEAF_DARK, LEAF_MID, LEAF_LIGHT],
  [LEAF_MID, LEAF_DARK, LEAF_LIGHT],
  [LEAF_DARK, LEAF_LIGHT, LEAF_MID],
];

// Core — layered rounded shrubs: a back row of big dark bushes + a front row of
// smaller lighter bushes for depth (a rounded hedge cluster).
function ShrubSprite({ index }: { index: number }) {
  const v = index % 3;
  const [a, b, c] = SHADES[index % 3];
  const flip = index % 2 === 1;
  const rot = ((index % 3) - 1) * 4; // -4 / 0 / 4 deg
  const inner =
    v === 0 ? (
      <>
        <circle cx="9" cy="35" r="10.5" fill={a} />
        <circle cx="25" cy="34" r="11.5" fill={a} />
        <circle cx="17" cy="26" r="10" fill={b} />
        <circle cx="27" cy="27" r="7.5" fill={b} />
        <circle cx="11" cy="27" r="5.5" fill={c} />
        <circle cx="21" cy="20" r="6" fill={c} />
      </>
    ) : v === 1 ? (
      <>
        <circle cx="11" cy="36" r="11" fill={a} />
        <circle cx="24" cy="35" r="10" fill={a} />
        <circle cx="18" cy="27" r="9.5" fill={b} />
        <circle cx="9" cy="28" r="6.5" fill={b} />
        <circle cx="24" cy="24" r="6.5" fill={c} />
        <circle cx="16" cy="19" r="5" fill={c} />
      </>
    ) : (
      <>
        <circle cx="8" cy="34" r="9.5" fill={a} />
        <circle cx="20" cy="36" r="11.5" fill={a} />
        <circle cx="29" cy="31" r="7.5" fill={a} />
        <circle cx="14" cy="25" r="8.5" fill={b} />
        <circle cx="25" cy="24" r="7" fill={b} />
        <circle cx="19" cy="18" r="5.5" fill={c} />
      </>
    );
  return (
    <svg viewBox="0 0 34 46" width="100%" height="100%" preserveAspectRatio="xMidYMax meet" style={{ overflow: 'visible' }}>
      <g transform={`${flip ? 'scale(-1,1) translate(-34,0) ' : ''}rotate(${rot} 17 40)`}>{inner}</g>
    </svg>
  );
}

// Spend — spiky grass blades fanning up from the soil, with varied heights/angles.
function GrassSprite({ index }: { index: number }) {
  const v = index % 3;
  const [a, b, c] = SHADES[index % 3];
  const flip = index % 2 === 1;
  const inner =
    v === 0 ? (
      <>
        <path d="M5 46 C 3 32 3 22 8 7 C 10 22 11 34 10 46 Z" fill={a} />
        <path d="M13 46 C 12 30 13 18 17 3 C 19 20 19 34 18 46 Z" fill={b} />
        <path d="M21 46 C 21 33 23 22 27 11 C 27 26 27 37 26 46 Z" fill={a} />
        <path d="M17 46 C 17 35 19 27 24 20 C 23 30 23 40 22 46 Z" fill={c} />
        <path d="M27 46 C 28 36 30 29 33 22 C 32 31 31 39 31 46 Z" fill={b} />
      </>
    ) : v === 1 ? (
      <>
        <path d="M6 46 C 5 34 4 26 6 14 C 9 26 10 36 10 46 Z" fill={b} />
        <path d="M12 46 C 11 28 12 16 15 2 C 18 18 17 33 17 46 Z" fill={a} />
        <path d="M19 46 C 19 31 20 20 25 8 C 25 24 24 36 24 46 Z" fill={a} />
        <path d="M24 46 C 25 34 27 25 31 16 C 30 28 30 38 29 46 Z" fill={c} />
      </>
    ) : (
      <>
        <path d="M4 46 C 3 36 3 28 6 18 C 8 29 9 38 9 46 Z" fill={a} />
        <path d="M11 46 C 10 32 11 21 14 8 C 17 22 16 35 16 46 Z" fill={c} />
        <path d="M18 46 C 18 34 19 24 22 12 C 23 26 22 37 22 46 Z" fill={b} />
        <path d="M25 46 C 26 33 28 23 30 9 C 30 25 30 37 30 46 Z" fill={a} />
        <path d="M29 46 C 30 38 31 32 33 26 C 33 33 32 40 32 46 Z" fill={b} />
      </>
    );
  return (
    <svg viewBox="0 0 34 46" width="100%" height="100%" preserveAspectRatio="xMidYMax meet" style={{ overflow: 'visible' }}>
      <g transform={flip ? 'scale(-1,1) translate(-34,0)' : undefined}>{inner}</g>
    </svg>
  );
}

// goals — a curling sprout stem with small round leaves that curl outward.
function VineSprite({ index }: { index: number }) {
  const v = index % 3;
  const [a, b, c] = SHADES[index % 3];
  const flip = index % 2 === 1;
  const inner =
    v === 0 ? (
      <>
        <path d="M16 46 C 16 34 9 30 12 20 C 14 11 22 12 22 5" fill="none" stroke={b} strokeWidth="2.4" strokeLinecap="round" />
        <ellipse cx="10" cy="27" rx="6" ry="3.6" transform="rotate(-32 10 27)" fill={a} />
        <ellipse cx="22" cy="17" rx="5.6" ry="3.3" transform="rotate(34 22 17)" fill={c} />
        <ellipse cx="22" cy="5" rx="4.6" ry="3" transform="rotate(-10 22 5)" fill={b} />
        <circle cx="22" cy="5" r="1.7" fill={a} />
      </>
    ) : v === 1 ? (
      <>
        <path d="M17 46 C 17 33 24 30 21 19 C 19 10 11 12 12 4" fill="none" stroke={b} strokeWidth="2.4" strokeLinecap="round" />
        <ellipse cx="24" cy="26" rx="6" ry="3.5" transform="rotate(30 24 26)" fill={a} />
        <ellipse cx="11" cy="16" rx="5.6" ry="3.3" transform="rotate(-36 11 16)" fill={c} />
        <ellipse cx="12" cy="4" rx="4.4" ry="2.9" transform="rotate(12 12 4)" fill={b} />
        <circle cx="12" cy="4" r="1.7" fill={a} />
      </>
    ) : (
      <>
        <path d="M16 46 C 16 36 12 32 14 24 C 16 16 21 17 20 9 C 19.4 6 18 5 18 3" fill="none" stroke={b} strokeWidth="2.3" strokeLinecap="round" />
        <ellipse cx="9" cy="30" rx="5.4" ry="3.3" transform="rotate(-30 9 30)" fill={a} />
        <ellipse cx="24" cy="21" rx="5.4" ry="3.2" transform="rotate(32 24 21)" fill={c} />
        <ellipse cx="11" cy="13" rx="4.8" ry="3" transform="rotate(-24 11 13)" fill={b} />
        <circle cx="18" cy="3" r="2" fill={a} />
      </>
    );
  return (
    <svg viewBox="0 0 34 46" width="100%" height="100%" preserveAspectRatio="xMidYMax meet" style={{ overflow: 'visible' }}>
      <g transform={flip ? 'scale(-1,1) translate(-34,0)' : undefined}>{inner}</g>
    </svg>
  );
}

function PlantSprite({ species, index }: { species: Species; index: number }) {
  if (species === 'shrub') return <ShrubSprite index={index} />;
  if (species === 'grass') return <GrassSprite index={index} />;
  return <VineSprite index={index} />;
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

export default function PotCard({
  node,
  progress,
  dateMode = 'date',
  reached = false,
}: {
  node: CardNode;
  progress: number;
  dateMode?: DateMode;
  reached?: boolean;
}) {
  const body = POT_BODY[node.graph];
  const rim = POT_RIM[node.graph];
  // amount line: accounts show their monthly allocation, goals show the target
  const amountText = node.kind === 'goal' ? `${node.amount} goal` : `${node.amount}/mo`;
  // goal fund-by pill (accounts get none), respecting the Goal-representation toggle
  const dateText = node.kind === 'goal' ? goalDateLabel(dateMode, node.badge) : '';
  return (
    <div className="pot-card" style={{ width: POT_CONTAINER_W }}>
      {/* body (back) → plants → rim/lip (in FRONT of the body) → text overlay */}
      <div className="pot-body" style={{ background: body }} />
      <PlantBand species={speciesFor(node)} progress={clamp01(progress)} />
      <div className="pot-rim" style={{ background: rim }} />
      <div className="pot-face">
        <span className="pot-name">{node.title}</span>
        <span className="pot-amount">{amountText}</span>
        {dateText && <span className={`pot-date${reached ? ' reached' : ''}`}>{dateText}</span>}
      </div>
    </div>
  );
}
