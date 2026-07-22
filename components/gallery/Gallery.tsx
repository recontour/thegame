"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import * as THREE from "three";
import type { Series } from "@/data/series";
import PhotoPlane from "@/components/gallery/PhotoPlane";
import { useSeriesTextures } from "@/components/gallery/useSeriesTextures";
import { usePointerParallax } from "@/components/gallery/usePointerParallax";
import { useGallerySwipe } from "@/components/gallery/useGallerySwipe";

type GalleryProps = {
  series: Series;
  active?: boolean;
  onIndexChange?: (index: number) => void;
  onReady?: () => void;
};

type SlotState = {
  index: number;
  progress: number;
  glitch: number;
  opacity: number;
  x: number;
  z: number;
  rotY: number;
};

const IDLE_CURRENT: SlotState = {
  index: 0,
  progress: 1,
  glitch: 0,
  opacity: 1,
  x: 0,
  z: 0.15,
  rotY: 0,
};

/**
 * Dual-plane cinematic gallery: only two slots animate, good for mobile.
 * Swipe left = next, swipe right = previous. No wrap at ends.
 */
export default function Gallery({
  series,
  active = true,
  onIndexChange,
  onReady,
}: GalleryProps) {
  const count = series.photos.length;
  const { textures, ready } = useSeriesTextures(series.photos);
  const pointer = usePointerParallax(active && ready);

  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const busy = useRef(false);

  const current = useRef<SlotState>({ ...IDLE_CURRENT, index: 0 });
  const incoming = useRef<SlotState | null>(null);
  // re-render throttle via version tick
  const [, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    onIndexChange?.(index);
  }, [index, onIndexChange]);

  useEffect(() => {
    if (ready) onReady?.();
  }, [ready, onReady]);

  const transitionTween = useRef<gsap.core.Tween | null>(null);

  const goTo = useCallback(
    (nextIndex: number, direction: 1 | -1) => {
      if (!active || !ready || busy.current) return;
      if (nextIndex < 0 || nextIndex >= count) return;
      if (nextIndex === indexRef.current) return;

      busy.current = true;
      const from = indexRef.current;
      const dir = direction;

      // outgoing = current, incoming starts off-axis with depth
      current.current = {
        index: from,
        progress: 1,
        glitch: 0,
        opacity: 1,
        x: 0,
        z: 0.15,
        rotY: 0,
      };
      incoming.current = {
        index: nextIndex,
        progress: 0.85,
        glitch: 0,
        opacity: 0,
        x: dir * 1.35,
        z: -0.55,
        rotY: dir * -0.12,
      };

      const out = current.current;
      const inn = incoming.current;
      const proxy = { t: 0 };

      transitionTween.current?.kill();
      transitionTween.current = gsap.to(proxy, {
        t: 1,
        duration: 0.95,
        ease: "power3.inOut",
        onUpdate: () => {
          const t = proxy.t;
          // glitch peaks mid-transition
          const glitch = Math.sin(t * Math.PI) * 0.85;

          out.x = THREE.MathUtils.lerp(0, -dir * 1.25, t);
          out.z = THREE.MathUtils.lerp(0.15, -0.45, t);
          out.rotY = THREE.MathUtils.lerp(0, dir * 0.1, t);
          out.opacity = THREE.MathUtils.lerp(1, 0, t);
          out.glitch = glitch;
          out.progress = 1;

          inn.x = THREE.MathUtils.lerp(dir * 1.35, 0, t);
          inn.z = THREE.MathUtils.lerp(-0.55, 0.15, t);
          inn.rotY = THREE.MathUtils.lerp(dir * -0.12, 0, t);
          inn.opacity = THREE.MathUtils.lerp(0, 1, t);
          inn.glitch = glitch;
          inn.progress = THREE.MathUtils.lerp(0.85, 1, t);

          bump();
        },
        onComplete: () => {
          indexRef.current = nextIndex;
          setIndex(nextIndex);
          current.current = { ...IDLE_CURRENT, index: nextIndex };
          incoming.current = null;
          busy.current = false;
          transitionTween.current = null;
          bump();
        },
      });
    },
    [active, ready, count, bump],
  );

  useEffect(() => {
    return () => {
      transitionTween.current?.kill();
    };
  }, []);

  const next = useCallback(() => {
    goTo(indexRef.current + 1, 1);
  }, [goTo]);

  const prev = useCallback(() => {
    goTo(indexRef.current - 1, -1);
  }, [goTo]);

  useGallerySwipe({
    enabled: active && ready,
    onSwipeLeft: next,
    onSwipeRight: prev,
  });

  // intro when gallery becomes active
  useEffect(() => {
    if (!active || !ready) return;
    current.current = {
      ...IDLE_CURRENT,
      index: indexRef.current,
      opacity: 0,
      progress: 0.7,
      z: -0.2,
    };
    bump();
    const proxy = { t: 0 };
    const tween = gsap.to(proxy, {
      t: 1,
      duration: 1.1,
      ease: "power2.out",
      onUpdate: () => {
        const t = proxy.t;
        current.current.opacity = t;
        current.current.progress = THREE.MathUtils.lerp(0.7, 1, t);
        current.current.z = THREE.MathUtils.lerp(-0.2, 0.15, t);
        current.current.glitch = Math.sin(t * Math.PI) * 0.25;
        bump();
      },
      onComplete: () => {
        current.current.glitch = 0;
        bump();
      },
    });
    return () => {
      tween.kill();
    };
  }, [active, ready, bump]);

  // Keep hooks/texture loading warm while inactive; render only when active.
  if (!ready || !active) return null;

  const cur = current.current;
  const inn = incoming.current;
  const pointerVec = pointer.current;

  return (
    <group>
      <PhotoPlane
        texture={textures[cur.index] ?? null}
        progress={cur.progress}
        glitch={cur.glitch}
        opacity={cur.opacity}
        modeReveal={0}
        grain={0.03}
        position={[cur.x, 0, cur.z]}
        rotation={[0, cur.rotY, 0]}
        pointer={pointerVec}
        parallax={0.09}
        fit={0.9}
      />
      {inn && (
        <PhotoPlane
          texture={textures[inn.index] ?? null}
          progress={inn.progress}
          glitch={inn.glitch}
          opacity={inn.opacity}
          modeReveal={0}
          grain={0.03}
          position={[inn.x, 0, inn.z]}
          rotation={[0, inn.rotY, 0]}
          pointer={pointerVec}
          parallax={0.09}
          fit={0.9}
        />
      )}
    </group>
  );
}
