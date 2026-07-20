import { Check, CreditCard, Home, Plane, PiggyBank, Receipt, TrendingUp, Umbrella, type LucideIcon } from 'lucide-react';
import {
  cardsFor,
  pillsLayoutFor,
  sheetRevealMonths,
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

// short name shown in the colored pill. Pills-ONLY display transform: goal EF
// titles are shortened ("1 Month Emergency Fund" → "1 Month Fund") so the pills
// don't run too wide. Underlying dataset titles are untouched.
function pillName(node: CardNode): string {
  if (node.kind === 'income') return 'Paycheck';
  if (node.kind === 'account') return node.pill ?? node.title;
  return node.title.replace(/emergency fund/i, 'Fund');
}

// Figma 949:10961 connector spec (from the exported vectors):
//   • stroke #d9d9d9, 2px, round caps/joins
//   • single pills → a straight horizontal arm off the trunk
//   • forked pills (Core/Spend, goal pairs) → a short straight STUB off the
//     trunk then a tight S-curve brace (horizontal tangents both ends)
//   • DOWNWARD chevron arrowheads sit on the trunk where it crosses into the
//     next section; per the task we also add a chevron at each arm's pill end.
const SPINE = PILLS_SPINE_X;
const ARM_END = PILLS_PILL_LEFT - 8; // arms/braces stop just before the pill; chevron tip lands here
const STUB = 10; // straight stub off the trunk before a fork brace curves away
const RUN = 12; // straight horizontal run at the arm's end so the arrowhead sits on a clean, level segment
const BRANCH_STROKE = '#d9d9d9';
const STROKE_W = 2;

// ---- causal cascade phase durations (in sim months) ----
// Each phase draws for its duration, then a small HANDOFF gap, then the next
// phase begins — so the flow reads as a strict chain (nothing starts before the
// previous tip arrives). See the timeline built inside the component.
const D_PILL = 0.3; // left→right pill wipe
const D_ARM = 0.26; // an arm drawing to/from its pill
const D_TRUNK = 0.26; // a trunk segment dropping into the next section
const HANDOFF = 0.045; // deliberate gap between phases
const SEC_GHOST = 0.1; // resting opacity of a not-yet-reached section card/label

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// a single draw-on branch. pathLength=1 normalizes ANY path (straight OR curved
// brace) so the dashoffset reveal is exact without measuring geometry.
function Branch({ d, grow }: { d: string; grow: number }) {
  if (grow <= 0.0001) return null;
  return (
    <path
      d={d}
      stroke={BRANCH_STROKE}
      strokeWidth={STROKE_W}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      pathLength={1}
      strokeDasharray="1 1"
      strokeDashoffset={(1 - grow).toFixed(3)}
    />
  );
}

// a standalone chevron arrowhead matching the Figma vectors. 'down' points into
// the next section along the trunk; 'right' points into a destination pill.
// Drawn as an absolute-sized path (NOT an SVG <marker>) so it is never scaled by
// stroke width or distorted by a viewBox — the aspect ratio is always correct.
const CHEV = 5; // half-extent of each chevron arm (px) → ~10px tall/wide, clean 45°
function Chevron({ x, y, dir, show }: { x: number; y: number; dir: 'down' | 'right' | 'left'; show: boolean }) {
  if (!show) return null;
  const a = CHEV;
  const d =
    dir === 'down'
      ? `M${x - a} ${y - a} L${x} ${y} L${x + a} ${y - a}` // ⌄ tip at (x,y)
      : dir === 'left'
        ? `M${x + a} ${y - a} L${x} ${y} L${x + a} ${y + a}` // ‹ tip at (x,y), for income flowing OUT toward the trunk
        : `M${x - a} ${y - a} L${x} ${y} L${x - a} ${y + a}`; // › tip at (x,y)
  return <path d={d} stroke={BRANCH_STROKE} strokeWidth={STROKE_W} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
}

// a gate = one trunk junction that braces into 1..n child rows. A single child
// gets a straight arm; 2+ children fork via mirrored horizontal-tangent cubics
// (the wishbone/brace geometry used across the money-map styles).
interface PillsGate {
  key: string;
  jy: number; // trunk junction y (center of its children)
  children: { id: string; cy: number }[];
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
    { key: 'income', jy: cyOf('income'), children: [{ id: 'income', cy: cyOf('income') }] },
    { key: 'monthly', jy: mid(cyOf('core'), cyOf('spend')), children: [{ id: 'core', cy: cyOf('core') }, { id: 'spend', cy: cyOf('spend') }] },
    ...goalGates.map((g) => {
      const cys = g.map(cyOf);
      return { key: `goal-${g.join('-')}`, jy: cys.length > 1 ? mid(cys[0], cys[cys.length - 1]) : cys[0], children: g.map((id) => ({ id, cy: cyOf(id) })) };
    }),
  ];
  // brace path (Figma geometry): single child (jy==cy) → a straight horizontal
  // arm; a forked child → a short straight STUB off the trunk, an S-curve with
  // horizontal tangents at both ends, then a straight RUN into the pill so the
  // arrowhead lands on a clean, level segment (never mid-curve).
  const bracePath = (jy: number, cy: number) => {
    if (Math.abs(cy - jy) < 0.5) return `M${SPINE} ${cy} L${ARM_END} ${cy}`;
    const sx = SPINE + STUB; // stub end / curve start
    const ex = ARM_END - RUN; // curve end / straight-run start
    const k = Math.max(6, (ex - sx) * 0.5);
    return `M${SPINE} ${jy} L${sx} ${jy} C${sx + k} ${jy}, ${ex - k} ${cy}, ${ex} ${cy} L${ARM_END} ${cy}`;
  };

  // ------------------------------------------------------------------------
  // EXPLICIT CAUSAL CASCADE TIMELINE (in sim months, anchored at the first
  // paycheck). Every phase begins only after the previous phase's tip arrives,
  // so the flow reads as money physically travelling down the map:
  //   1 Paycheck pill wipes in
  //   2 the income arm draws OUT of the pill toward the trunk
  //   3 the trunk drops DOWN into Monthly Expenses (+ its down-chevron)
  //   4 the Monthly gate fires → Core + Spend arms draw, then their pills wipe
  //   5 the trunk continues DOWN into Goals (+ its down-chevron)
  //   6 each Goals gate fires in turn → arm(s) draw, then pill(s) wipe; for
  //     Optimizer this cascades gate-by-gate (goals1 → goals2 → goals3).
  // It's a pure function of `now`, so scrubbing/replaying stays exact.
  // ------------------------------------------------------------------------
  let tc = rm('income'); // anchor: first paycheck arrival in the sim
  const step = (dur: number): [number, number] => {
    const s = tc;
    tc = s + dur;
    return [s, tc];
  };
  const gap = () => {
    tc += HANDOFF;
  };
  const win = ([s, e]: [number, number]) => growWin(s, e);

  const wIncomePill = step(D_PILL);
  gap();
  const wIncomeArm = step(D_ARM);
  gap();
  const wTrunk0 = step(D_TRUNK); // trunk drops into Monthly Expenses
  gap();
  const wMonthlyArms = step(D_ARM); // Core + Spend arms draw together
  gap();
  const wMonthlyPills = step(D_PILL); // Core + Spend pills wipe in
  gap();
  const wTrunk1 = step(D_TRUNK); // trunk drops into Goals
  gap();

  const goalGateCount = gates.length - 2;
  const wGoalArm: [number, number][] = [];
  const wGoalPill: [number, number][] = [];
  const wGoalTrunk: Record<number, [number, number]> = {}; // trunk-seg index → window
  for (let gi = 0; gi < goalGateCount; gi++) {
    if (gi > 0) {
      wGoalTrunk[1 + gi] = step(D_TRUNK); // trunk from the prior goal gate down to this one
      gap();
    }
    wGoalArm[gi] = step(D_ARM);
    gap();
    wGoalPill[gi] = step(D_PILL);
    gap();
  }

  // per-element window lookups
  const armWinFor = (gateIdx: number): [number, number] =>
    gateIdx === 0 ? wIncomeArm : gateIdx === 1 ? wMonthlyArms : wGoalArm[gateIdx - 2];
  const pillWinFor = (id: string): [number, number] => {
    if (id === 'income') return wIncomePill;
    if (id === 'core' || id === 'spend') return wMonthlyPills;
    const gi = goalGates.findIndex((g) => g.includes(id));
    return gi >= 0 ? wGoalPill[gi] : wIncomePill;
  };
  const secWinFor = (id: 'income' | 'monthly' | 'goals'): [number, number] =>
    id === 'income' ? wIncomePill : id === 'monthly' ? wTrunk0 : wTrunk1;

  // main-trunk segments between gate junctions, each driven by its phase window
  const trunkSegs = gates.slice(0, -1).map((g, i) => {
    const w = i === 0 ? wTrunk0 : i === 1 ? wTrunk1 : wGoalTrunk[i];
    return { key: g.key, y0: g.jy, y1: gates[i + 1].jy, grow: w ? win(w) : 0 };
  });

  // DOWNWARD trunk chevrons where the trunk crosses into Monthly / Goals; each
  // reveals once its trunk segment's draw-on tip has descended past that y.
  const secBy = (id: 'income' | 'monthly' | 'goals') => layout.sections.find((s) => s.id === id);
  const trunkChevrons: { y: number; show: boolean }[] = [];
  ([['monthly', 0] as const, ['goals', 1] as const]).forEach(([sec, segIdx]) => {
    const s = secBy(sec);
    const seg = trunkSegs[segIdx];
    if (!s || !seg) return;
    const y = s.labelTop - 3; // in the inter-section gap, above the label
    const frac = seg.y1 > seg.y0 ? (y - seg.y0) / (seg.y1 - seg.y0) : 1;
    trunkChevrons.push({ y, show: seg.grow >= frac - 0.001 });
  });

  return (
    <div className="pills-board">
      <HeroHeader dataset={dataset} />

      {/* proper branching tree: main trunk + section gates that brace into their
          child rows, drawing on causally as the flow tip descends. Chevron
          arrowheads mark direction of flow (down the trunk / into each pill). */}
      <svg className="pills-tree" width="402" height={layout.height} viewBox={`0 0 402 ${layout.height}`} fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* main trunk, segment by segment between gate junctions */}
        {trunkSegs.map((seg) => (
          <Branch key={`trunk-${seg.key}`} d={`M${SPINE} ${seg.y0} L${SPINE} ${seg.y1}`} grow={seg.grow} />
        ))}
        {/* downward chevrons where the trunk enters Monthly / Goals */}
        {trunkChevrons.map((c, i) => (
          <Chevron key={`tchev-${i}`} x={SPINE} y={c.y} dir="down" show={c.show} />
        ))}
        {/* each gate's braces into its child rows, + a chevron into each pill.
            EXCEPTION: the income arm flows OUT of the Paycheck toward the trunk,
            so it draws from the pill end inward and its chevron points left. */}
        {gates.flatMap((g, gateIdx) =>
          g.children.map((c) => {
            const armGrow = win(armWinFor(gateIdx));
            if (c.id === 'income') {
              return (
                <g key="arm-income">
                  <Branch d={`M${ARM_END} ${c.cy} L${SPINE} ${c.cy}`} grow={armGrow} />
                  <Chevron x={SPINE + 7} y={c.cy} dir="left" show={armGrow >= 0.82} />
                </g>
              );
            }
            return (
              <g key={`arm-${c.id}`}>
                <Branch d={bracePath(g.jy, c.cy)} grow={armGrow} />
                <Chevron x={ARM_END} y={c.cy} dir="right" show={armGrow >= 0.82} />
              </g>
            );
          }),
        )}
      </svg>

      {/* section cards + label pills — a faint ghost until that section's phase
          arrives (income at its pill, monthly/goals as the trunk drops in). */}
      {layout.sections.map((s) => {
        const op = SEC_GHOST + (1 - SEC_GHOST) * win(secWinFor(s.id));
        return (
          <div key={`sec-${s.id}`}>
            <div
              className="pills-section-label"
              style={{ left: PILLS_CARD_LEFT, top: s.labelTop, opacity: op, transition: 'none' }}
            >
              {s.label}
            </div>
            <div
              className="pills-card"
              style={{ left: PILLS_CARD_LEFT, top: s.cardTop, width: PILLS_CARD_W, height: s.cardH, opacity: op, transition: 'none' }}
            />
          </div>
        );
      })}

      {/* colored name pills + amount/date text. Each row is REVEALED with a
          left→right clip wipe (same feel as the "Progress bar, inside" bars
          filling left→right) the instant the flow tip reaches it — a seamless
          hand-off from the brace drawing into the pill. Tied to the same causal
          timing (sheetRevealMonths) so it stays correct when scrubbing/replaying. */}
      {flatRows.map((r) => {
        const node = byId.get(r.id);
        if (!node) return null;
        const wipe = win(pillWinFor(r.id));
        const Icon = iconFor(node);
        const tint = node.kind === 'goal' ? PILL_TINT.goal : PILL_TINT[node.id] ?? PILL_TINT.goal;
        const reached = node.kind === 'goal' && isReached(dataset, mode, node.id, now);
        // "Monthly split" shared-element morph source role: Paycheck → income,
        // Core → bills, Spend → spend, every goal → goals (fan-in). The ghost
        // colour is the pill's own tint so the flight starts matching the pill.
        const morphRole =
          node.kind === 'goal' ? 'goals' : node.id === 'core' ? 'bills' : node.id === 'spend' ? 'spend' : node.kind === 'income' ? 'income' : undefined;
        const rowStyle = {
          left: PILLS_PILL_LEFT,
          top: r.cy,
          // -8px top/bottom/left keeps rounded corners + icons from being clipped;
          // the right inset sweeps 100%→0% to reveal the row left→right. No inline
          // `transition` so the morph's is-morphing opacity crossfade can drive the
          // row in/out (an inline transition would override that stylesheet rule).
          clipPath: `inset(-8px ${((1 - wipe) * 100).toFixed(2)}% -8px -8px)`,
          transform: 'translateY(-50%)',
        };
        return (
          <div
            key={`row-${r.id}`}
            className="pills-row"
            style={rowStyle}
            {...(morphRole ? { 'data-morph': morphRole, 'data-morph-color': tint } : {})}
          >
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
