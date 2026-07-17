import { GRID_CARD_W, GRID_CARD_H, GRID_MARKER, type CardNode } from '../data';

// "Grid" (grid) card — a plain GRAY placeholder rectangle (an intentional
// stand-in with no inner content). The income row renders a small BLACK square
// root marker instead (it caps the top of the spine). Purely graphic + static;
// all positioning is handled by Card.tsx from the grid geometry in data.ts.
export default function GridCard({ node }: { node: CardNode }) {
  if (node.kind === 'income') {
    return (
      <div className="grid-income-marker" style={{ width: GRID_MARKER, height: GRID_MARKER }} aria-hidden />
    );
  }
  return <div className="grid-card" style={{ width: GRID_CARD_W, height: GRID_CARD_H }} aria-hidden />;
}
