"use client";

interface RippleLogoProps {
  height?: number;
}

export function RippleLogo({ height = 28 }: RippleLogoProps) {
  // Aspect ratio: viewBox is 140x32
  const width = (height / 32) * 140;

  return (
    <svg
      className="block self-center"
      width={width}
      height={height}
      viewBox="0 0 140 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Ripple"
    >
      {/* Ripple rings — concentric arcs from a drop point */}
      <g opacity="0.9">
        {/* Center drop */}
        <circle cx="16" cy="14" r="2" fill="url(#dropGrad)" />

        {/* Ring 1 */}
        <path
          d="M16 22 A8 8 0 0 1 8 14"
          stroke="url(#ring1)"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.85"
        />
        <path
          d="M16 22 A8 8 0 0 0 24 14"
          stroke="url(#ring1)"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.85"
        />

        {/* Ring 2 */}
        <path
          d="M16 26 A12 12 0 0 1 4 14"
          stroke="url(#ring2)"
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
          opacity="0.55"
        />
        <path
          d="M16 26 A12 12 0 0 0 28 14"
          stroke="url(#ring2)"
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
          opacity="0.55"
        />

        {/* Ring 3 — outermost, faintest */}
        <path
          d="M16 30 A16 16 0 0 1 0 14"
          stroke="url(#ring3)"
          strokeWidth="0.8"
          strokeLinecap="round"
          fill="none"
          opacity="0.3"
        />
        <path
          d="M16 30 A16 16 0 0 0 32 14"
          stroke="url(#ring3)"
          strokeWidth="0.8"
          strokeLinecap="round"
          fill="none"
          opacity="0.3"
        />
      </g>

      {/* "Ripple" text — converted to SVG for cross-browser consistency */}
      <text
        x="38"
        y="21.5"
        fill="url(#textGrad)"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        fontSize="18"
        fontWeight="600"
        letterSpacing="0.5"
      >
        Ripple
      </text>

      {/* Gradient definitions */}
      <defs>
        <radialGradient id="dropGrad" cx="50%" cy="40%" r="50%">
          <stop offset="0%" stopColor="#c4b5fd" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </radialGradient>

        <linearGradient id="ring1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#c084fc" />
        </linearGradient>

        <linearGradient id="ring2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>

        <linearGradient id="ring3" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#9333ea" />
        </linearGradient>

        <linearGradient id="textGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#e9e3f5" />
          <stop offset="100%" stopColor="#c4b5fd" />
        </linearGradient>
      </defs>
    </svg>
  );
}
