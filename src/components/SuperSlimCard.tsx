import type { CardNode } from '../data';
import { progressAt, goalDateLabel, type Dataset, type Mode, type DateMode } from '../scenario';

// Fixed two-column geometry copied from Figma 496:5864. The Figma canvas is the
// same 402px width as our board, so these x's map 1:1:
//   - account/goal NAME pills left-align in a column at x=72 (Figma "account"
//     container left=72); INCOME sits further left at x=16 (Figma node 496:5865).
//   - TARGET pills right-align to a column whose right edge is x=386 (Figma
//     "target" container left=244 + width=142). Income/account targets fill that
//     142px width; goal targets are auto-width and hug the right edge.
// The node wrapper stays at left:node.x/top:node.y (per the card contract); we
// shift the row so its name pill lands in the fixed left column regardless of the
// underlying card x, and stretch it so every target pill's right edge lands at 386.
const RIGHT_EDGE = 386;
const NAME_LEFT_ACCOUNT = 72;
const NAME_LEFT_INCOME = 16;
// Figma target container width (142px) — income/account target pills fill it so
// their colored boxes left-align at x=244; goal pills stay auto-width.
const TARGET_FILL_W = 142;

// per-kind target pill palette (Figma 496:5864 — matches the light pastels /
// darkest text used elsewhere in the app). The pre-funding "inactive" look is a
// neutral gray defined in CSS (.slim-target base); these are the funded colors.
function kindClass(node: CardNode): string {
  if (node.kind === 'income') return 'slim-income'; // yellow
  if (node.kind === 'goal') return 'slim-pink';
  return node.graph === 'green' ? 'slim-green' : 'slim-blue'; // spend vs core
}

// short name shown in the left white pill: accounts use their category label
// (Core / Spend); income + goals use their title (Income / "1 Month Emergency
// Fund"). Falls back to the title when no short label exists.
function namePillText(node: CardNode): string {
  if (node.kind === 'account') return node.pill ?? node.title;
  return node.title;
}

// target pill text: goals show the fund-by date only (absolute badge or the
// relative "{N} mo. from now" per the Goal date toggle); income/accounts show the
// monthly amount. Uses the app's REAL data ($10,000 / $5,000 / $3,000 / dates),
// not the Figma mock numbers.
function targetText(node: CardNode, dateMode: DateMode): string {
  if (node.kind === 'goal') return goalDateLabel(dateMode, node.badge);
  return `${node.amount} each month`;
}

export default function SuperSlimCard({ node, now, mode, dataset, dateMode = 'date' }: { node: CardNode; now: number; mode: Mode; dataset: Dataset; dateMode?: DateMode }) {
  // fill fraction — illustrative color-in that keys off progressAt so the target
  // pill colors in exactly when the funding comet contacts this card. Income is
  // the source, so it activates as soon as money starts flowing.
  const p = node.kind === 'income' ? (now > 0 ? 1 : 0) : progressAt(dataset, mode, node.id, now);
  const funded = p > 0.001;

  // Anchor the name pill in the fixed left column and stretch the row so the
  // target pill's right edge lands in the fixed right column — identical across
  // every row (the node wrapper still lives at left:node.x, so we offset by the
  // difference). Income uses the further-left column, matching Figma 496:5864.
  const isIncome = node.kind === 'income';
  const nameLeft = isIncome ? NAME_LEFT_INCOME : NAME_LEFT_ACCOUNT;
  const marginLeft = nameLeft - node.x;
  const width = RIGHT_EDGE - nameLeft;
  // income + accounts fill the 142px target column (colored boxes align at 244);
  // goals stay auto-width and hug the right edge.
  const fill = node.kind !== 'goal';

  return (
    <div className="slim-row" style={{ width, marginLeft }}>
      <span className="slim-name">{namePillText(node)}</span>
      <span className={`slim-dots${funded ? ' funded' : ''}`} aria-hidden />
      <span
        className={`slim-target ${kindClass(node)}${fill ? ' slim-fill' : ''}${funded ? ' funded' : ''}`}
        style={fill ? { minWidth: TARGET_FILL_W } : undefined}
      >
        {/* left-anchored colored progress fill — width driven purely by the
            already-eased `p` (no CSS width transition, avoids double-easing). */}
        <span className={`slim-fill-bar ${kindClass(node)}`} style={{ width: `${p * 100}%` }} aria-hidden />
        <span className="slim-target-label">{targetText(node, dateMode)}</span>
      </span>
    </div>
  );
}
