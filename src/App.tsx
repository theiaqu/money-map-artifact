import { useCallback, useEffect, useRef, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import Card, { ArtifactHeader, PbiGroupedPanels, PbiGrouped2Panels } from './components/Card';
import SectionNodeView from './components/SectionNodeView';
import Connectors from './components/Connectors';
import ConvoModal from './components/ConvoModal';
import IlloModal from './components/IlloModal';
import { SheetChrome } from './components/SheetCard';
import { IlloCircle } from './components/IlloCard';
import Device, { SCREEN_W } from './components/Device';
import { cardsFor, sectionsFor, badgesFor, PBI_INCOME_LEFT, type BranchStyle, type MapStyle } from './data';
import type { ChartStyle } from './components/Card';
import { animMonths, endSecs, monthSecs, dimmedNodes, type Dataset, type Mode, type DateMode } from './scenario';

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
  { id: 'icons', label: 'Minimalist icons' },
  { id: 'illo', label: 'Illustrated' },
  { id: 'stocks', label: 'Stocks / heart monitor' },
  { id: 'pots', label: 'Pots' },
  { id: 'grid', label: 'Grid' },
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
  { id: 'text-only', label: 'Text gates' },
  { id: 'pbi-grouped', label: 'Text gates + backgrounds' },
  { id: 'pbi-indented', label: 'Indented' },
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
  const [branch, setBranch] = useState<BranchStyle>('text-only');
  const [map, setMap] = useState<MapStyle>('money-map');
  const [version, setVersion] = useState<Version>('v2');
  const [dateMode, setDateMode] = useState<DateMode>('date');
  const [showOlder, setShowOlder] = useState(false); // reveal the "older ideas" account styles in the picker
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
      if (s === 'sheet' || s === 'illo' || s === 'grid') return 'text-only';
      // "Progress bar, inside" offers only text-only / pbi-grouped / pbi-indented, so
      // entering it from any other gate (e.g. 'compact' carried over from stocks)
      // falls back to a valid pbi gate (default "Text gates").
      if (s === 'progress') return prev === 'pbi-grouped' || prev === 'pbi-indented' || prev === 'text-only' ? prev : 'text-only';
      // the pbi-scoped gates are pbi-only: leaving pbi for any other style resets to
      // a valid shared gate so no non-pbi style renders pbi-scoped geometry.
      return prev === 'skinny-line' || prev === 'icon-labeled' || prev === 'pbi-locked' || prev === 'pbi-grouped' || prev === 'pbi-grouped2' || prev === 'pbi-indented' ? 'text-only' : prev;
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

  // Paycheck-carousel scrubber (pbi style): dragging the carousel takes over the
  // clock and parks the sim at the dragged month so the user can watch the goal
  // accounts fill/unfill at any point in time. It stops the RAF loop and leaves
  // the sim PAUSED at that frame, so the Play button resumes from there.
  const scrubTo = useCallback(
    (nowMonths: number) => {
      cancelAnimationFrame(raf.current);
      const clamped = Math.max(0, Math.min(nowMonths, animMonths(dataset, effMode)));
      const secs = clamped * monthSecs(effMode);
      elapsedRef.current = secs;
      setT(secs);
      setPlaying(false);
      setPaused(true);
      setHasPlayed(true);
    },
    [dataset, effMode],
  );

  const now = t < 0 ? 0 : Math.min(t / monthSecs(effMode), animMonths(dataset, effMode));
  const dimmed = dimmedNodes(dataset, effMode, now);

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
          <span className="config-label">Account style</span>
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
        {!stocksFixed && style !== 'sheet' && style !== 'illo' && style !== 'grid' && (
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
  const boardH = dataset === 'optimizer' && style !== 'icons' ? 1200 : 960;
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
  const treeShift = usesHeader ? TREE_SHIFT[style] ?? 0 : 0;
  // the paycheck carousel always spans the full device width (left-anchored at
  // PBI_INCOME_LEFT); no per-gate shift, so it never clips on the Gradient gate.
  const headerIncomeLeft = PBI_INCOME_LEFT;
  const boardEl = (
    <div className={`board${style === 'convo' ? ' board-convo' : ''}${style === 'illo' ? ' board-illo' : ''}${style === 'icons' ? ' board-icons' : ''}${style === 'progress' ? ' board-pbi' : ''}${style === 'pots' ? ' board-pots' : ''}${style === 'grid' ? ' board-grid' : ''}`} style={{ height: boardH + treeShift }}>
      {/* the SHARED header (hero + paycheck-scrubber carousel) sits at the very
          top of every artifact, OUTSIDE the shifted tree so it never moves. The
          carousel is the income element (each style's income node is hidden). */}
      {usesHeader && (
        <ArtifactHeader dataset={dataset} mode={effMode} now={now} onScrub={scrubTo} incomeLeft={headerIncomeLeft} />
      )}

      {/* the prototype tree, shifted DOWN so it clears the header */}
      <div className="tree-shift" style={treeShift ? { transform: `translateY(${treeShift}px)` } : undefined}>
        {/* Locked-path (pbi-only) soft vertical gold→green→pink gradient behind the
            tree; scoped to this gate so no other gate/style is tinted. */}
        {style === 'progress' && branch === 'pbi-locked' && <div className="pbi-locked-bg" />}
        {/* Grouped (pbi-only) colored section panels behind the cards/branches. */}
        {style === 'progress' && branch === 'pbi-grouped' && <PbiGroupedPanels dataset={dataset} />}
        {/* Grouped 2 (pbi-only) GRAY section panels behind the cards/branches. */}
        {style === 'progress' && branch === 'pbi-grouped2' && <PbiGrouped2Panels dataset={dataset} />}
        {/* "grid" faint graph-paper background behind the tree + cards (grid-scoped). */}
        {style === 'grid' && <div className="grid-paper" />}
        <Connectors now={now} mode={effMode} dataset={dataset} branch={branch} map={effMap} v1={isV1} condensed={isCondensed} pillIncome={style === 'progress-pill'} iconTree={style === 'icons'} convoTree={style === 'convo'} sheetTree={style === 'sheet'} illoTree={style === 'illo'} pbiTree={style === 'progress'} potsTree={style === 'pots'} gridTree={style === 'grid'} />

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

        {cards.map((c) => (
          <Card key={c.id} node={c} now={now} mode={effMode} dataset={dataset} style={style} cardStyle="standard" titleVariant="date" map={effMap} dimmed={dimmed.has(c.id)} v1={isV1} condensed={isCondensed} dateMode={dateMode} iconLabeled={style === 'icons' && branch === 'icon-labeled'} pbiGrouped={style === 'progress' && (branch === 'pbi-grouped' || branch === 'pbi-grouped2')} pbiLocked={style === 'progress' && branch === 'pbi-locked'} onConvoTap={style === 'convo' || style === 'illo' ? openConvo : undefined} modalCardId={style === 'convo' || style === 'illo' ? selectedConvo : null} hideIncome={usesHeader} />
        ))}

        {!stocksFixed && branch === 'compact' && style !== 'pots' &&
          percentBadges.map((b) => (
            <div key={b.id} className={`node${dimmed.has(b.id) ? ' dimmed' : ''}`} style={{ left: b.x, top: b.y, zIndex: 6 }}>
              <div className="pct-badge">{b.text}</div>
            </div>
          ))}
      </div>

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
            {boardEl}
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
              <div className="config-extras">{speedField}</div>
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
        </div>
      </div>

      <Device>{boardEl}</Device>
    </div>
  );
}
