"use client";

/**
 * Small HTML label near the GPS orbit ring (bottom of portrait stage).
 */
export default function OrbitLabel({ visible }: { visible: boolean }) {
  return (
    <div
      className={`universe-orbit-label${visible ? " visible" : ""}`}
      aria-hidden={!visible}
    >
      Actual GPS orbit
    </div>
  );
}
