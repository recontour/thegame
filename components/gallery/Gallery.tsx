"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import * as THREE from "three";
import type { Series } from "@/data/series";
import PhotoPlane, {
  GalleryPlaceholder,
} from "@/components/gallery/PhotoPlane";
import { useSeriesTextures } from "@/components/gallery/useSeriesTextures";
import { usePointerParallax } from "@/components/gallery/usePointerParallax";
import { useGallerySwipe } from "@/components/gallery/useGallerySwipe";

type GalleryProps = {
  series: Series;
  /** When true, show current slide and accept swipes */
  active?: boolean;
  /**
   * When true, run sequential texture loading even if not active yet
   * (start after hero is visible).
   */
  preload?: boolean;
  onIndexChange?: (index: number) => void;
  onReady?: () => void;
  onLoadProgress?: (loaded: number, total: number) => void;
};

type SlotState = {
  index: number;
  progress: number;
  opacity: number;
  x: number;
  z: number;
  rotY: number;
};

const IDLE: SlotState = {
  index: 0,
  progress: 1,
  opacity: 1,
  x: 0,
  z: 0.12,
  rotY: 0,
};

/**
 * Mobile-safe cinematic gallery.
 * Loads textures one-by-one; only mounts a photo plane when its texture exists.
 */
export default function Gallery({
  series,
  active = true,
  preload = true,
  onIndexChange,
  onReady,
  onLoadProgress,
}: GalleryProps) {
  const count = series.photos.length;
  const shouldLoad = preload || active;

  const {
    textures,
    ready,
    complete,
    status,
    error,
    loadedCount,
    loadingIndex,
    failed,
  } = useSeriesTextures(series.photos, shouldLoad);

  const pointer = usePointerParallax(active && ready);

  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const busy = useRef(false);
  const current = useRef<SlotState>({ ...IDLE });
  const incoming = useRef<SlotState | null>(null);
  const [, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);
  const introDone = useRef(false);

  const texturesRef = useRef(textures);
  texturesRef.current = textures;

  useEffect(() => {
    console.log("[Gallery]", {
      active,
      shouldLoad,
      ready,
      complete,
      status,
      loadedCount,
      loadingIndex,
      failed: failed.length,
      error,
    });
  }, [
    active,
    shouldLoad,
    ready,
    complete,
    status,
    loadedCount,
    loadingIndex,
    failed,
    error,
  ]);

  useEffect(() => {
    onLoadProgress?.(loadedCount, count);
  }, [loadedCount, count, onLoadProgress]);

  useEffect(() => {
    onIndexChange?.(index);
  }, [index, onIndexChange]);

  useEffect(() => {
    if (ready) onReady?.();
  }, [ready, onReady]);

  const transitionTween = useRef<gsap.core.Tween | null>(null);

  /** Find nearest loaded index in a direction (skip holes from failed loads). */
  const findLoaded = useCallback(
    (from: number, dir: 1 | -1): number | null => {
      let i = from + dir;
      while (i >= 0 && i < count) {
        if (texturesRef.current[i]) return i;
        i += dir;
      }
      return null;
    },
    [count],
  );

  const goTo = useCallback(
    (nextIndex: number, direction: 1 | -1) => {
      if (!active || !ready || busy.current) return;
      if (nextIndex < 0 || nextIndex >= count) return;
      if (nextIndex === indexRef.current) return;

      if (!texturesRef.current[nextIndex]) {
        // Skip forward/back to next available loaded frame
        const alt = findLoaded(indexRef.current, direction);
        if (alt == null) {
          console.warn("[Gallery] no loaded texture in direction", direction);
          return;
        }
        nextIndex = alt;
      }

      busy.current = true;
      const from = indexRef.current;
      const dir = direction;

      current.current = {
        index: from,
        progress: 1,
        opacity: 1,
        x: 0,
        z: 0.12,
        rotY: 0,
      };
      incoming.current = {
        index: nextIndex,
        progress: 0.9,
        opacity: 0,
        x: dir * 1.2,
        z: -0.4,
        rotY: dir * -0.08,
      };

      const out = current.current;
      const inn = incoming.current;
      const proxy = { t: 0 };

      transitionTween.current?.kill();
      transitionTween.current = gsap.to(proxy, {
        t: 1,
        duration: 0.85,
        ease: "power3.inOut",
        onUpdate: () => {
          const t = proxy.t;
          out.x = THREE.MathUtils.lerp(0, -dir * 1.15, t);
          out.z = THREE.MathUtils.lerp(0.12, -0.35, t);
          out.rotY = THREE.MathUtils.lerp(0, dir * 0.08, t);
          out.opacity = THREE.MathUtils.lerp(1, 0, t);
          out.progress = 1;

          inn.x = THREE.MathUtils.lerp(dir * 1.2, 0, t);
          inn.z = THREE.MathUtils.lerp(-0.4, 0.12, t);
          inn.rotY = THREE.MathUtils.lerp(dir * -0.08, 0, t);
          inn.opacity = THREE.MathUtils.lerp(0, 1, t);
          inn.progress = THREE.MathUtils.lerp(0.9, 1, t);
          bump();
        },
        onComplete: () => {
          indexRef.current = nextIndex;
          setIndex(nextIndex);
          current.current = { ...IDLE, index: nextIndex };
          incoming.current = null;
          busy.current = false;
          transitionTween.current = null;
          bump();
        },
      });
    },
    [active, ready, count, bump, findLoaded],
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

  // Soft intro when gallery becomes active and first texture exists
  useEffect(() => {
    if (!active || !ready || introDone.current) return;
    introDone.current = true;

    // Prefer first loaded texture (may not be index 0 if it failed)
    let start = 0;
    if (!texturesRef.current[0]) {
      const first = texturesRef.current.findIndex((t) => t != null);
      if (first >= 0) start = first;
    }
    indexRef.current = start;
    setIndex(start);

    current.current = {
      ...IDLE,
      index: start,
      opacity: 0,
      progress: 0.75,
      z: -0.15,
    };
    bump();

    const proxy = { t: 0 };
    const tween = gsap.to(proxy, {
      t: 1,
      duration: 1.0,
      ease: "power2.out",
      onUpdate: () => {
        const t = proxy.t;
        current.current.opacity = t;
        current.current.progress = THREE.MathUtils.lerp(0.75, 1, t);
        current.current.z = THREE.MathUtils.lerp(-0.15, 0.12, t);
        bump();
      },
    });

    return () => {
      tween.kill();
    };
  }, [active, ready, bump]);

  // Preload-only mode: no visible planes
  if (!active) return null;

  const cur = current.current;
  const inn = incoming.current;
  const pointerVec = pointer.current;
  const curTex = textures[cur.index] ?? null;
  const innTex = inn ? textures[inn.index] ?? null : null;
  const showPlaceholder =
    !curTex || (loadingIndex === cur.index && !curTex);

  return (
    <group>
      {/* Subtle almost-black stand-in while waiting for the current slide */}
      {showPlaceholder && (
        <GalleryPlaceholder pointer={pointerVec} opacity={0.4} />
      )}

      {/* Only create photo meshes after textures exist */}
      {curTex && (
        <PhotoPlane
          texture={curTex}
          progress={cur.progress}
          opacity={cur.opacity}
          position={[cur.x, 0, cur.z]}
          rotation={[0, cur.rotY, 0]}
          pointer={pointerVec}
          parallax={0.09}
          fit={0.9}
        />
      )}

      {inn && innTex && (
        <PhotoPlane
          texture={innTex}
          progress={inn.progress}
          opacity={inn.opacity}
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
