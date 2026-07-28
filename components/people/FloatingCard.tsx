"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { clamp01, lerp, smoothstep } from "@/components/people/math";

type FloatingCardProps = {
  index: number;
  count: number;
  positionRef: React.MutableRefObject<number>;
  presentRef: React.MutableRefObject<number>;
  /** Smoothed scroll energy from the scene (+ = advancing) */
  motionRef: React.MutableRefObject<number>;
  /** Live finger bias (card units) */
  dragBiasRef: React.MutableRefObject<number>;
  texture: THREE.Texture | null;
  geometry: THREE.PlaneGeometry;
  seed: number;
  floatAmp: number;
  focusX?: number;
  focusY?: number;
  immerseRotate?: number;
  immerseZoom?: number;
  immerseFit?: "cover" | "height" | "width";
};

/**
 * One image card — full ↔ framed morph + depth parallax from swipe motion.
 *
 * Near cards ride the finger harder; far cards lag (multiplane parallax).
 * Hero opacity stays solid so the morph never flashes.
 */
export default function FloatingCard({
  index,
  count,
  positionRef,
  presentRef,
  motionRef,
  dragBiasRef,
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
  const boundTex = useRef<THREE.Texture | null>(null);

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
    const present = clamp01(presentRef.current);

    const immerse = focus * (1 - present);
    // Single hermite on immerse only — no second "snap" curve on present
    const blend = immerse * immerse * (3 - 2 * immerse);

    // Soft park near focus (was a hard ad < 0.12 lock → visible chop)
    const park = smoothstep(0.35, 0.06, ad);
    const layoutD = d * (1 - park);
    const layoutAd = ad * (1 - park);
    const layoutFocus = lerp(focus, 1, park);

    const frameW = Math.max(viewport.width, 0.5);
    const frameH = Math.max(viewport.height, 0.5);

    // ——— Settled framed layout ———
    const maxFocusW = frameW * 0.94;
    const maxFarW = frameW * 0.42;
    const restW = lerp(maxFarW, maxFocusW, layoutFocus);
    const restH = restW / aspect;
    const tallBoost = layoutFocus * Math.max(0, 1 / aspect - 1) * 0.1;
    const shortBoost = layoutFocus * Math.max(0, aspect - 1) * 0.08;
    const restY = -layoutD * 1.05 + 0.62 + tallBoost + shortBoost;
    const restZ = -layoutAd * 1.35 - layoutD * layoutD * 0.08;
    const restXWander =
      (1 - layoutFocus) *
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

    // ——— Multiplane parallax from swipe / travel ———
    // motion + = advancing (finger up). Foreground moves more; depth lags.
    const motion = motionRef.current;
    const drag = dragBiasRef.current;
    const energy = motion + drag * 0.35;

    // 1 near camera … 0 far in the stack
    const nearness = clamp01(1 - ad / 2.4);
    const depthWeight = lerp(0.22, 1, nearness * nearness);
    // Immersive hero: gentle crop-shift feel, not a big slide
    const paraAmp = lerp(0.55, 0.18, blend);
    const paraY = -energy * paraAmp * depthWeight * frameH * 0.14;
    // Far cards drift slightly sideways (depth cue) with opposite lag
    const paraX =
      energy *
      (1 - nearness) *
      0.08 *
      (seed - 0.5) *
      2 *
      (1 - blend * 0.7);
    // Push background deeper while scrubbing
    const paraZ = -Math.abs(energy) * (1 - nearness) * 0.35 * (1 - blend);
    // Subtle tilt into the swipe
    const paraTiltX = energy * 0.045 * depthWeight * (1 - blend * 0.85);
    const paraTiltZ =
      energy * 0.02 * (seed - 0.5) * (1 - layoutFocus) * (1 - blend);

    // Extra: during full-bleed, shift crop with motion (subject breathes)
    const cropShiftY = blend * energy * 0.04 * frameH * (fy - 0.5 + 0.5);

    const scaleX = lerp(restW, fullW, blend);
    const scaleY = lerp(restH, fullH, blend);
    // Micro scale pulse on neighbors during travel — soft depth pop
    const scalePulse =
      1 + (1 - nearness) * Math.abs(energy) * 0.04 * (1 - blend);

    const t = clock.elapsedTime;
    const floatMul =
      lerp(1, 0, blend) * floatAmp * lerp(0.12, 1, present) *
      (1 - Math.min(1, Math.abs(energy) * 0.8));
    const bob =
      Math.sin(t * 0.48 + seed * 6.2) *
      0.024 *
      floatMul *
      (0.45 + layoutFocus * 0.55);
    const sway =
      Math.sin(t * 0.3 + seed * 4.1) *
      0.012 *
      floatMul *
      (0.2 + (1 - layoutFocus) * 0.55);

    const x =
      lerp(restXWander, fullX, blend) +
      sway * (1 - layoutFocus * 0.85) * (1 - blend) +
      paraX;
    const y =
      lerp(restY + bob, fullY, blend) + paraY + cropShiftY;
    const z = lerp(restZ, fullZ, blend) + paraZ;

    mesh.position.set(x, y, z);
    mesh.scale.set(scaleX * scalePulse, scaleY * scalePulse, 1);

    const restRotZ =
      (seed - 0.5) * 0.1 * (1 - layoutFocus) +
      Math.sin(t * 0.4 + seed) * 0.01 * floatMul * (1 - layoutFocus * 0.85);
    mesh.rotation.z =
      restRotZ * (1 - blend) + rotAmt * blend + paraTiltZ;
    mesh.rotation.x =
      (-0.03 * (1 - layoutFocus) + layoutD * 0.025) * (1 - blend) +
      paraTiltX;
    mesh.rotation.y = restXWander * 0.2 * (1 - blend) + paraX * 0.15;

    // ——— Opacity ———
    const texReady = texture ? 1 : 0.28;
    if (ad < 0.45) {
      mat.opacity = texReady;
      const lit = lerp(0.84, 1, focus);
      mat.color.setRGB(lit, lit, lit);
      mat.depthWrite = focus > 0.75 && present > 0.12;
    } else {
      const settleReveal = smoothstep(0.18, 0.8, present);
      // Keep a whisper of far cards during travel so parallax reads
      const travelGhost =
        (1 - present) * smoothstep(1.8, 0.5, ad) * 0.22;
      const opacity =
        (lerp(0.1, 0.88, focus) *
          mid *
          texReady *
          clamp01(1.15 - ad * 0.28) *
          settleReveal) +
        travelGhost * texReady;
      mat.opacity = Math.min(1, opacity);
      const dim = texture ? lerp(0.5, 0.95, focus) : 0.22;
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
