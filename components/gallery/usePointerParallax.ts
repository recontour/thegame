"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Shared damped pointer / finger parallax for R3F scenes.
 * Only tracks while pointer is down on touch devices (via touchmove);
 * mouse always updates for desktop.
 */
export function usePointerParallax(enabled = true) {
  const target = useRef(new THREE.Vector2(0, 0));
  const current = useRef(new THREE.Vector2(0, 0));
  const touching = useRef(false);

  useEffect(() => {
    if (!enabled) {
      target.current.set(0, 0);
      return;
    }

    const setFromClient = (clientX: number, clientY: number) => {
      const x = (clientX / window.innerWidth) * 2 - 1;
      const y = (clientY / window.innerHeight) * 2 - 1;
      target.current.set(x * 0.55, -y * 0.55);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === "touch" && !touching.current) return;
      setFromClient(e.clientX, e.clientY);
    };

    const onPointerDown = (e: PointerEvent) => {
      touching.current = true;
      setFromClient(e.clientX, e.clientY);
    };

    const onPointerUp = () => {
      touching.current = false;
      // ease back toward center when finger lifts
      target.current.set(0, 0);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerUp, { passive: true });
    window.addEventListener("pointerleave", onPointerUp, { passive: true });

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("pointerleave", onPointerUp);
    };
  }, [enabled]);

  useFrame((_, delta) => {
    current.current.lerp(target.current, 1 - Math.exp(-5 * delta));
  });

  return current;
}
