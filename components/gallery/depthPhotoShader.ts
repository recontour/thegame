/**
 * Reserved for a future *subtle* atmosphere pass.
 * Gallery currently uses MeshBasicMaterial so photos stay sharp and mobile-stable.
 *
 * When re-enabling shader effects:
 * - keep chromatic aberration under ~0.001 when velocity ≈ 0
 * - never shift UVs enough to crop or rainbow-split the frame
 * - prefer opacity / gentle grain over RGB split
 */

export const DEPTH_FX_ENABLED = false;
