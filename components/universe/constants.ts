/**
 * World-space Earth radius (sphere radius 1 × mesh scale).
 * Kept large so the globe fills the portrait stage nicely.
 */
export const EARTH_RADIUS = 0.45;

/**
 * Portrait FOV is skinny — a true 3.17× GPS ring would sit off-screen
 * if Earth is this big. We keep real ratios for the *lesson labels*,
 * but map altitudes into a band that fits the phone column.
 *
 * True GPS ≈ 3.17 × R. On this stage the visible “GPS” ring uses
 * GPS_ORBIT_MULT so kids can still place the sat and see the answer.
 */
export const SAT_MIN_MULT = 1.15;
/** Soft outer drag cap (still mostly on-screen) */
export const SAT_MAX_MULT = 1.85;
/**
 * Visual GPS height for this frame.
 * (Real-world GPS is ~3.17× — compressed so the ring fits the column.)
 */
export const GPS_ORBIT_MULT = 1.58;

export const SAT_MIN_RADIUS = EARTH_RADIUS * SAT_MIN_MULT;
export const SAT_MAX_RADIUS = EARTH_RADIUS * SAT_MAX_MULT;
export const GPS_ORBIT_RADIUS = EARTH_RADIUS * GPS_ORBIT_MULT;

/**
 * Starting guess — right of Earth, slightly up, clearly on-screen.
 */
export const SAT_START = {
  x: EARTH_RADIUS * 1.48,
  y: EARTH_RADIUS * 0.35,
  z: 0,
} as const;

/** Camera distance — original Earth framing feel */
export const CAMERA_Z = 3.25;
