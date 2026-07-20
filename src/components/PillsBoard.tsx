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

const ARM_END = PILLS_PILL_LEFT - 6; // arm stops just before the pill left edge
const ARM_LEAD = 0.35; // months the arm/spine lead the pill pop
const ARM_SPAN = 0.3; // months an arm takes to draw on

// straight draw-on segment: analytic length so no path measuring is needed.
function Segment({ d, len, grow, w = 1.5 }: { d: string; len: number; grow: number; w?: number }) {
  if (len <= 0 || grow <= 0.0001) return null;
  return (
    <path
      d={d}
      stroke="#cfd2d6"
      strokeWidth={w}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={`${len.toFixed(2)} ${len.toFixed(2)}`}
      strokeDashoffset={(len * (1 - grow)).toFixed(2)}
    />
  );
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

  // flat top-to-bottom row order for the spine + causal timing
  const flatRows = layout.sections.flatMap((s) => s.rows);
  const ramp = (start: number, end: number) => {
    if (end <= start) return now >= end ? 1 : 0;
    return Math.max(0, Math.min(1, (now - start) / (end - start)));
  };

  return (
    <div className="pills-board">
      <HeroHeader dataset={dataset} />

      {/* thin gray spine + wishbone arms, drawing on as the flow tip descends */}
      <svg className="pills-tree" width="402" height={layout.height} viewBox={`0 0 402 ${layout.height}`} fill="none" xmlns="http://www.w3.org/2000/svg">
        {flatRows.slice(0, -1).map((r, i) => {
          const next = flatRows[i + 1];
          const grow = ramp(rm(r.id) - ARM_LEAD, rm(next.id) - ARM_LEAD);
          return (
            <Segment
              key={`spine-${r.id}`}
              d={`M${PILLS_SPINE_X} ${r.cy} L${PILLS_SPINE_X} ${next.cy}`}
              len={Math.abs(next.cy - r.cy)}
              grow={grow}
            />
          );
        })}
        {flatRows.map((r) => (
          <Segment
            key={`arm-${r.id}`}
            d={`M${PILLS_SPINE_X} ${r.cy} L${ARM_END} ${r.cy}`}
            len={ARM_END - PILLS_SPINE_X}
            grow={ramp(rm(r.id) - ARM_LEAD, rm(r.id) - ARM_LEAD + ARM_SPAN)}
          />
        ))}
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
