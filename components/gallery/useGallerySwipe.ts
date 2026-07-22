"use client";

import { useEffect, useRef } from "react";

type SwipeHandlers = {
  enabled?: boolean;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  /** Horizontal distance (px) to count as a swipe */
  threshold?: number;
  /** Ignore mostly-vertical gestures */
  directionLockRatio?: number;
};

/**
 * Mobile-first horizontal swipe detector (pointer + keyboard arrows).
 * Does not call preventDefault so the browser stays happy; canvas uses touch-action: none.
 */
export function useGallerySwipe({
  enabled = true,
  onSwipeLeft,
  onSwipeRight,
  threshold = 48,
  directionLockRatio = 1.15,
}: SwipeHandlers) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const locked = useRef<"h" | "v" | null>(null);

  // keep latest handlers without re-binding listeners every render
  const handlers = useRef({ onSwipeLeft, onSwipeRight });
  handlers.current = { onSwipeLeft, onSwipeRight };

  useEffect(() => {
    if (!enabled) return;

    const onDown = (e: PointerEvent) => {
      start.current = { x: e.clientX, y: e.clientY, t: performance.now() };
      locked.current = null;
    };

    const onMove = (e: PointerEvent) => {
      if (!start.current || locked.current) return;
      const dx = e.clientX - start.current.x;
      const dy = e.clientY - start.current.y;
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      locked.current =
        Math.abs(dx) > Math.abs(dy) * directionLockRatio ? "h" : "v";
    };

    const onUp = (e: PointerEvent) => {
      if (!start.current) return;
      const dx = e.clientX - start.current.x;
      const dy = e.clientY - start.current.y;
      const dt = performance.now() - start.current.t;
      start.current = null;

      const horizontal =
        locked.current === "h" ||
        (locked.current === null &&
          Math.abs(dx) > Math.abs(dy) * directionLockRatio);

      if (!horizontal) return;

      const velocity = Math.abs(dx) / Math.max(dt, 1);
      const distanceOk = Math.abs(dx) >= threshold;
      const flickOk = Math.abs(dx) >= threshold * 0.55 && velocity > 0.45;

      if (!distanceOk && !flickOk) return;

      if (dx < 0) handlers.current.onSwipeLeft?.();
      else handlers.current.onSwipeRight?.();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handlers.current.onSwipeRight?.();
      if (e.key === "ArrowRight") handlers.current.onSwipeLeft?.();
    };

    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("pointercancel", onUp, { passive: true });
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKey);
    };
  }, [enabled, threshold, directionLockRatio]);
}
