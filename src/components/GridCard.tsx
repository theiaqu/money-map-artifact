import { GRID_CARD_W, GRID_CARD_H, GRID_MARKER, type CardNode } from '../data';

// "Grid" (grid) card — a light-gray placeholder card in a minimalist, line-centric
// style: just the account/goal NAME up top and the VALUE (amount + a small
// secondary line — `/mo` for accounts, the fund-by date for goals) along the
// bottom, with a thin hairline divider between them to echo the graph-paper lines.
// The income row renders a small BLACK square root marker instead (it caps the top
// of the spine). Static + monochrome; positioning is handled by Card.tsx.
export default function GridCard({ node }: { node: CardNode }) {
  if (node.kind === 'income') {
    return (
      <div className="grid-income-marker" style={{ width: GRID_MARKER, height: GRID_MARKER }} aria-hidden />
    );
  }
  const sub = node.kind === 'goal' ? node.badge ?? '' : '/mo';
  return (
    <div className="grid-card" style={{ width: GRID_CARD_W, height: GRID_CARD_H }}>
      <div className="grid-card-title">{node.title}</div>
      <div className="grid-card-rule" aria-hidden />
      <div className="grid-card-foot">
        <span className="grid-card-amt">{node.amount}</span>
        {sub && <span className="grid-card-sub">{sub}</span>}
      </div>
    </div>
  );
}
