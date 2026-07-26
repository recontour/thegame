/**
 * Lightweight capability probe for mid-range / weak Android.
 * Prefer under-estimating power — effects stay cheap by default.
 */

export type DeviceTier = "low" | "mid" | "high";

export type StoryCapability = {
  tier: DeviceTier;
  /** Pixel ratio for WebGL canvas */
  dpr: number;
  /** Star particle count */
  starCount: number;
  /** High-res texture max edge (GPU upload) */
  highTexSize: number;
  /** Placeholder / distant card max edge */
  lowTexSize: number;
  /** How many neighbors load high-res (±N) */
  highNeighborRadius: number;
  /** How many neighbors keep a low-res placeholder (±N) */
  lowNeighborRadius: number;
  /** Soft haze plane (cheap; skip on weakest) */
  haze: boolean;
  /** Idle float amplitude multiplier */
  floatAmp: number;
};

function isMobileUA(): boolean {
  if (typeof window === "undefined") return true;
  const ua = navigator.userAgent || "";
  const touch =
    "ontouchstart" in window ||
    (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
  const small = Math.min(window.innerWidth, window.innerHeight) < 820;
  return /iPhone|iPad|iPod|Android/i.test(ua) || Boolean(touch && small);
}

/**
 * Call once on the client. Avoids WebGL context creation here
 * (R3F will create one) — uses coarse signals only.
 */
export function detectStoryCapability(): StoryCapability {
  if (typeof window === "undefined") {
    return {
      tier: "mid",
      dpr: 1,
      starCount: 180,
      highTexSize: 1024,
      lowTexSize: 256,
      highNeighborRadius: 1,
      lowNeighborRadius: 2,
      haze: true,
      floatAmp: 1,
    };
  }

  const cores = navigator.hardwareConcurrency || 4;
  const mem =
    (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const mobile = isMobileUA();

  // Very weak: old Android / few cores / little RAM
  const low = mobile && (cores <= 4 || mem <= 2);
  // Strong: desktop or recent phone
  const high = !mobile && cores >= 8 && mem >= 8;

  if (low) {
    return {
      tier: "low",
      dpr: 1,
      starCount: 90,
      highTexSize: 768,
      lowTexSize: 192,
      highNeighborRadius: 1,
      lowNeighborRadius: 1,
      haze: false,
      floatAmp: 0.7,
    };
  }

  if (high) {
    return {
      tier: "high",
      dpr: Math.min(window.devicePixelRatio || 1, 1.5),
      starCount: 320,
      highTexSize: 1280,
      lowTexSize: 320,
      highNeighborRadius: 1,
      lowNeighborRadius: 3,
      haze: true,
      floatAmp: 1,
    };
  }

  // Mid-range Android / average phones — primary target
  return {
    tier: "mid",
    dpr: 1,
    starCount: 160,
    highTexSize: 1024,
    lowTexSize: 256,
    highNeighborRadius: 1,
    lowNeighborRadius: 2,
    haze: true,
    floatAmp: 1,
  };
}
