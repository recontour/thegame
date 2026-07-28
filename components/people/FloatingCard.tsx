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
 * One image card. MeshBasicMaterial only (mobile-stable color path).
 *
 * Focused card morphs slowly between full-stage cover and the settled frame.
 * Settled pose math is unchanged so the text band still lines up.
 *
 * Production: CanvasTextures need gl.initTexture() on the live WebGL context.
 */
export default function FloatingCard({
  index,
  count,
  positionRef,
  presentRef,
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

  // Upload + bind map when texture arrives (must run against this Canvas's gl).
  // Opacity / color are owned exclusively by useFrame — never set them in JSX,
  // or React re-renders reset them to defaults and flash black on mobile.
  useEffect(() => {
    const mat = matRef.current;
    if (!mat) return;

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

    const visible = ad < 3.2;
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

    const focus = smoothstep(1.15, 0.05, ad);
    const mid = smoothstep(2.6, 0.9, ad);

    // Ease the morph so it breathes, not snaps
    const present = smoothstep(0, 1, clamp01(presentRef.current));
    // How much this card participates in the full-bleed treatment
    const immerse = focus * (1 - present);

    const frameW = Math.max(viewport.width, 0.5);
    const frameH = Math.max(viewport.height, 0.5);

    // ——— Settled framed layout (original — do not drift) ———
    const maxFocusW = frameW * 0.94;
    const maxFarW = frameW * 0.42;
    const restW = lerp(maxFarW, maxFocusW, focus);
    const restH = restW / aspect;
    const tallBoost = focus * Math.max(0, 1 / aspect - 1) * 0.1;
    const shortBoost = focus * Math.max(0, aspect - 1) * 0.08;
    const restY = -d * 1.05 + 0.62 + tallBoost + shortBoost;
    const restZ = -ad * 1.35 - d * d * 0.08;
    const restXWander =
      (1 - focus) * (Math.sin(d * 0.9) * 0.1 + (seed - 0.5) * 0.06);

    // ——— Full-bleed cover (stage top → bottom) ———
    // Optional 90° entry: landscape stands up to fill the tall frame,
    // then eases back to natural orientation on settle.
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
      // After ±90° Z, screen width ≈ mesh scaleY, screen height ≈ mesh scaleX.
      // Keep mesh local aspect = image aspect (scaleX = aspect * scaleY).
      let scaleX0: number;
      let scaleY0: number;
      if (immerseFit === "height") {
        // Full image top & bottom meet the screen — sides may breathe
        scaleX0 = frameH;
        scaleY0 = frameH / aspect;
      } else if (immerseFit === "width") {
        // Full image left & right meet the screen — top/bottom may breathe
        scaleY0 = frameW;
        scaleX0 = frameW * aspect;
      } else {
        // Cover the stage (may crop left/right or top/bottom)
        scaleY0 = Math.max(frameW, frameH / aspect);
        scaleX0 = scaleY0 * aspect;
      }
      fullW = scaleX0 * zoom;
      fullH = scaleY0 * zoom;
      // Crop anchors in rotated space (swap axes for the offset)
      const overflowX = Math.max(0, fullH - frameW); // visual X overflow
      const overflowY = Math.max(0, fullW - frameH); // visual Y overflow
      // Offsets applied in mesh-local space before rotation
      fullX = (0.5 - fy) * overflowY;
      fullY = (0.5 - fx) * overflowX;
    } else if (immerseFit === "height") {
      // Unrotated: image top & bottom flush with stage, sides may letterbox
      fullH = frameH * zoom;
      fullW = fullH * aspect;
      const overflowX = Math.max(0, fullW - frameW);
      const overflowY = Math.max(0, fullH - frameH);
      fullX = (0.5 - fx) * overflowX;
      fullY = (0.5 - fy) * overflowY;
    } else if (immerseFit === "width") {
      // Unrotated: image left & right flush with stage, top/bottom may letterbox
      fullW = frameW * zoom;
      fullH = fullW / aspect;
      const overflowX = Math.max(0, fullW - frameW);
      const overflowY = Math.max(0, fullH - frameH);
      fullX = (0.5 - fx) * overflowX;
      fullY = (0.5 - fy) * overflowY;
    } else {
      const frameAspect = frameW / frameH;
      if (aspect > frameAspect) {
        // Image wider than stage — height fills, sides crop
        fullH = frameH * zoom;
        fullW = fullH * aspect;
      } else {
        // Image taller / narrower — width fills, top/bottom crop
        fullW = frameW * zoom;
        fullH = fullW / aspect;
      }
      const overflowX = Math.max(0, fullW - frameW);
      const overflowY = Math.max(0, fullH - frameH);
      fullX = (0.5 - fx) * overflowX;
      fullY = (0.5 - fy) * overflowY;
    }

    // Stay near z=0 — large Z jumps + transparent materials z-fight on mobile
    const fullZ = 0.05;

    // Blend rest ↔ full by immerse (only the focused card fully immerses)
    const scaleX = lerp(restW, fullW, immerse);
    const scaleY = lerp(restH, fullH, immerse);

    const t = clock.elapsedTime;
    // Float dies away as we go full-bleed — still, like a held breath
    const floatMul = lerp(1, 0.05, immerse) * floatAmp;
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
      lerp(restXWander, fullX, immerse) +
      sway * (1 - focus * 0.85) * (1 - immerse);
    const y = lerp(restY + bob, fullY, immerse);
    const z = lerp(restZ, fullZ, immerse);

    mesh.position.set(x, y, z);
    mesh.scale.set(scaleX, scaleY, 1);

    const restRotZ =
      (seed - 0.5) * 0.1 * (1 - focus) +
      Math.sin(t * 0.4 + seed) * 0.01 * floatMul * (1 - focus * 0.85);
    // Immersive entry rotation eases out as we settle into the framed pose
    const fullRotZ = rotAmt * immerse;
    mesh.rotation.z = restRotZ * (1 - immerse) + fullRotZ;
    mesh.rotation.x = (-0.03 * (1 - focus) + d * 0.025) * (1 - immerse);
    mesh.rotation.y = restXWander * 0.2 * (1 - immerse);

    const texReady = texture ? 1 : 0.28;
    // Neighbors dissolve while the hero holds the frame
    const hideOthers = lerp(
      1,
      0.05,
      (1 - present) * (ad > 0.04 ? 1 : 0),
    );

    const opacity =
      lerp(0.12, 1, focus) *
      mid *
      texReady *
      clamp01(1.15 - ad * 0.28) *
      hideOthers;
    mat.opacity = opacity;

    const dim = texture ? lerp(0.55, 1, focus) : 0.22;
    // Full-bleed is pure — no desat/dim
    const lit = lerp(dim, 1, immerse);
    mat.color.setRGB(lit, lit, lit * lerp(1.02, 1, immerse));
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
