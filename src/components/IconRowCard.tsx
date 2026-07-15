import {
  BanknoteArrowDown,
  CreditCard,
  House,
  Landmark,
  PiggyBank,
  Plane,
  ReceiptText,
  Umbrella,
  type LucideIcon,
} from 'lucide-react';
import type { CardNode } from '../data';
import { goalDateLabel, progressAt, type Dataset, type DateMode, type Mode } from '../scenario';

// Fixed geometry copied from Figma 729:6187 (same 402px board width). The account
// / goal icon tiles left-align in a column at x≈78.83; INCOME hangs further LEFT
// at x=11 so it sits on the spine (exactly the slim income-vs-account offset). The
// row is stretched to a fixed right edge (386) so goal date pills hug the right.
const RIGHT_EDGE = 386;
const TILE_LEFT_INCOME = 11;
const TILE_LEFT_ACCOUNT = 78.83;

// Per-row icon resolver (Figma 729:6187). income/core/spend map by node id; goals
// map by TITLE KEYWORDS (not slot id) so BOTH datasets resolve correctly — the
// Optimizer reuses the ef1/debt/ef6 slots for 1-Mo EF / 6-Mo EF / House and adds
// travel + brokerage, so a pure slot map would mis-icon it.
function resolveIcon(node: CardNode): LucideIcon {
  if (node.kind === 'income') return BanknoteArrowDown;
  if (node.id === 'core') return ReceiptText;
  if (node.id === 'spend') return CreditCard;
  const t = node.title.toLowerCase();
  if (t.includes('debt')) return PiggyBank;
  if (t.includes('emergency')) return Umbrella;
  if (t.includes('house') || t.includes('home')) return House;
  if (t.includes('travel') || t.includes('slush')) return Plane;
  if (t.includes('brokerage')) return Landmark;
  return Landmark;
}

// per-kind pastel key (matches the Super slim palette): income yellow / core blue
// / spend green / goals pink.
function kindKey(node: CardNode): 'income' | 'blue' | 'green' | 'pink' {
  if (node.kind === 'income') return 'income';
  if (node.kind === 'goal') return 'pink';
  return node.graph === 'green' ? 'green' : 'blue';
}

// line-2 amount text — income/accounts show "$X/mo", goals show "$X goal".
function amountText(node: CardNode): string {
  return node.kind === 'goal' ? `${node.amount} goal` : `${node.amount}/mo`;
}

// line-1 name — income reads "Income"; everything else uses its title.
function nameText(node: CardNode): string {
  return node.kind === 'income' ? 'Income' : node.title;
}

export default function IconRowCard({
  node,
  now,
  mode,
  dataset,
  dateMode = 'date',
}: {
  node: CardNode;
  now: number;
  mode: Mode;
  dataset: Dataset;
  dateMode?: DateMode;
}) {
  // illustrative color-in that keys off progressAt so the tile fills exactly when
  // the funding pulse reaches this row. Income is the source (full once flowing).
  const p = node.kind === 'income' ? (now > 0 ? 1 : 0) : progressAt(dataset, mode, node.id, now);
  const funded = p > 0.001;
  const Icon = resolveIcon(node);
  const kind = kindKey(node);
  const isIncome = node.kind === 'income';
  const isGoal = node.kind === 'goal';

  // anchor the tile in the fixed left column (income further left) and stretch the
  // row to the fixed right edge so goal pills align — the node wrapper still lives
  // at left:node.x, so we offset by the difference (mirrors Super slim).
  const tileLeft = isIncome ? TILE_LEFT_INCOME : TILE_LEFT_ACCOUNT;
  const marginLeft = tileLeft - node.x;
  const width = RIGHT_EDGE - tileLeft;

  return (
    <div className="icon-row" style={{ width, marginLeft }}>
      <span className="icon-tile">
        {/* left-anchored pastel fill behind the icon — width driven purely by the
            already-eased `p` (no CSS width transition, avoids double-easing). */}
        <span className={`icon-fill icon-${kind}`} style={{ width: `${p * 100}%` }} aria-hidden />
        <Icon className="icon-glyph" size={24} strokeWidth={1.75} color="#191919" />
      </span>
      <span className="icon-text">
        <span className="icon-name">{nameText(node)}</span>
        <span className="icon-amount">{amountText(node)}</span>
      </span>
      {isGoal && (
        <span className={`icon-date${funded ? ' funded' : ''}`}>{goalDateLabel(dateMode, node.badge)}</span>
      )}
    </div>
  );
}
