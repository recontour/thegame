export type ScatterPiece = {
  /** percent 0–100 */
  left: number;
  top: number;
  /** viewport width units roughly as % */
  width: number;
  rotate: number;
  opacity: number;
  zIndex: number;
  /** idle drift phase offsets */
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
 * Build a messy but stable scatter for N collage pieces.
 * Avoids clustering everything dead-center so the hero can breathe.
 */
export function buildScatter(count: number): ScatterPiece[] {
  const pieces: ScatterPiece[] = [];

  for (let i = 0; i < count; i++) {
    const a = hash(i, 1);
    const b = hash(i, 2);
    const c = hash(i, 3);
    const d = hash(i, 4);

    // Bias toward edges / corners for chaos around the void center
    const edge = hash(i, 5);
    let left: number;
    let top: number;
    if (edge < 0.25) {
      left = a * 28 - 4;
      top = b * 90 - 5;
    } else if (edge < 0.5) {
      left = 72 + a * 30;
      top = b * 90 - 5;
    } else if (edge < 0.75) {
      left = a * 90 - 5;
      top = b * 26 - 6;
    } else {
      left = a * 90 - 5;
      top = 70 + b * 32;
    }

    // A few pieces still drift mid-frame for density
    if (hash(i, 6) > 0.72) {
      left = 20 + a * 55;
      top = 18 + b * 55;
    }

    pieces.push({
      left,
      top,
      width: 22 + c * 28, // ~22–50vw
      rotate: -28 + d * 56,
      opacity: 0.4 + hash(i, 7) * 0.1, // 0.40–0.50
      zIndex: 1 + Math.floor(hash(i, 8) * 8),
      driftX: 6 + hash(i, 9) * 10,
      driftY: 5 + hash(i, 10) * 10,
      driftDur: 7 + hash(i, 11) * 8,
    });
  }

  return pieces;
}
