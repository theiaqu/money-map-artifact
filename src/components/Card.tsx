import { Check } from 'lucide-react';
import type { CardNode, MapStyle } from '../data';
import { isReached, progressAt, type Mode } from '../scenario';
import GraphStrip, { type GraphVariant } from './GraphStrip';
import PieChart from './PieChart';
import ProgressBar from './ProgressBar';
import ProgressPill from './ProgressPill';
import ProgressBgCard from './ProgressBgCard';

// 'progress' = "progress bar, inside"; 'progress-pill' = amount-chip-as-bar;
// 'progress-bg' = the card itself is the bar (goal bars can run off-page).
export type ChartStyle = 'stocks' | 'pie' | 'progress' | 'progress-pill' | 'progress-bg';

// "Card style" configuration. `standard` keeps the label + amount layout;
// `tertiary` (Figma "Title tertiary") shows a title pill over the graph and one
// of several date/goal text treatments below it (the `titleVariant`).
export type CardStyle = 'standard' | 'tertiary';
export type TitleVariant = 'date' | 'goalDate' | 'dateGoal' | 'title';

// Each visual identity's representative pink (matches its goal lines / pills),
// used for the goal "reached" check so it reads as part of that identity.
const PINK_FLOW = '#ff2d8e'; // "Modern" / stocks goal pink
const PINK_MM = '#EEBED4'; // "Like Today's MM" pastel pink (money-map palette)

function Spacer({ h }: { h: number }) {
  return <div style={{ height: h, flexShrink: 0 }} />;
}

// bottom text row for the "Title tertiary" card style (goal cards only)
function TertiaryText({ node, variant }: { node: CardNode; variant: TitleVariant }) {
  const date = node.badge ?? '';
  if (variant === 'title') {
    return <div className="tert-text tert-strong tert-wrap">{`${node.title} by ${date}`}</div>;
  }
  if (variant === 'dateGoal') {
    return (
      <div className="tert-text tert-row">
        <span className="tert-strong">{date}</span>
        <span className="tert-goal">{node.amount} goal</span>
      </div>
    );
  }
  const lead = variant === 'goalDate' ? `${node.amount} by` : 'Fund by';
  return (
    <div className="tert-text">
      <span className="tert-muted">{lead}</span>
      <span className="tert-strong">{` ${date}`}</span>
    </div>
  );
}

export default function Card({
  node,
  now,
  mode,
  style,
  cardStyle = 'standard',
  titleVariant = 'date',
  map = 'flow',
  dimmed,
}: {
  node: CardNode;
  now: number;
  mode: Mode;
  style: ChartStyle;
  cardStyle?: CardStyle;
  titleVariant?: TitleVariant;
  map?: MapStyle;
  dimmed?: boolean;
}) {
  const isPie = style === 'pie' && (node.kind === 'account' || node.kind === 'goal');
  // "progress bar, inside" — applies to every card kind (income/account/goal)
  const isProgress =
    style === 'progress' && (node.kind === 'income' || node.kind === 'account' || node.kind === 'goal');
  // "progress pill" — amount chip itself is the fill bar (money-map pastel look).
  // Identity-agnostic (pastel palette baked into ProgressPill), so it renders in
  // both visual identities — handled before the money-map early return below.
  const isProgressPill =
    style === 'progress-pill' && (node.kind === 'income' || node.kind === 'account' || node.kind === 'goal');
  // "progress bar, background" — the whole card is the bar; goal bars encode
  // absolute dollars and can run off-page (clipped by the device frame), with a
  // ring showing the true 0..1 fraction. Identity-agnostic (light pastels baked
  // into ProgressBgCard), handled before the money-map early return below.
  const isProgressBg =
    style === 'progress-bg' && (node.kind === 'income' || node.kind === 'account' || node.kind === 'goal');
  // reached-check colour derives from the active visual identity's pink
  const checkColor = map === 'money-map' ? PINK_MM : PINK_FLOW;

  if (isProgressBg) {
    return (
      <div className={`node${dimmed ? ' dimmed' : ''}`} style={{ left: node.x, top: node.y }}>
        <ProgressBgCard node={node} now={now} mode={mode} />
      </div>
    );
  }

  if (isProgressPill) {
    const reached = isReached(mode, node.id, now);
    const p = node.kind === 'income' ? 1 : progressAt(mode, node.id, now);
    const sub =
      node.kind === 'goal'
        ? `by ${node.badge ?? ''}`
        : node.kind === 'account'
          ? ({ core: 'for bills', spend: 'for daily spend' } as Record<string, string>)[node.id] ?? ''
          : undefined; // income has no suffix
    return (
      <div className={`node${dimmed ? ' dimmed' : ''}`} style={{ left: node.x, top: node.y }}>
        <ProgressPill
          kind={node.kind}
          color={node.graph}
          progress={p}
          reached={reached}
          title={node.title}
          amount={node.kind === 'goal' ? node.amount : `${node.amount}/mo`}
          sub={sub}
        />
      </div>
    );
  }

  // "Today's money map" — pastel restyle; composes with both chart styles
  if (map === 'money-map') {
    // goal date text: grayed until the goal is funded, then black + a pink check
    const goalReached = node.kind === 'goal' && isReached(mode, node.id, now);
    if (isPie) {
      const grey = node.kind === 'account' ? `${node.amount}/mo` : `Fund by ${node.badge ?? ''}`;
      return (
        <div className={`node${dimmed ? ' dimmed' : ''}`} style={{ left: node.x, top: node.y }}>
          <div className="card card-pie money-map">
            <PieChart color={node.graph} progress={progressAt(mode, node.id, now)} map="money-map" />
            <div className="pie-text">
              <div className={`mm-pie-grey${goalReached ? ' reached' : ''}`}>
                {goalReached && <Check size={12} strokeWidth={3} color={checkColor} />}
                <span>{grey}</span>
              </div>
              <div className="mm-pie-title">{node.title}</div>
            </div>
          </div>
        </div>
      );
    }
    const variant: GraphVariant = node.kind === 'income' ? 'income' : node.kind === 'account' ? 'flow' : 'goal';
    return (
      <div className={`node${dimmed ? ' dimmed' : ''}`} style={{ left: node.x, top: node.y }}>
        <div className="card money-map">
          <GraphStrip id={node.id} color={node.graph} variant={variant} now={now} mode={mode} map="money-map" pill={node.pill} />
          <Spacer h={8} />
          {node.kind === 'goal' ? (
            <div className={`mm-main${goalReached ? ' reached' : ''}`}>
              {goalReached && <Check size={12} strokeWidth={3} color={checkColor} />}
              <span>{node.mapMain ?? node.badge ?? node.title}</span>
            </div>
          ) : (
            <>
              {node.kind === 'income' && <div className="card-label">{node.title}</div>}
              {node.kind === 'income' && <Spacer h={4} />}
              <div className="card-amount">
                <span className="value">{node.amount} </span>
                <span className="suffix">{node.suffix}</span>
              </div>
            </>
          )}
          <Spacer h={6} />
        </div>
      </div>
    );
  }

  // "Progress bar, inside" — the amount pill becomes a left→right filling bar
  // inside the card; the title drops below it. Fill fraction reuses progressAt
  // (accounts/goals) so it fills in step with the branch comet like the pie ring;
  // income is binary-full once money is flowing. isReached flips the goal date
  // pill to the mauve "reached" treatment (no check icon in this style).
  if (isProgress) {
    const p = node.kind === 'income' ? (now > 0 ? 1 : 0) : progressAt(mode, node.id, now);
    const reached = node.kind === 'goal' && isReached(mode, node.id, now);
    const amountLabel = node.kind === 'goal' ? node.amount : `${node.amount} ${node.suffix}`;
    return (
      <div className={`node${dimmed ? ' dimmed' : ''}`} style={{ left: node.x, top: node.y }}>
        <div className="card card-progress">
          <Spacer h={node.kind === 'income' ? 8 : 12} />
          <ProgressBar
            color={node.graph}
            progress={p}
            amount={amountLabel}
            date={node.kind === 'goal' ? node.badge : undefined}
            reached={reached}
            tall={node.kind === 'income'}
          />
          <Spacer h={12} />
          <div className="pbar-title">{node.title}</div>
          <Spacer h={6} />
        </div>
      </div>
    );
  }

  // Title tertiary — goal AND account cards get the pill-over-graph treatment so
  // every card looks consistent (income keeps the standard layout). Accounts have
  // no fund date, so they show their monthly amount as the bottom text line.
  if (!isPie && cardStyle === 'tertiary' && (node.kind === 'goal' || node.kind === 'account')) {
    const gv: GraphVariant = node.kind === 'goal' ? 'goal' : 'flow';
    return (
      <div className={`node${dimmed ? ' dimmed' : ''}`} style={{ left: node.x, top: node.y }}>
        <div className="card card-tertiary">
          <GraphStrip id={node.id} color={node.graph} variant={gv} now={now} mode={mode} badge={node.badge} tertiary pill={node.pill ?? node.title} />
          <Spacer h={12} />
          {node.kind === 'goal' ? (
            <TertiaryText node={node} variant={titleVariant} />
          ) : (
            <div className="tert-text">
              <span className="tert-strong">{node.amount}</span>
              <span className="tert-muted">{` ${node.suffix}`}</span>
            </div>
          )}
          <Spacer h={6} />
        </div>
      </div>
    );
  }

  if (isPie) {
    return (
      <div className={`node${dimmed ? ' dimmed' : ''}`} style={{ left: node.x, top: node.y }}>
        <div className="card card-pie">
          <PieChart color={node.graph} progress={progressAt(mode, node.id, now)} />
          <div className="pie-text">
            <div className="card-label">{node.title}</div>
            <div className="card-amount">
              <span className="value">{node.amount} </span>
              <span className="suffix">{node.suffix}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const variant: GraphVariant = node.kind === 'income' ? 'income' : node.kind === 'account' ? 'flow' : 'goal';

  return (
    <div className={`node${dimmed ? ' dimmed' : ''}`} style={{ left: node.x, top: node.y }}>
      <div className="card">
        <GraphStrip id={node.id} color={node.graph} variant={variant} now={now} mode={mode} badge={node.badge} />
        <Spacer h={8} />
        <div className="card-label">{node.title}</div>
        <Spacer h={4} />
        <div className="card-amount">
          <span className="value">{node.amount} </span>
          <span className="suffix">{node.suffix}</span>
        </div>
        <Spacer h={6} />
      </div>
    </div>
  );
}
