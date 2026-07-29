/**
 * World-space Earth radius — large, fixed for the whole lesson.
 * (No reveal scale-down. Camera stays put.)
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
 * Starting guess — near the top of the phone column (centered).
 * Local Y is high so after the planet stack eases down it still sits up top.
 */
export const SAT_START = {
  x: 0,
  y: 1.48,
  z: 0,
} as const;

/** Fixed framing — Earth stays large; no pull-back on reveal */
export const CAMERA_Z = 3.2;
export const CAMERA_FOV = 45;

/**
 * After welcome: ease Earth + sat down a bit so the globe sits
 * just above the drag prompt (portrait column stack).
 */
export const EARTH_PROMPT_OFFSET_Y = -0.34;
