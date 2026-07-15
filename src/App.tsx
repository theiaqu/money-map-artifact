import { useCallback, useEffect, useRef, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import Card from './components/Card';
import SectionNodeView from './components/SectionNodeView';
import Connectors from './components/Connectors';
import ConvoModal from './components/ConvoModal';
import Device, { SCREEN_W } from './components/Device';
import { cardsFor, sectionsFor, badgesFor, type BranchStyle, type MapStyle } from './data';
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

const STYLES: { id: ChartStyle; label: string }[] = [
  { id: 'progress', label: 'Progress bar, inside' },
  { id: 'progress-bg', label: 'Progress bar, background' },
  { id: 'slim', label: 'Super slim' },
  { id: 'icons', label: 'Minimalist icons' },
  { id: 'convo', label: 'Conversational' },
  { id: 'pie', label: 'Pie chart' },
  { id: 'stocks', label: 'Stocks / heart monitor' },
  { id: 'progress-pill', label: 'Progress pill' },
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
    default:
      return null;
  }
}

const BRANCHES: { id: BranchStyle; label: string }[] = [
  { id: 'text-only', label: 'Text only' },
  { id: 'compact', label: 'Lines with %' },
];

// "Skinny line" is the thin-tree pairing for the minimalist styles (Super slim,
// Figma 496-5864; Minimalist icons, Figma 729:6187): the super-thin tree is
// designed around their compact rows, so it's the sole gate offered for them.
const SLIM_BRANCHES: { id: BranchStyle; label: string }[] = [
  { id: 'skinny-line', label: 'Skinny line' },
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
    // gate pairing: the slim + icon cards use the skinny-line tree; every other
    // style must fall back to a valid non-thin gate so skinny-line is never active
    // off those layouts (its geometry only fits their compact rows).
    setBranch((prev) => (s === 'slim' || s === 'icons' || s === 'convo' ? 'skinny-line' : prev === 'skinny-line' ? 'text-only' : prev));
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

  const now = t < 0 ? 0 : Math.min(t / monthSecs(effMode), animMonths(dataset, effMode));
  const dimmed = dimmedNodes(dataset, effMode, now);

  // dataset-aware card + percent-badge sets (layout positions stay identical)
  const cards = cardsFor(dataset);
  const percentBadges = badgesFor(dataset);
  const selectedNode = selectedConvo ? cards.find((c) => c.id === selectedConvo) ?? null : null;

  // gate options depend on the account style: "skinny line" is offered ONLY for
  // the slim card (and is the only gate there); all other styles keep text-only
  // + "Lines with %".
  const gateOptions = style === 'slim' || style === 'icons' || style === 'convo' ? SLIM_BRANCHES : BRANCHES;

  // Shared config fields (data type → time model). Rendered in BOTH the desktop
  // left rail and the mobile config drawer so the markup is authored once.
  const configFields = (
    <>
      <div className="config-head">
        <h1 className="config-title">Artifact configs</h1>
        <p className="config-updated">Last updated Jul 13, 2026 · 3:17 PM</p>
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
            {STYLES.map((s) => (
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
        {!stocksFixed && (
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
  const boardEl = (
    <div className={`board${style === 'convo' ? ' board-convo' : ''}`} style={{ height: boardH }}>
      <Connectors now={now} mode={effMode} dataset={dataset} branch={branch} map={effMap} v1={isV1} condensed={isCondensed} pillIncome={style === 'progress-pill'} iconTree={style === 'icons'} convoTree={style === 'convo'} />

      {sectionsFor(dataset).map((s) => (
        <SectionNodeView key={s.id} node={s} dimmed={dimmed.has(s.id)} dataset={dataset} branch={branch} map={effMap} v1={isV1} condensed={isCondensed} convo={style === 'convo'} />
      ))}

      {cards.map((c) => (
        <Card key={c.id} node={c} now={now} mode={effMode} dataset={dataset} style={style} cardStyle="standard" titleVariant="date" map={effMap} dimmed={dimmed.has(c.id)} v1={isV1} condensed={isCondensed} dateMode={dateMode} onConvoTap={style === 'convo' ? openConvo : undefined} modalCardId={style === 'convo' ? selectedConvo : null} />
      ))}

      {!stocksFixed && branch === 'compact' &&
        percentBadges.map((b) => (
          <div key={b.id} className={`node${dimmed.has(b.id) ? ' dimmed' : ''}`} style={{ left: b.x, top: b.y, zIndex: 6 }}>
            <div className="pct-badge">{b.text}</div>
          </div>
        ))}

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
