/**
 * World-space Earth radius — large, fixed for the whole lesson.
 * (No reveal scale-down.)
 */
export const EARTH_RADIUS = 0.42;

/**
 * Soft floor only — keep the sat outside the planet.
 * No outer orbit cap while dragging: user can place anywhere on screen.
 */
export const SAT_MIN_MULT = 1.12;

/**
 * Softened GPS orbital radius from Earth's center for this portrait frame.
 * True GPS is ~3.7–4.17× R; here we sit near the edge of the phone column
 * so the ring stays on-screen with a big fixed Earth.
 */
export const GPS_ORBIT_MULT = 1.42;

export const SAT_MIN_RADIUS = EARTH_RADIUS * SAT_MIN_MULT;
export const GPS_ORBIT_RADIUS = EARTH_RADIUS * GPS_ORBIT_MULT;

/**
 * Starting guess — above Earth, centered, still inside the portrait FOV.
 * Camera tracks Earth face-on; half-height @ Z=3.2 is ~1.32, so stay below that.
 */
export const SAT_START = {
  x: 0,
  y: 0.92,
  z: 0,
} as const;

/** Fixed framing at the start of the lesson */
export const CAMERA_Z = 3.2;
export const CAMERA_FOV = 45;

/**
 * After welcome: ease Earth + sat down a bit so the globe sits
 * just above the drag prompt (portrait column stack).
 */
export const EARTH_PROMPT_OFFSET_Y = -0.34;

/**
 * After moon snap (zoomed out): pin Earth lower in the column so it
 * matches the pre-zoom *screen* placement — not dead-center of the void.
 * Tuned for ZOOM_Z_FRAME.
 */
export const EARTH_MOON_OFFSET_Y = -0.95;

// ─── Zoom (moon beat) ───────────────────────────────────────────────
/** Closest zoom (lesson default) */
export const ZOOM_Z_MIN = CAMERA_Z;
/**
 * Farthest zoom-out — Earth still readable on a phone, not a speck.
 */
export const ZOOM_Z_MAX = 9.2;
/** Each + / − step */
export const ZOOM_Z_STEP = 0.95;
/**
 * Framing Z when the Moon settles — keep size small enough to show both,
 * but don’t pull back further than the user’s max zoom.
 */
export const ZOOM_Z_FRAME = 8.4;

// ─── Moon ───────────────────────────────────────────────────────────
/**
 * True mean Moon distance ≈ 60.3 × Earth radius — too far for a phone frame.
 * Lesson distance: clearly beyond GPS (~1.42 R), still on-screen at ZOOM_Z_FRAME
 * with Earth pinned low (EARTH_MOON_OFFSET_Y).
 *
 * half-height @ 8.4 ≈ 3.48 → moon world y ≈ offset + dist should sit ~1.4–1.8
 * → dist ≈ 2.4–2.7 → mult ≈ 5.7–6.4
 */
export const MOON_DISTANCE_MULT = 5.8;
export const MOON_DISTANCE = EARTH_RADIUS * MOON_DISTANCE_MULT;

/** Soft floor while dragging the Moon (outside Earth) */
export const MOON_MIN_RADIUS = EARTH_RADIUS * 1.2;

/**
 * Where the grayed Moon waits before Confirm — upper column, easy to see.
 */
export const MOON_START = {
  x: 0,
  y: 0.95,
  z: 0,
} as const;


