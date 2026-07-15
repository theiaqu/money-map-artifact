import { DATASETS, type Dataset } from './scenario';

export type GraphColor = 'yellow' | 'blue' | 'green' | 'pink';

export type CardKind = 'income' | 'account' | 'goal';

// gate styling: full icon cards, compact text pills, plain-text-only labels, or
// the "skinny line" super-thin tree (only paired with the "super slim" account
// style). text-only renders bold uppercase text with no box alongside colored
// ropes; skinny-line renders a ~1px spine + thin elbows to each slim row.
export type BranchStyle = 'standard' | 'compact' | 'text-only' | 'skinny-line';

// overall visual style: the current flow canvas vs. the "Today's money map" look
export type MapStyle = 'flow' | 'money-map';

export interface CardNode {
  id: string;
  kind: CardKind;
  x: number;
  y: number;
  title: string;
  amount: string;
  suffix: string;
  graph: GraphColor;
  badge?: string; // "fund by" date shown on goal cards
  reached?: boolean; // goal funded -> pink check pill + filled graph
  pill?: string; // short category label for the "Title tertiary" / money-map pill
  mapMain?: string; // money-map (line variant) main text line for goal cards
}

export interface SectionNode {
  id: string;
  x: number;
  y: number;
  label: string;
  icon: 'calendar-sync' | 'goal';
}

export interface PercentBadge {
  id: string;
  x: number;
  y: number;
  text: string;
}

export interface Connector {
  id: string;
  d: string;
  arrow: boolean;
}

/* All coordinates are taken directly from the Figma frame "Account graph"
   (402 x 874). Positions are relative to the top-left of that frame. */

/* Card LAYOUT is DATASET-AWARE (the datasets have a different number of rows):
   only the titles/amounts/suffix/badge/pill/mapMain change per goal, but the
   Optimizer stacks 8 rows (income + core + spend + 5 goals) on a COMPACT vertical
   rhythm while Simple keeps its original 6-row (3-goal) spacing. `layoutFor` picks
   the row set; `cardsFor(dataset)` merges those positions with the active
   dataset's display strings. Simple's geometry below is byte-for-byte unchanged. */
interface CardLayout {
  id: string;
  kind: CardKind;
  x: number;
  y: number;
  graph: GraphColor;
}

const CARD_LAYOUT: CardLayout[] = [
  { id: 'income', kind: 'income', x: 93, y: 57, graph: 'yellow' },
  { id: 'core', kind: 'account', x: 158, y: 234, graph: 'blue' },
  { id: 'spend', kind: 'account', x: 157, y: 354, graph: 'green' },
  { id: 'ef1', kind: 'goal', x: 157, y: 478, graph: 'pink' },
  { id: 'debt', kind: 'goal', x: 157, y: 621, graph: 'pink' },
  { id: 'ef6', kind: 'goal', x: 157, y: 764, graph: 'pink' },
];

/* Optimizer rows EQUAL Simple's for every SHARED row (income / core / spend /
   ef1 / debt / ef6 sit at the EXACT SAME y as Simple's CARD_LAYOUT), then the two
   extra goals are APPENDED below, continuing Simple's debt->ef6 pitch (143px):
   travel = 764 + 143 = 907, brokerage = 907 + 143 = 1050. So the top of the page
   is pixel-identical to Simple and the page just extends downward (the board grows
   + .screen-scroll scrolls to reach the appended goals). Attach heights derived
   from these tops (accounts +55, goals +66) feed the "standard node.y" connector
   variants below. */
const CARD_LAYOUT_OPTIMIZER: CardLayout[] = [
  { id: 'income', kind: 'income', x: 93, y: 57, graph: 'yellow' },
  { id: 'core', kind: 'account', x: 158, y: 234, graph: 'blue' },
  { id: 'spend', kind: 'account', x: 157, y: 354, graph: 'green' },
  { id: 'ef1', kind: 'goal', x: 157, y: 478, graph: 'pink' },
  { id: 'debt', kind: 'goal', x: 157, y: 621, graph: 'pink' },
  { id: 'ef6', kind: 'goal', x: 157, y: 764, graph: 'pink' },
  { id: 'travel', kind: 'goal', x: 157, y: 907, graph: 'pink' },
  { id: 'brokerage', kind: 'goal', x: 157, y: 1050, graph: 'pink' },
];

// dataset-aware card row layout (Simple: 6 rows / Optimizer: 8 rows)
export const layoutFor = (dataset: Dataset): CardLayout[] =>
  dataset === 'optimizer' ? CARD_LAYOUT_OPTIMIZER : CARD_LAYOUT;

export function cardsFor(dataset: Dataset): CardNode[] {
  const cfg = DATASETS[dataset];
  const layout = layoutFor(dataset);
  const at = (id: string) => layout.find((c) => c.id === id)!;
  const account = (id: string, title: string, amount: string, pill: string): CardNode => {
    const l = at(id);
    return { id, kind: l.kind, x: l.x, y: l.y, graph: l.graph, title, amount, suffix: 'per month', pill };
  };
  const goalCard = (id: string): CardNode => {
    const l = at(id);
    const g = cfg.goals.find((gg) => gg.id === id)!;
    return { id, kind: l.kind, x: l.x, y: l.y, graph: l.graph, title: g.title, amount: g.amount, suffix: g.suffix, badge: g.badge, pill: g.pill, mapMain: g.mapMain };
  };
  const inc = at('income');
  return [
    { id: 'income', kind: inc.kind, x: inc.x, y: inc.y, graph: inc.graph, title: 'Income', amount: cfg.incomeAmount, suffix: 'per month' },
    account('core', 'Core Account', cfg.coreAmount, 'Core'),
    account('spend', 'Spend Account', cfg.spendAmount, 'Spend'),
    // every goal defined by the active dataset (Simple: 3 / Optimizer: 5)
    ...cfg.goals.map((g) => goalCard(g.id)),
  ];
}

export const sections: SectionNode[] = [
  { id: 'monthly', x: 10, y: 305, label: 'Monthly expenses', icon: 'calendar-sync' },
  { id: 'goals1', x: 10, y: 514, label: '1st Goals', icon: 'goal' },
  { id: 'goals2', x: 10, y: 736, label: '2nd Goals', icon: 'goal' },
];

/* Optimizer gates: the SAME monthly / 1st / 2nd gates as Simple (identical y's)
   plus a NEW 3rd gate appended below at the same gate-to-gate pitch (goals2 736 +
   (736-514)=222 -> 958). The icon-gate y's below only feed the (unused) standard
   icon style; every rendered gate style reads its own dataset-aware label map. */
export const sectionsOptimizer: SectionNode[] = [
  { id: 'monthly', x: 10, y: 305, label: 'Monthly expenses', icon: 'calendar-sync' },
  { id: 'goals1', x: 10, y: 514, label: '1st Goals', icon: 'goal' },
  { id: 'goals2', x: 10, y: 736, label: '2nd Goals', icon: 'goal' },
  { id: 'goals3', x: 10, y: 958, label: '3rd Goals', icon: 'goal' },
];

// dataset-aware section-node set (Optimizer gains the 3rd gate)
export const sectionsFor = (dataset: Dataset): SectionNode[] =>
  dataset === 'optimizer' ? sectionsOptimizer : sections;

/* Percent badges (compact / "Lines with %" gate only). Positions are identical
   across datasets; only the goal-gate percentages change. Simple: the 2nd gate
   splits by weight (debt 70% / ef6 30%). Optimizer: each 2nd-gate goal is the
   sole goal of its level, so both read 100%. The 1st gate is always 100%; the
   monthly-expense split badges (p70a/p30a) are stylised and unchanged. */
export function badgesFor(dataset: Dataset): PercentBadge[] {
  if (dataset === 'optimizer') {
    // Optimizer shares Simple's rows, so the monthly / 1st / 2nd gate badges sit at
    // the EXACT SAME positions Simple uses; each 2nd-gate goal is the sole goal of
    // its level, so both read 100%. The NEW 3rd gate (travel / brokerage) appends
    // two 100% badges below, shifted down by the 2nd->3rd card pitch (286px) so
    // they track the appended compact arm centers.
    return [
      { id: 'p70a', x: 110, y: 305, text: '70%' },
      { id: 'p30a', x: 110, y: 360, text: '30%' },
      { id: 'p100', x: 107, y: 535, text: '100%' },
      { id: 'p70b', x: 110, y: 718, text: '100%' },
      { id: 'p30b', x: 110, y: 772, text: '100%' },
      { id: 'p100c', x: 110, y: 1004, text: '100%' },
      { id: 'p100d', x: 110, y: 1058, text: '100%' },
    ];
  }
  return [
    { id: 'p70a', x: 110, y: 305, text: '70%' },
    { id: 'p30a', x: 110, y: 360, text: '30%' },
    { id: 'p100', x: 107, y: 535, text: '100%' },
    { id: 'p70b', x: 110, y: 718, text: '70%' },
    { id: 'p30b', x: 110, y: 772, text: '30%' },
  ];
}

/* Connectors recreated as smooth bezier paths matching the Figma vector
   bounding boxes. Section-to-section (vertical) and income->section flows
   carry an arrowhead; the fan-outs into cards do not. */
export const connectors: Connector[] = [
  // income -> monthly expenses
  { id: 'c-income-monthly', d: 'M201 167 C 201 255, 50.5 220, 50.5 305', arrow: true },
  // vertical section chain
  { id: 'c-monthly-goals1', d: 'M50.5 379 L 50.5 514', arrow: true },
  { id: 'c-goals1-goals2', d: 'M50.5 568 L 50.5 736', arrow: true },
  { id: 'c-goals2-down', d: 'M50.5 790 L 50.5 946', arrow: true },
  // monthly expenses fan-out (arms trimmed 10px short of card left edge -> x=147).
  // Symmetric wishbone: junction sits at the vertical MIDPOINT of its two cards
  // (core 289 / spend 409 -> 349) so both arms are exact vertical mirrors.
  { id: 'c-monthly-core', d: 'M91 349 C 126 349, 122 289, 147 289', arrow: false },
  { id: 'c-monthly-spend', d: 'M91 349 C 126 349, 122 409, 147 409', arrow: false },
  // 1st goals fan-out
  { id: 'c-goals1-ef1', d: 'M91 541 C 126 541, 122 544, 147 544', arrow: false },
  // 2nd goals fan-out — symmetric brace centered at midpoint (688/830 -> 759)
  { id: 'c-goals2-debt', d: 'M91 759 C 126 759, 122 688, 147 688', arrow: false },
  { id: 'c-goals2-ef6', d: 'M91 759 C 126 759, 122 830, 147 830', arrow: false },
];

/* Compact branch style (Figma "Account graph", node 417:12659): section nodes
   become small, LEFT-anchored text pills sitting on the spine. Pills (Figma
   frames): monthly 17,336 64x25 (two lines) centre ~(49,348); goals1 17,514
   58x15 centre ~(46,521); goals2 17,685 62x15 centre ~(48,692). The spine runs
   at x≈49 and meets each pill; the arrow lands just above the pill. Fan-outs to
   the account/goal cards emerge from each pill's right edge. */
export const connectorsCompact: Connector[] = [
  { id: 'c-income-monthly', d: 'M201 167 C 201 258, 49 246, 49 331', arrow: true },
  { id: 'c-monthly-goals1', d: 'M49 365 L 49 502', arrow: true },
  { id: 'c-goals1-goals2', d: 'M49 558 L 49 674', arrow: true },
  { id: 'c-goals2-down', d: 'M49 716 L 49 946', arrow: true },
  // symmetric wishbone/brace: junction at each gate's card midpoint (monthly 349,
  // goals2 759) so the two arms are exact vertical mirrors.
  { id: 'c-monthly-core', d: 'M81 349 C 120 349, 118 289, 147 289', arrow: false },
  { id: 'c-monthly-spend', d: 'M81 349 C 120 349, 118 409, 147 409', arrow: false },
  { id: 'c-goals1-ef1', d: 'M75 521 C 116 521, 112 544, 147 544', arrow: false },
  { id: 'c-goals2-debt', d: 'M79 759 C 118 759, 114 688, 147 688', arrow: false },
  { id: 'c-goals2-ef6', d: 'M79 759 C 118 759, 114 830, 147 830', arrow: false },
];

/* "Today's money map" connector geometry (Figma node 421:13818), mapped into the
   app's 402×960 grid. Kink-free flowchart curves: both control points sit at the
   horizontal midpoint so every arm leaves/arrives horizontally (no reversed
   handles). Monthly = symmetric wishbone from (85,348); 1st goal = a dead-straight
   horizontal at the pill center (522); 2nd goal = a brace from (78,693). Vertical
   attach = money-map card centers (core 277 / spend 397 / ef1 522 / debt 664 /
   ef6 819). Used ONLY by the money-map style — the flow/compact sets are untouched
   so their card attach heights don't shift. */
export const connectorsMoneyMap: Connector[] = [
  // income S-curve into the monthly pill (double-bezier, matches Vector 702).
  // Ends at 322 = top of the monthly gap (gap [322,352] centered on the wishbone
  // junction 337 so the label + brace sit in the break).
  { id: 'c-income-monthly', d: 'M201 168 C 201 197, 146 197, 106 222 C 66 247, 49 301, 49 322', arrow: false },

  // vertical spine (x=49), broken by a ~30px gap at each gate. Each gap is
  // CENTERED on that gate's brace/wishbone junction so the section label and the
  // emerging arm(s) share the break: monthly 337 -> [322,352]; goals1 522 ->
  // [507,537]; goals2 741.5 -> [726.5,756.5].
  { id: 'c-monthly-goals1', d: 'M49 352 L 49 507', arrow: false },
  { id: 'c-goals1-goals2', d: 'M49 537 L 49 726.5', arrow: false },
  { id: 'c-goals2-down', d: 'M49 756.5 L 49 946', arrow: false },

  // monthly wishbone — junction at the card midpoint (core 277 / spend 397 -> 337)
  // so both arms are EXACT vertical mirrors (±60). Arms trimmed 10px short (x=147).
  { id: 'c-monthly-core', d: 'M85 337 C 121 337, 121 277, 147 277', arrow: false },
  { id: 'c-monthly-spend', d: 'M85 337 C 121 337, 121 397, 147 397', arrow: false },

  // 1st goal — straight horizontal at the pill center
  { id: 'c-goals1-ef1', d: 'M78 522 L 147 522', arrow: false },

  // 2nd goal brace — junction at the card midpoint (debt 664 / ef6 819 -> 741.5)
  // so the brace is a symmetric mirror (±77.5) instead of lopsided.
  { id: 'c-goals2-debt', d: 'M78 741.5 C 118 741.5, 118 664, 147 664', arrow: false },
  { id: 'c-goals2-ef6', d: 'M78 741.5 C 118 741.5, 118 819, 147 819', arrow: false },
];

/* "Super slim" (skinny-line) rows use their OWN compact vertical layout — an even
   ~48px rhythm that matches Figma 496-5864 (Income pill top=77; the account column
   starts at top=125 with 24px rows + 24px gaps), instead of the tall shared node.y
   positions the other account styles use. Values below are the node-wrapper TOP; the
   name/target pill is 24px tall so its vertical CENTER is top+12. Resulting centers:
   income 89 / core 137 / spend 185 / ef1 233 / debt 281 / ef6 329 — exactly 48px
   apart, no large empty gaps. Only the slim style reads these (via Card.tsx). */
export const slimRowTop: Record<string, number> = {
  income: 77,
  core: 125,
  spend: 173,
  ef1: 221,
  debt: 269,
  ef6: 317,
};

/* "Skinny line" connector geometry (Figma 496-5864, the "super slim" frame):
   a SUPER-THIN (~1px) tree drawn to match the slim rows — no arrowheads, no
   rope/glow, no check badges, no gate labels. Rebuilt to mirror the Figma
   vectors exactly:

   - ONE continuous thin gray spine at board x=32 (Figma vector left=32), running
     straight down from the Income row (y=81) to the LAST gate's nub. In the Figma
     the spine terminates at the 2nd-goal gate — the bracket bar carries the final
     two goals — so there is no segment continuing off the bottom.
   - COMPACT ROUNDED BRACKETS at the two two-child gates: a short 16px nub leaves
     the spine (x32 -> bar x48) at the child MIDPOINT, a straight vertical bar runs
     up/down to each child's row center, and small rounded corners (r=8) turn the
     bar into short arms that STOP at x=64 (8px gap before the name column at x=72).
     This reproduces the subtle "{"-style bracket in the Figma, not a wide wishbone.
   - STRAIGHT TICKS at single connections: Income is just the top of the spine,
     and the 1st goal is a plain horizontal tick (x32 -> x64) at its row center.

   Vertical attach points are the slim rows' NEW compact pill centers (core 137 /
   spend 185 / ef1 233 / debt 281 / ef6 329, see slimRowTop above); each bracket
   nub sits at its gate's child midpoint (monthly 161, goals2 305). The spine
   starts at the Income pill's bottom (y=101). */
export const connectorsSkinny: Connector[] = [
  // one continuous thin spine at x=32, from the Income row down to the 2nd gate nub
  { id: 'c-income-monthly', d: 'M32 101 L 32 161', arrow: false },
  { id: 'c-monthly-goals1', d: 'M32 161 L 32 233', arrow: false },
  { id: 'c-goals1-goals2', d: 'M32 233 L 32 305', arrow: false },

  // monthly gate — compact rounded bracket: nub (x32->x48) at the child midpoint
  // (161), straight bar up/down to core(137)/spend(185), r=8 corners into arms
  // ending at x=64. Bar is drawn as the up-half + down-half so it reads as one
  // straight vertical with the nub T-ing in (matching the Figma render).
  { id: 'c-monthly-core', d: 'M32 161 L 48 161 L 48 145 Q 48 137 56 137 L 64 137', arrow: false },
  { id: 'c-monthly-spend', d: 'M32 161 L 48 161 L 48 177 Q 48 185 56 185 L 64 185', arrow: false },

  // 1st goal — simple straight thin tick off the spine at the row center
  { id: 'c-goals1-ef1', d: 'M32 233 L 64 233', arrow: false },

  // 2nd goal gate — compact rounded bracket, nub at the child midpoint (305),
  // bar up/down to debt(281)/ef6(329).
  { id: 'c-goals2-debt', d: 'M32 305 L 48 305 L 48 289 Q 48 281 56 281 L 64 281', arrow: false },
  { id: 'c-goals2-ef6', d: 'M32 305 L 48 305 L 48 321 Q 48 329 56 329 L 64 329', arrow: false },
];

/* "Minimalist icons" (Figma 729:6187) — a variant of the super-slim style: each
   row is a 52px white icon tile + name/amount text (+ goal date pill). Like slim,
   it uses its OWN compact vertical rhythm (NOT the tall shared node.y). Values
   below are the icon-tile TOP (= node-wrapper top); the tile is 52px tall so its
   vertical CENTER is top+26. Tops match Figma's ~62.6px row pitch: income 243,
   core 305.6, spend 373.4, ef1 436, debt 498.6, ef6 561.3 — all fit the 874px
   screen. Only the icon style reads these (via Card.tsx). */
export const iconRowTop: Record<string, number> = {
  income: 243,
  core: 305.6,
  spend: 373.4,
  ef1: 436,
  debt: 498.6,
  ef6: 561.3,
};

/* "Minimalist icons" connector geometry — the SAME super-thin (~1px) tree as the
   skinny renderer (spine + compact rounded brackets, no arrowheads/labels/badges),
   retuned to the icon-tile row centers. The icon tiles sit at left≈78.83, so the
   bracket arms end at x=74 (a small gap before the tile's left edge); the income
   tile sits ON the spine (income tile 11..63, spine x=40). Bar x=56, corner r=8.
   Attach centers (row top +26): core 331.6 / spend 399.4 / ef1 462 / debt 524.6 /
   ef6 587.3. Nubs at each gate's child midpoint (monthly 365.5, goals2 555.95);
   the 1st goal is a straight tick. Spine starts at the Income tile bottom (295). */
export const connectorsIcon: Connector[] = [
  // one continuous thin spine at x=40, from the Income tile down to the 2nd gate nub
  { id: 'c-income-monthly', d: 'M40 295 L 40 365.5', arrow: false },
  { id: 'c-monthly-goals1', d: 'M40 365.5 L 40 462', arrow: false },
  { id: 'c-goals1-goals2', d: 'M40 462 L 40 555.95', arrow: false },
  // monthly gate — compact rounded bracket up to core(331.6) / down to spend(399.4)
  { id: 'c-monthly-core', d: 'M40 365.5 L 56 365.5 L 56 339.6 Q 56 331.6 64 331.6 L 74 331.6', arrow: false },
  { id: 'c-monthly-spend', d: 'M40 365.5 L 56 365.5 L 56 391.4 Q 56 399.4 64 399.4 L 74 399.4', arrow: false },
  // 1st goal — straight thin tick off the spine at the ef1 row center
  { id: 'c-goals1-ef1', d: 'M40 462 L 74 462', arrow: false },
  // 2nd goal gate — compact rounded bracket up to debt(524.6) / down to ef6(587.3)
  { id: 'c-goals2-debt', d: 'M40 555.95 L 56 555.95 L 56 532.6 Q 56 524.6 64 524.6 L 74 524.6', arrow: false },
  { id: 'c-goals2-ef6', d: 'M40 555.95 L 56 555.95 L 56 579.3 Q 56 587.3 64 587.3 L 74 587.3', arrow: false },
];

/* "Conversational" (Figma 731:9883) — a narrative variant: a big lemon-yellow
   income header at the very top, then a vertical stack of full-width (312px)
   cards at left=65, each with a 64px illustration/date slot + a wrapping
   "conversational" sentence. Like slim/icons it uses its OWN compact vertical
   rhythm (NOT the tall shared node.y). Values below are the card node-wrapper TOP
   (taken from the Figma frame): core 377, spend 457, then a ~46px extra gap for
   the "Goals will receive…" caption before the first goal, ef1 585.65, debt
   667.65, ef6 747.65 (≈80px pitch). Income is rendered as the header block, so
   its row-top is unused (0). Only the convo style reads these (via Card.tsx). */
export const convoRowTop: Record<string, number> = {
  income: 150, // the rounded "hero" income card near the top (replaces the old header)
  core: 377,
  spend: 457,
  ef1: 585.65,
  debt: 667.65,
  ef6: 747.65,
};
export const CONVO_CARD_LEFT = 65;

/* "Conversational" connector geometry — the SAME clean thin rounded-bracket tree
   as the "Minimalist icons" (connectorsIcon) and "Super slim" (connectorsSkinny)
   styles: a straight thin vertical spine at x=40 with compact rounded right-angle
   brackets branching horizontally into each card (no arrowheads / gate labels /
   check badges / organic curves). Retuned to the convo rows: the cards sit at
   left=65, so bracket arms end at x=61 (a 4px gap before the card's left edge).
   Attach centers are the card vertical centers (row top + 36, the illustration
   slot's center): hero income 186 / core 413 / spend 493 / ef1 621.65 / debt
   703.65 / ef6 783.65. The hero income card is the tree origin — a straight tick
   from its left edge (x61) meets the spine at x40,186 where the spine begins.
   Nubs sit at each gate's child midpoint (monthly 453, goals2 743.65); the 1st
   goal is a straight tick. Bracket bar x=48, corner r=8. */
export const connectorsConvo: Connector[] = [
  // hero income origin: a straight tick into its left edge (x61,186) then the spine
  // turns down at x=40 and runs to the monthly-gate nub (this is the yellow pulse path)
  { id: 'c-income-monthly', d: 'M61 186 L 40 186 L 40 453', arrow: false },
  { id: 'c-monthly-goals1', d: 'M40 453 L 40 621.65', arrow: false },
  { id: 'c-goals1-goals2', d: 'M40 621.65 L 40 743.65', arrow: false },
  // monthly gate — compact rounded bracket up to core(413) / down to spend(493)
  { id: 'c-monthly-core', d: 'M40 453 L 48 453 L 48 421 Q 48 413 56 413 L 61 413', arrow: false },
  { id: 'c-monthly-spend', d: 'M40 453 L 48 453 L 48 485 Q 48 493 56 493 L 61 493', arrow: false },
  // 1st goal — straight thin tick off the spine at the ef1 row center
  { id: 'c-goals1-ef1', d: 'M40 621.65 L 61 621.65', arrow: false },
  // 2nd goal gate — compact rounded bracket up to debt(703.65) / down to ef6(783.65)
  { id: 'c-goals2-debt', d: 'M40 743.65 L 48 743.65 L 48 711.65 Q 48 703.65 56 703.65 L 61 703.65', arrow: false },
  { id: 'c-goals2-ef6', d: 'M40 743.65 L 48 743.65 L 48 775.65 Q 48 783.65 56 783.65 L 61 783.65', arrow: false },
];

/* "Stocks V1" (Figma node 519:6283) uses its OWN wider card rows — a centered
   Income card on top and a single wide right-column for accounts/goals — instead
   of the tall shared node.y layout the other stocks (V2) variant uses. Tops are
   taken directly from the Figma frame; only the stocks-V1 renderer reads these.
   Card left: income is centered (x=93, 216-wide on the 402 board); the account/
   goal column sits at x=164. */
export const v1RowTop: Record<string, number> = {
  income: 94,
  core: 279,
  spend: 387,
  ef1: 520,
  debt: 632,
  ef6: 741,
};
export const V1_CARD_LEFT = { income: 93, column: 164 } as const;

/* Stocks-V1 connector geometry (Figma node 519:6283): a THIN (~1.5px) gray spine
   at board x=49 with small brace/wishbone curves into the wide right-column cards.
   Each arm attaches at its card's mini-chart row center (row top + 50): core 329 /
   spend 437 / ef1 570 / debt 682 / ef6 791. The wishbone/brace junctions sit at
   the vertical midpoint of their two children (monthly 383, goals2 736.5) so both
   arms mirror; the 1st goal is a straight tick. The spine is broken by ~30px gaps
   centered on each gate junction so the boxed gate labels sit in the break:
   monthly 383 -> [368,398]; goals1 570 -> [555,585]; goals2 736.5 -> [721,752]. */
export const connectorsV1: Connector[] = [
  // income card -> monthly gate: an S-curve down-left into the top of the spine
  { id: 'c-income-monthly', d: 'M201 205 C 201 300, 49 300, 49 368', arrow: false },
  // vertical spine (x=49), broken by a gap at each gate junction
  { id: 'c-monthly-goals1', d: 'M49 398 L 49 555', arrow: false },
  { id: 'c-goals1-goals2', d: 'M49 585 L 49 721', arrow: false },
  { id: 'c-goals2-down', d: 'M49 752 L 49 946', arrow: false },
  // monthly wishbone — junction (90,383) into core (329) / spend (437)
  { id: 'c-monthly-core', d: 'M90 383 C 125 383, 125 329, 164 329', arrow: false },
  { id: 'c-monthly-spend', d: 'M90 383 C 125 383, 125 437, 164 437', arrow: false },
  // 1st goal — straight tick from the spine to the ef1 card
  { id: 'c-goals1-ef1', d: 'M90 570 L 164 570', arrow: false },
  // 2nd goal brace — junction (90,736.5) into debt (682) / ef6 (791)
  { id: 'c-goals2-debt', d: 'M90 736.5 C 125 736.5, 125 682, 164 682', arrow: false },
  { id: 'c-goals2-ef6', d: 'M90 736.5 C 125 736.5, 125 791, 164 791', arrow: false },
];

/* Short PINK accent segments overlaid on the V1 spine near the goal gates (Figma
   Vector 733/731). Purely decorative — drawn on top of the gray spine at x=49. */
export const V1_PINK_SEGMENTS: { y1: number; y2: number }[] = [
  { y1: 440, y2: 465 },
  { y1: 525, y2: 550 },
  { y1: 608, y2: 665 },
];

/* "Stocks Condensed" (Figma node 522:6440) — a THIRD stocks Version. Cards are
   compact horizontal rows (title + amount on the left, a tiny mini-chart, then
   "Every Month" for accounts or a progress-ring + stacked date for goals). Rows
   are tighter/higher than V1, so condensed gets its OWN row-top + connector set.
   Income is centered (reuses the V1 income card); the account/goal column is the
   wide 267px card at x≈122 (accounts) / x≈117 (goals). */
export const condensedRowTop: Record<string, number> = {
  income: 94,
  core: 306,
  spend: 389,
  ef1: 484,
  debt: 601,
  ef6: 678,
};
export const CONDENSED_CARD_LEFT = { income: 93, account: 122, goal: 117 } as const;

/* Condensed connector geometry (Figma 522:6440): same THIN gray spine + brace
   treatment as V1, retuned to the condensed row centers. Arms attach at each
   card's vertical center (core 342 / spend 425 / ef1 531 / debt 636 / ef6 725);
   wishbone/brace junctions sit at the child midpoints (monthly 383.5, goals2
   680.5); the 1st goal is a straight tick. Spine gaps are centered on each
   junction so the boxed gate labels sit in the break. Card left edges are close
   to the spine here, so the arms are short "(" curves ending at x≈116/120. */
export const connectorsCondensed: Connector[] = [
  // income card -> monthly gate: same S-curve as V1 into the top of the spine
  { id: 'c-income-monthly', d: 'M201 205 C 201 300, 49 300, 49 368', arrow: false },
  // vertical spine (x=49), broken by a gap at each gate junction
  { id: 'c-monthly-goals1', d: 'M49 399 L 49 516', arrow: false },
  { id: 'c-goals1-goals2', d: 'M49 546 L 49 665', arrow: false },
  { id: 'c-goals2-down', d: 'M49 696 L 49 946', arrow: false },
  // monthly wishbone — junction (89,383.5) into core (342) / spend (425)
  { id: 'c-monthly-core', d: 'M89 383.5 C 105 383.5, 105 342, 120 342', arrow: false },
  { id: 'c-monthly-spend', d: 'M89 383.5 C 105 383.5, 105 425, 120 425', arrow: false },
  // 1st goal — straight tick to the ef1 card
  { id: 'c-goals1-ef1', d: 'M89 531 L 116 531', arrow: false },
  // 2nd goal brace — junction (89,680.5) into debt (636) / ef6 (725)
  { id: 'c-goals2-debt', d: 'M89 680.5 C 104 680.5, 104 636, 116 636', arrow: false },
  { id: 'c-goals2-ef6', d: 'M89 680.5 C 104 680.5, 104 725, 116 725', arrow: false },
];

/* Condensed pink spine accent (Figma Vector 733) — a single short segment. */
export const CONDENSED_PINK_SEGMENTS: { y1: number; y2: number }[] = [
  { y1: 440, y2: 465 },
];

/* ============================================================================
   OPTIMIZER connector geometry (8 rows / 4 gates)

   Each set below is a VERBATIM COPY of its Simple counterpart above for every
   SHARED connector (c-income-monthly, the monthly wishbone, the 1st-goal tick,
   and the 2nd-goals brace are pixel-identical to Simple), then EXTENDED with a
   3rd goal gate:
     - the vertical spine continues downward via an extra hop `c-goals2-goals3`
       (mirrors `c-goals1-goals2`), replacing Simple's `c-goals2-down`, and
     - a symmetric 2-child brace `c-goals3-travel` + `c-goals3-brokerage` that is
       the `c-goals2-*` brace SHIFTED DOWN to the appended travel/brokerage row
       centers (same arm x-coords, same junction-at-midpoint construction), and
     - `c-goals3-down` continues the spine off the (taller) board's bottom.
   The Simple arrays are left byte-for-byte unchanged; datasets are selected via
   the `*For(dataset)` helpers at the bottom of this block.
   ============================================================================ */

// Standard flow (icon gate nodes). node.y layout; goal attach = card center +66.
// Shared rows verbatim from `connectors`. 2nd brace junction 759 (debt 688 / ef6
// 830); 3rd brace = that brace shifted +286 -> junction 1044.5 (travel 973 /
// brokerage 1116).
export const connectorsOptimizer: Connector[] = [
  { id: 'c-income-monthly', d: 'M201 167 C 201 255, 50.5 220, 50.5 305', arrow: true },
  { id: 'c-monthly-goals1', d: 'M50.5 379 L 50.5 514', arrow: true },
  { id: 'c-goals1-goals2', d: 'M50.5 568 L 50.5 736', arrow: true },
  { id: 'c-monthly-core', d: 'M91 349 C 126 349, 122 289, 147 289', arrow: false },
  { id: 'c-monthly-spend', d: 'M91 349 C 126 349, 122 409, 147 409', arrow: false },
  { id: 'c-goals1-ef1', d: 'M91 541 C 126 541, 122 544, 147 544', arrow: false },
  { id: 'c-goals2-debt', d: 'M91 759 C 126 759, 122 688, 147 688', arrow: false },
  { id: 'c-goals2-ef6', d: 'M91 759 C 126 759, 122 830, 147 830', arrow: false },
  // 3rd gate (appended): spine hop goals2 -> goals3, then the shifted brace
  { id: 'c-goals2-goals3', d: 'M50.5 790 L 50.5 1022', arrow: true },
  { id: 'c-goals3-travel', d: 'M91 1044.5 C 126 1044.5, 122 973, 147 973', arrow: false },
  { id: 'c-goals3-brokerage', d: 'M91 1044.5 C 126 1044.5, 122 1116, 147 1116', arrow: false },
  { id: 'c-goals3-down', d: 'M50.5 1076 L 50.5 1186', arrow: true },
];

// Compact ("Lines with %"): spine x=49 with on-spine text pills; node.y attach
// (accounts +55, goals +66). Shared rows verbatim from `connectorsCompact`. 2nd
// brace junction 759; 3rd brace = that brace shifted +286 -> junction 1044.5.
export const connectorsCompactOptimizer: Connector[] = [
  { id: 'c-income-monthly', d: 'M201 167 C 201 258, 49 246, 49 331', arrow: true },
  { id: 'c-monthly-goals1', d: 'M49 365 L 49 502', arrow: true },
  { id: 'c-goals1-goals2', d: 'M49 558 L 49 674', arrow: true },
  { id: 'c-monthly-core', d: 'M81 349 C 120 349, 118 289, 147 289', arrow: false },
  { id: 'c-monthly-spend', d: 'M81 349 C 120 349, 118 409, 147 409', arrow: false },
  { id: 'c-goals1-ef1', d: 'M75 521 C 116 521, 112 544, 147 544', arrow: false },
  { id: 'c-goals2-debt', d: 'M79 759 C 118 759, 114 688, 147 688', arrow: false },
  { id: 'c-goals2-ef6', d: 'M79 759 C 118 759, 114 830, 147 830', arrow: false },
  // 3rd gate (appended): spine hop goals2 -> goals3, then the shifted brace
  { id: 'c-goals2-goals3', d: 'M49 716 L 49 1001', arrow: true },
  { id: 'c-goals3-travel', d: 'M79 1044.5 C 118 1044.5, 114 973, 147 973', arrow: false },
  { id: 'c-goals3-brokerage', d: 'M79 1044.5 C 118 1044.5, 114 1116, 147 1116', arrow: false },
  { id: 'c-goals3-down', d: 'M49 1076 L 49 1186', arrow: true },
];

// "Today's money map": thick pastel ropes; node.y layout, money-map card centers.
// Shared rows verbatim from `connectorsMoneyMap` (junctions monthly 337 / goals1
// 522 / goals2 741.5; spine broken by ~30px gaps centered on each junction). 3rd
// brace = the 2nd brace shifted +286 -> junction 1027.5 (travel 950 / brokerage
// 1105).
export const connectorsMoneyMapOptimizer: Connector[] = [
  { id: 'c-income-monthly', d: 'M201 168 C 201 197, 146 197, 106 222 C 66 247, 49 301, 49 322', arrow: false },
  { id: 'c-monthly-goals1', d: 'M49 352 L 49 507', arrow: false },
  { id: 'c-goals1-goals2', d: 'M49 537 L 49 726.5', arrow: false },
  { id: 'c-monthly-core', d: 'M85 337 C 121 337, 121 277, 147 277', arrow: false },
  { id: 'c-monthly-spend', d: 'M85 337 C 121 337, 121 397, 147 397', arrow: false },
  { id: 'c-goals1-ef1', d: 'M78 522 L 147 522', arrow: false },
  { id: 'c-goals2-debt', d: 'M78 741.5 C 118 741.5, 118 664, 147 664', arrow: false },
  { id: 'c-goals2-ef6', d: 'M78 741.5 C 118 741.5, 118 819, 147 819', arrow: false },
  // 3rd gate (appended): spine hop goals2 -> goals3, then the shifted brace
  { id: 'c-goals2-goals3', d: 'M49 756.5 L 49 1012.5', arrow: false },
  { id: 'c-goals3-travel', d: 'M78 1027.5 C 118 1027.5, 118 950, 147 950', arrow: false },
  { id: 'c-goals3-brokerage', d: 'M78 1027.5 C 118 1027.5, 118 1105, 147 1105', arrow: false },
  { id: 'c-goals3-down', d: 'M49 1042.5 L 49 1186', arrow: false },
];

/* Super-slim rows: EQUAL Simple's slimRowTop for the shared rows (already a 48px
   pitch), then travel/brokerage appended at that SAME 48px pitch. Centers = top +
   12: income 89 / core 137 / spend 185 / ef1 233 / debt 281 / ef6 329 / travel
   377 / brokerage 425. Spine x=32 runs from Income (101) to the 3rd-gate nub (401). */
export const slimRowTopOptimizer: Record<string, number> = {
  income: 77,
  core: 125,
  spend: 173,
  ef1: 221,
  debt: 269,
  ef6: 317,
  travel: 365,
  brokerage: 413,
};

export const connectorsSkinnyOptimizer: Connector[] = [
  { id: 'c-income-monthly', d: 'M32 101 L 32 161', arrow: false },
  { id: 'c-monthly-goals1', d: 'M32 161 L 32 233', arrow: false },
  { id: 'c-goals1-goals2', d: 'M32 233 L 32 305', arrow: false },
  { id: 'c-goals2-goals3', d: 'M32 305 L 32 401', arrow: false },
  { id: 'c-monthly-core', d: 'M32 161 L 48 161 L 48 145 Q 48 137 56 137 L 64 137', arrow: false },
  { id: 'c-monthly-spend', d: 'M32 161 L 48 161 L 48 177 Q 48 185 56 185 L 64 185', arrow: false },
  { id: 'c-goals1-ef1', d: 'M32 233 L 64 233', arrow: false },
  { id: 'c-goals2-debt', d: 'M32 305 L 48 305 L 48 289 Q 48 281 56 281 L 64 281', arrow: false },
  { id: 'c-goals2-ef6', d: 'M32 305 L 48 305 L 48 321 Q 48 329 56 329 L 64 329', arrow: false },
  { id: 'c-goals3-travel', d: 'M32 401 L 48 401 L 48 385 Q 48 377 56 377 L 64 377', arrow: false },
  { id: 'c-goals3-brokerage', d: 'M32 401 L 48 401 L 48 417 Q 48 425 56 425 L 64 425', arrow: false },
];

/* Minimalist-icon rows: EQUAL Simple's iconRowTop for the shared rows (already a
   ~62.6px pitch), then travel/brokerage appended at that SAME pitch. Tops: income
   243 / core 305.6 / spend 373.4 / ef1 436 / debt 498.6 / ef6 561.3 / travel 623.9
   / brokerage 686.5. brokerage tile bottom 738.5 still fits the 874px screen, so
   this style stays COMPACT for Optimizer too (no tall-board rule). */
export const iconRowTopOptimizer: Record<string, number> = {
  income: 243,
  core: 305.6,
  spend: 373.4,
  ef1: 436,
  debt: 498.6,
  ef6: 561.3,
  travel: 623.9,
  brokerage: 686.5,
};

// Shared rows verbatim from `connectorsIcon` (monthly nub 365.5 / goals2 nub
// 555.95). 3rd gate appended: spine hops goals2 -> goals3 (nub at the travel/
// brokerage midpoint 681.2), then a symmetric brace up to travel(649.9) / down to
// brokerage(712.5). Centers = row top +26.
export const connectorsIconOptimizer: Connector[] = [
  { id: 'c-income-monthly', d: 'M40 295 L 40 365.5', arrow: false },
  { id: 'c-monthly-goals1', d: 'M40 365.5 L 40 462', arrow: false },
  { id: 'c-goals1-goals2', d: 'M40 462 L 40 555.95', arrow: false },
  { id: 'c-monthly-core', d: 'M40 365.5 L 56 365.5 L 56 339.6 Q 56 331.6 64 331.6 L 74 331.6', arrow: false },
  { id: 'c-monthly-spend', d: 'M40 365.5 L 56 365.5 L 56 391.4 Q 56 399.4 64 399.4 L 74 399.4', arrow: false },
  { id: 'c-goals1-ef1', d: 'M40 462 L 74 462', arrow: false },
  { id: 'c-goals2-debt', d: 'M40 555.95 L 56 555.95 L 56 532.6 Q 56 524.6 64 524.6 L 74 524.6', arrow: false },
  { id: 'c-goals2-ef6', d: 'M40 555.95 L 56 555.95 L 56 579.3 Q 56 587.3 64 587.3 L 74 587.3', arrow: false },
  // 3rd gate (appended): spine hop goals2 -> goals3, then the shifted brace
  { id: 'c-goals2-goals3', d: 'M40 555.95 L 40 681.2', arrow: false },
  { id: 'c-goals3-travel', d: 'M40 681.2 L 56 681.2 L 56 657.9 Q 56 649.9 64 649.9 L 74 649.9', arrow: false },
  { id: 'c-goals3-brokerage', d: 'M40 681.2 L 56 681.2 L 56 704.5 Q 56 712.5 64 712.5 L 74 712.5', arrow: false },
];

/* Conversational rows: EQUAL Simple's convoRowTop for the shared rows (already an
   ~80px pitch), then travel/brokerage appended at that SAME 80px pitch: income 0
   / core 377 / spend 457 / ef1 585.65 / debt 667.65 / ef6 747.65 / travel 827.65
   / brokerage 907.65. brokerage card bottom (~980) fits the taller 1200px
   Optimizer board (which scrolls to reach the appended goals). */
export const convoRowTopOptimizer: Record<string, number> = {
  income: 150,
  core: 377,
  spend: 457,
  ef1: 585.65,
  debt: 667.65,
  ef6: 747.65,
  travel: 827.65,
  brokerage: 907.65,
};

// Shared rows verbatim from `connectorsConvo` (hero origin tick + spine; monthly
// nub 453 / goals2 nub 743.65). 3rd gate appended: spine hops goals2 -> goals3
// (nub at the travel/brokerage midpoint 903.65), then a compact rounded bracket
// up to travel(863.65) / down to brokerage(943.65). Centers = row top + 36.
export const connectorsConvoOptimizer: Connector[] = [
  { id: 'c-income-monthly', d: 'M61 186 L 40 186 L 40 453', arrow: false },
  { id: 'c-monthly-goals1', d: 'M40 453 L 40 621.65', arrow: false },
  { id: 'c-goals1-goals2', d: 'M40 621.65 L 40 743.65', arrow: false },
  { id: 'c-monthly-core', d: 'M40 453 L 48 453 L 48 421 Q 48 413 56 413 L 61 413', arrow: false },
  { id: 'c-monthly-spend', d: 'M40 453 L 48 453 L 48 485 Q 48 493 56 493 L 61 493', arrow: false },
  { id: 'c-goals1-ef1', d: 'M40 621.65 L 61 621.65', arrow: false },
  { id: 'c-goals2-debt', d: 'M40 743.65 L 48 743.65 L 48 711.65 Q 48 703.65 56 703.65 L 61 703.65', arrow: false },
  { id: 'c-goals2-ef6', d: 'M40 743.65 L 48 743.65 L 48 775.65 Q 48 783.65 56 783.65 L 61 783.65', arrow: false },
  // 3rd gate (appended): spine hop goals2 -> goals3, then the compact rounded bracket
  { id: 'c-goals2-goals3', d: 'M40 743.65 L 40 903.65', arrow: false },
  { id: 'c-goals3-travel', d: 'M40 903.65 L 48 903.65 L 48 871.65 Q 48 863.65 56 863.65 L 61 863.65', arrow: false },
  { id: 'c-goals3-brokerage', d: 'M40 903.65 L 48 903.65 L 48 935.65 Q 48 943.65 56 943.65 L 61 943.65', arrow: false },
];

/* Stocks V1 wide rows: EQUAL Simple's v1RowTop for the shared rows, then
   travel/brokerage appended continuing the debt->ef6 pitch (109px): travel = 741
   + 109 = 850, brokerage = 850 + 109 = 959. Attach = row top + 50. */
export const v1RowTopOptimizer: Record<string, number> = {
  income: 94,
  core: 279,
  spend: 387,
  ef1: 520,
  debt: 632,
  ef6: 741,
  travel: 850,
  brokerage: 959,
};

// Shared rows verbatim from `connectorsV1` (junctions monthly 383 / goals1 570 /
// goals2 736.5). 3rd brace = the 2nd brace shifted +218 -> junction 954.5 (travel
// 900 / brokerage 1009).
export const connectorsV1Optimizer: Connector[] = [
  { id: 'c-income-monthly', d: 'M201 205 C 201 300, 49 300, 49 368', arrow: false },
  { id: 'c-monthly-goals1', d: 'M49 398 L 49 555', arrow: false },
  { id: 'c-goals1-goals2', d: 'M49 585 L 49 721', arrow: false },
  { id: 'c-monthly-core', d: 'M90 383 C 125 383, 125 329, 164 329', arrow: false },
  { id: 'c-monthly-spend', d: 'M90 383 C 125 383, 125 437, 164 437', arrow: false },
  { id: 'c-goals1-ef1', d: 'M90 570 L 164 570', arrow: false },
  { id: 'c-goals2-debt', d: 'M90 736.5 C 125 736.5, 125 682, 164 682', arrow: false },
  { id: 'c-goals2-ef6', d: 'M90 736.5 C 125 736.5, 125 791, 164 791', arrow: false },
  // 3rd gate (appended): spine hop goals2 -> goals3, then the shifted brace
  { id: 'c-goals2-goals3', d: 'M49 752 L 49 939.5', arrow: false },
  { id: 'c-goals3-travel', d: 'M90 954.5 C 125 954.5, 125 900, 164 900', arrow: false },
  { id: 'c-goals3-brokerage', d: 'M90 954.5 C 125 954.5, 125 1009, 164 1009', arrow: false },
  { id: 'c-goals3-down', d: 'M49 969.5 L 49 1186', arrow: false },
];

export const V1_PINK_SEGMENTS_OPTIMIZER: { y1: number; y2: number }[] = [
  { y1: 430, y2: 455 },
  { y1: 560, y2: 590 },
  { y1: 720, y2: 770 },
];

/* Stocks Condensed rows: EQUAL Simple's condensedRowTop for the shared rows, then
   travel/brokerage appended continuing the debt->ef6 pitch (77px): travel = 678 +
   77 = 755, brokerage = 755 + 77 = 832. Attach = card center (accounts +36,
   goals +47). */
export const condensedRowTopOptimizer: Record<string, number> = {
  income: 94,
  core: 306,
  spend: 389,
  ef1: 484,
  debt: 601,
  ef6: 678,
  travel: 755,
  brokerage: 832,
};

// Shared rows verbatim from `connectorsCondensed` (junctions monthly 383.5 /
// goals1 531 / goals2 680.5). 3rd brace = the 2nd brace shifted +154 -> junction
// 834.5 (travel 790 / brokerage 879).
export const connectorsCondensedOptimizer: Connector[] = [
  { id: 'c-income-monthly', d: 'M201 205 C 201 300, 49 300, 49 368', arrow: false },
  { id: 'c-monthly-goals1', d: 'M49 399 L 49 516', arrow: false },
  { id: 'c-goals1-goals2', d: 'M49 546 L 49 665', arrow: false },
  { id: 'c-monthly-core', d: 'M89 383.5 C 105 383.5, 105 342, 120 342', arrow: false },
  { id: 'c-monthly-spend', d: 'M89 383.5 C 105 383.5, 105 425, 120 425', arrow: false },
  { id: 'c-goals1-ef1', d: 'M89 531 L 116 531', arrow: false },
  { id: 'c-goals2-debt', d: 'M89 680.5 C 104 680.5, 104 636, 116 636', arrow: false },
  { id: 'c-goals2-ef6', d: 'M89 680.5 C 104 680.5, 104 725, 116 725', arrow: false },
  // 3rd gate (appended): spine hop goals2 -> goals3, then the shifted brace
  { id: 'c-goals2-goals3', d: 'M49 696 L 49 819', arrow: false },
  { id: 'c-goals3-travel', d: 'M89 834.5 C 104 834.5, 104 790, 116 790', arrow: false },
  { id: 'c-goals3-brokerage', d: 'M89 834.5 C 104 834.5, 104 879, 116 879', arrow: false },
  { id: 'c-goals3-down', d: 'M49 850 L 49 1186', arrow: false },
];

export const CONDENSED_PINK_SEGMENTS_OPTIMIZER: { y1: number; y2: number }[] = [
  { y1: 400, y2: 425 },
  { y1: 660, y2: 700 },
];

/* ---------- dataset-aware selectors (Simple vs Optimizer) ---------- */
export const connectorsFor = (dataset: Dataset): Connector[] =>
  dataset === 'optimizer' ? connectorsOptimizer : connectors;
export const connectorsCompactFor = (dataset: Dataset): Connector[] =>
  dataset === 'optimizer' ? connectorsCompactOptimizer : connectorsCompact;
export const connectorsMoneyMapFor = (dataset: Dataset): Connector[] =>
  dataset === 'optimizer' ? connectorsMoneyMapOptimizer : connectorsMoneyMap;
export const connectorsSkinnyFor = (dataset: Dataset): Connector[] =>
  dataset === 'optimizer' ? connectorsSkinnyOptimizer : connectorsSkinny;
export const connectorsV1For = (dataset: Dataset): Connector[] =>
  dataset === 'optimizer' ? connectorsV1Optimizer : connectorsV1;
export const connectorsCondensedFor = (dataset: Dataset): Connector[] =>
  dataset === 'optimizer' ? connectorsCondensedOptimizer : connectorsCondensed;
export const v1PinkSegmentsFor = (dataset: Dataset): { y1: number; y2: number }[] =>
  dataset === 'optimizer' ? V1_PINK_SEGMENTS_OPTIMIZER : V1_PINK_SEGMENTS;
export const condensedPinkSegmentsFor = (dataset: Dataset): { y1: number; y2: number }[] =>
  dataset === 'optimizer' ? CONDENSED_PINK_SEGMENTS_OPTIMIZER : CONDENSED_PINK_SEGMENTS;
export const slimRowTopFor = (dataset: Dataset): Record<string, number> =>
  dataset === 'optimizer' ? slimRowTopOptimizer : slimRowTop;
export const iconRowTopFor = (dataset: Dataset): Record<string, number> =>
  dataset === 'optimizer' ? iconRowTopOptimizer : iconRowTop;
export const connectorsIconFor = (dataset: Dataset): Connector[] =>
  dataset === 'optimizer' ? connectorsIconOptimizer : connectorsIcon;
export const convoRowTopFor = (dataset: Dataset): Record<string, number> =>
  dataset === 'optimizer' ? convoRowTopOptimizer : convoRowTop;
export const connectorsConvoFor = (dataset: Dataset): Connector[] =>
  dataset === 'optimizer' ? connectorsConvoOptimizer : connectorsConvo;
export const v1RowTopFor = (dataset: Dataset): Record<string, number> =>
  dataset === 'optimizer' ? v1RowTopOptimizer : v1RowTop;
export const condensedRowTopFor = (dataset: Dataset): Record<string, number> =>
  dataset === 'optimizer' ? condensedRowTopOptimizer : condensedRowTop;
