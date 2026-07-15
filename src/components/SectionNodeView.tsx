import { CalendarSync, Goal } from 'lucide-react';
import type { BranchStyle, MapStyle, SectionNode } from '../data';
import { DATASETS, type Dataset } from '../scenario';

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

/* "Conversational" caption dividers (Figma 731:9883): instead of gate pills, two
   centered gray captions sit above the account cards ("Monthly Funds", at the
   monthly gate) and above the goals ("Goals will receive ~$X per month", at the
   1st-goal gate — X = the monthly surplus = income − core − spend). The deeper
   gates (goals2 / goals3) render nothing. `top` is the top of the ~16px caption
   line, placed just above its first card (Monthly Funds above core top 377;
   Goals caption above ef1 top 585.65). */
const CONVO_CAPTION_TOP: Record<string, number> = {
  monthly: 353,
  goals1: 563,
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
}: {
  node: SectionNode;
  dimmed?: boolean;
  dataset: Dataset;
  branch?: BranchStyle;
  map?: MapStyle;
  v1?: boolean;
  condensed?: boolean;
  convo?: boolean;
}) {
  // "Conversational" style: render the gray caption dividers in place of gate
  // pills. Only the monthly + 1st-goal gates carry a caption; deeper gates render
  // nothing. Takes precedence over the skinny-line null return below.
  if (convo) {
    const top = CONVO_CAPTION_TOP[node.id];
    if (top === undefined) return null;
    const cfg = DATASETS[dataset];
    const surplus = cfg.income - cfg.coreMax - cfg.spendMax;
    const label =
      node.id === 'monthly'
        ? 'Monthly Funds'
        : `Goals will receive ~$${surplus.toLocaleString('en-US')} per month`;
    return (
      <div className={`node convo-caption-node${dimmed ? ' dimmed' : ''}`} style={{ left: 0, top }}>
        <div className="convo-caption">{label}</div>
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
