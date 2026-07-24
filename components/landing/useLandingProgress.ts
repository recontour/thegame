"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Maps wheel + touch swipe into a smoothed 0..1 story progress.
 * Ref for GPU each frame; React state throttled for DOM UI.
 */
export function useLandingProgress(options?: {
  /** When true, ignore input (e.g. reduced motion static end state). */
  disabled?: boolean;
}) {
  const disabled = options?.disabled ?? false;
  const targetRef = useRef(0);
  const currentRef = useRef(0);
  const [uiProgress, setUiProgress] = useState(0);
  const touchingRef = useRef(false);
  const lastYRef = useRef<number | null>(null);
  const lastUiEmit = useRef(0);

  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

  const addDelta = useCallback(
    (delta: number) => {
      if (disabled) return;
      // delta > 0 = swipe/scroll up through the story
      targetRef.current = clamp01(targetRef.current + delta);
    },
    [disabled],
  );

  useEffect(() => {
    if (disabled) {
      targetRef.current = 1;
      currentRef.current = 1;
      setUiProgress(1);
      return;
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Natural: scroll down / swipe content up advances story
      const dy = e.deltaY;
      addDelta(dy * 0.00115);
    };

    const onTouchStart = (e: TouchEvent) => {
      touchingRef.current = true;
      lastYRef.current = e.touches[0]?.clientY ?? null;
    };

    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      if (y == null || lastYRef.current == null) return;
      const dy = lastYRef.current - y; // finger up → positive
      lastYRef.current = y;
      // Prevent rubber-band fighting our story
      if (Math.abs(dy) > 0.5) e.preventDefault();
      addDelta(dy * 0.0024);
    };

    const onTouchEnd = () => {
      touchingRef.current = false;
      lastYRef.current = null;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === " ") {
        e.preventDefault();
      }
      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
        addDelta(0.08);
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        addDelta(-0.08);
      } else if (e.key === "Home") {
        targetRef.current = 0;
      } else if (e.key === "End") {
        targetRef.current = 1;
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [addDelta, disabled]);

  /** Call from rAF / useFrame — returns smoothed progress. */
  const tick = useCallback((dt: number) => {
    const t = targetRef.current;
    const c = currentRef.current;
    // Critically damped-ish follow
    const alpha = 1 - Math.exp(-10 * Math.min(dt, 0.064));
    const next = c + (t - c) * alpha;
    currentRef.current = next;

    const now = performance.now();
    if (now - lastUiEmit.current > 48) {
      lastUiEmit.current = now;
      setUiProgress((prev) => (Math.abs(next - prev) > 0.012 ? next : prev));
    }
    return next;
  }, []);

  const getProgress = useCallback(() => currentRef.current, []);
  const getTarget = useCallback(() => targetRef.current, []);

  return {
    uiProgress,
    tick,
    getProgress,
    getTarget,
    addDelta,
  };
}

export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
