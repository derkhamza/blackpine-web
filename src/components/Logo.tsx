/**
 * BlackpineLogo — the app mark: a refined stethoscope on a rounded navy tile.
 * The binaural (headset) sits at top with two ear tips; a single tube descends
 * from it. Deliberately minimal — no chestpiece — for a clean, abstract mark.
 */
export function BlackpineLogo({
  size = 32,
  radius = 8,
}: {
  size?: number;
  radius?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 72 72"
      role="img"
      aria-label="Iyadaty"
      style={{ display: "block", flexShrink: 0, borderRadius: radius }}
    >
      <rect width="72" height="72" rx="16" fill="#0A4E7E" />
      {/* Original concept-4 shape (no circle), nudged down to sit centered. */}
      <g
        fill="none"
        stroke="#fff"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="translate(0 4.5)"
      >
        <path d="M24 16 v10 a10 10 0 0 0 20 0 V16" />
        <path d="M34 44 a9 9 0 0 0 14 0" />
        <path d="M34 44 V36 M48 44 V36" />
      </g>
    </svg>
  );
}
