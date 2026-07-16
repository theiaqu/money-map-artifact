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
// "Labeled" gate (Figma 738:7107): account/goal tiles are INDENTED to the right
// (tile left 116) and the Card wrapper is already placed there, so the row needs
// no marginLeft — only a fixed right edge so goal date pills still align.
const LABELED_TILE_LEFT = 116;

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
  labeled = false,
}: {
  node: CardNode;
  now: number;
  mode: Mode;
  dataset: Dataset;
  dateMode?: DateMode;
  labeled?: boolean; // "Labeled" gate layout: income top-center + indented tiles
}) {
  // illustrative color-in that keys off progressAt so the tile fills exactly when
  // the funding pulse reaches this row. Income is the source (full once flowing).
  const p = node.kind === 'income' ? (now > 0 ? 1 : 0) : progressAt(dataset, mode, node.id, now);
  const funded = p > 0.001;
  const Icon = resolveIcon(node);
  const kind = kindKey(node);
  const isIncome = node.kind === 'income';
  const isGoal = node.kind === 'goal';

  // the white icon tile with its left-anchored pastel fill (width driven purely
  // by the already-eased `p`, no CSS width transition) — shared by both layouts.
  const tile = (
    <span className="icon-tile">
      <span className={`icon-fill icon-${kind}`} style={{ width: `${p * 100}%` }} aria-hidden />
      <Icon className="icon-glyph" size={24} strokeWidth={1.75} color="#191919" />
    </span>
  );

  // "Labeled" gate layout (Figma 738:7107): income is a TOP-CENTER stack (text
  // above the tile, center-aligned); accounts/goals keep the horizontal row but
  // sit in the indented tile column (the Card wrapper is already at tile left 116,
  // so no marginLeft — just a fixed right edge so goal date pills still align).
  if (labeled) {
    if (isIncome) {
      return (
        <div className="icon-row-income-top">
          <span className="icon-income-text">
            <span className="icon-name">{nameText(node)}</span>
            <span className="icon-amount">{amountText(node)}</span>
          </span>
          {tile}
        </div>
      );
    }
    return (
      <div className="icon-row" style={{ width: RIGHT_EDGE - LABELED_TILE_LEFT }}>
        {tile}
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

  // anchor the tile in the fixed left column (income further left) and stretch the
  // row to the fixed right edge so goal pills align — the node wrapper still lives
  // at left:node.x, so we offset by the difference (mirrors Super slim).
  const tileLeft = isIncome ? TILE_LEFT_INCOME : TILE_LEFT_ACCOUNT;
  const marginLeft = tileLeft - node.x;
  const width = RIGHT_EDGE - tileLeft;

  return (
    <div className="icon-row" style={{ width, marginLeft }}>
      {tile}
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
