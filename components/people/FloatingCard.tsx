"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { clamp01, lerp, smoothstep } from "@/components/people/math";

type FloatingCardProps = {
  index: number;
  count: number;
  /** Continuous carousel position (mutated only in parent useFrame) */
  positionRef: React.MutableRefObject<number>;
  texture: THREE.Texture | null;
  /** Shared unit plane; we scale the mesh */
  geometry: THREE.PlaneGeometry;
  seed: number;
  floatAmp: number;
};

/**
 * One image card. MeshBasicMaterial only (mobile-stable color path).
 *
 * Production note: CanvasTextures must be uploaded with gl.initTexture() on the
 * active WebGL context — without it, many live/mobile builds show a white plane
 * at the correct aspect (dimensions exist, GPU map never bound). Matches Hero.
 */
export default function FloatingCard({
  index,
  count,
  positionRef,
  texture,
  geometry,
  seed,
  floatAmp,
}: FloatingCardProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { viewport, gl } = useThree();

  // Remount material when texture identity changes (reliable map bind in R3F)
  const material = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      map: texture,
      color: new THREE.Color("#ffffff"),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.FrontSide,
      toneMapped: false,
    });
  }, [texture]);

  useEffect(() => {
    if (texture) {
      try {
        // Critical on iOS / production WebGL — forces GPU upload of CanvasTexture
        gl.initTexture(texture);
      } catch (e) {
        console.warn("[FloatingCard] initTexture", e);
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      material.map = texture;
      material.needsUpdate = true;
    } else {
      material.map = null;
      material.needsUpdate = true;
    }
    return () => {
      material.dispose();
    };
  }, [texture, material, gl]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const p = positionRef.current;
    let d = index - p;
    d = ((d % count) + count) % count;
    if (d > count / 2) d -= count;
    const ad = Math.abs(d);

    // Hide far cards entirely (saves fill when opacity ~0)
    const visible = ad < 3.2;
    mesh.visible = visible;
    if (!visible) return;

    // Natural aspect (w/h). Landscape > 1, portrait < 1.
    let aspect = 3 / 4;
    if (texture) {
      const ud = texture.userData as { width?: number; height?: number };
      if (ud?.width && ud?.height) {
        aspect = ud.width / Math.max(ud.height, 1);
      } else {
        const img = texture.image as
          | { width?: number; height?: number }
          | undefined;
        if (img?.width && img?.height) {
          aspect = img.width / Math.max(img.height, 1);
        }
      }
    }
    aspect = THREE.MathUtils.clamp(aspect, 0.35, 2.8);

    const focus = smoothstep(1.15, 0.05, ad);
    const mid = smoothstep(2.6, 0.9, ad);

    /**
     * Hard horizontal fit: card width is a fraction of the visible world width
     * at the focus plane.
     */
    const frameW = Math.max(viewport.width, 0.5);
    const maxFocusW = frameW * 0.86;
    const maxFarW = frameW * 0.42;
    const baseW = lerp(maxFarW, maxFocusW, focus);
    const scaleX = baseW;
    const scaleY = baseW / aspect;

    const yBase = -d * 1.05;
    const zBase = -ad * 1.35 - d * d * 0.08;
    const xWander =
      (1 - focus) * (Math.sin(d * 0.9) * 0.1 + (seed - 0.5) * 0.06);

    const t = clock.elapsedTime;
    const bob =
      Math.sin(t * 0.55 + seed * 6.2) *
      0.024 *
      floatAmp *
      (0.45 + focus * 0.55);
    const sway =
      Math.sin(t * 0.33 + seed * 4.1) *
      0.012 *
      floatAmp *
      (0.2 + (1 - focus) * 0.55);

    const tallBoost = focus * Math.max(0, 1 / aspect - 1) * 0.1;
    const shortBoost = focus * Math.max(0, aspect - 1) * 0.08;

    mesh.position.set(
      xWander + sway * (1 - focus * 0.85),
      yBase + bob + 0.62 + tallBoost + shortBoost,
      zBase,
    );
    mesh.scale.set(scaleX, scaleY, 1);

    mesh.rotation.z =
      (seed - 0.5) * 0.1 * (1 - focus) +
      Math.sin(t * 0.4 + seed) * 0.01 * floatAmp * (1 - focus * 0.85);
    mesh.rotation.x = -0.03 * (1 - focus) + d * 0.025;
    mesh.rotation.y = xWander * 0.2;

    const texReady = texture ? 1 : 0.28;
    const opacity =
      lerp(0.12, 1, focus) * mid * texReady * clamp01(1.15 - ad * 0.28);
    material.opacity = opacity;
    const dim = texture ? lerp(0.55, 1, focus) : 0.22;
    material.color.setRGB(dim, dim, dim * 1.02);
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      frustumCulled={false}
    />
  );
}
