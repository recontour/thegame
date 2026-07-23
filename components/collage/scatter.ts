export type ScatterPiece = {
  /** Always matches series photo index — one tile per photo */
  photoIndex: number;
  /** Center of tile as % of stage */
  left: number;
  top: number;
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
 * Exactly one home pose per photo — no duplicates, no mystery clones.
 * 4×3-ish layout so all 12 carpet the void with big overlapping tiles.
 */
export function buildHomeLayout(photoCount: number): ScatterPiece[] {
  if (photoCount <= 0) return [];

  // Prefer a grid that fits the count cleanly (12 → 4×3)
  const COLS = photoCount <= 6 ? 3 : photoCount <= 9 ? 3 : 4;
  const ROWS = Math.ceil(photoCount / COLS);

  return Array.from({ length: photoCount }, (_, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const s = i * 17 + 3;

    const cellW = 100 / COLS;
    const cellH = 100 / ROWS;

    // Center of cell + mild chaos (kept mild so each photo stays "findable")
    const left =
      col * cellW + cellW * 0.5 + (hash(s, 1) - 0.5) * cellW * 0.45;
    const top =
      row * cellH + cellH * 0.5 + (hash(s, 2) - 0.5) * cellH * 0.45;

    // Large enough that 12 tiles still fill the frame when rotated
    const width = 42 + hash(s, 3) * 22; // ~42–64vw

    return {
      photoIndex: i,
      left,
      top,
      width,
      rotate: -22 + hash(s, 4) * 44,
      opacity: 0.82 + hash(s, 5) * 0.1,
      zIndex: 2 + i,
      driftX: 4 + hash(s, 6) * 8,
      driftY: 3 + hash(s, 7) * 8,
      driftDur: 9 + hash(s, 8) * 7,
    };
  });
}

/**
 * When demoting, return to the same home slot with only a tiny nudge —
 * never a random teleport across the screen.
 */
export function homeWithNudge(
  home: ScatterPiece,
  seed: number,
): ScatterPiece {
  const s = home.photoIndex * 31 + seed * 13;
  return {
    ...home,
    left: home.left + (hash(s, 1) - 0.5) * 6,
    top: home.top + (hash(s, 2) - 0.5) * 6,
    rotate: home.rotate + (hash(s, 3) - 0.5) * 8,
    width: home.width + (hash(s, 4) - 0.5) * 4,
    opacity: 0.82 + hash(s, 5) * 0.1,
  };
}
