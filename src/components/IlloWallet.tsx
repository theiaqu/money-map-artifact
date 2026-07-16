/* The Illustrated style's Spend "Daily spend" wallet (Figma 734:6520 tucked →
   778:11049 peeked). A layered inline SVG (same art as the shared convo-wallet
   asset) but with the green credit CARD split into its OWN <g> so it can rise up
   out of the pocket independently of the envelope.

   Layering (bottom → top): pocket BACK + dashed border + pocket-opening band →
   the CARD group → the pocket FRONT panel. The card sits BETWEEN the opening band
   and the front panel, so translating it up reveals more of the card above the
   pocket while the front panel keeps clipping its lower half (a true "slide out of
   the pocket"). The card's rest position is the settled/peeked state; IlloModal
   starts it tucked (translated down, behind the front) and animates it up. */

export default function IlloWallet({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 60 49"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', width: '100%', height: 'auto', overflow: 'visible' }}
      aria-hidden
    >
      <g filter="url(#illo-wallet-shadow)">
        {/* pocket BACK + dashed inner border + opening band (static) */}
        <rect x="4.22656" y="14.3125" width="51.524" height="29.9375" rx="3.15131" fill="#E8F5EB" />
        <rect x="6.19695" y="16.1257" width="47.4273" height="26.3135" rx="1.96957" stroke="#B0DDBA" strokeWidth="0.157566" strokeDasharray="0.63 0.63" />
        <path
          d="M52.2852 16.043C53.0683 16.0431 53.7031 16.6778 53.7031 17.4609V20.3004C53.7031 20.3875 53.6326 20.458 53.5456 20.458H38.0415C38.0308 20.458 38.0201 20.4591 38.0096 20.4613L30.0612 22.1057C30.0402 22.1101 30.0184 22.1101 29.9974 22.1057L22.049 20.4613C22.0385 20.4591 22.0278 20.458 22.0171 20.458H6.27573C6.18871 20.458 6.11816 20.3875 6.11816 20.3004V17.4609C6.11816 16.6778 6.75302 16.0431 7.53613 16.043H52.2852Z"
          fill="#B0DDBA"
        />

        {/* CREDIT CARD (rises out of the pocket) — dark-green body + FF logo + chip,
            drawn BEFORE the front panel so the panel clips its lower half */}
        <g className="illo-wallet-card">
          <rect x="7.53613" y="4.22656" width="44.9062" height="26.471" rx="2.04835" fill="#054F31" />
          <g>
            <path d="M45.7326 20.4165C43.9157 20.1743 42.5114 18.6261 42.4951 16.7459C44.3127 16.9881 45.7169 18.5369 45.7326 20.4165Z" fill="white" />
            <path d="M46.2308 20.4165C48.0477 20.1743 49.4526 18.6261 49.4683 16.7459C47.6507 16.9881 46.2465 18.5369 46.2308 20.4165Z" fill="white" />
            <path d="M45.9806 16.9935C45.295 16.9935 44.7378 16.4356 44.7378 15.7506C44.7378 15.0657 45.295 14.5078 45.9806 14.5078C46.6662 14.5078 47.2234 15.0657 47.2234 15.7506C47.2234 16.4356 46.6656 16.9935 45.9806 16.9935ZM45.9806 15.0006C45.5673 15.0006 45.2306 15.3368 45.2306 15.7506C45.2306 16.1645 45.5667 16.5007 45.9806 16.5007C46.3945 16.5007 46.7306 16.1645 46.7306 15.7506C46.7306 15.3368 46.3945 15.0006 45.9806 15.0006Z" fill="white" />
          </g>
          <rect x="11.1592" y="13.5195" width="6.43303" height="5.0421" rx="0.695462" fill="#C5C4C4" />
          <path d="M11.7119 16.0469H16.9116" stroke="#AAA6A6" strokeWidth="0.157566" />
          <rect x="11.7116" y="14.7077" width="1.41809" height="2.67862" rx="0.236349" stroke="#AAA6A6" strokeWidth="0.157566" />
          <rect x="13.2858" y="15.0163" width="2.04835" height="2.20592" rx="0.236349" stroke="#AAA6A6" strokeWidth="0.157566" />
          <rect x="15.4919" y="14.7077" width="1.41809" height="2.67862" rx="0.236349" stroke="#AAA6A6" strokeWidth="0.157566" />
          <rect x="11.7116" y="14.071" width="5.35723" height="3.93914" rx="0.236349" stroke="#AAA6A6" strokeWidth="0.157566" />
        </g>

        {/* pocket FRONT panel (static) — clips the lower half of the card */}
        <path d="M22.0845 20.457H6.43359V40.783H53.2306V20.457H37.6576L29.871 21.9815L22.0845 20.457Z" fill="#E8F5EB" />
      </g>
      <defs>
        <filter id="illo-wallet-shadow" x="-0.000371933" y="-0.000371933" width="59.9783" height="48.4773" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feOffset />
          <feGaussianBlur stdDeviation="2.11347" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.15 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
        </filter>
      </defs>
    </svg>
  );
}
