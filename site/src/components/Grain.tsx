/** A fixed sheet of fine noise over everything, so flat colour reads as paper. */
export function Grain() {
  return (
    <svg className="grain" aria-hidden="true" width="100%" height="100%">
      <filter id="grain-noise">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix values="0 0 0 0 0.16  0 0 0 0 0.15  0 0 0 0 0.14  0 0 0 0.22 0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#grain-noise)" />
    </svg>
  );
}
