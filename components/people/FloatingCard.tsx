"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { clamp01, lerp, smoothstep } from "@/components/people/math";

type FloatingCardProps = {
  index: number;
  count: number;
  /** Continuous carousel position (mutated only in parent useFrame) */
  positionRef: React.MutableRefObject<number>;
  /**
   * 0 = full-bleed immersive (covers stage top→bottom)
   * 1 = settled framed pose (existing layout with room for copy)
   */
  presentRef: React.MutableRefObject<number>;
  /** Active story index — hero morph uses this, not floaty position drift */
  targetIndexRef: React.MutableRefObject<number>;
  texture: THREE.Texture | null;
  /** Shared unit plane; we scale the mesh */
  geometry: THREE.PlaneGeometry;
  seed: number;
  floatAmp: number;
  /** Full-bleed crop anchor — subject left / center / right */
  focusX?: number;
  focusY?: number;
  /** Degrees of Z rotation while full-bleed (0 when settled) */
  immerseRotate?: number;
  /** Full-bleed scale vs cover (1 = flush, <1 = margin / zoom-out) */
  immerseZoom?: number;
  /** cover | height (top/bottom) | width (left/right) */
  immerseFit?: "cover" | "height" | "width";
};

/**
 * One image card — same mesh for full-bleed and framed rest.
 * The hero only changes scale/position/rotation; opacity stays solid.
 *
 * Production: textures need gl.initTexture() on the live WebGL context.
 */
export default function FloatingCard({
  index,
  count,
  positionRef,
  presentRef,
  targetIndexRef,
  texture,
  geometry,
  seed,
  floatAmp,
  focusX = 0.5,
  focusY = 0.5,
  immerseRotate = 0,
  immerseZoom = 1,
  immerseFit = "cover",
}: FloatingCardProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const { viewport, gl } = useThree();
  /** Last texture we bound — avoid needsUpdate thrash */
  const boundTex = useRef<THREE.Texture | null>(null);

  // Bind map only when the texture object actually changes
  useEffect(() => {
    const mat = matRef.current;
    if (!mat) return;

    if (texture === boundTex.current) return;
    boundTex.current = texture;

    if (texture) {
      try {
        gl.initTexture(texture);
      } catch (e) {
        console.warn("[FloatingCard] initTexture", e);
      }
      mat.map = texture;
      mat.needsUpdate = true;
    } else {
      mat.map = null;
      mat.needsUpdate = true;
    }
  }, [texture, gl]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    const mat = matRef.current;
    if (!mesh || !mat) return;

    const p = positionRef.current;
    let d = index - p;
    d = ((d % count) + count) % count;
    if (d > count / 2) d -= count;
    const ad = Math.abs(d);

    // Active story card (the one we're morphing) — not "nearest by float"
    const target = targetIndexRef.current;
    let td = index - target;
    td = ((td % count) + count) % count;
    if (td > count / 2) td -= count;
    const isHero = Math.abs(td) < 0.001;

    const visible = ad < 3.2 || isHero;
    mesh.visible = visible;
    if (!visible) return;

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

    // Carousel focus for neighbors; hero is always fully focused for layout
    const focus = isHero ? 1 : smoothstep(1.15, 0.05, ad);
    const mid = isHero ? 1 : smoothstep(2.6, 0.9, ad);

    // Linear present for scale (smoothstep made the first/last beats feel stuck)
    const present = clamp01(presentRef.current);
    // Hero: one continuous element, full (0) → framed (1)
    // Neighbors: never immersive
    const immerse = isHero ? 1 - present : 0;

    // For hero layout, ignore residual carousel drift (d forced 0)
    const layoutD = isHero ? 0 : d;
    const layoutAd = isHero ? 0 : ad;

    const frameW = Math.max(viewport.width, 0.5);
    const frameH = Math.max(viewport.height, 0.5);

    // ——— Settled framed layout (original) ———
    const maxFocusW = frameW * 0.94;
    const maxFarW = frameW * 0.42;
    const restW = lerp(maxFarW, maxFocusW, focus);
    const restH = restW / aspect;
    const tallBoost = focus * Math.max(0, 1 / aspect - 1) * 0.1;
    const shortBoost = focus * Math.max(0, aspect - 1) * 0.08;
    const restY = -layoutD * 1.05 + 0.62 + tallBoost + shortBoost;
    const restZ = -layoutAd * 1.35 - layoutD * layoutD * 0.08;
    const restXWander =
      (1 - focus) *
      (Math.sin(layoutD * 0.9) * 0.1 + (seed - 0.5) * 0.06);

    // ——— Full-bleed cover ———
    const rotAmt = THREE.MathUtils.degToRad(immerseRotate);
    const useRot = Math.abs(rotAmt) > 0.001;

    const zoom = THREE.MathUtils.clamp(immerseZoom, 0.5, 1.2);
    const fx = THREE.MathUtils.clamp(focusX, 0, 1);
    const fy = THREE.MathUtils.clamp(focusY, 0, 1);

    let fullW: number;
    let fullH: number;
    let fullX: number;
    let fullY: number;

    if (useRot) {
      let scaleX0: number;
      let scaleY0: number;
      if (immerseFit === "height") {
        scaleX0 = frameH;
        scaleY0 = frameH / aspect;
      } else if (immerseFit === "width") {
        scaleY0 = frameW;
        scaleX0 = frameW * aspect;
      } else {
        scaleY0 = Math.max(frameW, frameH / aspect);
        scaleX0 = scaleY0 * aspect;
      }
      fullW = scaleX0 * zoom;
      fullH = scaleY0 * zoom;
      const overflowX = Math.max(0, fullH - frameW);
      const overflowY = Math.max(0, fullW - frameH);
      fullX = (0.5 - fy) * overflowY;
      fullY = (0.5 - fx) * overflowX;
    } else if (immerseFit === "height") {
      fullH = frameH * zoom;
      fullW = fullH * aspect;
      const overflowX = Math.max(0, fullW - frameW);
      const overflowY = Math.max(0, fullH - frameH);
      fullX = (0.5 - fx) * overflowX;
      fullY = (0.5 - fy) * overflowY;
    } else if (immerseFit === "width") {
      fullW = frameW * zoom;
      fullH = fullW / aspect;
      const overflowX = Math.max(0, fullW - frameW);
      const overflowY = Math.max(0, fullH - frameH);
      fullX = (0.5 - fx) * overflowX;
      fullY = (0.5 - fy) * overflowY;
    } else {
      const frameAspect = frameW / frameH;
      if (aspect > frameAspect) {
        fullH = frameH * zoom;
        fullW = fullH * aspect;
      } else {
        fullW = frameW * zoom;
        fullH = fullW / aspect;
      }
      const overflowX = Math.max(0, fullW - frameW);
      const overflowY = Math.max(0, fullH - frameH);
      fullX = (0.5 - fx) * overflowX;
      fullY = (0.5 - fy) * overflowY;
    }

    const fullZ = 0.02;

    // Smooth hermite only on the blend factor (not double-smoothed present)
    const blend = immerse * immerse * (3 - 2 * immerse);

    const scaleX = lerp(restW, fullW, blend);
    const scaleY = lerp(restH, fullH, blend);

    const t = clock.elapsedTime;
    // Float only when settled / non-hero — never during full-bleed
    const floatMul = lerp(1, 0, blend) * floatAmp * (isHero ? present : 1);
    const bob =
      Math.sin(t * 0.48 + seed * 6.2) *
      0.024 *
      floatMul *
      (0.45 + focus * 0.55);
    const sway =
      Math.sin(t * 0.3 + seed * 4.1) *
      0.012 *
      floatMul *
      (0.2 + (1 - focus) * 0.55);

    const x =
      lerp(restXWander, fullX, blend) +
      sway * (1 - focus * 0.85) * (1 - blend);
    const y = lerp(restY + bob, fullY, blend);
    const z = lerp(restZ, fullZ, blend);

    mesh.position.set(x, y, z);
    mesh.scale.set(scaleX, scaleY, 1);

    const restRotZ =
      (seed - 0.5) * 0.1 * (1 - focus) +
      Math.sin(t * 0.4 + seed) * 0.01 * floatMul * (1 - focus * 0.85);
    const fullRotZ = rotAmt * blend;
    mesh.rotation.z = restRotZ * (1 - blend) + fullRotZ;
    mesh.rotation.x =
      (-0.03 * (1 - focus) + layoutD * 0.025) * (1 - blend);
    mesh.rotation.y = restXWander * 0.2 * (1 - blend);

    // ——— Opacity: hero stays solid. Always. ———
    // Old bug: "hide neighbors" used ad > 0.04, so a tiny drag offset on the
    // hero made it nearly transparent while present was still low.
    if (isHero) {
      mat.opacity = texture ? 1 : 0.3;
      mat.color.setRGB(1, 1, 1);
      // Write depth as an opaque-feeling hero so nothing punches through
      mat.depthWrite = present > 0.15;
    } else {
      const texReady = texture ? 1 : 0.28;
      // Neighbors only exist in the settled world — fade with present
      const settleReveal = smoothstep(0.15, 0.75, present);
      const opacity =
        lerp(0.12, 0.92, focus) *
        mid *
        texReady *
        clamp01(1.15 - ad * 0.28) *
        settleReveal;
      mat.opacity = opacity;
      const dim = texture ? lerp(0.55, 1, focus) : 0.22;
      mat.color.setRGB(dim, dim, dim * 1.02);
      mat.depthWrite = false;
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry} frustumCulled={false}>
      <meshBasicMaterial
        ref={matRef}
        map={texture ?? undefined}
        color="#ffffff"
        transparent
        depthWrite={false}
        depthTest
        side={THREE.FrontSide}
        toneMapped={false}
      />
    </mesh>
  );
}
