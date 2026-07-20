import { Check, CreditCard, Home, Plane, PiggyBank, Receipt, TrendingUp, Umbrella, type LucideIcon } from 'lucide-react';
import {
  cardsFor,
  pillsLayoutFor,
  sheetRevealMonths,
  sheetRevealStyle,
  PILLS_SPINE_X,
  PILLS_CARD_LEFT,
  PILLS_CARD_W,
  PILLS_PILL_LEFT,
  type CardNode,
} from '../data';
import { goalDateLabel, isReached, type Dataset, type DateMode, type Mode } from '../scenario';
import { HeroHeader } from './Card';

// name-pill tint per node kind/id (Figma 949:10961 secondary palette):
// income = lemon-light, core = water-light, spend = leaf-light, goals = petal.
const PILL_TINT: Record<string, string> = {
  income: '#fbedb8',
  core: '#d7ecff',
  spend: '#b0ddba',
  goal: '#f7dfe9',
};

// bare line-icon glyph in each name pill, picked from the id / goal title — same
// vocabulary as the "Progress bar, inside" card icons.
function iconFor(node: CardNode): LucideIcon | null {
  if (node.kind === 'income') return null; // Figma "Paycheck" pill carries no icon
  if (node.kind === 'account') return node.id === 'core' ? Receipt : CreditCard;
  const t = node.title.toLowerCase();
  if (/debt/.test(t)) return PiggyBank;
  if (/house/.test(t)) return Home;
  if (/travel|slush/.test(t)) return Plane;
  if (/brokerage|invest/.test(t)) return TrendingUp;
  return Umbrella; // emergency funds + default
}

// short name shown in the colored pill
function pillName(node: CardNode): string {
  if (node.kind === 'income') return 'Paycheck';
  if (node.kind === 'account') return node.pill ?? node.title;
  return node.title;
}

const ARM_END = PILLS_PILL_LEFT - 6; // arms/braces stop just before the pill left edge
const TRUNK_LEAD = 0.3; // months the trunk leads its gate's pop
const BRACE_SPAN = 0.34; // months a gate brace takes to draw into its child
const BRANCH_STROKE = '#c7cad0';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// a single draw-on branch. pathLength=1 normalizes ANY path (straight OR curved
// brace) so the dashoffset reveal is exact without measuring geometry.
function Branch({ d, grow, arrow = false }: { d: string; grow: number; arrow?: boolean }) {
  if (grow <= 0.0001) return null;
  return (
    <path
      d={d}
      stroke={BRANCH_STROKE}
      strokeWidth={1.6}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      pathLength={1}
      strokeDasharray="1 1"
      strokeDashoffset={(1 - grow).toFixed(3)}
      markerEnd={arrow && grow > 0.96 ? 'url(#pills-arrow)' : undefined}
    />
  );
}

// a gate = one trunk junction that braces into 1..n child rows. A single child
// gets a straight arm; 2+ children fork via mirrored horizontal-tangent cubics
// (the wishbone/brace geometry used across the money-map styles).
interface PillsGate {
  key: string;
  jy: number; // trunk junction y (center of its children)
  children: { id: string; cy: number }[];
  arrow: boolean; // draw a downward arrowhead where the trunk drops INTO this gate
}

export default function PillsBoard({
  dataset,
  now,
  mode,
  dateMode,
}: {
  dataset: Dataset;
  now: number;
  mode: Mode;
  dateMode: DateMode;
}) {
  const layout = pillsLayoutFor(dataset);
  const nodes = cardsFor(dataset);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const reveal = sheetRevealMonths(dataset, mode);
  const rm = (id: string) => reveal[id] ?? 0;

  const flatRows = layout.sections.flatMap((s) => s.rows);
  const cyOf = (id: string) => flatRows.find((r) => r.id === id)?.cy ?? 0;
  const growWin = (start: number, end: number) => (end <= start ? (now >= end ? 1 : 0) : clamp01((now - start) / (end - start)));

  // GATE/BRANCH TREE (mirrors the app's money-map gate structure):
  //   income (root) → monthly gate {core, spend} → goals gate(s) {ef1} {debt,ef6} …
  // The goals section's internal gates match sectionsFor: 1st gate = ef1 (single
  // arm), 2nd = debt+ef6 (fork), and for Optimizer a 3rd = travel+brokerage (fork).
  const goalGates: string[][] = dataset === 'optimizer' ? [['ef1'], ['debt', 'ef6'], ['travel', 'brokerage']] : [['ef1'], ['debt', 'ef6']];
  const mid = (a: number, b: number) => (a + b) / 2;
  const gates: PillsGate[] = [
    { key: 'income', jy: cyOf('income'), children: [{ id: 'income', cy: cyOf('income') }], arrow: false },
    { key: 'monthly', jy: mid(cyOf('core'), cyOf('spend')), children: [{ id: 'core', cy: cyOf('core') }, { id: 'spend', cy: cyOf('spend') }], arrow: true },
    ...goalGates.map((g, i) => {
      const cys = g.map(cyOf);
      return { key: `goal-${g.join('-')}`, jy: cys.length > 1 ? mid(cys[0], cys[cys.length - 1]) : cys[0], children: g.map((id) => ({ id, cy: cyOf(id) })), arrow: i === 0 };
    }),
  ];
  const targetOf = (gt: PillsGate) => Math.min(...gt.children.map((c) => rm(c.id)));

  // brace path: single child → straight arm; forked child → mirrored cubic
  const K = (ARM_END - PILLS_SPINE_X) * 0.62; // control-point reach for horizontal tangents
  const bracePath = (jy: number, cy: number) =>
    Math.abs(cy - jy) < 0.5
      ? `M${PILLS_SPINE_X} ${cy} L${ARM_END} ${cy}`
      : `M${PILLS_SPINE_X} ${jy} C${PILLS_SPINE_X + K} ${jy}, ${ARM_END - K} ${cy}, ${ARM_END} ${cy}`;

  return (
    <div className="pills-board">
      <HeroHeader dataset={dataset} />

      {/* proper branching tree: main trunk + section gates that brace into their
          child rows, drawing on causally as the flow tip descends. */}
      <svg className="pills-tree" width="402" height={layout.height} viewBox={`0 0 402 ${layout.height}`} fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="pills-arrow" markerWidth="8" markerHeight="8" refX="3.4" refY="4" orient="auto" markerUnits="userSpaceOnUse">
            <path d="M1 1.6 L5 4 L1 6.4" fill="none" stroke={BRANCH_STROKE} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </marker>
        </defs>
        {/* main trunk, segment by segment between gate junctions */}
        {gates.slice(0, -1).map((g, i) => {
          const next = gates[i + 1];
          return (
            <Branch
              key={`trunk-${g.key}`}
              d={`M${PILLS_SPINE_X} ${g.jy} L${PILLS_SPINE_X} ${next.jy}`}
              grow={growWin(targetOf(g) - TRUNK_LEAD, targetOf(next) - TRUNK_LEAD)}
              arrow={next.arrow}
            />
          );
        })}
        {/* each gate's braces into its child rows */}
        {gates.flatMap((g) =>
          g.children.map((c) => (
            <Branch
              key={`brace-${c.id}`}
              d={bracePath(g.jy, c.cy)}
              grow={growWin(rm(c.id) - BRACE_SPAN, rm(c.id))}
            />
          )),
        )}
      </svg>

      {/* section cards + label pills */}
      {layout.sections.map((s) => {
        const firstId = s.rows[0]?.id ?? '';
        const rs = sheetRevealStyle(now, rm(firstId));
        return (
          <div key={`sec-${s.id}`}>
            <div
              className="pills-section-label"
              style={{ left: PILLS_CARD_LEFT, top: s.labelTop, opacity: rs.opacity, transition: 'none' }}
            >
              {s.label}
            </div>
            <div
              className="pills-card"
              style={{ left: PILLS_CARD_LEFT, top: s.cardTop, width: PILLS_CARD_W, height: s.cardH, opacity: rs.opacity, transition: 'none' }}
            />
          </div>
        );
      })}

      {/* colored name pills + amount/date text, popping in as the tip arrives */}
      {flatRows.map((r) => {
        const node = byId.get(r.id);
        if (!node) return null;
        const rowRs = sheetRevealStyle(now, rm(r.id));
        const Icon = iconFor(node);
        const tint = node.kind === 'goal' ? PILL_TINT.goal : PILL_TINT[node.id] ?? PILL_TINT.goal;
        const reached = node.kind === 'goal' && isReached(dataset, mode, node.id, now);
        const rowStyle = {
          left: PILLS_PILL_LEFT,
          top: r.cy,
          opacity: rowRs.opacity,
          transform: `translateY(-50%) scale(${rowRs.scale})`,
          transformOrigin: 'left center',
          transition: 'none' as const,
        };
        return (
          <div key={`row-${r.id}`} className="pills-row" style={rowStyle}>
            <span className="pills-pill" style={{ background: tint }}>
              {Icon && <Icon size={16} strokeWidth={2} color="#111" />}
              <span className="pills-pill-name">{pillName(node)}</span>
            </span>
            {node.kind === 'goal' ? (
              <span className={`pills-meta${reached ? ' reached' : ''}`}>
                by {goalDateLabel(dateMode, node.badge)}
                {reached && <Check size={15} strokeWidth={3} color="#e0489a" className="pills-check" />}
              </span>
            ) : (
              <span className="pills-meta pills-meta--amt">{node.amount} a month</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
