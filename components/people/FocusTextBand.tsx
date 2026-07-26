"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { SlotTexture } from "@/components/people/useCarouselTextures";

type FocusTextBandProps = {
  /** Continuous carousel position (same ref cards use) */
  positionRef: React.MutableRefObject<number>;
  textures: SlotTexture[];
  cardCount: number;
  /**
   * Reports the top of the free band under the focused image,
   * as a 0..1 fraction of stage height (from top).
   */
  onBandTop: (topFrac: number) => void;
};

/**
 * Mirrors FloatingCard focus layout and projects the focused card’s bottom
 * edge into screen space so HTML copy can center in the leftover gap.
 */
export default function FocusTextBand({
  positionRef,
  textures,
  cardCount,
  onBandTop,
}: FocusTextBandProps) {
  const { camera, viewport } = useThree();
  const scratch = useRef(new THREE.Vector3());
  const lastSent = useRef(-1);
  const cb = useRef(onBandTop);

  useEffect(() => {
    cb.current = onBandTop;
  }, [onBandTop]);

  useFrame(() => {
    const p = positionRef.current;
    const nearest = ((Math.round(p) % cardCount) + cardCount) % cardCount;
    const frac = Math.abs(p - Math.round(p));
    // Only pin text band when nearly focused (avoids thrash mid-swipe)
    if (frac > 0.12) return;

    const tex = textures[nearest]?.texture ?? null;
    let aspect = 3 / 4;
    if (tex) {
      const ud = tex.userData as { width?: number; height?: number };
      if (ud?.width && ud?.height) {
        aspect = ud.width / Math.max(ud.height, 1);
      } else {
        const img = tex.image as { width?: number; height?: number } | undefined;
        if (img?.width && img?.height) {
          aspect = img.width / Math.max(img.height, 1);
        }
      }
    }
    aspect = THREE.MathUtils.clamp(aspect, 0.35, 2.8);

    // Must stay in sync with FloatingCard focus sizing / placement
    const frameW = Math.max(viewport.width, 0.5);
    const maxFocusW = frameW * 0.86;
    const scaleY = maxFocusW / aspect;
    const tallBoost = Math.max(0, 1 / aspect - 1) * 0.1;
    const shortBoost = Math.max(0, aspect - 1) * 0.08;
    const centerY = 0.62 + tallBoost + shortBoost;
    const bottomY = centerY - scaleY * 0.5;

    const v = scratch.current;
    v.set(0, bottomY, 0);
    v.project(camera);

    // NDC y: +1 top → −1 bottom  →  CSS top fraction
    const topFrac = THREE.MathUtils.clamp((1 - v.y) * 0.5, 0.28, 0.78);
    // Small gap under the image so copy isn’t glued to the edge
    const withGap = Math.min(0.82, topFrac + 0.018);

    if (Math.abs(withGap - lastSent.current) > 0.006) {
      lastSent.current = withGap;
      cb.current(withGap);
    }
  });

  return null;
}
