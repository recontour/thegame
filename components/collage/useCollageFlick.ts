"use client";

import { useEffect, useRef } from "react";

type Options = {
  enabled?: boolean;
  onNext?: () => void;
  onPrev?: () => void;
  threshold?: number;
};

/**
 * Vertical flick / wheel for collage navigation.
 * Up / wheel down → next. Down / wheel up → previous.
 */
export function useCollageFlick({
  enabled = true,
  onNext,
  onPrev,
  threshold = 42,
}: Options) {
  const handlers = useRef({ onNext, onPrev });
  handlers.current = { onNext, onPrev };

  useEffect(() => {
    if (!enabled) return;

    let startY: number | null = null;
    let startX: number | null = null;
    let locked: "v" | "h" | null = null;
    let lastWheel = 0;

    const onPointerDown = (e: PointerEvent) => {
      startY = e.clientY;
      startX = e.clientX;
      locked = null;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (startY == null || startX == null || locked) return;
      const dy = e.clientY - startY;
      const dx = e.clientX - startX;
      if (Math.abs(dy) < 12 && Math.abs(dx) < 12) return;
      locked = Math.abs(dy) >= Math.abs(dx) * 1.05 ? "v" : "h";
    };

    const onPointerUp = (e: PointerEvent) => {
      if (startY == null) return;
      const dy = e.clientY - startY;
      const vertical = locked === "v" || locked === null;
      startY = null;
      startX = null;
      locked = null;
      if (!vertical) return;
      if (dy < -threshold) handlers.current.onNext?.();
      else if (dy > threshold) handlers.current.onPrev?.();
    };

    const onWheel = (e: WheelEvent) => {
      const now = performance.now();
      if (now - lastWheel < 420) return;
      if (Math.abs(e.deltaY) < 10) return;
      lastWheel = now;
      if (e.deltaY > 0) handlers.current.onNext?.();
      else handlers.current.onPrev?.();
    };

    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerUp, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });

    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("wheel", onWheel);
    };
  }, [enabled, threshold]);
}
