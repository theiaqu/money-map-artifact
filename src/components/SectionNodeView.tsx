import { CalendarSync, Goal } from 'lucide-react';
import { pbiLabels, pbiLockedLabels, potLabels, type BranchStyle, type MapStyle, type SectionNode } from '../data';
import { type Dataset } from '../scenario';

type LabelInfo = { label: string; left: number; top: number; twoLine?: boolean; width?: number };

/* Compact pill placement (Figma node 417:12659): all pills are LEFT-anchored
   (left ≈ 17) and sit on the spine. Monthly is a two-line pill; the goal pills
   are single-line with ordinal labels. `top` puts each label's vertical CENTER on
   its gate's brace/wishbone junction so it sits centered in the money-map spine
   break. Simple junctions: monthly 337 / goals1 522 / goals2 741.5. Optimizer
   shares Simple's rows (SAME monthly / goals1 / goals2 tops) and appends goals3
   at the money-map goals3 junction 1027.5 (2nd top 730 + 286). */
const COMPACT: Record<Dataset, Record<string, LabelInfo>> = {
  simple: {
    monthly: { label: 'Monthly expenses', left: 17, top: 319, width: 68 },
    goals1: { label: '1st Goal', left: 17, top: 510 },
    goals2: { label: '2nd Goal', left: 17, top: 730 },
  },
  optimizer: {
    monthly: { label: 'Monthly expenses', left: 17, top: 319, width: 68 },
    goals1: { label: '1st Goal', left: 17, top: 510 },
    goals2: { label: '2nd Goal', left: 17, top: 730 },
    goals3: { label: '3rd Goal', left: 17, top: 1016 },
  },
};

/* Stocks-V1 gate labels (Figma 519:6283): small BOXED white pills on the spine.
   `top` centers each label on its gate junction. Simple: monthly 383 / goals1 570
   / goals2 736.5. Optimizer shares Simple's rows (SAME monthly / goals1 / goals2
   tops) and appends goals3 at the V1 goals3 junction 954.5 (2nd top 725 + 218). */
const V1_LABELS: Record<Dataset, Record<string, LabelInfo>> = {
  simple: {
    monthly: { label: 'Monthly expenses', left: 15, top: 366, twoLine: true, width: 56 },
    goals1: { label: '1st Goal', left: 18, top: 559 },
    goals2: { label: '2nd Goal', left: 16, top: 725 },
  },
  optimizer: {
    monthly: { label: 'Monthly expenses', left: 15, top: 366, twoLine: true, width: 56 },
    goals1: { label: '1st Goal', left: 18, top: 559 },
    goals2: { label: '2nd Goal', left: 16, top: 725 },
    goals3: { label: '3rd Goal', left: 16, top: 943 },
  },
};

/* Condensed gate labels (Figma 522:6440): same boxed pills, retuned to the
   condensed junctions. Simple: monthly 383.5 / goals1 531 / goals2 680.5.
   Optimizer shares Simple's rows (SAME monthly / goals1 / goals2 tops) and appends
   goals3 at the condensed goals3 junction 834.5 (2nd top 669 + 154). */
const CONDENSED_LABELS: Record<Dataset, Record<string, LabelInfo>> = {
  simple: {
    monthly: { label: 'Monthly expenses', left: 15, top: 366, twoLine: true, width: 56 },
    goals1: { label: '1st Goal', left: 18, top: 520 },
    goals2: { label: '2nd Goal', left: 16, top: 669 },
  },
  optimizer: {
    monthly: { label: 'Monthly expenses', left: 15, top: 366, twoLine: true, width: 56 },
    goals1: { label: '1st Goal', left: 18, top: 520 },
    goals2: { label: '2nd Goal', left: 16, top: 669 },
    goals3: { label: '3rd Goal', left: 16, top: 823 },
  },
};

/* "Labeled" icon gate (Figma 738:7107): render the section gates AS white label
   pills sitting ON the left spine (x=49) — the default icon thin-bracket gate
   hides these. Each pill's vertical CENTER sits on its gate's branch junction so
   the curvy branches read as fanning out of the labeled gate: monthly 311.9
   (two-line "MONTHLY EXPENSES"), 1st goal 408.43, 2nd goal 509.3, and (Optimizer)
   3rd goal 657.3 (the travel/brokerage wishbone midpoint). `top` = junction − half
   the pill height. Pills reuse the boxed `.v1-gate` treatment (radius 4 / pad 6 /
   10px semibold uppercase / letter-spacing 0.5). */
const ICON_LABELED: Record<Dataset, Record<string, LabelInfo>> = {
  simple: {
    monthly: { label: 'Monthly expenses', left: 14, top: 294, twoLine: true, width: 56 },
    goals1: { label: '1st Goal', left: 18, top: 397 },
    goals2: { label: '2nd Goal', left: 16, top: 498 },
  },
  optimizer: {
    monthly: { label: 'Monthly expenses', left: 14, top: 294, twoLine: true, width: 56 },
    goals1: { label: '1st Goal', left: 18, top: 397 },
    goals2: { label: '2nd Goal', left: 16, top: 498 },
    goals3: { label: '3rd Goal', left: 16, top: 646 },
  },
};

/* "Conversational" gate labels (Figma 738:7662): plain GRAY uppercase text beside
   the left spine at each gate's junction — NOT boxed pills. `top` puts each label's
   vertical CENTER on its gate's wishbone junction (monthly 315 / goals1 451 / goals2
   586 / Optimizer goals3 760). Monthly is two-line; the goals are single-line
   ordinal labels. Matches the convo caption aesthetic (~10px semibold, uppercase,
   letter-spacing 0.5, muted gray). */
const CONVO_LABELS: Record<Dataset, Record<string, LabelInfo>> = {
  simple: {
    monthly: { label: 'Monthly expenses', left: 12, top: 302, twoLine: true, width: 58 },
    goals1: { label: '1st Goal', left: 16, top: 444 },
    goals2: { label: '2nd Goal', left: 14, top: 579 },
  },
  optimizer: {
    monthly: { label: 'Monthly expenses', left: 12, top: 302, twoLine: true, width: 58 },
    goals1: { label: '1st Goal', left: 16, top: 444 },
    goals2: { label: '2nd Goal', left: 14, top: 579 },
    goals3: { label: '3rd Goal', left: 14, top: 753 },
  },
};

/* "Illustrated" gate labels (Figma 760:8522): small WHITE rounded pills (p-6 /
   radius 4 / 10px semibold uppercase #111) sitting beside the 4px spine. `top`
   centers each pill on its gate's wishbone junction: monthly 411 (two-line),
   1st goal 549, 2nd goal 687, and (Optimizer) 3rd goal 871. */
const ILLO_LABELS: Record<Dataset, Record<string, LabelInfo>> = {
  simple: {
    monthly: { label: 'Monthly expenses', left: 16, top: 395, twoLine: true, width: 56 },
    goals1: { label: '1st Goal', left: 19, top: 538 },
    goals2: { label: '2nd Goal', left: 17, top: 676 },
  },
  optimizer: {
    monthly: { label: 'Monthly expenses', left: 16, top: 395, twoLine: true, width: 56 },
    goals1: { label: '1st Goal', left: 19, top: 538 },
    goals2: { label: '2nd Goal', left: 17, top: 676 },
    goals3: { label: '3rd Goal', left: 17, top: 860 },
  },
};

export default function SectionNodeView({
  node,
  dimmed,
  dataset,
  branch = 'standard',
  map = 'flow',
  v1 = false,
  condensed = false,
  convo = false,
  illo = false,
  pbi = false,
  pots = false,
}: {
  node: SectionNode;
  dimmed?: boolean;
  dataset: Dataset;
  branch?: BranchStyle;
  map?: MapStyle;
  v1?: boolean;
  condensed?: boolean;
  convo?: boolean;
  illo?: boolean;
  pbi?: boolean;
  pots?: boolean;
}) {
  // "Pots" (Figma 802:9336): white gate-label pills centered ON the thin left
  // spine (x=50) — the same treatment as the pbi gate pills.
  if (pots) {
    const info = potLabels[dataset][node.id];
    if (!info) return null;
    return (
      <div className={`node section-pill-node${dimmed ? ' dimmed' : ''}`} style={{ left: 50, top: info.top }}>
        <div className={`pot-gate${info.twoLine ? ' two-line' : ''}`} style={info.twoLine ? { width: info.width } : undefined}>
          {info.label}
        </div>
      </div>
    );
  }
  // "Grouped 2" pbi gate (Figma 802:10838): its section labels live INSIDE the
  // gray panels (rendered by PbiGrouped2Panels), so the on-spine gate node renders
  // nothing here. ("Text gates + backgrounds" (pbi-grouped) intentionally falls
  // through to the default pbi on-spine text pills below.)
  if (pbi && branch === 'pbi-grouped2') {
    return null;
  }
  // "Indented" pbi gate (Figma 886:12513): the nested tree + amount pills express
  // the hierarchy, so there are NO on-spine section labels.
  if (pbi && branch === 'pbi-indented') {
    return null;
  }
  // "Locked path" pbi gate (Figma 802:10378): plain title-case GRAY text labels
  // (no pill) sitting to the LEFT of the bold white spine, right-aligned and
  // color-tinted per section. Takes precedence over the standard pbi pills.
  if (pbi && branch === 'pbi-locked') {
    const info = pbiLockedLabels[dataset][node.id];
    if (!info) return null;
    return (
      <div className={`node section-pill-node${dimmed ? ' dimmed' : ''}`} style={{ left: 76, top: info.top }}>
        <div
          className={`pbi-locked-gate${info.twoLine ? ' two-line' : ''}`}
          style={{ color: info.color, ...(info.twoLine ? { width: info.width } : null) }}
        >
          {info.label}
        </div>
      </div>
    );
  }
  // "Section plus label" pbi gate (Figma 977:10830): the MONTHLY gate is a small
  // circle node on the spine (a junction dot) instead of a text pill; the GOAL gates
  // keep the standard pbi on-spine text pills. (Section names live in the panel
  // labels; the % pills ride the arms in Connectors.)
  if (pbi && branch === 'pbi-sectionlabel') {
    if (node.id === 'monthly') {
      // centered on the monthly fork junction (x=50, y=464 in the default pbi geometry)
      return (
        <div className={`node section-pill-node${dimmed ? ' dimmed' : ''}`} style={{ left: 50, top: 464 }}>
          <span className="pbi-sectionlabel-dot" />
        </div>
      );
    }
    const info = pbiLabels[dataset][node.id];
    if (!info) return null;
    return (
      <div className={`node section-pill-node${dimmed ? ' dimmed' : ''}`} style={{ left: 50, top: info.top }}>
        <div className={`pbi-gate${info.twoLine ? ' two-line' : ''}`} style={info.twoLine ? { width: info.width } : undefined}>
          {info.label}
        </div>
      </div>
    );
  }
  // "Progress bar, inside" (Figma 792:8522): white gate-label pills centered ON
  // the thin left spine (x=50). Two-line pills wrap within `width`.
  if (pbi) {
    const info = pbiLabels[dataset][node.id];
    if (!info) return null;
    return (
      <div className={`node section-pill-node${dimmed ? ' dimmed' : ''}`} style={{ left: 50, top: info.top }}>
        <div className={`pbi-gate${info.twoLine ? ' two-line' : ''}`} style={info.twoLine ? { width: info.width } : undefined}>
          {info.label}
        </div>
      </div>
    );
  }
  // "Illustrated" style: white rounded gate-label pills beside the 4px spine.
  if (illo) {
    const info = ILLO_LABELS[dataset][node.id];
    if (!info) return null;
    return (
      <div className={`node section-pill-node${dimmed ? ' dimmed' : ''}`} style={{ left: info.left, top: info.top }}>
        <div className={`illo-gate${info.twoLine ? ' two-line' : ''}`} style={info.twoLine ? { width: info.width } : undefined}>
          {info.label}
        </div>
      </div>
    );
  }
  // "Conversational" style (Figma 738:7662): render plain gray uppercase gate
  // labels beside the left spine at each gate junction. Takes precedence over the
  // skinny-line null return below.
  if (convo) {
    const info = CONVO_LABELS[dataset][node.id];
    if (!info) return null;
    return (
      <div className={`node convo-gate-node${dimmed ? ' dimmed' : ''}`} style={{ left: info.left, top: info.top }}>
        <div className={`convo-gate-label${info.twoLine ? ' two-line' : ''}`} style={info.twoLine ? { width: info.width } : undefined}>
          {info.label}
        </div>
      </div>
    );
  }
  // Stocks V1 / Condensed gate labels: small boxed white pills, taking precedence
  // over the branch/map gate styles below.
  if (v1 || condensed) {
    const labels = condensed ? CONDENSED_LABELS[dataset] : V1_LABELS[dataset];
    const info = labels[node.id] ?? { label: node.label, left: 15, top: node.y };
    return (
      <div className={`node section-pill-node${dimmed ? ' dimmed' : ''}`} style={{ left: info.left, top: info.top }}>
        <div className={`v1-gate${info.twoLine ? ' two-line' : ''}`} style={info.twoLine ? { width: info.width } : undefined}>
          {info.label}
        </div>
      </div>
    );
  }
  // "Labeled" icon gate (Figma 738:7107): render boxed white gate-label pills on
  // the left spine. Takes precedence over the skinny-line null return below.
  if (branch === 'icon-labeled') {
    const info = ICON_LABELED[dataset][node.id];
    if (!info) return null;
    return (
      <div className={`node section-pill-node${dimmed ? ' dimmed' : ''}`} style={{ left: info.left, top: info.top }}>
        <div className={`v1-gate${info.twoLine ? ' two-line' : ''}`} style={info.twoLine ? { width: info.width } : undefined}>
          {info.label}
        </div>
      </div>
    );
  }
  // "skinny line" gate style (Figma 496-5864): the thin slim tree has NO gate
  // labels at all — just the spine + brackets — so render nothing for the section
  // nodes. (Only the skinny-line style is affected; every other style is unchanged.)
  if (branch === 'skinny-line') {
    return null;
  }

  // "text only" gate style: plain bold-black UPPERCASE label on the spine — no
  // box, pill, border or icon (Figma node 448:5036), paired with colored ropes.
  if (branch === 'text-only') {
    const info = COMPACT[dataset][node.id] ?? { label: node.label, left: 17, top: node.y };
    const twoLine = info.width != null;
    return (
      <div className={`node section-pill-node${dimmed ? ' dimmed' : ''}`} style={{ left: info.left, top: info.top }}>
        <div className={`section-text${twoLine ? ' two-line' : ''}`} style={twoLine ? { width: info.width } : undefined}>
          {info.label}
        </div>
      </div>
    );
  }

  // money map + compact both use the on-spine text pills at the COMPACT geometry;
  // money map is borderless (plain white pill), compact keeps the 1px black border
  if (map === 'money-map' || branch === 'compact') {
    const info = COMPACT[dataset][node.id] ?? { label: node.label, left: 17, top: node.y };
    const twoLine = info.width != null;
    const borderless = map === 'money-map' ? ' borderless' : '';
    return (
      <div className={`node section-pill-node${dimmed ? ' dimmed' : ''}`} style={{ left: info.left, top: info.top }}>
        <div
          className={`section-pill${twoLine ? ' two-line' : ''}${borderless}`}
          style={twoLine ? { width: info.width } : undefined}
        >
          {info.label}
        </div>
      </div>
    );
  }

  const Icon = node.icon === 'goal' ? Goal : CalendarSync;
  return (
    <div className={`node${dimmed ? ' dimmed' : ''}`} style={{ left: node.x, top: node.y }}>
      <div className="section-node">
        <div className="section-icon">
          <Icon size={14} color="#000" strokeWidth={1.5} />
        </div>
        <div className="section-label">{node.label}</div>
      </div>
    </div>
  );
}
