export type ScatterPiece = {
  /** percent 0–100 of the stage */
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
 * One rest pose per photo — large overlapping tiles for a full-bleed mess.
 * `seed` lets demoted images land in a fresh spot each time.
 */
export function scatterForIndex(i: number, count: number, seed = 0): ScatterPiece {
  const s = i * 17 + seed * 31;
  const a = hash(s, 1);
  const b = hash(s, 2);
  const c = hash(s, 3);
  const d = hash(s, 4);

  // Distribute across a loose grid so 8 large tiles still carpet the screen
  const cols = Math.min(3, Math.max(2, Math.ceil(Math.sqrt(count))));
  const rows = Math.ceil(count / cols);
  const col = i % cols;
  const row = Math.floor(i / cols);
  const cellW = 100 / cols;
  const cellH = 100 / rows;

  const left = col * cellW + a * cellW * 0.9 - 12 + hash(s, 5) * 8;
  const top = row * cellH + b * cellH * 0.9 - 14 + hash(s, 6) * 10;

  return {
    left,
    top,
    width: 54 + c * 30, // ~54–84vw — denser carpet
    rotate: -26 + d * 52,
    opacity: 0.42 + hash(s, 7) * 0.08,
    zIndex: 2 + Math.floor(hash(s, 8) * 10),
    driftX: 5 + hash(s, 9) * 10,
    driftY: 4 + hash(s, 10) * 10,
    driftDur: 8 + hash(s, 11) * 8,
  };
}

export function buildScatter(count: number, seed = 0): ScatterPiece[] {
  return Array.from({ length: count }, (_, i) =>
    scatterForIndex(i, count, seed),
  );
}
