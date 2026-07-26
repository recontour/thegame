/** Clamp 0..1 */
export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Smoothstep (Hermite) */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * Critically-damped-ish spring toward target.
 * `lambda` ~ 8–14 feels floaty; higher snaps faster.
 */
export function springStep(
  current: number,
  target: number,
  dt: number,
  lambda = 10,
): number {
  const t = 1 - Math.exp(-lambda * dt);
  return current + (target - current) * t;
}
