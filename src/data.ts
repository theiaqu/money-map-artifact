import { DATASETS, sheetGrowWindows, type Dataset, type Mode } from './scenario';

export type GraphColor = 'yellow' | 'blue' | 'green' | 'pink';

export type CardKind = 'income' | 'account' | 'goal';

// gate styling: full icon cards, compact text pills, plain-text-only labels, or
// the "skinny line" super-thin tree (only paired with the "super slim" account
// style). text-only renders bold uppercase text with no box alongside colored
// ropes; skinny-line renders a ~1px spine + thin elbows to each slim row.
// `icon-labeled` is a SECOND gate offered only for the "Minimalist icons" style:
// a labeled left spine (gate-label pills) + straight thin brackets (same clean
// vocabulary as the "Bracket" gate) into indented icon tiles + a left-aligned
// income tile with a straight gray drop onto the spine (Figma 738:7107).
// 'pbi-locked' is a gate offered ONLY for the "Progress bar, inside" style
// (Figma 802:10378): a bold WHITE rounded spine + heavy organic white curvy
// branches, plain title-case gray gate labels (no pill), gray padlock discs ON
// the spine at each level boundary that UNLOCK as the flow completes that level,
// and a soft vertical gold→green→pink page gradient behind the tree.
// 'pbi-grouped' is ANOTHER "Progress bar, inside"-only gate (Figma 802:10601):
// closely related to Locked path — same hero + income pills, a thin light left
// spine with circular PADLOCK discs at each level boundary, and white curvy
// branches into the pbi cards — but the cards of each SECTION are wrapped in a
// rounded COLORED SECTION PANEL sitting behind them (teal "Monthly Expenses"
// group, pink "Goals" group) with a small section label in the panel's top-left.
// 'pbi-grouped2' ("Grouped 2", Figma 802:10838) is a variant of 'pbi-grouped' —
// SAME grouped-section-panels concept but with GRAY panels and a DIFFERENT branch
// routing: the arms leave the main spine via a short bend to an OFFSET secondary
// riser (x=97) and the padlock discs sit at those offset branch junctions rather
// than directly on the main spine.
// 'pbi-indented' ("Indented", Figma 886:12513) is a "Progress bar, inside"-only
// gate: a far-left main spine that steps RIGHT into nested risers, with small
// amount pills ($5,000, $2,000, …) sitting on each branch stub before it reaches
// the card. No section labels — the indentation itself expresses the hierarchy.
// 'pbi-split' ("Section split", Figma 907:12864) is a "Progress bar, inside"-only
// gate: the SAME text-gate tree (thin spine, on-spine text pills, white wishbones)
// as 'text-only', plus a full-width dashed DIVIDER line between each section
// (Monthly | Goals | …) — no colored panels, just the dividers.
export type BranchStyle = 'standard' | 'compact' | 'text-only' | 'skinny-line' | 'icon-labeled' | 'pbi-locked' | 'pbi-grouped' | 'pbi-sectionlabel' | 'pbi-income-section' | 'pbi-grouped2' | 'pbi-split' | 'pbi-indented';

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
  { id: 'c-income-monthly', d: 'M50.5 170 L 50.5 305', arrow: true },
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
  { id: 'c-income-monthly', d: 'M49 170 L 49 331', arrow: true },
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
  { id: 'c-income-monthly', d: 'M49 170 L 49 322', arrow: false },

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

/* "Minimalist icons" (Figma 773:8879) — a serif-hero + icon-row layout. A hero
   header (sprout logo · subtitle · large serif headline) sits above a single
   left-aligned column of rows; each row is a 48px white icon tile + name/amount
   text (+ goal date pill). Uses its OWN compact vertical rhythm (NOT the tall
   shared node.y): the whole column is left-aligned at ICON_LIST_LEFT and starts
   BELOW the hero. Values below are the icon-tile TOP (= node-wrapper top); the tile
   is 48px tall so its vertical CENTER is top+24. Rows sit on Figma's 64px pitch
   (48 tile + 16 gap): income 351, core 415, spend 479, ef1 543, debt 607, ef6 671
   — all fit the 874px screen (Simple has 6 rows). */
export const ICON_LIST_LEFT = 72; // single left-aligned tile column (Figma list left)
export const iconRowTop: Record<string, number> = {
  income: 351,
  core: 415,
  spend: 479,
  ef1: 543,
  debt: 607,
  ef6: 671,
};

/* "Minimalist icons" connector geometry (Figma 773:8879) — a thin (~1px) gray
   left spine at x=24 with short rounded ELBOW/BRACKET branches, each ending in a
   small ARROWHEAD pointing right into its tile (tile left 72, arms end at x=64).
   Unlike the old bracket gate, EVERY tile (income included) is a branch off the
   spine: income is a straight arm at the top, core/spend and the multi-goal gates
   are rounded brackets, single goals are straight arms. Bar x=40, corner r=8.
   Attach centers (row top +24): income 375 / core 439 / spend 503 / ef1 567 /
   debt 631 / ef6 695. Gate junctions sit at each gate's child midpoint (monthly
   471, goals2 663). `c-income-arm` is a static (un-pulsed) arm into the income
   tile; the spine + arms carry the causal pulses unchanged. */
export const connectorsIcon: Connector[] = [
  // static arm at the income row (arrowhead) — income is the SOURCE, so the arm
  // is drawn tile -> spine (M64 -> M24) and its head points OUT of the income tile
  // toward the spine (the direction money flows on to Monthly Expenses), matching
  // the other icon arms which point into their destination tiles.
  { id: 'c-income-arm', d: 'M64 375 L 24 375', arrow: true },
  // one continuous thin spine at x=24, income row down to the 2nd gate junction
  { id: 'c-income-monthly', d: 'M24 375 L 24 471', arrow: false },
  { id: 'c-monthly-goals1', d: 'M24 471 L 24 567', arrow: false },
  { id: 'c-goals1-goals2', d: 'M24 567 L 24 663', arrow: false },
  // monthly gate — rounded bracket up to core(439) / down to spend(503), arrowheads
  { id: 'c-monthly-core', d: 'M24 471 L 40 471 L 40 447 Q 40 439 48 439 L 64 439', arrow: true },
  { id: 'c-monthly-spend', d: 'M24 471 L 40 471 L 40 495 Q 40 503 48 503 L 64 503', arrow: true },
  // 1st goal — straight thin arm off the spine at the ef1 row center
  { id: 'c-goals1-ef1', d: 'M24 567 L 64 567', arrow: true },
  // 2nd goal gate — rounded bracket up to debt(631) / down to ef6(695)
  { id: 'c-goals2-debt', d: 'M24 663 L 40 663 L 40 639 Q 40 631 48 631 L 64 631', arrow: true },
  { id: 'c-goals2-ef6', d: 'M24 663 L 40 663 L 40 687 Q 40 695 48 695 L 64 695', arrow: true },
];

/* ============================================================================
   "Labeled" gate style for the Minimalist icons card (Figma node 738:7107).

   A DISTINCT layout used ONLY when Account style = icons + Gate style = Labeled
   (BranchStyle 'icon-labeled'). Same look as the default icon thin-bracket tree,
   but with on-spine gate LABEL pills and the brackets spaced right to clear them:
   - INCOME is LEFT-ALIGNED at the top of the left spine: the 52px tile at left 11
     (center x≈37) with its "Income / $X/mo" text stacked ABOVE it (text top≈62).
   - a straight GRAY income branch drops from the income tile onto the vertical
     LEFT SPINE at x≈49 (no yellow swoop — gray at rest, colored only while a pulse
     travels).
   - the section gates render AS labeled white pills ON the spine (MONTHLY
     EXPENSES / 1ST / 2ND [/ 3RD]) — see SectionNodeView's ICON_LABELED map.
   - STRAIGHT thin BRACKETS (the same clean right-angle/rounded vocabulary as the
     Bracket gate's connectorsIcon) fan from each gate junction on the spine into
     the LEFT edge of each icon tile, with the bracket bar pushed right (x=90) so
     the label pills are never cramped. Tiles are INDENTED right (tile left≈116;
     text left≈182; goal date pills far right).

   Row TOPS are taken directly from the Figma frame (already in the 402-wide
   board space): core 252, spend 319.82, ef1 382.43, debt 452, ef6 514.61; income
   is positioned specially (text top 62 / tile top ~107). Optimizer appends the
   3rd-gate goals continuing the within-gate pitch: travel 600 (Figma "6th row"),
   brokerage 662.61 (= 600 + the debt→ef6 pitch 62.61). Tile CENTER = top + 26. */
export const iconLabeledRowTop: Record<string, number> = {
  income: 62, // text top; the centered tile follows below (~top 107)
  core: 252,
  spend: 319.82,
  ef1: 382.43,
  debt: 452,
  ef6: 514.61,
};
export const iconLabeledRowTopOptimizer: Record<string, number> = {
  income: 62,
  core: 252,
  spend: 319.82,
  ef1: 382.43,
  debt: 452,
  ef6: 514.61,
  travel: 600,
  brokerage: 662.61,
};

// income block position + indented tile column (board coords). Income is
// LEFT-ALIGNED at the top of the left spine (tile left 11, matching the default
// "Bracket" icon gate), with its "Income / $X/mo" text stacked above the tile —
// so the tree reads as starting from a left-aligned income. Its tile center
// (x≈37) sits over the spine (x=49) and the income→spine connector drops from it.
export const ICON_LABELED_INCOME_LEFT = 11;
export const ICON_LABELED_INCOME_TOP = 62;
export const ICON_LABELED_TILE_LEFT = 116;

/* "Labeled" connector geometry — an ALL-GRAY thin tree that reuses the SAME clean
   STRAIGHT-BRACKET vocabulary as the default "Bracket" icon gate (connectorsIcon):
   a left spine + short right-angle brackets (nub off the spine → vertical bar →
   r=8 rounded corner → horizontal arm into the tile). NO curvy/wavy S-branches.
   Uses the SAME connector ids the scenario/pulse engine expects so causal pulses
   travel it unchanged (income yellow / core blue / spend green / goals pink) over
   the gray resting strokes.

   Difference vs. the Bracket gate: the spine stays at x=49 (so the on-spine white
   gate-label pills — "MONTHLY EXPENSES" / "1ST" / "2ND" [/ "3RD"] — stay put), and
   the bracket VERTICAL BAR is pushed RIGHT to x=90 (past the label pills, which end
   ~x=82) so the labels are never cramped/overlapped by the brackets. Each bracket:
   nub M49→x90 at the gate junction (its first ~30px hidden behind the label pill,
   so it reads as fanning out of the labeled gate), bar up/down to the child center,
   r=8 corner, then a short horizontal arm ending at x=112 (a small gap before the
   tile left edge 116).

   The income→spine connector is a straight gray vertical drop from the LEFT-aligned
   income tile center (x≈37, bottom y≈158) with a single r=8 rounded elbow onto the
   spine at the monthly junction (49,311.9) — the elbow sits behind the MONTHLY pill,
   so the visible income branch reads as one clean straight line. Gray at rest, no
   permanent yellow (no reintroduced swoop).

   Gate junctions sit on the spine (x=49) at each gate's child MIDPOINT so the
   brackets mirror: monthly 311.9 (core 278 / spend 345.82); 1st goal is a straight
   branch at the ef1 center 408.43; 2nd goal 509.3 (debt 478 / ef6 540.61). Tile
   centers = row top + 26. */
export const connectorsIconLabeled: Connector[] = [
  // income → spine: straight gray drop from the left income tile center (37,158),
  // r=8 elbow onto the spine at the monthly junction (49,311.9) — elbow behind pill
  { id: 'c-income-monthly', d: 'M37 158 L 37 303.9 Q 37 311.9 45 311.9 L 49 311.9', arrow: false },
  // vertical spine hops (broken visually by the on-spine white gate pills)
  { id: 'c-monthly-goals1', d: 'M49 311.9 L 49 408.43', arrow: false },
  { id: 'c-goals1-goals2', d: 'M49 408.43 L 49 509.3', arrow: false },
  // monthly bracket — nub→bar(x90)→r8 corner→arm up to core(278) / down to spend(345.82)
  { id: 'c-monthly-core', d: 'M49 311.9 L 90 311.9 L 90 286 Q 90 278 98 278 L 112 278', arrow: false },
  { id: 'c-monthly-spend', d: 'M49 311.9 L 90 311.9 L 90 337.82 Q 90 345.82 98 345.82 L 112 345.82', arrow: false },
  // 1st goal — straight thin branch at the ef1 center
  { id: 'c-goals1-ef1', d: 'M49 408.43 L 112 408.43', arrow: false },
  // 2nd goal bracket — up to debt(478) / down to ef6(540.61)
  { id: 'c-goals2-debt', d: 'M49 509.3 L 90 509.3 L 90 486 Q 90 478 98 478 L 112 478', arrow: false },
  { id: 'c-goals2-ef6', d: 'M49 509.3 L 90 509.3 L 90 532.61 Q 90 540.61 98 540.61 L 112 540.61', arrow: false },
];

// Optimizer: shared rows verbatim, then the 3rd gate appended — spine hop
// goals2 → goals3 (junction at the travel/brokerage midpoint 657.3), then the SAME
// straight bracket up to travel(626) / down to brokerage(688.61).
export const connectorsIconLabeledOptimizer: Connector[] = [
  { id: 'c-income-monthly', d: 'M37 158 L 37 303.9 Q 37 311.9 45 311.9 L 49 311.9', arrow: false },
  { id: 'c-monthly-goals1', d: 'M49 311.9 L 49 408.43', arrow: false },
  { id: 'c-goals1-goals2', d: 'M49 408.43 L 49 509.3', arrow: false },
  { id: 'c-monthly-core', d: 'M49 311.9 L 90 311.9 L 90 286 Q 90 278 98 278 L 112 278', arrow: false },
  { id: 'c-monthly-spend', d: 'M49 311.9 L 90 311.9 L 90 337.82 Q 90 345.82 98 345.82 L 112 345.82', arrow: false },
  { id: 'c-goals1-ef1', d: 'M49 408.43 L 112 408.43', arrow: false },
  { id: 'c-goals2-debt', d: 'M49 509.3 L 90 509.3 L 90 486 Q 90 478 98 478 L 112 478', arrow: false },
  { id: 'c-goals2-ef6', d: 'M49 509.3 L 90 509.3 L 90 532.61 Q 90 540.61 98 540.61 L 112 540.61', arrow: false },
  // 3rd gate (appended): spine hop goals2 → goals3, then the straight bracket
  { id: 'c-goals2-goals3', d: 'M49 509.3 L 49 657.3', arrow: false },
  { id: 'c-goals3-travel', d: 'M49 657.3 L 90 657.3 L 90 634 Q 90 626 98 626 L 112 626', arrow: false },
  { id: 'c-goals3-brokerage', d: 'M49 657.3 L 90 657.3 L 90 680.61 Q 90 688.61 98 688.61 L 112 688.61', arrow: false },
];

/* "Conversational" (Figma 738:7662) — a narrative variant. Income is a plain
   top-left TEXT block ("Income / $X/mo", no card); a gray left spine at x=49 runs
   down from below it; gate labels sit beside the spine as plain gray uppercase
   text; and curvy WISHBONE branches (the icons "Labeled" gate vocabulary) fan from
   each gate's child-midpoint on the spine into the LEFT edge of each 262px-wide
   card at left=121. Row TOPS are taken directly from the Figma frame (74px cards):
   core 238, spend 318, ef1 414 (extra gap for the 1st-goal gate), debt 510, ef6
   588. Illustration-slot center = row top + 37. Income is rendered separately (see
   CONVO_INCOME_*), so its row-top is unused. Only the convo style reads these. */
export const convoRowTop: Record<string, number> = {
  income: 159, // unused for card layout — income is a plain text block (CONVO_INCOME_TOP)
  core: 238,
  spend: 318,
  ef1: 414,
  debt: 510,
  ef6: 588,
};
export const CONVO_CARD_LEFT = 121;

// income plain-text block position (Figma 738:7685): "Income" over "$X/mo" at the
// top-left, with the spine dropping from just below it.
export const CONVO_INCOME_LEFT = 24;
export const CONVO_INCOME_TOP = 159;

/* "Conversational" connector geometry (Figma 738:7662) — a gray left spine at x=49
   with smooth CURVY WISHBONE S-branches into the LEFT-center of each card. Income
   is a plain top-left text block sitting directly above the spine, so
   `c-income-monthly` is a straight vertical spine drop (no swoop). Uses the SAME
   connector ids the pulse engine expects, so causal pulses travel it unchanged
   (income yellow / core blue / spend green / goals pink).

   Each wishbone arm is a single cubic whose handle ratios are taken straight from
   the Figma branch vector (path - bills: `M47 41 C 12.9 41, 37.5 2, 2 2` in a 45px
   box → ~0.77 handle length with the two control handles OVERSHOOTING past each
   other). That gives every arm a uniformly-rounded flowing S: it leaves the spine
   horizontally, makes its vertical transition in the middle, and arrives into the
   card horizontally — no tight kink near the spine, no sharp elbows. `CV_ARM`
   builds that arm for a junction `jy` on the spine (x=49) into a card center `cy`
   (arms end at x=115, a 6px gap before the card left edge 121; dx=66, handle=51.5
   ≈ 0.78·dx). Gate junctions sit at each gate's child MIDPOINT so the arms mirror:
   monthly 315 (core 275 / spend 355); the 1st goal is a straight branch at the ef1
   center 451; 2nd goal 586 (debt 547 / ef6 625). Card centers = row top + 37. */
const CV_ARM = (jy: number, cy: number): string =>
  `M49 ${jy} C 100 ${jy}, 64 ${cy}, 115 ${cy}`;
export const connectorsConvo: Connector[] = [
  // income (plain top-left text) -> straight spine drop to the monthly junction
  { id: 'c-income-monthly', d: 'M49 200 L 49 315', arrow: false },
  // vertical spine hops between gates
  { id: 'c-monthly-goals1', d: 'M49 315 L 49 451', arrow: false },
  { id: 'c-goals1-goals2', d: 'M49 451 L 49 586', arrow: false },
  // monthly wishbone — flowing S-branches up to core(275) / down to spend(355)
  { id: 'c-monthly-core', d: CV_ARM(315, 275), arrow: false },
  { id: 'c-monthly-spend', d: CV_ARM(315, 355), arrow: false },
  // 1st goal — straight organic branch at the ef1 center
  { id: 'c-goals1-ef1', d: 'M49 451 L 115 451', arrow: false },
  // 2nd goal wishbone — up to debt(547) / down to ef6(625)
  { id: 'c-goals2-debt', d: CV_ARM(586, 547), arrow: false },
  { id: 'c-goals2-ef6', d: CV_ARM(586, 625), arrow: false },
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
  { id: 'c-income-monthly', d: 'M49 170 L 49 368', arrow: false },
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
  { id: 'c-income-monthly', d: 'M49 170 L 49 368', arrow: false },
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
  { id: 'c-income-monthly', d: 'M50.5 170 L 50.5 305', arrow: true },
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
  { id: 'c-income-monthly', d: 'M49 170 L 49 331', arrow: true },
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
  { id: 'c-income-monthly', d: 'M49 170 L 49 322', arrow: false },
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

/* Minimalist-icon rows (Optimizer): EQUAL Simple's iconRowTop for the shared rows
   (64px pitch), then travel/brokerage appended at that SAME pitch. Tops: income
   351 / core 415 / spend 479 / ef1 543 / debt 607 / ef6 671 / travel 735 /
   brokerage 799. brokerage tile bottom 847 fits the 960px board, so this style
   stays COMPACT for Optimizer too (no tall-board rule). */
export const iconRowTopOptimizer: Record<string, number> = {
  income: 351,
  core: 415,
  spend: 479,
  ef1: 543,
  debt: 607,
  ef6: 671,
  travel: 735,
  brokerage: 799,
};

// Shared rows verbatim from `connectorsIcon` (monthly junction 471 / goals2
// junction 663). 3rd gate appended: spine hops goals2 -> goals3 (junction at the
// travel/brokerage midpoint 791), then a rounded bracket up to travel(759) / down
// to brokerage(823). Centers = row top + 24.
export const connectorsIconOptimizer: Connector[] = [
  // income is the SOURCE: arm drawn tile -> spine so its head points OUT of income
  { id: 'c-income-arm', d: 'M64 375 L 24 375', arrow: true },
  { id: 'c-income-monthly', d: 'M24 375 L 24 471', arrow: false },
  { id: 'c-monthly-goals1', d: 'M24 471 L 24 567', arrow: false },
  { id: 'c-goals1-goals2', d: 'M24 567 L 24 663', arrow: false },
  { id: 'c-monthly-core', d: 'M24 471 L 40 471 L 40 447 Q 40 439 48 439 L 64 439', arrow: true },
  { id: 'c-monthly-spend', d: 'M24 471 L 40 471 L 40 495 Q 40 503 48 503 L 64 503', arrow: true },
  { id: 'c-goals1-ef1', d: 'M24 567 L 64 567', arrow: true },
  { id: 'c-goals2-debt', d: 'M24 663 L 40 663 L 40 639 Q 40 631 48 631 L 64 631', arrow: true },
  { id: 'c-goals2-ef6', d: 'M24 663 L 40 663 L 40 687 Q 40 695 48 695 L 64 695', arrow: true },
  // 3rd gate (appended): spine hop goals2 -> goals3, then the rounded bracket
  { id: 'c-goals2-goals3', d: 'M24 663 L 24 791', arrow: false },
  { id: 'c-goals3-travel', d: 'M24 791 L 40 791 L 40 767 Q 40 759 48 759 L 64 759', arrow: true },
  { id: 'c-goals3-brokerage', d: 'M24 791 L 40 791 L 40 815 Q 40 823 48 823 L 64 823', arrow: true },
];

/* Conversational rows (Figma 738:7662): EQUAL Simple's convoRowTop for the shared
   rows, then travel/brokerage appended below ef6 continuing the gate rhythm (a ~96px
   gate gap before the 3rd gate, then the 78px within-gate pitch): core 238 / spend
   318 / ef1 414 / debt 510 / ef6 588 / travel 684 / brokerage 762. brokerage card
   bottom (~836) fits the taller 1200px Optimizer board (which scrolls). */
export const convoRowTopOptimizer: Record<string, number> = {
  income: 159,
  core: 238,
  spend: 318,
  ef1: 414,
  debt: 510,
  ef6: 588,
  travel: 684,
  brokerage: 762,
};

// Shared rows verbatim from `connectorsConvo` (income spine drop; monthly junction
// 315 / goals2 junction 586; ef1 straight branch). 3rd gate appended: spine hops
// goals2 -> goals3 (junction at the travel/brokerage midpoint 760), then the SAME
// flowing wishbone up to travel(721) / down to brokerage(799). Centers = row top + 37.
export const connectorsConvoOptimizer: Connector[] = [
  { id: 'c-income-monthly', d: 'M49 200 L 49 315', arrow: false },
  { id: 'c-monthly-goals1', d: 'M49 315 L 49 451', arrow: false },
  { id: 'c-goals1-goals2', d: 'M49 451 L 49 586', arrow: false },
  { id: 'c-monthly-core', d: CV_ARM(315, 275), arrow: false },
  { id: 'c-monthly-spend', d: CV_ARM(315, 355), arrow: false },
  { id: 'c-goals1-ef1', d: 'M49 451 L 115 451', arrow: false },
  { id: 'c-goals2-debt', d: CV_ARM(586, 547), arrow: false },
  { id: 'c-goals2-ef6', d: CV_ARM(586, 625), arrow: false },
  // 3rd gate (appended): spine hop goals2 -> goals3, then the SAME flowing wishbone
  { id: 'c-goals2-goals3', d: 'M49 586 L 49 760', arrow: false },
  { id: 'c-goals3-travel', d: CV_ARM(760, 721), arrow: false },
  { id: 'c-goals3-brokerage', d: CV_ARM(760, 799), arrow: false },
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
  { id: 'c-income-monthly', d: 'M49 170 L 49 368', arrow: false },
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
  { id: 'c-income-monthly', d: 'M49 170 L 49 368', arrow: false },
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

/* ============================================================================
   "Sheet" (Figma node 753:7971) — a grouped-panel layout. Income is a small
   white card TOP-LEFT with a gray left spine (x=52.5) dropping from it. The
   Core/Spend rows live inside a soft-MINT "MONTHLY EXPENSES" panel; each row is
   a BLACK amount pill on the connector linked to a WHITE name card. A BLACK
   "~$X/mo" surplus pill + gray "for goals" sits between the panels. The goal
   rows live inside a soft-PINK "GOALS" panel; each row is a BLACK weight-% pill
   on the connector linked to a WHITE goal card with a dark FUNDING/FUNDED footer.
   Reuses the same connector ids the pulse engine expects (income yellow / core
   blue / spend green / goals pink) so causal pulses travel it unchanged.

   Row TOPS are the node-wrapper top of each card: account cards are ~40px tall
   (center = top + 20), goal cards are 70px tall (center = top + 35). Simple stops
   at the 2nd gate (3 goals); Optimizer appends the 3rd gate (travel + brokerage),
   growing the GOALS panel + board. Only the sheet style reads these. */
export const SHEET_INCOME_LEFT = 24;
export const SHEET_INCOME_TOP = 110;
export const SHEET_ACCT_LEFT = 232; // white name-card left (Core / Spend)
export const SHEET_GOAL_LEFT = 168; // white goal-card left
export const SHEET_GOAL_W = 198; // fixed goal-card width so the names fit one line + footers read consistently

export const sheetRowTop: Record<string, number> = {
  income: 110,
  core: 232, // center 252
  spend: 306, // center 326
  ef1: 509, // center 544 (h70)
  debt: 604, // center 639
  ef6: 689, // center 724
};
export const sheetRowTopOptimizer: Record<string, number> = {
  income: 110,
  core: 232,
  spend: 306,
  ef1: 509,
  debt: 604,
  ef6: 689,
  travel: 784, // center 819
  brokerage: 869, // center 904
};

/* Sheet connector geometry (Figma 753:7971) — a thin DARK/near-black left spine at
   x=52.5 with ORTHOGONAL (right-angle) elbow connectors whose corners are slightly
   ROUNDED (radius 8, taken straight from the Figma vectors: the spine + brackets
   are all `H/V` runs joined by r=8 quarter-arcs, e.g. Vector 772/774/779). Each
   two-child gate is an orthogonal wishbone: a short horizontal STUB leaves the
   spine at the gate's child MIDPOINT, meets a vertical BAR at x=96, and the bar
   turns (r=8) into the two horizontal arms at the child card centers. Single-child
   gates (the 1st goal) are a straight horizontal branch. The black amount/% pills
   sit ON these horizontal arms between the bar and the card, then the arm carries
   on as a short stub INTO the card. Account arms end at x=228 (name-card left minus
   a gap); goal arms end at x=164 (goal-card left minus a gap). Uses the SAME
   connector ids the pulse engine expects (income yellow / core blue / spend green /
   goals pink) so causal pulses travel the elbows unchanged.

   SH_ARM builds one orthogonal arm from a spine junction `jy` (stub -> bar x=96 ->
   r=8 corner -> horizontal into `endX`) at the card center `cy`. Monthly junction
   289 (core 252 / spend 326); 1st goal straight at ef1 544; 2nd goal junction 681.5
   (debt 639 / ef6 724). */
const SH_BAR = 96; // orthogonal wishbone vertical-bar x (matches Figma Vector 774/779)
const SH_R = 8; // elbow corner radius
const SH_ARM = (jy: number, cy: number, endX: number): string => {
  const vy = cy < jy ? cy + SH_R : cy - SH_R; // vertical run stops SH_R short of the corner
  return `M52.5 ${jy} L ${SH_BAR} ${jy} L ${SH_BAR} ${vy} Q ${SH_BAR} ${cy} ${SH_BAR + SH_R} ${cy} L ${endX} ${cy}`;
};
export const connectorsSheet: Connector[] = [
  { id: 'c-income-monthly', d: 'M52.5 158 L 52.5 289', arrow: false },
  { id: 'c-monthly-goals1', d: 'M52.5 289 L 52.5 544', arrow: false },
  { id: 'c-goals1-goals2', d: 'M52.5 544 L 52.5 681.5', arrow: false },
  // monthly orthogonal wishbone — up to core(252) / down to spend(326)
  { id: 'c-monthly-core', d: SH_ARM(289, 252, 228), arrow: false },
  { id: 'c-monthly-spend', d: SH_ARM(289, 326, 228), arrow: false },
  // 1st goal — straight branch at the ef1 center
  { id: 'c-goals1-ef1', d: 'M52.5 544 L 164 544', arrow: false },
  // 2nd goal orthogonal wishbone — up to debt(639) / down to ef6(724)
  { id: 'c-goals2-debt', d: SH_ARM(681.5, 639, 164), arrow: false },
  { id: 'c-goals2-ef6', d: SH_ARM(681.5, 724, 164), arrow: false },
];

// Optimizer: shared rows verbatim, then the 3rd gate appended — spine hop
// goals2 → goals3 (junction at the travel/brokerage midpoint 861.5), then a
// symmetric orthogonal wishbone up to travel(819) / down to brokerage(904).
export const connectorsSheetOptimizer: Connector[] = [
  { id: 'c-income-monthly', d: 'M52.5 158 L 52.5 289', arrow: false },
  { id: 'c-monthly-goals1', d: 'M52.5 289 L 52.5 544', arrow: false },
  { id: 'c-goals1-goals2', d: 'M52.5 544 L 52.5 681.5', arrow: false },
  { id: 'c-monthly-core', d: SH_ARM(289, 252, 228), arrow: false },
  { id: 'c-monthly-spend', d: SH_ARM(289, 326, 228), arrow: false },
  { id: 'c-goals1-ef1', d: 'M52.5 544 L 164 544', arrow: false },
  { id: 'c-goals2-debt', d: SH_ARM(681.5, 639, 164), arrow: false },
  { id: 'c-goals2-ef6', d: SH_ARM(681.5, 724, 164), arrow: false },
  { id: 'c-goals2-goals3', d: 'M52.5 681.5 L 52.5 861.5', arrow: false },
  { id: 'c-goals3-travel', d: SH_ARM(861.5, 819, 164), arrow: false },
  { id: 'c-goals3-brokerage', d: SH_ARM(861.5, 904, 164), arrow: false },
];

export interface SheetPanel { id: string; x: number; y: number; w: number; h: number; tint: 'mint' | 'pink'; label: string; }
export interface SheetPill { id: string; x: number; y: number; text: string; kind: 'amount' | 'pct' | 'surplus'; }

const fmtMoney = (n: number) => `$${n.toLocaleString('en-US')}`;

// the two grouped panels; the GOALS panel grows for Optimizer's 5 goals
export function sheetPanelsFor(dataset: Dataset): SheetPanel[] {
  const goalsH = dataset === 'optimizer' ? 500 : 320;
  return [
    { id: 'monthly', x: 72, y: 200, w: 304, h: 173, tint: 'mint', label: 'MONTHLY EXPENSES' },
    { id: 'goals', x: 72, y: 459, w: 304, h: goalsH, tint: 'pink', label: 'GOALS' },
  ];
}

// the black pills that sit ON the connectors: Core/Spend monthly amounts, the
// surplus divider, and each goal's funding-weight %. Amounts + surplus come from
// the active dataset's real money model; % is the goal's weight.
export function sheetPillsFor(dataset: Dataset): SheetPill[] {
  const cfg = DATASETS[dataset];
  const surplus = cfg.income - cfg.coreMax - cfg.spendMax;
  const pills: SheetPill[] = [
    { id: 'amt-core', x: 145, y: 252, text: `${cfg.coreAmount}/mo`, kind: 'amount' },
    { id: 'amt-spend', x: 145, y: 326, text: `${cfg.spendAmount}/mo`, kind: 'amount' },
    { id: 'surplus', x: 71, y: 421, text: `~${fmtMoney(surplus)}/mo`, kind: 'surplus' },
  ];
  const pctY: Record<string, number> = { ef1: 544, debt: 639, ef6: 724, travel: 819, brokerage: 904 };
  // single-goal gates read 100%; multi-goal gates read each goal's weight
  const levelCounts: Record<number, number> = {};
  cfg.goals.forEach((g) => (levelCounts[g.level] = (levelCounts[g.level] ?? 0) + 1));
  for (const g of cfg.goals) {
    const solo = levelCounts[g.level] === 1;
    const pct = solo ? 100 : Math.round(g.weight * 100);
    // ef1 (1st goal) is a straight branch so its pill sits further right; wishbone
    // pills sit a touch right of the spine on the curving arm
    const x = g.id === 'ef1' ? 129 : 132;
    pills.push({ id: `pct-${g.id}`, x, y: pctY[g.id], text: `${pct}%`, kind: 'pct' });
  }
  return pills;
}

export const sheetRowTopFor = (dataset: Dataset): Record<string, number> =>
  dataset === 'optimizer' ? sheetRowTopOptimizer : sheetRowTop;
export const connectorsSheetFor = (dataset: Dataset): Connector[] =>
  dataset === 'optimizer' ? connectorsSheetOptimizer : connectorsSheet;

/* ---------- "Sheet" branch-assembly reveal (Sheet style ONLY) ----------
   The sheet map ASSEMBLES as the near-black branch grows: each pill/card pops in
   the instant the growing branch tip first reaches its attach point. This maps
   every sheet ELEMENT id (income/account/goal cards, the black $/% pills, the
   two tinted panels, the surplus divider + "for goals" caption) to the simulated
   MONTH it should reveal, derived from the connector growth windows
   (sheetGrowWindows): a CARD reveals when its incoming arm finishes (tip touches
   the card = the segment window end), and a PILL reveals partway along its
   segment (the arc-length fraction where the pill sits). Both datasets read this;
   ids a dataset never draws simply map to 0 and are never rendered. */

// arc-length fraction where a pill sits along one orthogonal wishbone ARM built
// by SH_ARM(jy, cy, endX). The pill sits on the FINAL horizontal run at x=px, so
// its distance-along = stub + vertical + corner-arc + (px - corner end), over the
// arm's full length. Mirrors SH_ARM's geometry so it tracks any arm tweak.
function sheetArmFrac(jy: number, cy: number, endX: number, px: number): number {
  const vy = cy < jy ? cy + SH_R : cy - SH_R;
  const s1 = SH_BAR - 52.5; // stub from spine to the vertical bar
  const s2 = Math.abs(vy - jy); // vertical bar run
  const arc = (Math.PI / 2) * SH_R; // rounded corner
  const cornerEndX = SH_BAR + SH_R; // where the final horizontal run begins (x=104)
  const s3 = endX - cornerEndX; // final horizontal run into the card
  const total = s1 + s2 + arc + s3;
  const along = s1 + s2 + arc + (px - cornerEndX);
  return Math.max(0, Math.min(1, along / total));
}

// per-element reveal month for the sheet assembly (see sheetGrowWindows)
export function sheetRevealMonths(dataset: Dataset, mode: Mode): Record<string, number> {
  const w = sheetGrowWindows(dataset, mode);
  const end = (id: string) => w[id]?.end ?? 0;
  const at = (id: string, f: number) => {
    const s = w[id];
    return s ? s.start + f * (s.end - s.start) : 0;
  };
  return {
    // income card appears as the very first stub starts drawing from it
    income: w['c-income-monthly']?.start ?? 0,
    // account + goal cards pop when their incoming arm reaches the card
    core: end('c-monthly-core'),
    spend: end('c-monthly-spend'),
    ef1: end('c-goals1-ef1'),
    debt: end('c-goals2-debt'),
    ef6: end('c-goals2-ef6'),
    travel: end('c-goals3-travel'),
    brokerage: end('c-goals3-brokerage'),
    // black pills pop as the growing tip passes their on-line position
    'amt-core': at('c-monthly-core', sheetArmFrac(289, 252, 228, 145)),
    'amt-spend': at('c-monthly-spend', sheetArmFrac(289, 326, 228, 145)),
    'pct-ef1': at('c-goals1-ef1', (129 - 52.5) / (164 - 52.5)),
    'pct-debt': at('c-goals2-debt', sheetArmFrac(681.5, 639, 164, 132)),
    'pct-ef6': at('c-goals2-ef6', sheetArmFrac(681.5, 724, 164, 132)),
    'pct-travel': at('c-goals3-travel', sheetArmFrac(861.5, 819, 164, 132)),
    'pct-brokerage': at('c-goals3-brokerage', sheetArmFrac(861.5, 904, 164, 132)),
    // surplus divider + caption sit on the monthly→goals1 spine at y=421
    surplus: at('c-monthly-goals1', (421 - 289) / (544 - 289)),
    'for-goals': at('c-monthly-goals1', (421 - 289) / (544 - 289)),
    // tinted panels fade in as the tip reaches their gate region
    monthly: end('c-income-monthly'),
    goals: end('c-monthly-goals1'),
  };
}

// ~0.27s pop at the illustrative clock (1.35s/mo) — sheet is illustrative-only
const SHEET_POP_MONTHS = 0.2;
const SHEET_GHOST = 0.09; // faint gray imprint opacity before an element reveals
const easeOutCubic01 = (x: number) => 1 - Math.pow(1 - x, 3);
// gentle ease-out-back (small overshoot ~+1-2%) for the subtle scale pop
const easeOutBackTiny = (x: number) => {
  const c = 1.2;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
};

export interface SheetRevealStyle {
  opacity: number;
  scale: number;
}
// element pop state at `now` (sim months): a faint ghost imprint before its
// reveal month, then a ~220-300ms fade (0→1) + scale (0.9→~1.02→1) pop, driven
// entirely off the sim clock so pause/scrub/restart all stay in sync.
export function sheetRevealStyle(now: number, revealMonth: number): SheetRevealStyle {
  const p = (now - revealMonth) / SHEET_POP_MONTHS;
  if (p <= 0) return { opacity: SHEET_GHOST, scale: 1 };
  if (p >= 1) return { opacity: 1, scale: 1 };
  return {
    opacity: SHEET_GHOST + (1 - SHEET_GHOST) * easeOutCubic01(p),
    scale: 0.9 + 0.1 * easeOutBackTiny(p),
  };
}

/* ============================================================================
   "Pills" account style (Figma 949:10961) — a minimal, text-forward map. The
   shared hero sits on top; below it, three white SECTION cards (Income /
   Monthly Expenses / Goals) each carry a small white section-label pill and a
   stack of rows. Each row is a COLORED name pill (icon + short name) paired with
   plain amount/date text. A thin gray left spine forks short wishbone arms into
   every name pill. Progress is expressed causally (Sheet-style): the spine +
   arms DRAW ON and each pill/card POPS in as the flow tip reaches it, and goal
   dates flip gray→black with a pink check when funded. Dataset-aware: Simple has
   3 goals, Optimizer 5, so the Goals card + board height grow accordingly.
   Geometry is computed here so App (board height) and PillsBoard agree.
   ============================================================================ */
export const PILLS_SPINE_X = 46; // thin gray vertical spine (main trunk) — matches Figma 959:15504 trunk x≈46 (abs)
export const PILLS_CARD_LEFT = 16; // left edge of the white section cards
export const PILLS_CARD_W = 372; // -> right edge 388 (device inner width 402)
export const PILLS_PILL_LEFT = 96; // left edge of the colored name pills — long secondary arms (~50px) so arrowheads sit on a clean straight run (Figma trunk 46 → pill 93)

const PILLS_SECTIONS_TOP = 330; // first section label top — clears the serif hero
const PILLS_LABEL_H = 24; // white section-label pill height
const PILLS_LABEL_GAP = 6; // gap between a section label and its card
const PILLS_CARD_PAD = 8; // top/bottom padding inside a white section card
const PILLS_ROW_H = 34; // a name-pill row height
const PILLS_ROW_GAP = 13; // gap between rows within a card
const PILLS_SECTION_GAP = 20; // gap between section groups

export interface PillsRow {
  id: string;
  cy: number; // absolute center-y of the row's name pill (board coords)
}
export interface PillsSection {
  id: 'income' | 'monthly' | 'goals';
  label: string;
  labelTop: number;
  cardTop: number;
  cardH: number;
  rows: PillsRow[];
}
export interface PillsLayout {
  sections: PillsSection[];
  height: number; // total board height needed
}

// dataset-aware Pills layout: stacks Income (1 row) · Monthly Expenses (Core +
// Spend) · Goals (every dataset goal) on a clean vertical rhythm.
export function pillsLayoutFor(dataset: Dataset): PillsLayout {
  const layout = layoutFor(dataset);
  const goalIds = layout.filter((c) => c.kind === 'goal').map((c) => c.id);
  const groups: { id: 'income' | 'monthly' | 'goals'; label: string; ids: string[] }[] = [
    { id: 'income', label: 'Income', ids: ['income'] },
    { id: 'monthly', label: 'Monthly Expenses', ids: ['core', 'spend'] },
    { id: 'goals', label: 'Goals', ids: goalIds },
  ];
  const pitch = PILLS_ROW_H + PILLS_ROW_GAP;
  const sections: PillsSection[] = [];
  let y = PILLS_SECTIONS_TOP;
  for (const g of groups) {
    const labelTop = y;
    const cardTop = labelTop + PILLS_LABEL_H + PILLS_LABEL_GAP;
    const n = g.ids.length;
    const cardH = PILLS_CARD_PAD * 2 + n * PILLS_ROW_H + (n - 1) * PILLS_ROW_GAP;
    const rows = g.ids.map((id, i) => ({ id, cy: cardTop + PILLS_CARD_PAD + i * pitch + PILLS_ROW_H / 2 }));
    sections.push({ id: g.id, label: g.label, labelTop, cardTop, cardH, rows });
    y = cardTop + cardH + PILLS_SECTION_GAP;
  }
  return { sections, height: y - PILLS_SECTION_GAP + 28 };
}

/* ============================================================================
   "Illustrated" (illo) — a progress-track spine + colorizing illustration
   layout (Figma pre-flow 760:8522 / filled 763:8687). WHITE page. Income is a
   small top-CENTER card (light #f5f5f5, radius 16, 216 wide) with a mini income
   bar chart; a yellow branch curves from it down-left into a GREEN-BORDERED
   Fruitful circle at the top of the spine. The left spine is a 4px ROUNDED
   progress-track bar drawn in SEGMENTS between gates (income->monthly yellow on
   an #fbedb8 track; goal segments gray #e2e2e2 -> pink when funded). Cards are
   light #f5f5f5 / border #e4e4e4 / radius 8 / 234 wide in the right column; each
   card's in-card 4px progress bar is a CONTINUOUS extension of the branch that
   feeds it (the branch fills, then the bar continues left->right). Row TOPS are
   taken directly from the Figma frame (402-wide board space). */
export const ILLO_INCOME_LEFT = 93; // (402-216)/2 — centered 216-wide income card
export const ILLO_INCOME_TOP = 83;
export const ILLO_CARD_LEFT = 139; // calc(25% + 38.5px) in the 402 board
export const ILLO_CARD_W = 234;
// green-bordered Fruitful root circle at the top of the spine (Figma 760:8540)
export const ILLO_CIRCLE_LEFT = 28;
export const ILLO_CIRCLE_TOP = 256;

// account/goal card row TOPS (node-wrapper top). Card height ~84 (accounts) /
// ~86 (goals); the in-card progress bar sits at top + 46, which is where each
// branch arm attaches so the branch + bar read as one continuous fill.
// UNIFORM row pitch: every consecutive card is spaced by the Core↔Spend gap
// (411-319 = 92) so the whole column reads evenly (goals no longer pack tighter
// than the accounts). Bar centers = row top + 46; gate junctions sit at each
// gate's child midpoint (monthly 411, goals1 549, goals2 687).
const ILLO_ROW_PITCH = 92;
export const illoRowTop: Record<string, number> = {
  income: 83,
  core: 319,
  spend: 411, // 319 + 92
  ef1: 503, // 411 + 92
  debt: 595, // 503 + 92
  ef6: 687, // 595 + 92
};
// Optimizer: shared rows verbatim, then travel/brokerage continue the SAME 92
// pitch (goals3 junction at their midpoint 871).
export const illoRowTopOptimizer: Record<string, number> = {
  income: 83,
  core: 319,
  spend: 411,
  ef1: 503,
  debt: 595,
  ef6: 687,
  travel: 779, // 687 + 92
  brokerage: 871, // 779 + 92
};

/* Illo connector geometry — a 4px spine at x=48 with curvy wishbone S-branches
   into the LEFT edge of each card at the in-card progress-bar height (row top +
   46): core 365 / spend 457 / ef1 562 / debt 662 / ef6 750. The income branch is
   a yellow swoop from the income card down-left THROUGH the green circle
   (rendered on top) into the monthly junction (48,411). Gate junctions sit at
   each gate's child MIDPOINT so the wishbones mirror: monthly 411, goals2 706.
   Uses the SAME connector ids the pulse/fill engine expects so causal ordering
   (income -> core/spend -> goal layers) is preserved. */
// Wishbone NECK: the two arms of a gate leave from a pinched neck offset to the
// RIGHT of the spine (x=48), so they splay cleanly into the cards instead of
// starting behind the gate label / on the spine (Figma 763:8687 pinched shape).
// Each arm = a short shared stub spine->neck, then a smooth cubic to the card's
// bar center (row top + 46). Bar centers: core 365 / spend 457 / ef1 549 /
// debt 641 / ef6 733 / travel 825 / brokerage 917. Gate junctions sit at each
// gate's child midpoint: monthly 411, goals1 549, goals2 687, goals3 871.
// (Wishbone neck x = 76, i.e. 28px right of the x=48 spine.)
export const connectorsIllo: Connector[] = [
  // income card -> green circle -> monthly junction (yellow). The swoop leaves the
  // income card, sweeps down-left, and ARRIVES VERTICALLY into the circle top
  // (48,256) so it continues as one straight line down through the circle (drawn
  // BEHIND it) to the monthly junction (48,411) — no kink at the circle.
  { id: 'c-income-monthly', d: 'M201 190 C 201 240, 48 224, 48 256 L 48 411', arrow: false },
  // pink spine hops between gates
  { id: 'c-monthly-goals1', d: 'M48 411 L 48 549', arrow: false },
  { id: 'c-goals1-goals2', d: 'M48 549 L 48 687', arrow: false },
  // monthly wishbone -> core(365) / spend(457): stub to the neck (76,411), splay
  { id: 'c-monthly-core', d: 'M48 411 L 76 411 C 92 411, 114 365, 139 365', arrow: false },
  { id: 'c-monthly-spend', d: 'M48 411 L 76 411 C 92 411, 114 457, 139 457', arrow: false },
  // 1st goal — single straight branch at the ef1 bar center (gate y == bar y)
  { id: 'c-goals1-ef1', d: 'M48 549 L 139 549', arrow: false },
  // 2nd goal wishbone -> debt(641) / ef6(733)
  { id: 'c-goals2-debt', d: 'M48 687 L 76 687 C 92 687, 114 641, 139 641', arrow: false },
  { id: 'c-goals2-ef6', d: 'M48 687 L 76 687 C 92 687, 114 733, 139 733', arrow: false },
];
// Optimizer: shared rows verbatim, then the 3rd gate appended — spine hop
// goals2 -> goals3 (junction at the travel/brokerage midpoint 871), then a
// symmetric wishbone up to travel(825) / down to brokerage(917).
export const connectorsIlloOptimizer: Connector[] = [
  { id: 'c-income-monthly', d: 'M201 190 C 201 240, 48 224, 48 256 L 48 411', arrow: false },
  { id: 'c-monthly-goals1', d: 'M48 411 L 48 549', arrow: false },
  { id: 'c-goals1-goals2', d: 'M48 549 L 48 687', arrow: false },
  { id: 'c-monthly-core', d: 'M48 411 L 76 411 C 92 411, 114 365, 139 365', arrow: false },
  { id: 'c-monthly-spend', d: 'M48 411 L 76 411 C 92 411, 114 457, 139 457', arrow: false },
  { id: 'c-goals1-ef1', d: 'M48 549 L 139 549', arrow: false },
  { id: 'c-goals2-debt', d: 'M48 687 L 76 687 C 92 687, 114 641, 139 641', arrow: false },
  { id: 'c-goals2-ef6', d: 'M48 687 L 76 687 C 92 687, 114 733, 139 733', arrow: false },
  { id: 'c-goals2-goals3', d: 'M48 687 L 48 871', arrow: false },
  { id: 'c-goals3-travel', d: 'M48 871 L 76 871 C 92 871, 114 825, 139 825', arrow: false },
  { id: 'c-goals3-brokerage', d: 'M48 871 L 76 871 C 92 871, 114 917, 139 917', arrow: false },
];

/* Branch -> bar CONTINUOUS fill: the branch arm and its card's in-card progress
   bar behave as ONE track of length armLen + barLen. Given a card's fill
   fraction p (progressAt), the fill first travels the ARM, then continues into
   the BAR. `ILLO_CARD_ARM` maps a card slot to its incoming arm; both the
   connector renderer and the card read `illoSplit` so the two stay in sync. */
export const ILLO_CARD_ARM: Record<string, string> = {
  core: 'c-monthly-core',
  spend: 'c-monthly-spend',
  ef1: 'c-goals1-ef1',
  debt: 'c-goals2-debt',
  ef6: 'c-goals2-ef6',
  travel: 'c-goals3-travel',
  brokerage: 'c-goals3-brokerage',
};
// nominal arm lengths (viewBox units) used ONLY for the arm/bar split ratio so
// the renderer + card agree (the arm is drawn with its MEASURED length).
// includes the spine->neck stub (~28px) + the splay cubic (~82px) ≈ 108 for the
// wishbone arms; ef1 is a single straight 91px branch.
export const ILLO_ARM_LEN: Record<string, number> = {
  'c-monthly-core': 108,
  'c-monthly-spend': 108,
  'c-goals1-ef1': 91,
  'c-goals2-debt': 108,
  'c-goals2-ef6': 108,
  'c-goals3-travel': 108,
  'c-goals3-brokerage': 108,
};
export const ILLO_BAR_LEN = 154; // nominal in-card bar pixel length
export function illoSplit(p: number, armId: string): { arm: number; bar: number } {
  const armLen = ILLO_ARM_LEN[armId] ?? 100;
  const portion = armLen / (armLen + ILLO_BAR_LEN);
  const c = (x: number) => Math.max(0, Math.min(1, x));
  return { arm: c(p / portion), bar: c((p - portion) / (1 - portion)) };
}

export const illoRowTopFor = (dataset: Dataset): Record<string, number> =>
  dataset === 'optimizer' ? illoRowTopOptimizer : illoRowTop;
export const connectorsIlloFor = (dataset: Dataset): Connector[] =>
  dataset === 'optimizer' ? connectorsIlloOptimizer : connectorsIllo;

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
export const iconLabeledRowTopFor = (dataset: Dataset): Record<string, number> =>
  dataset === 'optimizer' ? iconLabeledRowTopOptimizer : iconLabeledRowTop;
export const connectorsIconLabeledFor = (dataset: Dataset): Connector[] =>
  dataset === 'optimizer' ? connectorsIconLabeledOptimizer : connectorsIconLabeled;
export const convoRowTopFor = (dataset: Dataset): Record<string, number> =>
  dataset === 'optimizer' ? convoRowTopOptimizer : convoRowTop;
export const connectorsConvoFor = (dataset: Dataset): Connector[] =>
  dataset === 'optimizer' ? connectorsConvoOptimizer : connectorsConvo;
export const v1RowTopFor = (dataset: Dataset): Record<string, number> =>
  dataset === 'optimizer' ? v1RowTopOptimizer : v1RowTop;
export const condensedRowTopFor = (dataset: Dataset): Record<string, number> =>
  dataset === 'optimizer' ? condensedRowTopOptimizer : condensedRowTop;

/* ============================================================================
   "Progress bar, inside" (pbi) — Figma node 792:8522.

   A hero header (sprout logo · gray subtitle · large serif headline) sits above
   a thin gray left SPINE (x=50) with on-spine white gate-label pills, dark-check
   discs where a funded card connects, and soft curvy branches into white rounded
   cards on the right. Each card = a small colored icon tile + name, then a rounded
   track with a colored fill and the dollar amount INSIDE it (goal cards add an
   uppercase date pill at the right). This block is fully self-contained (its own
   geometry + selectors) so it never collides with the other account styles.

   Card layout: white card left = calc(25%+69.5px) = 170 on the 402 board, width
   216. Card TOPS taken from the Figma frame on a UNIFORM 92px pitch (Core 378,
   Spend 470, Starter EF 562, Pay off debt 654, Full EF 746). Each branch arm
   attaches at the card's VERTICAL CENTER (cardTop + 40; card height 80), matching
   the Figma branch endpoints. Optimizer appends travel/brokerage continuing the
   92px pitch (travel 838, brokerage 930). ==================================== */
export const PBI_CARD_LEFT = 170;
export const PBI_CARD_W = 216;

// Onboarding home-page account balances (Figma 977:11967). Numeric balance + the
// cap each progress bar fills toward, so the bar FILL fraction actually matches the
// displayed balance (balance / cap) on BOTH the home cards and the money-map cards.
export const HOME_ACCOUNTS: Record<'core' | 'spend', { balance: number; cap: number }> = {
  core: { balance: 3284.57, cap: 3600 }, // ~91% full — a believable everyday checking/Core balance
  spend: { balance: 1820.39, cap: 2000 }, // ~91% full
};
const homeMoney = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
// Display strings (BIG number on the home cards; re-used as the Core/Spend amounts
// on the drag-entered money map so the numbers stay continuous). Derived from the
// numeric balances above so the number and the fill can never drift apart.
export const HOME_BALANCES: Record<'core' | 'spend', string> = {
  spend: homeMoney(HOME_ACCOUNTS.spend.balance),
  core: homeMoney(HOME_ACCOUNTS.core.balance),
};
// 0..1 bar fill for an account, driven by its balance relative to its cap.
export const homeAccountFill = (id: 'core' | 'spend'): number =>
  Math.max(0, Math.min(1, HOME_ACCOUNTS[id].balance / HOME_ACCOUNTS[id].cap));

// Dollar amount that matches a given 0..1 fill (number stays consistent with the
// bar): fill × cap. At the present fill this returns the balance; at the brim it
// returns the cap. Used when the home-page accounts top off toward 100% on scrub.
export const homeAccountAmount = (id: 'core' | 'spend', fill: number): string =>
  homeMoney(Math.max(0, Math.min(1, fill)) * HOME_ACCOUNTS[id].cap);

// (Home-page goal progress is now driven by the live income-waterfall model in
// scenario.ts `homeGoalFill`, mapped from the scrub position in App.tsx — see the
// HOME-PAGE flow block there. The old static HOME_PROGRESS snapshot was removed.)
// cardTop -> the point each branch arm attaches: the card's VERTICAL CENTER
// (card height = 8 pad + 24 head + 8 gap + 32 bar + 8 pad = 80 -> center 40),
// matching the Figma "path - bills" branch endpoints (node 792:8522).
export const PBI_ARM_ATTACH_DY = 40;

// income chrome (INCOME yellow pill + white PAYCHECK pills) row, board coords
export const PBI_INCOME_LEFT = 16;
export const PBI_INCOME_TOP = 335;
export const PBI_PAYCHECK_LEFT = 92;

// "Account-style card" income mode (pbi-only): the Direct-deposit income CARD sits
// in the card column ABOVE Core at 286. The tree cards use an 84px pitch, but the
// INCOME is its own section (its own yellow band, separated from the mint Monthly
// band by an 8px section gap), so it keeps a slightly larger ~92px offset to Core
// (286 → 378) — leaving clean room for the yellow band bottom + gap + mint top.
// Its vertical center (top + 40) is the income-gate junction on the spine — the
// reversed feeder arm runs card→gate there, and c-income-monthly drops gate→Monthly.
export const PBI_INCOME_CARD_TOP = 286;
export const PBI_INCOME_GATE_Y = PBI_INCOME_CARD_TOP + PBI_ARM_ATTACH_DY; // 326

// Card TOPS on a UNIFORM 84px pitch (Figma spacing node 1075:20494 — tightened
// from the earlier 92px). Core stays anchored at 378 and every consecutive card
// is spaced by the same 84px so the column reads evenly and tighter (Core 378,
// Spend 462, Starter EF 546, Pay off debt 630, Full EF 714). All connector
// elbows/probes, gate junctions, section-band tops/heights and the board height
// derive from these rows, so they move in lockstep with the pitch.
export const pbiRowTop: Record<string, number> = {
  income: PBI_INCOME_TOP, // income renders as the pill row (no card)
  core: 378,
  spend: 462, // 378 + 84
  ef1: 546, // 462 + 84
  debt: 630, // 546 + 84
  ef6: 714, // 630 + 84
};
// Optimizer: shared rows verbatim, then travel/brokerage continue the 84px pitch
export const pbiRowTopOptimizer: Record<string, number> = {
  income: PBI_INCOME_TOP,
  core: 378,
  spend: 462,
  ef1: 546,
  debt: 630,
  ef6: 714,
  travel: 798, // 714 + 84
  brokerage: 882, // 798 + 84
};

/* pbi connector geometry — a thin (~1px) gray SPINE at x=50 broken by gaps
   centered on each gate label, with soft cubic-S wishbone arms into the LEFT edge
   of each card (arms end at x=160, a 10px gap before the card left edge 170). Arms
   attach at each card's VERTICAL CENTER (row top + 40, = the Figma "path - bills"
   branch endpoints): core 418 / spend 510 / ef1 602 / debt 694 / ef6 786. Gate
   junctions sit at each gate's child MIDPOINT so the wishbones mirror: monthly 464
   (core 418 / spend 510); goals1 straight at ef1 602; goals2 740 (debt 694 / ef6
   786). Uses the SAME connector ids the pulse engine expects so causal pulses
   (income yellow / core blue / spend green / goals pink) travel it unchanged. */
const PBI_ARM = (jy: number, cy: number): string =>
  `M84 ${jy} C 122 ${jy}, 122 ${cy}, 160 ${cy}`;
export const connectorsProgress: Connector[] = [
  // income pill -> monthly gate: straight spine drop (income sits at the top)
  { id: 'c-income-monthly', d: 'M50 360 L 50 444', arrow: false },
  // vertical spine hops, broken by a gap centered on each gate label
  { id: 'c-monthly-goals1', d: 'M50 476 L 50 575', arrow: false },
  { id: 'c-goals1-goals2', d: 'M50 597 L 50 696', arrow: false },
  // spine STOPS at the last gate (goals2) — no trailing trunk below the final section
  // monthly wishbone -> core(418) / spend(502), junction at their midpoint 460
  { id: 'c-monthly-core', d: PBI_ARM(460, 418), arrow: false },
  { id: 'c-monthly-spend', d: PBI_ARM(460, 502), arrow: false },
  // 1st goal — soft straight-ish branch at the ef1 card center (586)
  { id: 'c-goals1-ef1', d: 'M72 586 C 110 586, 122 586, 160 586', arrow: false },
  // financial-health wishbone -> debt(670) / ef6(754), junction 712
  { id: 'c-goals2-debt', d: PBI_ARM(712, 670), arrow: false },
  { id: 'c-goals2-ef6', d: PBI_ARM(712, 754), arrow: false },
];
// Optimizer: shared rows verbatim, then the 3rd gate appended — spine hop
// goals2 -> goals3 (junction at the travel/brokerage midpoint 924), then a
// symmetric wishbone up to travel(878) / down to brokerage(970).
export const connectorsProgressOptimizer: Connector[] = [
  { id: 'c-income-monthly', d: 'M50 360 L 50 444', arrow: false },
  { id: 'c-monthly-goals1', d: 'M50 476 L 50 575', arrow: false },
  { id: 'c-goals1-goals2', d: 'M50 597 L 50 701', arrow: false },
  { id: 'c-monthly-core', d: PBI_ARM(460, 418), arrow: false },
  { id: 'c-monthly-spend', d: PBI_ARM(460, 502), arrow: false },
  { id: 'c-goals1-ef1', d: 'M72 586 C 110 586, 122 586, 160 586', arrow: false },
  { id: 'c-goals2-debt', d: PBI_ARM(712, 670), arrow: false },
  { id: 'c-goals2-ef6', d: PBI_ARM(712, 754), arrow: false },
  // 3rd gate (appended): spine hop goals2 -> goals3, then the shifted wishbone
  { id: 'c-goals2-goals3', d: 'M50 723 L 50 864', arrow: false },
  { id: 'c-goals3-travel', d: PBI_ARM(880, 838), arrow: false },
  { id: 'c-goals3-brokerage', d: PBI_ARM(880, 922), arrow: false },
  // spine STOPS at the last gate (goals3) — no trailing trunk below the final section
];

// pbi gate-label pills (white, on the spine). Simple has two goal gates (1st Goal
// + Financial health); Optimizer inserts a 2nd Goal between them. `top` centers
// each pill on its gate junction; two-line pills wrap within `width`.
export interface PbiLabelInfo { label: string; top: number; twoLine?: boolean; width?: number }
export const pbiLabels: Record<Dataset, Record<string, PbiLabelInfo>> = {
  simple: {
    monthly: { label: 'Monthly expenses', top: 444, twoLine: true, width: 56 },
    goals1: { label: '1st Goal', top: 575 },
    goals2: { label: 'Financial health', top: 696, twoLine: true, width: 56 },
  },
  optimizer: {
    monthly: { label: 'Monthly expenses', top: 444, twoLine: true, width: 56 },
    goals1: { label: '1st Goal', top: 575 },
    goals2: { label: '2nd Goal', top: 701 },
    goals3: { label: 'Financial health', top: 864, twoLine: true, width: 56 },
  },
};

export const pbiRowTopFor = (dataset: Dataset): Record<string, number> =>
  dataset === 'optimizer' ? pbiRowTopOptimizer : pbiRowTop;
export const connectorsProgressFor = (dataset: Dataset): Connector[] =>
  dataset === 'optimizer' ? connectorsProgressOptimizer : connectorsProgress;

/* ---- "Locked path" gate (pbi-scoped, BranchStyle 'pbi-locked') — Figma 802:10378 ----
   A DISTINCT pbi tree that reuses the pbi cards / row rhythm / hero / income pill
   but replaces the thin gray spine with a BOLD WHITE rounded track and heavy
   organic WHITE curvy branches, adds plain title-case gray gate labels (no pill)
   to the LEFT of the spine, and drops gray PADLOCK discs onto the spine at each
   level boundary (they unlock as the flow completes each level). To give room for
   the left labels the spine moves RIGHT to x=84 (matching the Figma vector left)
   — which is ALSO where the pbi branch arms already start (PBI_ARM begins at x=84),
   so the arms now connect flush to the spine. Card column, arm endpoints (x=160
   into card left 170), row centers and gate junctions are otherwise the pbi ones,
   so no card moves vs. the other pbi gates. The spine is drawn CONTINUOUS (the
   opaque lock discs visually break it, matching the Figma). */
export const PBI_LOCK_SPINE_X = 84;
// INCOME/PAYCHECK pill row left for this gate ONLY. The spine moved right to x=84,
// so the income pill row shifts with it: the yellow "Income" pill (68px wide,
// border-box) sits first in the row, so its center is left+34 — anchoring that
// center on the spine (x=84) puts the income directly above the spine and the
// straight income→monthly drop (M84 …) runs cleanly down its middle. Other pbi
// gates keep the default PBI_INCOME_LEFT (spine x=50).
export const PBI_LOCK_INCOME_LEFT = PBI_LOCK_SPINE_X - 34; // 50
// bold-white organic wishbone arm — identical control handles to PBI_ARM (which
// already departs x=84), so it leaves the spine flush and lands into the card.
export const connectorsProgressLocked: Connector[] = [
  // continuous spine (x=84): income drop → monthly → goals1 → ENDS at goals2 (last gate)
  { id: 'c-income-monthly', d: 'M84 360 L 84 464', arrow: false },
  { id: 'c-monthly-goals1', d: 'M84 464 L 84 602', arrow: false },
  { id: 'c-goals1-goals2', d: 'M84 602 L 84 740', arrow: false },
  // monthly wishbone -> core(418) / spend(510), junction at their midpoint 464
  { id: 'c-monthly-core', d: PBI_ARM(464, 418), arrow: false },
  { id: 'c-monthly-spend', d: PBI_ARM(464, 510), arrow: false },
  // 1st goal — straight organic branch at the ef1 card center
  { id: 'c-goals1-ef1', d: 'M84 602 L 160 602', arrow: false },
  // financial-health wishbone -> debt(694) / ef6(786), junction 740
  { id: 'c-goals2-debt', d: PBI_ARM(740, 694), arrow: false },
  { id: 'c-goals2-ef6', d: PBI_ARM(740, 786), arrow: false },
];
// Optimizer: shared rows verbatim, then the 3rd gate appended — continuous spine
// hop goals2 -> goals3 (junction 924), then the symmetric wishbone.
export const connectorsProgressLockedOptimizer: Connector[] = [
  { id: 'c-income-monthly', d: 'M84 360 L 84 464', arrow: false },
  { id: 'c-monthly-goals1', d: 'M84 464 L 84 602', arrow: false },
  { id: 'c-goals1-goals2', d: 'M84 602 L 84 740', arrow: false },
  { id: 'c-monthly-core', d: PBI_ARM(464, 418), arrow: false },
  { id: 'c-monthly-spend', d: PBI_ARM(464, 510), arrow: false },
  { id: 'c-goals1-ef1', d: 'M84 602 L 160 602', arrow: false },
  { id: 'c-goals2-debt', d: PBI_ARM(740, 694), arrow: false },
  { id: 'c-goals2-ef6', d: PBI_ARM(740, 786), arrow: false },
  // 3rd gate (appended)
  { id: 'c-goals2-goals3', d: 'M84 740 L 84 924', arrow: false },
  { id: 'c-goals3-travel', d: PBI_ARM(924, 878), arrow: false },
  { id: 'c-goals3-brokerage', d: PBI_ARM(924, 970), arrow: false },
  // spine STOPS at the last gate (goals3) — no trailing trunk below the final section
];
export const connectorsProgressLockedFor = (dataset: Dataset): Connector[] =>
  dataset === 'optimizer' ? connectorsProgressLockedOptimizer : connectorsProgressLocked;

/* Locked-path gate labels — plain title-case text (NO pill) sitting to the LEFT of
   the spine (right-aligned, ending just left of x=84), color-tinted per section to
   match the Figma tokens (monthly = blue-water-darkest #232b33; goal gates =
   pink-petal-darkest #624b52). `top` is the label block's top; two-line labels
   wrap within `width`. Simple: Monthly Expenses / Goal 1 / Financial Health.
   Optimizer numbers the intermediate goal gates and keeps the terminal gate as
   Financial Health: Monthly Expenses / Goal 1 / Goal 2 / Financial Health. */
export interface PbiLockLabelInfo { label: string; top: number; color: string; twoLine?: boolean; width?: number }
const LOCK_MONTHLY_COLOR = '#232b33'; // secondary/blue/water-darkest
const LOCK_GOAL_COLOR = '#624b52'; // secondary/pink/petal-darkest
export const pbiLockedLabels: Record<Dataset, Record<string, PbiLockLabelInfo>> = {
  simple: {
    monthly: { label: 'Monthly Expenses', top: 448, color: LOCK_MONTHLY_COLOR, twoLine: true, width: 68 },
    goals1: { label: 'Goal 1', top: 594, color: LOCK_GOAL_COLOR },
    goals2: { label: 'Financial Health', top: 724, color: LOCK_GOAL_COLOR, twoLine: true, width: 68 },
  },
  optimizer: {
    monthly: { label: 'Monthly Expenses', top: 448, color: LOCK_MONTHLY_COLOR, twoLine: true, width: 68 },
    goals1: { label: 'Goal 1', top: 594, color: LOCK_GOAL_COLOR },
    goals2: { label: 'Goal 2', top: 732, color: LOCK_GOAL_COLOR },
    goals3: { label: 'Financial Health', top: 908, color: LOCK_GOAL_COLOR, twoLine: true, width: 68 },
  },
};

/* Padlock discs on the spine (x=84) at each LEVEL boundary. Each disc UNLOCKS the
   instant every card in the level ABOVE it has finished funding — using the SAME
   `cardDone` source the pbi check discs use (core/spend >= 100% ; goals reached),
   so a lock opens exactly when its downstream level unlocks. `y` centers the disc
   in the gap between the two card clusters (on the spine). */
export interface PbiLockDisc { id: string; y: number; cards: string[] }
export const pbiLockDiscs: Record<Dataset, PbiLockDisc[]> = {
  simple: [
    { id: 'lock-monthly', y: 556, cards: ['core', 'spend'] }, // monthly done -> Goal 1 unlocks
    { id: 'lock-goals1', y: 648, cards: ['ef1'] }, // Goal 1 done -> Financial Health unlocks
  ],
  optimizer: [
    { id: 'lock-monthly', y: 556, cards: ['core', 'spend'] },
    { id: 'lock-goals1', y: 648, cards: ['ef1'] },
    { id: 'lock-goals2', y: 832, cards: ['debt', 'ef6'] }, // Goal 2 done -> Financial Health unlocks
  ],
};
export const pbiLockDiscsFor = (dataset: Dataset): PbiLockDisc[] =>
  dataset === 'optimizer' ? pbiLockDiscs.optimizer : pbiLockDiscs.simple;

/* ---- "Grouped" gate (pbi-scoped, BranchStyle 'pbi-grouped') — Figma 802:10601 ----
   Closely related to "Locked path": it reuses the pbi hero + INCOME/PAYCHECK pill
   row, the pbi white cards (standalone icon + inner amount bar + date pill), a thin
   LIGHT left spine with circular PADLOCK discs at each level boundary (same
   `cardDone` unlock timing as pbi-locked), and soft WHITE curvy wishbone branches
   from the spine into each card. THE DEFINING FEATURE: each section's cards are
   wrapped in a rounded COLORED SECTION PANEL sitting BEHIND them — a teal/mint panel
   behind the Monthly Expenses group (Core + Spend), a pink panel behind the Goals
   group (all goal cards) — each with a small section label in its top-left.

   Figma spec (802:10601, 402-wide frame): panels x=61 w=329 r=12; teal panel fill
   rgba(56,195,203,0.15), pink panel fill #f1e1ea; labels 12px semibold — teal
   "Monthly Expenses" rgba(0,127,125,0.53), pink "Goals" #a17187; the spine (Vector
   808) sits at x=40 with padlock discs (white disc + lock glyph) centered on it.

   The card column stays at PBI_CARD_LEFT (170) — the pbi cards don't move — but the
   GOALS section is pushed down by a section gap (matching the Figma's larger Spend→
   Starter pitch) so the two panels read as distinct blocks. Its own row-top map +
   connector set + panel rects so it never touches the other pbi gates. */
export const PBI_GROUPED_SPINE_X = 40;

// grouped card TOPS: Core/Spend on the pbi 92px pitch, then a +19px SECTION GAP
// before the goals (matching Figma's Spend→Starter 111px pitch), goals on 92px.
export const pbiGroupedRowTop: Record<string, number> = {
  income: PBI_INCOME_TOP,
  core: 378,
  spend: 470, // 378 + 92
  ef1: 581, // 470 + 92 + 19 (section gap)
  debt: 673, // 581 + 92
  ef6: 765, // 673 + 92
};
export const pbiGroupedRowTopOptimizer: Record<string, number> = {
  income: PBI_INCOME_TOP,
  core: 378,
  spend: 470,
  ef1: 581,
  debt: 673,
  ef6: 765,
  travel: 857, // 765 + 92
  brokerage: 949, // 857 + 92
};

// soft white wishbone arm (Figma 802:10601 "path - bills"): a single horizontal
// STEM leaves the spine (x=40) at the section junction (jy) out to a common FORK
// (x=104), then a smooth cubic S curves up/down into the card (arriving at x=160,
// a 10px gap before the card left 170). Because BOTH arms of a 2-card section share
// the identical stem and fork, the wishbone reads as one clean junction (no splay
// at the spine); the first control sits at the fork level (horizontal tangent out
// of the stem → no kink) and the last control at the card level (horizontal into
// the card). Single-card sections use a straight horizontal arm (no fork).
const PBI_GRP_FORK_X = 104; // stem end / wishbone fork (matches Figma path-bills left)
const PBI_GRP_ARM = (jy: number, cy: number): string =>
  `M40 ${jy} L ${PBI_GRP_FORK_X} ${jy} C 132 ${jy}, 132 ${cy}, 160 ${cy}`;
export const connectorsProgressGrouped: Connector[] = [
  // continuous light spine (x=40): income drop → monthly → goals1 → goals2 → bottom
  { id: 'c-income-monthly', d: 'M40 360 L 40 464', arrow: false },
  { id: 'c-monthly-goals1', d: 'M40 464 L 40 621', arrow: false },
  { id: 'c-goals1-goals2', d: 'M40 621 L 40 759', arrow: false },
  { id: 'c-goals2-down', d: 'M40 759 L 40 946', arrow: false },
  // monthly wishbone -> core(418) / spend(510), junction at their midpoint 464
  { id: 'c-monthly-core', d: PBI_GRP_ARM(464, 418), arrow: false },
  { id: 'c-monthly-spend', d: PBI_GRP_ARM(464, 510), arrow: false },
  // 1st goal — straight white branch at the ef1 card center (621)
  { id: 'c-goals1-ef1', d: 'M40 621 L 160 621', arrow: false },
  // financial-health wishbone -> debt(713) / ef6(805), junction 759
  { id: 'c-goals2-debt', d: PBI_GRP_ARM(759, 713), arrow: false },
  { id: 'c-goals2-ef6', d: PBI_GRP_ARM(759, 805), arrow: false },
];
// Optimizer: shared rows verbatim, then the 3rd gate appended — spine hop
// goals2 -> goals3 (junction at the travel/brokerage midpoint 943), then a
// symmetric wishbone up to travel(897) / down to brokerage(989).
export const connectorsProgressGroupedOptimizer: Connector[] = [
  { id: 'c-income-monthly', d: 'M40 360 L 40 464', arrow: false },
  { id: 'c-monthly-goals1', d: 'M40 464 L 40 621', arrow: false },
  { id: 'c-goals1-goals2', d: 'M40 621 L 40 759', arrow: false },
  { id: 'c-monthly-core', d: PBI_GRP_ARM(464, 418), arrow: false },
  { id: 'c-monthly-spend', d: PBI_GRP_ARM(464, 510), arrow: false },
  { id: 'c-goals1-ef1', d: 'M40 621 L 160 621', arrow: false },
  { id: 'c-goals2-debt', d: PBI_GRP_ARM(759, 713), arrow: false },
  { id: 'c-goals2-ef6', d: PBI_GRP_ARM(759, 805), arrow: false },
  { id: 'c-goals2-goals3', d: 'M40 759 L 40 943', arrow: false },
  { id: 'c-goals3-travel', d: PBI_GRP_ARM(943, 897), arrow: false },
  { id: 'c-goals3-brokerage', d: PBI_GRP_ARM(943, 989), arrow: false },
  { id: 'c-goals3-down', d: 'M40 943 L 40 1186', arrow: false },
];
export const connectorsProgressGroupedFor = (dataset: Dataset): Connector[] =>
  dataset === 'optimizer' ? connectorsProgressGroupedOptimizer : connectorsProgressGrouped;

export const pbiGroupedRowTopFor = (dataset: Dataset): Record<string, number> =>
  dataset === 'optimizer' ? pbiGroupedRowTopOptimizer : pbiGroupedRowTop;

/* Grouped padlock discs (Figma 802:10601) — one disc per SECTION, centered on the
   spine (x=40) at that section's BRANCH JUNCTION y (where its arm(s) fork off the
   spine): Monthly at the Core/Spend fork midpoint (464), 1st Goal at the Starter-EF
   branch level (621), 2nd Goal at the Debt/Full-EF fork midpoint (759), and (Optimizer
   only) the 3rd Goal at the Travel/Brokerage fork midpoint (943). Each disc unlocks
   the instant every card in ITS section finishes funding — the SAME `cardDone` source
   the pbi check discs use (core/spend >= 100%; goals reached). */
export const pbiGroupedLockDiscs: Record<Dataset, PbiLockDisc[]> = {
  simple: [
    { id: 'lock-monthly', y: 464, cards: ['core', 'spend'] }, // on the Core/Spend fork
    { id: 'lock-goals1', y: 621, cards: ['ef1'] }, // on the Starter-EF branch
    { id: 'lock-goals2', y: 759, cards: ['debt', 'ef6'] }, // on the Debt/Full-EF fork
  ],
  optimizer: [
    { id: 'lock-monthly', y: 464, cards: ['core', 'spend'] },
    { id: 'lock-goals1', y: 621, cards: ['ef1'] },
    { id: 'lock-goals2', y: 759, cards: ['debt', 'ef6'] },
    { id: 'lock-goals3', y: 943, cards: ['travel', 'brokerage'] }, // Travel/Brokerage fork
  ],
};
export const pbiGroupedLockDiscsFor = (dataset: Dataset): PbiLockDisc[] =>
  dataset === 'optimizer' ? pbiGroupedLockDiscs.optimizer : pbiGroupedLockDiscs.simple;

/* Rounded colored SECTION PANELS sitting BEHIND the "Text gates + backgrounds"
   cards (Figma 885:11940). This gate reuses the DEFAULT (text-only) pbi tree —
   thin spine at x=50, on-spine text gate pills, white wishbones into the pbi
   cards on their default rows (pbiRowTop) — and layers a full-width colored
   panel behind each section: Monthly Expenses (mint) wraps Core + Spend; Goals
   (pink) wraps every goal card (it grows for the Optimizer's 5 goals). Panels
   span nearly the whole device (x=11 → w=379) so the spine + pills read as
   sitting inside the colored band, exactly like the Figma. No corner labels —
   the on-spine gate pills carry the section names. */
export interface PbiGroupedPanel { id: string; x: number; y: number; w: number; h: number; tint: 'mint' | 'pink' | 'gray' | 'yellow'; label: string }
export function pbiGroupedPanelsFor(dataset: Dataset): PbiGroupedPanel[] {
  const rows = dataset === 'optimizer' ? pbiRowTopOptimizer : pbiRowTop;
  const lastGoal = dataset === 'optimizer' ? rows.brokerage : rows.ef6;
  const PAD_T = 10; // top breathing room above a card
  const CARD_H = 76; // rendered pbi-card height (8 pad + 20 name + 8 gap + 32 bar + 8 pad)
  const PAD_B = 8; // extra below a card
  const GAP = 8; // clean, symmetric visible separation between the mint and pink panels
  // center the 8px gap on the midpoint of the Spend-card-bottom → 1st-goal-card-top
  // space so the panels split symmetrically and neither clips its card. At the 84px
  // pitch the inter-card gap is exactly 8px (84 − 76 card), so this uses the true
  // rendered CARD_H (76) — the mint band ends flush at the Spend-card bottom and the
  // pink band starts flush at the 1st-goal-card top, split by the 8px GAP.
  const mid = (rows.spend + CARD_H + rows.ef1) / 2;
  const mintTop = rows.core - PAD_T;
  const mintBottom = mid - GAP / 2; // mint ends 4px above the midpoint
  const pinkTop = mid + GAP / 2; // pink starts 4px below the midpoint
  const pinkBottom = lastGoal + CARD_H + PAD_B;
  // 8px side margins per the spacing Figma (1075:20494): x=8, width=402−8−8=386.
  return [
    { id: 'monthly', x: 8, y: mintTop, w: 386, h: mintBottom - mintTop, tint: 'mint', label: '' },
    { id: 'goals', x: 8, y: pinkTop, w: 386, h: pinkBottom - pinkTop, tint: 'pink', label: '' },
  ];
}

/* "Sections incl. income" gate (pbi-scoped, BranchStyle 'pbi-income-section') —
   Figma 977:10048. IDENTICAL to "In sections" (mint Monthly + pink Goals panels,
   default white pbi tree, on-spine gate pills) but adds a YELLOW section panel
   behind the INCOME area (the paycheck carousel), so Income reads as its own titled
   section like Monthly and Goals. The income panel wraps the carousel (top ~324,
   just above the mint panel which starts at core-10=368). x/w match the other
   panels so the three bands align. Dataset-aware via the reused mint/pink geometry. */
export function pbiIncomeSectionPanelsFor(dataset: Dataset): PbiGroupedPanel[] {
  const incomeTop = 324; // wraps the paycheck carousel (top 335) with a little breathing room
  const incomeH = 40; // ends ~364, a 4px gap above the mint panel (core-10=368)
  const income: PbiGroupedPanel = { id: 'income', x: 11, y: incomeTop, w: 379, h: incomeH, tint: 'yellow', label: '' };
  return [income, ...pbiGroupedPanelsFor(dataset)];
}

/* ---- "Grouped 2" gate (pbi-scoped, BranchStyle 'pbi-grouped2') — Figma 802:10838 ----
   A VARIANT of "Grouped" (802:10601): SAME grouped-section-panels concept, the same
   pbi hero + INCOME/PAYCHECK pills, the same white pbi cards on the SAME rows
   (pbiGroupedRowTopFor is reused, so no card moves vs. Grouped), and padlocks that
   unlock on the SAME cardDone timing. TWO deliberate differences:

   1. GRAY section panels (Figma fill rgba(0,0,0,0.05) on both the Monthly Expenses
      and Goals panels) with gray section labels (rgba(0,0,0,0.5)) — replacing the
      teal/pink tints of Grouped.
   2. DIFFERENT branch routing. In Grouped the wishbones fork directly off the main
      spine (x=40) with the padlock discs sitting ON that spine. In Grouped 2 the
      main spine (x=40) carries only the Monthly section (its wishbone forks off the
      spine, WITHOUT a lock), then BENDS to the right into the Goals panel to an
      OFFSET secondary RISER (x=97). The Goals padlock discs sit at that offset riser
      at each branch junction, and the goal arms fork off the RISER (not the spine).
      Figma spec: spine Vector 808 ≈ x40, offset lock discs centered x≈97.5 at
      y≈618 (Goal 1) and y≈750 (Goal 2); Monthly has no lock disc. */
export const PBI_GROUPED2_SPINE_X = 40; // main spine (carries income → monthly)
export const PBI_GROUPED2_RISER_X = 97; // offset secondary riser (carries the goals + their locks)

// Goal wishbone off the OFFSET riser (x=97): the padlock disc sits right at the
// riser junction (jy), so the arm is a pure smooth cubic from the riser into the
// card (arriving at x=160, a 10px gap before the card left 170) with a horizontal
// tangent at both ends. Two arms sharing (97, jy) read as one clean fork.
const PBI_GRP2_ARM = (jy: number, cy: number): string =>
  `M${PBI_GROUPED2_RISER_X} ${jy} C 132 ${jy}, 132 ${cy}, 160 ${cy}`;
export const connectorsProgressGrouped2: Connector[] = [
  // main spine (x=40): income drop → monthly junction (464)
  { id: 'c-income-monthly', d: 'M40 360 L 40 464', arrow: false },
  // monthly wishbone forks off the spine (x=40) at 464 — NO lock here
  { id: 'c-monthly-core', d: PBI_GRP_ARM(464, 418), arrow: false },
  { id: 'c-monthly-spend', d: PBI_GRP_ARM(464, 510), arrow: false },
  // spine bends from the monthly junction (40,464) down and RIGHT into the goals
  // panel, arriving at the offset riser / Goal-1 lock (97,621)
  { id: 'c-monthly-goals1', d: 'M40 464 L 40 588 C 40 610, 62 621, 97 621', arrow: false },
  // Goal 1 — straight branch off the riser into the ef1 card (lock sits at 97,621)
  { id: 'c-goals1-ef1', d: 'M97 621 L 160 621', arrow: false },
  // riser drops from the Goal-1 junction (97,621) to the Goal-2 junction (97,759)
  { id: 'c-goals1-goals2', d: 'M97 621 L 97 759', arrow: false },
  // financial-health wishbone forks off the riser (97) at 759 -> debt(713)/ef6(805)
  { id: 'c-goals2-debt', d: PBI_GRP2_ARM(759, 713), arrow: false },
  { id: 'c-goals2-ef6', d: PBI_GRP2_ARM(759, 805), arrow: false },
  // riser STOPS at the last gate (goals2) — no trailing riser below the final fork
];
// Optimizer: shared rows verbatim, then the 3rd gate appended — riser hop
// goals2 -> goals3 (junction 943), then a symmetric wishbone off the riser.
export const connectorsProgressGrouped2Optimizer: Connector[] = [
  { id: 'c-income-monthly', d: 'M40 360 L 40 464', arrow: false },
  { id: 'c-monthly-core', d: PBI_GRP_ARM(464, 418), arrow: false },
  { id: 'c-monthly-spend', d: PBI_GRP_ARM(464, 510), arrow: false },
  { id: 'c-monthly-goals1', d: 'M40 464 L 40 588 C 40 610, 62 621, 97 621', arrow: false },
  { id: 'c-goals1-ef1', d: 'M97 621 L 160 621', arrow: false },
  { id: 'c-goals1-goals2', d: 'M97 621 L 97 759', arrow: false },
  { id: 'c-goals2-debt', d: PBI_GRP2_ARM(759, 713), arrow: false },
  { id: 'c-goals2-ef6', d: PBI_GRP2_ARM(759, 805), arrow: false },
  { id: 'c-goals2-goals3', d: 'M97 759 L 97 943', arrow: false },
  { id: 'c-goals3-travel', d: PBI_GRP2_ARM(943, 897), arrow: false },
  { id: 'c-goals3-brokerage', d: PBI_GRP2_ARM(943, 989), arrow: false },
  // riser STOPS at the last gate (goals3) — no trailing riser below the final fork
];
export const connectorsProgressGrouped2For = (dataset: Dataset): Connector[] =>
  dataset === 'optimizer' ? connectorsProgressGrouped2Optimizer : connectorsProgressGrouped2;

/* Grouped 2 padlock discs (Figma 802:10838) — one disc per GOAL section, sitting on
   the OFFSET riser (x=97) at that section's branch junction y. UNLIKE Grouped there
   is NO monthly lock: only the goal gates carry a padlock. Each disc unlocks the
   instant every card in ITS section finishes funding (same `cardDone` source). */
export const pbiGrouped2LockDiscs: Record<Dataset, PbiLockDisc[]> = {
  simple: [
    { id: 'lock-goals1', y: 621, cards: ['ef1'] }, // riser junction to Starter EF
    { id: 'lock-goals2', y: 759, cards: ['debt', 'ef6'] }, // riser fork to Debt/Full-EF
  ],
  optimizer: [
    { id: 'lock-goals1', y: 621, cards: ['ef1'] },
    { id: 'lock-goals2', y: 759, cards: ['debt', 'ef6'] },
    { id: 'lock-goals3', y: 943, cards: ['travel', 'brokerage'] }, // Travel/Brokerage fork
  ],
};
export const pbiGrouped2LockDiscsFor = (dataset: Dataset): PbiLockDisc[] =>
  dataset === 'optimizer' ? pbiGrouped2LockDiscs.optimizer : pbiGrouped2LockDiscs.simple;

/* Grouped 2 section panels — SAME rects as Grouped (cards reuse pbiGroupedRowTopFor,
   so the panels wrap the identical card clusters) but both tinted GRAY (Figma
   rgba(0,0,0,0.05)) with gray section labels. */
export function pbiGrouped2PanelsFor(dataset: Dataset): PbiGroupedPanel[] {
  return pbiGroupedPanelsFor(dataset).map((p) => ({ ...p, tint: 'gray' as const }));
}

/* ---- "Indented" gate (pbi-scoped, BranchStyle 'pbi-indented') — Figma 886:12513 ----
   A nested/indented tree instead of section-label gates. A thin gray MAIN SPINE at
   the far left (x=41) carries the monthly children (Core/Spend) and the 1st goal
   (ef1) as short horizontal ELBOW arms, each tagged with a small AMOUNT PILL near
   the spine ($4,000 / $2,000 / surplus). The 2nd-level goals (debt/ef6) hang off an
   INDENTED secondary riser (x=78); Optimizer's 3rd-level goals (travel/brokerage)
   indent one step deeper (x=115). The indentation itself expresses the hierarchy,
   so there are no on-spine section labels. Reuses the shared pulse ids so the causal
   money pulses travel it unchanged, and the pbi cards stay on their default rows. */
// The Indented tree rides a 46px grid (see .pbi-indented-grid) offset so gridlines
// fall exactly on the spine (x=41) and every card CENTER (418/510/602/694/786 —
// the default pbi rows are a 92px = 2-cell pitch). Verticals sit on the 41 / 87 /
// 133 gridlines (spine → level-2 riser → level-3 riser) and horizontals ride the
// row gridlines, so the whole tree reads as drawn ON the paper. All corners are
// crisp right angles with a small 7px radius (NOT sweeping curves).
export const PBI_INDENTED_SPINE_X = 41; // main spine (monthly + 1st goal) — gridline
export const PBI_INDENTED_RISER_X = 87; // indented riser for level-2 goals — +1 cell
export const PBI_INDENTED_RISER2_X = 133; // deeper riser for level-3 goals — +2 cells
export const PBI_INDENTED_PILL_X = 52; // left edge of the amount pills near the spine
const PBI_IND_ARM_END = 160; // arms stop 10px shy of the pbi card left (170)
const IR = 7; // right-angle corner radius (crisp, grid-aligned — no big curves)
// down the trunk (tx) from y0 to a rounded right-angle corner at yc, then right to xEnd
const PBI_IND_ELBOW = (tx: number, y0: number, yc: number, xEnd: number): string =>
  `M${tx} ${y0} L${tx} ${yc - IR} Q${tx} ${yc} ${tx + IR} ${yc} L${xEnd} ${yc}`;
export const connectorsProgressIndented: Connector[] = [
  // main spine (x=41): income drop → monthly span → 1st goal (straight vertical)
  { id: 'c-income-monthly', d: 'M41 372 L41 418', arrow: false },
  { id: 'c-monthly-goals1', d: 'M41 418 L41 602', arrow: false },
  // monthly + 1st goal — straight horizontal arms off the spine (amount pills sit here)
  { id: 'c-monthly-core', d: `M41 418 L${PBI_IND_ARM_END} 418`, arrow: false },
  { id: 'c-monthly-spend', d: `M41 510 L${PBI_IND_ARM_END} 510`, arrow: false },
  { id: 'c-goals1-ef1', d: `M41 602 L${PBI_IND_ARM_END} 602`, arrow: false },
  // INDENT: spine steps right into the level-2 riser (x=87) at the debt row (694)
  { id: 'c-goals1-goals2', d: PBI_IND_ELBOW(41, 602, 694, 87), arrow: false },
  // level-2 goals off the riser: debt straight out; ef6 drops the riser then out
  { id: 'c-goals2-debt', d: `M87 694 L${PBI_IND_ARM_END} 694`, arrow: false },
  { id: 'c-goals2-ef6', d: PBI_IND_ELBOW(87, 694, 786, PBI_IND_ARM_END), arrow: false },
];
// Optimizer: shared rows verbatim, then the riser steps deeper (x=133) for the
// level-3 goals (travel 878 / brokerage 970).
export const connectorsProgressIndentedOptimizer: Connector[] = [
  { id: 'c-income-monthly', d: 'M41 372 L41 418', arrow: false },
  { id: 'c-monthly-goals1', d: 'M41 418 L41 602', arrow: false },
  { id: 'c-monthly-core', d: `M41 418 L${PBI_IND_ARM_END} 418`, arrow: false },
  { id: 'c-monthly-spend', d: `M41 510 L${PBI_IND_ARM_END} 510`, arrow: false },
  { id: 'c-goals1-ef1', d: `M41 602 L${PBI_IND_ARM_END} 602`, arrow: false },
  { id: 'c-goals1-goals2', d: PBI_IND_ELBOW(41, 602, 694, 87), arrow: false },
  { id: 'c-goals2-debt', d: `M87 694 L${PBI_IND_ARM_END} 694`, arrow: false },
  { id: 'c-goals2-ef6', d: PBI_IND_ELBOW(87, 694, 786, PBI_IND_ARM_END), arrow: false },
  // INDENT deeper: level-2 riser steps right into the level-3 riser (x=133) at travel (878)
  { id: 'c-goals2-goals3', d: PBI_IND_ELBOW(87, 694, 878, 133), arrow: false },
  { id: 'c-goals3-travel', d: `M133 878 L${PBI_IND_ARM_END} 878`, arrow: false },
  { id: 'c-goals3-brokerage', d: PBI_IND_ELBOW(133, 878, 970, PBI_IND_ARM_END), arrow: false },
];
export const connectorsProgressIndentedFor = (dataset: Dataset): Connector[] =>
  dataset === 'optimizer' ? connectorsProgressIndentedOptimizer : connectorsProgressIndented;

/* Amount pills that sit on the Indented gate's monthly + 1st-goal elbow arms
   (Figma 886:12513): the monthly Core/Spend allocations and the 1st-goal surplus.
   `y` is the arm's center (= the card's vertical center on the default pbi rows). */
export interface PbiIndentedPill { id: string; y: number; amount: string }
export const pbiIndentedPills: Record<Dataset, PbiIndentedPill[]> = {
  simple: [
    { id: 'core', y: 418, amount: '$4,000' },
    { id: 'spend', y: 510, amount: '$2,000' },
    { id: 'ef1', y: 602, amount: '$2,000' },
  ],
  optimizer: [
    { id: 'core', y: 418, amount: '$6,000' },
    { id: 'spend', y: 510, amount: '$4,000' },
    { id: 'ef1', y: 602, amount: '$5,000' },
  ],
};
export const pbiIndentedPillsFor = (dataset: Dataset): PbiIndentedPill[] =>
  dataset === 'optimizer' ? pbiIndentedPills.optimizer : pbiIndentedPills.simple;

/* "Section split" gate (Figma 907:12864): the same text-gate tree as 'text-only',
   plus a full-width dashed rule dividing the Monthly Expenses block (Core + Spend)
   from the Goals block. Returns the board-Y of each divider (midway between the
   Spend card bottom and the first goal card top). */
export const pbiSplitDividersFor = (dataset: Dataset): number[] => {
  const rows = dataset === 'optimizer' ? pbiRowTopOptimizer : pbiRowTop;
  return [(rows.spend + 80 + rows.ef1) / 2];
};

/* ============================================================================
   "Pots" (pots) — Figma node 802:9336.

   BRAND-NEW account style: each account/goal card is a colored POT (a rounded
   body with a slightly-lighter wider RIM band near its top and the account NAME
   in white inside). Along the pot's TOP edge, PLANTS grow left→right as the card
   funds — the plant band IS the progress bar: at 0% the pot is bare soil, and as
   progressAt climbs, plant clusters pop in one-by-one across the top until, at
   100%, plants span the full width (pot "full" = funded, its check disc lands).

   Reuses the SAME chrome family as "Progress bar, inside" (pbi): a centered hero
   (sprout logo · gray subtitle · large serif headline), a thin gray left SPINE
   (x=50) with on-spine white gate-label pills + gray check discs, and soft curvy
   wishbone arms into the pots. Fully self-contained (own geometry + selectors +
   .pot-* CSS) so it never collides with any other style.

   Card layout (from the Figma frame): a 223-wide rim band at left=164 (calc(25%+
   63.5)) with a 205-wide body centered under it (body left=173). The node WRAPPER
   is placed at the plant-band top; the pot body starts 54px below it (the plant
   band + rim overhang sit above the body). The monthly accounts sit CLOSE (Core→
   Spend on a tight 90px pitch); the goals get MORE room (a wider 106px pitch), so
   wrapper tops are Core 329, Spend 419, Starter EF 539, Pay off debt 645, Full EF
   751 (body top = wrapper top + 54). The wishbone arms attach at each pot BODY's
   vertical center = wrapper top + 84: core 413 / spend 503 / ef1 623 / debt 729 /
   ef6 835. ==================================================================== */
export const POT_CARD_LEFT = 164; // rim / container left (calc(25%+63.5) on 402)
export const POT_CONTAINER_W = 223; // rim (widest) width; body 205 is centered under it
export const POT_BODY_W = 205;
/* Plant band height above the pot body's top edge (the band bottom sits ON the
   body top; its lowest ~10px are hidden BEHIND the rim/lip, so ~14px of foliage
   shows above the lip). This is the MAX height any plant reaches. It is capped to
   the TIGHTEST vertical gap between consecutive pot bodies so a plant can never
   cross into the pot above: the closest rows are the monthly accounts, which sit
   on a 90px pitch (Core→Spend), and each pot body is 60px tall + starts 54px below
   its row top, so the gap between one body's bottom and the next body's top is
   90 − 60 = 30px. A 24px band leaves ~6px of clear breathing room in that gap
   (and stays clear even through the pop-in overshoot). The goal rows sit on a
   wider 106px pitch (46px gap), so goal foliage has extra clearance; fullness is
   achieved by DENSITY/WIDTH within this height rather than by taller plants. */
export const POT_PLANT_BAND_H = 24;
export const POT_WRAPPER_TO_BODY = 54; // wrapper top -> pot body top

// income renders the hero + INCOME pill (no pot); its row-top is the pill row.
export const POT_INCOME_TOP = 340;

// Monthly accounts (Core/Spend) sit CLOSE together on a tight 90px pitch; the
// goal pots then get MORE breathing room on a wider 106px pitch. Net: the two
// monthly pots read as a pair, and the goals are no longer cramped.
export const potRowTop: Record<string, number> = {
  income: POT_INCOME_TOP,
  core: 329, // body top 383 − 54
  spend: 419, // core + 90 (tightened toward Core)
  ef1: 539, // spend + 120 (1st-goal gate gap)
  debt: 645, // ef1 + 106 (roomier goal pitch)
  ef6: 751, // debt + 106
};
// Optimizer: shared rows verbatim, then travel/brokerage continue the 106px goal
// pitch (so every goal pot gets the same roomier spacing).
export const potRowTopOptimizer: Record<string, number> = {
  income: POT_INCOME_TOP,
  core: 329,
  spend: 419,
  ef1: 539,
  debt: 645,
  ef6: 751,
  travel: 857, // 751 + 106
  brokerage: 963, // 857 + 106
};

/* pot connector geometry — a thin (~1.25px) gray SPINE at x=50 broken by ~32px
   gaps centered on each gate label, with soft cubic-S wishbone arms into the LEFT
   edge of each pot (arms end at x=160, ~13px before the body left edge 173). Body
   centers = wrapper top + 84: core 413 / spend 503 / ef1 623 / debt 729 / ef6 835.
   Gate junctions sit at each gate's child MIDPOINT so the wishbones mirror:
   monthly 458 (core 413 / spend 503); goals1 straight at ef1 623; goals2 782
   (debt 729 / ef6 835). Reuses the SAME connector ids the pulse engine expects so
   causal pulses (income yellow / core blue / spend green / goals pink) travel it
   unchanged. */
const POT_ARM = (jy: number, cy: number): string =>
  `M84 ${jy} C 122 ${jy}, 122 ${cy}, 160 ${cy}`;
export const connectorsPots: Connector[] = [
  // income pill -> monthly gate: straight spine drop (income sits at the top)
  { id: 'c-income-monthly', d: 'M50 366 L 50 442', arrow: false },
  // vertical spine hops, broken by a gap at each gate label
  { id: 'c-monthly-goals1', d: 'M50 474 L 50 607', arrow: false },
  { id: 'c-goals1-goals2', d: 'M50 639 L 50 766', arrow: false },
  { id: 'c-goals2-down', d: 'M50 798 L 50 946', arrow: false },
  // monthly wishbone -> core(413) / spend(503)
  { id: 'c-monthly-core', d: POT_ARM(458, 413), arrow: false },
  { id: 'c-monthly-spend', d: POT_ARM(458, 503), arrow: false },
  // 1st goal — soft straight-ish branch at the ef1 body center
  { id: 'c-goals1-ef1', d: 'M72 623 C 110 623, 122 623, 160 623', arrow: false },
  // financial-health wishbone -> debt(729) / ef6(835)
  { id: 'c-goals2-debt', d: POT_ARM(782, 729), arrow: false },
  { id: 'c-goals2-ef6', d: POT_ARM(782, 835), arrow: false },
];
// Optimizer: shared rows verbatim, then the 3rd gate appended — spine hop
// goals2 -> goals3 (junction at the travel/brokerage midpoint 994), then a
// symmetric wishbone up to travel(941) / down to brokerage(1047).
export const connectorsPotsOptimizer: Connector[] = [
  { id: 'c-income-monthly', d: 'M50 366 L 50 442', arrow: false },
  { id: 'c-monthly-goals1', d: 'M50 474 L 50 607', arrow: false },
  { id: 'c-goals1-goals2', d: 'M50 639 L 50 766', arrow: false },
  { id: 'c-monthly-core', d: POT_ARM(458, 413), arrow: false },
  { id: 'c-monthly-spend', d: POT_ARM(458, 503), arrow: false },
  { id: 'c-goals1-ef1', d: 'M72 623 C 110 623, 122 623, 160 623', arrow: false },
  { id: 'c-goals2-debt', d: POT_ARM(782, 729), arrow: false },
  { id: 'c-goals2-ef6', d: POT_ARM(782, 835), arrow: false },
  // 3rd gate (appended): spine hop goals2 -> goals3, then the shifted wishbone
  { id: 'c-goals2-goals3', d: 'M50 798 L 50 978', arrow: false },
  { id: 'c-goals3-travel', d: POT_ARM(994, 941), arrow: false },
  { id: 'c-goals3-brokerage', d: POT_ARM(994, 1047), arrow: false },
  { id: 'c-goals3-down', d: 'M50 1010 L 50 1186', arrow: false },
];

// pot gate-label pills (white, on the spine). Simple has two goal gates (1st Goal
// + Financial health); Optimizer inserts a 2nd Goal between them. `top` centers
// each pill on its gate junction (reuses the pbi label shape).
export const potLabels: Record<Dataset, Record<string, PbiLabelInfo>> = {
  simple: {
    monthly: { label: 'Monthly expenses', top: 458, twoLine: true, width: 56 },
    goals1: { label: '1st Goal', top: 623 },
    goals2: { label: 'Financial health', top: 782, twoLine: true, width: 56 },
  },
  optimizer: {
    monthly: { label: 'Monthly expenses', top: 458, twoLine: true, width: 56 },
    goals1: { label: '1st Goal', top: 623 },
    goals2: { label: '2nd Goal', top: 782 },
    goals3: { label: 'Financial health', top: 994, twoLine: true, width: 56 },
  },
};

export const potRowTopFor = (dataset: Dataset): Record<string, number> =>
  dataset === 'optimizer' ? potRowTopOptimizer : potRowTop;
export const connectorsPotsFor = (dataset: Dataset): Connector[] =>
  dataset === 'optimizer' ? connectorsPotsOptimizer : connectorsPots;

/* ============================================================================
   "Grid" (grid) — a schematic, black-line-on-graph-paper tree with GRAY card
   stand-ins. A faint light-gray graph-paper grid fills the board; a thin BLACK
   vertical main spine runs down the left; thin BLACK ORTHOGONAL connectors
   (square corners, NOT curves) branch off it — a plain horizontal stub into each
   individually-branched card (Core / Spend / 1st goal), and a square-cornered
   WISHBONE (spine → horizontal stub → vertical riser → horizontals into each
   card) for each grouped goal pair. BLACK rounded-pill labels with WHITE value
   text sit at the individual junctions. Cards are uniform gray placeholder
   rectangles aligned in a column on the right (intentional stand-ins, no inner
   content). Fully self-contained + grid-scoped; a static graphic layout (no
   per-card fill animation). Mirrors the *For(dataset) structure of every other
   style so the Simple (3 goals) and Optimizer (5 goals) datasets both resolve.
   ============================================================================ */
// Faithful to Figma 878:11263 ("on grid"). The tree is laid out on a 40px module
// (see `.grid-paper`): a UNIFORM 80px card pitch (= 2 cells), with every card CENTER
// and both main SPINES riding gridlines so the composition reads as drawn ON the
// paper. The signature move is a STEPPED spine — an UPPER spine carries the Monthly
// bracket (Core+Spend) and the 1st goal, then the tree STEPS RIGHT to a LOWER spine
// that drops and feeds the goal pairs — so each line only travels as far as it needs.
export const GRID_SPINE_X = 40; // upper spine (Core/Spend bracket + 1st goal) — 1 cell
export const GRID_PILL_X = 56; // value-pill left edge + Core/Spend bracket riser
export const GRID_LOWER_SPINE_X = 160; // stepped-right spine carrying the goal pairs — 4 cells
export const GRID_LOWER_RISER_X = 176; // goal-pair wishbone riser
export const GRID_CARD_LEFT = 200; // gray placeholder card left — 5 cells (scooted 1 cell left)
export const GRID_CARD_W = 188; // uniform card width (longer now that the tree scooted left)
export const GRID_CARD_H = 66; // uniform card height (Figma 66; fits a 2-line name + value)
// Header reserve: the grid tree starts BELOW a pbi-style hero (sprout logo · gray
// subtitle · large serif headline), so every grid Y is shifted DOWN by GRID_TOP.
// 320 = 8 grid cells, so every card center stays a multiple of 40 and keeps riding
// the graph-paper gridlines exactly as before.
export const GRID_TOP = 320;
const GC = (cy: number): number => GRID_TOP + cy; // design-space center -> board space
export const GRID_INCOME_CY = GC(40); // income root-marker center (top of the upper spine)
export const GRID_MARKER = 16; // income root-marker square size

// account/goal card row TOPS (node-wrapper top); card vertical CENTER = top +
// GRID_CARD_H/2. Every center is a multiple of 40 (uniform 80px pitch) so each
// horizontal arm rides a gridline — no section gaps, exactly like the Figma.
export const gridRowTop: Record<string, number> = {
  income: GRID_INCOME_CY - GRID_CARD_H / 2, // wrapper top (marker centers on the spine)
  core: GC(120) - GRID_CARD_H / 2, // center 120 (+ GRID_TOP)
  spend: GC(200) - GRID_CARD_H / 2, // center 200
  ef1: GC(280) - GRID_CARD_H / 2, // center 280
  debt: GC(360) - GRID_CARD_H / 2, // center 360
  ef6: GC(440) - GRID_CARD_H / 2, // center 440
};
// Optimizer: shared rows verbatim, then travel/brokerage as a second grouped pair.
export const gridRowTopOptimizer: Record<string, number> = {
  ...gridRowTop,
  travel: GC(520) - GRID_CARD_H / 2, // center 520
  brokerage: GC(600) - GRID_CARD_H / 2, // center 600
};

export const gridRowTopFor = (dataset: Dataset): Record<string, number> =>
  dataset === 'optimizer' ? gridRowTopOptimizer : gridRowTop;

const gridCardCY = (dataset: Dataset, id: string): number =>
  (gridRowTopFor(dataset)[id] ?? 0) + GRID_CARD_H / 2;

// square-corner geometry helpers (all straight L segments -> crisp right angles).
// A plain horizontal arm from an x to the card left, at a card center y.
const GRID_ARM = (x: number, cy: number): string => `M${x} ${cy} L${GRID_CARD_LEFT} ${cy}`;
// Monthly bracket: the upper spine taps at the Core/Spend midpoint, elbows right to
// the pill-x riser, and that riser spans the two rows — each pill then sits ON the
// riser and its arm continues to the card.
const GRID_BRACKET = (cy1: number, cy2: number): string =>
  `M${GRID_SPINE_X} ${(cy1 + cy2) / 2} L${GRID_PILL_X} ${(cy1 + cy2) / 2}` +
  ` M${GRID_PILL_X} ${cy1} L${GRID_PILL_X} ${cy2}`;
// Goal-pair wishbone off the LOWER spine: tap at the pair midpoint, elbow to the
// lower riser, riser spans the two rows, short arms into each card. No pills.
const GRID_WISHBONE = (cy1: number, cy2: number): string =>
  `M${GRID_LOWER_SPINE_X} ${(cy1 + cy2) / 2} L${GRID_LOWER_RISER_X} ${(cy1 + cy2) / 2}` +
  ` M${GRID_LOWER_RISER_X} ${cy1} L${GRID_LOWER_RISER_X} ${cy2}` +
  ` M${GRID_LOWER_RISER_X} ${cy1} L${GRID_CARD_LEFT} ${cy1}` +
  ` M${GRID_LOWER_RISER_X} ${cy2} L${GRID_CARD_LEFT} ${cy2}`;

// Simple (3 goals): the UPPER spine runs from the income marker down to the 1st-goal
// row, carrying the Core/Spend bracket + the 1st-goal arm. The 1st-goal arm is
// tapped by the LOWER spine, which drops and feeds the debt+ef6 pair via a wishbone.
export const connectorsGrid: Connector[] = [
  { id: 'grid-spine', d: `M${GRID_SPINE_X} ${GRID_INCOME_CY} L${GRID_SPINE_X} ${GC(280)}`, arrow: false },
  { id: 'grid-monthly', d: GRID_BRACKET(GC(120), GC(200)), arrow: false },
  { id: 'grid-core', d: GRID_ARM(GRID_PILL_X, GC(120)), arrow: false },
  { id: 'grid-spend', d: GRID_ARM(GRID_PILL_X, GC(200)), arrow: false },
  { id: 'grid-ef1', d: GRID_ARM(GRID_SPINE_X, GC(280)), arrow: false },
  { id: 'grid-lower-spine', d: `M${GRID_LOWER_SPINE_X} ${GC(280)} L${GRID_LOWER_SPINE_X} ${GC(512)}`, arrow: false },
  { id: 'grid-goals2', d: GRID_WISHBONE(GC(360), GC(440)), arrow: false }, // debt + ef6
];
// Optimizer (5 goals): same upper spine + Monthly bracket + 1st goal, then the lower
// spine drops further to feed TWO goal-pair wishbones (debt+ef6, travel+brokerage).
export const connectorsGridOptimizer: Connector[] = [
  { id: 'grid-spine', d: `M${GRID_SPINE_X} ${GRID_INCOME_CY} L${GRID_SPINE_X} ${GC(280)}`, arrow: false },
  { id: 'grid-monthly', d: GRID_BRACKET(GC(120), GC(200)), arrow: false },
  { id: 'grid-core', d: GRID_ARM(GRID_PILL_X, GC(120)), arrow: false },
  { id: 'grid-spend', d: GRID_ARM(GRID_PILL_X, GC(200)), arrow: false },
  { id: 'grid-ef1', d: GRID_ARM(GRID_SPINE_X, GC(280)), arrow: false },
  { id: 'grid-lower-spine', d: `M${GRID_LOWER_SPINE_X} ${GC(280)} L${GRID_LOWER_SPINE_X} ${GC(672)}`, arrow: false },
  { id: 'grid-goals2', d: GRID_WISHBONE(GC(360), GC(440)), arrow: false }, // debt + ef6
  { id: 'grid-goals3', d: GRID_WISHBONE(GC(520), GC(600)), arrow: false }, // travel + brokerage
];

export const connectorsGridFor = (dataset: Dataset): Connector[] =>
  dataset === 'optimizer' ? connectorsGridOptimizer : connectorsGrid;

// black value pills (WHITE text) sitting at the individually-branched junctions
// (Core / Spend / 1st goal). LEFT-anchored at GRID_PILL_X so all three pills line up
// vertically and each straddles its horizontal arm — the arm enters the pill's left
// and exits its right into the card, exactly like the reference. Text reuses the
// SAME per-card amounts every other style shows: `$X/mo` for accounts, the goal
// target for the 1st goal. Grouped goal pairs get no pill (they branch via the
// square wishbone off the lower spine), matching the reference.
export interface GridPill { id: string; x: number; y: number; text: string }
export function gridValuePillsFor(dataset: Dataset): GridPill[] {
  const cards = cardsFor(dataset);
  const amt = (id: string) => cards.find((c) => c.id === id)?.amount ?? '';
  return [
    { id: 'core', x: GRID_PILL_X, y: gridCardCY(dataset, 'core'), text: `${amt('core')}/mo` },
    { id: 'spend', x: GRID_PILL_X, y: gridCardCY(dataset, 'spend'), text: `${amt('spend')}/mo` },
    { id: 'ef1', x: GRID_PILL_X, y: gridCardCY(dataset, 'ef1'), text: amt('ef1') },
  ];
}
