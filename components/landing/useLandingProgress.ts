"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Maps wheel + touch swipe into a smoothed 0..1 story progress.
 * Ref for GPU each frame; React state throttled for DOM UI.
 */
export function useLandingProgress(options?: {
  /** When true, jump to end (e.g. reduced motion). */
  disabled?: boolean;
  /** When true, ignore progress changes (hard lock). */
  locked?: boolean;
  /** Fires on any scroll/swipe/key intent — used to snap intro pieces early. */
  onScrollIntent?: () => void;
}) {
  const disabled = options?.disabled ?? false;
  const locked = options?.locked ?? false;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;

  const onIntentRef = useRef(options?.onScrollIntent);
  onIntentRef.current = options?.onScrollIntent;

  const targetRef = useRef(0);
  const currentRef = useRef(0);
  const [uiProgress, setUiProgress] = useState(0);
  const lastYRef = useRef<number | null>(null);
  const lastUiEmit = useRef(0);

  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

  const addDelta = useCallback(
    (delta: number) => {
      if (disabled) return;
      if (delta === 0) return;

      // Always notify — intro can snap pieces even while story is locked
      onIntentRef.current?.();

      if (lockedRef.current) return;
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
      addDelta(e.deltaY * 0.00115);
    };

    const onTouchStart = (e: TouchEvent) => {
      lastYRef.current = e.touches[0]?.clientY ?? null;
    };

    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      if (y == null || lastYRef.current == null) return;
      const dy = lastYRef.current - y;
      lastYRef.current = y;
      if (Math.abs(dy) > 0.5) e.preventDefault();
      addDelta(dy * 0.0024);
    };

    const onTouchEnd = () => {
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
        onIntentRef.current?.();
        if (!lockedRef.current) targetRef.current = 0;
      } else if (e.key === "End") {
        onIntentRef.current?.();
        if (!lockedRef.current) targetRef.current = 1;
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

  const tick = useCallback((dt: number) => {
    const t = targetRef.current;
    const c = currentRef.current;
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
