"use client";

import { useEffect, useRef } from "react";

type Options = {
  enabled?: boolean;
  /** Flick / swipe up → next beat */
  onNext: () => void;
  onPrev: () => void;
  /** Optional live drag (px, positive = finger down) while gesturing */
  onDrag?: (deltaY: number, active: boolean) => void;
  /**
   * Minimum vertical travel (px) to count as a committed swipe.
   * Kept low — gesture is a *trigger*, not a distance scrubber.
   */
  threshold?: number;
  /**
   * Minimum ms between accepted beats (lets the slow animation breathe).
   * Does not make the swipe harder — only blocks double-fires.
   */
  cooldownMs?: number;
  /** Element to attach listeners; defaults to window */
  targetRef?: React.RefObject<HTMLElement | null>;
};

/**
 * Vertical swipe for stepped story navigation.
 *
 * Intention: a light flick up/down is enough. We are NOT measuring a long
 * drag-to-scroll — distance thresholds stay small; velocity helps short flicks.
 * Cooldown only prevents stacking beats while a slow transition is mid-flight.
 */
export function useVerticalSwipe({
  enabled = true,
  onNext,
  onPrev,
  onDrag,
  threshold = 28,
  cooldownMs = 1400,
  targetRef,
}: Options) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const locked = useRef<"h" | "v" | null>(null);
  const handlers = useRef({ onNext, onPrev, onDrag });
  const lastBeat = useRef(0);
  const wheelAcc = useRef(0);
  const wheelReset = useRef<number | null>(null);

  useEffect(() => {
    handlers.current = { onNext, onPrev, onDrag };
  }, [onNext, onPrev, onDrag]);

  useEffect(() => {
    if (!enabled) return;

    const el: HTMLElement | Window = targetRef?.current ?? window;
    const root = el instanceof Window ? window : el;

    const tryBeat = (dir: "next" | "prev") => {
      const now = performance.now();
      if (now - lastBeat.current < cooldownMs) return false;
      lastBeat.current = now;
      if (dir === "next") handlers.current.onNext();
      else handlers.current.onPrev();
      return true;
    };

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
        // Lock axis early so a short flick still counts as vertical
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        locked.current = Math.abs(dy) >= Math.abs(dx) * 0.75 ? "v" : "h";
      }

      if (locked.current === "v") {
        if (e.cancelable) e.preventDefault();
        // Drag is only a light parallax hint — not the commit mechanism
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

      const dist = Math.abs(dy);
      const velocity = dist / Math.max(dt, 1); // px/ms

      // Trigger logic — short intentional flick is enough:
      //  • distance ≥ threshold, OR
      //  • quick flick (≥ ~half threshold + mild velocity)
      //  • very snappy flick (even less distance if fast)
      const distanceOk = dist >= threshold;
      const flickOk = dist >= threshold * 0.45 && velocity > 0.18;
      const snapOk = dist >= 14 && velocity > 0.45;
      if (!distanceOk && !flickOk && !snapOk) return;

      // Finger up (negative dy) → next; finger down → prev
      tryBeat(dy < 0 ? "next" : "prev");
    };

    const onWheel = (e: Event) => {
      const we = e as WheelEvent;
      if (e.cancelable) e.preventDefault();

      wheelAcc.current += we.deltaY;

      if (wheelReset.current != null) window.clearTimeout(wheelReset.current);
      wheelReset.current = window.setTimeout(() => {
        wheelAcc.current = 0;
      }, 160);

      // Low accum — one notch / small trackpad gesture = one beat
      if (Math.abs(wheelAcc.current) < 18) return;
      const dir = wheelAcc.current > 0 ? "next" : "prev";
      if (tryBeat(dir)) wheelAcc.current = 0;
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        tryBeat("next");
      } else if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        tryBeat("prev");
      }
    };

    const opts = { passive: false } as AddEventListenerOptions;
    root.addEventListener("pointerdown", onDown, opts);
    root.addEventListener("pointermove", onMove, opts);
    root.addEventListener("pointerup", onUp, opts);
    root.addEventListener("pointercancel", onUp, opts);
    root.addEventListener("wheel", onWheel, opts);
    window.addEventListener("keydown", onKey);

    return () => {
      root.removeEventListener("pointerdown", onDown);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerup", onUp);
      root.removeEventListener("pointercancel", onUp);
      root.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      if (wheelReset.current != null) window.clearTimeout(wheelReset.current);
    };
  }, [enabled, threshold, cooldownMs, targetRef]);
}
