"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export type VirtualScrollState = {
  /** Smoothed 0–1 progress through the experience */
  progress: number;
  /** Instantaneous scroll speed (abs), damped — drives glitch intensity */
  velocity: number;
};

type Options = {
  enabled?: boolean;
  /** How much wheel/touch delta maps into progress */
  sensitivity?: number;
  /** Higher = snappier camera follow */
  damp?: number;
  onProgress?: (progress: number) => void;
};

/**
 * Virtual vertical scroll for a fixed full-screen canvas.
 * Touch + wheel. Progress is smoothed; velocity peaks on fast flicks.
 */
export function useVirtualScroll({
  enabled = true,
  sensitivity = 0.00115,
  damp = 3.2,
  onProgress,
}: Options = {}) {
  const target = useRef(0);
  const current = useRef(0);
  const velocity = useRef(0);
  const state = useRef<VirtualScrollState>({ progress: 0, velocity: 0 });
  const touchY = useRef<number | null>(null);
  const lastTouchY = useRef<number | null>(null);
  const lastTouchT = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const clamp01 = (v: number) => THREE.MathUtils.clamp(v, 0, 1);

    const onWheel = (e: WheelEvent) => {
      // Allow page to stay locked; we own the scroll metaphor
      e.preventDefault();
      const dy = e.deltaY;
      target.current = clamp01(target.current + dy * sensitivity);
      velocity.current = Math.min(1, Math.abs(dy) * 0.012);
    };

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      touchY.current = t.clientY;
      lastTouchY.current = t.clientY;
      lastTouchT.current = performance.now();
    };

    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t || touchY.current == null) return;
      // preventDefault needs non-passive — registered as such
      e.preventDefault();
      const y = t.clientY;
      const dy = touchY.current - y;
      touchY.current = y;
      target.current = clamp01(target.current + dy * sensitivity * 1.35);

      const now = performance.now();
      const dt = Math.max(8, now - lastTouchT.current);
      if (lastTouchY.current != null) {
        const flick = Math.abs(lastTouchY.current - y) / dt;
        velocity.current = Math.min(1, velocity.current * 0.4 + flick * 18);
      }
      lastTouchY.current = y;
      lastTouchT.current = now;
    };

    const onTouchEnd = () => {
      touchY.current = null;
      lastTouchY.current = null;
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [enabled, sensitivity]);

  useFrame((_, delta) => {
    const prev = current.current;
    current.current = THREE.MathUtils.damp(
      current.current,
      target.current,
      damp,
      delta,
    );
    const dProgress = Math.abs(current.current - prev) / Math.max(delta, 1e-4);
    // Blend continuous motion into velocity, then decay
    velocity.current = Math.min(
      1,
      Math.max(velocity.current * Math.exp(-2.8 * delta), dProgress * 0.85),
    );

    state.current.progress = current.current;
    state.current.velocity = velocity.current;
    onProgress?.(current.current);
  });

  return state;
}
