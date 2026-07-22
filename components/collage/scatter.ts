export type ScatterPiece = {
  /** Index into the photo series (thumbs are reused for density) */
  photoIndex: number;
  /** percent 0–100 of the collage stage */
  left: number;
  top: number;
  /** size as % of viewport width */
  width: number;
  rotate: number;
  opacity: number;
  zIndex: number;
  driftX: number;
  driftY: number;
  driftDur: number;
};

/** Deterministic pseudo-random in [0,1) */
function hash(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Full-bleed chaotic collage.
 * Reuses each series thumb several times so a small set still carpet the screen.
 */
export function buildScatter(photoCount: number): ScatterPiece[] {
  if (photoCount <= 0) return [];

  // Enough tiles to cover mobile + desktop with heavy overlap
  const COPIES = 4; // 8 photos → 32 pieces
  const total = photoCount * COPIES;
  const pieces: ScatterPiece[] = [];

  // Rough grid for even coverage, then jitter hard for mess
  const cols = 4;
  const rows = Math.ceil(total / cols);

  for (let i = 0; i < total; i++) {
    const photoIndex = i % photoCount;
    const col = i % cols;
    const row = Math.floor(i / cols);

    const jx = hash(i, 1);
    const jy = hash(i, 2);
    const jz = hash(i, 3);

    // Cell size so tiles spill past edges (negative / >100)
    const cellW = 100 / cols;
    const cellH = 100 / rows;

    // Place in cell with strong jitter + bleed outside frame
    const left = col * cellW + jx * cellW * 1.15 - cellW * 0.35 - 8;
    const top = row * cellH + jy * cellH * 1.15 - cellH * 0.35 - 10;

    // Large enough to carpet when overlapping + rotated
    const width = 38 + jz * 28; // ~38–66vw

    pieces.push({
      photoIndex,
      left,
      top,
      width,
      rotate: -32 + hash(i, 4) * 64,
      opacity: 0.42 + hash(i, 5) * 0.08, // 0.42–0.50
      zIndex: 1 + Math.floor(hash(i, 6) * 12),
      driftX: 5 + hash(i, 7) * 12,
      driftY: 4 + hash(i, 8) * 12,
      driftDur: 8 + hash(i, 9) * 9,
    });
  }

  // Extra corner/edge “patches” so no black voids at the extremes
  const edgePads = [
    { left: -12, top: -10 },
    { left: 78, top: -12 },
    { left: -14, top: 72 },
    { left: 80, top: 74 },
    { left: 35, top: -14 },
    { left: 32, top: 82 },
    { left: -16, top: 38 },
    { left: 86, top: 36 },
  ];

  edgePads.forEach((pad, k) => {
    const i = total + k;
    pieces.push({
      photoIndex: k % photoCount,
      left: pad.left + hash(i, 10) * 8,
      top: pad.top + hash(i, 11) * 8,
      width: 48 + hash(i, 12) * 22,
      rotate: -40 + hash(i, 13) * 80,
      opacity: 0.4 + hash(i, 14) * 0.08,
      zIndex: 1 + Math.floor(hash(i, 15) * 6),
      driftX: 6 + hash(i, 16) * 10,
      driftY: 5 + hash(i, 17) * 10,
      driftDur: 9 + hash(i, 18) * 7,
    });
  });

  return pieces;
}
