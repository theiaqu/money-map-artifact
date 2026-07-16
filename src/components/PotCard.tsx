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

/* ---- plant sprites (each drawn in a WIDE, SHORT 44×30 box, rooted at the bottom
   edge y=30 which sits on the pot body's top / behind the lip) ----
   The box is deliberately wide-and-short (aspect ≈ the segment width : band
   height) so the sprites read as LOW, CONTAINED plants that stay within the gap
   above the pot — matching the Figma silhouettes (802:9336): Core = a low bumpy
   rounded HEDGE of bushes, Spend = short-to-medium spiky GRASS blades, goals =
   delicate curling sprout VINES with small round leaves. Every species has THREE
   hand-drawn variants; `index` picks the variant, a mirror, and (shrub) a small
   base rotation so no two adjacent clusters look identical. Shades rotate per
   cluster across the three Figma greens. */

const VB = '0 0 44 30'; // shared wide/short sprite viewBox, soil line at y=30

// deterministic shade triple rotation so clusters vary in their dark/mid/light mix
const SHADES: [string, string, string][] = [
  [LEAF_DARK, LEAF_MID, LEAF_LIGHT],
  [LEAF_MID, LEAF_DARK, LEAF_LIGHT],
  [LEAF_DARK, LEAF_LIGHT, LEAF_MID],
];

// Core — a DENSE rounded HEDGE: a full-width mound of many overlapping bushes
// (a solid base row + a bumpy layered crown) so each cluster reads as a lush,
// thick hedge that fills the band edge-to-edge rather than a lone sprig (Figma:
// a continuous row of soft overlapping dark-green mounds spanning the pot). Mass
// is packed into the upper band (y≈4–20) since the rim hides the lower ~10px.
function ShrubSprite({ index }: { index: number }) {
  const v = index % 3;
  const [a, b, c] = SHADES[index % 3];
  const flip = index % 2 === 1;
  const rot = ((index % 3) - 1) * 3; // -3 / 0 / 3 deg
  const inner =
    v === 0 ? (
      <>
        <circle cx="1" cy="26" r="9" fill={a} />
        <circle cx="12" cy="24" r="11" fill={a} />
        <circle cx="24" cy="25" r="11.5" fill={a} />
        <circle cx="35" cy="24" r="11" fill={a} />
        <circle cx="44" cy="26" r="9" fill={a} />
        <circle cx="8" cy="16" r="9.5" fill={a} />
        <circle cx="19" cy="14" r="10.5" fill={b} />
        <circle cx="31" cy="15" r="10" fill={a} />
        <circle cx="41" cy="16" r="8" fill={b} />
        <circle cx="14" cy="9" r="6.5" fill={b} />
        <circle cx="27" cy="8" r="7" fill={b} />
        <circle cx="21" cy="6" r="5" fill={c} />
        <circle cx="34" cy="10" r="4.5" fill={c} />
      </>
    ) : v === 1 ? (
      <>
        <circle cx="2" cy="25" r="9.5" fill={a} />
        <circle cx="14" cy="25" r="11.5" fill={a} />
        <circle cx="26" cy="24" r="11.5" fill={a} />
        <circle cx="38" cy="25" r="10.5" fill={a} />
        <circle cx="10" cy="15" r="10" fill={a} />
        <circle cx="22" cy="16" r="11" fill={a} />
        <circle cx="34" cy="15" r="9.5" fill={b} />
        <circle cx="43" cy="18" r="7" fill={a} />
        <circle cx="16" cy="8" r="7" fill={b} />
        <circle cx="29" cy="9" r="6.5" fill={b} />
        <circle cx="23" cy="5" r="5" fill={c} />
        <circle cx="9" cy="9" r="4.5" fill={c} />
      </>
    ) : (
      <>
        <circle cx="3" cy="25" r="10" fill={a} />
        <circle cx="15" cy="24" r="11.5" fill={a} />
        <circle cx="27" cy="25" r="11" fill={a} />
        <circle cx="38" cy="25" r="10" fill={a} />
        <circle cx="9" cy="15" r="9.5" fill={b} />
        <circle cx="21" cy="15" r="11" fill={a} />
        <circle cx="33" cy="16" r="9.5" fill={a} />
        <circle cx="16" cy="8" r="6.5" fill={b} />
        <circle cx="29" cy="8" r="7" fill={c} />
        <circle cx="24" cy="5" r="4.5" fill={c} />
        <circle cx="40" cy="10" r="4.5" fill={b} />
      </>
    );
  return (
    <svg viewBox={VB} width="100%" height="100%" preserveAspectRatio="xMidYMax meet" style={{ overflow: 'visible' }}>
      <g transform={`${flip ? 'scale(-1,1) translate(-44,0) ' : ''}rotate(${rot} 22 28)`}>{inner}</g>
    </svg>
  );
}

// Spend — a THICK tuft of spiky GRASS: a dense fan of slightly-curved pointed
// blades packed across the FULL width at varied heights (Figma: a full fringe of
// sharp grass spikes, lush but never towering). More, wider blades than a thin
// sprig so the cluster reads as a solid grassy band. `hw` = blade base half-width.
const blade = (bx: number, tx: number, ty: number, hw = 3) =>
  `M${bx - hw} 30 Q ${bx - hw * 0.4} ${(30 + ty) / 2} ${tx} ${ty} Q ${bx + hw * 0.4} ${(30 + ty) / 2} ${bx + hw} 30 Z`;
function GrassSprite({ index }: { index: number }) {
  const v = index % 3;
  const [a, b, c] = SHADES[index % 3];
  const flip = index % 2 === 1;
  // [baseX, tipX, tipY] per blade — tipY smaller = taller blade. ~9 blades packed
  // across the full 0–44 width so the tuft is dense/full rather than a few spikes.
  const blades: [number, number, number, string][] =
    v === 0
      ? [
          [2, 1, 9, a],
          [7, 8, 3, b],
          [12, 11, 12, a],
          [17, 18, 5, c],
          [22, 21, 1, a],
          [27, 28, 8, b],
          [32, 31, 3, a],
          [37, 38, 11, c],
          [42, 41, 6, a],
        ]
      : v === 1
        ? [
            [2, 3, 6, a],
            [7, 6, 13, b],
            [12, 13, 2, a],
            [18, 19, 9, a],
            [23, 22, 4, c],
            [28, 29, 12, b],
            [33, 32, 6, a],
            [38, 39, 2, a],
            [43, 42, 10, b],
          ]
        : [
            [2, 3, 4, a],
            [7, 6, 11, c],
            [12, 13, 7, a],
            [17, 16, 2, b],
            [22, 23, 10, a],
            [27, 26, 5, a],
            [32, 33, 13, b],
            [37, 36, 3, c],
            [42, 43, 8, a],
          ];
  return (
    <svg viewBox={VB} width="100%" height="100%" preserveAspectRatio="xMidYMax meet" style={{ overflow: 'visible' }}>
      <g transform={flip ? 'scale(-1,1) translate(-44,0)' : undefined}>
        {blades.map(([bx, tx, ty, fill], i) => (
          <path key={i} d={blade(bx, tx, ty)} fill={fill} />
        ))}
      </g>
    </svg>
  );
}

// goals — leafy curling sprout VINES: TWO curling stems that fan across the width
// with a generous scatter of small ROUND leaves (Figma: low, wispy curling vines
// with round leaves). Fuller/leafier than a lone stem — more leaves + a second
// stem fill the band while staying delicate. Leaves cluster in the visible upper
// band (y≈2–19); stem roots below the rim.
function VineSprite({ index }: { index: number }) {
  const v = index % 3;
  const [a, b, c] = SHADES[index % 3];
  const flip = index % 2 === 1;
  const inner =
    v === 0 ? (
      <>
        <path d="M15 30 C 15 22 8 21 11 13 C 13 6.5 23 8 21 2.5" fill="none" stroke={b} strokeWidth="2.2" strokeLinecap="round" />
        <path d="M31 30 C 32 24 40 24 37 18 C 35 14 30.5 16 33.5 19.5" fill="none" stroke={b} strokeWidth="2" strokeLinecap="round" />
        <circle cx="9" cy="17" r="3.6" fill={a} />
        <circle cx="13" cy="11" r="3" fill={c} />
        <circle cx="22" cy="8" r="3.4" fill={a} />
        <circle cx="21" cy="2.5" r="2.6" fill={b} />
        <circle cx="37" cy="16" r="3.2" fill={a} />
        <circle cx="33" cy="21" r="2.6" fill={c} />
        <circle cx="28" cy="13" r="2.5" fill={b} />
      </>
    ) : v === 1 ? (
      <>
        <path d="M22 30 C 22 22 29 21 26 13 C 24 6.5 14 8 16 2.5" fill="none" stroke={b} strokeWidth="2.2" strokeLinecap="round" />
        <path d="M8 30 C 7 24 -1 24 2 18 C 4 14 8.5 16 5.5 19.5" fill="none" stroke={b} strokeWidth="2" strokeLinecap="round" />
        <circle cx="28" cy="17" r="3.6" fill={a} />
        <circle cx="24" cy="11" r="3" fill={c} />
        <circle cx="15" cy="8" r="3.4" fill={a} />
        <circle cx="16" cy="2.5" r="2.6" fill={b} />
        <circle cx="1" cy="16" r="3.2" fill={a} />
        <circle cx="5" cy="21" r="2.6" fill={c} />
        <circle cx="10" cy="13" r="2.5" fill={b} />
      </>
    ) : (
      <>
        <path d="M20 30 C 20 23 12 22 15 14 C 17 8 26 10 24 4 C 23 1.5 22 1.5 22 0.5" fill="none" stroke={b} strokeWidth="2.2" strokeLinecap="round" />
        <path d="M34 30 C 35 24 42 25 39 19 C 37.5 15.5 33 17 36 20" fill="none" stroke={b} strokeWidth="1.9" strokeLinecap="round" />
        <circle cx="12" cy="18" r="3.6" fill={a} />
        <circle cx="16" cy="12" r="2.9" fill={c} />
        <circle cx="25" cy="9" r="3.2" fill={a} />
        <circle cx="23" cy="3.5" r="2.6" fill={b} />
        <circle cx="38" cy="18" r="3" fill={a} />
        <circle cx="9" cy="13" r="2.4" fill={b} />
        <circle cx="33" cy="22" r="2.4" fill={c} />
      </>
    );
  return (
    <svg viewBox={VB} width="100%" height="100%" preserveAspectRatio="xMidYMax meet" style={{ overflow: 'visible' }}>
      <g transform={flip ? 'scale(-1,1) translate(-44,0)' : undefined}>{inner}</g>
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
