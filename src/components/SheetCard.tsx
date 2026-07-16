import type { CardNode } from '../data';
import { sheetPanelsFor, sheetPillsFor, sheetRevealMonths, sheetRevealStyle } from '../data';
import { monthsFromNow, type Dataset, type Mode } from '../scenario';

// duration wording taken from the Figma footers: "8 MO", "1 YR 6 MO", "2 YRS".
// years = floor(n/12), months = n % 12; single year is "1 YR", plural "YRS".
function fmtDuration(n: number): string {
  const years = Math.floor(n / 12);
  const months = n % 12;
  if (years === 0) return `${months} MO`;
  const yr = `${years} ${years === 1 ? 'YR' : 'YRS'}`;
  return months > 0 ? `${yr} ${months} MO` : yr;
}

// income as a small white card TOP-LEFT (Figma 753:7974): "Income" (semibold)
// over "$X/mo" (medium). The gray left spine drops from just below it.
export function SheetIncome({ node }: { node: CardNode }) {
  return (
    <div className="sheet-income">
      <div className="sheet-income-label">Income</div>
      <div className="sheet-income-amt">{node.amount}/mo</div>
    </div>
  );
}

// account name card (Figma 753:8036 / 753:8046): a plain white rounded card with
// the account name centered — the black amount pill lives on the connector.
export function SheetAccountCard({ node }: { node: CardNode }) {
  return (
    <div className="sheet-card sheet-account">
      <span className="sheet-card-name">{node.title}</span>
    </div>
  );
}

// goal card (Figma 753:8061): a white rounded card with the goal NAME on top and
// a dark PETAL footer bar with white uppercase status text. The footer flips
// FUNDING→FUNDED once the goal reaches (isReached), and the duration derives from
// the goal's fund-by badge relative to the reference month.
export function SheetGoalCard({
  node,
  now,
  mode,
  dataset,
}: {
  node: CardNode;
  now: number;
  mode: Mode;
  dataset: Dataset;
}) {
  const dur = fmtDuration(monthsFromNow(node.badge));
  // Illustrative prototype — always reads "FUNDED" (we're not actually funding),
  // so it doesn't flip from FUNDING→FUNDED.
  const status = `FUNDED IN ${dur}`;
  return (
    <div className="sheet-card sheet-goal">
      <div className="sheet-goal-name">{node.title}</div>
      <div className="sheet-goal-footer">{status}</div>
    </div>
  );
}

// board-level chrome: the two grouped panels (mint MONTHLY EXPENSES / pink GOALS)
// with their uppercase labels, plus the black pills that sit ON the connectors
// (Core/Spend monthly amounts, the "~$X/mo for goals" surplus divider, and each
// goal's funding-weight %). Rendered once when the sheet style is active.
// `now` (sim months) + `mode` drive the branch-assembly reveal: each panel fades
// in when the growing branch reaches its gate region, and each black pill pops in
// (scale 0.9→1 + fade) the instant the tip passes its on-line position. Before its
// reveal each element sits as a faint gray ghost so the layout never jumps.
export function SheetChrome({ dataset, now, mode }: { dataset: Dataset; now: number; mode: Mode }) {
  const panels = sheetPanelsFor(dataset);
  const pills = sheetPillsFor(dataset);
  const reveal = sheetRevealMonths(dataset, mode);
  const forGoals = sheetRevealStyle(now, reveal['for-goals'] ?? 0);
  return (
    <>
      {panels.map((p) => {
        const rs = sheetRevealStyle(now, reveal[p.id] ?? 0);
        return (
          <div
            key={p.id}
            className={`sheet-panel sheet-panel--${p.tint}`}
            style={{ left: p.x, top: p.y, width: p.w, height: p.h, opacity: rs.opacity, transition: 'none' }}
          >
            <span className="sheet-panel-label">{p.label}</span>
          </div>
        );
      })}
      {pills.map((p) => {
        const rs = sheetRevealStyle(now, reveal[p.id] ?? 0);
        return (
          <div
            key={p.id}
            className="sheet-pill-wrap"
            style={{ left: p.x, top: p.y, opacity: rs.opacity, transform: `translate(-50%, -50%) scale(${rs.scale})`, transition: 'none' }}
          >
            <span className="sheet-pill">{p.text}</span>
          </div>
        );
      })}
      {/* the gray "for goals" caption trailing the surplus pill (Figma 753:8142) */}
      <span
        className="sheet-for-goals"
        style={{ left: 121, top: 421, opacity: forGoals.opacity, transform: `translateY(-50%) scale(${forGoals.scale})`, transition: 'none' }}
      >
        for goals
      </span>
    </>
  );
}
