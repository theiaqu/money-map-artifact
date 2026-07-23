import { Home, Zap, Droplet, Banknote } from 'lucide-react';

/* The Illustrated style's Core "Bills and expenses" calendar (Figma 778:7102).
   A crisp, fully-scalable inline SVG: the same blue calendar chrome as the shared
   convo calendar, but the plain grid dots are replaced with small BLUE CIRCLES
   holding WHITE ICONS for specific recurring expenses — a house (rent), a
   lightning bolt (electricity), a water droplet (water) and a banknote (other
   bills) — placed on a diagonal of grid cells like the Figma.

   Rendered at ONE fixed viewBox (55x51, matching the shared calendar's
   proportions) so the SAME art scales uniformly in BOTH the 64px card slot
   (IlloCard) and the big modal illustration (IlloModal) — the shared-element
   FLIP grow stays a pure uniform scale. Icons are lucide glyphs positioned via
   nested <svg> (x/y/width/height forwarded), so they stay razor-sharp at any
   size. This is Illustrated-only and does NOT touch convo-calendar.svg. */

export const CAL_BLUE = '#5E8DBA';

// the calendar's viewBox (shared by the chrome svg + the modal sticker overlay so
// the fixed-size discs land on the right grid cells at any chrome scale)
export const CAL_VIEW = { w: 55, h: 51 } as const;

// each recurring-expense marker: a blue disc on a grid cell + a white lucide icon.
// Exported so IlloModal can render the discs as a SEPARATE fixed-px overlay (so
// they stay a constant size while the calendar chrome scales up).
export const CAL_MARKERS = [
  { Icon: Home, cx: 14.05, cy: 22.3 }, // rent
  { Icon: Zap, cx: 27.33, cy: 28.9 }, // electricity
  { Icon: Droplet, cx: 34.11, cy: 35.6 }, // water
  { Icon: Banknote, cx: 20.82, cy: 41.8 }, // other bills
];
export const CAL_R = 4.4; // marker disc radius (viewBox units)
export const CAL_ICON = 5.6; // white icon box (centered on the disc, viewBox units)

const BLUE = CAL_BLUE;
const MARKERS = CAL_MARKERS;
const R = CAL_R;
const ICON = CAL_ICON;

// `markers`: draw the bill-sticker discs INSIDE the scaling svg (default — used
// by the small card calendar). When false the svg is CHROME-ONLY (grid/header/
// rings), so IlloModal can grow the chrome and pop the fixed-size stickers in
// separately after the FLIP settles.
export default function IlloCalendar({ className, markers = true }: { className?: string; markers?: boolean }) {
  return (
    <svg
      className={className}
      viewBox="0 0 55 51"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', width: '100%', height: 'auto' }}
      aria-hidden
    >
      <g>
        {/* white body + rounded blue header band */}
        <rect x="4.28418" y="6.45312" width="46.0947" height="39.8584" rx="5.42291" fill="white" />
        <path
          d="M4.28418 11.876C4.28418 8.88104 6.7121 6.45312 9.70709 6.45312H44.956C47.951 6.45312 50.3789 8.88104 50.3789 11.876V17.8412H4.28418V11.876Z"
          fill={BLUE}
        />
        {/* binder ring holes (black) sitting on the header top edge */}
        <circle cx="12.4185" cy="12.148" r="1.89802" fill="black" />
        <circle cx="22.7222" cy="12.148" r="1.89802" fill="black" />
        <circle cx="33.025" cy="12.148" r="1.89802" fill="black" />
        <circle cx="43.3297" cy="12.148" r="1.89802" fill="black" />
        {/* gray binder posts poking above the header */}
        <rect x="11.0625" y="4.28516" width="2.71145" height="8.9478" rx="1.35573" fill="#D9D9D9" />
        <rect x="21.3662" y="4.28516" width="2.71145" height="8.9478" rx="1.35573" fill="#D9D9D9" />
        <rect x="31.6699" y="4.28516" width="2.71145" height="8.9478" rx="1.35573" fill="#D9D9D9" />
        <rect x="41.9736" y="4.28516" width="2.71145" height="8.9478" rx="1.35573" fill="#D9D9D9" />
        {/* light grid lines */}
        <path d="M4.28418 24.6172H50.3789" stroke="#DDDDDD" strokeWidth="0.271145" strokeLinejoin="round" />
        <path d="M4.28418 31.9375H50.3789" stroke="#DDDDDD" strokeWidth="0.271145" strokeLinejoin="round" />
        <path d="M4.28418 39.5312H50.3789" stroke="#DDDDDD" strokeWidth="0.271145" strokeLinejoin="round" />
        <path d="M10.5205 17.8398L10.5205 46.3101" stroke="#DDDDDD" strokeWidth="0.271145" strokeLinejoin="round" />
        <path d="M17.2998 17.8398L17.2998 46.3101" stroke="#DDDDDD" strokeWidth="0.271145" strokeLinejoin="round" />
        <path d="M24.0781 17.8398L24.0781 46.3101" stroke="#DDDDDD" strokeWidth="0.271145" strokeLinejoin="round" />
        <path d="M30.8564 17.8398L30.8564 46.3101" stroke="#DDDDDD" strokeWidth="0.271145" strokeLinejoin="round" />
        <path d="M37.3633 17.8398L37.3633 46.3101" stroke="#DDDDDD" strokeWidth="0.271145" strokeLinejoin="round" />
        <path d="M43.8711 17.8398L43.8711 46.3101" stroke="#DDDDDD" strokeWidth="0.271145" strokeLinejoin="round" />
        {/* recurring-expense markers: blue disc + white icon (small card only;
            the modal pops these in as a separate fixed-size overlay) */}
        {markers && MARKERS.map(({ Icon, cx, cy }, i) => (
          <g key={i}>
            <circle cx={cx} cy={cy} r={R} fill={BLUE} />
            <Icon
              x={cx - ICON / 2}
              y={cy - ICON / 2}
              width={ICON}
              height={ICON}
              viewBox="0 0 24 24"
              color="#ffffff"
              strokeWidth={2.4}
            />
          </g>
        ))}
      </g>
    </svg>
  );
}
