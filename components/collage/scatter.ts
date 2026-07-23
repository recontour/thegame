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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** Keep tile centers inside the viewport band so tops/bottoms don't fly off */
const TOP_MIN = 18;
const TOP_MAX = 82;
const LEFT_MIN = -6;
const LEFT_MAX = 106;

/**
 * Exactly one home pose per photo.
 * Tight vertical stack inside ~100vh; sides may bleed a little.
 */
export function buildHomeLayout(photoCount: number): ScatterPiece[] {
  if (photoCount <= 0) return [];

  // 12 → 4 cols × 3 rows, packed into the vertical band
  const COLS = photoCount <= 6 ? 3 : photoCount <= 9 ? 3 : 4;
  const ROWS = Math.ceil(photoCount / COLS);

  return Array.from({ length: photoCount }, (_, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const s = i * 17 + 3;

    const cellW = 100 / COLS;
    // Vertical band is tighter than full height
    const bandTop = TOP_MIN;
    const bandH = TOP_MAX - TOP_MIN;
    const cellH = bandH / ROWS;

    const left = clamp(
      col * cellW + cellW * 0.5 + (hash(s, 1) - 0.5) * cellW * 0.35,
      LEFT_MIN,
      LEFT_MAX,
    );

    const top = clamp(
      bandTop +
        row * cellH +
        cellH * 0.5 +
        (hash(s, 2) - 0.5) * cellH * 0.25,
      TOP_MIN,
      TOP_MAX,
    );

    // Slightly smaller so rotated tiles stay mostly on-screen vertically
    const width = 36 + hash(s, 3) * 16; // ~36–52vw

    return {
      photoIndex: i,
      left,
      top,
      width,
      // Gentler rotation = less corner overshoot top/bottom
      rotate: -14 + hash(s, 4) * 28,
      opacity: 0.82 + hash(s, 5) * 0.1,
      zIndex: 2 + i,
      driftX: 5 + hash(s, 6) * 8,
      // Tiny vertical drift so they don't walk out of frame
      driftY: 2 + hash(s, 7) * 3,
      driftDur: 10 + hash(s, 8) * 6,
    };
  });
}

/**
 * Demote back near the same home — small nudge, still clamped vertically.
 */
export function homeWithNudge(
  home: ScatterPiece,
  seed: number,
): ScatterPiece {
  const s = home.photoIndex * 31 + seed * 13;
  return {
    ...home,
    left: clamp(home.left + (hash(s, 1) - 0.5) * 5, LEFT_MIN, LEFT_MAX),
    top: clamp(home.top + (hash(s, 2) - 0.5) * 3, TOP_MIN, TOP_MAX),
    rotate: home.rotate + (hash(s, 3) - 0.5) * 6,
    width: home.width + (hash(s, 4) - 0.5) * 3,
    opacity: 0.82 + hash(s, 5) * 0.1,
  };
}
