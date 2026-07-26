"use client";

import { useEffect, useRef } from "react";

type Options = {
  enabled?: boolean;
  /** Swipe up → next; swipe down → prev */
  onNext: () => void;
  onPrev: () => void;
  /** Optional live drag (px, positive = finger down) while gesturing */
  onDrag?: (deltaY: number, active: boolean) => void;
  threshold?: number;
  /** Element to attach listeners; defaults to window */
  targetRef?: React.RefObject<HTMLElement | null>;
};

/**
 * Vertical swipe / drag for carousel navigation.
 * Touch + mouse (pointer events). Keyboard ↑/↓ as accessibility fallback only —
 * primary UX is swipe. Prevents scroll bounce while dragging on the target.
 */
export function useVerticalSwipe({
  enabled = true,
  onNext,
  onPrev,
  onDrag,
  threshold = 52,
  targetRef,
}: Options) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const locked = useRef<"h" | "v" | null>(null);
  const handlers = useRef({ onNext, onPrev, onDrag });

  useEffect(() => {
    handlers.current = { onNext, onPrev, onDrag };
  }, [onNext, onPrev, onDrag]);

  useEffect(() => {
    if (!enabled) return;

    const el: HTMLElement | Window = targetRef?.current ?? window;
    const root = el instanceof Window ? window : el;

    const onDown = (e: Event) => {
      const pe = e as PointerEvent;
      if (pe.pointerType === "mouse" && pe.button !== 0) return;
      start.current = { x: pe.clientX, y: pe.clientY, t: performance.now() };
      locked.current = null;
      try {
        (root as HTMLElement).setPointerCapture?.(pe.pointerId);
      } catch {
        /* window has no capture */
      }
    };

    const onMove = (e: Event) => {
      if (!start.current) return;
      const pe = e as PointerEvent;
      const dx = pe.clientX - start.current.x;
      const dy = pe.clientY - start.current.y;

      if (!locked.current) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        locked.current = Math.abs(dy) >= Math.abs(dx) * 0.9 ? "v" : "h";
      }

      if (locked.current === "v") {
        if (e.cancelable) e.preventDefault();
        handlers.current.onDrag?.(dy, true);
      }
    };

    const onUp = (e: Event) => {
      if (!start.current) return;
      const pe = e as PointerEvent;
      const dy = pe.clientY - start.current.y;
      const dt = performance.now() - start.current.t;
      const wasVertical = locked.current === "v";
      start.current = null;
      locked.current = null;
      handlers.current.onDrag?.(0, false);

      if (!wasVertical) return;

      const velocity = Math.abs(dy) / Math.max(dt, 1);
      const distanceOk = Math.abs(dy) >= threshold;
      const flickOk = Math.abs(dy) >= threshold * 0.5 && velocity > 0.4;
      if (!distanceOk && !flickOk) return;

      // Finger up (negative dy) → next; finger down → prev
      if (dy < 0) handlers.current.onNext();
      else handlers.current.onPrev();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        handlers.current.onNext();
      } else if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        handlers.current.onPrev();
      }
    };

    const opts = { passive: false } as AddEventListenerOptions;
    root.addEventListener("pointerdown", onDown, opts);
    root.addEventListener("pointermove", onMove, opts);
    root.addEventListener("pointerup", onUp, opts);
    root.addEventListener("pointercancel", onUp, opts);
    window.addEventListener("keydown", onKey);

    return () => {
      root.removeEventListener("pointerdown", onDown);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerup", onUp);
      root.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKey);
    };
  }, [enabled, threshold, targetRef]);
}
