import { useEffect, useRef, useState } from 'react';
import { Check, Receipt, CreditCard, Umbrella, PiggyBank, Home, Plane, TrendingUp, type LucideIcon } from 'lucide-react';
import { slimRowTopFor, iconRowTopFor, ICON_LIST_LEFT, iconLabeledRowTopFor, ICON_LABELED_INCOME_LEFT, ICON_LABELED_INCOME_TOP, ICON_LABELED_TILE_LEFT, convoRowTopFor, CONVO_CARD_LEFT, CONVO_INCOME_LEFT, CONVO_INCOME_TOP, v1RowTopFor, V1_CARD_LEFT, condensedRowTopFor, CONDENSED_CARD_LEFT, sheetRowTopFor, sheetRevealMonths, sheetRevealStyle, SHEET_INCOME_LEFT, SHEET_INCOME_TOP, SHEET_ACCT_LEFT, SHEET_GOAL_LEFT, SHEET_GOAL_W, illoRowTopFor, ILLO_INCOME_LEFT, ILLO_INCOME_TOP, ILLO_CARD_LEFT, ILLO_CARD_W, pbiRowTopFor, pbiGroupedRowTopFor, pbiGroupedPanelsFor, pbiGrouped2PanelsFor, PBI_CARD_LEFT, PBI_CARD_W, PBI_INCOME_LEFT, PBI_INCOME_TOP, potRowTopFor, POT_CARD_LEFT, POT_CONTAINER_W, gridRowTopFor, GRID_CARD_LEFT, GRID_SPINE_X, GRID_INCOME_CY, GRID_MARKER, type CardNode, type MapStyle } from '../data';
import { isReached, progressAt, goalDateLabel, heroHeadline, animMonths, scrubMonthLabel, scrubMonthShort, type Dataset, type Mode, type DateMode } from '../scenario';
import FruitfulLogo from './FruitfulLogo';
import GraphStrip, { type GraphVariant } from './GraphStrip';
import PieChart from './PieChart';
import ProgressBar from './ProgressBar';
import ProgressPill from './ProgressPill';
import ProgressBgCard from './ProgressBgCard';
import SuperSlimCard from './SuperSlimCard';
import IconRowCard from './IconRowCard';
import ConvoCard, { ConvoIncome } from './ConvoCard';
import IlloCard, { IlloIncome } from './IlloCard';
import { SheetIncome, SheetAccountCard, SheetGoalCard } from './SheetCard';
import StocksV1Card from './StocksV1Card';
import StocksCondensedCard from './StocksCondensedCard';
import PotCard from './PotCard';
import GridCard from './GridCard';

// 'progress' = "progress bar, inside"; 'progress-pill' = amount-chip-as-bar;
// 'progress-bg' = the card itself is the bar (goal bars can run off-page);
// 'slim' = "super slim" — a name pill · dotted line · colored target pill row.
export type ChartStyle = 'stocks' | 'pie' | 'progress' | 'progress-pill' | 'progress-bg' | 'slim' | 'icons' | 'convo' | 'sheet' | 'illo' | 'pots' | 'grid';

// Paycheck-carousel label mode: 'paychecks' shows Income/Paycheck pills;
// 'timeline' replaces them with month labels ("Aug '26").
export type CarouselMode = 'paychecks' | 'timeline';

// "Card style" configuration. `standard` keeps the label + amount layout;
// `tertiary` (Figma "Title tertiary") shows a title pill over the graph and one
// of several date/goal text treatments below it (the `titleVariant`).
export type CardStyle = 'standard' | 'tertiary';
export type TitleVariant = 'date' | 'goalDate' | 'dateGoal' | 'title';

// Each visual identity's representative pink (matches its goal lines / pills),
// used for the goal "reached" check so it reads as part of that identity.
const PINK_FLOW = '#ff2d8e'; // "Modern" / stocks goal pink
const PINK_MM = '#EEBED4'; // "Like Today's MM" pastel pink (money-map palette)

// "Progress pill" account style ONLY: the small "Income $X/mo" pill is pulled
// DOWN from its default top-of-phone slot so it sits tighter to the flow — but it
// stays in the CLEAR region ABOVE the Core Account card with a comfortable gap,
// NOT down in the Monthly Expenses gate junction (the Core/Spend wishbone would
// collide with the wide pill there). Left-anchored (small x) so its width clears
// the Core/Spend card column on the right. Dataset-aware because the two datasets
// use different row rhythms: Simple's Core top is y=234, while the Optimizer's
// COMPACT 8-row layout puts Core at y=148, so income must sit higher there. Both
// keep a clean gap above Core and stay below the status bar / dynamic island.
const PILL_INCOME_POS: Record<Dataset, { x: number; y: number }> = {
  simple: { x: 10, y: 150 }, // Core top 234 -> ~48px gap
  optimizer: { x: 10, y: 150 }, // Optimizer shares Simple's rows (Core top 234)
};

function Spacer({ h }: { h: number }) {
  return <div style={{ height: h, flexShrink: 0 }} />;
}

// "Progress bar, inside" (pbi) card icon: a bare line-icon glyph sitting next to
// the title (Figma 804:8789 — no colored tile/box behind it), picked from the
// card id (accounts) or its goal title.
function pbiIconFor(node: CardNode): LucideIcon {
  if (node.kind === 'account') return node.id === 'core' ? Receipt : CreditCard;
  const t = node.title.toLowerCase();
  if (/debt/.test(t)) return PiggyBank;
  if (/house/.test(t)) return Home;
  if (/travel|slush/.test(t)) return Plane;
  if (/brokerage|invest/.test(t)) return TrendingUp;
  return Umbrella; // emergency funds + default
}

// The shared "Money Map is ready!" hero header (sprout logo · gray subtitle ·
// large serif headline derived from the dataset's milestone goal). This is the
// single source of truth for the header across ALL account-style artifacts, so
// every style leads with an identical block (own .pbi-hero-* classes).
export function HeroHeader({ dataset }: { dataset: Dataset }) {
  const hero = heroHeadline(dataset);
  return (
    <>
      <div className="pbi-hero-logo">
        <FruitfulLogo size={40} color="#2f8f4e" />
      </div>
      <p className="pbi-hero-sub">
        Your Money Map is ready!<br />
        Based on everything you&rsquo;ve told us, we estimate you could be&hellip;
      </p>
      <h1 className="pbi-hero-title">{`${hero.pre} ${hero.date}`}</h1>
    </>
  );
}

// The paycheck carousel / time-scrubber. Dragging horizontally across the pill
// row maps the pointer position (0 = far left → start, 1 = far right → the last
// funded month) to the sim clock, so the cards fill/unfill live. The leftmost
// slot is a fixed yellow highlight; the strip swipes so the ACTIVE paycheck snaps
// into it (replacing Income). While dragging, an emphasized "Paycheck in {Month}"
// banner overlays and the hero headline steps aside. Part of the shared header.
function PaycheckCarousel({
  dataset,
  mode,
  now,
  onScrub,
  incomeLeft = PBI_INCOME_LEFT,
  onDraggingChange,
  carouselMode = 'paychecks',
}: {
  dataset: Dataset;
  mode: Mode;
  now: number;
  onScrub?: (nowMonths: number) => void;
  incomeLeft?: number;
  onDraggingChange?: (dragging: boolean) => void;
  carouselMode?: CarouselMode;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const total = animMonths(dataset, mode);
  const frac = total > 0 ? Math.max(0, Math.min(1, now / total)) : 0;
  const scrubbable = !!onScrub;
  // Drag direction is REVERSED from the pointer axis so the carousel behaves like
  // a native mobile strip: swipe LEFT (drag left) to bring a FUTURE paycheck into
  // the yellow slot / advance time; swipe RIGHT to go back.
  const scrubFromClientX = (clientX: number) => {
    const el = rowRef.current;
    if (!el || !onScrub) return;
    const r = el.getBoundingClientRect();
    const raw = r.width > 0 ? Math.max(0, Math.min(1, (clientX - r.left) / r.width)) : 0;
    const f = 1 - raw;
    onScrub(f * total);
  };
  const isTimeline = carouselMode === 'timeline';
  // label for slot i (0 = the fixed yellow "now" slot, 1..5 = upcoming): in
  // timeline mode each slot maps to a month across the full span.
  const slotLabel = (i: number): string =>
    isTimeline ? scrubMonthShort((i / 5) * total) : i === 0 ? 'Income' : 'Paycheck';
  const activeIdx = Math.round(frac * 5); // 0 = Income slot, 1..5 = Paychecks

  // "Pill merge / glob" (Figma 885:11770): whenever the active pill changes (a new
  // paycheck swipes into the yellow slot), briefly flag `merging` so the active
  // pill plays the grow-taller-then-settle glob keyframe and the incoming pill
  // blends its color in. Fires on both playback (now advancing) and scrubbing.
  const prevIdxRef = useRef(activeIdx);
  const [merging, setMerging] = useState(false);
  useEffect(() => {
    if (prevIdxRef.current === activeIdx) return;
    prevIdxRef.current = activeIdx;
    setMerging(true);
    const id = setTimeout(() => setMerging(false), 360);
    return () => clearTimeout(id);
  }, [activeIdx]);
  const PILL_PITCH = 84; // 76px fixed pill width + 8px gap
  const setDrag = (d: boolean) => {
    setDragging(d);
    onDraggingChange?.(d);
  };

  // while dragging, kill text selection everywhere so scrubbing across the board
  // never leaves highlighted text behind
  useEffect(() => {
    if (!dragging) return;
    document.body.classList.add('is-scrubbing-noselect');
    window.getSelection?.()?.removeAllRanges();
    return () => document.body.classList.remove('is-scrubbing-noselect');
  }, [dragging]);

  return (
    <>
      {dragging && (
        <div className="pbi-scrub-banner">
          <span className="pbi-scrub-lead">Paycheck in</span>
          <span className="pbi-scrub-date">{scrubMonthLabel(now)}</span>
        </div>
      )}
      <div
        ref={rowRef}
        className={`pbi-income-row${scrubbable ? ' pbi-income-row--scrub' : ''}${dragging ? ' is-scrubbing' : ''}`}
        title={scrubbable ? 'Drag to scrub through time' : undefined}
        style={{ left: incomeLeft, top: PBI_INCOME_TOP }}
        onPointerDown={
          scrubbable
            ? (e) => {
                e.preventDefault(); // stop the browser from starting a text selection
                try { rowRef.current?.setPointerCapture?.(e.pointerId); } catch { /* no active pointer (synthetic) */ }
                setDrag(true);
                scrubFromClientX(e.clientX);
              }
            : undefined
        }
        onPointerMove={scrubbable ? (e) => { if (dragging) scrubFromClientX(e.clientX); } : undefined}
        onPointerUp={
          scrubbable
            ? (e) => {
                try { rowRef.current?.releasePointerCapture?.(e.pointerId); } catch { /* ignore */ }
                setDrag(false);
              }
            : undefined
        }
        onPointerCancel={scrubbable ? () => setDrag(false) : undefined}
      >
        <div
          className="pbi-income-track"
          style={scrubbable ? { transform: `translateX(${-activeIdx * PILL_PITCH}px)` } : undefined}
        >
          <span
            className={`pbi-pill pbi-pill-slot${!scrubbable ? ' pbi-pill-income' : ''}${scrubbable && activeIdx === 0 ? ' pbi-pill-active' : ''}${scrubbable && activeIdx === 0 && merging ? ' is-merging' : ''}`}
          >
            {slotLabel(0)}
          </span>
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={`pbi-pill pbi-pill-slot${scrubbable && activeIdx === i + 1 ? ' pbi-pill-active' : ''}${scrubbable && activeIdx === i + 1 && merging ? ' is-merging' : ''}`}
            >
              {slotLabel(i + 1)}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}

// The shared artifact header carried by EVERY account style: the "Money Map is
// ready!" hero (logo · subtitle · serif headline) PLUS the paycheck-scrubber
// carousel beneath it. Rendered once at board level; each style's prototype is
// shifted down below it so nothing overlaps. While scrubbing, the serif headline
// steps aside for the "Paycheck in {Month}" banner.
export function ArtifactHeader({
  dataset,
  mode,
  now,
  onScrub,
  incomeLeft = PBI_INCOME_LEFT,
  carouselMode = 'paychecks',
}: {
  dataset: Dataset;
  mode: Mode;
  now: number;
  onScrub?: (nowMonths: number) => void;
  incomeLeft?: number;
  carouselMode?: CarouselMode;
}) {
  const hero = heroHeadline(dataset);
  const [dragging, setDragging] = useState(false);
  return (
    <>
      <div className="pbi-hero-logo">
        <FruitfulLogo size={40} color="#2f8f4e" />
      </div>
      <p className="pbi-hero-sub">
        Your Money Map is ready!<br />
        Based on everything you&rsquo;ve told us, we estimate you could be&hellip;
      </p>
      <h1 className={`pbi-hero-title${dragging ? ' is-scrub-hidden' : ''}`}>{`${hero.pre} ${hero.date}`}</h1>
      <PaycheckCarousel
        dataset={dataset}
        mode={mode}
        now={now}
        onScrub={onScrub}
        incomeLeft={incomeLeft}
        onDraggingChange={setDragging}
        carouselMode={carouselMode}
      />
    </>
  );
}

// "Text gates + backgrounds" pbi gate (Figma 885:11940): the rounded COLORED
// SECTION PANELS that sit BEHIND the pbi cards/branches — a teal/mint panel
// behind Monthly Expenses (Core + Spend) and a pink panel behind Goals (all goal
// cards). The section names are carried by the on-spine text gate pills, so the
// panels themselves have no corner labels. Board-level chrome rendered once
// (behind the connectors + cards) when this gate is active. Own .pbi-grouped-*.
export function PbiGroupedPanels({ dataset }: { dataset: Dataset }) {
  const panels = pbiGroupedPanelsFor(dataset);
  return (
    <>
      {panels.map((p) => (
        <div
          key={p.id}
          className={`pbi-grouped-panel pbi-grouped-panel--${p.tint}`}
          style={{ left: p.x, top: p.y, width: p.w, height: p.h }}
        />
      ))}
    </>
  );
}

// "Grouped 2" pbi gate (Figma 802:10838): SAME section panels as Grouped but tinted
// GRAY (both Monthly Expenses + Goals), with gray section labels. Board-level chrome
// rendered once behind the connectors + cards when the Grouped 2 gate is active. Own
// .pbi-grouped2-* classes so it never touches the Grouped (teal/pink) styling.
export function PbiGrouped2Panels({ dataset }: { dataset: Dataset }) {
  const panels = pbiGrouped2PanelsFor(dataset);
  return (
    <>
      {panels.map((p) => (
        <div
          key={p.id}
          className="pbi-grouped2-panel"
          style={{ left: p.x, top: p.y, width: p.w, height: p.h }}
        >
          <span className="pbi-grouped2-label">{p.label}</span>
        </div>
      ))}
    </>
  );
}

// "Pots" hero + income chrome (Figma 802:9336): the same centered hero family as
// pbi (sprout logo · gray subtitle · large serif headline derived from the
// dataset's milestone goal), then a single yellow INCOME pill sitting at the top
// of the left spine (no PAYCHECK pills here — the Figma income is just the pill).
// Own .pot-* classes so it stays scoped to this style.
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
  dataset,
  style,
  cardStyle = 'standard',
  titleVariant = 'date',
  map = 'flow',
  dimmed,
  v1 = false,
  condensed = false,
  dateMode = 'date',
  iconLabeled = false,
  pbiGrouped = false,
  pbiLocked = false,
  onConvoTap,
  modalCardId = null,
  hideIncome = false,
  refillVisual = false,
}: {
  node: CardNode;
  now: number;
  mode: Mode;
  dataset: Dataset;
  style: ChartStyle;
  cardStyle?: CardStyle;
  titleVariant?: TitleVariant;
  map?: MapStyle;
  dimmed?: boolean;
  v1?: boolean; // stocks "Version" V1 sub-variant (wide cards, own row layout)
  condensed?: boolean; // stocks "Version" Condensed sub-variant (horizontal cards)
  dateMode?: DateMode; // "Goal date" display: absolute badge vs "{N} mo. from now"
  iconLabeled?: boolean; // icons "Labeled" gate: income top-center + indented tiles
  pbiGrouped?: boolean; // pbi "Grouped" gate: goals section pushed down for the pink panel
  pbiLocked?: boolean; // pbi "Gradient background" gate: income pill shifts to the right-moved spine (x=84)
  onConvoTap?: (id: string, rect: DOMRect) => void; // "convo": tap a card to open its detail modal (passes rect for the FLIP morph)
  modalCardId?: string | null; // "convo": id of the card whose morph modal is open (that resting card is hidden)
  hideIncome?: boolean; // styles that carry the shared ArtifactHeader render the carousel AS income, so the per-style income node is suppressed
  refillVisual?: boolean; // pbi "Core/Spend refill visual": two-tone capacity+balance bar (Figma 907:13009)
}) {
  // Styles that render the shared board-level ArtifactHeader use its paycheck
  // carousel as the income element, so the per-style income node is suppressed.
  if (node.kind === 'income' && hideIncome) return null;
  // Stocks Condensed sub-variant (Figma 522:6440): compact horizontal cards with
  // their OWN tighter row layout. Takes precedence over everything below.
  if (condensed && style === 'stocks') {
    const top = condensedRowTopFor(dataset)[node.id] ?? node.y;
    const left =
      node.kind === 'income'
        ? CONDENSED_CARD_LEFT.income
        : node.kind === 'account'
          ? CONDENSED_CARD_LEFT.account
          : CONDENSED_CARD_LEFT.goal;
    return (
      <div className={`node${dimmed ? ' dimmed' : ''}`} style={{ left, top }}>
        <StocksCondensedCard node={node} now={now} mode={mode} dataset={dataset} dateMode={dateMode} />
      </div>
    );
  }

  // Stocks V1 sub-variant (Figma 519:6283): its OWN wide card + row layout, taking
  // precedence over every other style/identity branch below. Income is centered;
  // accounts/goals share the wide right column.
  if (v1 && style === 'stocks') {
    const top = v1RowTopFor(dataset)[node.id] ?? node.y;
    const left = node.kind === 'income' ? V1_CARD_LEFT.income : V1_CARD_LEFT.column;
    return (
      <div className={`node${dimmed ? ' dimmed' : ''}`} style={{ left, top }}>
        <StocksV1Card node={node} now={now} mode={mode} dataset={dataset} dateMode={dateMode} />
      </div>
    );
  }
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
  // "super slim" — a self-contained row (name pill · dotted line · colored
  // target pill). Illustrative-only; the target pill colors in on funding.
  const isSlim =
    style === 'slim' && (node.kind === 'income' || node.kind === 'account' || node.kind === 'goal');
  // "minimalist icons" — a self-contained row (icon tile + name/amount text +
  // optional goal date pill). Illustrative-only; the tile fills in on funding.
  const isIcons =
    style === 'icons' && (node.kind === 'income' || node.kind === 'account' || node.kind === 'goal');
  // "conversational" — a narrative stack (yellow income header + full-width cards
  // with an illustration/date slot + a chip-filled sentence). Illustrative-only.
  const isConvo =
    style === 'convo' && (node.kind === 'income' || node.kind === 'account' || node.kind === 'goal');
  // "sheet" — a grouped-panel layout: income card + spine, a mint MONTHLY
  // EXPENSES panel (black amount pills → white name cards) and a pink GOALS panel
  // (black weight-% pills → white goal cards with a dark FUNDING/FUNDED footer).
  // Illustrative-only; the panels + pills are board-level chrome (SheetChrome).
  const isSheet =
    style === 'sheet' && (node.kind === 'income' || node.kind === 'account' || node.kind === 'goal');
  // "illustrated" — a progress-track spine + colorizing illustration cards
  // (income top-center card + account/goal cards). Illustrative-only; the branch
  // fill continues into the in-card progress bar, and account illustrations /
  // goal checks colorize + celebrate when their bar fills.
  const isIllo =
    style === 'illo' && (node.kind === 'income' || node.kind === 'account' || node.kind === 'goal');
  // "pots" — each account/goal card is a colored pot whose top-edge plant band
  // grows left→right with funding (the plant band IS the progress bar). Income
  // renders the hero + INCOME pill chrome (no pot). Illustrative-only.
  const isPots =
    style === 'pots' && (node.kind === 'income' || node.kind === 'account' || node.kind === 'goal');
  // "grid" — a schematic black-line-on-graph-paper tree. Each account/goal card
  // is a plain GRAY placeholder rectangle (a stand-in, no inner content); the
  // income row is a small BLACK square root marker capping the top of the spine.
  // Static/graphic (the tree + value pills are drawn by Connectors' gridTree).
  const isGrid =
    style === 'grid' && (node.kind === 'income' || node.kind === 'account' || node.kind === 'goal');
  // reached-check colour derives from the active visual identity's pink
  const checkColor = map === 'money-map' ? PINK_MM : PINK_FLOW;

  if (isGrid) {
    // reveal like the Sheet: the marker + each card pops in (fade + subtle scale)
    // the instant the growing tree tip reaches it, sitting as a faint ghost before
    // then. Driven off `now` (sim months) via the same causal reveal timing, with
    // transition:none so the pop tracks the sim clock exactly.
    const rs = sheetRevealStyle(now, sheetRevealMonths(dataset, mode)[node.id] ?? 0);
    const revealStyle = { opacity: rs.opacity, transform: `scale(${rs.scale})`, transition: 'none' as const };
    if (node.kind === 'income') {
      // small root marker centered on the top of the spine
      return (
        <div
          className={`node${dimmed ? ' dimmed' : ''}`}
          style={{ left: GRID_SPINE_X - GRID_MARKER / 2, top: GRID_INCOME_CY - GRID_MARKER / 2, zIndex: 5, ...revealStyle }}
        >
          <GridCard node={node} />
        </div>
      );
    }
    const top = gridRowTopFor(dataset)[node.id] ?? node.y;
    return (
      <div className={`node${dimmed ? ' dimmed' : ''}`} style={{ left: GRID_CARD_LEFT, top, zIndex: 2, ...revealStyle }}>
        <GridCard node={node} />
      </div>
    );
  }

  if (isPots) {
    // income is rendered by the shared ArtifactHeader carousel (hideIncome)
    // pot fill fraction reuses progressAt so the plants grow in step with funding
    const p = progressAt(dataset, mode, node.id, now);
    const reached = node.kind === 'goal' && isReached(dataset, mode, node.id, now);
    const top = potRowTopFor(dataset)[node.id] ?? node.y;
    return (
      <div className={`node${dimmed ? ' dimmed' : ''}`} style={{ left: POT_CARD_LEFT, top, width: POT_CONTAINER_W, zIndex: 5 }}>
        <PotCard node={node} progress={p} dateMode={dateMode} reached={reached} />
      </div>
    );
  }

  if (isIllo) {
    if (node.kind === 'income') {
      return (
        <div className={`node${dimmed ? ' dimmed' : ''}`} style={{ left: ILLO_INCOME_LEFT, top: ILLO_INCOME_TOP }}>
          <IlloIncome node={node} dataset={dataset} mode={mode} now={now} />
        </div>
      );
    }
    const top = illoRowTopFor(dataset)[node.id] ?? node.y;
    return (
      <div className={`node${dimmed ? ' dimmed' : ''}`} style={{ left: ILLO_CARD_LEFT, top, width: ILLO_CARD_W }}>
        <IlloCard
          node={node}
          now={now}
          mode={mode}
          dataset={dataset}
          dateMode={dateMode}
          hidden={modalCardId === node.id}
          onTap={onConvoTap && node.kind === 'account' ? (rect) => onConvoTap(node.id, rect) : undefined}
        />
      </div>
    );
  }

  if (isSheet) {
    // branch-assembly reveal: this card pops in (scale 0.9→1 + fade) the instant
    // the growing branch tip reaches it, and sits as a faint gray ghost before
    // then. Driven off `now` (sim months) so pause/scrub/restart stay in sync.
    const rs = sheetRevealStyle(now, sheetRevealMonths(dataset, mode)[node.id] ?? 0);
    // transition:none so the pop tracks the sim clock exactly (the global .node
    // 0.5s opacity transition would otherwise smear/lag it). Sheet is
    // illustrative-only so it never uses the dimmed grayscale transition.
    const revealStyle = { opacity: rs.opacity, transform: `scale(${rs.scale})`, transition: 'none' };
    if (node.kind === 'income') {
      return (
        <div className={`node${dimmed ? ' dimmed' : ''}`} style={{ left: SHEET_INCOME_LEFT, top: SHEET_INCOME_TOP, ...revealStyle }}>
          <SheetIncome node={node} />
        </div>
      );
    }
    const top = sheetRowTopFor(dataset)[node.id] ?? node.y;
    if (node.kind === 'account') {
      return (
        <div className={`node${dimmed ? ' dimmed' : ''}`} style={{ left: SHEET_ACCT_LEFT, top, ...revealStyle }}>
          <SheetAccountCard node={node} />
        </div>
      );
    }
    return (
      <div className={`node${dimmed ? ' dimmed' : ''}`} style={{ left: SHEET_GOAL_LEFT, top, width: SHEET_GOAL_W, ...revealStyle }}>
        <SheetGoalCard node={node} now={now} mode={mode} dataset={dataset} />
      </div>
    );
  }

  if (isConvo) {
    // income renders as a plain top-left text block; account/goal cards use the
    // convo card at the fixed left column and their own compact convo row rhythm
    // (Figma 738:7662). The gray left spine drops from just below the income text.
    const convoTop = convoRowTopFor(dataset)[node.id] ?? node.y;
    if (node.kind === 'income') {
      return (
        <div className={`node${dimmed ? ' dimmed' : ''}`} style={{ left: CONVO_INCOME_LEFT, top: CONVO_INCOME_TOP }}>
          <ConvoIncome node={node} />
        </div>
      );
    }
    return (
      <div className={`node${dimmed ? ' dimmed' : ''}`} style={{ left: CONVO_CARD_LEFT, top: convoTop }}>
        <ConvoCard
          node={node}
          now={now}
          mode={mode}
          dataset={dataset}
          dateMode={dateMode}
          hidden={modalCardId === node.id}
          onTap={onConvoTap ? (rect) => onConvoTap(node.id, rect) : undefined}
        />
      </div>
    );
  }

  if (isIcons) {
    // icon rows use their own compact, evenly-spaced Y layout — NOT the tall
    // shared node.y. The default "Bracket" gate hangs income on the left spine
    // (Figma 729:6187); the "Labeled" gate puts income TOP-CENTER with its text
    // stacked above the tile and indents the account/goal tiles right (738:7107).
    if (iconLabeled) {
      const isIncome = node.kind === 'income';
      const top = isIncome ? ICON_LABELED_INCOME_TOP : iconLabeledRowTopFor(dataset)[node.id] ?? node.y;
      const left = isIncome ? ICON_LABELED_INCOME_LEFT : ICON_LABELED_TILE_LEFT;
      return (
        <div className={`node${dimmed ? ' dimmed' : ''}`} style={{ left, top }}>
          <IconRowCard node={node} now={now} mode={mode} dataset={dataset} dateMode={dateMode} labeled />
        </div>
      );
    }
    // default "Bracket" gate (Figma 773:8879): every row — income included —
    // left-aligns in one column at ICON_LIST_LEFT (the left connector tree lives
    // to its left), so ignore node.x here.
    const iconTop = iconRowTopFor(dataset)[node.id] ?? node.y;
    return (
      <div className={`node${dimmed ? ' dimmed' : ''}`} style={{ left: ICON_LIST_LEFT, top: iconTop }}>
        <IconRowCard node={node} now={now} mode={mode} dataset={dataset} dateMode={dateMode} />
      </div>
    );
  }

  if (isSlim) {
    // slim rows use their own compact, evenly-spaced Y layout (Figma 496-5864) —
    // NOT the tall shared node.y used by the other styles.
    const slimTop = slimRowTopFor(dataset)[node.id] ?? node.y;
    return (
      <div className={`node${dimmed ? ' dimmed' : ''}`} style={{ left: node.x, top: slimTop }}>
        <SuperSlimCard node={node} now={now} mode={mode} dataset={dataset} dateMode={dateMode} />
      </div>
    );
  }

  if (isProgressBg) {
    return (
      <div className={`node${dimmed ? ' dimmed' : ''}`} style={{ left: node.x, top: node.y }}>
        <ProgressBgCard node={node} now={now} mode={mode} dataset={dataset} dateMode={dateMode} />
      </div>
    );
  }

  if (isProgressPill) {
    const reached = isReached(dataset, mode, node.id, now);
    const p = node.kind === 'income' ? 1 : progressAt(dataset, mode, node.id, now);
    // progress pill sits ABOVE the branch connectors (which are z-index 4)
    const sub =
      node.kind === 'goal'
        ? dateMode === 'months'
          ? goalDateLabel(dateMode, node.badge)
          : `by ${node.badge ?? ''}`
          : node.kind === 'account'
          ? ({ core: 'for bills', spend: 'for daily spend' } as Record<string, string>)[node.id] ?? ''
          : undefined; // income has no suffix
    // progress-pill ONLY: lower the income pill into the clear area ABOVE the Core
    // card (tighter to the flow) instead of floating detached at the very top.
    // Dataset-aware target (see PILL_INCOME_POS) so it clears each layout's Core
    // row. Other card kinds always keep their shared node.x/node.y positions.
    const pillIncomePos = PILL_INCOME_POS[dataset];
    const lowerIncome = node.kind === 'income';
    const left = lowerIncome ? pillIncomePos.x : node.x;
    const top = lowerIncome ? pillIncomePos.y : node.y;
    return (
      <div className={`node${dimmed ? ' dimmed' : ''}`} style={{ left, top, zIndex: 5 }}>
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
    const goalReached = node.kind === 'goal' && isReached(dataset, mode, node.id, now);
    if (isPie) {
      const grey =
        node.kind === 'account'
          ? `${node.amount}/mo`
          : dateMode === 'months'
            ? goalDateLabel(dateMode, node.badge)
            : `Fund by ${node.badge ?? ''}`;
      return (
        <div className={`node${dimmed ? ' dimmed' : ''}`} style={{ left: node.x, top: node.y }}>
          <div className="card card-pie money-map">
            <PieChart color={node.graph} progress={progressAt(dataset, mode, node.id, now)} map="money-map" />
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
          <GraphStrip id={node.id} color={node.graph} variant={variant} now={now} mode={mode} dataset={dataset} map="money-map" pill={node.pill} />
          <Spacer h={8} />
          {node.kind === 'goal' ? (
            <div className={`mm-main${goalReached ? ' reached' : ''}`}>
              {goalReached && <Check size={12} strokeWidth={3} color={checkColor} />}
              <span>{goalDateLabel(dateMode, node.badge) || node.mapMain || node.title}</span>
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

  // "Progress bar, inside" (Figma 792:8522) — a hero header + left spine + white
  // cards whose in-card rounded bar fills with the dollar amount INSIDE it. The
  // income node renders the hero + INCOME/PAYCHECK pill chrome (no card); each
  // account/goal card is an icon tile + name over the filling bar (goal cards add
  // an uppercase date pill). Fill fraction reuses progressAt so the bar fills in
  // step with the branch pulse; isReached flips the goal date pill to "reached".
  if (isProgress) {
    // income is rendered by the shared ArtifactHeader carousel (hideIncome)
    const p = progressAt(dataset, mode, node.id, now);
    const reached = node.kind === 'goal' && isReached(dataset, mode, node.id, now);
    // every pbi gate (Text gates / Text gates + backgrounds / Indented) shares the
    // default uniform-pitch rows; the panels/tree are built around these same rows.
    const top = pbiRowTopFor(dataset)[node.id] ?? node.y;
    const cardLeft = PBI_CARD_LEFT;
    const Glyph = pbiIconFor(node);
    return (
      <div className={`node${dimmed ? ' dimmed' : ''}`} style={{ left: cardLeft, top, width: PBI_CARD_W }}>
        <div className="pbi-card">
          <div className="pbi-card-head">
            <Glyph className="pbi-icon" size={16} strokeWidth={1.5} color="#191919" />
            <span className="pbi-card-name">{node.title}</span>
          </div>
          <ProgressBar
            color={node.graph}
            progress={p}
            amount={node.amount}
            date={
              node.kind === 'goal'
                ? dateMode === 'months'
                  ? goalDateLabel(dateMode, node.badge)
                  : node.badge ?? ''
                : undefined
            }
            reached={reached}
            refill={refillVisual && node.kind === 'account'}
            now={now}
          />
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
          <GraphStrip id={node.id} color={node.graph} variant={gv} now={now} mode={mode} dataset={dataset} badge={node.badge} tertiary pill={node.pill ?? node.title} />
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
    // subtitle (gray) = monthly amount for accounts / "Fund by <date>" for goals;
    // title (black) = the account or goal name — per Figma 462-6556
    const pieSub =
      node.kind === 'account'
        ? `${node.amount}/mo`
        : dateMode === 'months'
          ? goalDateLabel(dateMode, node.badge)
          : `Fund by ${node.badge ?? ''}`;
    return (
      <div className={`node${dimmed ? ' dimmed' : ''}`} style={{ left: node.x, top: node.y }}>
        <div className="card card-pie">
          <PieChart color={node.graph} progress={progressAt(dataset, mode, node.id, now)} />
          <div className="pie-text">
            <div className="mm-pie-grey"><span>{pieSub}</span></div>
            <div className="mm-pie-title">{node.title}</div>
          </div>
        </div>
      </div>
    );
  }

  const variant: GraphVariant = node.kind === 'income' ? 'income' : node.kind === 'account' ? 'flow' : 'goal';

  return (
    <div className={`node${dimmed ? ' dimmed' : ''}`} style={{ left: node.x, top: node.y }}>
      <div className="card">
        <GraphStrip id={node.id} color={node.graph} variant={variant} now={now} mode={mode} dataset={dataset} badge={goalDateLabel(dateMode, node.badge)} />
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
