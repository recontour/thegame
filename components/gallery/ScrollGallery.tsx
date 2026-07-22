"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Series } from "@/data/series";
import DepthPhoto, { layoutForIndex } from "@/components/gallery/DepthPhoto";
import { useSeriesTextures } from "@/components/gallery/useSeriesTextures";
import { useVirtualScroll } from "@/components/gallery/useVirtualScroll";
import { usePointerParallax } from "@/components/gallery/usePointerParallax";

const SPACING = 4.6;
/** Camera sits this far in front of the active plane (clean contain framing) */
const VIEW_DISTANCE = 2.6;
const CAM_Z_START = VIEW_DISTANCE;
const CAM_Z_END_PAD = 1.2;

type ScrollGalleryProps = {
  series: Series;
  active?: boolean;
  preload?: boolean;
  onReady?: () => void;
  onLoadProgress?: (loaded: number, total: number) => void;
  onScrollProgress?: (progress: number) => void;
};

/**
 * Scroll through photographs in a black void.
 * Priority: sharp, correctly framed images — atmosphere stays light.
 */
export default function ScrollGallery({
  series,
  active = true,
  preload = true,
  onReady,
  onLoadProgress,
  onScrollProgress,
}: ScrollGalleryProps) {
  const photos = series.photos;
  const count = photos.length;
  const shouldLoad = preload || active;

  const { textures, ready, loadedCount } = useSeriesTextures(
    photos,
    shouldLoad,
  );
  const scrollProgressUi = useRef(0);
  const scroll = useVirtualScroll({
    enabled: active && ready,
    sensitivity: 0.001,
    damp: 3.2,
  });
  const pointer = usePointerParallax(active);

  const { camera } = useThree();
  const intro = useRef(0);
  const uiAcc = useRef(0);

  const layouts = useMemo(
    () => photos.map((_, i) => layoutForIndex(i, SPACING)),
    [photos],
  );

  const zEnd = useMemo(() => {
    if (count <= 0) return CAM_Z_START;
    const lastZ = -(count - 1) * SPACING;
    // Stop with the last photo at the same viewing distance as the first
    return lastZ + VIEW_DISTANCE;
  }, [count]);

  useEffect(() => {
    if (ready) onReady?.();
  }, [ready, onReady]);

  useEffect(() => {
    onLoadProgress?.(loadedCount, count);
  }, [loadedCount, count, onLoadProgress]);

  useEffect(() => {
    if (!active) {
      intro.current = 0;
      return;
    }
    intro.current = 0;
    // Snap camera to a sensible start when entering the void
    camera.position.set(0, 0, CAM_Z_START);
    camera.lookAt(0, 0, 0);
  }, [active, camera]);

  useFrame((_, delta) => {
    if (!active) return;

    intro.current = Math.min(1, intro.current + delta * 0.7);
    const introEase = intro.current * intro.current * (3 - 2 * intro.current);

    const p = scroll.current.progress;
    const targetZ = THREE.MathUtils.lerp(CAM_Z_START, zEnd, p);

    // Very mild drift — keep photos readable and centered
    const driftX = Math.sin(p * Math.PI * 1.1) * 0.06;
    const driftY = Math.cos(p * Math.PI * 0.85) * 0.03;

    camera.position.x = THREE.MathUtils.damp(
      camera.position.x,
      driftX + pointer.current.x * 0.04,
      4,
      delta,
    );
    camera.position.y = THREE.MathUtils.damp(
      camera.position.y,
      driftY + pointer.current.y * 0.03,
      4,
      delta,
    );
    camera.position.z = THREE.MathUtils.damp(
      camera.position.z,
      targetZ,
      5.5,
      delta,
    );

    // Look straight down the tunnel (stable framing)
    camera.lookAt(
      camera.position.x * 0.15,
      camera.position.y * 0.1,
      camera.position.z - VIEW_DISTANCE,
    );

    if ("fov" in camera) {
      const persp = camera as THREE.PerspectiveCamera;
      // Stable FOV — no dramatic zoom that crops photos
      const fovTarget = 45 + (1 - introEase) * 3;
      persp.fov = THREE.MathUtils.damp(persp.fov, fovTarget, 4, delta);
      persp.updateProjectionMatrix();
    }

    uiAcc.current += delta;
    if (uiAcc.current > 0.1) {
      uiAcc.current = 0;
      if (Math.abs(scrollProgressUi.current - p) > 0.002) {
        scrollProgressUi.current = p;
        onScrollProgress?.(p);
      }
    }
  });

  if (!active) return null;

  return (
    <group>
      {textures.map((tex, i) => {
        if (!tex) return null;
        return (
          <DepthPhoto
            key={photos[i]?.id ?? i}
            texture={tex}
            layout={layouts[i]}
            velocityRef={scroll}
            pointerRef={pointer}
            focusFalloff={SPACING * 1.4}
            fit={0.88}
          />
        );
      })}
    </group>
  );
}
