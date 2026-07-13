import { useEffect, useState, type ReactNode } from 'react';
import StatusBar from './StatusBar';

/* iPhone 17 Pro — 6.3" display, 402 x 874 logical points.
   Frame = screen + uniform bezel. */
export const SCREEN_W = 402;
export const SCREEN_H = 874;
const BEZEL = 14;
export const DEVICE_W = SCREEN_W + BEZEL * 2; // 430
export const DEVICE_H = SCREEN_H + BEZEL * 2; // 902

// horizontal space reserved for the left config rail (keeps its width in sync
// with `.config-bar` in index.css so the phone never overlaps the controls)
const CONFIG_RESERVE = 300;

/* Scale the device to fit the viewport: never larger than true size (1:1),
   but shrink freely so it always fits the browser window (minus the config rail). */
function useFitScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const update = () => {
      const margin = 32;
      const availW = window.innerWidth - margin - CONFIG_RESERVE;
      const availH = window.innerHeight - margin;
      const fit = Math.min(1, availW / DEVICE_W, availH / DEVICE_H);
      setScale(Math.max(0.4, fit));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return scale;
}

export default function Device({ children }: { children: ReactNode }) {
  const scale = useFitScale();
  // outer box takes the *scaled* footprint so flex layout reserves the real
  // visual size (transform alone would keep the full 430×902 layout box)
  return (
    <div className="device-scale" style={{ width: DEVICE_W * scale, height: DEVICE_H * scale }}>
      <div className="device" style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <span className="btn btn-action" />
        <span className="btn btn-vol-up" />
        <span className="btn btn-vol-down" />
        <span className="btn btn-power" />
        <div className="device-screen">
          <div className="screen-scroll">{children}</div>
          <StatusBar />
          <div className="dynamic-island" />
        </div>
      </div>
    </div>
  );
}
