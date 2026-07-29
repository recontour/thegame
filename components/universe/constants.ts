/**
 * World-space Earth radius (sphere radius 1 × mesh scale).
 */
export const EARTH_RADIUS = 0.42;

/** Soft floor — keep sat / moon outside the planet. */
export const SAT_MIN_MULT = 1.12;

/**
 * Softened GPS orbital radius for the portrait frame.
 * (Real GPS ≈ 4.17× R from center.)
 */
export const GPS_ORBIT_MULT = 1.42;

export const SAT_MIN_RADIUS = EARTH_RADIUS * SAT_MIN_MULT;
export const GPS_ORBIT_RADIUS = EARTH_RADIUS * GPS_ORBIT_MULT;

/**
 * Idle park — roughly between the top GPS copy and Earth
 * (Earth is optically lower via view bias).
 */
export const SAT_START = {
  x: 0,
  y: 1.05,
  z: 0,
} as const;

/**
 * Default face-on distance for Earth + sat placement.
 * Tuned so the globe fits the portrait column (about two “+” clicks
 * from the old too-close 3.4) without crowding the edges.
 */
export const CAMERA_Z = 6.15;
export const CAMERA_FOV = 45;

/**
 * Projection bias: Earth in the *lower half* of the column, not dead center,
 * but not glued to the bottom edge either. Face-on lookAt stays at origin.
 * 0 = centered · higher = lower on screen.
 */
export const EARTH_SCREEN_BIAS = 0.4;

// ─── Zoom ───────────────────────────────────────────────────────────
export const ZOOM_Z_MIN = CAMERA_Z;
/** Allow user zoom past the moon-settle frame if they want */
export const ZOOM_Z_MAX = 42;
export const ZOOM_Z_STEP = 1.4;

/**
 * True-scale lesson distance: 15 × Earth *diameter* = 30 × Earth radius.
 * (Real Moon ≈ 60 R — still farther; this is the requested teaching ratio.)
 * Do NOT shrink this to “fit” — pull the camera back instead.
 */
export const MOON_DISTANCE_MULT = 30;
export const MOON_DISTANCE = EARTH_RADIUS * MOON_DISTANCE_MULT;

/**
 * Camera Z after Moon snap — zoom out until 30× R fits under the top of FOV.
 *
 * With EARTH_SCREEN_BIAS view-offset, visible top ≈ z * tan(fov/2):
 *   MOON_DISTANCE = 30 * 0.42 = 12.6
 *   need z * tan(22.5°) ≳ 12.6 + moon disc ≈ 12.8
 *   z ≳ 12.8 / 0.414 ≈ 31
 * Use a little headroom so the disc isn’t clipped.
 */
export const ZOOM_Z_MOON_FRAME = 34;

export const MOON_MIN_RADIUS = EARTH_RADIUS * 1.2;

export const MOON_START = {
  x: 0,
  y: 0.85,
  z: 0,
} as const;
