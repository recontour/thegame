"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Series } from "@/data/series";
import DepthPhoto, { layoutForIndex } from "@/components/gallery/DepthPhoto";
import { useSeriesTextures } from "@/components/gallery/useSeriesTextures";
import { useVirtualScroll } from "@/components/gallery/useVirtualScroll";
import { usePointerParallax } from "@/components/gallery/usePointerParallax";

const SPACING = 4.2;
/** Camera starts just in front of photo 0 */
const CAM_Z_START = 2.4;
/** Extra travel past the last photo */
const CAM_Z_END_PAD = 1.8;

type ScrollGalleryProps = {
  series: Series;
  active?: boolean;
  preload?: boolean;
  onReady?: () => void;
  onLoadProgress?: (loaded: number, total: number) => void;
  onScrollProgress?: (progress: number) => void;
};

/**
 * Scroll-driven journey through a dark 3D void of photographs.
 * Mobile-first virtual scroll; shader effects on each plane.
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
    sensitivity: 0.00105,
    damp: 3.0,
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
    return lastZ + CAM_Z_END_PAD;
  }, [count]);

  useEffect(() => {
    if (ready) onReady?.();
  }, [ready, onReady]);

  useEffect(() => {
    onLoadProgress?.(loadedCount, count);
  }, [loadedCount, count, onLoadProgress]);

  // Soft intro: ease camera in when gallery activates
  useEffect(() => {
    if (!active) {
      intro.current = 0;
      return;
    }
    intro.current = 0;
  }, [active]);

  useFrame((_, delta) => {
    if (!active) return;

    intro.current = Math.min(1, intro.current + delta * 0.55);
    const introEase = intro.current * intro.current * (3 - 2 * intro.current);

    const p = scroll.current.progress;
    const targetZ = THREE.MathUtils.lerp(CAM_Z_START, zEnd, p);

    // Slight lateral drift as we travel — living space, not a rail
    const driftX = Math.sin(p * Math.PI * 1.2) * 0.15;
    const driftY = Math.cos(p * Math.PI * 0.9) * 0.08;

    camera.position.x = THREE.MathUtils.damp(
      camera.position.x,
      driftX + pointer.current.x * 0.08,
      4,
      delta,
    );
    camera.position.y = THREE.MathUtils.damp(
      camera.position.y,
      driftY + pointer.current.y * 0.05,
      4,
      delta,
    );
    camera.position.z = THREE.MathUtils.damp(
      camera.position.z,
      targetZ,
      5.5,
      delta,
    );

    // Look slightly ahead into the void
    const lookZ = camera.position.z - 3.5;
    camera.lookAt(camera.position.x * 0.3, camera.position.y * 0.25, lookZ);

    // Intro: very soft FOV settle
    if ("fov" in camera) {
      const persp = camera as THREE.PerspectiveCamera;
      const fovTarget = 48 + (1 - introEase) * 6;
      persp.fov = THREE.MathUtils.damp(persp.fov, fovTarget, 3, delta);
      persp.updateProjectionMatrix();
    }

    // Throttle React UI updates (~10fps) so scroll stays on the GPU thread
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
            focusFalloff={SPACING * 1.35}
            fit={0.76}
          />
        );
      })}
    </group>
  );
}
