import { useCallback, useEffect, useRef, useState } from 'react';
import Card from './components/Card';
import SectionNodeView from './components/SectionNodeView';
import Connectors from './components/Connectors';
import Device from './components/Device';
import { cards, sections, percentBadges, type BranchStyle, type MapStyle } from './data';
import type { ChartStyle, CardStyle, TitleVariant } from './components/Card';
import { animMonths, endSecs, monthSecs, dimmedNodes, type Mode } from './scenario';

const MODES: { id: Mode; label: string }[] = [
  { id: 'illustrative', label: 'Illustrative' },
  { id: 'accurate', label: 'Accurate' },
];

const STYLES: { id: ChartStyle; label: string }[] = [
  { id: 'stocks', label: 'Stocks / heart monitor' },
  { id: 'pie', label: 'Pie chart' },
  { id: 'progress', label: 'Progress bar, inside' },
  { id: 'progress-pill', label: 'Progress pill' },
  { id: 'progress-bg', label: 'Progress bar, background' },
];

// chart styles that (like pie) rely on the smooth illustrative progressAt fill
const ILLUSTRATIVE_ONLY_STYLES: ChartStyle[] = ['pie', 'progress', 'progress-pill', 'progress-bg'];

const BRANCHES: { id: BranchStyle; label: string }[] = [
  { id: 'standard', label: 'card' },
  { id: 'compact', label: 'compact card' },
  { id: 'text-only', label: 'text only' },
];

const CARD_STYLES: { id: CardStyle; label: string }[] = [
  { id: 'standard', label: 'Standard' },
  { id: 'tertiary', label: 'Title tertiary' },
];

const MAPS: { id: MapStyle; label: string }[] = [
  { id: 'flow', label: 'Modern' },
  { id: 'money-map', label: 'Like Today\u2019s MM' },
];

const TITLE_VARIANTS: { id: TitleVariant; label: string }[] = [
  { id: 'date', label: 'Date only' },
  { id: 'goalDate', label: 'Date + Goal V1' },
  { id: 'dateGoal', label: 'Date + Goal V2' },
  { id: 'title', label: 'Title re-emphasized' },
];

export default function App() {
  const [t, setT] = useState(-1);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [mode, setMode] = useState<Mode>('illustrative');
  const [style, setStyle] = useState<ChartStyle>('stocks');
  const [branch, setBranch] = useState<BranchStyle>('standard');
  const [cardStyle, setCardStyle] = useState<CardStyle>('standard');
  const [titleVariant, setTitleVariant] = useState<TitleVariant>('date');
  const [map, setMap] = useState<MapStyle>('flow');
  const [speed, setSpeed] = useState(1); // global pace multiplier (layered on mode pacing)
  const raf = useRef(0);
  const lastTick = useRef(0); // perf timestamp of the previous frame
  const elapsedRef = useRef(0); // accumulated sim-seconds (speed-scaled); drives t
  const speedRef = useRef(1); // live mirror of `speed` so the RAF loop reads it without restarting

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
    const end = endSecs(mode); // duration is per time model (illustrative < accurate)
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
  }, [mode]);

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

  const now = t < 0 ? 0 : Math.min(t / monthSecs(mode), animMonths(mode));
  const dimmed = dimmedNodes(mode, now);
  // pie / progress rely on the illustrative progressAt fill; fall back to stocks
  const effStyle: ChartStyle =
    mode === 'illustrative' && ILLUSTRATIVE_ONLY_STYLES.includes(style) ? style : 'stocks';

  return (
    <div className="stage">
      <div className="config-bar">
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
        <div className="config-row">
          <span className="config-label">Chart style</span>
          <div className="mode-toggle" role="tablist" aria-label="Chart style">
            {STYLES.map((s) => {
              const disabled = ILLUSTRATIVE_ONLY_STYLES.includes(s.id) && mode !== 'illustrative';
              return (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={effStyle === s.id}
                  disabled={disabled}
                  title={disabled ? `${s.label} is only available in the illustrative model` : undefined}
                  className={`mode-opt${effStyle === s.id ? ' active' : ''}`}
                  onClick={() => setStyle(s.id)}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="config-row">
          <span className="config-label">Gate style</span>
          <div className="mode-toggle" role="tablist" aria-label="Gate style">
            {BRANCHES.map((b) => (
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
        <div className="config-row">
          <span className="config-label">Card style</span>
          <div className="mode-toggle" role="tablist" aria-label="Card style">
            {CARD_STYLES.map((c) => (
              <button
                key={c.id}
                role="tab"
                aria-selected={cardStyle === c.id}
                className={`mode-opt${cardStyle === c.id ? ' active' : ''}`}
                onClick={() => setCardStyle(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        {cardStyle === 'tertiary' && (
          <div className="config-row">
            <span className="config-label">Title style</span>
            <div className="mode-toggle" role="tablist" aria-label="Title style">
              {TITLE_VARIANTS.map((v) => (
                <button
                  key={v.id}
                  role="tab"
                  aria-selected={titleVariant === v.id}
                  className={`mode-opt${titleVariant === v.id ? ' active' : ''}`}
                  onClick={() => setTitleVariant(v.id)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        )}

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

        <div className="controls">
          {playing ? (
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
          )}
        </div>
      </div>

      <Device>
        <div className="board">
          <Connectors now={now} mode={mode} branch={branch} map={map} />

          {sections.map((s) => (
            <SectionNodeView key={s.id} node={s} dimmed={dimmed.has(s.id)} branch={branch} map={map} />
          ))}

          {cards.map((c) => (
            <Card key={c.id} node={c} now={now} mode={mode} style={effStyle} cardStyle={cardStyle} titleVariant={titleVariant} map={map} dimmed={dimmed.has(c.id)} />
          ))}

          {map !== 'money-map' && branch !== 'text-only' &&
            percentBadges.map((b) => (
              <div key={b.id} className={`node${dimmed.has(b.id) ? ' dimmed' : ''}`} style={{ left: b.x, top: b.y, zIndex: 6 }}>
                <div className="pct-badge">{b.text}</div>
              </div>
            ))}
        </div>
      </Device>
    </div>
  );
}
