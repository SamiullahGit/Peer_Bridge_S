// SVG of the Peer Bridge logomark used in the topnav and landing page.
// Variant 'nav' uses the muted grey-blue palette for the dark sidebar
// header; variant 'brand' uses the vivid blue / navy palette for white
// backgrounds.

export default function BridgeLogo({ width = 32, height = 22, variant = 'nav' }) {
  const id = `pb-logo-${variant}`;
  const stops = variant === 'brand'
    ? [['0%', '#2563EB'], ['50%', '#1A3A8F'], ['100%', '#0D1B2A']]
    : [['0%', '#60A5FA'], ['50%', '#93C5FD'], ['100%', '#BFDBFE']];

  const leftDot   = variant === 'brand' ? '#2563EB' : '#60A5FA';
  const rightDot  = variant === 'brand' ? '#0D1B2A' : '#BFDBFE';
  const ringFill  = variant === 'brand' ? '#FFFFFF' : '#1a2744';

  return (
    <svg width={width} height={height} viewBox="0 0 140 90" fill="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="140" y2="0" gradientUnits="userSpaceOnUse">
          {stops.map(([offset, color]) => (
            <stop key={offset} offset={offset} stopColor={color} />
          ))}
        </linearGradient>
      </defs>
      <path d="M 14 70 C 14 18, 62 18, 70 44"   stroke={`url(#${id})`} strokeWidth="8" fill="none" strokeLinecap="round" />
      <path d="M 70 44 C 78 18, 126 18, 126 70" stroke={`url(#${id})`} strokeWidth="8" fill="none" strokeLinecap="round" />
      <circle cx="70"  cy="44" r="10" stroke={`url(#${id})`} strokeWidth="7" fill={ringFill} />
      <circle cx="14"  cy="70" r="10" fill={leftDot} />
      <circle cx="126" cy="70" r="10" fill={rightDot} />
    </svg>
  );
}
