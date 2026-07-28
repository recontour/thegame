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

/**
 * SmoothDamp (Game Programming Gems style) — second-order ease.
 * No hard overshoot kill: that felt like a "snap into place" on mobile.
 * Velocity simply bleeds out as we approach the target.
 */
export function smoothDamp(
  current: number,
  target: number,
  velocity: number,
  smoothTime: number,
  dt: number,
  maxSpeed = Infinity,
): { value: number; velocity: number } {
  const st = Math.max(0.0001, smoothTime);
  const omega = 2 / st;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  let change = current - target;
  const maxChange = maxSpeed * st;
  change = Math.max(-maxChange, Math.min(maxChange, change));
  const temp = (velocity + omega * change) * dt;
  let newVel = (velocity - omega * temp) * exp;
  let newVal = target + (change + temp) * exp;

  // Soft park when basically there — no hard snap of value/velocity
  const err = newVal - target;
  if (Math.abs(err) < 1e-5 && Math.abs(newVel) < 1e-4) {
    return { value: target, velocity: 0 };
  }
  return { value: newVal, velocity: newVel };
}
