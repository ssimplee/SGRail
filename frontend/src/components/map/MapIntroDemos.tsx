/**
 * Small looping illustrations for the map intro dialog.
 *
 * Animated with SVG's own <animate> elements, matching how
 * NearestStationMarker and the selection ring already work — no CSS keyframes
 * and no library. Colours mirror what the real map does: blue for selection,
 * green for the nearest-station marker.
 *
 * When `animated` is false the same drawing renders at its most informative
 * frame, so the illustration still reads with motion turned off.
 */

/** One full cycle. Long enough to follow, short enough to loop twice while reading. */
const CYCLE = "3s";

const SELECTION_BLUE = "#2563eb";
const NEAREST_GREEN = "#16a34a";

interface DemoProps {
  /** False when the user prefers reduced motion — renders a static frame */
  animated: boolean;
}

/** Shared: a stub of track with three station dots. */
function TrackStub({ litIndex }: { litIndex: number }) {
  const xs = [26, 60, 94];
  return (
    <>
      <line
        x1={18}
        y1={34}
        x2={102}
        y2={34}
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.25}
      />
      {xs.map((x, i) => (
        <circle
          key={x}
          cx={x}
          cy={34}
          r={4}
          fill="currentColor"
          opacity={i === litIndex ? 0.35 : 0.25}
        />
      ))}
    </>
  );
}

/**
 * Demo 1 — a pointer glides onto a station, presses, and a panel appears.
 */
export function TapStationDemo({ animated }: DemoProps) {
  return (
    <svg
      viewBox="0 0 120 80"
      className="h-20 w-[7.5rem] shrink-0 text-foreground"
      role="img"
      aria-label="A pointer tapping a station to open its details"
    >
      <TrackStub litIndex={1} />

      {/* The tapped station lights up the way a real selection does */}
      <circle cx={60} cy={34} r={5} fill={SELECTION_BLUE} opacity={animated ? 0 : 1}>
        {animated && (
          <animate
            attributeName="opacity"
            values="0;0;1;1;0"
            keyTimes="0;0.34;0.42;0.9;1"
            dur={CYCLE}
            repeatCount="indefinite"
          />
        )}
      </circle>

      {/* Tap ripple */}
      <circle
        cx={60}
        cy={34}
        r={animated ? 5 : 14}
        fill="none"
        stroke={SELECTION_BLUE}
        strokeWidth={2}
        opacity={animated ? 0 : 0.4}
      >
        {animated && (
          <>
            <animate
              attributeName="r"
              values="5;5;18;18"
              keyTimes="0;0.36;0.7;1"
              dur={CYCLE}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0;0.8;0;0"
              keyTimes="0;0.36;0.7;1"
              dur={CYCLE}
              repeatCount="indefinite"
            />
          </>
        )}
      </circle>

      {/* The panel that opens, sketched as a card with two text lines */}
      <g opacity={animated ? 0 : 1}>
        {animated && (
          <animate
            attributeName="opacity"
            values="0;0;1;1;0"
            keyTimes="0;0.42;0.55;0.9;1"
            dur={CYCLE}
            repeatCount="indefinite"
          />
        )}
        <rect
          x={72}
          y={8}
          width={40}
          height={26}
          rx={4}
          fill="currentColor"
          opacity={0.08}
          stroke="currentColor"
          strokeOpacity={0.25}
        />
        <rect x={77} y={14} width={22} height={3} rx={1.5} fill="currentColor" opacity={0.5} />
        <rect x={77} y={21} width={30} height={3} rx={1.5} fill="currentColor" opacity={0.3} />
      </g>

      {/* Pointer: glides in, presses, retreats */}
      <g
        fill="currentColor"
        stroke="var(--background, #fff)"
        strokeWidth={1}
        transform={animated ? undefined : "translate(62,36)"}
      >
        {animated && (
          <animateTransform
            attributeName="transform"
            type="translate"
            values="88,58; 62,36; 62,36; 88,58; 88,58"
            keyTimes="0;0.34;0.62;0.86;1"
            dur={CYCLE}
            repeatCount="indefinite"
            calcMode="spline"
            keySplines="0.4 0 0.2 1; 0 0 1 1; 0.4 0 0.2 1; 0 0 1 1"
          />
        )}
        <path d="M0 0 L0 15 L4 11 L7 17 L9.5 15.5 L6.5 10 L12 9.5 Z" />
      </g>
    </svg>
  );
}

/**
 * Demo 2 — the locate button pulses, then the nearest station is marked.
 */
export function LocateMeDemo({ animated }: DemoProps) {
  return (
    <svg
      viewBox="0 0 120 80"
      className="h-20 w-[7.5rem] shrink-0 text-foreground"
      role="img"
      aria-label="The locate button finding your nearest station"
    >
      <TrackStub litIndex={0} />

      {/* Nearest-station marker on the left-hand station */}
      <circle cx={26} cy={34} r={5} fill={NEAREST_GREEN} opacity={animated ? 0 : 1}>
        {animated && (
          <animate
            attributeName="opacity"
            values="0;0;1;1;0"
            keyTimes="0;0.45;0.55;0.92;1"
            dur={CYCLE}
            repeatCount="indefinite"
          />
        )}
      </circle>
      <circle
        cx={26}
        cy={34}
        r={animated ? 5 : 13}
        fill="none"
        stroke={NEAREST_GREEN}
        strokeWidth={2}
        opacity={animated ? 0 : 0.4}
      >
        {animated && (
          <>
            <animate
              attributeName="r"
              values="5;5;17;17"
              keyTimes="0;0.5;0.85;1"
              dur={CYCLE}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0;0.8;0;0"
              keyTimes="0;0.5;0.85;1"
              dur={CYCLE}
              repeatCount="indefinite"
            />
          </>
        )}
      </circle>

      {/* The locate control, drawn as it appears bottom-right on the map */}
      <g transform="translate(84,50)">
        <rect
          width={26}
          height={26}
          rx={6}
          fill="currentColor"
          opacity={0.08}
          stroke="currentColor"
          strokeOpacity={0.3}
        />
        {/* Crosshair */}
        <g
          stroke={NEAREST_GREEN}
          strokeWidth={1.6}
          strokeLinecap="round"
          fill="none"
          transform="translate(13,13)"
        >
          <circle r={4} />
          <line x1={0} y1={-7} x2={0} y2={-5.5} />
          <line x1={0} y1={5.5} x2={0} y2={7} />
          <line x1={-7} y1={0} x2={-5.5} y2={0} />
          <line x1={5.5} y1={0} x2={7} y2={0} />
        </g>
        {/* Press pulse around the button */}
        <rect
          x={-3}
          y={-3}
          width={32}
          height={32}
          rx={9}
          fill="none"
          stroke={NEAREST_GREEN}
          strokeWidth={2}
          opacity={animated ? 0 : 0.35}
        >
          {animated && (
            <animate
              attributeName="opacity"
              values="0;0.7;0;0"
              keyTimes="0;0.18;0.45;1"
              dur={CYCLE}
              repeatCount="indefinite"
            />
          )}
        </rect>
      </g>
    </svg>
  );
}
