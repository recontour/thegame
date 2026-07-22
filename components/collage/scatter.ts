export type ScatterPiece = {
  id: string;
  photoIndex: number;
  isPrimary: boolean;
  /** Center of tile as % of stage (0–100, may bleed outside) */
  left: number;
  top: number;
  /** width as % of viewport width */
  width: number;
  rotate: number;
  opacity: number;
  zIndex: number;
  driftX: number;
  driftY: number;
  driftDur: number;
};

function hash(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Full-bleed carpet of overlapping tiles.
 * Positions are tile *centers* so promote/demote can share one transform model.
 */
export function buildCollagePieces(
  photoCount: number,
  seed = 0,
): ScatterPiece[] {
  if (photoCount <= 0) return [];

  const COLS = 5;
  const ROWS = 6;
  const gridTotal = COLS * ROWS;
  const pieces: ScatterPiece[] = [];
  const primaryAssigned = new Set<number>();

  for (let i = 0; i < gridTotal; i++) {
    const photoIndex = i % photoCount;
    const isPrimary = !primaryAssigned.has(photoIndex);
    if (isPrimary) primaryAssigned.add(photoIndex);

    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const s = i * 19 + seed * 41;

    const cellW = 100 / COLS;
    const cellH = 100 / ROWS;

    // Center of each cell + jitter (percent of stage)
    const left =
      col * cellW +
      cellW * 0.5 +
      (hash(s, 1) - 0.5) * cellW * 0.7 -
      4;
    const top =
      row * cellH +
      cellH * 0.5 +
      (hash(s, 2) - 0.5) * cellH * 0.7 -
      4;

    const width = 48 + hash(s, 5) * 34;

    pieces.push({
      id: `g-${seed}-${i}`,
      photoIndex,
      isPrimary,
      left,
      top,
      width,
      rotate: -34 + hash(s, 6) * 68,
      opacity: 0.62 + hash(s, 7) * 0.12,
      zIndex: isPrimary
        ? 12 + Math.floor(hash(s, 8) * 6)
        : 1 + Math.floor(hash(s, 8) * 10),
      driftX: 4 + hash(s, 9) * 10,
      driftY: 3 + hash(s, 10) * 10,
      driftDur: 9 + hash(s, 11) * 8,
    });
  }

  for (let p = 0; p < photoCount; p++) {
    if (primaryAssigned.has(p)) continue;
    const s = 9000 + p + seed;
    pieces.push({
      id: `primary-fallback-${p}-${seed}`,
      photoIndex: p,
      isPrimary: true,
      left: 20 + hash(s, 1) * 60,
      top: 20 + hash(s, 2) * 60,
      width: 55 + hash(s, 3) * 25,
      rotate: -20 + hash(s, 4) * 40,
      opacity: 0.66,
      zIndex: 14,
      driftX: 6,
      driftY: 5,
      driftDur: 10,
    });
  }

  const plugs = [
    { left: 8, top: 8 },
    { left: 92, top: 6 },
    { left: 6, top: 92 },
    { left: 94, top: 94 },
    { left: 50, top: 4 },
    { left: 50, top: 96 },
    { left: 3, top: 50 },
    { left: 97, top: 50 },
  ];
  plugs.forEach((pad, k) => {
    const s = 5000 + k + seed * 3;
    pieces.push({
      id: `edge-${seed}-${k}`,
      photoIndex: k % photoCount,
      isPrimary: false,
      left: pad.left + (hash(s, 1) - 0.5) * 8,
      top: pad.top + (hash(s, 2) - 0.5) * 8,
      width: 58 + hash(s, 3) * 28,
      rotate: -40 + hash(s, 4) * 80,
      opacity: 0.64 + hash(s, 5) * 0.08,
      zIndex: 1 + Math.floor(hash(s, 6) * 5),
      driftX: 5 + hash(s, 7) * 8,
      driftY: 4 + hash(s, 8) * 8,
      driftDur: 10 + hash(s, 9) * 6,
    });
  });

  return pieces;
}

export function restPoseFor(photoIndex: number, seed: number) {
  const s = photoIndex * 23 + seed * 47;
  return {
    left: 12 + hash(s, 1) * 76,
    top: 12 + hash(s, 2) * 76,
    width: 50 + hash(s, 3) * 32,
    rotate: -30 + hash(s, 4) * 60,
    opacity: 0.62 + hash(s, 5) * 0.12,
    zIndex: 12 + Math.floor(hash(s, 6) * 6),
    driftX: 4 + hash(s, 7) * 10,
    driftY: 3 + hash(s, 8) * 10,
    driftDur: 9 + hash(s, 9) * 8,
  };
}
