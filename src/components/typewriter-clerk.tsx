type Props = {
  text: string;
  tapping: boolean;
  shredding: boolean;
};

export function TypewriterClerk({ text, tapping, shredding }: Props) {
  const preview = text.replace(/\s+/g, " ").trimEnd().slice(-22) || "…";

  return (
    <div className="relative mx-auto h-36 w-full max-w-xs select-none" aria-hidden="true">
      <svg viewBox="0 0 220 150" className="h-full w-full overflow-visible">
        <g className={tapping && !shredding ? "clerk-tap" : undefined}>
          <circle cx="78" cy="28" r="10" fill="none" stroke="#c8c0b2" strokeWidth="1.6" />
          <line x1="78" y1="38" x2="78" y2="72" stroke="#c8c0b2" strokeWidth="1.6" />
          <line x1="78" y1="48" x2="58" y2="62" stroke="#c8c0b2" strokeWidth="1.6" />
          <line
            x1="78"
            y1="48"
            x2="104"
            y2="58"
            stroke="#c8c0b2"
            strokeWidth="1.6"
            className="origin-[78px_48px]"
            style={{
              transform: tapping && !shredding ? "rotate(10deg)" : undefined,
              transformOrigin: "78px 48px",
              transition: "transform 80ms steps(2)",
            }}
          />
          <line x1="78" y1="72" x2="64" y2="98" stroke="#c8c0b2" strokeWidth="1.6" />
          <line x1="78" y1="72" x2="92" y2="98" stroke="#c8c0b2" strokeWidth="1.6" />
        </g>

        <rect x="96" y="70" width="88" height="28" rx="3" fill="#1c1916" stroke="#8a8174" strokeWidth="1.4" />
        <rect x="100" y="62" width="80" height="10" rx="2" fill="#2a2621" stroke="#8a8174" strokeWidth="1" />
        {[0, 1, 2, 3, 4, 5, 6].map((k) => (
          <rect
            key={k}
            x={106 + k * 10}
            y={tapping && !shredding && k === text.length % 7 ? 84 : 82}
            width="7"
            height="6"
            rx="1"
            fill="#d4a24c"
            opacity={0.75}
          />
        ))}
        <rect x="128" y="96" width="24" height="4" rx="1" fill="#6e685e" />

        <g className={shredding ? "clerk-paper-fall" : undefined}>
          <rect x="118" y="28" width="48" height="36" fill="#f3efe6" stroke="#9c9588" strokeWidth="0.8" />
          <text
            x="122"
            y="40"
            fill="#141210"
            fontSize="5.5"
            fontFamily="IBM Plex Mono, ui-monospace, monospace"
          >
            {preview.slice(0, 11)}
          </text>
          <text
            x="122"
            y="48"
            fill="#141210"
            fontSize="5.5"
            fontFamily="IBM Plex Mono, ui-monospace, monospace"
          >
            {preview.slice(11)}
          </text>
        </g>

        <g transform="translate(168, 112)">
          <rect x="0" y="0" width="28" height="22" rx="2" fill="#2a1814" stroke="#c45c4a" strokeWidth="1.2" />
          <rect x="3" y="3" width="22" height="4" fill="#3a221c" />
          {[0, 1, 2, 3].map((s) => (
            <line
              key={s}
              x1={6 + s * 5}
              y1="8"
              x2={6 + s * 5}
              y2="18"
              stroke="#c45c4a"
              strokeWidth="0.8"
              opacity="0.7"
            />
          ))}
          {shredding
            ? [0, 1, 2, 3, 4].map((s) => (
                <rect
                  key={`c-${s}`}
                  className="clerk-confetti"
                  x={4 + s * 4}
                  y="20"
                  width="2"
                  height="6"
                  fill="#f3efe6"
                  style={{ animationDelay: `${s * 40}ms` }}
                />
              ))
            : null}
        </g>
      </svg>
    </div>
  );
}
