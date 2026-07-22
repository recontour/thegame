export type ScatterPiece = {
  /** Stable key for React */
  id: string;
  /** Which series photo (thumb) this tile shows */
  photoIndex: number;
  /** Only the primary tile for a photo can be promoted to center */
  isPrimary: boolean;
  /** percent positions on the collage stage (can be <0 or >100 for bleed) */
  left: number;
  top: number;
  /** width as % of viewport width */
  width: number;
  rotate: number;
  /** rest opacity in the mess */
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
 * Full-bleed carpet: many overlapping large tiles.
 * Reuses thumbs so 8 photos can cover the entire background.
 * First tile of each photoIndex is primary (promote/demote target).
 */
export function buildCollagePieces(
  photoCount: number,
  seed = 0,
): ScatterPiece[] {
  if (photoCount <= 0) return [];

  // Dense grid — enough tiles to leave almost no black when overlapping
  const COLS = 5;
  const ROWS = 6;
  const gridTotal = COLS * ROWS; // 30
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

    // Place in cell with bleed past edges + strong jitter for chaos
    const left =
      col * cellW +
      hash(s, 1) * cellW * 0.85 -
      cellW * 0.45 -
      14 +
      hash(s, 2) * 6;
    const top =
      row * cellH +
      hash(s, 3) * cellH * 0.85 -
      cellH * 0.45 -
      16 +
      hash(s, 4) * 6;

    // Big tiles so neighbors overlap heavily
    const width = 48 + hash(s, 5) * 34; // ~48–82vw

    pieces.push({
      id: `g-${seed}-${i}`,
      photoIndex,
      isPrimary,
      left,
      top,
      width,
      rotate: -34 + hash(s, 6) * 68,
      // More opaque mess (was ~0.42–0.50)
      opacity: 0.62 + hash(s, 7) * 0.12, // 0.62–0.74
      zIndex: isPrimary
        ? 12 + Math.floor(hash(s, 8) * 6)
        : 1 + Math.floor(hash(s, 8) * 10),
      driftX: 4 + hash(s, 9) * 10,
      driftY: 3 + hash(s, 10) * 10,
      driftDur: 9 + hash(s, 11) * 8,
    });
  }

  // Guarantee every photo has a primary (if photoCount > grid… unlikely)
  for (let p = 0; p < photoCount; p++) {
    if (primaryAssigned.has(p)) continue;
    const s = 9000 + p + seed;
    pieces.push({
      id: `primary-fallback-${p}-${seed}`,
      photoIndex: p,
      isPrimary: true,
      left: hash(s, 1) * 70 - 5,
      top: hash(s, 2) * 70 - 5,
      width: 55 + hash(s, 3) * 25,
      rotate: -20 + hash(s, 4) * 40,
      opacity: 0.66,
      zIndex: 14,
      driftX: 6,
      driftY: 5,
      driftDur: 10,
    });
  }

  // Extra edge plugs so corners never open to pure black
  const plugs = [
    { left: -18, top: -16 },
    { left: 70, top: -18 },
    { left: -20, top: 68 },
    { left: 72, top: 70 },
    { left: 28, top: -20 },
    { left: 30, top: 78 },
    { left: -22, top: 32 },
    { left: 80, top: 34 },
  ];
  plugs.forEach((pad, k) => {
    const s = 5000 + k + seed * 3;
    pieces.push({
      id: `edge-${seed}-${k}`,
      photoIndex: k % photoCount,
      isPrimary: false,
      left: pad.left + hash(s, 1) * 10,
      top: pad.top + hash(s, 2) * 10,
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

/** Fresh rest pose for a demoted primary tile */
export function restPoseFor(
  photoIndex: number,
  photoCount: number,
  seed: number,
): Pick<
  ScatterPiece,
  "left" | "top" | "width" | "rotate" | "opacity" | "zIndex" | "driftX" | "driftY" | "driftDur"
> {
  const s = photoIndex * 23 + seed * 47;
  return {
    left: hash(s, 1) * 78 - 12,
    top: hash(s, 2) * 78 - 14,
    width: 50 + hash(s, 3) * 32,
    rotate: -30 + hash(s, 4) * 60,
    opacity: 0.62 + hash(s, 5) * 0.12,
    zIndex: 12 + Math.floor(hash(s, 6) * 6),
    driftX: 4 + hash(s, 7) * 10,
    driftY: 3 + hash(s, 8) * 10,
    driftDur: 9 + hash(s, 9) * 8,
  };
}
