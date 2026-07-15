import { useRef, type ReactNode } from 'react';
import { CircleCheck } from 'lucide-react';
import type { CardNode, GraphColor } from '../data';
import { isReached, monthsFromNow, type Dataset, type DateMode, type Mode } from '../scenario';
import FruitfulLogo from './FruitfulLogo';
import calendarIllo from '../assets/convo-calendar.svg';

// per-graph-color hex for the inline name-chip Fruitful logo (matches the app's
// GraphStrip COLOR map): Core -> blue, Spend -> green, goals -> pink.
const GRAPH_HEX: Record<GraphColor, string> = {
  yellow: '#f6dc72',
  blue: '#49c7ef',
  green: '#37d67a',
  pink: '#ff2d8e',
};

// a small white rounded "chip" holding text, optionally with a leading tinted
// Fruitful logo (used for the account/goal NAME chips, per Figma 731:9883).
function Chip({ logoColor, logoSize, children }: { logoColor?: string; logoSize?: number; children: ReactNode }) {
  return (
    <span className="convo-chip">
      {logoColor && (
        <span className="convo-chip-logo">
          <FruitfulLogo size={logoSize ?? 14} color={logoColor} />
        </span>
      )}
      <span className="convo-chip-text">{children}</span>
    </span>
  );
}

// account card TITLE (Figma 731:9883): the descriptive headline — not the account
// name, which lives in the sentence chip (Core -> "Bills and expenses", Spend ->
// "Daily spend").
const ACCOUNT_TITLE: Record<string, string> = {
  core: 'Bills and expenses',
  spend: 'Daily spend',
};

// The Spend illustration, recomposed as a green wallet SLEEVE (back + front pocket)
// with a separable dark-green CREDIT CARD (Fruitful mark + chip) tucked inside
// (Figma 734:6294). The card sits between the two mint panels; when `peek` is set
// (the expanded modal) it slides UP and tilts OUT of the sleeve. Colors are taken
// straight from the downloaded wallet asset.
function SpendWallet({ peek, logoSize }: { peek: boolean; logoSize: number }) {
  return (
    <div className={`convo-wallet${peek ? ' convo-wallet--peek' : ''}`}>
      <div className="convo-wallet-back" />
      <div className="convo-wallet-card">
        <span className="convo-wallet-chip" />
        <span className="convo-wallet-logo">
          <FruitfulLogo size={logoSize} color="#ffffff" />
        </span>
      </div>
      <div className="convo-wallet-front" />
    </div>
  );
}

// account "conversational" sentence: [chip $amount] "to" [chip {logo}+"X Account"] "every month"
function AccountSentence({ node, logoSize }: { node: CardNode; logoSize: number }) {
  return (
    <span className="convo-sentence">
      <Chip>{node.amount}</Chip>
      <span className="convo-word">to</span>
      <Chip logoColor={GRAPH_HEX[node.graph]} logoSize={logoSize}>{node.title}</Chip>
      <span className="convo-word">every month</span>
    </span>
  );
}

// goal "conversational" sentence: "Until" [chip {logo}+{pill name}] "reaches" [chip $target]
function GoalSentence({ node, logoSize }: { node: CardNode; logoSize: number }) {
  return (
    <span className="convo-sentence">
      <span className="convo-word">Until</span>
      <Chip logoColor={GRAPH_HEX[node.graph]} logoSize={logoSize}>{node.pill ?? node.title}</Chip>
      <span className="convo-word">reaches</span>
      <Chip>{node.amount}</Chip>
    </span>
  );
}

// parse a "Mon YYYY" fund-by badge into an uppercase month + year for the date block
function parseBadge(badge: string | undefined): { mon: string; year: string } {
  const m = badge?.trim().match(/^([A-Za-z]{3})\s+(\d{4})$/);
  if (!m) return { mon: '', year: '' };
  return { mon: m[1].toUpperCase(), year: m[2] };
}

// goal left slot: a CircleCheck above a stacked date. In 'date' mode it's MON/YEAR;
// in 'months' mode it's the compact relative form (N / "mo." or "now"). When the
// goal is reached the check flips to the filled pink "reached" look.
function GoalDateBlock({ node, dateMode, reached, expanded }: { node: CardNode; dateMode: DateMode; reached: boolean; expanded: boolean }) {
  const months = monthsFromNow(node.badge);
  const { mon, year } = parseBadge(node.badge);
  const checkSize = expanded ? (reached ? 22 : 20) : reached ? 14 : 12;
  return (
    <div className="convo-slot convo-date">
      {reached ? (
        <CircleCheck size={checkSize} strokeWidth={2.5} color="#ffffff" fill="#ff2d8e" />
      ) : (
        <CircleCheck size={checkSize} strokeWidth={2} color="#c7c7c7" />
      )}
      {dateMode === 'months' ? (
        months <= 0 ? (
          <span className="convo-date-mon">now</span>
        ) : (
          <span className="convo-date-stack">
            <span className="convo-date-mon">{months}</span>
            <span className="convo-date-year">mo.</span>
          </span>
        )
      ) : (
        <span className="convo-date-stack">
          <span className="convo-date-mon">{mon}</span>
          <span className="convo-date-year">{year}</span>
        </span>
      )}
    </div>
  );
}

// the rounded "hero" income card at the top of the board (replaces the old
// full-bleed yellow header): a soft lemon-tinted card carrying just the
// conversational income sentence (no illustration). The left tree spine
// originates from it.
export function ConvoHero({ node }: { node: CardNode }) {
  return (
    <div className="convo-card convo-hero">
      <div className="convo-text">
        <div className="convo-title">Income</div>
        <span className="convo-sentence">
          <span className="convo-word">You bring in</span>
          <Chip>{node.amount}</Chip>
          <span className="convo-word">every month</span>
        </span>
      </div>
    </div>
  );
}

export default function ConvoCard({
  node,
  now,
  mode,
  dataset,
  dateMode = 'date',
  expanded = false,
  hidden = false,
  onTap,
}: {
  node: CardNode;
  now: number;
  mode: Mode;
  dataset: Dataset;
  dateMode?: DateMode;
  expanded?: boolean; // the enlarged "focus" variant floating over the modal scrim
  hidden?: boolean; // the resting card is hidden while its morph modal is open
  onTap?: (rect: DOMRect) => void; // tap-to-expand (resting cards only); passes its rect for the FLIP morph
}) {
  const isGoal = node.kind === 'goal';
  const reached = isGoal && isReached(dataset, mode, node.id, now);
  const isSpend = node.id === 'spend';
  const logoSize = expanded ? 17 : 14;
  const walletLogo = expanded ? 13 : 8;
  const tappable = !expanded && !!onTap;
  const ref = useRef<HTMLDivElement>(null);
  const fire = () => {
    if (ref.current) onTap?.(ref.current.getBoundingClientRect());
  };

  return (
    <div
      ref={ref}
      className={`convo-card${expanded ? ' convo-card--expanded' : ''}${tappable ? ' convo-card--tappable' : ''}${hidden ? ' convo-card--hidden' : ''}`}
      onClick={tappable ? fire : undefined}
      role={tappable ? 'button' : undefined}
      tabIndex={tappable ? 0 : undefined}
      onKeyDown={
        tappable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fire();
              }
            }
          : undefined
      }
    >
      {isGoal ? (
        <GoalDateBlock node={node} dateMode={dateMode} reached={reached} expanded={expanded} />
      ) : isSpend ? (
        <div className="convo-slot">
          <SpendWallet peek={expanded} logoSize={walletLogo} />
        </div>
      ) : (
        <div className="convo-slot">
          <img className="convo-illo" src={calendarIllo} alt="" aria-hidden />
        </div>
      )}
      <div className="convo-text">
        <div className="convo-title">{isGoal ? node.title : ACCOUNT_TITLE[node.id] ?? node.title}</div>
        {isGoal ? <GoalSentence node={node} logoSize={logoSize} /> : <AccountSentence node={node} logoSize={logoSize} />}
      </div>
    </div>
  );
}
