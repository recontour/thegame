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
   * Minimum *vertical* travel (px) to count as a committed swipe.
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
 * Vertical-only story beats for a stepped (not free-scroll) experience.
 *
 * Design (esp. iOS):
 *  • There is no horizontal mode. Diagonals count as up/down by dy only.
 *  • We never “discard” a gesture for being a bit sideways — that killed
 *    Android-fine / iPhone-broken clients in the past.
 *  • touch-action: none + non-passive preventDefault so Safari can’t steal
 *    edge swipes / rubber-band the page.
 *  • Pointer + Touch listeners: iOS Safari is flaky on pointer-only paths.
 */
export function useVerticalSwipe({
  enabled = true,
  onNext,
  onPrev,
  onDrag,
  threshold = 24,
  cooldownMs = 1400,
  targetRef,
}: Options) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  /** True once finger moved enough that we own the gesture (always vertical). */
  const armed = useRef(false);
  const handlers = useRef({ onNext, onPrev, onDrag });
  const lastBeat = useRef(0);
  const wheelAcc = useRef(0);
  const wheelReset = useRef<number | null>(null);
  /** Track last known point for touchcancel path */
  const lastY = useRef(0);

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

    const begin = (x: number, y: number, t: number) => {
      start.current = { x, y, t };
      lastY.current = y;
      armed.current = false;
    };

    const move = (x: number, y: number, e: Event) => {
      if (!start.current) return;
      const dx = x - start.current.x;
      const dy = y - start.current.y;
      lastY.current = y;

      // Arm on tiny movement — do NOT require |dy| >> |dx|
      if (!armed.current) {
        if (Math.hypot(dx, dy) < 6) return;
        armed.current = true;
      }

      // Always claim the gesture from the browser (iOS back / overscroll)
      if (e.cancelable) e.preventDefault();

      // Parallax hint uses vertical component only
      handlers.current.onDrag?.(dy, true);
    };

    const end = (x: number, y: number) => {
      if (!start.current) return;
      const dy = y - start.current.y;
      const dx = x - start.current.x;
      const dt = performance.now() - start.current.t;
      const wasArmed = armed.current;
      start.current = null;
      armed.current = false;
      handlers.current.onDrag?.(0, false);

      if (!wasArmed) return;

      // Direction = vertical only. Sideways is ignored for *direction*,
      // not for discarding the swipe.
      const distY = Math.abs(dy);
      const distX = Math.abs(dx);

      // Pure sideways with almost no vertical → ignore (not a story beat).
      // Everything else with a vertical component is up/down.
      if (distY < 8 && distX > distY * 2.5) return;

      const velocity = distY / Math.max(dt, 1); // px/ms
      const distanceOk = distY >= threshold;
      const flickOk = distY >= threshold * 0.4 && velocity > 0.15;
      const snapOk = distY >= 12 && velocity > 0.4;
      // Diagonal: total path was intentional even if dy is a bit short
      const diagonalOk =
        Math.hypot(dx, dy) >= threshold * 1.1 && distY >= threshold * 0.35;

      if (!distanceOk && !flickOk && !snapOk && !diagonalOk) return;

      // Finger up (negative dy) → next; finger down → prev
      tryBeat(dy < 0 ? "next" : "prev");
    };

    // —— Pointer (desktop + most mobile) ——
    const onPointerDown = (e: Event) => {
      const pe = e as PointerEvent;
      if (pe.pointerType === "mouse" && pe.button !== 0) return;
      begin(pe.clientX, pe.clientY, performance.now());
      try {
        (root as HTMLElement).setPointerCapture?.(pe.pointerId);
      } catch {
        /* window has no capture */
      }
    };

    const onPointerMove = (e: Event) => {
      const pe = e as PointerEvent;
      move(pe.clientX, pe.clientY, e);
    };

    const onPointerUp = (e: Event) => {
      const pe = e as PointerEvent;
      end(pe.clientX, pe.clientY);
    };

    // —— Touch backup (iOS Safari is happier with these + non-passive) ——
    const onTouchStart = (e: Event) => {
      const te = e as TouchEvent;
      if (te.touches.length !== 1) return;
      const t = te.touches[0];
      begin(t.clientX, t.clientY, performance.now());
    };

    const onTouchMove = (e: Event) => {
      const te = e as TouchEvent;
      if (te.touches.length !== 1) return;
      const t = te.touches[0];
      move(t.clientX, t.clientY, e);
    };

    const onTouchEnd = (e: Event) => {
      const te = e as TouchEvent;
      // changedTouches has the finger that lifted
      const t = te.changedTouches[0];
      if (!t) {
        end(0, lastY.current);
        return;
      }
      end(t.clientX, t.clientY);
    };

    const onWheel = (e: Event) => {
      const we = e as WheelEvent;
      if (e.cancelable) e.preventDefault();

      wheelAcc.current += we.deltaY;

      if (wheelReset.current != null) window.clearTimeout(wheelReset.current);
      wheelReset.current = window.setTimeout(() => {
        wheelAcc.current = 0;
      }, 160);

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
    root.addEventListener("pointerdown", onPointerDown, opts);
    root.addEventListener("pointermove", onPointerMove, opts);
    root.addEventListener("pointerup", onPointerUp, opts);
    root.addEventListener("pointercancel", onPointerUp, opts);
    root.addEventListener("touchstart", onTouchStart, opts);
    root.addEventListener("touchmove", onTouchMove, opts);
    root.addEventListener("touchend", onTouchEnd, opts);
    root.addEventListener("touchcancel", onTouchEnd, opts);
    root.addEventListener("wheel", onWheel, opts);
    window.addEventListener("keydown", onKey);

    return () => {
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerup", onPointerUp);
      root.removeEventListener("pointercancel", onPointerUp);
      root.removeEventListener("touchstart", onTouchStart);
      root.removeEventListener("touchmove", onTouchMove);
      root.removeEventListener("touchend", onTouchEnd);
      root.removeEventListener("touchcancel", onTouchEnd);
      root.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      if (wheelReset.current != null) window.clearTimeout(wheelReset.current);
    };
  }, [enabled, threshold, cooldownMs, targetRef]);
}
