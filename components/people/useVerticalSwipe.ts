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
   * Micro-debounce only (default ~90ms) so pointer+touch dual-firing on iOS
   * doesn’t double-step.
   */
  cooldownMs?: number;
  /** Element to attach listeners; defaults to window */
  targetRef?: React.RefObject<HTMLElement | null>;
};

/**
 * Input → discrete story beats. Not a free-scroll / physics scroller.
 *
 * Touch/pointer (mobile): one commit per finger gesture (end of swipe).
 * Wheel (PC trackpad): one commit per continuous event stream; residual
 * inertia is discarded. StoryCarousel also hard-locks until the morph settles.
 */
export function useVerticalSwipe({
  enabled = true,
  onNext,
  onPrev,
  onDrag,
  threshold = 24,
  cooldownMs = 90,
  targetRef,
}: Options) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const gestureArmed = useRef(false);
  const handlers = useRef({ onNext, onPrev, onDrag });
  const lastTouchBeat = useRef(0);
  const lastY = useRef(0);

  useEffect(() => {
    handlers.current = { onNext, onPrev, onDrag };
  }, [onNext, onPrev, onDrag]);

  // ─── TOUCH + POINTER (mobile-tuned — do not add physics here) ───
  useEffect(() => {
    if (!enabled) return;

    const el: HTMLElement | Window = targetRef?.current ?? window;
    const root = el instanceof Window ? window : el;

    const tryBeat = (dir: "next" | "prev") => {
      const now = performance.now();
      if (now - lastTouchBeat.current < cooldownMs) return false;
      lastTouchBeat.current = now;
      if (dir === "next") handlers.current.onNext();
      else handlers.current.onPrev();
      return true;
    };

    const begin = (x: number, y: number, t: number) => {
      start.current = { x, y, t };
      lastY.current = y;
      gestureArmed.current = false;
    };

    const move = (x: number, y: number, e: Event) => {
      if (!start.current) return;
      const dx = x - start.current.x;
      const dy = y - start.current.y;
      lastY.current = y;

      if (!gestureArmed.current) {
        if (Math.hypot(dx, dy) < 6) return;
        gestureArmed.current = true;
      }

      if (e.cancelable) e.preventDefault();
      handlers.current.onDrag?.(dy, true);
    };

    const end = (x: number, y: number) => {
      if (!start.current) return;
      const dy = y - start.current.y;
      const dx = x - start.current.x;
      const dt = performance.now() - start.current.t;
      const wasArmed = gestureArmed.current;
      start.current = null;
      gestureArmed.current = false;
      handlers.current.onDrag?.(0, false);

      if (!wasArmed) return;

      const distY = Math.abs(dy);
      const distX = Math.abs(dx);
      if (distY < 8 && distX > distY * 2.5) return;

      const velocity = distY / Math.max(dt, 1);
      const distanceOk = distY >= threshold;
      const flickOk = distY >= threshold * 0.4 && velocity > 0.15;
      const snapOk = distY >= 12 && velocity > 0.4;
      const diagonalOk =
        Math.hypot(dx, dy) >= threshold * 1.1 && distY >= threshold * 0.35;

      if (!distanceOk && !flickOk && !snapOk && !diagonalOk) return;
      tryBeat(dy < 0 ? "next" : "prev");
    };

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
      move((e as PointerEvent).clientX, (e as PointerEvent).clientY, e);
    };

    const onPointerUp = (e: Event) => {
      end((e as PointerEvent).clientX, (e as PointerEvent).clientY);
    };

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
      const t = te.changedTouches[0];
      if (!t) {
        end(0, lastY.current);
        return;
      }
      end(t.clientX, t.clientY);
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
      window.removeEventListener("keydown", onKey);
      start.current = null;
      gestureArmed.current = false;
    };
  }, [enabled, threshold, cooldownMs, targetRef]);

  // ─── WHEEL (PC trackpad / mouse) — trigger only, zero physics ───
  useEffect(() => {
    if (!enabled) return;

    /**
     * After we fire one step, ignore the entire rest of this trackpad stream
     * (including inertia). Re-arm only after the stream has been quiet.
     * StoryCarousel step-lock is the second wall — this is the first.
     */
    let consumed = false;
    let acc = 0;
    let quietTimer: ReturnType<typeof setTimeout> | null = null;
    /** Absolute re-arm so a lost quiet timer can never soft-lock the visit */
    let failsafeTimer: ReturnType<typeof setTimeout> | null = null;

    const QUIET_MS = 450;
    const THRESHOLD = 30;

    const rearm = () => {
      consumed = false;
      acc = 0;
    };

    const normalize = (we: WheelEvent) => {
      let dy = we.deltaY;
      if (we.deltaMode === 1) dy *= 16;
      else if (we.deltaMode === 2) dy *= window.innerHeight || 800;
      return dy;
    };

    const onWheel = (e: Event) => {
      const we = e as WheelEvent;
      if (e.cancelable) e.preventDefault();

      // Re-arm only after the stream is quiet (no events). Never while scrolling.
      if (quietTimer != null) clearTimeout(quietTimer);
      quietTimer = setTimeout(() => {
        rearm();
        quietTimer = null;
      }, QUIET_MS);

      // Already took our one step for this stream — drop everything else
      if (consumed) return;

      acc += normalize(we);
      if (Math.abs(acc) < THRESHOLD) return;

      // Commit exactly one direction, then seal the stream
      const dir = acc > 0 ? "next" : "prev";
      acc = 0;
      consumed = true;

      // Belt: if quiet path fails, re-arm after 2s of wall time (not mid-burst steps)
      if (failsafeTimer != null) clearTimeout(failsafeTimer);
      failsafeTimer = setTimeout(() => {
        rearm();
        failsafeTimer = null;
      }, 2000);

      if (dir === "next") handlers.current.onNext();
      else handlers.current.onPrev();
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("wheel", onWheel);
      if (quietTimer != null) clearTimeout(quietTimer);
      if (failsafeTimer != null) clearTimeout(failsafeTimer);
      rearm();
    };
  }, [enabled]);
}
