export type GraphColor = 'yellow' | 'blue' | 'green' | 'pink';

export type CardKind = 'income' | 'account' | 'goal';

// gate styling: full icon cards, compact text pills, or plain-text-only labels
// (the last renders bold uppercase text with no box, alongside colored ropes)
export type BranchStyle = 'standard' | 'compact' | 'text-only';

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

export const cards: CardNode[] = [
  { id: 'income', kind: 'income', x: 93, y: 57, title: 'Income', amount: '$10,000', suffix: 'per month', graph: 'yellow' },
  { id: 'core', kind: 'account', x: 158, y: 234, title: 'Core Account', amount: '$5,000', suffix: 'per month', graph: 'blue', pill: 'Core' },
  { id: 'spend', kind: 'account', x: 157, y: 354, title: 'Spend Account', amount: '$3,000', suffix: 'per month', graph: 'green', pill: 'Spend' },
  { id: 'ef1', kind: 'goal', x: 157, y: 478, title: '1 Month Emergency Fund', amount: '$5,000', suffix: 'goal', graph: 'pink', badge: 'Oct 2026', pill: 'Emergency fund', mapMain: 'Oct 2026' },
  { id: 'debt', kind: 'goal', x: 157, y: 621, title: 'Pay off debt', amount: '$20,000', suffix: 'goal', graph: 'pink', badge: 'Jan 2028', pill: 'Pay off debt', mapMain: 'Jan 2028' },
  { id: 'ef6', kind: 'goal', x: 157, y: 764, title: '6 Month Emergency Fund', amount: '$18,000', suffix: 'goal', graph: 'pink', badge: 'Mar 2028', pill: 'Emergency fund', mapMain: 'Mar 2028' },
];

export const sections: SectionNode[] = [
  { id: 'monthly', x: 10, y: 305, label: 'Monthly expenses', icon: 'calendar-sync' },
  { id: 'goals1', x: 10, y: 514, label: '1st Goals', icon: 'goal' },
  { id: 'goals2', x: 10, y: 736, label: '2nd Goals', icon: 'goal' },
];

export const percentBadges: PercentBadge[] = [
  { id: 'p70a', x: 110, y: 305, text: '70%' },
  { id: 'p30a', x: 110, y: 360, text: '30%' },
  { id: 'p100', x: 107, y: 535, text: '100%' },
  { id: 'p70b', x: 110, y: 718, text: '70%' },
  { id: 'p30b', x: 110, y: 772, text: '30%' },
];

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
  // monthly expenses fan-out
  { id: 'c-monthly-core', d: 'M91 342 C 126 342, 122 289, 157 289', arrow: false },
  { id: 'c-monthly-spend', d: 'M91 342 C 126 342, 122 409, 157 409', arrow: false },
  // 1st goals fan-out
  { id: 'c-goals1-ef1', d: 'M91 541 C 126 541, 122 544, 157 544', arrow: false },
  // 2nd goals fan-out
  { id: 'c-goals2-debt', d: 'M91 763 C 126 763, 122 688, 157 688', arrow: false },
  { id: 'c-goals2-ef6', d: 'M91 763 C 126 763, 122 830, 157 830', arrow: false },
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
  { id: 'c-monthly-core', d: 'M81 348 C 120 348, 118 289, 157 289', arrow: false },
  { id: 'c-monthly-spend', d: 'M81 348 C 120 348, 118 409, 157 409', arrow: false },
  { id: 'c-goals1-ef1', d: 'M75 521 C 116 521, 112 544, 157 544', arrow: false },
  { id: 'c-goals2-debt', d: 'M79 692 C 118 692, 114 688, 157 688', arrow: false },
  { id: 'c-goals2-ef6', d: 'M79 692 C 118 692, 114 830, 157 830', arrow: false },
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
  // income S-curve into the monthly pill (double-bezier, matches Vector 702)
  { id: 'c-income-monthly', d: 'M201 168 C 201 197, 146 197, 106 222 C 66 247, 49 301, 49 331', arrow: false },

  // vertical spine (x=49), broken by the three pills
  { id: 'c-monthly-goals1', d: 'M49 372 L 49 508', arrow: false },
  { id: 'c-goals1-goals2', d: 'M49 540 L 49 678', arrow: false },
  { id: 'c-goals2-down', d: 'M49 708 L 49 946', arrow: false },

  // monthly wishbone — shared junction (85,348), symmetric ±60
  { id: 'c-monthly-core', d: 'M85 348 C 121 348, 121 277, 157 277', arrow: false },
  { id: 'c-monthly-spend', d: 'M85 348 C 121 348, 121 397, 157 397', arrow: false },

  // 1st goal — straight horizontal at the pill center
  { id: 'c-goals1-ef1', d: 'M78 522 L 157 522', arrow: false },

  // 2nd goal brace — shared junction (78,693)
  { id: 'c-goals2-debt', d: 'M78 693 C 118 693, 118 664, 157 664', arrow: false },
  { id: 'c-goals2-ef6', d: 'M78 693 C 118 693, 118 819, 157 819', arrow: false },
];
