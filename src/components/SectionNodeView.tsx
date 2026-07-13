import { CalendarSync, Goal } from 'lucide-react';
import type { BranchStyle, MapStyle, SectionNode } from '../data';

/* Compact pill placement (Figma node 417:12659): all pills are LEFT-anchored
   (left ≈ 17) and sit on the spine. Monthly is a two-line pill; the goal pills
   are single-line with ordinal labels. left/top match the Figma frame origins. */
const COMPACT: Record<string, { label: string; left: number; top: number; width?: number }> = {
  monthly: { label: 'Monthly expenses', left: 17, top: 336, width: 68 },
  goals1: { label: '1st Goal', left: 17, top: 514 },
  goals2: { label: '2nd Goal', left: 17, top: 685 },
};

export default function SectionNodeView({
  node,
  dimmed,
  branch = 'standard',
  map = 'flow',
}: {
  node: SectionNode;
  dimmed?: boolean;
  branch?: BranchStyle;
  map?: MapStyle;
}) {
  // "text only" gate style: plain bold-black UPPERCASE label on the spine — no
  // box, pill, border or icon (Figma node 448:5036), paired with colored ropes.
  if (branch === 'text-only') {
    const info = COMPACT[node.id] ?? { label: node.label, left: 17, top: node.y };
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
    const info = COMPACT[node.id] ?? { label: node.label, left: 17, top: node.y };
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
