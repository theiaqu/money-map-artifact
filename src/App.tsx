import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { SlidersHorizontal, X, ArrowLeft } from 'lucide-react';
import Card, { ArtifactHeader, IncomeAccountCard, PbiGroupedPanels, PbiSectionLabelPanels, PbiIncomeSectionPanels, PbiGrouped2Panels } from './components/Card';
import MonthlySplit from './components/MonthlySplit';
import HomeScreen from './components/HomeScreen';
import SectionNodeView from './components/SectionNodeView';
import Connectors from './components/Connectors';
import ConvoModal from './components/ConvoModal';
import IlloModal from './components/IlloModal';
import { SheetChrome } from './components/SheetCard';
import { IlloCircle } from './components/IlloCard';
import PillsBoard from './components/PillsBoard';
import Device, { SCREEN_W } from './components/Device';
import { cardsFor, sectionsFor, badgesFor, pbiSplitDividersFor, pillsLayoutFor, HOME_BALANCES, homeAccountFill, homeAccountAmount, PBI_INCOME_CARD_TOP, PBI_INCOME_GATE_Y, type BranchStyle, type MapStyle } from './data';
import type { ChartStyle, CarouselMode, CarouselInteraction, IncomeRep } from './components/Card';
import { animMonths, endSecs, monthSecs, dimmedNodes, homeGoalFill, type Dataset, type Mode, type DateMode } from './scenario';

// ---- "Monthly split" shared-element morph (Figma 907:13144) ----
// Every morphable element in either view carries data-morph="<role>" (income /
// bills / spend / goals) + data-morph-color. On toggle we measure the source
// rects (board-local, scale-normalized), switch views, measure the target rects,
// then fly a colored ghost per pairing from source→target. Roles fan out cleanly:
// the many goal bars all map to the single Goals bar (merge), and vice-versa on
// the way back (split).
type MorphRect = { left: number; top: number; width: number; height: number; color: string; radius: string };
type MorphMap = Record<string, MorphRect[]>;
type Ghost = { id: string; from: MorphRect; to: MorphRect };
const MORPH_ROLES = ['income', 'bills', 'spend', 'goals'];
// Morph geometry duration, keyed by the TARGET view. Full system → Monthly split
// stays calm/long; the RETURN (Monthly split → Full system) is noticeably snappier.
// The active value is fed to the ghost + data-morph CSS via the --morph-ms var so
// the JS cleanup timers and the CSS transition can never drift apart.
const MORPH_MS: Record<'full' | 'monthly', number> = { full: 760, monthly: 1200 };
// Destination crossfade WINDOW, keyed by target view: the real text-bearing target
// elements fade IN while the ghosts fade OUT, pixel-aligned. The window ENDS as the
// ghost arrives, so it BEGINS at (duration - window) — i.e. the text/amount is
// already fading in just BEFORE the pill reaches its resting spot, then settles
// exactly on arrival (no hard swap / end pop). Fed to CSS via the --reveal-ms var.
const REVEAL_MS: Record<'full' | 'monthly', number> = { full: 380, monthly: 480 };

function measureMorph(board: HTMLElement): MorphMap {
  const br = board.getBoundingClientRect();
  const scale = board.offsetWidth ? br.width / board.offsetWidth : 1;
  const map: MorphMap = {};
  board.querySelectorAll<HTMLElement>('[data-morph]').forEach((el) => {
    const role = el.getAttribute('data-morph');
    if (!role) return;
    // Measure the GEOMETRY element for the flying ghost. When a morph target
    // wraps text alongside the colored chip (e.g. a Pills row = colored pill +
    // "$8,000 a month" meta), the row's box is far wider than the pill, so a
    // solid ghost of the row width wouldn't match the real pill. If the element
    // marks an inner `[data-morph-rect]` (the colored pill itself), measure THAT
    // so the ghost starts/ends exactly on the pill's bounding box.
    const geo = (el.querySelector<HTMLElement>('[data-morph-rect]') ?? el);
    const r = geo.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const rect: MorphRect = {
      left: (r.left - br.left) / scale,
      top: (r.top - br.top) / scale,
      width: r.width / scale,
      height: r.height / scale,
      color: el.getAttribute('data-morph-color') || '#cccccc',
      // carry the geometry element's own corner radius so the ghost rounds to the
      // pill's 6px at the pill end and the bar's 12px at the bar end (seamless).
      radius: getComputedStyle(geo).borderTopLeftRadius || '12px',
    };
    (map[role] ||= []).push(rect);
  });
  return map;
}

// ---- "Sections" transition source/target measurement ----
// Alternative to measureMorph for the Full-system side of the morph: instead of the
// per-card PROGRESS BARS, the colored SECTION BACKGROUND bands are what fly to/from
// the Monthly-split columns. The mint "Monthly Expenses" band (which stacks Core
// above Spend) SPLITS into two ghosts — a BLUE top half (Core → bills) and a GREEN
// bottom half (Spend → spend) — while the pink Goals band maps to the goals column.
// Income keeps morphing from the header paycheck pill so the take-home pill still
// flies in. Returns {} for styles/gates without section bands (caller falls back).
function measureSectionBands(board: HTMLElement): MorphMap {
  const br = board.getBoundingClientRect();
  const scale = board.offsetWidth ? br.width / board.offsetWidth : 1;
  const map: MorphMap = {};
  const push = (role: string, left: number, top: number, width: number, height: number, color: string, radius: string) => {
    if (!width || !height) return;
    (map[role] ||= []).push({
      left: (left - br.left) / scale,
      top: (top - br.top) / scale,
      width: width / scale,
      height: height / scale,
      color,
      radius,
    });
  };
  // Income source: prefer the YELLOW income SECTION BAND (Account-style card mode),
  // so the band itself morphs into the take-home yellow card — consistent with the
  // mint/pink bands. Fall back to the header paycheck pill when no band is present
  // (e.g. Individual-pills income), so the take-home pill still flies in.
  const incBand = board.querySelector<HTMLElement>('[data-morph-band="income"]');
  if (incBand) {
    const r = incBand.getBoundingClientRect();
    const radius = getComputedStyle(incBand).borderTopLeftRadius || '16px';
    push('income', r.left, r.top, r.width, r.height, '#f6dc72', radius);
  } else {
    const inc = board.querySelector<HTMLElement>('[data-morph="income"]');
    if (inc) {
      const geo = inc.querySelector<HTMLElement>('[data-morph-rect]') ?? inc;
      const r = geo.getBoundingClientRect();
      push('income', r.left, r.top, r.width, r.height, inc.getAttribute('data-morph-color') || '#f6dc72', getComputedStyle(geo).borderTopLeftRadius || '12px');
    }
  }
  // Monthly Expenses band → SPLIT into blue (Core, top) + green (Spend, bottom).
  const monthly = board.querySelector<HTMLElement>('[data-morph-band="monthly"]');
  if (monthly) {
    const r = monthly.getBoundingClientRect();
    const radius = getComputedStyle(monthly).borderTopLeftRadius || '16px';
    const half = r.height / 2;
    push('bills', r.left, r.top, r.width, half, '#b0d9ff', radius);
    push('spend', r.left, r.top + half, r.width, half, '#61bc76', radius);
  }
  // Goals band → the pink goals column.
  const goals = board.querySelector<HTMLElement>('[data-morph-band="goals"]');
  if (goals) {
    const r = goals.getBoundingClientRect();
    const radius = getComputedStyle(goals).borderTopLeftRadius || '16px';
    push('goals', r.left, r.top, r.width, r.height, '#eebed4', radius);
  }
  return map;
}

// ---- Onboarding home ⇄ map account-card FLIP ----
// A card-level shared-element morph, separate from the bar-level Monthly-split
// morph. The mock home page's account cards (data-morph-card="spend"/"bills") fly
// into the money-map's matching pbi cards (and back).
//
// To avoid distorting the card text we DON'T non-uniformly scale a text-bearing
// ghost. Instead each ghost holds two stacked layers — a clone of the SOURCE card
// and a clone of the TARGET card, each at its own natural size, pinned top-left —
// and only the ghost's POSITION (translate) is animated while we crossfade source
// → target. Text is never squished; the size change reads through the crossfade.
//
// Coordinates are captured NATURAL (unscaled) relative to the device screen and
// the ghost layer renders INSIDE that same scaled/clipped context (Device overlay
// / .board-scaler), so cards inherit the device scale uniformly and can never
// extend past the phone's rounded bounds.
type CardPt = { left: number; top: number };
type CardSrc = { role: string; pt: CardPt; w: number; h: number; html: string };
type CardGhost = {
  id: string;
  from: CardPt;
  to: CardPt;
  srcHtml: string;
  srcW: number;
  srcH: number;
  dstHtml: string;
  dstW: number;
  dstH: number;
};
// Interpolate a card ghost's FRAME (position + width/height) and the two faces'
// uniform scales for a given progress t (0 = big source card, 1 = small target
// card). The frame box lerps src→dst geometry so it lands EXACTLY on the target;
// each face is UNIFORMLY scaled (single width-based factor → text never stretches)
// so at t=0 the src face is crisp at natural size and at t=1 the dst face is crisp
// at natural size, matching the real card before the reveal. Faces crossfade on t.
function cardMorphFrame(g: CardGhost, t: number) {
  const boxLeft = g.from.left + (g.to.left - g.from.left) * t;
  const boxTop = g.from.top + (g.to.top - g.from.top) * t;
  const boxW = g.srcW + (g.dstW - g.srcW) * t;
  const boxH = g.srcH + (g.dstH - g.srcH) * t;
  const srcScale = g.srcW ? boxW / g.srcW : 1;
  const dstScale = g.dstW ? boxW / g.dstW : 1;
  return {
    ghost: { transform: `translate(${boxLeft}px, ${boxTop}px)`, width: boxW, height: boxH } as CSSProperties,
    src: { width: g.srcW, height: g.srcH, transform: `scale(${srcScale})`, opacity: 1 - t } as CSSProperties,
    dst: { width: g.dstW, height: g.dstH, transform: `scale(${dstScale})`, opacity: t } as CSSProperties,
  };
}

const CARD_MORPH_MS = 640;
// While the sheet is being dragged, the home→map card morph is only allowed to
// show a SUBTLE preview (a small hint that the cards are starting to move toward
// the money map) — it must NOT visibly complete mid-drag. The full pull fraction
// (0..1) is squashed through DRAG_PREVIEW_MAX so even a full drag only nudges the
// morph a little; the remaining ~90% plays out as the release-completion tween.
const DRAG_PREVIEW_MAX = 0.12; // max morph fraction reachable by dragging (rest completes on release)
const dampDragProgress = (fraction: number) => {
  const f = Math.max(0, Math.min(1, fraction));
  // easeOut so the hint is responsive at the very start, then quickly plateaus
  return DRAG_PREVIEW_MAX * (1 - Math.pow(1 - f, 2));
};

// The scaled + clipped container the morph layer lives inside: the phone screen on
// desktop, or the scaled board wrapper on mobile.
function morphContainer(): HTMLElement | null {
  return (
    (document.querySelector('.device-screen') as HTMLElement | null) ||
    (document.querySelector('.board-scaler') as HTMLElement | null)
  );
}

// Measure every [data-morph-card] in NATURAL coordinates relative to `ref`
// (dividing out the device/board scale) so the ghosts render in the same
// unscaled space the container itself is scaled from.
function measureCards(ref: HTMLElement, queryRoot: ParentNode = document): CardSrc[] {
  const rr = ref.getBoundingClientRect();
  const scale = ref.offsetWidth ? rr.width / ref.offsetWidth : 1;
  const out: CardSrc[] = [];
  queryRoot.querySelectorAll<HTMLElement>('[data-morph-card]').forEach((el) => {
    const role = el.getAttribute('data-morph-card');
    if (!role) return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    out.push({
      role,
      pt: { left: (r.left - rr.left) / scale, top: (r.top - rr.top) / scale },
      w: r.width / scale,
      h: r.height / scale,
      html: el.outerHTML,
    });
  });
  return out;
}

const MODES: { id: Mode; label: string }[] = [
  { id: 'illustrative', label: 'Illustrative' },
  { id: 'accurate', label: 'Accurate' },
];

// "Goal date" is a GENERAL display toggle (applies to every account style that
// shows a goal fund-by date). It's a pure display change — flipping it does NOT
// reset the animation, so it can be toggled live.
const DATE_OPTS: { id: DateMode; label: string }[] = [
  { id: 'date', label: 'Completion date' },
  { id: 'months', label: 'Months from now' },
];

// header carousel label mode: "Paychecks" (Income/Paycheck pills) vs "Timeline"
// (month labels like "Aug '26").
const CAROUSEL_OPTS: { id: CarouselMode; label: string }[] = [
  { id: 'timeline', label: 'Timeline' }, // default first
  { id: 'paychecks', label: 'Paychecks' },
];

// carousel interaction type: 'scrub' = relative drag (pressing does nothing; the
// active month only tracks the drag delta as you move) vs. 'tap' = tap a month
// pill to jump to it. Scrub is default-first per our defaults-first convention.
const INTERACTION_OPTS: { id: CarouselInteraction; label: string }[] = [
  { id: 'scrub', label: 'Scrub (drag)' }, // default first
  { id: 'tap', label: 'Tap' },
];

// income representation: 'pills' = the paycheck-scrubber pill row (default first);
// 'card' = an account-style card whose bar depletes backwards (income spent down).
const INCOME_OPTS: { id: IncomeRep; label: string }[] = [
  { id: 'card', label: 'Account-style card' }, // default first
  { id: 'pills', label: 'Individual pills' },
];

// "Transition animation" chooses HOW the Full system → Monthly split morph plays:
// 'sections' (default) morphs the colored SECTION BACKGROUND bands into the split
// columns (the mint Monthly-Expenses band splits into a blue Core + green Spend
// half); 'bars' keeps the original per-progress-bar morph.
type TransitionAnim = 'sections' | 'bars';
const TRANSITION_OPTS: { id: TransitionAnim; label: string }[] = [
  { id: 'sections', label: 'Sections' }, // default first
  { id: 'bars', label: 'Progress bars' },
];

// Monthly Expenses section background: 'teal' (current translucent mint, default)
// vs 'gradient' — the blue→green vertical gradient per Figma 1054:12173
// (water-light #d7ecff → leaf-light #b0ddba), hinting Core=blue / Spend=green.
type MonthlyBg = 'teal' | 'gradient';
const MONTHLY_BG_OPTS: { id: MonthlyBg; label: string }[] = [
  { id: 'teal', label: 'Teal' }, // default first (current behavior)
  { id: 'gradient', label: 'Gradient' },
];

// "Data type" reparameterizes the whole scenario/data model (income, expense
// caps, and the goal waterfall). Simple keeps the original weighted 2nd gate;
// Optimizer funds goals sequentially and ends with a House goal.
const DATASET_OPTS: { id: Dataset; label: string }[] = [
  { id: 'simple', label: 'Simple with debt' },
  { id: 'optimizer', label: 'Optimizer' },
];

// `older: true` styles are hidden behind the "view older ideas" link at the
// bottom of the account-style picker (kept around but not front-and-center).
const STYLES: { id: ChartStyle; label: string; older?: boolean }[] = [
  { id: 'progress', label: 'Progress bar, inside' },
  { id: 'pills', label: 'Pills' },
  { id: 'illo', label: 'Illustrated' },
  { id: 'stocks', label: 'Stocks / heart monitor' },
  { id: 'icons', label: 'Minimalist icons', older: true },
  { id: 'pots', label: 'Pots', older: true },
  { id: 'grid', label: 'Grid', older: true },
  { id: 'sheet', label: 'Sheet', older: true },
  { id: 'pie', label: 'Pie chart', older: true },
  { id: 'progress-bg', label: 'Progress bar, background', older: true },
  { id: 'slim', label: 'Super slim', older: true },
  { id: 'convo', label: 'Logic first description', older: true },
  { id: 'progress-pill', label: 'Progress pill', older: true },
];

// Small schematic mini-mock of each account-style chart, shown inside its
// selectable tile. Purely decorative (no data/animation) — just enough to make
// each style recognizable when picking.
function StylePreview({ id }: { id: ChartStyle }) {
  switch (id) {
    case 'progress':
      return (
        <div className="sp sp-progress" aria-hidden>
          <div className="sp-prog-track">
            <div className="sp-prog-fill" />
          </div>
          <span className="sp-prog-pill">By</span>
        </div>
      );
    case 'pills':
      return (
        <div className="sp sp-pills" aria-hidden>
          <span className="sp-pills-card" />
          <span className="sp-pills-spine" />
          <span className="sp-pills-pill sp-pills-pill-1" />
          <span className="sp-pills-pill sp-pills-pill-2" />
        </div>
      );
    case 'progress-bg':
      return (
        <div className="sp sp-bg" aria-hidden>
          <div className="sp-bg-fill" />
          <span className="sp-bg-line sp-bg-line-1" />
          <span className="sp-bg-line sp-bg-line-2" />
        </div>
      );
    case 'slim':
      return (
        <div className="sp sp-slim" aria-hidden>
          <span className="sp-slim-name" />
          <span className="sp-slim-dots" />
          <span className="sp-slim-target" />
        </div>
      );
    case 'icons':
      return (
        <div className="sp sp-icons" aria-hidden>
          <span className="sp-icons-tile" />
          <span className="sp-icons-text">
            <span className="sp-icons-line sp-icons-line-1" />
            <span className="sp-icons-line sp-icons-line-2" />
          </span>
          <span className="sp-icons-pill" />
        </div>
      );
    case 'convo':
      return (
        <div className="sp sp-convo" aria-hidden>
          <span className="sp-convo-header" />
          <span className="sp-convo-card">
            <span className="sp-convo-illo" />
            <span className="sp-convo-lines">
              <span className="sp-convo-line sp-convo-line-1" />
              <span className="sp-convo-line sp-convo-line-2" />
            </span>
          </span>
          <span className="sp-convo-card">
            <span className="sp-convo-illo" />
            <span className="sp-convo-lines">
              <span className="sp-convo-line sp-convo-line-1" />
              <span className="sp-convo-line sp-convo-line-2" />
            </span>
          </span>
        </div>
      );
    case 'sheet':
      return (
        <div className="sp sp-sheet" aria-hidden>
          <span className="sp-sheet-panel">
            <span className="sp-sheet-row">
              <span className="sp-sheet-pill" />
              <span className="sp-sheet-card" />
            </span>
            <span className="sp-sheet-row">
              <span className="sp-sheet-pill" />
              <span className="sp-sheet-card" />
            </span>
          </span>
        </div>
      );
    case 'illo':
      return (
        <div className="sp sp-illo" aria-hidden>
          <span className="sp-illo-spine" />
          <span className="sp-illo-card">
            <span className="sp-illo-lines">
              <span className="sp-illo-line" />
              <span className="sp-illo-bar" />
            </span>
            <span className="sp-illo-figure" />
          </span>
          <span className="sp-illo-card">
            <span className="sp-illo-lines">
              <span className="sp-illo-line" />
              <span className="sp-illo-bar sp-illo-bar-2" />
            </span>
            <span className="sp-illo-figure sp-illo-figure-2" />
          </span>
        </div>
      );
    case 'pie':
      return (
        <div className="sp sp-pie" aria-hidden>
          <div className="sp-pie-ring">
            <div className="sp-pie-center" />
          </div>
        </div>
      );
    case 'stocks':
      return (
        <div className="sp sp-stocks" aria-hidden>
          <span className="sp-stk-bar" style={{ height: '38%', left: '14%' }} />
          <span className="sp-stk-bar" style={{ height: '58%', left: '38%' }} />
          <span className="sp-stk-bar" style={{ height: '46%', left: '62%' }} />
          <span className="sp-stk-baseline" />
          <svg className="sp-stk-svg" viewBox="0 0 100 40" preserveAspectRatio="none">
            <polyline
              points="2,34 22,26 40,30 58,16 76,20 98,6"
              fill="none"
              stroke="#61bc76"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      );
    case 'progress-pill':
      return (
        <div className="sp sp-pill" aria-hidden>
          <div className="sp-pill-chip">
            <div className="sp-pill-fill" />
          </div>
        </div>
      );
    case 'pots':
      return (
        <div className="sp sp-pots" aria-hidden>
          <svg className="sp-pots-plants" viewBox="0 0 40 16" preserveAspectRatio="xMidYMax meet">
            <circle cx="9" cy="12" r="5" fill="#22592f" />
            <circle cx="16" cy="11" r="5.5" fill="#357a45" />
            <circle cx="24" cy="12" r="5" fill="#22592f" />
            <circle cx="31" cy="12" r="4.5" fill="#4e9e63" />
          </svg>
          <span className="sp-pots-rim" />
          <span className="sp-pots-body" />
        </div>
      );
    case 'grid':
      return (
        <div className="sp sp-grid" aria-hidden>
          <span className="sp-grid-spine" />
          <span className="sp-grid-arm" />
          <span className="sp-grid-card" />
        </div>
      );
    default:
      return null;
  }
}

const BRANCHES: { id: BranchStyle; label: string }[] = [
  { id: 'text-only', label: 'Text only' },
  { id: 'compact', label: 'Lines with %' },
];

// "Progress bar, inside" offers its OWN gate set: "Text only", "Locked path"
// (bold white spine + padlocks), and "Grouped" (colored section panels behind the
// cards, Figma 802:10601). Locked path + Grouped are pbi-scoped (their geometry is
// pbi-only), so they're offered ONLY for the progress style; "Lines with %" and
// "Condensed" are intentionally NOT offered here.
const PBI_BRANCHES: { id: BranchStyle; label: string }[] = [
  { id: 'pbi-grouped', label: 'In sections' }, // default first
  { id: 'text-only', label: 'Text gates' },
  { id: 'pbi-sectionlabel', label: 'Section plus label' },
  { id: 'pbi-income-section', label: 'Sections incl. income' },
  { id: 'pbi-split', label: 'Section split' },
  { id: 'pbi-indented', label: 'Indented' },
  { id: 'pbi-locked', label: 'Gradient background' },
  { id: 'pbi-grouped2', label: 'Grouped 2' },
];

// "Skinny line" is the thin-tree pairing for the minimalist styles (Super slim,
// Figma 496-5864; Minimalist icons, Figma 729:6187): the super-thin tree is
// designed around their compact rows, so it's the sole gate offered for them.
const SLIM_BRANCHES: { id: BranchStyle; label: string }[] = [
  { id: 'skinny-line', label: 'Skinny line' },
];

// "Minimalist icons" offers TWO gate styles: the existing thin-bracket tree
// ("Bracket", default) and the new labeled left-spine tree ("Labeled", Figma
// 738:7107 — top-center income + gate-label pills + curvy branches).
const ICON_BRANCHES: { id: BranchStyle; label: string }[] = [
  { id: 'skinny-line', label: 'Bracket' },
  { id: 'icon-labeled', label: 'Labeled' },
];

const MAPS: { id: MapStyle; label: string }[] = [
  { id: 'money-map', label: 'Like Today\u2019s MM' },
  { id: 'flow', label: 'Modern' },
];

// "Version" is a stocks-only sub-variant toggle. V2 is the existing heart-monitor
// look (default, unchanged); V1 is the wider-card layout (Figma 519:6283);
// Condensed is the compact horizontal-card layout (Figma 522:6440).
type Version = 'v1' | 'v2' | 'condensed';
const VERSION_OPTS: { id: Version; label: string }[] = [
  { id: 'v1', label: 'V1' },
  { id: 'v2', label: 'V2' },
  { id: 'condensed', label: 'Condensed' },
];

// Mobile responsive: the design target is a phone ~402pt wide, so treat narrow
// (or coarse-pointer) viewports as mobile and switch to the full-screen layout.
function useIsMobile(breakpoint = 768) {
  const query = `(max-width: ${breakpoint}px), (pointer: coarse)`;
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [query]);
  return isMobile;
}

// Live viewport width so the full-screen board can be scaled to fill it (the
// board is authored for a 402-wide coordinate space).
function useViewportWidth() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : SCREEN_W);
  useEffect(() => {
    const update = () => setW(window.innerWidth);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return w;
}

export default function App() {
  const [t, setT] = useState(-1);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [mode, setMode] = useState<Mode>('illustrative');
  const [dataset, setDataset] = useState<Dataset>('simple');
  const [style, setStyle] = useState<ChartStyle>('progress');
  const [branch, setBranch] = useState<BranchStyle>('pbi-grouped');
  const [map, setMap] = useState<MapStyle>('money-map');
  const [version, setVersion] = useState<Version>('v2');
  const [dateMode, setDateMode] = useState<DateMode>('date');
  const [carouselMode, setCarouselMode] = useState<CarouselMode>('timeline'); // header carousel: month timeline (default) vs. Paycheck pills
  const [carouselInteraction, setCarouselInteraction] = useState<CarouselInteraction>('scrub'); // timeline interaction: relative drag-scrub (default) vs. tap-to-select a month
  const [incomeRep, setIncomeRep] = useState<IncomeRep>('card'); // income representation: account-style reverse-depleting card (default) vs. paycheck pills
  const [refillVisual, setRefillVisual] = useState(true); // show the Core/Spend monthly refill gradient bars (default ON)
  const [systemView, setSystemView] = useState<'full' | 'monthly'>('full'); // in-prototype Full system vs Monthly split view
  const [transitionAnim, setTransitionAnim] = useState<TransitionAnim>('sections'); // Full↔Monthly morph style: section-band split (default) vs. progress-bar morph
  const [monthlyBg, setMonthlyBg] = useState<MonthlyBg>('teal'); // Monthly Expenses section background: teal (default) vs. blue→green gradient
  // "Onboarding view" (Figma 977:11967 → 12099 → 12246 → 12773): preview the pbi
  // money map inside a mock Fruitful home page. null = normal configurator; 'home'
  // = mock home with the draggable sheet; 'map' = the money map with a compact
  // home-style header + the Full/Monthly toggle pinned to the TOP.
  const [onboard, setOnboard] = useState<null | 'home' | 'map'>(null);
  // onboarding home ⇄ map account-card FLIP
  const [cardGhosts, setCardGhosts] = useState<CardGhost[] | null>(null);
  const [cardPhase, setCardPhase] = useState<'start' | 'end'>('start');
  const [cardReveal, setCardReveal] = useState(false);
  const [cardDir, setCardDir] = useState<'to-map' | 'to-home'>('to-map');
  const pendingCardRef = useRef<{ sources: CardSrc[]; dir: 'to-map' | 'to-home' } | null>(null);
  // ---- drag-driven home→map card morph ----
  // The home page sheet drag reports a 0..1 pull fraction; the account-card ghosts
  // interpolate their position + src→dst crossfade by that fraction (no timer). On
  // release: 'commit' animates the rest of the way to the money map, 'cancel' snaps
  // the ghosts back to the home cards. Targets come from a hidden money-map board
  // (`.morph-measure`) rendered behind the home page while onboarding.
  const [dragGhosts, setDragGhosts] = useState<CardGhost[] | null>(null);
  const [dragProgress, setDragProgress] = useState(0); // 0 = home, 1 = money map
  const [dragRelease, setDragRelease] = useState<null | 'commit' | 'cancel'>(null); // null = tracking the finger (no CSS transition)
  const [dragReveal, setDragReveal] = useState(false); // commit tail: fade the real map cards in / ghosts out
  const dragActiveRef = useRef(false); // guards against rebuilding ghosts on every pointermove
  const boardRef = useRef<HTMLDivElement>(null);
  const pendingMorphRef = useRef<{ sources: MorphMap } | null>(null); // source rects captured just before a view switch
  const [ghosts, setGhosts] = useState<Ghost[] | null>(null); // active morph ghosts (null = idle)
  const [ghostPhase, setGhostPhase] = useState<'start' | 'end'>('start');
  const [morphReveal, setMorphReveal] = useState(false); // tail crossfade: real targets fade in / ghosts fade out
  const [morphDur, setMorphDur] = useState<{ morph: number; reveal: number }>({ morph: MORPH_MS.monthly, reveal: REVEAL_MS.monthly }); // active (direction-aware) durations, fed to CSS vars

  // Measure one side of the Full↔Monthly morph. In "Sections" mode the FULL-system
  // side is measured from the colored section BANDS (Monthly Expenses splits into a
  // blue Core + green Spend half; Goals → the pink column) instead of the progress
  // bars; the Monthly-split side always uses the [data-morph] bars. Falls back to the
  // per-bar morph for styles/gates that have no section bands (so it degrades safely).
  const measureView = (board: HTMLElement, view: 'full' | 'monthly'): MorphMap => {
    if (transitionAnim === 'sections' && view === 'full') {
      const bands = measureSectionBands(board);
      if ((bands.bills && bands.bills.length) || (bands.goals && bands.goals.length)) return bands;
    }
    return measureMorph(board);
  };

  // Toggle Full system <-> Monthly split with a shared-element morph: capture the
  // CURRENT view's source rects synchronously (before the DOM swaps), then let the
  // layout effect below measure the new view and fly the ghosts.
  const switchView = (to: 'full' | 'monthly') => {
    if (to === systemView) return;
    const board = boardRef.current;
    if (board) pendingMorphRef.current = { sources: measureView(board, systemView) };
    setSystemView(to);
  };

  // Onboarding view entry/exit. Entering always starts from the Full-system money
  // map so the home → map hand-off lands on the familiar tree; exiting restores the
  // normal configurator untouched.
  const enterOnboarding = () => {
    setSystemView('full');
    setOnboard('home');
  };
  const exitOnboarding = () => {
    setSystemView('full');
    setOnboard(null);
  };
  // map → home (Back): measure the map cards, then swap back to the home page.
  // Always reset to Full system so a later drag-back re-enters on the full-system map.
  const backToHome = () => {
    const ref = morphContainer();
    const sources = ref ? measureCards(ref) : [];
    pendingCardRef.current = sources.length ? { sources, dir: 'to-home' } : null;
    setSystemView('full');
    setOnboard('home');
  };
  const onboardMap = onboard === 'map'; // money-map screen (compact header + top toggle)
  // the money-map board renders in its compact onboarding form during the whole
  // home flow — both while it sits behind the home page (as the hidden morph-target
  // measurement board) and once the drag hands off to the real map.
  const boardOnboard = onboard !== null;

  // Build the home→map card ghosts from the CURRENT home cards (sources) and the
  // hidden measurement board (targets). Scoped queries so the two card sets never
  // cross-contaminate. Returns null if either side isn't measurable yet.
  const buildDragGhosts = (): CardGhost[] | null => {
    const ref = morphContainer();
    const homeEl = document.querySelector('.home-screen');
    const measEl = document.querySelector('.morph-measure');
    if (!ref || !homeEl || !measEl) return null;
    const sources = measureCards(ref, homeEl);
    const targets = measureCards(ref, measEl);
    const tByRole = new Map(targets.map((t) => [t.role, t]));
    const ghosts: CardGhost[] = [];
    for (const s of sources) {
      const t = tByRole.get(s.role);
      if (!t) continue;
      ghosts.push({ id: s.role, from: s.pt, to: t.pt, srcHtml: s.html, srcW: s.w, srcH: s.h, dstHtml: t.html, dstW: t.w, dstH: t.h });
    }
    return ghosts.length ? ghosts : null;
  };

  // Sheet drag → morph progress. First downward movement builds the ghosts (once);
  // subsequent moves just update the fraction. Dragging back to the top clears it.
  const handleDragProgress = (fraction: number) => {
    if (dragRelease) return; // release animation owns the progress now
    if (fraction <= 0) {
      if (dragActiveRef.current) {
        dragActiveRef.current = false;
        setDragGhosts(null);
        setDragProgress(0);
      }
      return;
    }
    if (!dragActiveRef.current) {
      const g = buildDragGhosts();
      if (!g) return;
      dragActiveRef.current = true;
      setDragGhosts(g);
    }
    // subtle preview only — the drag never completes the morph (see DRAG_PREVIEW_MAX);
    // releasing past the threshold runs the rest of the way in the effect below.
    setDragProgress(dampDragProgress(fraction));
  };

  // Sheet released. Commit → reset to Full system, swap to the real money map, and
  // let the ghosts finish to 100%. Cancel → animate the ghosts back to the home cards.
  const handleDragRelease = (commit: boolean) => {
    // dragActiveRef is a ref set the instant the ghosts are built, so this stays
    // correct even when a fast flick builds the ghosts and crosses the commit
    // threshold within the SAME pointermove tick (the dragGhosts *state* would
    // still read stale/null in this closure, so we must not gate on it here).
    if (!dragActiveRef.current) {
      // no morph engaged (e.g. a tiny nudge or an upward drag) — nothing to finish
      return;
    }
    if (commit) {
      setSystemView('full');
      setOnboard('map');
      setDragRelease('commit');
    } else {
      setDragRelease('cancel');
    }
  };

  // Drive the release animation: enable CSS transitions (dragRelease != null removes
  // the no-transition class), then next frame push progress to its target. Commit
  // reveals the real map cards near arrival; both directions clean up at the end.
  useEffect(() => {
    if (!dragRelease) return;
    const commit = dragRelease === 'commit';
    const raf1 = requestAnimationFrame(() => setDragProgress(commit ? 1 : 0));
    const revealT = commit
      ? window.setTimeout(() => setDragReveal(true), Math.max(0, CARD_MORPH_MS - 160))
      : 0;
    const doneT = window.setTimeout(() => {
      setDragGhosts(null);
      setDragRelease(null);
      setDragReveal(false);
      setDragProgress(0);
      dragActiveRef.current = false;
    }, CARD_MORPH_MS + 60);
    return () => {
      cancelAnimationFrame(raf1);
      if (revealT) window.clearTimeout(revealT);
      window.clearTimeout(doneT);
    };
  }, [dragRelease]);

  // Drive the account-card FLIP after an onboarding home ⇄ map swap. Both the
  // source and target rects are captured in natural coords relative to the same
  // (persistent) phone-screen container, so the translate is exact and the ghost
  // layer lives inside the clipped/scaled device context.
  useLayoutEffect(() => {
    const pending = pendingCardRef.current;
    if (!pending) return;
    pendingCardRef.current = null;
    const ref = morphContainer();
    if (!ref) return;
    // to-home lands on the mock home page's account cards; scope the target query to
    // the home screen so the hidden measurement board's cards are never picked up.
    const targetRoot = (document.querySelector('.home-screen') as ParentNode | null) ?? document;
    const targets = measureCards(ref, targetRoot);
    const tByRole = new Map(targets.map((t) => [t.role, t]));
    const ghosts: CardGhost[] = [];
    for (const s of pending.sources) {
      const t = tByRole.get(s.role);
      if (!t) continue;
      ghosts.push({
        id: s.role,
        from: s.pt,
        to: t.pt,
        srcHtml: s.html,
        srcW: s.w,
        srcH: s.h,
        dstHtml: t.html,
        dstW: t.w,
        dstH: t.h,
      });
    }
    if (!ghosts.length) return;
    setCardDir(pending.dir);
    setCardGhosts(ghosts);
    setCardPhase('start');
    setCardReveal(false);
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setCardPhase('end'));
    });
    const revealT = window.setTimeout(() => setCardReveal(true), Math.max(0, CARD_MORPH_MS - 160));
    const doneT = window.setTimeout(() => {
      setCardGhosts(null);
      setCardReveal(false);
    }, CARD_MORPH_MS + 60);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.clearTimeout(revealT);
      window.clearTimeout(doneT);
    };
  }, [onboard]);

  // After a view switch that captured sources, measure the freshly-rendered target
  // rects, build one ghost per source→target pairing (goals fan-in/out), and drive
  // the FLIP: mount ghosts at the source, then next frame animate them to target.
  useLayoutEffect(() => {
    const pending = pendingMorphRef.current;
    if (!pending) {
      // systemView changed WITHOUT a captured source (a programmatic reset, e.g.
      // onboarding navigation resetting to Full system) — drop any split morph
      // still in flight so no stale ghosts linger on the freshly-shown view.
      setGhosts(null);
      setMorphReveal(false);
      return;
    }
    pendingMorphRef.current = null;
    const board = boardRef.current;
    if (!board) return;
    const targets = measureView(board, systemView);
    const gs: Ghost[] = [];
    for (const role of MORPH_ROLES) {
      const src = pending.sources[role] ?? [];
      const dst = targets[role] ?? [];
      if (!src.length || !dst.length) continue;
      const n = Math.max(src.length, dst.length);
      for (let i = 0; i < n; i++) {
        gs.push({ id: `${role}-${i}`, from: src[Math.min(i, src.length - 1)], to: dst[Math.min(i, dst.length - 1)] });
      }
    }
    if (!gs.length) return;
    // direction-aware timing: `systemView` is the TARGET view, so full = the snappy
    // Monthly split → Full system return, monthly = the calm forward morph.
    const morphMs = MORPH_MS[systemView];
    const revealMs = REVEAL_MS[systemView];
    setMorphDur({ morph: morphMs, reveal: revealMs });
    setGhosts(gs);
    setGhostPhase('start');
    setMorphReveal(false);
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setGhostPhase('end'));
    });
    // begin the crossfade (duration - window) in, so the destination text is already
    // fading in as the pill settles and finishes exactly on arrival — no end pop.
    const reveal = window.setTimeout(() => setMorphReveal(true), Math.max(0, morphMs - revealMs));
    const done = window.setTimeout(() => {
      setGhosts(null);
      setMorphReveal(false);
    }, morphMs + 60);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.clearTimeout(reveal);
      window.clearTimeout(done);
    };
  }, [systemView]);
  const [showOlder, setShowOlder] = useState(false); // reveal the "older ideas" account styles in the picker
  const [showAccountStyles, setShowAccountStyles] = useState(false); // collapse the account-style picker section by default
  const [selectedConvo, setSelectedConvo] = useState<string | null>(null); // "convo" tapped-card detail modal
  const [selectedRect, setSelectedRect] = useState<DOMRect | null>(null); // resting rect of the tapped convo card (for the FLIP morph)
  const [speed, setSpeed] = useState(1); // global pace multiplier (layered on mode pacing)
  const isMobile = useIsMobile();
  const viewportW = useViewportWidth();
  const [configOpen, setConfigOpen] = useState(false); // mobile config drawer
  const raf = useRef(0);
  const lastTick = useRef(0); // perf timestamp of the previous frame
  const elapsedRef = useRef(0); // accumulated sim-seconds (speed-scaled); drives t
  const speedRef = useRef(1); // live mirror of `speed` so the RAF loop reads it without restarting
  const onboardRef = useRef<null | 'home' | 'map'>(null); // live mirror of `onboard` so the RAF loop can bail while onboarding (home/map never auto-play)

  // Onboarding home/map view is STATIC: it must never auto-play (advance the clock
  // on its own). Scrubbing via the header carousel (scrubTo) still works — that
  // stops the loop and parks the sim at the dragged frame. Whenever we enter the
  // home or map view, kill any running loop so a sim that was mid-play in the
  // standard view doesn't keep ticking under the home page.
  useEffect(() => {
    onboardRef.current = onboard;
    if (onboard !== null) {
      cancelAnimationFrame(raf.current);
      setPlaying(false);
    }
  }, [onboard]);

  // Non-stocks account styles are illustrative-only, so force illustrative timing/
  // animation for them. `mode` stays as the raw Time-model toggle source.
  const effMode: Mode = style === 'stocks' ? mode : 'illustrative';
  // Visual identity (like the time model) is only offered for the stocks style;
  // every other account style renders in the Modern ('flow') identity.
  // The stocks V1 and Condensed sub-variants have their OWN fixed look (no
  // visual-identity / gate choice), so they always render in the Modern identity
  // regardless of `map`.
  const isV1 = style === 'stocks' && version === 'v1';
  const isCondensed = style === 'stocks' && version === 'condensed';
  const stocksFixed = isV1 || isCondensed; // V1/Condensed hide identity + gate configs
  const effMap: MapStyle = style === 'stocks' && !stocksFixed ? map : 'flow';

  // live speed change: update the ref the loop reads AND the display state. Because
  // the clock accumulates per-frame deltas (dt * speed), changing this mid-play just
  // changes the rate from here on — the current frame never jumps.
  const changeSpeed = (v: number) => {
    speedRef.current = v;
    setSpeed(v);
  };

  // Drive the shared clock by accumulating speed-scaled per-frame deltas into
  // elapsedRef (sim-seconds). runLoop resets lastTick to "now" on entry, so it
  // works for a fresh play AND a resume-from-frozen-frame without a jump.
  const runLoop = useCallback(() => {
    cancelAnimationFrame(raf.current);
    // Onboarding home/map is static — never auto-advance the clock there (the user
    // scrubs via the carousel instead). Bail out of the play loop entirely.
    if (onboardRef.current !== null) {
      setPlaying(false);
      return;
    }
    const end = endSecs(dataset, effMode); // duration is per dataset + time model
    lastTick.current = performance.now();
    const loop = (p: number) => {
      const dt = (p - lastTick.current) / 1000;
      lastTick.current = p;
      const e = elapsedRef.current + dt * speedRef.current; // global speed multiplier
      if (e >= end) {
        // hold the final frame (all accumulated progress stays) until restarted
        elapsedRef.current = end;
        setT(end);
        setPlaying(false);
        setPaused(false);
        setHasPlayed(true);
        return;
      }
      elapsedRef.current = e;
      setT(e);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  }, [dataset, effMode]);

  // Play from the very beginning (also used for Restart)
  const start = useCallback(() => {
    elapsedRef.current = 0;
    setHasPlayed(false);
    setPaused(false);
    setPlaying(true);
    runLoop();
  }, [runLoop]);

  // Freeze at the current frame without losing progress
  const pause = useCallback(() => {
    cancelAnimationFrame(raf.current);
    setPlaying(false);
    setPaused(true);
  }, []);

  // Resume from the frozen frame — continue from elapsedRef, don't restart
  const resume = useCallback(() => {
    setPaused(false);
    setPlaying(true);
    runLoop();
  }, [runLoop]);

  // switching the dataset reparameterizes the whole scenario, so reset to idle
  const pickDataset = useCallback((d: Dataset) => {
    cancelAnimationFrame(raf.current);
    setDataset(d);
    setSelectedConvo(null);
    setSelectedRect(null);
    setT(-1);
    elapsedRef.current = 0;
    setPlaying(false);
    setPaused(false);
    setHasPlayed(false);
  }, []);

  // switching the stocks Version swaps the whole card/connector geometry, so reset
  const pickVersion = useCallback((v: Version) => {
    cancelAnimationFrame(raf.current);
    setVersion(v);
    setT(-1);
    elapsedRef.current = 0;
    setPlaying(false);
    setPaused(false);
    setHasPlayed(false);
  }, []);

  // switching the time model resets the animation to its idle state
  const pickMode = useCallback((m: Mode) => {
    cancelAnimationFrame(raf.current);
    setMode(m);
    setT(-1);
    elapsedRef.current = 0;
    setPlaying(false);
    setPaused(false);
    setHasPlayed(false);
  }, []);

  // switching the account style can change effMode/endSecs/timing, so reset to idle
  const pickStyle = useCallback((s: ChartStyle) => {
    cancelAnimationFrame(raf.current);
    setStyle(s);
    setSelectedConvo(null);
    setSelectedRect(null);
    // gate pairing: slim + convo cards use ONLY the skinny-line tree; icons offers
    // BOTH the skinny-line ("Bracket", default) and the new labeled spine tree, so
    // keep 'icon-labeled' when it's already picked and default to 'skinny-line'
    // otherwise. Every non-thin style falls back to a valid gate so the thin/
    // labeled trees are never active off the compact icon/slim layouts.
    setBranch((prev) => {
      if (s === 'slim' || s === 'convo') return 'skinny-line';
      if (s === 'icons') return prev === 'icon-labeled' ? 'icon-labeled' : 'skinny-line';
      // sheet + illustrated + grid are self-contained (their own tree): pin a
      // stable, non-compact/non-thin gate so no % badges or foreign tree ever
      // render.
      if (s === 'sheet' || s === 'illo' || s === 'grid' || s === 'pills') return 'text-only';
      // "Progress bar, inside" offers its own pbi gate set; entering it from any
      // other gate (e.g. 'compact' carried over from stocks) falls back to the
      // default "Text gates".
      if (s === 'progress') return prev === 'pbi-grouped' || prev === 'pbi-sectionlabel' || prev === 'pbi-income-section' || prev === 'pbi-split' || prev === 'pbi-indented' || prev === 'pbi-locked' || prev === 'pbi-grouped2' || prev === 'text-only' ? prev : 'pbi-grouped';
      // the pbi-scoped gates are pbi-only: leaving pbi for any other style resets to
      // a valid shared gate so no non-pbi style renders pbi-scoped geometry.
      return prev === 'skinny-line' || prev === 'icon-labeled' || prev === 'pbi-locked' || prev === 'pbi-grouped' || prev === 'pbi-sectionlabel' || prev === 'pbi-income-section' || prev === 'pbi-grouped2' || prev === 'pbi-split' || prev === 'pbi-indented' ? 'text-only' : prev;
    });
    // entering the stocks style auto-selects the V1 sub-variant
    if (s === 'stocks') setVersion('v1');
    setT(-1);
    elapsedRef.current = 0;
    setPlaying(false);
    setPaused(false);
    setHasPlayed(false);
  }, []);

  useEffect(() => {
    return () => cancelAnimationFrame(raf.current);
  }, []);

  // debug: seek to a fixed time (seconds) for inspection
  useEffect(() => {
    (window as unknown as { __seek: (v: number) => void }).__seek = (v: number) => {
      cancelAnimationFrame(raf.current);
      elapsedRef.current = v;
      setT(v);
    };
  }, []);

  // The "Preview" config control is hidden (see onboardToggle), but the onboarding
  // home/map entry points stay live and referenced here — exposed on window so the
  // flow remains reachable programmatically for testing without the visible toggle.
  useEffect(() => {
    (window as unknown as { __preview: { enter: () => void; exit: () => void } }).__preview = {
      enter: enterOnboarding,
      exit: exitOnboarding,
    };
  });

  // Paycheck-carousel scrubber (pbi style): dragging the carousel takes over the
  // clock and parks the sim at the dragged month so the user can watch the goal
  // accounts fill/unfill at any point in time. It stops the RAF loop and leaves
  // the sim PAUSED at that frame, so the Play button resumes from there.
  const scrubTo = useCallback(
    (nowMonths: number) => {
      cancelAnimationFrame(raf.current);
      // HOME flow scrubs a ≥10-month horizon (see scrubSpan); the standard app
      // clamps to the simulated span. onboardRef mirrors `onboard` for the callback.
      const span = onboardRef.current !== null ? Math.max(animMonths(dataset, effMode), 10) : animMonths(dataset, effMode);
      const clamped = Math.max(0, Math.min(nowMonths, span));
      const secs = clamped * monthSecs(effMode);
      elapsedRef.current = secs;
      setT(secs);
      setPlaying(false);
      setPaused(true);
      setHasPlayed(true);
    },
    [dataset, effMode],
  );

  // TAP interaction: tapping a month pill PLAYS the money-flow animation exactly
  // ONCE — a single forward pass of the waterfall / comet / branch-flow fill from
  // the current frame up to the tapped month — then SETTLES (paused) on it. It
  // never loops. If the tapped month is at or before the current frame we rewind
  // to 0 first so a tap always plays a clean forward pass INTO the selection.
  // (Scrub mode is untouched: it keeps using scrubTo, which parks instantly on
  // every drag delta with no auto-play.) User-initiated, so it's allowed even in
  // the otherwise-static home/map flow.
  const playToMonth = useCallback(
    (nowMonths: number) => {
      cancelAnimationFrame(raf.current);
      const span = onboardRef.current !== null ? Math.max(animMonths(dataset, effMode), 10) : animMonths(dataset, effMode);
      const target = Math.max(0, Math.min(nowMonths, span)) * monthSecs(effMode);
      let from = elapsedRef.current;
      if (from >= target - 1e-3) from = 0; // tapped an earlier/equal month → replay from the start
      elapsedRef.current = from;
      setT(from);
      setPlaying(true);
      setPaused(false);
      setHasPlayed(true);
      lastTick.current = performance.now();
      const loop = (p: number) => {
        const dt = (p - lastTick.current) / 1000;
        lastTick.current = p;
        const e = elapsedRef.current + dt * speedRef.current;
        if (e >= target) {
          // arrived: hold the tapped frame, settle paused (Play resumes from here)
          elapsedRef.current = target;
          setT(target);
          setPlaying(false);
          setPaused(true);
          return;
        }
        elapsedRef.current = e;
        setT(e);
        raf.current = requestAnimationFrame(loop);
      };
      raf.current = requestAnimationFrame(loop);
    },
    [dataset, effMode],
  );

  // Scrub horizon (in months). The live sim freezes at animMonths, but the HOME
  // flow is a scrubbable "real app" snapshot, so we expose AT LEAST 10 future
  // months to scrub through there (extending the timeline past the sim end). The
  // standard app is untouched — it always uses the plain simulated span.
  const simSpan = animMonths(dataset, effMode);
  const scrubSpan = boardOnboard ? Math.max(simSpan, 10) : simSpan;
  const now = t < 0 ? 0 : Math.min(t / monthSecs(effMode), scrubSpan);
  const dimmed = dimmedNodes(dataset, effMode, Math.min(now, simSpan));

  // HOME-PAGE flow: the money map mimics a real monthly income WATERFALL as the
  // user scrubs FORWARD in time. Each month behaves like: (1) Core & Spend refill
  // FIRST — we model a wipe-to-0 (never shown) and drive the refill OVERLAY from 0
  // up to full; the overlay LEADS and the true base bar TRAILS it to 100% once the
  // overlay passes the present fill; then (2) the LEFTOVER money fills the goals in
  // the sim's level/weight waterfall order (layer 1 completes, then 2, then 3…).
  // The present month (now = 0) keeps the accurate present fills (Core/Spend ~91%,
  // goals empty). Only used when boardOnboard; the standard app never sees these.
  const HOME_ACCT_MONTHS = 1; // Core/Spend finish refilling within the first month
  // refill overlay 0→1 over the first HOME_ACCT_MONTHS month(s) of scrub.
  const homeRefill = Math.max(0, Math.min(now / HOME_ACCT_MONTHS, 1));
  // base bar = the present fill until the overlay passes it, then it follows the
  // overlay up to 100% (max = "trails the overlay to full").
  const homeAcctBase = (id: 'core' | 'spend') => Math.max(homeAccountFill(id), homeRefill);
  // goals only start once Core/Spend are satisfied (now ≥ HOME_ACCT_MONTHS); goalFrac
  // spans the rest of the scrub horizon so later layers fill as you scrub further.
  const homeGoalFrac = scrubSpan > HOME_ACCT_MONTHS ? Math.max(0, Math.min((now - HOME_ACCT_MONTHS) / (scrubSpan - HOME_ACCT_MONTHS), 1)) : 0;
  const homeGoalFills = homeGoalFill(dataset, homeGoalFrac);
  const homeProgressNow: Record<string, number> = { ...homeGoalFills, core: homeAcctBase('core'), spend: homeAcctBase('spend') };
  const homeAmountsNow: Record<string, string> = { ...HOME_BALANCES, core: homeAccountAmount('core', homeAcctBase('core')), spend: homeAccountAmount('spend', homeAcctBase('spend')) };
  // the scrub-driven refill overlay width for the two account bars (same lead value).
  const homeRefillNow: Record<string, number> = { core: homeRefill, spend: homeRefill };

  // dataset-aware card + percent-badge sets (layout positions stay identical)
  const cards = cardsFor(dataset);
  const percentBadges = badgesFor(dataset);
  const selectedNode = selectedConvo ? cards.find((c) => c.id === selectedConvo) ?? null : null;

  // gate options depend on the account style: "skinny line" is offered ONLY for
  // the slim card (and is the only gate there); all other styles keep text-only
  // + "Lines with %".
  const gateOptions =
    style === 'icons'
      ? ICON_BRANCHES
      : style === 'slim' || style === 'convo'
        ? SLIM_BRANCHES
        : style === 'progress'
          ? PBI_BRANCHES
          : BRANCHES;

  // Shared config fields (data type → time model). Rendered in BOTH the desktop
  // left rail and the mobile config drawer so the markup is authored once.
  const configFields = (
    <>
      <div className="config-head">
        <h1 className="config-title">Artifact configs</h1>
        <p className="config-updated">Last updated Jul 16, 2026 · 2:37 PM</p>
      </div>
      <div className="config-row">
        <span className="config-label">Data type</span>
          <div className="mode-toggle" role="tablist" aria-label="Data type">
            {DATASET_OPTS.map((d) => (
              <button
                key={d.id}
                role="tab"
                aria-selected={dataset === d.id}
                className={`mode-opt${dataset === d.id ? ' active' : ''}`}
                onClick={() => pickDataset(d.id)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <div className="config-row">
          <button
            type="button"
            className="config-collapse-btn"
            aria-expanded={showAccountStyles}
            onClick={() => setShowAccountStyles((v) => !v)}
          >
            <span className="config-label">Account style</span>
            <span className="config-collapse-cta">{showAccountStyles ? 'Hide account styles' : 'Show account styles'}</span>
          </button>
          {showAccountStyles && (
            <>
              <div className="style-picker" role="radiogroup" aria-label="Account style">
                {STYLES.filter((s) => !s.older || showOlder).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={style === s.id}
                    className={`style-tile${style === s.id ? ' active' : ''}`}
                    onClick={() => pickStyle(s.id)}
                  >
                    <span className="style-preview">
                      <StylePreview id={s.id} />
                    </span>
                    <span className="style-tile-label">{s.label}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="view-older-link"
                aria-expanded={showOlder}
                onClick={() => setShowOlder((v) => !v)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '8px 0 0',
                  margin: 0,
                  color: '#7d7d7d',
                  font: 'inherit',
                  fontSize: 12,
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  alignSelf: 'flex-start',
                }}
              >
                {showOlder ? 'Hide older ideas' : 'View older ideas'}
              </button>
            </>
          )}
        </div>
        {style === 'stocks' && (
          <div className="config-row">
            <span className="config-label">Version</span>
            <div className="mode-toggle" role="tablist" aria-label="Version">
              {VERSION_OPTS.map((v) => (
                <button
                  key={v.id}
                  role="tab"
                  aria-selected={version === v.id}
                  className={`mode-opt${version === v.id ? ' active' : ''}`}
                  onClick={() => pickVersion(v.id)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="config-row">
          <span className="config-label">Goal representation</span>
          <div className="mode-toggle" role="tablist" aria-label="Goal representation">
            {DATE_OPTS.map((d) => (
              <button
                key={d.id}
                role="tab"
                aria-selected={dateMode === d.id}
                className={`mode-opt${dateMode === d.id ? ' active' : ''}`}
                onClick={() => setDateMode(d.id)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <div className="config-row">
          <span className="config-label">Header carousel</span>
          <div className="mode-toggle" role="tablist" aria-label="Header carousel">
            {CAROUSEL_OPTS.map((c) => (
              <button
                key={c.id}
                role="tab"
                aria-selected={carouselMode === c.id}
                className={`mode-opt${carouselMode === c.id ? ' active' : ''}`}
                onClick={() => setCarouselMode(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div className="config-row">
          <span className="config-label">Timeline interaction</span>
          <div className="mode-toggle" role="tablist" aria-label="Timeline interaction">
            {INTERACTION_OPTS.map((o) => (
              <button
                key={o.id}
                role="tab"
                aria-selected={carouselInteraction === o.id}
                className={`mode-opt${carouselInteraction === o.id ? ' active' : ''}`}
                onClick={() => setCarouselInteraction(o.id)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="config-row">
          <span className="config-label">Core/Spend refill visual</span>
          <div className="mode-toggle" role="tablist" aria-label="Core/Spend refill visual">
            <button
              role="tab"
              aria-selected={refillVisual}
              className={`mode-opt${refillVisual ? ' active' : ''}`}
              onClick={() => setRefillVisual(true)}
            >
              On
            </button>
            <button
              role="tab"
              aria-selected={!refillVisual}
              className={`mode-opt${!refillVisual ? ' active' : ''}`}
              onClick={() => setRefillVisual(false)}
            >
              Off
            </button>
          </div>
        </div>
        {style === 'progress' && (
          <div className="config-row">
            <span className="config-label">Income</span>
            <div className="mode-toggle" role="tablist" aria-label="Income representation">
              {INCOME_OPTS.map((o) => (
                <button
                  key={o.id}
                  role="tab"
                  aria-selected={incomeRep === o.id}
                  className={`mode-opt${incomeRep === o.id ? ' active' : ''}`}
                  onClick={() => setIncomeRep(o.id)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* How the Full system → Monthly split morph plays. Offered on the styles that
            expose the Monthly-split toggle (progress / pills). "Sections" (default)
            morphs the colored section bands into the split columns; "Progress bars"
            keeps the original per-bar morph. */}
        {(style === 'progress' || style === 'pills') && (
          <div className="config-row">
            <span className="config-label">Transition animation</span>
            <div className="mode-toggle" role="tablist" aria-label="Transition animation">
              {TRANSITION_OPTS.map((o) => (
                <button
                  key={o.id}
                  role="tab"
                  aria-selected={transitionAnim === o.id}
                  className={`mode-opt${transitionAnim === o.id ? ' active' : ''}`}
                  onClick={() => setTransitionAnim(o.id)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Monthly Expenses section background color (progress style). Teal (current)
            vs. the blue→green gradient per Figma 1054:12173. */}
        {style === 'progress' && (
          <div className="config-row">
            <span className="config-label">Monthly Expenses color</span>
            <div className="mode-toggle" role="tablist" aria-label="Monthly Expenses color">
              {MONTHLY_BG_OPTS.map((o) => (
                <button
                  key={o.id}
                  role="tab"
                  aria-selected={monthlyBg === o.id}
                  className={`mode-opt${monthlyBg === o.id ? ' active' : ''}`}
                  onClick={() => setMonthlyBg(o.id)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Gate-style picker is HIDDEN from the panel (same as the Preview control):
            the underlying `branch` state + its default (pbi-grouped) stay intact and
            drive the tree, but the selector is no longer rendered/selectable. */}
        {false && !stocksFixed && style !== 'sheet' && style !== 'illo' && style !== 'grid' && style !== 'pills' && (
        <div className="config-row">
          <span className="config-label">Gate style</span>
            <div className="mode-toggle" role="tablist" aria-label="Gate style">
              {gateOptions.map((b) => (
                <button
                  key={b.id}
                  role="tab"
                  aria-selected={branch === b.id}
                  className={`mode-opt${branch === b.id ? ' active' : ''}`}
                  onClick={() => setBranch(b.id)}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {style === 'stocks' && !stocksFixed && (
          <div className="config-row">
            <span className="config-label">Visual identity</span>
            <div className="mode-toggle" role="tablist" aria-label="Visual identity">
              {MAPS.map((m) => (
                <button
                  key={m.id}
                  role="tab"
                  aria-selected={map === m.id}
                  className={`mode-opt${map === m.id ? ' active' : ''}`}
                  onClick={() => setMap(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {style === 'stocks' && (
          <div className="config-row">
            <span className="config-label">Time model</span>
            <div className="mode-toggle" role="tablist" aria-label="Time model">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  role="tab"
                  aria-selected={mode === m.id}
                  className={`mode-opt${mode === m.id ? ' active' : ''}`}
                  onClick={() => pickMode(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}
    </>
  );

  // Speed slider — its own fragment so desktop keeps it inside `.config-extras`
  // (with the controls) while the mobile drawer shows it without the controls.
  const speedField = (
    <div className="config-row">
      <span className="config-label">Speed · {speed.toFixed(2)}x</span>
      <input
        className="speed-slider"
        type="range"
        min={0.25}
        max={3}
        step={0.05}
        value={speed}
        aria-label="Playback speed"
        onChange={(e) => changeSpeed(Number(e.target.value))}
      />
    </div>
  );

  // Play / Pause / Restart buttons — shared by the desktop `.controls` block and
  // the mobile floating pill group (same handlers + state).
  const renderControls = () =>
    playing ? (
      <button className="ctrl-btn" onClick={pause}>
        ❚❚ Pause
      </button>
    ) : paused ? (
      <>
        <button className="ctrl-btn primary" onClick={resume}>
          ▶ Play
        </button>
        <button className="ctrl-btn" onClick={start}>
          ↻ Restart
        </button>
      </>
    ) : hasPlayed ? (
      <button className="ctrl-btn" onClick={start}>
        ↻ Restart
      </button>
    ) : (
      <button className="ctrl-btn primary" onClick={start}>
        ▶ Play events
      </button>
    );

  // The money-map prototype itself (a 402-wide coordinate space). Rendered inside
  // the phone bezel on desktop and full-screen on mobile — identical props.
  // Optimizer appends two extra goals below Simple's shared rows, so its board
  // grows taller (the Simple board stays 960). The `.screen-scroll` container
  // scrolls to reach the appended goals past the 874px phone screen.
  // The Optimizer's card styles grow the board to a 1200px tall scroll-board to
  // fit its appended goals — but the minimalist "icons" style uses a COMPACT row
  // rhythm whose 8 rows fit the 874px screen, so it stays on the 960px board for
  // both datasets (no tall-board rule).
  // Progress (pbi) tree tightened to an 84px card pitch, so its content ends higher
  // — give it its own trimmed board height (was on the shared 960/1200) while every
  // other style keeps the generous shared height.
  const boardH = style === 'pills' ? pillsLayoutFor(dataset).height : style === 'progress' ? (dataset === 'optimizer' ? 1148 : 924) : dataset === 'optimizer' && style !== 'icons' ? 1200 : 960;
  const openConvo = (id: string, rect: DOMRect) => {
    setSelectedRect(rect);
    setSelectedConvo(id);
  };
  const closeConvo = () => {
    setSelectedConvo(null);
    setSelectedRect(null);
  };
  // "Minimalist icons" hero (Figma 773:8879): sprout logo · subtitle · large serif
  // headline whose date derives from the dataset's milestone goal. The footer pill
  // sits near the screen bottom for Simple, and drops below the taller Optimizer
  // row stack so it never overlaps the last row.
  const iconFooterTop = dataset === 'optimizer' ? 877 : 828;
  // Every artifact carries the SAME header: the "Money Map is ready!" hero +
  // the paycheck-scrubber carousel (ArtifactHeader). The carousel acts as the
  // income element, so each style's own income node is suppressed (hideIncome)
  // and its prototype is shifted DOWN by `treeShift` so nothing overlaps the
  // header. Icons uses the header only in its default "skinny-line" gate (the
  // "Labeled" gate has its own top-center income header).
  const usesHeader =
    style === 'progress' ||
    style === 'pots' ||
    style === 'grid' ||
    style === 'stocks' ||
    style === 'illo' ||
    (style === 'icons' && branch === 'skinny-line');
  // Per-style downward shift so the prototype clears the hero + carousel. Styles
  // that already reserved header space (pbi/icons/grid) need ~none; styles whose
  // content led at the very top (stocks, illustrated) shift the most; pots nudges
  // down so its first pot clears the carousel.
  const TREE_SHIFT: Partial<Record<ChartStyle, number>> = {
    stocks: 190,
    illo: 175,
    pots: 44,
  };
  // "Account-style card" income mode renders a full income CARD in the income slot
  // (pbi only), so push the tree down to clear it (the thin pill row needs no shift).
  const usesIncomeCard = style === 'progress' && incomeRep === 'card';
  const INCOME_CARD_SHIFT = 60;
  // The Full system / Monthly split toggle sits right under the hero header and now
  // SCROLLS WITH the board (see .msplit-toggle: position:absolute). On the styles
  // that show it, push the full-system content (carousel + tree) down so it clears
  // the toggle by ~8px. TOGGLE_SHIFT is kept in sync with the carousel's translateY
  // (.board--toptoggle .pbi-income-row) so the carousel and tree move together.
  const showsTopToggle = (style === 'progress' || style === 'pills') && !boardOnboard;
  const TOGGLE_SHIFT = 35;
  const treeShift =
    (usesHeader ? TREE_SHIFT[style] ?? 0 : 0) +
    (usesIncomeCard ? INCOME_CARD_SHIFT : 0) +
    (showsTopToggle ? TOGGLE_SHIFT : 0);
  // Center the ACTIVE (leftmost, yellow) carousel pill directly over the tree's
  // main vertical spine so the income visually flows down from under the active
  // month. The active pill sits at the row's left edge, so its center = left +
  // half-pill; solving for left = spineX − halfPill. The pbi spine sits at board
  // x≈50 for both datasets, and the pill is 76px wide → left = 50 − 38 = 12.
  // (Was a flat PBI_INCOME_LEFT=16, which nudged the pill a few px right of the
  // spine / made it hug the device's left edge.) No per-gate shift, so it never
  // clips on the Gradient gate.
  const CAROUSEL_SPINE_X = 50; // pbi main spine x (board coords), same across datasets
  const CAROUSEL_PILL_HALF = 38; // half of the 76px carousel pill
  const headerIncomeLeft = CAROUSEL_SPINE_X - CAROUSEL_PILL_HALF;
  // in-prototype "Monthly split" simplified view (Figma 907:13144) — offered on
  // the Progress-bar-inside style via the on-screen Full system / Monthly split
  // toggle. Replaces the tree with a single take-home-pay → Bills/Spend/Goals split.
  const monthlyView = (style === 'progress' || style === 'pills') && systemView === 'monthly';
  const MSPLIT_H = 860;
  const boardEl = (
    <div ref={boardRef} className={`board${style === 'convo' ? ' board-convo' : ''}${style === 'illo' ? ' board-illo' : ''}${style === 'icons' ? ' board-icons' : ''}${style === 'progress' ? ' board-pbi' : ''}${style === 'pills' ? ' board-pills' : ''}${style === 'pots' ? ' board-pots' : ''}${style === 'grid' ? ' board-grid' : ''}${boardOnboard ? ' board--onboard' : ''}${showsTopToggle ? ' board--toptoggle' : ''}${monthlyBg === 'gradient' ? ' board--monthly-gradient' : ''}${dragRelease === 'commit' ? ' cards-morphing' : ''}${dragRelease === 'commit' && dragReveal ? ' cards-reveal' : ''}${ghosts ? ' is-morphing' : ''}${morphReveal ? ' morph-reveal' : ''}`} style={{ height: monthlyView ? MSPLIT_H : boardH + treeShift, ['--morph-ms' as string]: `${morphDur.morph}ms`, ['--reveal-ms' as string]: `${morphDur.reveal}ms` } as CSSProperties}>
      {/* Onboarding money-map screen (Figma 977:12246): compact home-style top bar
          — back (→ home) · "Money Map" · Done (→ exit) — replacing the big hero. */}
      {onboardMap && (
        <div className="onboard-topbar">
          <button className="onboard-back" aria-label="Back" onClick={backToHome}>
            <ArrowLeft size={20} strokeWidth={2.2} />
          </button>
          <span className="onboard-title">Money Map</span>
          <button className="onboard-done" onClick={exitOnboarding}>Done</button>
        </div>
      )}
      {/* in-prototype view toggle (Figma 907:13144): swap the full tree for the
          simplified Monthly split. Offered on the Progress-bar-inside + Pills styles.
          In the onboarding money map it is pinned to the TOP (977:12246/12773). */}
      {(style === 'progress' || style === 'pills') && (
        <div className={`msplit-toggle${boardOnboard ? ' msplit-toggle--top' : ''}`}>
          <button className={systemView === 'full' ? 'active' : ''} onClick={() => switchView('full')}>Full system</button>
          <button className={systemView === 'monthly' ? 'active' : ''} onClick={() => switchView('monthly')}>Monthly split</button>
        </div>
      )}

      {/* shared-element morph ghosts: colored rects flying source→target */}
      {ghosts && (
        <div className="msplit-morph-layer">
          {ghosts.map((g) => {
            const r = ghostPhase === 'start' ? g.from : g.to;
            return (
              <div
                key={g.id}
                className="msplit-ghost"
                style={{
                  left: r.left,
                  top: r.top,
                  width: r.width,
                  height: r.height,
                  borderRadius: r.radius,
                  background: ghostPhase === 'start' ? g.from.color : g.to.color,
                }}
              />
            );
          })}
        </div>
      )}

      {monthlyView && <MonthlySplit dataset={dataset} onboarding={onboardMap} />}

      {/* the SHARED header (hero + paycheck-scrubber carousel) sits at the very
          top of every artifact, OUTSIDE the shifted tree so it never moves. The
          carousel is the income element (each style's income node is hidden). */}
      {!monthlyView && usesHeader && (
        <ArtifactHeader dataset={dataset} mode={effMode} now={now} onScrub={carouselInteraction === 'tap' ? playToMonth : scrubTo} incomeLeft={headerIncomeLeft} carouselMode={carouselMode} interaction={carouselInteraction} incomeRep={style === 'progress' ? incomeRep : 'pills'} onboarding={boardOnboard} />
      )}

      {/* the prototype tree, shifted DOWN so it clears the header */}
      {!monthlyView && style === 'pills' && (
      <div className="tree-shift">
        <PillsBoard dataset={dataset} now={now} mode={effMode} dateMode={dateMode} />
      </div>
      )}

      {!monthlyView && style !== 'pills' && (
      <div className="tree-shift" style={treeShift ? { transform: `translateY(${treeShift}px)` } : undefined}>
        {/* Locked-path (pbi-only) soft vertical gold→green→pink gradient behind the
            tree; scoped to this gate so no other gate/style is tinted. */}
        {style === 'progress' && branch === 'pbi-locked' && <div className="pbi-locked-bg" style={{ height: Math.max(0, boardH - 280) }} />}
        {/* Grouped (pbi-only) colored section panels behind the cards/branches. */}
        {style === 'progress' && branch === 'pbi-grouped' && <PbiGroupedPanels dataset={dataset} />}
        {/* "Account-style card" income mode: a YELLOW section band behind the
            Direct-deposit income card (Figma 1054:10928), matching the Monthly/Goals
            bands. Sits BEHIND the connectors + cards; ends just above the mint panel. */}
        {usesIncomeCard && (
          <div
            className="pbi-grouped-panel pbi-grouped-panel--yellow"
            data-morph-band="income"
            style={{ left: 8, top: PBI_INCOME_CARD_TOP - 10, width: 386, height: 88 }}
          />
        )}
        {/* Section plus label (pbi-only): same teal/pink panels, WITH top-left section labels. */}
        {style === 'progress' && branch === 'pbi-sectionlabel' && <PbiSectionLabelPanels dataset={dataset} />}
        {/* Sections incl. income (pbi-only): In-sections panels PLUS a yellow Income band. */}
        {style === 'progress' && branch === 'pbi-income-section' && <PbiIncomeSectionPanels dataset={dataset} />}
        {/* Grouped 2 (pbi-only) GRAY section panels behind the cards/branches. */}
        {style === 'progress' && branch === 'pbi-grouped2' && <PbiGrouped2Panels dataset={dataset} />}
        {/* "Indented" (pbi-only) faint graph-paper the square tree rides on. */}
        {style === 'progress' && branch === 'pbi-indented' && <div className="pbi-indented-grid" />}
        {/* "Section split" (pbi-only) dashed rules dividing Monthly from Goals. */}
        {style === 'progress' && branch === 'pbi-split' && pbiSplitDividersFor(dataset).map((y, i) => (
          <div key={`split-${i}`} className="pbi-split-divider" style={{ top: y }} />
        ))}
        {/* "grid" faint graph-paper background behind the tree + cards (grid-scoped). */}
        {style === 'grid' && <div className="grid-paper" />}
        <Connectors now={now} mode={effMode} dataset={dataset} branch={branch} map={effMap} v1={isV1} condensed={isCondensed} pillIncome={style === 'progress-pill'} iconTree={style === 'icons'} convoTree={style === 'convo'} sheetTree={style === 'sheet'} illoTree={style === 'illo'} pbiTree={style === 'progress'} potsTree={style === 'pots'} gridTree={style === 'grid'} incomeCard={usesIncomeCard} />

        {/* "Account-style card" income mode: the Direct-deposit income card is a
            real tree node in the card column that FEEDS the income gate via the
            reversed feeder branch (rendered by Connectors). */}
        {usesIncomeCard && (
          <IncomeAccountCard dataset={dataset} mode={effMode} now={now} top={PBI_INCOME_CARD_TOP} onboarding={boardOnboard} />
        )}

        {style === 'icons' && branch === 'skinny-line' && (
          <div className="icon-footer" style={{ top: iconFooterTop }}>
            fruitful.com
          </div>
        )}

        {/* "sheet" renders its own grouped panels + on-connector pills instead of the
            shared section-node gate labels */}
        {style === 'sheet' && <SheetChrome dataset={dataset} now={now} mode={effMode} />}

        {/* "illustrated" renders the green-bordered Fruitful root circle on the spine */}
        {style === 'illo' && <IlloCircle />}

        {style !== 'sheet' && style !== 'grid' && sectionsFor(dataset).map((s) => (
          <SectionNodeView key={s.id} node={s} dimmed={dimmed.has(s.id)} dataset={dataset} branch={branch} map={effMap} v1={isV1} condensed={isCondensed} convo={style === 'convo'} illo={style === 'illo'} pbi={style === 'progress'} pots={style === 'pots'} />
        ))}

        {/* "Account-style card" income mode: the INCOME gate label pill on the spine
            (Figma 1054:10928), rendered like the Monthly/Goals gate pills so the
            feeder branch reads as flowing into a proper income gate. */}
        {usesIncomeCard && (
          <div className="node section-pill-node" style={{ left: 50, top: PBI_INCOME_GATE_Y - 11 }}>
            <div className="pbi-gate">Income</div>
          </div>
        )}

        {cards.map((c) => (
          <Card key={c.id} node={c} now={now} mode={effMode} dataset={dataset} style={style} cardStyle="standard" titleVariant="date" map={effMap} dimmed={dimmed.has(c.id)} v1={isV1} condensed={isCondensed} dateMode={dateMode} iconLabeled={style === 'icons' && branch === 'icon-labeled'} pbiGrouped={style === 'progress' && (branch === 'pbi-grouped' || branch === 'pbi-grouped2')} pbiLocked={style === 'progress' && branch === 'pbi-locked'} onConvoTap={style === 'convo' || style === 'illo' ? openConvo : undefined} modalCardId={style === 'convo' || style === 'illo' ? selectedConvo : null} hideIncome={usesHeader} refillVisual={style === 'progress' && refillVisual} amountOverride={boardOnboard ? homeAmountsNow : undefined} progressOverride={boardOnboard ? homeProgressNow : undefined} refillOverride={boardOnboard ? homeRefillNow : undefined} />
        ))}

        {!stocksFixed && branch === 'compact' && style !== 'pots' &&
          percentBadges.map((b) => (
            <div key={b.id} className={`node${dimmed.has(b.id) ? ' dimmed' : ''}`} style={{ left: b.x, top: b.y, zIndex: 6 }}>
              <div className="pct-badge">{b.text}</div>
            </div>
          ))}
      </div>
      )}

      {/* Conversational keeps its bottom "About your {name}" sheet (ConvoModal);
          Illustrated gets its OWN centered card + shared-element illustration
          grow (IlloModal). selectedRect for illo is the tapped card's small
          illustration rect (the FLIP source). */}
      {style === 'convo' && selectedNode && (
        <ConvoModal
          node={selectedNode}
          now={now}
          mode={effMode}
          dataset={dataset}
          dateMode={dateMode}
          restRect={selectedRect}
          onDismiss={closeConvo}
        />
      )}
      {style === 'illo' && selectedNode && (
        <IlloModal node={selectedNode} restRect={selectedRect} onDismiss={closeConvo} />
      )}
    </div>
  );

  // Onboarding renders the mock Fruitful home page ('home') or the money-map screen
  // ('map', which is just the boardEl in its board--onboard variant). Otherwise the
  // normal board is shown untouched.
  const screenEl =
    onboard === 'home' ? (
      <>
        <HomeScreen
          dataset={dataset}
          onDragProgress={handleDragProgress}
          onDragRelease={handleDragRelease}
          onExit={exitOnboarding}
          cardsHidden={dragGhosts !== null || (!!cardGhosts && cardDir === 'to-home')}
          cardsReveal={cardReveal}
        />
        {/* hidden money-map board behind the home page: its account cards are the
            live morph TARGETS while the sheet is dragged. Never shown (visibility:
            hidden); the real map mounts only once the drag commits. */}
        <div className="morph-measure" aria-hidden>{boardEl}</div>
      </>
    ) : (
      boardEl
    );

  // FLIP ghost layer for the home ⇄ map account-card morph — rendered INSIDE the
  // scaled/clipped device context (so it inherits the phone scale and is clipped to
  // the phone bounds). Each ghost only TRANSLATES from source→target position; the
  // size change is conveyed by crossfading a natural-size SOURCE clone into a
  // natural-size TARGET clone, so the card text is never non-uniformly scaled.
  const cardMorphLayer = cardGhosts ? (
    <div
      className={`cardmorph-layer${cardPhase === 'end' ? ' is-playing' : ''}${cardReveal ? ' is-reveal' : ''}`}
      style={{ ['--card-ms' as string]: `${CARD_MORPH_MS}ms` } as CSSProperties}
    >
      {cardGhosts.map((g) => {
        // t drives the whole morph: start → 0 (frame = big src card), end → 1
        // (frame = small dst card). CSS transitions tween every property.
        const t = cardPhase === 'end' ? 1 : 0;
        const s = cardMorphFrame(g, t);
        return (
          <div key={g.id} className="cardmorph-ghost" style={s.ghost}>
            <div
              className="cardmorph-face cardmorph-face--src"
              style={s.src}
              dangerouslySetInnerHTML={{ __html: g.srcHtml }}
            />
            <div
              className="cardmorph-face cardmorph-face--dst"
              style={s.dst}
              dangerouslySetInnerHTML={{ __html: g.dstHtml }}
            />
          </div>
        );
      })}
    </div>
  ) : null;

  // Drag-driven home→map ghost layer. Same clone-crossfade ghosts as the timer
  // morph, but position + crossfade are interpolated by `dragProgress` (the sheet
  // pull). While tracking the finger (dragRelease === null) transitions are OFF so
  // it follows exactly; on release the class flips and the ghosts ease to 0 or 1.
  const dragMorphLayer = dragGhosts ? (
    <div
      className={`cardmorph-layer${dragRelease === null ? ' cardmorph-layer--drag' : ''}${dragReveal ? ' is-reveal' : ''}`}
      style={{ ['--card-ms' as string]: `${CARD_MORPH_MS}ms` } as CSSProperties}
    >
      {dragGhosts.map((g) => {
        // the sheet pull (dragProgress) drives the frame scale + position + crossfade
        // directly; on release the class flips and CSS tweens to 0 or 1.
        const s = cardMorphFrame(g, dragProgress);
        return (
          <div key={g.id} className="cardmorph-ghost" style={s.ghost}>
            <div
              className="cardmorph-face cardmorph-face--src"
              style={s.src}
              dangerouslySetInnerHTML={{ __html: g.srcHtml }}
            />
            <div
              className="cardmorph-face cardmorph-face--dst"
              style={s.dst}
              dangerouslySetInnerHTML={{ __html: g.dstHtml }}
            />
          </div>
        );
      })}
    </div>
  ) : null;

  // "Preview" toggle (Progress-bar style only) — a direct segmented switch between
  // the mock Fruitful HOME PAGE and the standard/original MONEY MAP view (the "OG
  // view"). Sits at the bottom of the action buttons. The home page's drag-to-open
  // + card morph still works independently; this toggle is just a direct flip.
  // Note: the drag hand-off opens the compact onboarding map ('map'); the toggle's
  // "Onboarding" option is the original standard money-map view (onboard = null).
  // The "Preview" (Onboarding | Home page) config control is intentionally HIDDEN
  // from the panel (per request) — but all of its state + behavior is preserved.
  // The home-page flow is still reachable via the drag-to-open card morph, and the
  // enter/exit entry points remain wired (exposed on window for programmatic/test
  // access so the machinery stays live and referenced).
  const onboardToggle = null;

  // ---- MOBILE: full-screen board + floating controls + config drawer ----
  if (isMobile) {
    const scale = viewportW / SCREEN_W;
    return (
      <div className="stage is-mobile">
        <div className="board-fill">
          <div
            className="board-scaler"
            style={{ width: SCREEN_W, transform: `scale(${scale})`, transformOrigin: 'top left' }}
          >
            {screenEl}
            {cardMorphLayer}
            {dragMorphLayer}
          </div>
        </div>

        <div className="mobile-controls">
          <div className="mobile-pills">{renderControls()}</div>
          <button
            type="button"
            className="mobile-menu-btn"
            aria-label="Open configs"
            aria-expanded={configOpen}
            onClick={() => setConfigOpen((o) => !o)}
          >
            <SlidersHorizontal size={22} strokeWidth={2.2} />
          </button>
        </div>

        <div className={`config-drawer${configOpen ? ' open' : ''}`}>
          <div className="drawer-backdrop" onClick={() => setConfigOpen(false)} />
          <div className="drawer-sheet" role="dialog" aria-modal="true" aria-label="Artifact configs">
            <div className="drawer-grip" />
            <button
              type="button"
              className="drawer-close"
              aria-label="Close configs"
              onClick={() => setConfigOpen(false)}
            >
              <X size={20} strokeWidth={2.2} />
            </button>
            <div className="drawer-body">
              {configFields}
              <div className="config-extras">{speedField}{onboardToggle}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- DESKTOP: unchanged left config rail + phone bezel ----
  return (
    <div className="stage">
      <div className="config-bar">
        {configFields}
        <div className="config-extras">
          {speedField}
          <div className="controls">{renderControls()}</div>
          {onboardToggle}
        </div>
      </div>

      <Device overlay={<>{cardMorphLayer}{dragMorphLayer}</>}>{screenEl}</Device>
    </div>
  );
}
